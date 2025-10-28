/**
 * Main Recipe Parser
 * Combines all parser modules to convert raw recipe text into structured meal JSON
 * This replaces Google Sheets + Apps Script parsing
 */

import { splitIntoSteps, cleanInstructionText, normalizeText } from "./splitter.js";
import { extractDuration, extractTemperature, extractIngredientsList } from "./extractors.js";
import { findCanonicalVerb, getDefaultDuration, getAttentionMode, getHoldWindow, getTemporalFlexibility } from "./verbMatcher.js";
import { inferDependencies, inferSequentialDependencies } from "./dependencies.js";
import { detectChains } from "./chains.js";
import { detectChainsSemanticly } from "./semanticChains.js";
import { generateEmergentIds, matchEmergentInputs } from "./emergentIngredients.js";
import { getHoldWindow as getEmergentHoldWindow, getTemporalFlexibility as getEmergentFlexibility, inferEmergentKey } from "../ontology/loadEmergentIngredients.js";

/**
 * Parse raw recipe text into structured meal object
 * @param {string} rawText - Raw recipe text
 * @param {string} title - Recipe title
 * @param {Object} options - Parsing options
 * @returns {Object} - Structured meal object
 */
export async function parseRecipe(rawText, title = "Untitled Recipe", options = {}) {
  const {
    autoDependencies = true,
    smartDependencies = false, // Use intelligent inference vs sequential
    roundAboutUp = true,
    defaultAttention = "attended",
    detectTaskChains = true, // Enable chain detection
    useSemanticChains = false // NEW: Two-phase hybrid (semantic + algorithmic)
  } = options;

  if (!rawText || !rawText.trim()) {
    return {
      title,
      author: { name: "Draft" },
      tasks: [],
      packs_meta: {}
    };
  }

  // Semantic chain detection (two-phase approach)
  let semanticResult = null;

  if (useSemanticChains && detectTaskChains) {
    // PHASE 1: Semantic chain detection FIRST (to get proper task list)
    console.log('🔍 Phase 1: Semantic chain detection...');
    semanticResult = await detectChainsSemanticly(rawText, title);
    console.log(`✅ Found ${semanticResult.chains.length} chains semantically`);
  }

  // Step 1: Normalize and split into steps
  const normalized = normalizeText(rawText);
  let stepTexts;

  if (semanticResult) {
    // Use semantic task descriptions as the source
    stepTexts = [];
    semanticResult.chains.forEach(chain => {
      stepTexts.push(...chain.tasks);
    });
    console.log(`📝 Using ${stepTexts.length} tasks from semantic chains`);
  } else {
    // Use traditional splitting
    stepTexts = splitIntoSteps(normalized);
  }

  // Step 2: Parse each step into a task
  const tasks = stepTexts.map((stepText, index) => {
    const cleaned = cleanInstructionText(stepText);
    
    // Extract verb
    const verbMatch = findCanonicalVerb(cleaned);
    const canonicalVerb = verbMatch.verb;

    // Extract duration
    const durationInfo = extractDuration(cleaned, roundAboutUp);
    const extractedDuration = durationInfo.value;

    // Extract temperature (for bake/roast tasks)
    const tempInfo = extractTemperature(cleaned);

    // Get defaults from verb definition
    const defaultDuration = getDefaultDuration(canonicalVerb);
    const attentionMode = getAttentionMode(canonicalVerb);
    const holdWindow = getHoldWindow(canonicalVerb);
    const temporalFlexibility = getTemporalFlexibility(canonicalVerb);

    // Determine final duration
    const plannedMin = extractedDuration ?? defaultDuration ?? null;

    // Determine attention requirements
    const requiresDriver = attentionMode === "attended";
    const selfRunningAfterStart = attentionMode === "unattended_after_start";

    // Build task object
    const task = {
      id: `step_${index + 1}`,
      name: cleaned,
      canonical_verb: canonicalVerb,
      duration_min: extractedDuration ? { value: extractedDuration } : null,
      planned_min: plannedMin,
      requires_driver: requiresDriver,
      self_running_after_start: selfRunningAfterStart,
      hold_window_minutes: holdWindow,
      temporal_flexibility: temporalFlexibility,
      inputs: extractIngredients(cleaned),
      outputs: [],
      equipment: extractEquipment(cleaned),
      edges: [],
      _meta: {
        verb_confidence: verbMatch.confidence,
        verb_source: verbMatch.source,
        duration_source: durationInfo.source,
        duration_approx: durationInfo.approx
      }
    };

    // Add temperature if found
    if (tempInfo.value && ["roast", "bake", "preheat_oven", "grill"].includes(canonicalVerb)) {
      task.temperature = tempInfo;
    }

    // Add redirect warning if guard triggered
    if (verbMatch.redirect) {
      task._meta.guard = {
        triggered: true,
        rationale: verbMatch.redirect.rationale,
        severity: verbMatch.redirect.severity,
        original_verb: canonicalVerb,
        suggested_verb: verbMatch.redirect.redirect_to
      };
    }

    return task;
  });

  // Step 3: Generate emergent IDs for outputs (TEMPORARILY DISABLED - debugging)
  // let tasksWithEmergents = generateEmergentIds(tasks);

  // Step 4: Match emergent IDs to inputs and add dependency edges (TEMPORARILY DISABLED - debugging)
  // tasksWithEmergents = matchEmergentInputs(tasksWithEmergents);

  // Step 5: Infer additional dependencies (equipment, temporal markers, etc.)
  let finalTasks = tasks;
  if (autoDependencies) {
    if (smartDependencies) {
      finalTasks = inferDependencies(tasks);
    } else {
      finalTasks = inferSequentialDependencies(tasks);
    }
  }

  // Step 6: Detect chains
  let chains = [];

  if (detectTaskChains) {
    if (semanticResult) {
      // We already have semantic chains from Phase 1
      // Now we just need to map them to the task IDs we created
      console.log('🔗 Phase 2: Mapping chains to parsed task IDs...');
      chains = mapSemanticChainsToTasks(semanticResult.chains, finalTasks);

      console.log('✅ Mapped chains:', chains.length);
      chains.forEach((chain, idx) => {
        console.log(`  ${chain.name} → ${chain.tasks.length} tasks`);
      });

      // Add sequential dependencies within each chain
      console.log('🔗 Adding sequential dependencies within chains...');
      finalTasks = addSequentialDependenciesWithinChains(finalTasks, chains);

      // Add cross-chain dependencies based on emergent ingredient flow
      console.log('🔗 Adding cross-chain dependencies with flexible constraints...');
      finalTasks = addCrossChainDependencies(finalTasks, chains);
    } else {
      // Legacy algorithmic chain detection
      chains = detectChains(finalTasks, rawText);
    }

    // Step 6b: Renumber tasks to show chain context
    if (chains.length > 0) {
      finalTasks = renumberTasksWithChainContext(finalTasks, chains);
    }
  }

  // Step 7: Extract ingredients list with quantities
  const ingredientsList = extractIngredientsList(rawText);

  // Step 8: Build meal object
  const meal = {
    title,
    author: { name: "Local Parser v2.0" },
    tasks: finalTasks,
    chains: chains.length > 0 ? chains : undefined, // Only include if chains detected
    ingredients: ingredientsList.length > 0 ? ingredientsList : undefined, // Ingredients with quantities
    packs_meta: {
      parser_version: "2.0.0",
      parsed_at: new Date().toISOString(),
      source: "local",
      options: {
        autoDependencies,
        smartDependencies,
        roundAboutUp,
        detectTaskChains
      }
    }
  };

  return meal;
}

