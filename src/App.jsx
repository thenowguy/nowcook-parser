// ============================== NowCook Parser — v1.7.8 ==============================
// v1.7.8 = v1.7.7 + fixes
//  - Running bars move again: x = Now - elapsed, width = remaining
//  - Finished bars still stop at Now (right edge = real finish time)
//  - Durations are integer minutes everywhere (no float speck/21.0099)
//  - Ghost/finished/running use the same duration helper
// Packs live in: src/packs/{verbs.en.json,durations.en.json,readiness.en.json,synonyms.en.json}
// Sample meals live in: src/meals/*.json

/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";

<<<<<<< HEAD
// ----------------------------------------------------------------------
// Packs (src/packs)
// ----------------------------------------------------------------------
import VERB_PACK from "./packs/verbs.en.json";
import DURATIONS_PACK from "./packs/durations.en.json";
import READINESS_PACK from "./packs/readiness.en.json";   // reserved (not used yet)
import SYNONYMS_PACK from "./packs/synonyms.en.json";     // optional

// ----------------------------------------------------------------------
// Sample meals (src/meals) — underscore filenames
// ----------------------------------------------------------------------
import MEAL_PASTA from "./meals/quick_pasta.json";
import MEAL_ROAST from "./meals/roast_chicken.json";
import MEAL_STEW  from "./meals/slow_beef_stew.json";

// ----------------------------------------------------------------------
// Tiny helpers
// ----------------------------------------------------------------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mmss = (ms) => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
=======
/**
 * NowCook Parser + Mini Runtime — App.jsx (v1.6.2)
 * - Stand-alone, but optionally loads Packs from /packs/*.json at runtime
 * - If packs missing -> uses built-in defaults (no errors)
 * - Typed edges (FS, SS)
 * - Oven rule: preheat_oven must FINISH before bake/roast
 * - Driver mutex: only one attended task may run at a time
 * - Attended minimum duration = 1 min
 */

/* ============================ Canon & Defaults ============================ */
const CANONICAL_VERBS = [
  // prep
  { name: "wash", attention: "attended" },
  { name: "trim", attention: "attended" },
  { name: "peel", attention: "attended" },
  { name: "chop", attention: "attended" },
  { name: "dice", attention: "attended" },
  { name: "mince", attention: "attended" },
  { name: "slice", attention: "attended" },
  { name: "grate", attention: "attended" },
  { name: "whisk", attention: "attended" },

  // heat
  { name: "preheat_oven", attention: "unattended_after_start" },
  { name: "preheat_pan", attention: "attended" },
  { name: "heat_oil", attention: "attended" },
  { name: "bring_to_boil", attention: "unattended_after_start" },
  { name: "boil", attention: "unattended_after_start" },
  { name: "simmer", attention: "unattended_after_start" },
  { name: "sauté", attention: "attended" },
  { name: "sweat", attention: "attended" },
  { name: "sear", attention: "attended" },
  { name: "brown", attention: "attended" },

  // oven
  { name: "roast", attention: "unattended_after_start" },
  { name: "bake", attention: "unattended_after_start" },
  { name: "rest_meat", attention: "unattended_after_start" },

  // compositional
  { name: "arrange", attention: "attended" },
  { name: "season", attention: "attended" },
  { name: "drizzle", attention: "attended" },
  { name: "toss", attention: "attended" },
  { name: "stuff", attention: "attended" },
  { name: "truss", attention: "attended" },
  { name: "add", attention: "attended" },

  // finish
  { name: "plate", attention: "attended" },
];

/** Built-in verb synonyms (BASE). Packs will be merged on top at runtime. */
const VERB_SYNONYMS_BASE = [
  { canon: "sweat", patterns: ["sweat", "soften without color", "soften without colour", "cook until translucent"] },
  { canon: "sauté", patterns: ["saute", "sauté", "fry lightly", "brown lightly", "cook over medium heat"] },
  { canon: "sear", patterns: ["sear", "brown hard", "sear until browned"] },

  { canon: "preheat_oven", patterns: ["preheat the oven", "heat the oven"] },
  { canon: "preheat_pan", patterns: ["preheat the pan", "heat a pan", "heat a large pan"] },
  { canon: "heat_oil", patterns: ["heat the oil", "add oil and heat", "oil shimmering"] },

  { canon: "bring_to_boil", patterns: ["bring to a boil", "bring to the boil", "bring up to a boil"] },
  { canon: "simmer", patterns: ["simmer", "gentle simmer", "vigorous simmer"] },
  { canon: "boil", patterns: ["boil", "boil until tender", "boil rapidly"] },

  { canon: "roast", patterns: ["roast ", "roast until", "place in the oven"] },
  { canon: "bake", patterns: ["bake for", "bake until", "cook for a further", "cook for "] },
  { canon: "rest_meat", patterns: ["rest with the heat off", "allow to rest", "let rest", "leave to rest"] },

  { canon: "plate", patterns: ["serve", "plate", "dish up"] },

  { canon: "arrange", patterns: ["arrange", "place the", "set on top", "spread the", "put the"] },
  { canon: "season", patterns: ["season with", "sprinkle with", "sprinkle over"] },
  { canon: "drizzle", patterns: ["drizzle with", "drizzle over", "coat with oil", "toss with oil"] },
  { canon: "toss", patterns: ["toss the", "stir around", "turn the vegetables"] },
  { canon: "stuff", patterns: ["stuff the", "fill cavity", "insert into the cavity", "stuff with"] },
  { canon: "truss", patterns: ["truss the", "tie legs", "bind chicken"] },

  // Add-water family
  { canon: "add", patterns: [
    "add the water", "slowly add the water", "add all the water",
    "add the water quickly", "pour the water over", "stir in the water",
    "mix in the water", "add water"
  ]},

  // common prep (fallbacks)
  { canon: "peel", patterns: ["peel"] },
  { canon: "chop", patterns: ["chop", "finely chop", "roughly chop"] },
  { canon: "slice", patterns: ["slice", "thinly slice", "thickly slice"] },
  { canon: "dice", patterns: ["dice"] },
  { canon: "mince", patterns: ["mince"] },
  { canon: "grate", patterns: ["grate"] },
  { canon: "whisk", patterns: ["whisk"] },
];

