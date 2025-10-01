/* ontology_bridge.js — v0.4
   Facade over the ontology loader.
   - Restores mapVerb() export for compatibility
   - Safe no-ops for upgrade helpers
*/
/* eslint-disable */

import { loadOntology } from "../ontology/loadOntology.js";

let ONTOLOGY_ENABLED = true; // can be flipped at runtime
let _cache = null;           // lazy-loaded ontology bundle

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

// Compatibility shim: previously imported in AuthoringPanel
// For now: simple passthrough; later can map synonyms → canonical verbs
export function mapVerb(verbString) {
  return normalizeVerb(verbString);
}

// Upgrade a single task (currently no-op)
export async function upgradeTaskViaOntology(task) {
  if (!ONTOLOGY_ENABLED) return task;
  await getOntology();
  return task;
}

// Upgrade an array of tasks (currently no-op)
export async function upgradeTasksViaOntology(tasks = []) {
  if (!ONTOLOGY_ENABLED || !Array.isArray(tasks) || tasks.length === 0) return tasks;
  await getOntology();
  return tasks.slice();
}

/* -------------------------- Small Utilities ------------------------- */

export function normalizeVerb(s) {
  return String(s || "").trim();
}

export function normalizeIngredient(s) {
  return String(s || "").trim();
}