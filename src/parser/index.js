/**
 * Main Recipe Parser
 * Combines all parser modules to convert raw recipe text into structured meal JSON
 * This replaces Google Sheets + Apps Script parsing
 */

import { splitIntoSteps, cleanInstructionText, normalizeText } from "./splitter.js";
import { extractDuration, extractTemperature } from "./extractors.js";
import { findCanonicalVerb, getDefaultDuration, getAttentionMode } from "./verbMatcher.js";
import { inferDependencies, inferSequentialDependencies } from "./dependencies.js";
import { detectChains } from "./chains.js";
import { generateEmergentIds, matchEmergentInputs } from "./emergentIngredients.js";

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
    detectTaskChains = true // NEW: Enable chain detection
  } = options;

  if (!rawText || !rawText.trim()) {
    return {
      title,
      author: { name: "Draft" },
      tasks: [],
      packs_meta: {}
    };
  }

  // Step 1: Normalize and split into steps
  const normalized = normalizeText(rawText);
  const stepTexts = splitIntoSteps(normalized);

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
    chains = detectChains(finalTasks, rawText);

    // Step 6b: Renumber tasks to show chain context
    if (chains.length > 0) {
      finalTasks = renumberTasksWithChainContext(finalTasks, chains);
    }
  }

  // Step 7: Build meal object
  const meal = {
    title,
    author: { name: "Local Parser v2.0" },
    tasks: finalTasks,
    chains: chains.length > 0 ? chains : undefined, // Only include if chains detected
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
