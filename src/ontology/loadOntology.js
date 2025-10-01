/* loadOntology.js — v1.0.1
   - Dynamically imports ontology JSON with explicit .json paths.
   - Builds quick lookup maps + reverse synonym maps.
*/
/* eslint-disable */

function toMap(obj) {
  const m = new Map();
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) m.set(String(k).toLowerCase(), v || {});
  }
  return m;
}

function addSynonymsReverse(map, out) {
  for (const [canon, data] of map.entries()) {
    const syns = Array.isArray(data?.synonyms) ? data.synonyms : [];
    for (const s of syns) out.set(String(s).toLowerCase(), canon);
    // Also map the canonical label to itself for convenience
    const label = data?.label || canon;
    out.set(String(label).toLowerCase(), canon);
  }
}

export async function loadOntology() {
  // NOTE: these paths are relative to THIS FILE at build-time
  const verbsMod = await import("./verbs.master.json");
  const ingsMod  = await import("./ingredients.master.json");

  const verbs = toMap(verbsMod?.default || verbsMod || {});
  const ingredients = toMap(ingsMod?.default || ingsMod || {});

  const synonymsToVerb = new Map();
  const synonymsToIngredient = new Map();
  addSynonymsReverse(verbs, synonymsToVerb);
  addSynonymsReverse(ingredients, synonymsToIngredient);

  return {
    verbs,
    ingredients,
    synonymsToVerb,
    synonymsToIngredient,
  };
}