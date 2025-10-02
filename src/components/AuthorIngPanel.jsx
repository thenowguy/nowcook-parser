/* AuthoringPanel.jsx — v1.6.16 (Stabilized notes/badges)
   - Restores clean split between imperative step vs. chef note.
   - Concurrency cues ("Meanwhile…", "While that's…") become badges, NOT notes.
   - Conservative action splitting: only split when BOTH sides look imperative.
   - Keeps: URL/HTML import, rounding toggle, ontology toggle (bridged), packs, defaults.

   IMPORTANT: This is a full drop-in. No other files need edits.
*/
/* eslint-disable */
import React, { useMemo, useState } from "react";

import { ingestFromUrlOrHtml } from "../ingestion/url_or_text";
import { getPacks } from "../ingestion/packs_bridge";
import { upgradeTasksWithOntology } from "../ingestion/ontology_bridge"; // safe no-op if ontology off

// Packs (same as app)
import VERB_PACK from "../packs/verbs.en.json";
import DURATIONS_PACK from "../packs/durations.en.json";

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

// -------- durations / defaults ---------------------------------------------
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
const DEFAULTS_BY_VERB = Object.fromEntries(extractDurationEntries(DURATIONS_PACK));

const findVerbFromPack = (text) => {
  for (const v of CANONICAL) for (const re of v.patterns) if (re.test(text)) return v;
  return null;
};

const CANON_BY_NAME = new Map(CANONICAL.map((v) => [String(v.name).toLowerCase(), v]));
const HEUR_RULES = [
  { re: /\b(sauté|saute|brown|cook\s+(?:until|till)\s+(?:soft|softened|translucent))\b/i, canon: "sauté" },
  { re: /\b(stir|mix|combine|whisk)\b/i, canon: "stir" },
  { re: /\b(add|stir\s+in|fold\s+in|pour\s+in)\b/i, canon: "add" },
  { re: /\b(bring .* to a boil|boil)\b/i, canon: "boil" },
  { re: /\b(simmer|reduce heat(?: to (?:low|medium-low))?)\b/i, canon: "simmer" },
  { re: /\b(season(?:\s+to\s+taste)?)\b/i, canon: "season" },
  { re: /\b(drain|strain)\b/i, canon: "drain" },
  { re: /\b(serve|plate)\b/i, canon: "plate" },
  { re: /\b(slice|chop|mince|dice)\b/i, canon: "slice" },
  { re: /\b(preheat)\b/i, canon: "preheat" },
  { re: /\b(bake|roast)\b/i, canon: "bake" },
];
function guessVerbHeuristic(text) {
  if (!text) return null;
  for (const r of HEUR_RULES) {
    if (r.re.test(text)) {
      const v = CANON_BY_NAME.get(r.canon.toLowerCase());
      if (v) return v;
    }
  }
  return null;
}
function findVerbSmart(text) {
  return findVerbFromPack(text) || guessVerbHeuristic(text);
}

// -------- small utils -------------------------------------------------------
const toDurationObj = (min) => (min == null ? null : { value: min });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function parseDurationMin(input) {
  if (!input) return null;
  const s = String(input).toLowerCase().replace(/[–—]/g, "-");
  const range = s.match(
    /(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:-|to)\s*(\d{1,4})\s*(?:m(?:in(?:ute)?s?)?)\b/
  );
  if (range) {
    const hi = parseInt(range[2], 10);
    return clamp(isNaN(hi) ? 0 : hi, 1, 24 * 60);
  }
  const single = s.match(
    /(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:m(?:in(?:ute)?s?)?)\b/
  );
  if (single) {
    const v = parseInt(single[1], 10);
    return clamp(isNaN(v) ? 0 : v, 1, 24 * 60);
  }
  return null;
}

// ---------------- Phase 1.1 baseline filters --------------------------------
function normalizeText(s) {
  return s
    .replace(/\u2013|\u2014/g, "—")
    .replace(/\u2022|\u25CF|\u2219|\*/g, "•")
    .replace(/\s+/g, " ")
    .trim();
}
function stripStepPrefix(s) {
  return s.replace(/^\s*step\s*\d+\s*[:.\-\u2013\u2014]\s*/i, "");
}
// Append "— X min" if phrasing gives a time but no suffix yet
function coerceDurationSuffix(s) {
  let line = s, min = null;
  const hr = line.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  const mn = line.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/i);
  if (hr) min = Math.round(parseFloat(hr[1]) * 60);
  if (mn) min = (min ?? 0) + Math.round(parseFloat(mn[1]));
  if (min && !/—\s*\d+\s*min/i.test(line)) line = `${line} — ${min} min`;
  return line;
}
const SECTION_START_ING = /^(ingredients?|what you need)\b/i;
const SECTION_START_DIRS = /^(directions?|method|instructions?)\b/i;
const UNIT = "(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|g|gram|grams|kg|ml|l|liters?|pounds?|lbs?|cloves?|sticks?|slices?|dash|pinch|sprigs?|leaves?)";
const AMOUNT = "(?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
const ING_LIKE_RE = new RegExp(`^(?:•\\s*)?(?:${AMOUNT}\\s*(?:${UNIT})\\b|\\d+\\s*(?:${UNIT})\\b)`, "i");
const META_SKIP_RE = /^\s*(author:|serves?\b|yield\b|prep time\b|cook time\b|total time\b|notes?:?)\s*/i;

