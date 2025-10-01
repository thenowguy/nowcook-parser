// src/ingestion/ontology_bridge.js
/* eslint-disable */
import {
  getVerbs,
  getIngredients,
  getVerbByCanonical,
  getIngredientByName,
} from "../ontology/loadOntology";

/**
 * The bridge provides a minimal, safe API over whatever shape your
 * ontology JSONs have today. It avoids hard failures if fields are missing.
 *
 * Expected-but-optional verb fields (each optional):
 *  - canonical: "slice"
 *  - synonyms: ["thinly slice", "slice into rounds"]
 *  - patterns: [ "^(?:thinly\\s+)?slice\\b", "cut into wedges" ]  // regex strings
 *  - applies_to: { include: ["tomato", "category:vegetable"], exclude: ["state:liquid"] }
 *  - parameters_schema: { thickness: {type:"enum", values:["thin","medium","thick"]}, shape:{...} }
 *
 * Expected-but-optional ingredient fields:
 *  - name: "tomato"
 *  - categories: ["vegetable","nightshade"]
 *  - states: ["whole","raw"]  // or any tag-style metadata you like
 *  - tags: ["category:vegetable","family:nightshade"] // free-form tags
 */

// ------------- Utilities -------------
const toArray = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);

const normalize = (s) => String(s || "").trim().toLowerCase();

// Build a light tag-set for an ingredient for fast rule checks
function tagsForIngredient(ing) {
  if (!ing) return new Set();
  const set = new Set();
  const name = normalize(ing.name);
  if (name) set.add(name);
  for (const t of toArray(ing.categories)) set.add(`category:${normalize(t)}`);
  for (const t of toArray(ing.families)) set.add(`family:${normalize(t)}`);
  for (const t of toArray(ing.states)) set.add(`state:${normalize(t)}`);
  for (const t of toArray(ing.tags)) set.add(normalize(t));
  return set;
}

// Does a single token match the ingredient's tag set?
// Tokens can be exact ingredient names ("tomato") or prefixed tags ("category:vegetable")
function tokenMatches(token, ingTags) {
  const t = normalize(token);
  if (!t) return false;
  if (ingTags.has(t)) return true;        // exact or pre-tagged match
  // allow bare category/family/state tokens without prefix if present as such
  if (t.includes(":")) return false;
  return ingTags.has(`category:${t}`) || ingTags.has(`family:${t}`) || ingTags.has(`state:${t}`);
}

// Rule check: applies_to { include: [...], exclude: [...] }
// If no applies_to is provided, default to TRUE (verb is broadly applicable).
function rulesAllowIngredient(applies_to, ingredient) {
  if (!ingredient) return false;
  const tags = tagsForIngredient(ingredient);

  const include = toArray(applies_to?.include);
  const exclude = toArray(applies_to?.exclude);

  // If nothing specified → allow
  if (include.length === 0 && exclude.length === 0) return true;

  // Exclusion is hard block
  if (exclude.some(tok => tokenMatches(tok, tags))) return false;

  // If includes exist, require at least one match
  if (include.length > 0) return include.some(tok => tokenMatches(tok, tags));

  // If only excludes were given and none matched, allow
  return true;
}

// Build RegExp objects for verb matching from patterns and synonyms
function patternsForVerb(verb) {
  const pats = [];
  // Prefer provided regex patterns as-is
  for (const p of toArray(verb?.patterns)) {
    try { pats.push(new RegExp(p, "i")); } catch { /* ignore bad regex */ }
  }
  // Backfill with simple regexes for synonyms/canonical phrases
  const lex = new Set([
    verb?.canonical,
    ...toArray(verb?.synonyms),
  ].map(normalize).filter(Boolean));

  for (const phrase of lex) {
    // escape regex special chars in phrases
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // verb-style word boundary match
    pats.push(new RegExp(`\\b${escaped}\\b`, "i"));
  }
  return pats;
}

// ------------- Public API -------------

export function listAllVerbs() {
  return getVerbs();
}

export function listAllIngredients() {
  return getIngredients();
}

/**
 * Return verbs applicable to a given ingredient (by name or object).
 * If ingredient is unknown, returns verbs that do NOT explicitly exclude typical “liquid/state:liquid” etc.
 * (i.e., broadly applicable verbs pass-through).
 */
export function getApplicableVerbs(ingredientLike) {
  const ing = typeof ingredientLike === "string"
    ? (getIngredientByName(ingredientLike) || { name: ingredientLike })
    : (ingredientLike || null);

  const verbs = getVerbs();
  return verbs.filter(v => rulesAllowIngredient(v?.applies_to, ing));
}

/**
 * Check whether a canonical verb applies to an ingredient.
 */
export function isVerbApplicableToIngredient(canonicalVerb, ingredientLike) {
  const verb = getVerbByCanonical(canonicalVerb);
  if (!verb) return false;
  const ing = typeof ingredientLike === "string"
    ? (getIngredientByName(ingredientLike) || { name: ingredientLike })
    : (ingredientLike || null);
  return rulesAllowIngredient(verb?.applies_to, ing);
}

/**
 * Try to identify the canonical verb for a free-text instruction line
 * using ontology patterns/synonyms first. Returns { verb, match } or null.
 */
export function findVerbFromOntology(line) {
  const s = String(line || "");
  if (!s) return null;
  for (const verb of getVerbs()) {
    const pats = patternsForVerb(verb);
    for (const re of pats) {
      const m = re.exec(s);
      if (m) return { verb, match: m[0] };
    }
  }
  return null;
}

/**
 * Lightweight ingredient detector for a line, based on ontology names.
 * Returns first matching ingredient object or null.
 */
export function findIngredientInLine(line) {
  const s = ` ${String(line || "").toLowerCase()} `;
  for (const ing of getIngredients()) {
    const name = normalize(ing?.name);
    if (!name) continue;
    // crude but effective: word-boundary-ish contains
    if (s.includes(` ${name} `)) return ing;
  }
  return null;
}

/**
 * Given an instruction line, suggest (verb, ingredient) pairs that are *likely* valid.
 * This is a convenience for authoring/ingestion experiments.
 */
export function suggestVerbIngredientPairs(line) {
  const v = findVerbFromOntology(line)?.verb || null;
  const i = findIngredientInLine(line);
  if (v && i && rulesAllowIngredient(v?.applies_to, i)) return [{ verb: v, ingredient: i, confidence: 0.9 }];
  if (v && i) return [{ verb: v, ingredient: i, confidence: 0.6 }];
  if (v) return [{ verb: v, ingredient: null, confidence: 0.5 }];
  if (i) {
    // propose top verbs for that ingredient
    const verbs = getApplicableVerbs(i).slice(0, 5).map(verb => ({ verb, ingredient: i, confidence: 0.4 }));
    return verbs.length ? verbs : [];
  }
  return [];
}