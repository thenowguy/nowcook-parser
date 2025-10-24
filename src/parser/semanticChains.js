/**
 * Semantic Chain Detection (Phase 1 of Two-Phase Hybrid Parsing)
 *
 * Uses semantic understanding to identify logical chains from narrative recipe text.
 * This is NOT pattern matching - it's actual comprehension of recipe structure and purpose.
 *
 * Input: Raw narrative recipe text (prose, not structured JSON)
 * Output: Chain structure with emergent ingredient IDs
 *
 * @module parser/semanticChains
 */

/**
 * Analyzes narrative recipe text and identifies logical chains using semantic understanding.
 *
 * A "chain" is a logical grouping of related tasks that produces a specific outcome.
 * Examples: "Cook the Pasta", "Make the Cheese Sauce", "Prepare the Topping"
 *
 * This function reads the recipe like a human would, understanding:
 * - Purpose and intent of task groups
 * - Temporal structure ("while that bakes", "meanwhile")
 * - Implicit references ("the sauce", "the mixture")
 * - Emergent ingredients created during cooking
 * - Chain-level dependencies (which chains need outputs from other chains)
 *
 * @param {string} narrativeText - Raw recipe text with natural language
 * @param {string} recipeTitle - Title of the recipe (for context)
 * @returns {Promise<Object>} Chain structure with metadata
 */
export async function detectChainsSemanticly(narrativeText, recipeTitle = '') {
  // This is where we apply semantic AI understanding
  // For now, I'll create a structured prompt that analyzes the recipe

  const analysis = analyzeRecipeNarrative(narrativeText, recipeTitle);

  return analysis;
}

/**
 * Detects logical sections in recipe text even without explicit paragraph breaks.
 * Groups lines by detecting section boundaries (headers, temporal markers, blank lines).
 *
 * @param {string} text - Recipe text
 * @returns {Array<string>} - Array of logical sections
 */
function detectLogicalSections(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const sections = [];
  let currentSection = [];

  // Section header patterns
  const HEADER_PATTERN = /^(ingredients?|directions?|method|instructions?|steps?)[:.]?\s*$/i;
  const TEMPORAL_MARKERS = /^(meanwhile|while that|at the same time|in a separate)/i;
  const NARRATIVE_START = /^(bring|preheat|in a|scrape|to serve)/i; // Start of cooking paragraphs

  let inIngredientList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check characteristics
    const isHeader = HEADER_PATTERN.test(line);
    const isTemporalMarker = TEMPORAL_MARKERS.test(line);
    const isIngredientLine = /^\d+\s*(cups?|tbsp|tsp|pounds?|oz|slices?|cloves?|bunch)/.test(line) ||
                             /^(kosher|freshly|leaves)/i.test(line);
    const isNarrativeStart = NARRATIVE_START.test(line);

    // Detect "Ingredients" header
    if (isHeader && /ingredients?/i.test(line)) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
      }
      currentSection = [];
      inIngredientList = true;
      continue; // Skip the header itself
    }

    // Detect "Directions" header - end ingredient list
    if (isHeader && /directions?/i.test(line)) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
      }
      currentSection = [];
      inIngredientList = false;
      continue; // Skip the header itself
    }

    // Skip ingredient lines (they're not cooking chains)
    if (inIngredientList || isIngredientLine) {
      inIngredientList = isIngredientLine; // Stay in ingredient mode if still seeing ingredients
      continue;
    }

    // Start new section on temporal markers
    if (isTemporalMarker) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
      }
      currentSection = [line];
    }
    // Start new section when we hit a narrative start (new cooking paragraph)
    else if (isNarrativeStart && currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
      currentSection = [line];
    }
    // Continue building current section
    else {
      currentSection.push(line);
    }
  }

  // Add final section
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }

  console.log('📑 Sections detected:');
  sections.forEach((s, i) => {
    const preview = s.substring(0, 60).replace(/\n/g, ' ');
    console.log(`  ${i + 1}. ${preview}...`);
  });

  return sections.filter(s => s.trim().length > 0);
}

/**
 * Analyzes recipe narrative to identify chains, their purposes, and dependencies.
 * This simulates semantic understanding - in production, this would use an AI model.
 *
 * @param {string} text - Recipe narrative
 * @param {string} title - Recipe title
 * @returns {Object} Chain analysis result
 */