/**
 * Adds sequential Finish-to-Start dependencies within each chain.
 * Each task (except the first) depends on the previous task finishing.
 * Uses FLEXIBLE vs RIGID constraints based on temporal_flexibility.
 *
 * @param {Object[]} tasks - Array of tasks
 * @param {Object[]} chains - Array of chains with task IDs
 * @returns {Object[]} - Tasks with updated edges
 */
function addSequentialDependenciesWithinChains(tasks, chains) {
  // Create a map for quick task lookup
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  chains.forEach(chain => {
    // For each chain, add FS edges between consecutive tasks
    for (let i = 1; i < chain.tasks.length; i++) {
      const currentTaskId = chain.tasks[i];
      const previousTaskId = chain.tasks[i - 1];

      const currentTask = taskMap.get(currentTaskId);
      const previousTask = taskMap.get(previousTaskId);

      if (currentTask && previousTask) {
        // Check if this edge already exists
        const edgeExists = currentTask.edges && currentTask.edges.some(
          edge => edge.from === previousTaskId && edge.to === currentTaskId && edge.type === 'FS'
        );

        if (!edgeExists) {
          // Try to infer emergent ingredient from predecessor's verb and task name
          // e.g., "drain pasta" → "drained_pasta", "grate cheese" → "grated_cheese"
          let emergentKey = null;

          // Common ingredients to check (expand this list as needed)
          const commonIngredients = [
            // Starches & Grains
            'pasta', 'spaghetti', 'noodles', 'rice', 'flour', 'breadcrumbs', 'tortilla',
            // Proteins
            'beef', 'chicken', 'salmon', 'fish', 'tilapia', 'bacon', 'eggs', 'egg_whites',
            // Dairy
            'cheese', 'cheddar', 'butter', 'cream', 'milk',
            // Vegetables (general)
            'vegetables', 'onion', 'garlic', 'carrot', 'cauliflower', 'broccoli',
            'pepper', 'mushroom', 'cabbage', 'tomato', 'corn', 'peas', 'ginger', 'chilli',
            'avocado', 'cilantro', 'lime', 'lemon', 'olive', 'red_onion',
            // Liquids
            'water', 'stock', 'wine', 'sauce', 'oil',
            // Baking
            'dough', 'batter', 'mixture',
            // Compounds
            'spice_blend', 'spices'
          ];

          // Try to infer emergent key by checking task name for ingredient mentions
          for (const ingredient of commonIngredients) {
            const taskNameLower = previousTask.name.toLowerCase();
            if (taskNameLower.includes(ingredient.replace('_', ' '))) {
              emergentKey = inferEmergentKey(ingredient, previousTask.canonical_verb);
              if (emergentKey) {
                console.log(`✅ Matched: "${ingredient}" in "${previousTask.name.substring(0, 40)}..." + verb "${previousTask.canonical_verb}" → "${emergentKey}"`);
                break;
              } else {
                console.log(`⚠️ Found "${ingredient}" in task but NO emergent key for verb "${previousTask.canonical_verb}"`);
              }
            }
          }

          // Get hold window from emergent ingredient (if found), otherwise fall back to verb
          let holdWindow = previousTask.hold_window_minutes || 0;
          let temporalFlex = previousTask.temporal_flexibility;

          if (emergentKey) {
            // Use emergent ingredient hold window (this is the correct source!)
            holdWindow = getEmergentHoldWindow(emergentKey, holdWindow);
            temporalFlex = getEmergentFlexibility(emergentKey, temporalFlex);
            console.log(`🔗 Edge ${previousTaskId} → ${currentTaskId}: Using emergent ingredient "${emergentKey}" (${holdWindow}min, ${temporalFlex})`);
          } else {
            // Fallback to verb hold window (legacy behavior)
            console.log(`🔗 Edge ${previousTaskId} → ${currentTaskId}: No emergent ingredient found, using verb hold window (${holdWindow}min, ${temporalFlex})`);
          }

          // FLEXIBLE: Task output can hold (prep_any_time, hold_days, hold_hours, hold_minutes)
          // RIGID: Task output must be used immediately (serve_immediate)
          const constraint = (temporalFlex === 'serve_immediate') ? 'RIGID' : 'FLEXIBLE';

          // Add FS (Finish-to-Start) dependency with constraint
          if (!currentTask.edges) {
            currentTask.edges = [];
          }

          const edge = {
            from: previousTaskId,
            to: currentTaskId,
            type: 'FS',
            constraint: constraint
          };

          // For FLEXIBLE edges, add hold window metadata
          if (constraint === 'FLEXIBLE' && holdWindow > 0) {
            edge.hold_window_minutes = holdWindow;
            edge.temporal_flexibility = temporalFlex;
          }

          // Add emergent ingredient key for debugging
          if (emergentKey) {
            edge.emergent_ingredient = emergentKey;
          }

          currentTask.edges.push(edge);
        }
      }
    }
  });

  return tasks;
}

