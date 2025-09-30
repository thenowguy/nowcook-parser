// Lightweight bridge so components don't import packs directly.
// Feel free to expand later (e.g., add readiness, synonyms).
import VERB_PACK from "../packs/verbs.en.json";
import DURATIONS_PACK from "../packs/durations.en.json";

export function getPacks() {
  return {
    verbs: VERB_PACK,
    durations: DURATIONS_PACK,
  };
}