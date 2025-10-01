/* AuthoringPanel.jsx — v1.6.4 (Phase 1.6c)
   New in 1.6.4:
     • Rounds “about/approx/range” durations UP to nearest preset (toggle ON by default).
     • Optional (OFF by default) ontology verb upgrade for free_text.
   Keeps Phase 1.5:
     • Prefilter lines, split into action-sized steps, pack-based verb detect, etc.
*/
/* eslint-disable */
import React, { useMemo, useState } from "react";
import { ingestFromUrlOrHtml } from "../ingestion/url_or_text.js";
import { getPacks } from "../ingestion/packs_bridge";
import { mapVerb } from "../ingestion/ontology_bridge.js"; // safe, no-throw

// Packs (reuse like App)
import VERB_PACK from "../packs/verbs.en.json";
import DURATIONS_PACK from "../packs/durations.en.json";

/* -------------------------- Pack helpers -------------------------- */
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
    }
    const numKeys = Object.keys(pack).filter((k) => Number.isFinite(pack[k]));
    if (numKeys.length) return numKeys.map((k) => [k, pack[k]]);
  }
  return [];
}
const DEFAULTS_BY_VERB = Object.fromEntries(extractDurationEntries(DURATIONS_PACK));

/* -------------------------- Verb matching -------------------------- */
const findVerb = (text) => {
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
  return findVerb(text) || guessVerbHeuristic(text);
}

/* -------------------------- Small helpers -------------------------- */
const toDurationObj = (min) => (min == null ? null : { value: min });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* -------------------------- Phase 1.1 helpers -------------------------- */
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

// v1.4: fractions + measurement paren stripping
const FRACTION_MAP = { "¼":"1/4","½":"1/2","¾":"3/4","⅐":"1/7","⅑":"1/9","⅒":"1/10","⅓":"1/3","⅔":"2/3","⅕":"1/5","⅖":"2/5","⅗":"3/5","⅘":"4/5","⅙":"1/6","⅚":"5/6","⅛":"1/8","⅜":"3/8","⅝":"5/8","⅞":"7/8" };
function normalizeFractions(s) {
  return s.replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (m) => FRACTION_MAP[m] || m);
}
const UNIT_WORDS = "(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|g|gram|grams|kg|ml|l|liter|liters|pound|pounds|lb|lbs)";
function stripMeasurementParens(s) {
  return s.replace(/\(([^)]*)\)/g, (m, inside) => {
    const t = inside.trim();
    if (/^\s*(?:about|around|approx\.?)?\s*\d+(?:\/\d+)?\s*(?:-?\s*\d+(?:\/\d+)?)?\s*/i.test(t) && new RegExp(UNIT_WORDS,"i").test(t)) {
      return "";
    }
    return m;
  });
}
function cleanLine(line) {
  return normalizeFractions(
    stripMeasurementParens(
      line
        .replace(/^ingredients[:]?$/i, "")
        .replace(/^For the .*?:\s*/i, "")
        .replace(/^Step\s*\d+[:.]?\s*/i, "")
        .replace(/^[-*]?\s*Note[:.]?\s*/i, "")
    )
  ).trim();
}

function prefilterLines(rawText) {
  const src = rawText.split(/\r?\n/);
  let inIngredients = false;
  let seenDirections = false;

  const out = [];
  for (let raw of src) {
    let line = normalizeText(raw);
    if (!line) continue;
    if (META_SKIP_RE.test(line)) continue;

    if (SECTION_START_ING.test(line)) { inIngredients = true; continue; }
    if (SECTION_START_DIRS.test(line)) { inIngredients = false; seenDirections = true; continue; }

    if (inIngredients || (!seenDirections && ING_LIKE_RE.test(line))) continue;
    if (/^•\s+/.test(line) && ING_LIKE_RE.test(line)) continue;

    line = stripStepPrefix(line);
    line = coerceDurationSuffix(line);

    if (!line || /^step\s*\d+\s*$/i.test(line)) continue;

    line = cleanLine(line);
    out.push(line);
  }
  return out.length ? out : src.map((l) => l.trim()).filter(Boolean);
}

/* -------------------------- Phase 1.5 helpers -------------------------- */
const ABBRV = /(?:e\.g|i\.e|approx|vs|min|hr|hrs)\.$/i;
function explodeActions(lines) {
  const out = [];
  for (let raw of lines) {
    if (!raw) continue;

    // mask (...) to avoid splitting inside
    const masks = [];
    let masked = "";
    let depth = 0, buf = "";
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "(") { if (depth === 0 && buf) { masked += buf; buf = ""; } depth++; buf += ch; }
      else if (ch === ")") { buf += ch; depth = Math.max(0, depth - 1);
        if (depth === 0) { const token = `@@P${masks.length}@@`; masks.push(buf); masked += token; buf = ""; }
      } else { if (depth > 0) buf += ch; else masked += ch; }
    }
    if (buf) masked += buf;

    const parts = masked
      .split(/(?:\.\s+|;\s+|\s+(?:and\s+then|then)\s+)/i)
      .map((p) => p.trim())
      .filter(Boolean);

    const unmasked = parts.map((p) => p.replace(/@@P(\d+)@@/g, (m, idx) => masks[Number(idx)] || ""));

    const merged = [];
    for (const p of unmasked) {
      const segment = p.replace(/\s+/g, " ").trim();
      if (segment.length < 18 && merged.length) {
        merged[merged.length - 1] = `${merged[merged.length - 1].replace(/[.]\s*$/, "")}; ${segment}`;
      } else {
        merged.push(segment);
      }
    }

    for (const seg of merged) {
      if (!seg) continue;
      if (ABBRV.test(seg)) { out.push(raw); break; }
      out.push(seg);
    }
  }
  return out;
}