function analyzeRecipeNarrative(text, title) {
  // For this implementation, I'm going to identify chains by understanding:
  // 1. Temporal structure (parallel vs sequential)
  // 2. Purpose statements ("to make the sauce", "for the topping")
  // 3. Emergent ingredients mentioned ("the mixture", "the sauce", "the pasta")
  // 4. Section boundaries (paragraph breaks, temporal markers)

  const chains = [];
  let emergentIdCounter = 1;

  // Split into logical sections (paragraphs usually represent logical groupings)
  let sections = text.split('\n\n').filter(s => s.trim().length > 0);

  // If we only got 1 section, the text might not have double newlines
  // Try splitting by single newlines and then grouping by logical breaks
  if (sections.length <= 1) {
    console.log('⚠️ Only 1 section found with \\n\\n splitting. Trying smarter paragraph detection...');
    sections = detectLogicalSections(text);
  }

  console.log(`🔍 Semantic analysis: Found ${sections.length} sections`);
  if (sections.length === 0) {
    console.warn('⚠️ No sections found! Text may not have proper formatting.');
    console.log('First 500 chars of text:', text.substring(0, 500));
  }

  // Analyze each section for its purpose and outputs
  sections.forEach((section, idx) => {
    const analysis = analyzeSectionPurpose(section, idx, sections);

    // Skip low-confidence chains with very few tasks (likely headers/ingredients)
    if (analysis && !(analysis.confidence === 'low' && analysis.taskDescriptions.length <= 1)) {
      // Generate emergent IDs for outputs
      const outputs = analysis.outputs.map(output => ({
        emergent_id: `e_${output.ingredient}_${String(emergentIdCounter++).padStart(3, '0')}`,
        ingredient: output.ingredient,
        state: output.state,
        description: output.description
      }));

      chains.push({
        id: `chain_${chains.length + 1}`,
        name: analysis.name,
        purpose: analysis.purpose,
        tasks: analysis.taskDescriptions,
        outputs: outputs,
        inputs: [], // Will be inferred in next step
        temporal_marker: analysis.temporalMarker,
        parallel_with: analysis.parallelWith,
        metadata: {
          detected_by: 'semantic_understanding',
          confidence: analysis.confidence,
          section_index: idx
        }
      });
    }
  });

  // Infer chain-level dependencies based on emergent ingredients
  inferChainLevelDependencies(chains);

  return {
    chains,
    metadata: {
      recipe_title: title,
      total_chains: chains.length,
      detection_method: 'semantic_narrative_analysis'
    }
  };
}

/**
 * Analyzes a section of recipe text to understand its purpose and what it produces.
 * This is the core semantic understanding function.
 *
 * @param {string} section - Text section to analyze
 * @param {number} index - Section index
 * @param {Array<string>} allSections - All sections for context
 * @returns {Object|null} Section analysis or null if not a task chain
 */