/**
 * Adds cross-chain dependencies based on emergent ingredient flow.
 * Uses FLEXIBLE constraints since cross-chain dependencies typically involve
 * ingredients that can hold (sauces, prepped ingredients, cooked components).
 *
 * @param {Object[]} tasks - Array of tasks
 * @param {Object[]} chains - Array of chains with inputs/outputs
 * @returns {Object[]} - Tasks with updated edges
 */
function addCrossChainDependencies(tasks, chains) {
  // Create maps for quick lookup
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const chainMap = new Map(chains.map(c => [c.id, c]));

  chains.forEach(chain => {
    // For each input this chain needs from another chain
    if (!chain.inputs || chain.inputs.length === 0) return;

    chain.inputs.forEach(input => {
      if (!input.from_chain || !input.required) return;

      const sourceChain = chainMap.get(input.from_chain);
      if (!sourceChain || !sourceChain.tasks || sourceChain.tasks.length === 0) return;

      // Get the LAST task of the source chain (the one that produces the output)
      const sourceTaskId = sourceChain.tasks[sourceChain.tasks.length - 1];
      const sourceTask = taskMap.get(sourceTaskId);

      // Get the FIRST task of the dependent chain (the one that needs the input)
      const dependentTaskId = chain.tasks[0];
      const dependentTask = taskMap.get(dependentTaskId);

      if (!sourceTask || !dependentTask) return;

      // Check if edge already exists
      const edgeExists = dependentTask.edges && dependentTask.edges.some(
        edge => edge.from === sourceTaskId && edge.to === dependentTaskId
      );

      if (!edgeExists) {
        // Cross-chain dependencies are typically FLEXIBLE because:
        // - Sauces can hold for hours
        // - Prepped ingredients can hold for days
        // - Cooked components can usually wait

        const holdWindow = sourceTask.hold_window_minutes || 0;
        const temporalFlex = sourceTask.temporal_flexibility || 'hold_hours';

        // Use FLEXIBLE constraint unless the source task is serve_immediate
        const constraint = (temporalFlex === 'serve_immediate') ? 'RIGID' : 'FLEXIBLE';

        if (!dependentTask.edges) {
          dependentTask.edges = [];
        }

        const edge = {
          from: sourceTaskId,
          to: dependentTaskId,
          type: 'FS',
          constraint: constraint,
          cross_chain: true,
          emergent_ingredient: input.ingredient
        };

        if (constraint === 'FLEXIBLE' && holdWindow > 0) {
          edge.hold_window_minutes = holdWindow;
          edge.temporal_flexibility = temporalFlex;
        }

        dependentTask.edges.push(edge);

        console.log(`  ✅ Cross-chain: ${sourceChain.name} → ${chain.name} (${constraint}, ${holdWindow}min hold)`);
      }
    });
  });

  return tasks;
}

