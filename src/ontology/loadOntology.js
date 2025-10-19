/* loadOntology.js — v0.2
   Canonical, lazy loader for ontology JSON.
   Always import THIS file (never the JSON directly) from app code.
*/
/* eslint-disable */

export async function loadOntology() {
  // Dynamic imports keep bundlers happy and let us lazy-load.
  const verbsMod = await import("./verbs.master.json");
  const ingsMod  = await import("./ingredients.master.json");
  // Optional: per-project overrides (present in your repo)
  let overrides = {};
  try {
    const ovMod = await import("./verbs.applicability.overrides.json");
    overrides = ovMod.default ?? ovMod;
  } catch {
    // Ok if missing — keep overrides empty
  }

  return {
    verbs: verbsMod.default ?? verbsMod,                // Master verb ontology
    ingredients: ingsMod.default ?? ingsMod,            // Master ingredient ontology
    overrides,                                          // Applicability / tweaks
    loadedAt: Date.now(),
  };
}