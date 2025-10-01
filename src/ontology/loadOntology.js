// src/ontology/loadOntology.js
/* eslint-disable */

// These are your JSON sources (commit the two JSON files alongside this file):
// - src/ontology/verbs.master.json
// - src/ontology/ingredients.master.json
//
// Schema is intentionally flexible. The bridge will guard against missing fields.
import VERBS from "./verbs.master.json";
import ING from "./ingredients.master.json";

// Tiny in-memory loader (sync). If you later fetch remotely, swap these out.
export const getVerbs = () => Array.isArray(VERBS) ? VERBS : [];
export const getIngredients = () => Array.isArray(ING) ? ING : [];

// Convenience lookups (soft matches, null-safe)
export const getIngredientByName = (name) => {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  return getIngredients().find(i => String(i?.name || "").toLowerCase() === n) || null;
};

export const getVerbByCanonical = (canon) => {
  if (!canon) return null;
  const c = String(canon).trim().toLowerCase();
  return getVerbs().find(v => String(v?.canonical || "").toLowerCase() === c) || null;
};