/**
 * Map semantic chains to actual parsed tasks
 * When using semantic chains, tasks are parsed in order from semantic task descriptions,
 * so we can map by sequential order rather than fuzzy matching.
 * @param {Object[]} semanticChains - Chains from semantic detection
 * @param {Object[]} parsedTasks - Algorithmically parsed tasks (in same order as semantic)
 * @returns {Object[]} - Chains with task IDs
 */
function mapSemanticChainsToTasks(semanticChains, parsedTasks) {
  const mappedChains = [];
  let taskIndex = 0; // Track position in parsedTasks array

  semanticChains.forEach((semanticChain, chainIdx) => {
    const chain = {
      id: semanticChain.id,
      name: semanticChain.name,
      purpose: semanticChain.purpose,
      tasks: [], // Will fill with task IDs
      outputs: semanticChain.outputs,
      inputs: semanticChain.inputs,
      temporal_marker: semanticChain.temporal_marker,
      parallel_with: semanticChain.parallel_with,
      metadata: semanticChain.metadata
    };

    // Tasks are in order - just take the next N tasks
    const numTasks = semanticChain.tasks.length;
    for (let i = 0; i < numTasks && taskIndex < parsedTasks.length; i++) {
      chain.tasks.push(parsedTasks[taskIndex].id);
      taskIndex++;
    }

    mappedChains.push(chain);
  });

  return mappedChains;
}