/* --------------------- 1.6.4: “about” rounding --------------------- */
const DURATION_PRESETS = [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60];
const aboutToken = /\b(?:~|about|approx(?:\.|imately)?|around)\b/i;

// returns { value: number|null, approx: boolean }
function parseDurationMinPlus(input) {
  if (!input) return { value: null, approx: false };
  const s = String(input).toLowerCase().replace(/[–—]/g, "-");
  const approxFlag = aboutToken.test(s);

  // Range "3-5 min", "3 to 5 minutes" → pick hi, set approx
  const range = s.match(/(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:-|to)\s*(\d{1,4})\s*(?:m(?:in(?:ute)?s?)?)\b/);
  if (range) {
    const hi = parseInt(range[2], 10);
    return { value: clamp(isNaN(hi) ? 0 : hi, 1, 24 * 60), approx: true };
  }

  const single = s.match(/(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:m(?:in(?:ute)?s?)?)\b/);
  if (single) {
    const v = parseInt(single[1], 10);
    return { value: clamp(isNaN(v) ? 0 : v, 1, 24 * 60), approx: approxFlag };
  }
  return { value: null, approx: false };
}

function roundUpToPreset(min) {
  for (const p of DURATION_PRESETS) {
    if (min <= p) return p;
  }
  return min; // longer tasks keep explicit number
}

/* --------------------------------------------------------------------- */

export default function AuthoringPanel({ onLoadMeal }) {
  const [text, setText] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");
  const [autoDeps, setAutoDeps] = useState(true);
  const [preview, setPreview] = useState([]);

  // new toggles
  const [roundAboutUp, setRoundAboutUp] = useState(true);     // default ON
  const [useOntology, setUseOntology] = useState(false);      // default OFF

  const rows = useMemo(() => explodeActions(prefilterLines(text)), [text]);

  async function importFromUrlOrHtml() {
    const packs = await getPacks();
    const draft = await ingestFromUrlOrHtml(text, packs);
    setText(draft);
  }

  async function finalizeVerb(textLine) {
    const vMeta = findVerbSmart(textLine);
    if (vMeta) return vMeta.name;
    if (!useOntology) return "free_text";

    try {
      const res = await mapVerb(textLine);
      if (res?.canon) return res.canon; // upgrade via ontology
    } catch { /* ignore */ }
    return "free_text";
  }

  async function parseLines() {
    const tasks = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const raw = rows[idx];
      const line = cleanLine(raw);

      const { value, approx } = parseDurationMinPlus(line);
      const vPack = findVerb(line);
      const verb = await finalizeVerb(line);

      const chosenMin =
        value != null
          ? (approx && roundAboutUp ? roundUpToPreset(value) : value)
          : (vPack?.default_planned ?? DEFAULTS_BY_VERB[verb] ?? null);

      tasks.push({
        id: `draft_${idx + 1}`,
        name: line.replace(/\s*—\s*\d+\s*min(?:utes?)?$/i, ""),
        canonical_verb: verb,
        duration_min: toDurationObj(value != null ? (approx && roundAboutUp ? roundUpToPreset(value) : value) : null),
        planned_min: chosenMin,
        requires_driver: vPack ? vPack.attention === "attended" : true,
        self_running_after_start: vPack ? vPack.attention === "unattended_after_start" : false,
        inputs: [],
        outputs: [],
        edges: [],
      });
    }

    if (autoDeps) {
      for (let i = 1; i < tasks.length; i++) {
        tasks[i].edges.push({ from: tasks[i - 1].id, type: "FS" });
      }
    }
    setPreview(tasks);
  }

  function loadAsMeal() {
    if (preview.length === 0) {
      // best-effort sync call to the async parser
      parseLines().then(() => {
        // no-op; preview state will trigger below “Load as meal” on second click if needed
      });
      return;
    }
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
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.6.4)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={parseLines}>Parse → Draft</button>
          <button onClick={loadAsMeal}>Load into Preview</button>
        </div>
      </div>

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
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="One step per line… or paste a URL/HTML, then click “Import from URL/HTML”."
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

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={autoDeps} onChange={(e) => setAutoDeps(e.target.checked)} />
              Auto-create sequential dependencies (FS)
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={roundAboutUp} onChange={(e) => setRoundAboutUp(e.target.checked)} />
              Round “about/approx/range” durations up
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.9 }}>
              <input type="checkbox" checked={useOntology} onChange={(e) => setUseOntology(e.target.checked)} />
              (Experimental) Upgrade verbs via ontology
            </label>

            <div>
              <button onClick={importFromUrlOrHtml}>Import from URL/HTML</button>
            </div>
          </div>
        </div>
      </div>

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
            {(preview.length ? preview : rows.map((line, i) => ({ name: line, _row: i }))).map((t, i) => {
              const idx = i + 1;
              const verb = t.canonical_verb || findVerb(t.name)?.name || "free_text";
              const planned = t.planned_min ?? DEFAULTS_BY_VERB[verb] ?? "";
              const attention =
                t.requires_driver != null
                  ? t.requires_driver
                    ? "attended"
                    : "unattended"
                  : (findVerb(t.name)?.attention === "unattended_after_start" ? "unattended" : "attended");
              const dep = t.edges?.[0]?.from ? `#${Number(String(t.edges[0].from).split("_").pop())}` : "—";
              return (
                <tr key={idx} style={{ background: i % 2 ? "rgba(255,255,255,0.45)" : "transparent" }}>
                  <td style={td}>{idx}</td>
                  <td style={td}>{t.name || t}</td>
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