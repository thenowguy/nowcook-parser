// @ts-nocheck
/* eslint-disable */
import React, { useState } from "react";

/** NowCook Parser Stub — v1.4.1 (anchored baseline)
 *  - Anchored sections for safe patching
 *  - Multi-action step splitting
 *  - Duration + readiness parsing
 *  - Attended-min-duration policy (≥ 1 min)
 *  - Ingredient normalization + binding
 *  - Producer→consumer dependency inference + sequential fallback
 *  - Plating collapse to a single step
 *  - Editable verb + duration (presets) in UI
 */

// ======================================================================
// ====== SECTION: Canon / Synonyms =====================================
// ======================================================================

const CANONICAL_VERBS = [
  // prep
  { name: "wash",  attention: "attended" },
  { name: "trim",  attention: "attended" },
  { name: "peel",  attention: "attended" },
  { name: "chop",  attention: "attended" },
  { name: "dice",  attention: "attended" },
  { name: "mince", attention: "attended" },
  { name: "slice", attention: "attended" },
  { name: "grate", attention: "attended" },

  // heat
  { name: "preheat_oven", attention: "unattended_after_start" },
  { name: "preheat_pan",  attention: "attended" },
  { name: "bring_to_boil",attention: "unattended_after_start" },
  { name: "boil",         attention: "unattended_after_start" },
  { name: "simmer",       attention: "unattended_after_start" },
  { name: "sauté",        attention: "attended" },
  { name: "sweat",        attention: "attended" },
  { name: "sear",         attention: "attended" },
  { name: "brown",        attention: "attended" },

  // pasta/risotto helpers
  { name: "toast_rice", attention: "attended" },
  { name: "deglaze_wine", attention: "attended" },
  { name: "emulsify_with_pasta_water", attention: "attended" },
  { name: "finish_with_butter_and_cheese", attention: "attended" },

  // oven
  { name: "roast", attention: "unattended_after_start" },
  { name: "roast_weight_based", attention: "unattended_after_start" },
  { name: "bake", attention: "unattended_after_start" },
  { name: "rest_meat", attention: "unattended_after_start" },

  // compositional
  { name: "arrange", attention: "attended" },
  { name: "season",  attention: "attended" },
  { name: "drizzle", attention: "attended" },
  { name: "toss",    attention: "attended" },
  { name: "stuff",   attention: "attended" },
  { name: "truss",   attention: "attended" },
  { name: "add",     attention: "attended" }, // “add water” family

  // finish
  { name: "plate",   attention: "attended" }
];

const VERB_SYNONYMS = [
  // stovetop heat
  { canon: "sweat", patterns: ["sweat", "soften without color", "soften without colour", "cook until translucent"] },
  { canon: "sauté", patterns: ["saute", "sauté", "fry lightly", "brown lightly", "cook over medium heat"] },
  { canon: "sear",  patterns: ["sear", "brown hard", "sear until browned"] },

  // liquid heat
  { canon: "bring_to_boil", patterns: ["bring to a boil", "bring to the boil", "bring up to a boil"] },
  { canon: "simmer", patterns: ["simmer", "gentle simmer", "vigorous simmer"] },
  { canon: "boil",   patterns: ["boil", "boil until tender", "boil rapidly"] },

  // pasta/risotto helpers
  { canon: "toast_rice", patterns: ["toast the rice", "stir until edges are translucent"] },
  { canon: "deglaze_wine", patterns: ["deglaze with wine", "add wine and deglaze", "add white wine; stir until absorbed", "add wine and stir"] },
  { canon: "emulsify_with_pasta_water", patterns: ["loosen with pasta water", "emulsify with pasta water", "toss with pasta water"] },
  { canon: "finish_with_butter_and_cheese", patterns: ["beat in butter and cheese", "mantecatura", "finish with butter and cheese"] },

  // oven lifecycle
  { canon: "preheat_oven", patterns: ["preheat the oven", "heat the oven"] },
  { canon: "roast_weight_based", patterns: ["roast per kg", "roast per pound", "roast for "] },
  { canon: "roast", patterns: ["roast ", "roast until", "place in the oven"] },
  { canon: "bake",  patterns: ["bake for", "bake until", "cook for a further", "cook for "] },
  { canon: "rest_meat", patterns: ["rest with the heat off", "allow to rest", "let rest", "leave to rest"] },
  { canon: "plate", patterns: ["serve", "plate", "dish up"] },

  // composition verbs
  { canon: "arrange", patterns: ["arrange the", "arrange potatoes around", "place the", "place in", "place on", "set on top of", "put the", "spread the"] },
  { canon: "season",  patterns: ["season with", "sprinkle with", "sprinkle over", "sprinkle the"] },
  { canon: "drizzle", patterns: ["drizzle with", "drizzle over", "pour lightly", "coat with oil", "toss with oil"] },
  { canon: "toss",    patterns: ["toss the", "shuffle the vegetables", "stir around", "turn the vegetables"] },
  { canon: "stuff",   patterns: ["stuff the", "fill cavity", "insert into the cavity", "stuff with"] },
  { canon: "truss",   patterns: ["truss the", "tie legs", "bind chicken"] },

  // add-water family
  { canon: "add", patterns: [
    "add the water", "slowly add the water", "add all the water",
    "add the water quickly", "pour the water over", "stir in the water",
    "mix in the water", "add water"
  ]}
];

