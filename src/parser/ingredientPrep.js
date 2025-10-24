/**
 * Parser: Ingredient Prep Extractor
 * Detects prep verbs embedded in ingredient lists and converts them to explicit tasks
 *
 * Example:
 *   "4 cloves garlic, smashed and divided"
 *   → Ingredient: "4 cloves garlic"
 *   → Task: "Smash and divide the garlic (4 cloves)" - 2min, hold_days
 */

/**
 * Prep verbs commonly embedded in ingredient lists
 */
const PREP_VERBS = {
  // Cutting/chopping
  'chopped': { canon: 'chop', base_min_per_unit: 0.5 },
  'diced': { canon: 'dice', base_min_per_unit: 0.5 },
  'sliced': { canon: 'slice', base_min_per_unit: 0.3 },
  'minced': { canon: 'mince', base_min_per_unit: 0.7 },
  'julienned': { canon: 'julienne', base_min_per_unit: 1.0 },

  // Grating/shredding
  'grated': { canon: 'grate', base_min_per_unit: 0.8 },
  'shredded': { canon: 'grate', base_min_per_unit: 0.8 },
  'zested': { canon: 'zest', base_min_per_unit: 2.0 },

  // Crushing/smashing
  'smashed': { canon: 'smash', base_min_per_unit: 0.3 },
  'crushed': { canon: 'crush', base_min_per_unit: 0.5 },

  // Peeling
  'peeled': { canon: 'peel', base_min_per_unit: 0.5 },

  // Dividing/separating
  'divided': { canon: 'divide', base_min_per_unit: 0.2 },
  'separated': { canon: 'separate', base_min_per_unit: 0.3 },

  // Measuring/portioning
  'measured': { canon: 'measure', base_min_per_unit: 0.1 },
  'cubed': { canon: 'dice', base_min_per_unit: 0.6 }
};

/**
 * Extract prep tasks embedded in ingredient lists
 * @param {string} text - Raw recipe text
 * @returns {Object} - { ingredients: [], prepTasks: [] }
 */
export function extractIngredientPrep(text) {
  if (!text) return { ingredients: [], prepTasks: [] };

  const lines = text.split('\n');
  const ingredients = [];
  const prepTasks = [];

  let inIngredientSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect start of ingredient section
    if (/^ingredients?$/i.test(line)) {
      inIngredientSection = true;
      continue;
    }

    // Detect end of ingredient section (directions, instructions, etc.)
    if (/^(?:directions?|instructions?|method|steps?)$/i.test(line)) {
      inIngredientSection = false;
      continue;
    }

    // Skip empty lines and section headers
    if (!line || /^[A-Z\s]+:?$/.test(line)) continue;

    // If we're in ingredient section, parse the line
    if (inIngredientSection) {
      const result = parseIngredientLine(line);
      if (result) {
        ingredients.push(result.ingredient);
        if (result.prepTasks.length > 0) {
          prepTasks.push(...result.prepTasks);
        }
      }
    }
  }

  return { ingredients, prepTasks };
}

/**
 * Parse a single ingredient line and extract embedded prep verbs
 * @param {string} line - Single ingredient line
 * @returns {Object|null} - { ingredient, prepTasks[] } or null
 */