// Fractions + measurement parens
const FRACTION_MAP = {"¼":"1/4","½":"1/2","¾":"3/4","⅐":"1/7","⅑":"1/9","⅒":"1/10","⅓":"1/3","⅔":"2/3","⅕":"1/5","⅖":"2/5","⅗":"3/5","⅘":"4/5","⅙":"1/6","⅚":"5/6","⅛":"1/8","⅜":"3/8","⅝":"5/8","⅞":"7/8"};
function normalizeFractions(s){return s.replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g,(m)=>FRACTION_MAP[m]||m);}
const UNIT_WORDS="(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|g|gram|grams|kg|ml|l|liter|liters|pound|pounds|lb|lbs)";
function stripMeasurementParens(s){
  return s.replace(/\(([^)]*)\)/g,(m,inside)=>{
    const t=inside.trim();
    if(/^\s*(?:about|around|approx\.?)?\s*\d+(?:\/\d+)?\s*(?:-?\s*\d+(?:\/\d+)?)?\s*/i.test(t) && new RegExp(UNIT_WORDS,"i").test(t)) {
      return "";
    }
    return m;
  });
}
function cleanLine(line){
  return normalizeFractions(
    stripMeasurementParens(
      line
        .replace(/^ingredients[:]?$/i,"")
        .replace(/^For the .*?:\s*/i,"")
        .replace(/^Step\s*\d+[:.]?\s*/i,"")
        .replace(/^[-*]?\s*Note[:.]?\s*/i,"Note: ") // keep but label clearly
    )
  ).trim();
}
function prefilterLines(rawText){
  const src = rawText.split(/\r?\n/);
  let inIngredients=false, seenDirections=false;
  const out=[];
  for(let raw of src){
    let line = normalizeText(raw);
    if(!line) continue;
    if(META_SKIP_RE.test(line)) continue;
    if(SECTION_START_ING.test(line)){inIngredients=true; continue;}
    if(SECTION_START_DIRS.test(line)){inIngredients=false; seenDirections=true; continue;}
    if(inIngredients || (!seenDirections && ING_LIKE_RE.test(line))) continue;
    if(/^•\s+/.test(line) && ING_LIKE_RE.test(line)) continue;
    line = stripStepPrefix(line);
    line = coerceDurationSuffix(line);
    if(!line || /^step\s*\d+\s*$/i.test(line)) continue;
    line = cleanLine(line);
    out.push(line);
  }
  return out.length ? out : src.map((l)=>l.trim()).filter(Boolean);
}

// ---------------- Notes / Badges (restored) ---------------------------------
const NOTE_TAIL_RE = new RegExp(
  [
    "(?:^|[,;\\-–—]\\s*)(?:be\\s+careful[^.]*|avoid[^.]*|don’t\\s+[^.]*|do\\s+not\\s+[^.]*|never\\s+[^.]*|",
    "if\\s+(?:it|the|they|you)[^.,;]*|if\\s+using[^.,;]*|as\\s+needed[^.,;]*|to\\s+taste[^.,;]*|for\\s+best\\s+results[^.,;]*|",
    "optionally[^.,;]*|optional[^.,;]*|tip:.*)$"
  ].join(""),
  "i"
);
const NOTE_PREFIX_RE = /^\s*Note:\s*(.+)$/i;