// ======================================================================
// ====== /SECTION: Canon / Synonyms ====================================
// ======================================================================


// ======================================================================
// ====== SECTION: Durations & Readiness ================================
// ======================================================================

const DURATION_REGEX = [
  { kind: "minutes_range", re: /(\d+)\s*[-–—]\s*(\d+)\s*(?:min|minutes?)(?=[\s,.]|$)/i },
  { kind: "minutes",       re: /(\d+)\s*(?:min|minutes?)(?=[\s,.]|$)/i },
  { kind: "hours_range",   re: /(\d+)\s*[-–—]\s*(\d+)\s*hours?(?=[\s,.]|$)/i },
  { kind: "hours",         re: /(\d+)\s*hours?(?=[\s,.]|$)/i }
];
const EXTRA_DURATION_REGEX = [
  { kind: "minutes_at_least", re: /at least\s+(\d+)\s*minutes?/i }
];

const READINESS_TABLE = [
  { type: "color", value: "golden", re: /until\s+golden|deeply\s+golden|lightly\s+browned/i },
  { type: "char",  value: "charred_spots", re: /charred\s+spots/i },
  { type: "texture", value: "al_dente", re: /until\s+al\s*dente/i },
  { type: "texture", value: "tender", re: /until\s+(knife|fork)?-?\s*tender|until\s+soft/i },
  { type: "texture", value: "crisp_tender", re: /crisp-?tender/i },
  { type: "reduction", value: "reduced_by_half", re: /reduced\s+by\s+half/i },
  { type: "reduction", value: "reduced_by_third", re: /reduced\s+by\s+(?:a\s+)?third/i },
  { type: "viscosity", value: "nappe", re: /nappe|coats\s+the\s+back\s+of\s+a\s+spoon/i },
  { type: "activity", value: "bubbling", re: /bubbling/i },
  { type: "activity", value: "vigorous_simmer", re: /vigorous\s+simmer/i },
  { type: "structure", value: "set_at_center", re: /set\s+at\s+the\s+center|no\s+jiggle|springs\s+back/i },
  { type: "doneness", value: "juices_run_clear", re: /juices\s+run\s+clear/i },
  { type: "doneness", value: "no_pink", re: /no\s+pink/i },
  { type: "temperature", value: "internal_temp", re: /internal\s+temp\s+\d{2,3}°[cf]/i }
];

// ======================================================================
// ====== /SECTION: Durations & Readiness ===============================
// ======================================================================


// ======================================================================
// ====== SECTION: Helpers ==============================================
// ======================================================================

const uid = (() => { let i = 0; return (p = "t") => `${p}_${++i}`; })();
const trimLines = (txt) => txt.split(/\n+/).map((l) => l.trim()).filter(Boolean);
const COOK_VERBS = new Set(["bake", "boil", "simmer", "roast", "sauté", "sweat", "sear", "brown"]);

