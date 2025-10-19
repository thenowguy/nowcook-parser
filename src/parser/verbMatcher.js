/**
 * Parser: Verb Matcher
 * Matches instruction text to canonical verbs using patterns, redirects, and heuristics
 * Ported from Google Apps Script guessCanonicalVerbWithConfig_()
 */

// Load JSON files (browser-compatible ES6 imports)
import VERBS_DATA from '../ontology/verbs.json';
import PATTERNS_DATA from '../ontology/patterns.json';
import GUARDS_DATA from '../ontology/guards.json';

/**
 * Find canonical verb for instruction text
 * @param {string} text - Instruction text
 * @param {Object} options - Options for matching
 * @returns {{ verb: string, confidence: string, source: string, redirect: Object|null }}
 */
export function findCanonicalVerb(text, options = {}) {
  if (!text) return { verb: "free_text", confidence: "low", source: "default", redirect: null };

  const normalized = text.toLowerCase();

  // Step 1: Try pattern matching from patterns.json
  const patternMatch = matchAgainstPatterns(normalized);
  if (patternMatch) {
    return {
      verb: patternMatch.canonical_verb,
      confidence: patternMatch.confidence || "high",
      source: "pattern",
      redirect: null,
      parameters: patternMatch.parameters
    };
  }

  // Step 2: Try verb patterns from verbs.json
  const verbMatch = matchAgainstVerbPatterns(normalized);
  if (verbMatch) {
    // Check if there's a guard redirect
    const redirect = checkGuards(verbMatch.verb, text, options.ingredients);
    if (redirect) {
      return {
        verb: redirect.redirect_to || verbMatch.verb,
        confidence: "medium",
        source: "verb_pattern_redirected",
        redirect
      };
    }

    return {
      verb: verbMatch.verb,
      confidence: "high",
      source: "verb_pattern",
      redirect: null
    };
  }

  // Step 3: Heuristic rules (fallback)
  const heuristic = applyHeuristics(normalized);
  if (heuristic) {
    return {
      verb: heuristic,
      confidence: "medium",
      source: "heuristic",
      redirect: null
    };
  }

  // Step 4: Default to free_text
  return {
    verb: "free_text",
    confidence: "low",
    source: "default",
    redirect: null
  };
}

/**
 * Match text against patterns.json entries
 * @param {string} text - Normalized text
 * @returns {Object|null}
 */
function matchAgainstPatterns(text) {
  for (const entry of PATTERNS_DATA.patterns) {
    if (!entry.pattern || !entry.canonical_verb) continue;

    try {
      const regex = new RegExp(entry.pattern, "i");
      if (regex.test(text)) {
        return entry;
      }
    } catch (e) {
      console.warn(`Invalid pattern: ${entry.pattern}`, e);
    }
  }
  return null;
}

/**
 * Match text against verb patterns from verbs.json
 * @param {string} text - Normalized text
 * @returns {Object|null}
 */
function matchAgainstVerbPatterns(text) {
  for (const verbDef of VERBS_DATA.verbs) {
    if (!verbDef.patterns) continue;

    for (const pattern of verbDef.patterns) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(text)) {
          return { verb: verbDef.canon };
        }
      } catch (e) {
        console.warn(`Invalid pattern for ${verbDef.canon}: ${pattern}`, e);
      }
    }
  }
  return null;
}

/**
 * Apply heuristic rules for common verbs
 * @param {string} text - Normalized text
 * @returns {string|null}
 */
function applyHeuristics(text) {
  const HEURISTICS = [
    { re: /\b(?:heat|warm).*(?:oil|butter)/i, verb: "heat_oil" },
    { re: /\bsaut[eé]|brown.*onion|fry.*lightly/i, verb: "sauté" },
    { re: /\bstir\b/i, verb: "stir" },
    { re: /\badd\b/i, verb: "add" },
    { re: /\bboil\b/i, verb: "boil" },
    { re: /\bsimmer\b/i, verb: "simmer" },
    { re: /\bseason\b/i, verb: "season" },
    { re: /\bdrain\b/i, verb: "drain" },
    { re: /\bserve|plate\b/i, verb: "plate" },
    { re: /\bslice|chop|dice|mince\b/i, verb: "slice" },
    { re: /\bpreheat.*oven\b/i, verb: "preheat_oven" },
    { re: /\broast\b/i, verb: "roast" },
    { re: /\bbake\b/i, verb: "bake" }
  ];

  for (const rule of HEURISTICS) {
    if (rule.re.test(text)) {
      return rule.verb;
    }
  }

  return null;
}

/**
 * Check safety guards for verb/ingredient combinations
 * @param {string} verb - Canonical verb
 * @param {string} text - Instruction text
 * @param {string[]} ingredients - Detected ingredients
 * @returns {Object|null} - Guard redirect if applicable
 */
function checkGuards(verb, text, ingredients = []) {
  if (!ingredients || ingredients.length === 0) return null;

  for (const guard of GUARDS_DATA.guards) {
    // Check if verb matches
    const verbMatch = guard.trigger.verb === verb || 
                      (Array.isArray(guard.trigger.verb) && guard.trigger.verb.includes(verb));
    
    if (!verbMatch) continue;

    // Check if any ingredient matches
    const ingredientMatch = ingredients.some(ing => {
      if (typeof guard.trigger.ingredient === "string") {
        return ing.toLowerCase().includes(guard.trigger.ingredient.toLowerCase());
      }
      if (Array.isArray(guard.trigger.ingredient)) {
        return guard.trigger.ingredient.some(g => 
          ing.toLowerCase().includes(g.toLowerCase())
        );
      }
      return false;
    });

    if (ingredientMatch) {
      return guard;
    }
  }

  return null;
}

/**
 * Get verb definition from ontology
 * @param {string} canonicalVerb - Canonical verb name
 * @returns {Object|null}
 */
export function getVerbDefinition(canonicalVerb) {
  return VERBS_DATA.verbs.find(v => v.canon === canonicalVerb) || null;
}

/**
 * Get default duration for verb
 * @param {string} canonicalVerb - Canonical verb name
 * @returns {number|null}
 */
export function getDefaultDuration(canonicalVerb) {
  const verbDef = getVerbDefinition(canonicalVerb);
  return verbDef?.defaults?.planned_min ?? null;
}

/**
 * Get attention mode for verb
 * @param {string} canonicalVerb - Canonical verb name
 * @returns {string} - "attended" or "unattended_after_start" or "unattended"
 */
export function getAttentionMode(canonicalVerb) {
  const verbDef = getVerbDefinition(canonicalVerb);
  return verbDef?.attention ?? "attended";
}
