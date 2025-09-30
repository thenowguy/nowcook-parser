/* Minimal ingestion for Phase 1: take a URL/HTML/plain text and
   produce a Meal object that App/AuthoringPanel can load.
   - If it's HTML, strips tags to text.
   - If it's a URL (http/https), we *don't* fetch (CORS); we just
     return a one-step placeholder meal for now.
   - Otherwise, treats it as plain text and pulls “step-like” lines.
*/

function stripHtml(s) {
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDurationEntries(pack) {
  const asEntryList = (arr) =>
    (arr || [])
      .filter((d) => d && (d.verb || d.canon || d.name))
      .map((d) => [
        d.verb ?? d.canon ?? d.name,
        d.planned_min ?? d.default_planned ?? d.min ?? d.value,
      ])
      .filter(([, v]) => Number.isFinite(v));
  if (Array.isArray(pack?.durations)) return asEntryList(pack.durations);
  if (Array.isArray(pack)) return asEntryList(pack);
  if (pack && typeof pack === "object") {
    if (pack.defaults && typeof pack.defaults === "object") {
      return Object.entries(pack.defaults).filter(([, v]) => Number.isFinite(v));
    }
    const numKeys = Object.keys(pack).filter((k) => Number.isFinite(pack[k]));
    if (numKeys.length) return numKeys.map((k) => [k, pack[k]]);
  }
  return [];
}

function canonFromPacks(verbsPack) {
  const arr = Array.isArray(verbsPack)
    ? verbsPack
    : Array.isArray(verbsPack?.verbs)
    ? verbsPack.verbs
    : [];
  return arr.map((v) => ({
    name: v.canon,
    attention: v.attention, // "attended" | "unattended_after_start"
    patterns: (v.patterns || []).map((p) => new RegExp(p, "i")),
    default_planned: v?.defaults?.planned_min ?? null,
  }));
}

function findVerb(text, CANONICAL) {
  for (const v of CANONICAL) for (const re of v.patterns) if (re.test(text)) return v;
  return null;
}

function toDurationObj(min) {
  return min == null ? null : { value: min };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function parseDurationMin(s) {
  const m = String(s).match(/(\d+)\s*(?:min|minutes?)/i);
  return m ? clamp(parseInt(m[1], 10), 1, 24 * 60) : null;
}

function uuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `task_${Math.random().toString(36).slice(2, 10)}`;
}

function looksLikeUrl(s) {
  return /^https?:\/\//i.test(String(s).trim());
}

function splitToCandidateLines(txt) {
  // keep lines that look like steps; drop big section headers
  return String(txt)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter(
      (l) =>
        !/^\s*(ingredients|ingredienti|directions|method|steps?)\s*:?\s*$/i.test(l) &&
        !/^\s*(serves|yield|prep|cook)\b/i.test(l)
    );
}

export async function ingestFromUrlOrHtml(input, packs) {
  const raw = String(input || "").trim();
  const CANONICAL = canonFromPacks(packs?.verbs || []);
  const DEFAULTS_BY_VERB = Object.fromEntries(extractDurationEntries(packs?.durations || {}));

  // URL: for now, we don't fetch (Phase 1). Return placeholder.
  if (looksLikeUrl(raw)) {
    return {
      title: "Imported recipe (URL)",
      author: { name: "Import" },
      tasks: [
        {
          id: uuid(),
          name: `Open URL and copy steps: ${raw}`,
          canonical_verb: "free_text",
          duration_min: null,
          planned_min: DEFAULTS_BY_VERB["free_text"] ?? null,
          requires_driver: true,
          self_running_after_start: false,
          inputs: [],
          outputs: [],
          edges: [],
        },
      ],
      packs_meta: {},
    };
  }

  // HTML → text
  const text =
    /<\w+/i.test(raw) && /<\/\w+>/i.test(raw) ? stripHtml(raw) : raw;

  const lines = splitToCandidateLines(text);

  // Heuristic title: first non-empty line that isn't numbered/sectiony
  const title =
    lines.find((l) => !/^\d+[\).\s]/.test(l) && !/^\s*(step|directions?)\b/i.test(l)) ||
    "Imported Recipe";

  const tasks = [];
  let prevId = null;

  for (const line of lines) {
    // Skip obvious section headers again
    if (/^\s*(ingredients|ingredienti)\b/i.test(line)) continue;

    const vMeta = findVerb(line, CANONICAL);
    const verb = vMeta?.name || "free_text";
    const durMin = parseDurationMin(line);
    const planned_min = durMin ?? vMeta?.default_planned ?? DEFAULTS_BY_VERB[verb] ?? null;

    const id = uuid();
    const name = line.replace(/\s*—\s*\d+\s*min(?:utes?)?$/i, "");
    const task = {
      id,
      name,
      canonical_verb: verb,
      duration_min: toDurationObj(durMin),
      planned_min,
      requires_driver: vMeta ? vMeta.attention === "attended" : true,
      self_running_after_start: vMeta ? vMeta.attention === "unattended_after_start" : false,
      inputs: [],
      outputs: [],
      edges: [],
    };

    // lightweight FS chain
    if (prevId) task.edges.push({ from: prevId, type: "FS" });
    tasks.push(task);
    prevId = id;
  }

  return {
    title,
    author: { name: "Import" },
    tasks,
    packs_meta: {},
  };
}