const STOP = new Set(["of","and","or","a","the","with","to","in","for","large","small","medium","fresh","dried","finely","roughly"]);
const singularize = (w) => w.replace(/ies$/,"y").replace(/s$/,"");
const tokenize = (s) =>
  s.toLowerCase()
   .replace(/[^a-z0-9\s]/g," ")
   .split(/\s+/)
   .filter(t => t && !STOP.has(t))
   .map(singularize);

const toDurationObj = (dur) =>
  !dur ? null :
  Object.prototype.hasOwnProperty.call(dur, "value") ? { value: dur.value } : { range: dur.range };

const isAdvisory = (s) => {
  const lower = s.toLowerCase();
  const hasCanonVerb = CANONICAL_VERBS.some(v => lower.includes(v.name.replace(/_/g, " ")));
  if (hasCanonVerb) return false;
  if (/more than one chicken|two chickens|2 chickens/.test(lower)) return true;
  if (/^(tip|chef.?s tip|note|make ahead|storage|substitutions|equipment|nutrition|serving suggestion|wine pairing)\s*:/.test(lower)) return true;
  if (/see note|see notes|see tip|see sidebar|see footnote/.test(lower)) return true;
  if (/^(if|when)\b/.test(lower)) return true;
  if (/optional\)?$/.test(lower)) return true;
  return false;
};

const findVerbHits = (text) => {
  const lower = text.toLowerCase();
  const hits = [];
  for (const { canon, patterns } of VERB_SYNONYMS) {
    for (const p of patterns) {
      const needle = p.toLowerCase();
      let from = 0;
      while (true) {
        const i = lower.indexOf(needle, from);
        if (i === -1) break;
        hits.push({ canon, idx: i, len: needle.length });
        from = i + needle.length;
      }
    }
  }
  hits.sort((a,b)=>a.idx-b.idx || b.len-a.len);
  const pruned = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.idx >= lastEnd) { pruned.push(h); lastEnd = h.idx + h.len; }
  }
  return pruned;
};

const splitIntoActions = (line) => {
  const coarse = line
    .split(/(?<=[.;])\s+/)
    .flatMap(s => s.split(/\s+(?:then|and then|after that|next)\s+/i))
    .map(s => s.trim())
    .filter(Boolean);

  const actions = [];
  for (const piece of coarse) {
    if (isAdvisory(piece)) continue;
    const hits = findVerbHits(piece);
    if (hits.length <= 1) {
      actions.push(piece);
    } else {
      for (let i = 0; i < hits.length; i++) {
        const start = hits[i].idx;
        const end = i + 1 < hits.length ? hits[i+1].idx : piece.length;
        const chunk = piece.slice(start, end).trim();
        if (chunk) actions.push(chunk);
      }
    }
  }
  return actions;
};

const findCanonVerb = (text) => {
  const lower = text.toLowerCase();
  let best = { canon: null, idx: Infinity };
  for (const { canon, patterns } of VERB_SYNONYMS) {
    for (const p of patterns) {
      const i = lower.indexOf(p.toLowerCase());
      if (i >= 0 && i < best.idx) best = { canon, idx: i };
    }
  }
  if (best.canon) return best.canon;
  const first = lower.split(/[ ,.;:]/)[0];
  if (CANONICAL_VERBS.some(v => v.name === first)) return first;
  return "free_text";
};

const parseDuration = (text) => {
  for (const { kind, re } of DURATION_REGEX) {
    const m = text.match(re);
    if (m) {
      if (kind.includes("range")) {
        const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        const toMin = kind.startsWith("hours") ? (x)=>x*60 : (x)=>x;
        return { range: [toMin(a), toMin(b)] };
      }
      const n = parseInt(m[1], 10);
      return kind.startsWith("hours") ? { value: n*60 } : { value: n };
    }
  }
  for (const { re } of EXTRA_DURATION_REGEX) {
    const m = text.match(re);
    if (m) return { value: parseInt(m[1], 10) };
  }
  return null;
};

const parseReadiness = (text) => {
  for (const r of READINESS_TABLE) if (r.re.test(text)) return { type: r.type, value: r.value };
  return null;
};

