/* ontology_bridge.js — v1.0.1 (safe, optional)
   - Loads ontology (verbs/ingredients) if present.
   - Exposes no-throw helpers: mapVerb, mapIngredient.
   - If ontology missing, returns identity values.
*/
/* eslint-disable */

import { loadOntology } from "./ontology/loadOntology.js";

let ONTOLOGY_ENABLED = true; // flip to false to hard-disable without removing code
let _ont = {
  verbs: new Map(),         // canonicalVerb -> { label, params?, synonyms[] }
  ingredients: new Map(),   // canonicalIngredient -> { label, synonyms[] }
  synonymsToVerb: new Map(),       // lc synonym -> canonicalVerb
  synonymsToIngredient: new Map(), // lc synonym -> canonicalIngredient
  loaded: false,
  error: null,
};

async function ensureLoaded() {
  if (!ONTOLOGY_ENABLED || _ont.loaded || _ont.error) return;
  try {
    const o = await loadOntology();
    _ont = { ...o, loaded: true, error: null };
  } catch (err) {
    // Don’t crash the app; just mark unavailable
    _ont.error = err;
    _ont.loaded = false;
  }
}

function lc(s) {
  return typeof s === "string" ? s.trim().toLowerCase() : "";
}

// Public helpers (all safe fallbacks)
export async function mapVerb(text) {
  await ensureLoaded();
  if (!_ont.loaded) return { canon: null, source: "none" };
  const key = lc(text);
  if (_ont.verbs.has(key)) return { canon: key, source: "canon" };
  if (_ont.synonymsToVerb.has(key)) {
    return { canon: _ont.synonymsToVerb.get(key), source: "synonym" };
  }
  return { canon: null, source: "miss" };
}

export async function mapIngredient(text) {
  await ensureLoaded();
  if (!_ont.loaded) return { canon: null, source: "none" };
  const key = lc(text);
  if (_ont.ingredients.has(key)) return { canon: key, source: "canon" };
  if (_ont.synonymsToIngredient.has(key)) {
    return { canon: _ont.synonymsToIngredient.get(key), source: "synonym" };
  }
  return { canon: null, source: "miss" };
}

// optional: allow external toggling (debug)
export function setOntologyEnabled(flag) {
  ONTOLOGY_ENABLED = !!flag;
}