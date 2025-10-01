/* ontology_bridge.js — v0.3
   Safe, lazy bridge between UI/parser and the ontology bundle.

   Goals:
   - Never crash the app if ontology files are missing or malformed.
   - Load once (memoized), build fast matchers, reuse everywhere.
   - Provide a tiny API:
       • getOntology()          -> { verbsByCanon, matchers, ingredientsByCanon }
       • suggestCanonVerb(text) -> "slice" | null
       • upgradeTask(task)      -> task with canonical_verb possibly upgraded
       • setOntologyEnabled(bool) / isOntologyEnabled()

   Notes:
   - We ONLY *suggest* a verb from ontology. If the calling code wants to keep
     free_text and rely on later upgrades, just ignore the suggestion.
*/
/* eslint-disable */

import { loadOntology } from "./ontology/loadOntology.js";

let ONTOLOGY_ENABLED = true;
export function setOntologyEnabled(v) { ONTOLOGY_ENABLED = !!v; }
export function isOntologyEnabled() { return ONTOLOGY_ENABLED; }

let _memo = {
  promise: null,
  value: null,
};

/** Build robust, case-insensitive regex from a human phrase.
 *  - Escapes regex metachars
 *  - Converts inner whitespace to \s+ to match any spacing
 *  - Wraps in word boundaries when sensible
 */
function phraseToRegex(phrase) {
  if (!phrase || typeof phrase !== "string") return null;
  const escaped = phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");

  // If starts/ends with a letter, use word boundaries; otherwise just use the token.
  const needsLeadingWB = /^[A-Za-z]/.test(phrase);
  const needsTrailingWB = /[A-Za-z]$/.test(phrase);
  const pre = needsLeadingWB ? "\\b" : "";
  const post = needsTrailingWB ? "\\b" : "";
  try {
    return new RegExp(pre + escaped + post, "i");
  } catch {
    return null;
  }
}

/** Produce a stable structure of matchers: [{ canon, re }, ...] */
function buildMatchers(ontology) {
  const out = [];

  const pushSafe = (canon, phrase) => {
    const re = phraseToRegex(phrase);
    if (re) out.push({ canon, re, key: phrase.toLowerCase() });
  };

  // 1) From verbs.master (canon + synonyms)
  if (ontology?.verbs && Array.isArray(ontology.verbs)) {
    for (const v of ontology.verbs) {
      if (!v || !v.canon) continue;
      // Canon itself
      pushSafe(v.canon, v.canon);
      // Synonyms from verbs.master
      if (Array.isArray(v.synonyms)) {
        for (const s of v.synonyms) pushSafe(v.canon, s);
      }
    }
  }

  // 2) From packs/synonyms.en.json (if present)
  const packSyn = ontology?.packs?.synonyms;
  if (packSyn && typeof packSyn === "object") {
    for (const canon of Object.keys(packSyn)) {
      const list = packSyn[canon];
      if (Array.isArray(list)) {
        for (const s of list) pushSafe(canon, String(s || ""));
      }
    }
  }

  // Sort longest phrase first so we prefer “cut into wedges” over “cut”
  out.sort((a, b) => (b.key?.length || 0) - (a.key?.length || 0));
  return out;
}

/** Build quick maps for lookups */
function buildMaps(ontology) {
  const verbsByCanon = new Map();
  const ingredientsByCanon = new Map();

  if (Array.isArray(ontology?.verbs)) {
    for (const v of ontology.verbs) {
      if (v?.canon) verbsByCanon.set(String(v.canon).toLowerCase(), v);
    }
  }
  if (Array.isArray(ontology?.ingredients)) {
    for (const ing of ontology.ingredients) {
      if (ing?.canon) ingredientsByCanon.set(String(ing.canon).toLowerCase(), ing);
    }
  }
  return { verbsByCanon, ingredientsByCanon };
}

/** Lazy, safe loader that memoizes the processed ontology */
export async function getOntology() {
  if (_memo.value) return _memo.value;

  if (!_memo.promise) {
    _memo.promise = (async () => {
      try {
        const raw = await loadOntology();
        const matchers = buildMatchers(raw);
        const { verbsByCanon, ingredientsByCanon } = buildMaps(raw);
        const value = { raw, matchers, verbsByCanon, ingredientsByCanon, packs: raw?.packs || {} };
        _memo.value = value;
        return value;
      } catch (err) {
        // Never take the app down; degrade gracefully.
        console.warn("[ontology_bridge] Failed to load ontology:", err);
        const empty = { raw: null, matchers: [], verbsByCanon: new Map(), ingredientsByCanon: new Map(), packs: {} };
        _memo.value = empty;
        return empty;
      }
    })();
  }
  return _memo.promise;
}

/** Suggest a canonical verb from arbitrary text using ontology matchers.
 *  Returns a canon string (e.g., "slice") or null.
 */
export async function suggestCanonVerb(text) {
  if (!ONTOLOGY_ENABLED) return null;
  if (!text || typeof text !== "string") return null;

  const { matchers } = await getOntology();
  if (!matchers.length) return null;

  // Simple first-hit scan (phrases sorted longest-first)
  for (const m of matchers) {
    try {
      if (m.re.test(text)) return m.canon;
    } catch {
      // ignore bad regex edge-cases
    }
  }
  return null;
}

/** Upgrade a task object in-place (or shallow copy) if we can infer a verb.
 *  - Only upgrades when canonical_verb is missing or "free_text"
 *  - Adds a hint flag: task._ontology_upgraded = true
 */
export async function upgradeTask(task, { mutate = false } = {}) {
  if (!ONTOLOGY_ENABLED || !task || typeof task !== "object") return task;
  const current = (task.canonical_verb || "").toLowerCase();

  if (current && current !== "free_text") return task; // nothing to do

  const canon = await suggestCanonVerb(task.name || "");
  if (!canon) return task;

  if (mutate) {
    task.canonical_verb = canon;
    task._ontology_upgraded = true;
    return task;
  }

  return {
    ...task,
    canonical_verb: canon,
    _ontology_upgraded: true,
  };
}

/** Convenience: upgrade a batch of tasks; mirrors parse → draft usage. */
export async function upgradeTasks(tasks, { mutate = false } = {}) {
  if (!Array.isArray(tasks) || !ONTOLOGY_ENABLED) return tasks;
  const out = [];
  for (const t of tasks) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await upgradeTask(t, { mutate }));
  }
  return out;
}