// Attended tasks must be ≥ 1 min; planned_min mirrors chosen duration unless absent
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
}

// ======================================================================
// ====== /SECTION: Helpers =============================================
// ======================================================================


// ======================================================================
// ====== SECTION: Ingredient Normalization & Binding ====================
// ======================================================================

const HEAD_ALIASES = {
  "olive oil": ["olive oil","oil"],
  "lemon juice": ["lemon juice","lemon"]
};

const normalizeIngredients = (block) => {
  const lines = (block || "").split(/\n+/).map(l => l.trim()).filter(Boolean);
  return lines.map((raw, idx) => {
    const tokens = tokenize(raw);
    const head = tokens.length ? tokens[tokens.length - 1] : raw.toLowerCase();
    const display = raw.toLowerCase();
    const aliasKey = Object.keys(HEAD_ALIASES).find(k => display.includes(k));
    const aliases = aliasKey ? HEAD_ALIASES[aliasKey] : [];
    return { id: `ing_${idx+1}`, display_name: raw, tokens, head, aliases };
  });
};

const VERB_WHITELIST = {
  season: ["salt","pepper","paprika","thyme","oregano","chili","chilli","herb","spice"],
  drizzle: ["oil","olive","olive oil","butter","juice","lemon","cream"],
  add:     ["water","stock","broth","cream","milk","wine","butter","oil"],
  toss:    ["vegetable","potato","onion","carrot","bean","greens","oil"],
  stuff:   ["lemon","herb","garlic"]
};
const MAX_MATCHES_PER_TASK = 4;

const PREP_VERBS = new Set(["chop","dice","mince","slice","grate","peel","trim"]);
const participle = (v) => ({
  chop:"chopped", dice:"diced", mince:"minced", slice:"sliced", grate:"grated",
  peel:"peeled", trim:"trimmed"
}[v] || `${v}ed`);

function bindIngredientsToTask(task, ingredients) {
  const lower = task.name.toLowerCase();
  const taskTokens = new Set(tokenize(task.name));
  const white = VERB_WHITELIST[task.canonical_verb] || null;

  const hits = [];
  for (const ing of ingredients) {
    const headHit =
      lower.includes(` ${ing.head} `) ||
      lower.endsWith(` ${ing.head}`) ||
      lower.startsWith(`${ing.head} `);

    const aliasHit = (ing.aliases || []).some(a => lower.includes(a));
    const overlap = [...taskTokens].filter(t => ing.tokens.includes(t)).length >= 2;
    const passesWhitelist = !white || white.some(w => lower.includes(w));

    if (passesWhitelist && (headHit || aliasHit || overlap)) {
      hits.push(ing.id);
      if (hits.length >= MAX_MATCHES_PER_TASK) break;
    }
  }

  let outputs = [];
  if (hits.length && PREP_VERBS.has(task.canonical_verb)) {
    outputs = hits.map(id => {
      const ing = ingredients.find(x => x.id === id);
      const head = ing?.head || "ingredient";
      return `${participle(task.canonical_verb)} ${head}`;
    });
  }

  return { ...task, inputs: hits, outputs };
}

// ======================================================================
// ====== /SECTION: Ingredient Normalization & Binding ===================
// ======================================================================


// ======================================================================
// ====== SECTION: Task Assembly, Segmentation & Notes ===================
// ======================================================================

const lineToTask = (text) => {
  const verb = findCanonVerb(text);
  const dur = parseDuration(text);
  const ready = parseReadiness(text);
  const vMeta = CANONICAL_VERBS.find((v) => v.name === verb);

  const base = {
    id: uid("task"),
    name: text.replace(/\.$/, ""),
    canonical_verb: verb,
    duration_min: toDurationObj(dur),
    planned_min: toDurationObj(dur)?.value ?? null,
    readiness_signal: ready,
    requires_driver: vMeta ? vMeta.attention === "attended" : true,
    self_running_after_start: vMeta ? vMeta.attention === "unattended_after_start" : false,
    inputs: [],
    outputs: []
  };
  return applyAttendedDurationPolicy(base);
};

