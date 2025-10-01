// src/ingestion/ontology_bridge.js
/* eslint-disable */
/*
  Ontology bridge — Phase 0 wiring.
  - Loads verbs/ingredients via src/ontology/loadOntology.js
  - Provides a couple of tiny helpers the parser can call safely.
*/

import {
  getVerbs,
  getIngredients,
  getVerbByCanonical,
  getIngredientByName,
} from "../ontology/loadOntology.js"; // <-- NOTE the .. (up one level) and .js

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns the canonical verb if `text` is exactly a canon or synonym; else null.
export function normalizeVerb(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return null;

  const verbs = getVerbs();
  // exact canonical
  const exact = verbs.find(
    (v) => String(v?.canonical || "").toLowerCase() === t
  );
  if (exact) return exact.canonical;

  // exact synonym
  for (const v of verbs) {
    const syns = Array.isArray(v.synonyms) ? v.synonyms : [];
    if (syns.some((s) => String(s).toLowerCase() === t)) return v.canonical;
  }
  return null;
}

// Very soft guesser: scans a line for any canonical/synonym word boundary match.
export function suggestVerbForLine(line) {
  const s = String(line || "").toLowerCase();
  if (!s) return null;

  const verbs = getVerbs();
  for (const v of verbs) {
    const cand = [v.canonical, ...(Array.isArray(v.synonyms) ? v.synonyms : [])];
    for (const w of cand) {
      const re = new RegExp(`\\b${escapeRegExp(String(w).toLowerCase())}\\b`, "i");
      if (re.test(s)) return v.canonical;
    }
  }
  return null;
}

// Quick presence check so callers can feature-detect.
export function ontologyPresent() {
  const list = getVerbs();
  return Array.isArray(list) && list.length > 0;
}

export { getVerbs, getIngredients, getVerbByCanonical, getIngredientByName };