/**
 * Find best matching task for a semantic task description
 * @param {string} description - Semantic task description
 * @param {Object[]} parsedTasks - All parsed tasks
 * @param {string[]} alreadyAssigned - Task IDs already assigned to chains
 * @returns {Object|null} - Matched task or null
 */
function findBestTaskMatch(description, parsedTasks, alreadyAssigned) {
  const descLower = description.toLowerCase().trim();

  // Filter out already assigned tasks
  const availableTasks = parsedTasks.filter(t => !alreadyAssigned.includes(t.id));

  if (availableTasks.length === 0) return null;

  // Clean description for better matching (remove periods, extra spaces)
  const cleanDesc = descLower.replace(/\.$/, '').replace(/\s+/g, ' ').trim();

  // Try exact match first
  let bestMatch = availableTasks.find(t => {
    const taskName = t.name.toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
    return taskName === cleanDesc;
  });
  if (bestMatch) return bestMatch;

  // Try substring match (both directions) with minimum length threshold
  if (cleanDesc.length > 10) {
    bestMatch = availableTasks.find(t => {
      const taskName = t.name.toLowerCase();
      return taskName.includes(cleanDesc) || cleanDesc.includes(taskName);
    });
    if (bestMatch) return bestMatch;
  }

  // Try matching first few significant words
  const descWords = cleanDesc.split(' ').filter(w => w.length > 3).slice(0, 3);
  bestMatch = availableTasks.find(t => {
    const taskName = t.name.toLowerCase();
    return descWords.every(word => taskName.includes(word));
  });
  if (bestMatch) return bestMatch;

  // Try verb match with surrounding context
  bestMatch = availableTasks.find(t => {
    const verb = t.canonical_verb.replace(/_/g, ' ');
    const verbIndex = cleanDesc.indexOf(verb);
    if (verbIndex === -1) return false;

    // Check if surrounding words also match
    const taskName = t.name.toLowerCase();
    const surroundingWords = cleanDesc.substring(
      Math.max(0, verbIndex - 10),
      Math.min(cleanDesc.length, verbIndex + verb.length + 10)
    );
    return taskName.includes(surroundingWords.slice(0, 15));
  });
  if (bestMatch) return bestMatch;

  // If still no match, return null instead of first task
  // This prevents incorrect assignments
  console.warn(`No match found for semantic task: "${description}"`);
  return null;
}

/**
 * Renumber tasks to include chain context
 * @param {Object[]} tasks - Array of tasks
 * @param {Object[]} chains - Array of chains
 * @returns {Object[]} - Tasks with new IDs
 */
