// src/ontology/loadOntology.js
/* eslint-disable */

// Local JSON sources (keep both files next to this one)
import VERBS from "./verbs.master.json";
import ING from "./ingredients.master.json";

// Synchronous in-memory getters (swap to fetch later if you like)
export const getVerbs = () => (Array.isArray(VERBS) ? VERBS : []);
export const getIngredients = () => (Array.isArray(ING) ? ING : []);

// Convenience lookups (null-safe)
export const getIngredientByName = (name) => {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  return getIngredients().find((i) => String(i?.name || "").toLowerCase() === n) || null;
};

export const getVerbByCanonical = (canon) => {
  if (!canon) return null;
  const c = String(canon).trim().toLowerCase();
  return getVerbs().find((v) => String(v?.canonical || "").toLowerCase() === c) || null;
};