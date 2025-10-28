/**
 * Parser: Duration Extractor
 * Extracts time durations from instruction text
 * Ported from Google Apps Script extractDurationMin_()
 */

const DURATION_PRESETS = [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60, 90, 120, 180];
const APPROX_MARKERS = /\b(?:~|about|approx\.?|approximately|around)\b/i;

/**
 * Extract duration from text
 * @param {string} text - Instruction text
 * @param {boolean} roundAboutUp - Whether to round approximate durations up to next preset
 * @returns {{ value: number|null, approx: boolean, source: string|null }}
 */
export function extractDuration(text, roundAboutUp = true) {
  if (!text) return { value: null, approx: false, source: null };

  const normalized = text.toLowerCase().replace(/[–—]/g, "-");
  const hasApproxMarker = APPROX_MARKERS.test(normalized);

  // Try to find "— XX min" at end of line
  const suffixMatch = text.match(/—\s*(\d{1,3})\s*(?:min|minutes?)\s*$/i);
  if (suffixMatch) {
    const val = parseInt(suffixMatch[1], 10);
    return {
      value: clamp(val, 1, 24 * 60),
      approx: false,
      source: "suffix"
    };
  }

  // Look for range: "15-20 minutes" or "about 10-15 min"
  const rangeMatch = normalized.match(/(?:~|about|approx\.?|around)?\s*(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*(?:min|minutes?|hrs?|hours?)\b/i);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10);
    const hi = parseInt(rangeMatch[2], 10);
    
    // Check if it's hours
    if (/hrs?|hours?/i.test(rangeMatch[0])) {
      const hiMin = hi * 60;
      return {
        value: clamp(hiMin, 1, 24 * 60),
        approx: true,
        source: "range_hours"
      };
    }

    // Use high end of range
    const val = roundAboutUp ? roundUpToPreset(hi) : hi;
    return {
      value: clamp(val, 1, 24 * 60),
      approx: true,
      source: "range"
    };
  }

  // Look for single value with "about/approx"
  const singleMatch = normalized.match(/(?:~|about|approx\.?|around)?\s*(\d{1,3})\s*(?:min|minutes?)\b/);
  if (singleMatch) {
    let val = parseInt(singleMatch[1], 10);
    if (hasApproxMarker && roundAboutUp) {
      val = roundUpToPreset(val);
    }
    return {
      value: clamp(val, 1, 24 * 60),
      approx: hasApproxMarker,
      source: "single"
    };
  }

  // Look for hours
  const hoursMatch = normalized.match(/(\d{1,2}(?:\.\d+)?)\s*(?:hrs?|hours?)\b/);
  if (hoursMatch) {
    const hours = parseFloat(hoursMatch[1]);
    const minutes = Math.round(hours * 60);
    return {
      value: clamp(minutes, 1, 24 * 60),
      approx: hasApproxMarker,
      source: "hours"
    };
  }

  // Look for "X hours Y minutes"
  const combinedMatch = normalized.match(/(\d{1,2})\s*(?:hrs?|hours?)\s*(?:and\s+)?(\d{1,2})\s*(?:min|minutes?)\b/);
  if (combinedMatch) {
    const hours = parseInt(combinedMatch[1], 10);
    const mins = parseInt(combinedMatch[2], 10);
    const total = hours * 60 + mins;
    return {
      value: clamp(total, 1, 24 * 60),
      approx: hasApproxMarker,
      source: "combined"
    };
  }

  return { value: null, approx: false, source: null };
}

/**
 * Extract temperature from text
 * @param {string} text - Instruction text
 * @returns {{ value: number|null, unit: 'F'|'C'|null }}
 */