function renumberTasksWithChainContext(tasks, chains) {
  // Create a mapping from old task IDs to new chain-contextualized IDs
  const idMap = new Map();
  const renumberedTasks = [];

  // Build the id mapping
  chains.forEach((chain, chainIndex) => {
    chain.tasks.forEach((oldTaskId, stepIndex) => {
      const newTaskId = `chain_${chainIndex + 1}/step_${stepIndex + 1}`;
      idMap.set(oldTaskId, newTaskId);
    });
  });

  // Renumber all tasks
  tasks.forEach(task => {
    const newId = idMap.get(task.id);
    if (!newId) {
      // Task not in any chain - keep original ID
      renumberedTasks.push(task);
      return;
    }

    // Create new task with updated ID
    const updatedTask = {
      ...task,
      id: newId,
      edges: task.edges ? task.edges.map(edge => ({
        ...edge,
        from: idMap.get(edge.from) || edge.from,
        to: idMap.get(edge.to) || edge.to || newId
      })) : []
    };

    renumberedTasks.push(updatedTask);
  });

  // Update chain task references to use new IDs
  chains.forEach((chain, chainIndex) => {
    chain.tasks = chain.tasks.map((oldId, stepIndex) =>
      `chain_${chainIndex + 1}/step_${stepIndex + 1}`
    );
  });

  return renumberedTasks;
}

/**
 * Extract ingredient mentions from text
 * @param {string} text - Instruction text
 * @returns {string[]}
 */
function extractIngredients(text) {
  const ingredients = [];
  const normalized = text.toLowerCase();

  // Common ingredients to detect
  const COMMON_INGREDIENTS = [
    "onion", "garlic", "tomato", "potato", "carrot", "celery",
    "chicken", "beef", "pork", "fish", "salmon", "shrimp",
    "pasta", "rice", "noodles",
    "butter", "oil", "olive oil",
    "salt", "pepper", "herbs", "parsley", "basil", "thyme",
    "water", "stock", "broth", "wine",
    "cheese", "cream", "milk"
  ];

  for (const ingredient of COMMON_INGREDIENTS) {
    if (normalized.includes(ingredient)) {
      ingredients.push(ingredient);
    }
  }

  return ingredients;
}

/**
 * Extract equipment mentions from text
 * @param {string} text - Instruction text
 * @returns {string[]}
 */
function extractEquipment(text) {
  const equipment = [];
  const normalized = text.toLowerCase();

  const EQUIPMENT_KEYWORDS = [
    { name: "pan", patterns: [/\bpan\b/, /\bskillet\b/] },
    { name: "pot", patterns: [/\bpot\b/, /\bsaucepan\b/, /\bdutch oven\b/] },
    { name: "oven", patterns: [/\boven\b/] },
    { name: "grill", patterns: [/\bgrill\b/, /\bbarbecue\b/] },
    { name: "knife", patterns: [/\bknife\b/, /\bcutting board\b/] },
    { name: "bowl", patterns: [/\bbowl\b/] },
    { name: "whisk", patterns: [/\bwhisk\b/] },
    { name: "spoon", patterns: [/\bspoon\b/, /\bspatula\b/] }
  ];

  for (const item of EQUIPMENT_KEYWORDS) {
    for (const pattern of item.patterns) {
      if (pattern.test(normalized)) {
        equipment.push(item.name);
        break;
      }
    }
  }

  return equipment;
}

/**
 * Validate parsed meal object
 * @param {Object} meal - Parsed meal
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMeal(meal) {
  const errors = [];

  if (!meal.title) {
    errors.push("Meal must have a title");
  }

  if (!Array.isArray(meal.tasks)) {
    errors.push("Meal must have tasks array");
  } else {
    meal.tasks.forEach((task, index) => {
      if (!task.id) {
        errors.push(`Task ${index + 1} missing id`);
      }
      if (!task.name) {
        errors.push(`Task ${index + 1} missing name`);
      }
      if (!task.canonical_verb) {
        errors.push(`Task ${index + 1} missing canonical_verb`);
      }
      if (task.requires_driver === undefined) {
        errors.push(`Task ${index + 1} missing requires_driver`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  parseRecipe,
  validateMeal
};