/** Built-in readiness cues (BASE). Packs add more via pattern strings. */
const READINESS_TABLE_BASE = [
  { type: "color", value: "golden", pattern: "until\\s+golden|lightly\\s+browned|deeply\\s+golden" },
  { type: "texture", value: "tender", pattern: "until\\s+(knife|fork)?-?\\s*tender|until\\s+soft" },
  { type: "activity", value: "bubbling", pattern: "bubbling" },
  { type: "texture", value: "al_dente", pattern: "until\\s+al\\s*dente" },
  { type: "viscosity", value: "nappe", pattern: "coats\\s+the\\s+back\\s+of\\s+a\\s+spoon|nappe" },
];

/* ============================ Duration & Policies ============================ */
const DURATION_REGEX = [
  { kind: "minutes_range", re: /(\d+)\s*[-–—]\s*(\d+)\s*(?:min|minutes?)(?=[\s,.]|$)/i },
  { kind: "minutes", re: /(\d+)\s*(?:min|minutes?)(?=[\s,.]|$)/i },
  { kind: "hours_range", re: /(\d+)\s*[-–—]\s*(\d+)\s*hours?(?=[\s,.]|$)/i },
  { kind: "hours", re: /(\d+)\s*hours?(?=[\s,.]|$)/i },
];
const EXTRA_DURATION_REGEX = [{ kind: "minutes_at_least", re: /at least\s+(\d+)\s*minutes?/i }];

const DEFAULT_PLANNED_MIN = {
  preheat_oven: 12,
  preheat_pan: 3,
  heat_oil: 5,
  bring_to_boil: 10,
  boil: 10,
  simmer: 12,
  roast: 30,
  bake: 30,
  whisk: 1, stir: 1, toss: 1, season: 1, drizzle: 1, add: 1,
  plate: 5,
};

/* ============================ Utilities ============================ */
const uid = (() => { let i = 0; return (p = "t") => `${p}_${++i}`; })();
const trimLines = (txt) => txt.split(/\n+/).map((l) => l.trim()).filter(Boolean);
const COOK_VERBS = new Set(["bake","boil","simmer","roast","sauté","sweat","sear","brown"]);
const STOP = new Set(["of","and","or","a","the","with","to","in","for","large","small","medium","fresh","dried","finely","roughly"]);
const singularize = (w) => w.replace(/ies$/,"y").replace(/s$/,"");
const tokenize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(t => t && !STOP.has(t)).map(singularize);

/* advisory filter (keep actionable lines only) */
const isAdvisory = (s) => {
  const lower = s.toLowerCase();
  const hasCanonVerb = CANONICAL_VERBS.some(v => lower.includes(v.name.replace(/_/g, " ")));
  if (hasCanonVerb) return false;
  if (/more than one chicken|two chickens|2 chickens/.test(lower)) return true;
  if (/^(tip|chef.?s tip|note|make ahead|storage|substitutions|equipment|nutrition|serving suggestion|wine pairing)\s*:/.test(lower))
    return true;
  if (/see note|see notes|see tip|see sidebar|see footnote/.test(lower)) return true;
  if (/^(if|when)\b/.test(lower)) return true;
  if (/optional\)?$/.test(lower)) return true;
  return false;
>>>>>>> c06e7e9 (1.6.2)
};
const minToMs = (m) => (m == null ? 0 : Math.max(0, Math.round(m))) * 60_000;
const uuid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `task_${Math.random().toString(36).slice(2, 10)}`);

<<<<<<< HEAD
// ----------------------------------------------------------------------
// Canon & defaults from packs (shape-agnostic)
// ----------------------------------------------------------------------
const VERBS_ARRAY = Array.isArray(VERB_PACK)
  ? VERB_PACK
  : Array.isArray(VERB_PACK?.verbs)
  ? VERB_PACK.verbs
  : [];

const CANONICAL =
  VERBS_ARRAY.map((v) => ({
    name: v.canon,
    attention: v.attention, // "attended" | "unattended_after_start"
    patterns: (v.patterns || []).map((p) => new RegExp(p, "i")),
    default_planned: v?.defaults?.planned_min ?? null,
  })) ?? [];

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
=======
/* ============================ Parsers (parametric tables) ============================ */
const compileReadiness = (items) => items.map(({ type, value, pattern }) => ({
  type, value, re: new RegExp(pattern, "i")
}));

const findVerbHits = (text, verbSynonyms) => {
  const lower = text.toLowerCase();
  const hits = [];
  for (const { canon, patterns } of verbSynonyms) {
    for (const p of patterns) {
      const needle = p.toLowerCase();
      let from = 0;
      while (true) {
        const i = lower.indexOf(needle, from);
        if (i === -1) break;
        hits.push({ canon, idx: i, len: needle.length });
        from = i + needle.length;
      }
>>>>>>> c06e7e9 (1.6.2)
    }
    const numKeys = Object.keys(pack).filter((k) => Number.isFinite(pack[k]));
    if (numKeys.length) return numKeys.map((k) => [k, pack[k]]);
  }
  return [];
}
const DEFAULTS_BY_VERB = Object.fromEntries(extractDurationEntries(DURATIONS_PACK));