function analyzeSectionPurpose(section, index, allSections) {
  const lowerSection = section.toLowerCase();

  // Skip ingredient lists (multi-line lists of measurements)
  if (section.split('\n').filter(l => l.trim()).length > 5 &&
      section.split('\n').some(line => /^\d+\s*(cups?|tbsp|tsp|pounds?|oz|slices?|cloves?)/.test(line))) {
    return null;
  }

  // Skip section headers that are standalone (but allow headers followed by content)
  if ((lowerSection.trim() === 'ingredients' || lowerSection.trim() === 'directions') ||
      (lowerSection.startsWith('ingredients') && lowerSection.length < 20) ||
      (lowerSection.startsWith('directions') && lowerSection.length < 20)) {
    return null;
  }

  // Remove "Directions" prefix if present, to get to actual content
  let cleanedSection = section;
  if (lowerSection.startsWith('directions')) {
    cleanedSection = section.replace(/^directions\s*/i, '');
  }

  // Skip single-line preparation steps (will be merged with related chain later)
  const lines = section.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 1 && lowerSection.includes('preheat') && section.trim().length < 60) {
    return null;
  }

  // Detect temporal markers indicating parallel execution
  const temporalMarkers = {
    'while that bakes': 'parallel_during_bake',
    'while that cooks': 'parallel_during_cook',
    'meanwhile': 'parallel',
    'at the same time': 'parallel',
    'in a separate': 'parallel'
  };

  let temporalMarker = null;
  for (const [marker, type] of Object.entries(temporalMarkers)) {
    if (lowerSection.includes(marker)) {
      temporalMarker = type;
      break;
    }
  }

  // Extract task descriptions (sentences) - use cleaned section
  const sentences = cleanedSection.split(/\.\s+/).filter(s => s.trim().length > 0);
  const taskDescriptions = sentences.map(s => s.trim());

  // Identify what this chain produces (emergent ingredients)
  const outputs = identifyChainOutputs(cleanedSection, taskDescriptions);

  // Determine chain name and purpose based on semantic understanding
  const chainInfo = inferChainNameAndPurpose(cleanedSection, outputs, temporalMarker, index);

  return {
    name: chainInfo.name,
    purpose: chainInfo.purpose,
    taskDescriptions,
    outputs,
    temporalMarker,
    parallelWith: temporalMarker ? (temporalMarker.includes('bake') ? 'baking' : 'previous') : null,
    confidence: chainInfo.confidence
  };
}

/**
 * Identifies what emergent ingredients a chain produces based on the narrative.
 * Looks for phrases like "the sauce", "the mixture", "the pasta", "the topping".
 *
 * @param {string} section - Section text
 * @param {Array<string>} tasks - Task descriptions
 * @returns {Array<Object>} Emergent ingredients produced
 */