function segmentRaw(raw) {
  const title  = (raw.match(/Title:\s*(.*)/i) || [])[1] || "Untitled";
  const author = (raw.match(/Author:\s*(.*)/i) || [])[1] || "Unknown";
  const ingBlock  = (raw.split(/Ingredients:/i)[1] || "").split(/Instructions:/i)[0] || "";
  const instrBlock= (raw.split(/Instructions:/i)[1] || "").trim();

  const ingredients = normalizeIngredients(ingBlock);
  const rawLines = trimLines(instrBlock).map(l => l.replace(/^\d+\.\s*|^-+\s*/,"").trim());

  const notes = [];
  const actionLines = [];
  for (const line of rawLines) {
    const chunks = splitIntoActions(line);
    if (chunks.length === 0) {
      if (isAdvisory(line)) notes.push(line);
      else actionLines.push(line);
    } else {
      actionLines.push(...chunks);
    }
  }
  return { title, author, ingredients, actionLines, notes };
}

// ======================================================================
// ====== /SECTION: Task Assembly, Segmentation & Notes ==================
// ======================================================================


// ======================================================================
// ====== SECTION: Plating Collapse ======================================
// ======================================================================

const PLATE_LIKE = new Set(["plate","serve","drizzle","garnish","sprinkle","ladle","spoon"]);
function collapsePlating(tasks) {
  if (!tasks.length) return tasks;
  let i = tasks.length - 1;
  while (i>=0 && PLATE_LIKE.has(tasks[i].canonical_verb)) i--;
  if (i === tasks.length - 1) return tasks;

  const head = tasks.slice(0, i+1);
  const plateTask = applyAttendedDurationPolicy({
    id: uid("task"),
    name: "Plate and finish",
    canonical_verb: "plate",
    duration_min: { value: 5 },
    planned_min: 5,
    readiness_signal: null,
    requires_driver: true,
    self_running_after_start: false,
    inputs: [],
    outputs: []
  });
  return [...head, plateTask];
}

// ======================================================================
// ====== /SECTION: Plating Collapse =====================================
// ======================================================================


// ======================================================================
// ====== SECTION: Dependency Builder ====================================
// ======================================================================

const SEQUENTIAL_FALLBACK = true;

function buildDependencies(tasks) {
  const producersByIng = {};

  tasks.forEach((t) => {
    if (PREP_VERBS.has(t.canonical_verb) && Array.isArray(t.inputs)) {
      for (const ingId of t.inputs) {
        if (!producersByIng[ingId]) producersByIng[ingId] = [];
        producersByIng[ingId].push(t.id);
      }
    }
  });

  const withDeps = tasks.map((t, idx) => {
    const deps = new Set();

    if (Array.isArray(t.inputs)) {
      for (const ingId of t.inputs) {
        const prodList = producersByIng[ingId] || [];
        for (const prodId of prodList) {
          const prodIndex = tasks.findIndex(x => x.id === prodId);
          if (prodIndex >= 0 && prodIndex < idx && prodId !== t.id) deps.add(prodId);
        }
      }
    }

    if (SEQUENTIAL_FALLBACK && deps.size === 0 && idx > 0) {
      deps.add(tasks[idx - 1].id);
    }

    const obj = { ...t };
    if (deps.size) obj.depends_on = Array.from(deps);
    obj.depends_seq = [idx > 0 ? tasks[idx - 1].id : null].filter(Boolean);
    return obj;
  });

  return withDeps.map(t => {
    if (!t.depends_on) return t;
    return { ...t, depends_on: t.depends_on.filter((id) => id !== t.id) };
  });
}

// ======================================================================
// ====== /SECTION: Dependency Builder ===================================
// ======================================================================


// ======================================================================
// ====== SECTION: Builder (buildMealMap) =================================
// ======================================================================