const CONCURRENCY_PREFIX = /^\s*(?:meanwhile|in the meantime|while that(?:'| i)s|while that is|while that’s|as .* cooks,)\s*/i;

// Imperative detector for conservative splitting
const IMPERATIVE_HEAD = /^(?:add|stir|mix|combine|whisk|sauté|saute|cook|boil|simmer|reduce|season|drain|strain|serve|plate|slice|chop|mince|dice|preheat|bake|roast|heat|melt|bring|cover|uncover|remove|reserve|grate|peel|crack|beat|fold|pour)\b/i;

function splitActionAndNoteOrBadge(line) {
  let badges = [];

  // 1) Concurrency: pull leading cue into a badge, but keep the action intact.
  if (CONCURRENCY_PREFIX.test(line)) {
    line = line.replace(CONCURRENCY_PREFIX, "").trim();
    if (line) badges.push("meanwhile");
  }

  // 2) Explicit "Note:" lines become note rows.
  const mPrefix = line.match(NOTE_PREFIX_RE);
  if (mPrefix) {
    return { action: "", note: mPrefix[1].trim(), badges };
  }

  // 3) Advisory tail at the end → note
  let action = line, note = "";
  const mTail = line.match(NOTE_TAIL_RE);
  if (mTail) {
    const idx = line.toLowerCase().lastIndexOf(mTail[0].trim().toLowerCase());
    if (idx > 0) {
      action = line.slice(0, idx).replace(/[;,.\s]+$/,"").trim();
      note = line.slice(idx).replace(/^[,;\s–—-]+\s*/,"").trim();
    }
  }

  // 4) Conservative action splitter: only if BOTH sides look imperative.
  // This collapses the previous "explode everything".
  // e.g., "Add the wine; stir" → keep as one? or split? We'll keep as one for now unless very clear.
  // Keep it calm: do NOT split on semicolons by default.
  // But we will split on "then/and then" only if both halves are imperative.
  const thenSplit = action.split(/\s+(?:and\s+then|then)\s+/i);
  if (thenSplit.length === 2) {
    const [a, b] = thenSplit.map((s) => s.trim());
    if (IMPERATIVE_HEAD.test(a) && IMPERATIVE_HEAD.test(b)) {
      // Merge with semicolon for preview (single row); ontology can split later if desired.
      action = `${a}; ${b}`;
    }
  }

  return { action: action.trim(), note: (note||"").trim(), badges };
}

// ---------------- Phase 1.5 (dialed-down) -----------------------------------
function explodeActionsConservative(lines) {
  // Do NOT over-split. Only return the same lines; minor post-process happens in splitActionAndNoteOrBadge.
  return lines.slice();
}

// ---------------------------------------------------------------------------
export default function AuthoringPanel({ onLoadMeal }) {
  const [text, setText] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");
  const [autoDeps, setAutoDeps] = useState(true);
  const [roundAbout, setRoundAbout] = useState(true);
  const [useOntology, setUseOntology] = useState(false);
  const [preview, setPreview] = useState([]);

  const rows = useMemo(() => {
    const base = prefilterLines(text);
    return explodeActionsConservative(base);
  }, [text]);

  async function importFromUrlOrHtml() {
    const packs = await getPacks();
    const draft = await ingestFromUrlOrHtml(text, packs);
    setText(draft);
  }

  function buildTasks() {
    const tasks = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const raw = rows[idx];
      const cleaned = cleanLine(raw);
      const { action, note, badges } = splitActionAndNoteOrBadge(cleaned);

      if (note && !action) {
        // pure note row
        tasks.push({
          id: `draft_${tasks.length + 1}`,
          name: note,
          is_note: true,
          badges: [],
        });
        continue;
      }

      if (!action) continue;

      const vMeta = findVerbSmart(action);
      let verb = vMeta?.name || "free_text";
      let durMin = parseDurationMin(action);

      // rounding for "~ about around"
      if (roundAbout && /(?:~|about|approx|approximately|around)\s*\d+\s*(?:m|min|minute)/i.test(action)) {
        if (durMin != null) durMin = Math.ceil(durMin); // round up
      }

      const planned_min = durMin ?? vMeta?.default_planned ?? DEFAULTS_BY_VERB[verb] ?? null;

      tasks.push({
        id: `draft_${tasks.length + 1}`,
        name: action.replace(/\s*—\s*\d+\s*min(?:utes?)?$/i, ""),
        canonical_verb: verb,
        duration_min: toDurationObj(durMin),
        planned_min,
        requires_driver: vMeta ? vMeta.attention === "attended" : true,
        self_running_after_start: vMeta ? vMeta.attention === "unattended_after_start" : false,
        inputs: [],
        outputs: [],
        edges: [],
        badges: badges || [],
      });

      if (note) {
        tasks.push({
          id: `draft_${tasks.length + 1}`,
          name: note,
          is_note: true,
          badges: [],
        });
      }
    }

    if (autoDeps) {
      for (let i = 1; i < tasks.length; i++) {
        tasks[i].edges = tasks[i].edges || [];
        tasks[i].edges.push({ from: tasks[i - 1].id, type: "FS" });
      }
    }

    return tasks;
  }

  async function parseLines() {
    let tasks = buildTasks();
    if (useOntology) {
      try {
        tasks = await upgradeTasksWithOntology(tasks);
      } catch (_) {
        // keep tasks as-is on any ontology error
      }
    }
    setPreview(tasks);
  }

  function loadAsMeal() {
    if (preview.length === 0) parseLines();
    const meal = {
      title: title || "Untitled Meal",
      author: { name: "Draft" },
      tasks: preview.length ? preview : [],
      packs_meta: {},
    };
    onLoadMeal?.(meal);
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#ffe7b3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.6.16)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={parseLines}>Parse → Draft</button>
          <button onClick={loadAsMeal}>Load into Preview</button>
        </div>
      </div>

      {/* TOP ROW */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 12,
          alignItems: "start",
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        {/* Left: textarea */}
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='One step per line… or paste a URL/HTML, then click “Import from URL/HTML”.'
            style={{
              width: "100%",
              minHeight: 190,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "10px 12px",
              boxSizing: "border-box",
              resize: "vertical",
              background: "#fff",
            }}
          />
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Recipe text (one step per line) — or paste a URL/HTML, and click “Import from URL/HTML”.
          </div>
        </div>

        {/* Right: title + tip + actions */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Meal title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Quick Pasta with Garlic Oil"
            style={{
              width: "100%",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 8,
              boxSizing: "border-box",
              background: "#fff",
            }}
          />
          <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.5, marginBottom: 10 }}>
            Tip: durations like “— 3 min” are optional — packs provide sensible defaults per verb.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={autoDeps}
                onChange={(e) => setAutoDeps(e.target.checked)}
              />
              Auto-create sequential dependencies (FS)
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={roundAbout}
                onChange={(e) => setRoundAbout(e.target.checked)}
              />
              Round “about/approx/range” durations up
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={useOntology}
                onChange={(e) => setUseOntology(e.target.checked)}
              />
              (Experimental) Upgrade verbs via ontology
            </label>

            <button onClick={importFromUrlOrHtml}>Import from URL/HTML</button>
          </div>
        </div>
      </div>

      {/* Preview table */}
      <div style={{ fontWeight: 700, marginTop: 8, marginBottom: 6 }}>Preview</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.6)" }}>
              <th style={th}>#</th>
              <th style={th}>Step</th>
              <th style={th}>Verb</th>
              <th style={th}>Planned (min)</th>
              <th style={th}>Attention</th>
              <th style={th}>Depends on</th>
            </tr>
          </thead>
          <tbody>
            {(preview.length ? preview : rows.map((line, i) => ({ name: line, _row: i })) ).map((t, i) => {
              const idx = i + 1;

              // NOTE ROW RENDER
              if (t.is_note) {
                return (
                  <tr key={idx} style={{ background: i % 2 ? "rgba(255,255,255,0.45)" : "transparent" }}>
                    <td style={td}>{idx}</td>
                    <td style={{ ...td, paddingLeft: 28, position: "relative" }}>
                      <span
                        style={{
                          position: "absolute",
                          left: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 12,
                        }}
                        title="Chef’s note"
                      >
                        🗒️
                      </span>
                      <div
                        style={{
                          background: "#eef6ff",
                          borderLeft: "3px solid #60a5fa",
                          padding: "6px 10px",
                          borderRadius: 6,
                          display: "inline-block",
                          maxWidth: "100%",
                        }}
                      >
                        <em style={{ opacity: 0.85 }}>{t.name}</em>
                      </div>
                    </td>
                    <td style={td}>note</td>
                    <td style={td}>—</td>
                    <td style={td}>—</td>
                    <td style={td}>—</td>
                  </tr>
                );
              }

              // Normal task row
              const verb = t.canonical_verb || findVerbFromPack(t.name)?.name || "free_text";
              const planned = t.planned_min ?? DEFAULTS_BY_VERB[verb] ?? "";
              const attention =
                t.requires_driver != null
                  ? t.requires_driver
                    ? "attended"
                    : "unattended"
                  : (findVerbFromPack(t.name)?.attention === "unattended_after_start" ? "unattended" : "attended");
              const dep = t.edges?.[0]?.from ? `#${Number(String(t.edges[0].from).split("_").pop())}` : "—";

              return (
                <tr key={idx} style={{ background: i % 2 ? "rgba(255,255,255,0.45)" : "transparent" }}>
                  <td style={td}>{idx}</td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{t.name || t}</span>
                      {(t.badges || []).map((b, j) => (
                        <span
                          key={j}
                          title="Concurrency cue"
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 999,
                            border: "1px solid #cbd5e1",
                            background: "#f1f5f9",
                          }}
                        >
                          ⏱ {b}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={td}>{verb}</td>
                  <td style={td}>{planned || "—"}</td>
                  <td style={td}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        background: attention === "attended" ? "#eef5ff" : "#ecfdf5",
                        fontSize: 12,
                      }}
                    >
                      {attention}
                    </span>
                  </td>
                  <td style={td}>{dep}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 600,
};
const td = {
  padding: "8px 10px",
  borderBottom: "1px solid #f1f5f9",
};