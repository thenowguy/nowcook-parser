/* ingestion/ontology_bridge.js — v0.2
   - Loads ontology (verbs + synonyms, ingredients + aliases)
   - Upgrades parsed tasks that are still free_text → canonical verb when safe
   - Leaves timing/attention alone; rely on verbs.en.json defaults after upgrade
*/
/* eslint-disable */
import { loadOntology } from "./ontology/loadOntology";

// simple normalizer
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// build quick lookups from ontology payload
function buildLookups(onto) {
  const verbBySyn = new Map();   // "chop finely" -> "slice" (example)
  const verbMeta  = new Map();   // "slice" -> { canon: "slice", params: {...} }
  const ingByAlias = new Map();  // "roma tomatoes" -> "tomato"

  for (const v of onto.actions || onto.verbs || []) {
    const canon = norm(v.canon || v.name);
    verbMeta.set(canon, { ...v, canon });
    const syns = Array.isArray(v.synonyms) ? v.synonyms : [];
    for (const s of syns) verbBySyn.set(norm(s), canon);
    // also allow the canonical label itself
    if (canon) verbBySyn.set(canon, canon);
  }

  for (const ing of onto.ingredients || []) {
    const head = norm(ing.canon || ing.name);
    if (!head) continue;
    ingByAlias.set(head, head);
    for (const a of (ing.aliases || [])) ingByAlias.set(norm(a), head);
  }

  return { verbBySyn, verbMeta, ingByAlias };
}

// very light “phrase anywhere” matcher (prefers longer phrases)
function findBestVerb(text, verbBySyn) {
  const t = norm(text);
  let best = null;
  for (const [syn, canon] of verbBySyn.entries()) {
    if (!syn) continue;
    // whole-word-ish containment
    const re = new RegExp(`(^|\\b)${syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\b)`, "i");
    if (re.test(t)) {
      if (!best || syn.length > best.syn.length) best = { syn, canon };
    }
  }
  return best ? best.canon : null;
}

// optional: ingredient detection can steer ambiguous verb choices later
function detectIngredients(text, ingByAlias) {
  const t = norm(text);
  const hits = new Set();
  for (const [alias, canon] of ingByAlias.entries()) {
    if (!alias) continue;
    const re = new RegExp(`(^|\\b)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\b)`, "i");
    if (re.test(t)) hits.add(canon);
  }
  return [...hits];
}

/** Upgrade tasks in-place (but returns a new array for React friendliness). */
export async function upgradeWithOntology(tasks) {
  const onto = await loadOntology(); // { actions/verbs, ingredients, overrides? }
  const { verbBySyn, verbMeta, ingByAlias } = buildLookups(onto);

  return tasks.map((t) => {
    // already upgraded? leave it alone
    if (t.canonical_verb && t.canonical_verb !== "free_text") return t;

    const guess = findBestVerb(t.name || "", verbBySyn);
    if (!guess) return t; // no confident upgrade

    const v = verbMeta.get(guess);
    if (!v) return t;

    // future: use detectIngredients(t.name, ingByAlias) to refine ambiguous verbs

    return {
      ...t,
      canonical_verb: v.canon,
      // Do NOT set planned_min or requires_driver here; let existing
      // verb pack defaults apply downstream (your current pipeline already does).
    };
  });
}