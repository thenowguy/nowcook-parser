/**
 * Emergent Ingredient Loader and Lookup
 *
 * Emergent ingredients are outputs of cooking tasks (e.g., "drained pasta", "grated cheese").
 * This module provides lookup functions to get hold window data for emergent ingredients.
 */

import emergentIngredientsData from './emergent-ingredients.json';

/**
 * Get hold window data for an emergent ingredient
 * @param {string} ingredientKey - The emergent ingredient key (e.g., "drained_pasta", "grated_cheese")
 * @returns {Object|null} - Emergent ingredient data or null if not found
 */
export function getEmergentIngredient(ingredientKey) {
  if (!ingredientKey) return null;

  // Normalize the key (lowercase, underscores)
  const normalizedKey = ingredientKey.toLowerCase().replace(/\s+/g, '_');

  return emergentIngredientsData.emergent_ingredients[normalizedKey] || null;
}

/**
 * Infer emergent ingredient key from source ingredient and verb
 * @param {string} sourceIngredient - The base ingredient (e.g., "pasta", "cheese", "onion")
 * @param {string} verb - The canonical verb (e.g., "drain", "grate", "chop")
 * @returns {string|null} - Emergent ingredient key or null
 */
export function inferEmergentKey(sourceIngredient, verb) {
  if (!sourceIngredient || !verb) return null;

  // Normalize inputs
  const normalizedIngredient = sourceIngredient.toLowerCase().replace(/\s+/g, '_');
  const normalizedVerb = verb.toLowerCase().replace(/\s+/g, '_');

  // Map verbs to their past participle forms (for emergent ingredient naming)
  const verbToPastParticiple = {
    'drain': 'drained',
    'grate': 'grated',
    'shred': 'shredded',
    'chop': 'chopped',
    'dice': 'diced',
    'mince': 'minced',
    'slice': 'sliced',
    'smash': 'smashed',
    'caramelize': 'caramelized',
    'sauté': 'sauteed',
    'saute': 'sauteed',
    'toast': 'toasted',
    'melt': 'melted',
    'whisk': 'whisked',
    'beat': 'beaten',
    'mix': 'mixed',
    'cook': 'cooked',
    'boil': 'boiled',
    'bring_to_boil': 'boiled'
  };

  // Get past participle form if available
  const pastParticiple = verbToPastParticiple[normalizedVerb] || normalizedVerb;

  // Common patterns for emergent ingredient keys
  const possibleKeys = [
    `${pastParticiple}_${normalizedIngredient}`,  // "drained_pasta", "grated_cheese"
    `${normalizedVerb}_${normalizedIngredient}`,  // Try base verb too
    `${normalizedIngredient}_${pastParticiple}`,  // Less common pattern
  ];

  // Try to find a match
  for (const key of possibleKeys) {
    const found = getEmergentIngredient(key);
    if (found) return key;
  }

  return null;
}

/**
 * Get hold window in minutes for an emergent ingredient
 * Falls back to verb hold window if emergent ingredient not found
 * @param {string} emergentKey - The emergent ingredient key
 * @param {number} verbHoldWindow - Fallback hold window from verb (minutes)
 * @returns {number} - Hold window in minutes
 */
export function getHoldWindow(emergentKey, verbHoldWindow = 60) {
  const emergent = getEmergentIngredient(emergentKey);

  if (emergent && emergent.hold_window_minutes !== undefined) {
    return emergent.hold_window_minutes;
  }

  // Fallback to verb hold window
  return verbHoldWindow;
}

/**
 * Get temporal flexibility classification for an emergent ingredient
 * @param {string} emergentKey - The emergent ingredient key
 * @param {string} verbFlexibility - Fallback flexibility from verb
 * @returns {string} - Temporal flexibility classification
 */
export function getTemporalFlexibility(emergentKey, verbFlexibility = 'hold_hours') {
  const emergent = getEmergentIngredient(emergentKey);

  if (emergent && emergent.temporal_flexibility) {
    return emergent.temporal_flexibility;
  }

  // Fallback to verb flexibility
  return verbFlexibility;
}

/**
 * Get all emergent ingredients as array
 * @returns {Array} - Array of emergent ingredient objects with keys
 */
export function getAllEmergentIngredients() {
  const ingredients = emergentIngredientsData.emergent_ingredients;

  return Object.keys(ingredients).map(key => ({
    key,
    ...ingredients[key]
  }));
}

/**
 * Check if an emergent ingredient exists in the ontology
 * @param {string} ingredientKey - The emergent ingredient key
 * @returns {boolean}
 */
export function hasEmergentIngredient(ingredientKey) {
  return getEmergentIngredient(ingredientKey) !== null;
}