function buildMealMap(raw) {
  const seg = segmentRaw(raw);

  // lines → tasks
  let tasks0 = seg.actionLines.map(lineToTask);

  // ingredient binding
  tasks0 = tasks0.map(t => bindIngredientsToTask(t, seg.ingredients));

  // policy pass (ensure attended ≥1m)
  tasks0 = tasks0.map(applyAttendedDurationPolicy);

  // build dependencies (ingredient-driven + seq fallback)
  const withDeps = buildDependencies(tasks0);

  // collapse plating into single step
  const tasks = collapsePlating(withDeps);

  // final warnings (only for real cooking verbs)
  const warnings = [];
  tasks.forEach((t, i) => {
    if (t.canonical_verb === "free_text") warnings.push({ i, msg: "Unmapped verb (free_text)." });
    if (COOK_VERBS.has(t.canonical_verb) && !t.duration_min && !t.readiness_signal) {
      warnings.push({ i, msg: "No duration or readiness signal detected." });
    }
  });

  return {
    meal: {
      schema_version: "1.4.1",
      meal: { id: `meal_${Date.now()}`, title: seg.title, author: { name: seg.author } },
      ingredients_catalog: seg.ingredients.map(({id, display_name}) => ({ id, display_name })),
      tasks,
      meta: { notes: seg.notes }
    },
    warnings
  };
}

// ======================================================================
// ====== /SECTION: Builder (buildMealMap) ===============================
// ======================================================================


// ======================================================================
// ====== SECTION: UI Helpers (Chip, Editors) ============================
// ======================================================================

const Chip = ({ children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    border: "1px solid #ccc", borderRadius: 999,
    padding: "2px 8px", fontSize: 12, marginRight: 6, marginBottom: 6
  }}>{children}</span>
);

const EditableVerb = ({ value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}>
    {["free_text", ...CANONICAL_VERBS.map(v => v.name)].map(v =>
      <option key={v} value={v}>{v}</option>
    )}
  </select>
);

const DURATION_PRESETS = [1,2,3,5,8,10,12,15,20,25,30,40,45,50,60];
function DurationEditor({ duration, onChangeMinutes, disabled=false }) {
  let value = "";
  if (duration && "value" in duration) value = String(duration.value);
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => {
        const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
        onChangeMinutes(v === null ? null : Math.max(1, v));
      }}
    >
      <option value="">—</option>
      {DURATION_PRESETS.map((m) => (
        <option key={m} value={m}>{m} min</option>
      ))}
    </select>
  );
}

// ======================================================================
// ====== /SECTION: UI Helpers (Chip, Editors) ===========================
// ======================================================================


// ======================================================================
// ====== SECTION: App (UI + React) ======================================
// ======================================================================

