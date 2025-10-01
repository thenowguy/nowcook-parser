/* ontology_bridge.js — v0.3
   Thin facade over the canonical ontology loader.
   - Single source of truth: ../ontology/loadOntology.js
   - Lazy cache; opt-in enable/disable
   - Safe no-op "upgrade" helpers so you can wire this in without risk
*/
/* eslint-disable */

import { loadOntology } from "../ontology/loadOntology.js";

let ONTOLOGY_ENABLED = true;       // You can flip this at runtime
let _cache = null;                 // Lazy-loaded ontology bundle (verbs, ingredients, overrides)

/* ------------------------ Controls & Status ------------------------ */

export function setOntologyEnabled(enabled) {
  ONTOLOGY_ENABLED = !!enabled;
}

export function isOntologyEnabled() {
  return !!ONTOLOGY_ENABLED;
}

export async function getOntology() {
  if (!ONTOLOGY_ENABLED) return null;
  if (_cache) return _cache;
  _cache = await loadOntology();
  return _cache;
}

export function clearOntologyCache() {
  _cache = null;
}

/* --------------------- Upgrade / Mapping Helpers -------------------- */
/* These are intentionally conservative, safe no-ops by default.
   You can start wiring them into AuthoringPanel without breaking anything.
   Later, we’ll fill in the real mapping logic (synonyms, applicability, etc.).
*/

// Given a single draft task (object with `name`, `canonical_verb`, etc.),
// return a NEW task object with any ontology upgrades applied.
// For now: no-op that simply returns the original task unchanged.
export async function upgradeTaskViaOntology(task) {
  if (!ONTOLOGY_ENABLED) return task;
  await getOntology(); // ensure loaded (future logic will use it)
  return task; // no-op placeholder
}

// Given an array of tasks, return a NEW array with upgrades applied.
export async function upgradeTasksViaOntology(tasks = []) {
  if (!ONTOLOGY_ENABLED || !Array.isArray(tasks) || tasks.length === 0) return tasks;
  await getOntology(); // ensure loaded
  // No-op pass-through for now
  return tasks.slice();
}

/* -------------------------- Small Utilities ------------------------- */

// Normalize a verb string (future: fold case, strip punctuation, map synonyms)
export function normalizeVerb(s) {
  return String(s || "").trim();
}

// Normalize an ingredient string (future: plural → singular, remove descriptors)
export function normalizeIngredient(s) {
  return String(s || "").trim();
}