export function extractTemperature(text) {
  if (!text) return { value: null, unit: null };

  // Look for temperature with F/C/° markers
  const tempMatch = text.match(/(\d{2,3})\s*°?\s*([FC])\b/i);
  if (tempMatch) {
    const val = parseInt(tempMatch[1], 10);
    const unit = tempMatch[2].toUpperCase();
    return { value: val, unit };
  }

  // Look for just number with degree symbol near "oven" or "heat"
  const contextMatch = text.match(/(?:oven|heat|temp|temperature).*?(\d{2,3})\s*°/i);
  if (contextMatch) {
    const val = parseInt(contextMatch[1], 10);
    // Guess unit based on range
    const unit = val > 100 ? "F" : "C";
    return { value: val, unit };
  }

  return { value: null, unit: null };
}

/**
 * Round up to next preset duration
 * @param {number} min - Duration in minutes
 * @returns {number} - Rounded duration
 */
function roundUpToPreset(min) {
  for (const preset of DURATION_PRESETS) {
    if (min <= preset) return preset;
  }
  return min;
}

/**
 * Clamp value between min and max
 * @param {number} n - Value
 * @param {number} lo - Minimum
 * @param {number} hi - Maximum
 * @returns {number} - Clamped value
 */
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Extract ingredients with quantities from recipe text
 * Looks for "Ingredients:" section and parses each line
 * @param {string} text - Full recipe text
 * @returns {Array<{name: string, quantity: string, unit: string}>}
 */
export function extractIngredientsList(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const ingredients = [];
  let inIngredientsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Start of ingredients section
    if (/^Ingredients:?$/i.test(trimmed)) {
      inIngredientsSection = true;
      continue;
    }

    // End of ingredients section (when we hit Instructions or empty line followed by paragraph)
    if (inIngredientsSection && (/^Instructions:?$/i.test(trimmed) || /^Method:?$/i.test(trimmed))) {
      break;
    }

    // Parse ingredient line (starts with - or •)
    if (inIngredientsSection && /^[-•]\s+/.test(trimmed)) {
      const ingredientText = trimmed.replace(/^[-•]\s+/, '');
      const parsed = parseIngredientLine(ingredientText);
      if (parsed) {
        ingredients.push(parsed);
      }
    }
  }

  return ingredients;
}

/**
 * Parse a single ingredient line
 * Examples:
 *   "1 1/2 tbsp olive oil" → {quantity: "1 1/2", unit: "tbsp", name: "olive oil"}
 *   "2 garlic cloves, minced" → {quantity: "2", unit: "cloves", name: "garlic"}
 *   "1 lb / 500g beef mince (ground beef)" → {quantity: "1 lb / 500g", unit: "", name: "beef mince"}
 * @param {string} line - Ingredient line text
 * @returns {{name: string, quantity: string, unit: string}|null}
 */
function parseIngredientLine(line) {
  if (!line) return null;

  // Pattern: quantity (fractions, decimals, ranges) + optional unit + ingredient name
  // Matches: "1 1/2 tbsp", "2", "1 lb / 500g", "1/2 cup"
  const pattern = /^([\d\s\/\.]+(?:\s*(?:lb|oz|g|kg|ml|cup|tbsp|tsp|cloves?|sprigs?|cans?|slices?|pieces?))?(?:\s*\/\s*[\d\s]+[a-z]+)?)\s+(.+)$/i;

  const match = line.match(pattern);
  if (!match) {
    // No quantity found, treat whole line as ingredient name
    return {
      name: line.split(',')[0].trim(), // Take part before comma if present
      quantity: '',
      unit: ''
    };
  }

  const quantityPart = match[1].trim();
  const namePart = match[2].trim();

  // Extract unit from quantity part
  const unitMatch = quantityPart.match(/\b(lb|oz|g|kg|ml|cup|cups|tbsp|tsp|cloves?|sprigs?|cans?|slices?|pieces?)\b/i);
  const unit = unitMatch ? unitMatch[1] : '';

  // Remove unit from quantity to get just the number
  const quantity = unit ? quantityPart.replace(new RegExp(`\\b${unit}\\b`, 'i'), '').trim() : quantityPart;

  // Clean up name (remove prep instructions in parentheses or after comma)
  const name = namePart.split(',')[0].split('(')[0].trim();

  return {
    name,
    quantity,
    unit
  };
}