export default function App() {
  const defaultSample = `Title: Easy One-pan Roast Chicken and Vegetables
Author: Nicole Maquire

Ingredients:
- 1 chicken
- 1 red onion
- 3 potatoes
- 1 lemon
- paprika
- thyme
- salt
- pepper
- olive oil
- water

Instructions:
1. Preheat the oven to 200°C (400°F) (180°C/350°F fan-forced).
2. Place the carrot and red onion in the centre of a large baking dish or roasting pan. Arrange the potatoes around the outside of the dish.
3. Place the chicken on top of the carrot and onion.
4. Sprinkle the chicken and vegetables with the chicken stock powder, salt, paprika, thyme and pepper.
5. Drizzle with olive oil and use your hands to coat the chicken and vegetables evenly. Stuff the lemon slices into the cavity of the chicken. You can truss the chicken at this point if you wish (optional, see note 1)
6. Bake for 45 minutes, then add the water. Use a spatula to shuffle the vegetables around the chicken gently so they are not sticking to the base of the pan
7. Cook for a further 45 minutes. Allow the chicken and vegetables to rest with the heat off for at least 15 minutes (this is what ensures the chicken is soft and juicy).
8. Plate and finish.`;

  const [raw, setRaw] = useState(defaultSample);
  const [state, setState] = useState(() => buildMealMap(defaultSample));

  const rebuild = (nextRaw) => setState(buildMealMap(nextRaw ?? raw));

  // immutable updates (clone → replace)
  const updateVerb = (taskId, newVerb) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const idx = next.meal.tasks.findIndex((x) => x.id === taskId);
      if (idx >= 0) {
        const old = next.meal.tasks[idx];
        const vMeta = CANONICAL_VERBS.find(v => v.name === newVerb);
        const updated = applyAttendedDurationPolicy({
          ...old,
          canonical_verb: newVerb,
          requires_driver: vMeta ? vMeta.attention === "attended" : old.requires_driver,
          self_running_after_start: vMeta ? vMeta.attention === "unattended_after_start" : old.self_running_after_start,
        });
        next.meal.tasks = [
          ...next.meal.tasks.slice(0, idx),
          updated,
          ...next.meal.tasks.slice(idx + 1),
        ];
      }
      return next;
    });
  };

  const updateDurationMinutes = (taskId, minutes) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const idx = next.meal.tasks.findIndex((x) => x.id === taskId);
      if (idx >= 0) {
        const old = next.meal.tasks[idx];
        const updated = minutes == null
          ? { ...old, duration_min: null, planned_min: null }
          : { ...old, duration_min: { value: Math.max(1, minutes) }, planned_min: Math.max(1, minutes) };
        next.meal.tasks = [
          ...next.meal.tasks.slice(0, idx),
          applyAttendedDurationPolicy(updated),
          ...next.meal.tasks.slice(idx + 1),
        ];
      }
      return next;
    });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state.meal, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${state.meal.meal.title.replace(/\s+/g, "_")}.mealmap.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr", gap: 16, padding: 16 }}>
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <h2>Paste Recipe (Prose)</h2>
        <textarea
          style={{ width: "100%", minHeight: 360, resize: "vertical" }}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => rebuild(raw)}
          placeholder="Paste title/author, Ingredients:, Instructions:"
        />
        <div style={{ fontSize: 12, color: "#555" }}>Tip: edit then click outside the box to re-parse.</div>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Parsed MealMap (stub)</h2>
          <button onClick={exportJson}>Export JSON</button>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, margin: "12px 0" }}>
          <div><b>Title:</b> {state.meal.meal.title}</div>
          <div><b>Author:</b> {state.meal.meal.author?.name}</div>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8, margin: "12px 0" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            <b>Legend:</b> <i>depends_on (ingredient)</i> = must wait for a prep step that produces an input.
            <i> depends_seq (order)</i> = simple previous-step fallback when no ingredient link is detected.
          </div>
          <h3>Tasks</h3>
          <ol style={{ paddingLeft: 16 }}>
            {state.meal.tasks.map((t, idx) => (
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
                  {t.inputs?.length ? <Chip>inputs: {t.inputs.join(", ")}</Chip> : null}
                  {t.outputs?.length ? <Chip>outputs: {t.outputs.join(", ")}</Chip> : null}
                  {t.depends_on?.length ? <Chip>depends_on (ingredient): {t.depends_on.join(", ")}</Chip> : <Chip>depends_on (ingredient): —</Chip>}
                  {t.depends_seq?.length ? <Chip>depends_seq (order): {t.depends_seq.join(", ")}</Chip> : <Chip>depends_seq (order): —</Chip>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div style={{ border: "1px solid #f3c98b", background: "#fff7ed", borderRadius: 8, padding: 8 }}>
          <h3>Warnings</h3>
          {state.warnings.length === 0 ? (
            <div>No warnings for this stub parse.</div>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {state.warnings.map((w, i) => (
                <li key={i}><b>Step {w.i + 1}:</b> {w.msg}</li>
              ))}
            </ul>
          )}
        </div>

        <details style={{ marginTop: 12 }}>
          <summary>Show raw JSON</summary>
          <pre style={{ maxHeight: 280, overflow: "auto", background: "#f9fafb", padding: 8, borderRadius: 8 }}>
            {JSON.stringify(state.meal, null, 2)}
          </pre>
        </details>

        <details style={{ marginTop: 12 }}>
          <summary>Notes captured (advisories kept out of tasks)</summary>
          <pre style={{ maxHeight: 200, overflow: "auto", background: "#f1f5f9", padding: 8, borderRadius: 8 }}>
            {JSON.stringify(state.meal.meta?.notes ?? [], null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

// ======================================================================
// ====== /SECTION: App (UI + React) =====================================
// ======================================================================