function parseIngredientLine(line) {
  if (!line) return null;

  // Pattern: [quantity] [unit] [ingredient], [prep_verb(s)] [modifiers]
  // OR: [quantity] [unit] [prep_verb] [ingredient]
  // Examples:
  //   "4 cloves garlic, smashed and divided"
  //   "5 1/2 cups shredded sharp white Cheddar"
  //   "1 medium onion, diced"
  //   "2 tablespoons butter, divided"

  const prepTasks = [];
  let cleanIngredient = line;

  // CASE 1: Check if line contains prep verbs BEFORE ingredient name
  // Pattern: "[quantity] [unit] [prep_verb] [ingredient]"
  const foundPrepsInline = [];
  Object.keys(PREP_VERBS).forEach(verbForm => {
    const regex = new RegExp(`\\b${verbForm}\\b`, 'i');
    if (regex.test(line) && !line.includes(',')) {
      // Found prep verb without comma - likely inline
      foundPrepsInline.push(verbForm);
    }
  });

  if (foundPrepsInline.length > 0) {
    // Extract quantity and ingredient, removing prep verbs
    let cleanLine = line;
    foundPrepsInline.forEach(verbForm => {
      cleanLine = cleanLine.replace(new RegExp(`\\b${verbForm}\\b`, 'gi'), '').trim();
    });

    const quantityMatch = cleanLine.match(/^([\d\s\/½⅓⅔¼¾⅛⅜⅝⅞]+)\s*(?:cups?|tablespoons?|teaspoons?|tbsp|tsp|oz|ounces?|pounds?|lbs?|grams?|g|kg|cloves?|whole|medium|large|small|slices?)?\s+(.+)$/i);

    let quantity = null;
    let ingredientName = cleanLine;

    if (quantityMatch) {
      quantity = parseQuantity(quantityMatch[1]);
      ingredientName = quantityMatch[2] || cleanLine;
    }

    // Create prep tasks
    foundPrepsInline.forEach(verbForm => {
      const prepInfo = PREP_VERBS[verbForm];
      const duration = estimatePrepDuration(prepInfo, quantity, ingredientName);

      let taskDesc = `${capitalizeFirst(prepInfo.canon)} the ${ingredientName}`;
      if (quantity && quantityMatch) {
        taskDesc += ` (${quantityMatch[1].trim()} ${line.match(/cups?|tablespoons?|teaspoons?|cloves?|whole|medium|large|slices?/i)?.[0] || ''})`.trim();
      }

      prepTasks.push({
        description: taskDesc,
        canonical_verb: prepInfo.canon,
        estimated_min: duration,
        ingredient: ingredientName,
        quantity: quantity,
        source_line: line
      });
    });

    cleanIngredient = cleanLine;

    return { ingredient: cleanIngredient, prepTasks };
  }

  // CASE 2: Check if line contains prep verbs after comma
  const commaParts = line.split(',').map(s => s.trim());

  if (commaParts.length > 1) {
    const baseIngredient = commaParts[0];
    const modifiers = commaParts.slice(1).join(', ');

    // Look for prep verbs in modifiers
    const foundPreps = [];

    Object.keys(PREP_VERBS).forEach(verbForm => {
      // Match whole word only (avoid partial matches)
      const regex = new RegExp(`\\b${verbForm}\\b`, 'i');
      if (regex.test(modifiers)) {
        foundPreps.push(verbForm);
      }
    });

    if (foundPreps.length > 0) {
      // Extract quantity and ingredient name
      const quantityMatch = baseIngredient.match(/^([\d\s\/½⅓⅔¼¾⅛⅜⅝⅞]+)\s*(?:cups?|tablespoons?|teaspoons?|tbsp|tsp|oz|ounces?|pounds?|lbs?|grams?|g|kg|cloves?|whole|medium|large|small)?\s+(.+)$/i);

      let quantity = null;
      let ingredientName = baseIngredient;

      if (quantityMatch) {
        quantity = parseQuantity(quantityMatch[1]);
        ingredientName = quantityMatch[2] || baseIngredient;
      }

      // Create prep tasks for each verb found
      foundPreps.forEach(verbForm => {
        const prepInfo = PREP_VERBS[verbForm];
        const duration = estimatePrepDuration(prepInfo, quantity, ingredientName);

        // Build task description
        let taskDesc = `${capitalizeFirst(prepInfo.canon)} the ${ingredientName}`;
        if (quantity) {
          taskDesc += ` (${quantityMatch[1].trim()} ${quantityMatch[0].match(/cups?|tablespoons?|teaspoons?|cloves?|whole|medium|large/i)?.[0] || ''})`.trim();
        }

        prepTasks.push({
          description: taskDesc,
          canonical_verb: prepInfo.canon,
          estimated_min: duration,
          ingredient: ingredientName,
          quantity: quantity,
          source_line: line
        });
      });

      // Clean ingredient is the base without modifiers
      cleanIngredient = baseIngredient;
    }
  }

  return {
    ingredient: cleanIngredient,
    prepTasks
  };
}