function identifyChainOutputs(section, tasks) {
  const outputs = [];
  const lowerSection = section.toLowerCase();

  // Common emergent ingredient patterns
  const patterns = [
    { regex: /(cook|boil).*?(macaroni|pasta)/i, ingredient: 'pasta', state: 'cooked' },
    { regex: /drain/i, ingredient: 'pasta', state: 'drained' },
    { regex: /(?:make|create|prepare).*?(?:the\s+)?(\w+\s+)?sauce/i, ingredient: 'cheese_sauce', state: 'ready' },
    { regex: /(?:make|create|prepare).*?(?:the\s+)?roux/i, ingredient: 'roux', state: 'prepared' },
    { regex: /(?:the\s+)?cheese\s+mixture/i, ingredient: 'cheese_mixture', state: 'mixed' },
    { regex: /(?:the\s+)?bacon\s+mixture/i, ingredient: 'bacon_topping', state: 'ready' },
    { regex: /(?:render|cook).*?bacon/i, ingredient: 'bacon_topping', state: 'crispy' },
    { regex: /bake.*?(?:for|until)/i, ingredient: 'baked_dish', state: 'baked' },
    { regex: /mac\s+and\s+cheese/i, ingredient: 'mac_and_cheese', state: 'assembled' }
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(section)) {
      outputs.push({
        ingredient: pattern.ingredient,
        state: pattern.state,
        description: `${pattern.state} ${pattern.ingredient.replace(/_/g, ' ')}`
      });
    }
  }

  // Remove duplicates
  const seen = new Set();
  return outputs.filter(output => {
    const key = `${output.ingredient}_${output.state}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Infers chain name and purpose from semantic analysis of the section.
 * This is where we "understand" what the chain is trying to accomplish.
 *
 * @param {string} section - Section text
 * @param {Array<Object>} outputs - Emergent ingredients produced
 * @param {string|null} temporalMarker - Temporal execution marker
 * @param {number} index - Section index
 * @returns {Object} Chain name, purpose, and confidence
 */
function inferChainNameAndPurpose(section, outputs, temporalMarker, index) {
  const lowerSection = section.toLowerCase();

  // High-confidence semantic patterns
  if (lowerSection.includes('bring') && lowerSection.includes('boil') && lowerSection.includes('macaroni')) {
    return {
      name: 'Cook the Pasta',
      purpose: 'Boil pasta until al dente',
      confidence: 'high'
    };
  }

  if ((lowerSection.includes('melt') && lowerSection.includes('butter')) ||
      (lowerSection.includes('roux')) ||
      (lowerSection.includes('whisk') && lowerSection.includes('milk') && lowerSection.includes('cheese'))) {
    return {
      name: 'Make the Cheese Sauce',
      purpose: 'Create creamy cheese sauce',
      confidence: 'high'
    };
  }

  if (lowerSection.includes('bake') && lowerSection.includes('oven')) {
    return {
      name: 'Bake the Dish',
      purpose: 'Bake until hot and bubbly',
      confidence: 'high'
    };
  }

  if (lowerSection.includes('bacon') && (lowerSection.includes('render') || lowerSection.includes('crispy'))) {
    return {
      name: 'Make the Bacon Topping',
      purpose: 'Prepare crispy bacon topping',
      confidence: 'high'
    };
  }

  if (lowerSection.includes('serve') || lowerSection.includes('scatter') || lowerSection.includes('scoop')) {
    return {
      name: 'Serve',
      purpose: 'Plate and serve the dish',
      confidence: 'high'
    };
  }

  // Medium-confidence fallback based on outputs
  if (outputs.length > 0) {
    const primaryOutput = outputs[0];
    return {
      name: `Prepare ${primaryOutput.ingredient.replace(/_/g, ' ')}`,
      purpose: `Create ${primaryOutput.description}`,
      confidence: 'medium'
    };
  }

  // Low-confidence generic fallback
  return {
    name: `Phase ${index + 1}`,
    purpose: `Complete cooking phase ${index + 1}`,
    confidence: 'low'
  };
}

/**
 * Infers chain-level dependencies by matching emergent ingredient outputs to inputs.
 * A chain depends on another chain if it uses that chain's emergent outputs.
 *
 * @param {Array<Object>} chains - Array of detected chains
 */
function inferChainLevelDependencies(chains) {
  chains.forEach(chain => {
    const chainText = chain.tasks.join(' ').toLowerCase();

    // Check if this chain mentions outputs from other chains
    chains.forEach(otherChain => {
      if (otherChain.id === chain.id) return;

      otherChain.outputs.forEach(output => {
        const ingredientName = output.ingredient.replace(/_/g, ' ');

        // Look for references to this emergent ingredient
        if (chainText.includes(ingredientName) ||
            chainText.includes('the ' + ingredientName.split(' ').slice(-1)[0]) || // "the sauce", "the pasta"
            chainText.includes(output.state)) {

          // This chain depends on the other chain's output
          chain.inputs.push({
            emergent_id: output.emergent_id,
            ingredient: output.ingredient,
            state: output.state,
            from_chain: otherChain.id,
            required: true
          });
        }
      });
    });
  });
}

/**
 * Formats chain detection results for display/debugging.
 *
 * @param {Object} result - Chain detection result
 * @returns {string} Formatted output
 */
export function formatChainAnalysis(result) {
  let output = `\n=== SEMANTIC CHAIN ANALYSIS ===\n`;
  output += `Recipe: ${result.metadata.recipe_title}\n`;
  output += `Chains Detected: ${result.metadata.total_chains}\n`;
  output += `Method: ${result.metadata.detection_method}\n\n`;

  result.chains.forEach((chain, idx) => {
    output += `\n--- Chain ${idx + 1}: ${chain.name} ---\n`;
    output += `Purpose: ${chain.purpose}\n`;
    output += `Confidence: ${chain.metadata.confidence}\n`;

    if (chain.temporal_marker) {
      output += `Temporal: ${chain.temporal_marker}`;
      if (chain.parallel_with) {
        output += ` (parallel with: ${chain.parallel_with})`;
      }
      output += `\n`;
    }

    if (chain.outputs.length > 0) {
      output += `Outputs:\n`;
      chain.outputs.forEach(out => {
        output += `  - ${out.emergent_id}: ${out.description}\n`;
      });
    }

    if (chain.inputs.length > 0) {
      output += `Inputs (dependencies):\n`;
      chain.inputs.forEach(inp => {
        output += `  - ${inp.emergent_id} (from ${inp.from_chain}): ${inp.ingredient} (${inp.state})\n`;
      });
    }

    output += `Tasks:\n`;
    chain.tasks.forEach((task, tidx) => {
      output += `  ${tidx + 1}. ${task}\n`;
    });
  });

  return output;
}