<<<<<<< HEAD
// ----------------------------------------------------------------------
// Synonyms (optional; exposed on meal.meta for later use)
// ----------------------------------------------------------------------
const SYNONYMS = (() => {
  const pack = SYNONYMS_PACK;
  if (!pack) return {};
  if (Array.isArray(pack)) {
    if (pack.length && Array.isArray(pack[0])) {
      return Object.fromEntries(
        pack
          .filter((t) => Array.isArray(t) && t.length === 2 && typeof t[0] === "string")
          .map(([head, aliases]) => [String(head).toLowerCase(), Array.isArray(aliases) ? aliases : []])
      );
=======
const splitIntoActions = (line, verbSynonyms) => {
  const coarse = line
    .split(/(?<=[.;])\s+/)
    .flatMap(s => s.split(/\s+(?:then|and then|after that|next)\s+/i))
    .map(s => s.trim())
    .filter(Boolean);

  const actions = [];
  for (const piece of coarse) {
    if (isAdvisory(piece)) continue;
    const hits = findVerbHits(piece, verbSynonyms);
    if (hits.length <= 1) actions.push(piece);
    else {
      for (let i = 0; i < hits.length; i++) {
        const start = hits[i].idx;
        const end = i + 1 < hits.length ? hits[i+1].idx : piece.length;
        const chunk = piece.slice(start, end).trim();
        if (chunk) actions.push(chunk);
      }
>>>>>>> c06e7e9 (1.6.2)
    }
    return Object.fromEntries(
      pack
        .filter((x) => x && typeof x.head === "string")
        .map((x) => [x.head.toLowerCase(), Array.isArray(x.aliases) ? x.aliases : []])
    );
  }
  if (typeof pack === "object") {
    return Object.fromEntries(
      Object.entries(pack).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v : []])
    );
  }
  return {};
})();

<<<<<<< HEAD
// ----------------------------------------------------------------------
// Parse helpers (kept for future paste-mode)
// ----------------------------------------------------------------------
function parseDurationMin(s) {
  const m = s.match(/(\d+)\s*(?:min|minutes?)/i);
  return m ? clamp(parseInt(m[1], 10), 1, 24 * 60) : null;
}
function parseReadiness(_s) { return null; }
function findVerb(text) {
  for (const v of CANONICAL) {
    for (const re of v.patterns) {
      if (re.test(text)) return v;
=======
const findCanonVerb = (text, verbSynonyms) => {
  const lower = text.toLowerCase();
  let best = { canon: null, idx: Infinity };
  for (const { canon, patterns } of verbSynonyms) {
    for (const p of patterns) {
      const i = lower.indexOf(p.toLowerCase());
      if (i >= 0 && i < best.idx) best = { canon, idx: i };
>>>>>>> c06e7e9 (1.6.2)
    }
  }
  return null;
<<<<<<< HEAD
=======
};

const parseReadiness = (text, readinessTable) => {
  for (const r of readinessTable) if (r.re.test(text)) return { type: r.type, value: r.value };
  return null;
};

const toDurationObj = (dur) =>
  !dur ? null :
  Object.prototype.hasOwnProperty.call(dur, "value") ? { value: dur.value } : { range: dur.range };

/* ============================ Policies ============================ */
function applyAttendedDurationPolicy(task) {
  if (!task.requires_driver) return { ...task, planned_min: task.planned_min ?? (task.duration_min?.value ?? null) };
  const d = task.duration_min;
  if (!d) return { ...task, duration_min: { value: 1 }, planned_min: 1 };
  if ("value" in d && typeof d.value === "number") {
    const v = Math.max(1, d.value);
    return { ...task, duration_min: { value: v }, planned_min: v };
  }
  if ("range" in d && Array.isArray(d.range)) {
    const [a,b] = d.range;
    const aa = Math.max(1, a ?? 1);
    const bb = Math.max(1, b ?? aa);
    return { ...task, duration_min: { range: [aa, bb] }, planned_min: aa };
  }
  return task;
>>>>>>> c06e7e9 (1.6.2)
}
const toDurationObj = (min) => (min == null ? null : { value: min });

<<<<<<< HEAD
// Prefer explicit per-task duration over planned/defaults; return integer minutes >= 1
const getPlannedMinutes = (t) => {
  if (!t) return 1;
  const explicit = t?.duration_min?.value;
  const planned  = t?.planned_min;
  const byVerb   = DEFAULTS_BY_VERB?.[t?.canonical_verb];
  const val = explicit ?? planned ?? byVerb ?? 1;
  return Math.max(1, Math.round(val));
};

// (kept for completeness)
function lineToTask(text) {
  const verbMeta = findVerb(text);
  const verb = verbMeta?.name || "free_text";
  const durMin = parseDurationMin(text);
  const packDefault = verbMeta?.default_planned ?? DEFAULTS_BY_VERB[verb] ?? null;
  const planned_min = durMin ?? packDefault ?? null;
  const requires_driver = verbMeta ? verbMeta.attention === "attended" : true;
  const self_running_after_start = verbMeta ? verbMeta.attention === "unattended_after_start" : false;
  return {
    id: uuid(),
    name: text.replace(/\.$/, ""),
    canonical_verb: verb,
    duration_min: toDurationObj(durMin),
    planned_min,
    readiness_signal: parseReadiness(text),
    requires_driver,
    self_running_after_start,
    inputs: [],
    outputs: [],
    edges: [],
  };
}

// ----------------------------------------------------------------------
// Minimum makespan (critical path across FS/FF/SF; SS imposes no finish wait)
// ----------------------------------------------------------------------
function computeCriticalPathMin(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  const idxById = new Map(tasks.map((t, i) => [t.id, i]));
  const planned = (t) => getPlannedMinutes(t);
  const finishPreds = tasks.map((t) =>
    (t.edges || [])
      .filter((e) => e && idxById.has(e.from) && e.type !== "SS")
      .map((e) => idxById.get(e.from))
  );
  const memo = new Array(tasks.length).fill(null);
  function earliestFinish(i) {
    if (memo[i] != null) return memo[i];
    const preds = finishPreds[i];
    const start = preds.length ? Math.max(...preds.map(earliestFinish)) : 0;
    const fin = start + planned(tasks[i]);
    memo[i] = fin;
    return fin;
=======
function applyAdvisoryPlannedDefaults(task) {
  let planned = task.planned_min;
  if (planned == null) {
    const hint = DEFAULT_PLANNED_MIN[task.canonical_verb];
    if (hint != null) planned = hint;
  }
  if (task.requires_driver && (planned == null || planned < 1)) planned = 1;
  return { ...task, planned_min: planned };
}

/* ============================ Task + Edges ============================ */
const EDGE_TYPES = ["FS","SS"];

const lineToTask = (text, tables) => {
  const { verbSynonyms, readinessTable } = tables;
  const verb = findCanonVerb(text, verbSynonyms);
  const dur = toDurationObj(parseDuration(text));
  const ready = parseReadiness(text, readinessTable);
  const vMeta = CANONICAL_VERBS.find((v) => v.name === verb);

  const base = {
    id: uid("t"),
    name: text.replace(/\.$/, ""),
    canonical_verb: verb,
    duration_min: dur,
    planned_min: dur?.value ?? null,
    readiness_signal: ready,
    requires_driver: vMeta ? vMeta.attention === "attended" : true,
    self_running_after_start: vMeta ? vMeta.attention === "unattended_after_start" : false,
    edges: [],
  };
  return applyAttendedDurationPolicy(base);
};

function addIfMissingEdge(cur, fromId, type, lag = null) {
  if (!EDGE_TYPES.includes(type)) type = "FS";
  if (!cur.edges) cur.edges = [];
  const has = cur.edges.some(
    (e) => e.from === fromId && e.type === type && (e.lag_min ?? null) === (lag ?? null)
  );
  if (!has) {
    const e = { from: fromId, type };
    if (lag != null && Number.isFinite(lag)) e.lag_min = Math.round(lag);
    cur.edges.push(e);
  }
}

/* ============================ Parser (tables passed in) ============================ */
function buildMealMap(raw, tables) {
  const title = (raw.match(/Title:\s*(.*)/i) || [])[1]?.trim() || "Untitled";
  const author = (raw.match(/Author:\s*(.*)/i) || [])[1]?.trim() || "Unknown";
  const instrBlock = (raw.split(/Instructions:/i)[1] || raw).trim();

  const rawLines = trimLines(instrBlock).map(l => l.replace(/^\d+\.\s*/, "").trim());
  const stepLines = rawLines.flatMap(line => splitIntoActions(line, tables.verbSynonyms));

  // steps → tasks
  let tasks = stepLines.map(line => lineToTask(line, tables));

  // sequential fallback: prev -> cur (SS if prev unattended-after-start, else FS)
  for (let i = 1; i < tasks.length; i++) {
    const prev = tasks[i - 1];
    const cur = tasks[i];
    if (cur.edges.some(e => e.from === prev.id)) continue;
    const unattended = !!prev.self_running_after_start || prev.canonical_verb === "preheat_oven";
    addIfMissingEdge(cur, prev.id, unattended ? "SS" : "FS", null);
>>>>>>> c06e7e9 (1.6.2)
  }
  let makespan = 0;
  for (let i = 0; i < tasks.length; i++) {
    makespan = Math.max(makespan, earliestFinish(i));
  }
  return makespan; // integer minutes
}

// ----------------------------------------------------------------------
// Runtime (driver semantics: unattended doesn't block)
// ----------------------------------------------------------------------
function consumesDriver(task) { return !!task.requires_driver; }
function depsSatisfied(task, status) {
  const edges = Array.isArray(task.edges) ? task.edges : [];
  if (edges.length === 0) return true;
  return edges.every((e) => {
    const pred = status(e.from);
    if (!pred) return true;
    switch (e.type) {
      case "SS": return pred.started || pred.done; // can start when predecessor starts
      case "FS":
      case "FF":
      case "SF":
      default:   return pred.done; // conservative finish-gate
    }
<<<<<<< HEAD
=======
  }

  // Planned mins & policy pass
  tasks = tasks.map(applyAdvisoryPlannedDefaults).map(applyAttendedDurationPolicy);

  // warnings
  const warnings = [];
  tasks.forEach((t, i) => {
    const hasTime = (t.duration_min && t.duration_min.value != null) || t.planned_min != null;
    const hasReadiness = !!t.readiness_signal;
    if (!hasTime && !hasReadiness) warnings.push({ i, msg: "No duration or readiness signal detected." });
>>>>>>> c06e7e9 (1.6.2)
  });
}

function useRuntime(tasks) {
  const [started, setStarted] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [running, setRunning] = useState([]); // {id, startedAt, endsAt, consumesDriver}
  const [doneIds, setDoneIds] = useState(new Set());
  const [completed, setCompleted] = useState([]); // {id, startedAt, finishedAt, consumesDriver}

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNowMs((n) => n + 1000), 1000);
    return () => clearInterval(t);
  }, [started]);

  useEffect(() => {
    if (!started || running.length === 0) return;
    const now = nowMs;
    const finishedIds = running
      .filter((r) => r.endsAt != null && r.endsAt <= now)
      .map((r) => r.id);
    if (finishedIds.length === 0) return;

    setRunning((prev) => {
      const justFinished = prev.filter((r) => finishedIds.includes(r.id));
      if (justFinished.length) {
        setCompleted((c) => [
          ...c,
          ...justFinished.map((r) => ({
            id: r.id,
            startedAt: r.startedAt,
            finishedAt: nowMs,
            consumesDriver: r.consumesDriver,
          })),
        ]);
      }
      return prev.filter((r) => !finishedIds.includes(r.id));
    });
    setDoneIds((prev) => new Set([...prev, ...finishedIds]));
  }, [nowMs, started, running]);

  const status = (id) => {
    const r = running.find((x) => x.id === id);
    return { started: !!r, done: doneIds.has(id) };
  };

  const driverBusy = running.some((r) => r.consumesDriver);

  const startTask = (task) => {
    const p = getPlannedMinutes(task);
    const endsAt = nowMs + minToMs(p);
    setRunning((prev) => [
      ...prev,
      { id: task.id, startedAt: nowMs, endsAt, consumesDriver: consumesDriver(task) },
    ]);
  };

  const finishTask = (taskId) => {
    setRunning((prev) => {
      const r = prev.find((x) => x.id === taskId);
      if (r) {
        setCompleted((c) => [
          ...c,
          { id: r.id, startedAt: r.startedAt, finishedAt: nowMs, consumesDriver: r.consumesDriver },
        ]);
      }
      return prev.filter((x) => x.id !== taskId);
    });
    setDoneIds((prev) => new Set(prev).add(taskId));
  };

  const reset = () => {
    setStarted(false);
    setNowMs(0);
    setRunning([]);
    setDoneIds(new Set());
    setCompleted([]);
  };

  const ready = [], blocked = [];
  const runningIds = new Set(running.map((r) => r.id));
  for (const t of tasks) {
    if (doneIds.has(t.id) || runningIds.has(t.id)) continue;
    const depsOK = depsSatisfied(t, (id) => ({
      started: runningIds.has(id),
      done: doneIds.has(id),
    }));
    if (!depsOK) { blocked.push(t); continue; }
    if (t.requires_driver && driverBusy) blocked.push(t);
    else ready.push(t);
  }

  return {
<<<<<<< HEAD
    started, setStarted, nowMs,
    running, doneIds, completed,
    driverBusy, ready, blocked,
    startTask, finishTask, reset
=======
    meal: { title, author: { name: author }, tasks, meta: { notes: [] } },
    warnings,
>>>>>>> c06e7e9 (1.6.2)
  };
}

// ----------------------------------------------------------------------
// Timeline (SVG) — zoomed preview (1m = 100px; 100px lanes; fixed NowLine)
// ----------------------------------------------------------------------
function Timeline({ tasks, running, ready = [], completed = [], doneIds, nowMs }) {
  const PX_PER_MIN = 100;
  const ROW_H = 100;
  const PADDING = 16;
  const PAST_MIN = 3;
  const FUTURE_MIN = 35;

  const lanes  = tasks.map((t, i) => ({ id: t.id, y: PADDING + i * ROW_H }));
  const height = PADDING * 2 + lanes.length * ROW_H;
  const width  = Math.max(960, (PAST_MIN + FUTURE_MIN) * PX_PER_MIN + 160);
  const MID    = Math.round(PAST_MIN * PX_PER_MIN) + 80;

  const byId  = new Map(tasks.map((t) => [t.id, t]));

  // RUNNING: x drifts left with elapsed, width = remaining, right edge stops at Now
  const runningBars = running
    .map((r) => {
      const t = byId.get(r.id);
      const lane = lanes.find((ln) => ln.id === r.id) || { y: 0 };
      const durMs     = getPlannedMinutes(t) * 60000;
      const elapsedMs = clamp(nowMs - r.startedAt, 0, durMs);
      const remainMs  = clamp(r.endsAt - nowMs, 0, durMs);
      const elapsedMin = elapsedMs / 60000;
      const remainMin  = remainMs / 60000;

      const x = MID - elapsedMin * PX_PER_MIN;       // left edge slides left
      const w = Math.max(0, remainMin * PX_PER_MIN); // right edge ≥ Now
      if (w <= 0) return null;

      return {
        id: r.id,
        x, y: lane.y + 8, w, h: ROW_H - 16,
        attended: !!t?.requires_driver,
        name: t?.name || "Task",
        leftMs: remainMs,
      };
    })
    .filter(Boolean);

  // GHOST: preview if started now
  const ghostBars = (ready || []).map((t) => {
    const pMin = getPlannedMinutes(t);
    const lane = lanes.find((ln) => ln.id === t.id) || { y: 0 };
    return {
      id: t.id,
      x: MID,
      y: lane.y + 22,
      w: Math.max(10, pMin * PX_PER_MIN),
      h: ROW_H - 44,
      attended: !!t.requires_driver,
      name: t.name || "Task",
    };
  });

  // DONE: right edge anchored to true finish time
  const doneBars = (completed || []).map((d) => {
    const t = byId.get(d.id);
    const durMin = getPlannedMinutes(t);
    const w = Math.max(10, durMin * PX_PER_MIN);
    const minutesSinceFinish = (nowMs - d.finishedAt) / 60000;
    const rightX = MID - minutesSinceFinish * PX_PER_MIN;
    const x = rightX - w;
    const lane = lanes.find((ln) => ln.id === d.id) || { y: 0 };
    return {
      id: d.id,
      x, y: lane.y + 8, w, h: ROW_H - 16,
      attended: !!t?.requires_driver,
      name: t?.name || "Task",
    };
  });

  // Axis ticks
  const ticks = [];
  for (let m = 0; m <= FUTURE_MIN; m += 1) {
    ticks.push({ x: MID + m * PX_PER_MIN, label: m % 5 === 0 ? `${m}m` : null, major: m % 5 === 0 });
  }
  const pastTicks = [];
  for (let m = 1; m <= PAST_MIN; m += 1) pastTicks.push({ x: MID - m * PX_PER_MIN });

  const fmt = (ms) => mmss(ms);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, overflowX: "auto", overflowY: "visible", maxWidth: 1600, marginInline: "auto" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Timeline (zoomed preview)</div>
      <svg width={width} height={height}>
        {/* Past shading */}
        <rect x={0} y={0} width={MID} height={height} fill="#fafafa" />

        {/* NowLine */}
        <line x1={MID} x2={MID} y1={0} y2={height} stroke="#ef4444" strokeWidth="3" />
        <text x={MID + 8} y={18} fontSize="14" fill="#ef4444">Now</text>

        {/* Future ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={0} y2={height} stroke={t.major ? "#e5e7eb" : "#f1f5f9"} strokeWidth={t.major ? 2 : 1} />
            {t.label && (
              <text x={t.x + 6} y={height - 8} fontSize="12" fill="#475569" style={{ fontWeight: 600 }}>
                {t.label}
              </text>
            )}
          </g>
        ))}

        {/* Past ticks */}
        {pastTicks.map((t, i) => (
          <line key={i} x1={t.x} x2={t.x} y1={0} y2={height} stroke="#f3f4f6" />
        ))}

        {/* Lane labels */}
        {tasks.map((t, i) => (
          <text key={t.id} x={12} y={PADDING + i * ROW_H + ROW_H * 0.55} fontSize="14" fill="#374151">
            {i + 1}. {t.name}
          </text>
        ))}

        {/* Ghost bars */}
        {ghostBars.map((b) => (
          <g key={`ghost_${b.id}`} opacity={0.55}>
            <rect
              x={b.x} y={b.y}
              width={b.w} height={b.h}
              rx="12" ry="12"
              fill="#fef3c7"
              stroke="#f59e0b"
              strokeDasharray="6 4"
              strokeWidth="2"
            />
            <text x={b.x + 10} y={b.y + b.h / 2 + 5} fontSize="14" fill="#92400e" style={{ fontStyle: "italic" }}>
              {b.attended ? "attended" : "unattended"} • {getPlannedMinutes({ ...byId.get(b.id) })}m
            </text>
          </g>
        ))}

        {/* Finished bars */}
        {doneBars.map((b) => (
          <g key={`done_${b.id}`} opacity={0.4}>
            <rect
              x={b.x} y={b.y}
              width={b.w} height={b.h}
              rx="12" ry="12"
              fill={b.attended ? "#bfdbfe" : "#d1fae5"}
              stroke="#cbd5e1"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Running bars */}
        {runningBars.map((b) => (
          <g key={b.id}>
            <rect
              x={b.x} y={b.y}
              width={b.w} height={b.h}
              rx="12" ry="12"
              fill={b.attended ? "#bfdbfe" : "#d1fae5"}
              stroke={b.attended ? "#60a5fa" : "#34d399"}
              strokeWidth="2"
            />
            <text x={b.x + 10} y={b.y + b.h / 2 + 5} fontSize="14" fill="#111827">
              {b.attended ? "attended" : "unattended"} • {fmt(b.leftMs)}
            </text>
          </g>
        ))}
      </svg>

      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
        Tip: finished bars anchor at their actual finish; ghost bars show where a ready task would land if started now.
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Small UI atoms
// ----------------------------------------------------------------------
const Chip = ({ children, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      border: "1px solid #ddd",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 14,
      marginRight: 8,
      marginBottom: 8,
      background: "#fff",
      ...style,
    }}
  >
    {children}
  </span>
);

const DURATION_PRESETS = [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60];
function DurationEditor({ duration, onChangeMinutes, disabled = false }) {
  let value = "";
  if (duration && "value" in duration && duration.value != null) value = String(duration.value);
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => {
        const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
        onChangeMinutes(v == null ? null : Math.max(1, v));
      }}
    >
      <option value="">—</option>
      {DURATION_PRESETS.map((m) => (
        <option key={m} value={m}>{m} min</option>
      ))}
    </select>
  );
}
<<<<<<< HEAD
function VerbEditor({ value, onChange }) {
  const options = ["free_text", ...CANONICAL.map((v) => v.name)];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((v) => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  );
=======

/* ============================ Runtime helpers ============================ */
function gateAllowsStart(task, byId, status) {
  const incoming = task.edges || [];
  for (const e of incoming) {
    const st = status[e.from] || "pending";
    if (e.type === "FS") {
      if (st !== "done") return false;
    } else if (e.type === "SS") {
      if (!(st === "running" || st === "done")) return false;
    } else {
      return false;
    }
  }
  return true;
>>>>>>> c06e7e9 (1.6.2)
}

// ----------------------------------------------------------------------
// Meals browser helpers
// ----------------------------------------------------------------------
function computeMealMinTime(meal) {
  return computeCriticalPathMin(meal.tasks || []);
}

// ----------------------------------------------------------------------
// App
// ----------------------------------------------------------------------
export default function App() {
<<<<<<< HEAD
  const MEALS = useMemo(() => ([
    { id: "pasta", title: "Quick Pasta with Garlic Oil", author: "Sample", data: MEAL_PASTA },
    { id: "roast", title: "Easy One-pan Roast Chicken and Vegetables", author: "Nicole Maquire", data: MEAL_ROAST },
    { id: "stew",  title: "Slow Beef Stew", author: "Sample", data: MEAL_STEW },
  ]), []);
=======
  // Base tables
  const [verbSynonyms, setVerbSynonyms] = useState(VERB_SYNONYMS_BASE);
  const [readinessTable, setReadinessTable] = useState(compileReadiness(READINESS_TABLE_BASE));
  const [packsInfo, setPacksInfo] = useState("none"); // "none" | "loaded"

  // Optional PACK loader (from /public/packs)
  useEffect(() => {
    let cancelled = false;
    async function loadPacks() {
      try {
        // fetch packs; if not found -> keep defaults
        const [verbsRes, readyRes] = await Promise.allSettled([
          fetch("/packs/verbs.en.json"),
          fetch("/packs/readiness.en.json"),
        ]);

        let mergedVerbs = [...VERB_SYNONYMS_BASE];
        let mergedReady = [...READINESS_TABLE_BASE];

        let anyLoaded = false;

        if (verbsRes.status === "fulfilled" && verbsRes.value.ok) {
          const data = await verbsRes.value.json(); // { synonyms: [{canon, patterns: [...]}, ...]}
          if (Array.isArray(data?.synonyms)) {
            mergedVerbs = mergedVerbs.concat(
              data.synonyms.filter(x => x && x.canon && Array.isArray(x.patterns))
            );
            anyLoaded = true;
          }
        }
        if (readyRes.status === "fulfilled" && readyRes.value.ok) {
          const data = await readyRes.value.json(); // { items: [{type,value,pattern}, ...]}
          if (Array.isArray(data?.items)) {
            mergedReady = mergedReady.concat(
              data.items.filter(x => x && x.type && x.value && x.pattern)
            );
            anyLoaded = true;
          }
        }

        if (!cancelled) {
          setVerbSynonyms(mergedVerbs);
          setReadinessTable(compileReadiness(mergedReady));
          setPacksInfo(anyLoaded ? "loaded" : "none");
        }
      } catch {
        if (!cancelled) setPacksInfo("none");
      }
    }
    loadPacks();
    return () => { cancelled = true; };
  }, []);

  const defaultSample = `Title: Easy One-pan Roast Chicken and Vegetables
Author: Nicole Maquire
>>>>>>> c06e7e9 (1.6.2)

  const [mealIdx, setMealIdx] = useState(0);
  const [state, setState] = useState(() => ({
    meal: { ...(MEALS[0].data || {}), title: MEALS[0].title, author: { name: MEALS[0].author } },
    warnings: [],
  }));

<<<<<<< HEAD
  // Serve-at input (15-min step)
  const [serveAt, setServeAt] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return now.toTimeString().slice(0, 5);
  });

  // Minutes from now → serveAt
  const windowMin = useMemo(() => {
    const now = new Date();
    const [hh, mm] = serveAt.split(":").map(Number);
    const serveTime = new Date(now);
    serveTime.setHours(hh, mm, 0, 0);
    const diff = (serveTime - now) / 60000;
    return Math.max(0, Math.round(diff));
  }, [serveAt]);

  // Correct minimum time using critical path
  const minBudget = useMemo(
    () => computeCriticalPathMin(state.meal.tasks),
    [state.meal.tasks]
  );
=======
  const [raw, setRaw] = useState(defaultSample);
  const [parse, setParse] = useState(() => buildMealMap(defaultSample, { verbSynonyms, readinessTable }));

  // runtime: per-task status: pending | running | done
  const [status, setStatus] = useState({});
  const [driverBusy, setDriverBusy] = useState(false);

  const tables = useMemo(() => ({ verbSynonyms, readinessTable }), [verbSynonyms, readinessTable]);

  const rebuild = (nextRaw) => {
    const p = buildMealMap(nextRaw ?? raw, tables);
    setParse(p);
    setStatus({});
    setDriverBusy(false);
  };

  // reparse when packs load
  useEffect(() => {
    setParse(buildMealMap(raw, tables));
    setStatus({});
    setDriverBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verbSynonyms, readinessTable]);

  const tasks = parse.meal.tasks;
  const byId = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);

  const running = tasks.filter(t => status[t.id] === "running");
  const done = tasks.filter(t => status[t.id] === "done");
  const canDoNow = tasks.filter(t => {
    if (status[t.id]) return false;
    if (t.requires_driver && driverBusy) return false;
    return gateAllowsStart(t, byId, status);
  });

  const startTask = (id) => {
    const t = byId[id];
    if (!t) return;
    if (t.requires_driver && driverBusy) return;
    if (!gateAllowsStart(t, byId, status)) return;
    setStatus(prev => ({ ...prev, [id]: "running" }));
    if (t.requires_driver) setDriverBusy(true);
  };
>>>>>>> c06e7e9 (1.6.2)

  const fits = minBudget <= windowMin;
  const earliestServe = useMemo(() => {
    const now = new Date();
    const when = new Date(now.getTime() + minToMs(minBudget));
    return when.toTimeString().slice(0, 5);
  }, [minBudget]);

  // runtime
  const rt = useRuntime(state.meal.tasks);

  // export json
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state.meal, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.meal.title.replace(/\s+/g, "_")}.mealmap.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load a meal from catalog
  const loadMeal = (idx) => {
    const m = MEALS[idx];
    setMealIdx(idx);
    setState({
      meal: { ...(m.data || {}), title: m.title, author: { name: m.author }, packs_meta: { synonyms: SYNONYMS } },
      warnings: [],
    });
    rt.reset();
  };

  // Filter helpers
  const [query, setQuery] = useState("");
  const [onlyFits, setOnlyFits] = useState(false);

  const cards = MEALS
    .map((m, idx) => {
      const meal = { ...(m.data || {}), title: m.title, author: { name: m.author } };
      const min = computeMealMinTime(meal);
      const card = { idx, title: m.title, author: m.author, min, tasks: (meal.tasks || []).length };
      card.fits = min <= windowMin;
      return card;
    })
    .filter((c) => (query ? c.title.toLowerCase().includes(query.toLowerCase()) : true))
    .filter((c) => (onlyFits ? c.fits : true));

  // Helper to explain why a task is blocked
  const byId = useMemo(() => new Map(state.meal.tasks.map((t) => [t.id, t])), [state.meal.tasks]);
  const runningIds = useMemo(() => new Set(rt.running.map((r) => r.id)), [rt.running]);
  const isStarted = (id) => runningIds.has(id) || rt.doneIds.has(id);
  const isDone = (id) => rt.doneIds.has(id);

  function reasonsForBlocked(task) {
    const reasons = [];
    const edges = Array.isArray(task.edges) ? task.edges : [];
    const unmet = edges
      .filter((e) => {
        if (!e || !byId.has(e.from)) return false;
        if (e.type === "SS") return !(isStarted(e.from));
        return !(isDone(e.from)); // FS / FF / SF wait for finish
      })
      .map((e) => byId.get(e.from)?.name || "previous step");

    if (unmet.length) reasons.push(`waiting on: ${unmet.join(", ")}`);
    if (task.requires_driver && rt.driverBusy) reasons.push("driver busy");
    return reasons.join("; ");
  }

  function isBlockedByFinish(task) {
    const edges = Array.isArray(task.edges) ? task.edges : [];
    for (const e of edges) {
      if (!e || !byId.has(e.from)) continue;
      if (e.type === "SS") continue;
      if (!rt.doneIds.has(e.from)) return true;
    }
    return false;
  }

  return (
<<<<<<< HEAD
    <div style={{ minHeight: "100vh", padding: 16, display: "grid", gap: 14 }}>
      {/* Top: Meals & Time Budget */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Meals browser */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Meals</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <input
              placeholder="Search by title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} />
              Only show meals that fit
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {cards.map((c) => (
              <div key={c.idx} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>by {c.author}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <Chip>Min time:{Math.round(c.min)}min</Chip>
                  <Chip style={{ background: c.fits ? "#e6ffed" : "#fff5f5" }}>
                    Fits:{c.fits ? "Yes" : "No"}
                  </Chip>
                  <Chip>Tasks:{c.tasks}</Chip>
                </div>
                <button onClick={() => loadMeal(c.idx)}>Load this meal</button>
              </div>
            ))}
          </div>
        </div>

        {/* Time Budget */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Time Budget</div>
          <div style={{ marginBottom: 8 }}>
            Need to serve at:&nbsp;
            <input type="time" step={900} value={serveAt} onChange={(e) => setServeAt(e.target.value)} />
          </div>
          <Chip>Minimum prep &amp; cook time:{Math.round(minBudget)}min</Chip>
          <Chip style={{ background: fits ? "#e6ffed" : "#fff5f5" }}>
            Fits your window:{fits ? "Yes" : "No"}
          </Chip>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 999, padding: "6px 12px", width: "fit-content", marginTop: 6 }}>
            Earliest serve if you start now: <b>{earliestServe}</b>
          </div>
        </div>
      </div>

      {/* ------------------------ Runtime preview ------------------------ */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          maxWidth: 1600,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>MealMap Runtime (preview)</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div><b>NowLine:</b> {mmss(rt.nowMs)} — <span style={{ opacity: 0.8 }}>{rt.driverBusy ? "driver busy" : "driver free"}</span></div>
            <button onClick={() => rt.setStarted(true)} disabled={rt.started}>Start run</button>
            <button onClick={rt.reset}>Reset</button>
          </div>
        </div>

        {/* Running */}
        <div style={{ marginTop: 8 }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Running</h3>
          {rt.running.length === 0 ? (
            <div>Nothing running.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rt.running.map((r) => {
                const t = state.meal.tasks.find((x) => x.id === r.id);
                const left = Math.max(0, r.endsAt - rt.nowMs);
                return (
                  <li key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <b>{t?.name}</b>{" "}
                      <span style={{ opacity: 0.8 }}>
                        ({t?.requires_driver ? "attended" : "unattended"}) ({mmss(left)} left)
                      </span>
                    </div>
                    <button onClick={() => rt.finishTask(r.id)}>Finish now</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Can do now */}
        <div style={{ marginTop: 10 }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Can do now</h3>
          {rt.ready.length === 0 ? (
            <div>
              No tasks are ready yet.
              {!rt.driverBusy && rt.running.length > 0 && (
                <span style={{ opacity: 0.7 }}>
                  {" "}Driver is free, but all next steps are waiting on predecessors (e.g., current boil).
                </span>
              )}
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rt.ready.map((t) => (
                <li key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <b>{t.name}</b>{" "}
                    <span style={{ opacity: 0.8 }}>— {t.requires_driver ? "attended" : "unattended"}</span>
                  </div>
                  <button onClick={() => rt.startTask(t)} disabled={t.requires_driver && rt.driverBusy}>Start</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Blocked */}
        <div style={{ marginTop: 10 }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Blocked</h3>
          {rt.blocked.length === 0 ? (
            <div>Nothing blocked.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rt.blocked.map((t) => (
                <li
                  key={t.id}
                  style={{
                    borderLeft: isBlockedByFinish(t) ? "3px solid #f59e0b" : "3px solid transparent",
                    paddingLeft: 8
                  }}
                >
                  <b>{t.name}</b>
                  <span style={{ opacity: 0.75, fontStyle: "italic", fontWeight: 400 }}>
                    {" — "}{reasonsForBlocked(t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Done */}
        <div style={{ marginTop: 10 }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Done</h3>
          {state.meal.tasks.filter((t) => rt.doneIds.has(t.id)).length === 0 ? (
            <div>Nothing completed yet.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {state.meal.tasks.filter((t) => rt.doneIds.has(t.id)).map((t) => (<li key={t.id}>{t.name}</li>))}
            </ul>
          )}
        </div>

        {/* SVG timeline */}
        <div style={{ marginTop: 14 }}>
          <Timeline
            tasks={state.meal.tasks}
            running={rt.running}
            ready={rt.ready}
            completed={rt.completed}
            doneIds={rt.doneIds}
            nowMs={rt.nowMs}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <button onClick={exportJson}>Export JSON</button>
=======
    <div style={{ minHeight: "100vh", display: "grid", gap: 16, padding: 16 }}>
      {/* Header / Packs status */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Parsed MealMap (stub)</h2>
        <span style={{
          fontSize: 12, padding: "4px 8px", borderRadius: 999,
          border: "1px solid #ddd", background: packsInfo === "loaded" ? "#ecfdf5" : "#f8fafc"
        }}>
          Packs: {packsInfo === "loaded" ? "loaded ✓" : "none (using defaults)"}
        </span>
        <button onClick={exportJson} style={{ marginLeft: "auto" }}>Export JSON</button>
      </div>

      {/* Input */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h3>Paste Recipe (Prose)</h3>
        <textarea
          style={{ width: "100%", minHeight: 260, resize: "vertical" }}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => rebuild(raw)}
          placeholder="Paste title/author and Instructions:"
        />
        <div style={{ fontSize: 12, color: "#555" }}>Tip: edit then click outside the box to re-parse.</div>
      </div>

      {/* Meta */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
        <div><b>Title:</b> {parse.meal.title}</div>
        <div><b>Author:</b> {parse.meal.author?.name}</div>
      </div>

      {/* Tasks */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
        <h3>Tasks</h3>
        <ol style={{ paddingLeft: 16 }}>
          {parse.meal.tasks.map((t, idx) => (
            <li key={t.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, margin: "8px 0" }}>
              <div><b>Step {idx + 1}:</b> {t.name}</div>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap" }}>
                <Chip>verb: <EditableVerb value={t.canonical_verb} onChange={(v) => updateVerb(t.id, v)} /></Chip>
                <Chip>driver: {t.requires_driver ? "attended" : (t.self_running_after_start ? "self-running after start" : "unattended")}</Chip>
                <Chip>
                  duration:&nbsp;
                  <DurationEditor
                    duration={t.duration_min}
                    onChangeMinutes={(mins) => updateDurationMinutes(t.id, mins)}
                  />
                </Chip>
                <Chip>planned: {t.planned_min ?? "—"} min</Chip>
                <Chip>readiness: {t.readiness_signal ? `${t.readiness_signal.type}:${t.readiness_signal.value}` : "—"}</Chip>
                <Chip>
                  deps:&nbsp;
                  {(t.edges||[]).length ? (t.edges||[]).map((e,i)=>(
                    <span key={i}>{e.from}:{e.type}{e.lag_min!=null?`(${e.lag_min}m)`:""}{i<(t.edges.length-1)?", ":""}</span>
                  )) : "—"}
                </Chip>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Warnings */}
      <div style={{ border: "1px solid #f3c98b", background: "#fff7ed", borderRadius: 8, padding: 8 }}>
        <h3>Warnings</h3>
        {parse.warnings.length === 0 ? (
          <div>No warnings for this stub parse.</div>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {parse.warnings.map((w, i) => (
              <li key={i}><b>Step {w.i + 1}:</b> {w.msg}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Mini runtime (NowLine) */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h3>Run (NowLine)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
            <h4>Can do now</h4>
            {(() => {
              const tasks = parse.meal.tasks;
              const running = tasks.filter(t => status[t.id] === "running");
              const byId = Object.fromEntries(tasks.map(t => [t.id, t]));
              const canDoNow = tasks.filter(t => !status[t.id] && gateAllowsStart(t, byId, status))
                .filter(t => !(t.requires_driver && driverBusy));
              return canDoNow.length === 0 ? <div>—</div> : (
                <ul style={{ paddingLeft: 16 }}>
                  {canDoNow.map(t => (
                    <li key={t.id} style={{ marginBottom: 6 }}>
                      {t.name} {t.requires_driver ? "(attended)" : "(driver free)"}
                      <div><button onClick={()=>startTask(t.id)} style={{ marginTop: 4 }}>Start</button></div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
            <h4>Running</h4>
            {(() => {
              const running = parse.meal.tasks.filter(t => status[t.id] === "running");
              return running.length === 0 ? <div>—</div> : (
                <ul style={{ paddingLeft: 16 }}>
                  {running.map(t => (
                    <li key={t.id} style={{ marginBottom: 6 }}>
                      {t.name} {t.requires_driver ? "(attended)" : "(driver free)"}
                      <div><button onClick={()=>finishTask(t.id)} style={{ marginTop: 4 }}>Finish now</button></div>
                    </li>
                  ))}
                </ul>
              );
            })()}
            <div style={{ marginTop: 8, fontSize: 12, color: driverBusy ? "#b91c1c" : "#166534" }}>
              Driver: {driverBusy ? "busy (one attended task running)" : "free"}
            </div>
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
            <h4>Done</h4>
            {(() => {
              const done = parse.meal.tasks.filter(t => status[t.id] === "done");
              return done.length === 0 ? <div>—</div> : (
                <ul style={{ paddingLeft: 16 }}>
                  {done.map(t => <li key={t.id}>{t.name}</li>)}
                </ul>
              );
            })()}
          </div>
>>>>>>> c06e7e9 (1.6.2)
        </div>
      </div>
    </div>
  );
}