/**
 * Parse quantity string to numeric value
 * Handles fractions, decimals, and ranges
 * @param {string} qtyStr - Quantity string (e.g., "5 1/2", "2-3", "1/4")
 * @returns {number} - Numeric quantity
 */
function parseQuantity(qtyStr) {
  if (!qtyStr) return 1;

  qtyStr = qtyStr.trim();

  // Handle fractions with unicode characters
  const unicodeFractions = {
    '½': 0.5, '⅓': 0.33, '⅔': 0.67, '¼': 0.25, '¾': 0.75,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
  };

  for (const [char, val] of Object.entries(unicodeFractions)) {
    if (qtyStr.includes(char)) {
      const wholeMatch = qtyStr.match(/(\d+)\s*[½⅓⅔¼¾⅛⅜⅝⅞]/);
      const whole = wholeMatch ? parseInt(wholeMatch[1]) : 0;
      return whole + val;
    }
  }

  // Handle ranges (take average)
  if (qtyStr.includes('-') || qtyStr.includes('to')) {
    const parts = qtyStr.split(/[-–—to]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (parts.length === 2) {
      return (parts[0] + parts[1]) / 2;
    }
  }

  // Handle mixed fractions (e.g., "5 1/2")
  const mixedMatch = qtyStr.match(/(\d+)\s+(\d+)\/(\d+)/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const numerator = parseInt(mixedMatch[2]);
    const denominator = parseInt(mixedMatch[3]);
    return whole + (numerator / denominator);
  }

  // Handle simple fractions (e.g., "1/4")
  const fracMatch = qtyStr.match(/(\d+)\/(\d+)/);
  if (fracMatch) {
    return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
  }

  // Handle simple decimal/integer
  const num = parseFloat(qtyStr);
  return isNaN(num) ? 1 : num;
}

/**
 * Estimate prep duration based on verb, quantity, and ingredient
 * @param {Object} prepInfo - { canon, base_min_per_unit }
 * @param {number} quantity - Numeric quantity
 * @param {string} ingredient - Ingredient name
 * @returns {number} - Estimated minutes
 */
function estimatePrepDuration(prepInfo, quantity, ingredient) {
  if (!quantity) quantity = 1;

  // Base duration from verb
  let duration = prepInfo.base_min_per_unit * quantity;

  // Adjust for specific ingredients
  const ingredientLower = ingredient.toLowerCase();

  // Harder to process ingredients take longer
  if (ingredientLower.includes('cheese')) {
    duration *= 1.5; // Grating cheese is tedious
  } else if (ingredientLower.includes('garlic')) {
    duration *= 0.8; // Garlic is small/quick
  } else if (ingredientLower.includes('onion')) {
    duration *= 1.2; // Onions make you cry = slower
  } else if (ingredientLower.includes('carrot') || ingredientLower.includes('potato')) {
    duration *= 1.3; // Hard vegetables
  }

  // Minimum 1 minute for any prep task
  duration = Math.max(1, duration);

  // Round to nearest 0.5 minutes
  duration = Math.round(duration * 2) / 2;

  // Cap at reasonable maximum (15 min for single ingredient)
  duration = Math.min(15, duration);

  return duration;
}

/**
 * Capitalize first letter of string
 * @param {string} str
 * @returns {string}
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert extracted prep tasks to chain format for semantic detection
 * @param {Object[]} prepTasks - Array of prep task objects
 * @returns {Object} - Chain object for "Prep Work"
 */
export function createPrepChain(prepTasks) {
  if (!prepTasks || prepTasks.length === 0) return null;

  return {
    id: 'chain_0_prep',
    name: 'Prep Work',
    purpose: 'Prepare ingredients before cooking',
    tasks: prepTasks.map(t => t.description),
    outputs: prepTasks.map((t, idx) => ({
      emergent_id: `e_prep_${idx + 1}`,
      ingredient: t.ingredient,
      state: 'prepared',
      description: `Prepared ${t.ingredient}`
    })),
    inputs: [],
    temporal_marker: null,
    parallel_with: null,
    metadata: {
      confidence: 'high',
      source: 'ingredient_list_extraction'
    }
  };
}
