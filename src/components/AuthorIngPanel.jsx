/* AuthoringPanel.jsx — v1.3.1 (Phase 1.3b)
   - Auto-title detection from pasted text (safe, user-typed title always wins)
   - Smarter duration hints for lines without explicit minutes (planned_min only)
   - Keeps Phase 1.1 pre-ingestion heuristics and URL/HTML import hook
*/
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import { ingestFromUrlOrHtml } from "../ingestion/url_or_text";
import { getPacks } from "../ingestion/packs_bridge";

// Packs (reuse like App)
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

// ----------------------- durations & defaults -----------------------
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

// ----------------------- verb matching helpers -----------------------
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

// ----------------------- small helpers -----------------------
const toDurationObj = (min) => (min == null ? null : { value: min });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Parse explicit "— 5 min" / "3-5 minutes" / "~10 min" suffixes
function parseDurationMin(input) {
  if (!input) return null;
  const s = String(input).toLowerCase().replace(/[–—]/g, "-"); // normalize dashes

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
  let line = s;
  let min = null;
  const hr = line.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  const mn = line.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/i);
  if (hr) min = Math.round(parseFloat(hr[1]) * 60);
  if (mn) min = (min ?? 0) + Math.round(parseFloat(mn[1]));
  if (min && !/—\s*\d+\s*min/i.test(line)) line = `${line} — ${min} min`;
  return line;
}

const SECTION_START_ING = /^(ingredients?|what you need)\b/i;
const SECTION_START_DIRS = /^(directions?|method|instructions?)\b/i;
const UNIT =
  "(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|g|gram|grams|kg|ml|l|liters?|pounds?|lbs?|cloves?|sticks?|slices?|dash|pinch|sprigs?|leaves?)";
const AMOUNT = "(?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
const ING_LIKE_RE = new RegExp(
  `^(?:•\\s*)?(?:${AMOUNT}\\s*(?:${UNIT})\\b|\\d+\\s*(?:${UNIT})\\b)`,
  "i"
);
const META_SKIP_RE = /^\s*(author:|serves?\b|yield\b|prep time\b|cook time\b|total time\b|notes?:?)\s*/i;

function cleanLine(line) {
  return line
    .replace(/^ingredients[:]?$/i, "")
    .replace(/^For the .*?:\s*/i, "")
    .replace(/^Step\s*\d+[:.]?\s*/i, "")
    .replace(/^[-*]?\s*Note[:.]?\s*/i, "")
    .trim();
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

/* --------------------- v1.3.1: auto-title detection --------------------- */
// Choose the first plausible line that isn't meta/section/ingredient-y
function detectTitle(rawText) {
  const lines = rawText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const l = lines[i];
    if (META_SKIP_RE.test(l)) continue;
    if (SECTION_START_ING.test(l) || SECTION_START_DIRS.test(l)) continue;
    if (ING_LIKE_RE.test(l)) continue;
    if (/^step\s*\d+/i.test(l)) continue;
    // Avoid obviously sentence-like steps and super long paragraphs
    if (l.length > 80) continue;
    // Titles often don't end with a period
    if (/[.!?]$/.test(l)) continue;
    return l;
  }
  return "";
}

/* -------- v1.3.1: heuristic planned_min when no explicit minutes -------- */
function hintDurationMinutes(line, verbCanon) {
  const s = String(line).toLowerCase();

  // Texture/appearance cues
  if (/\b(translucent|soft|softened)\b/.test(s)) return 8;     // sauté onions until translucent
  if (/\b(golden|golden-brown|lightly browned?)\b/.test(s)) return 4; // toast/brown lightly
  if (/\b(al dente)\b/.test(s)) return 8;                      // pasta al dente

  // Risotto-ish “until absorbed / thickened”
  if (/\b(absorb(?:ed)?|absorbs|thicken(?:ed)?|reduce(?:d)?\s+by\b)/.test(s)) return 3;

  // Simple simmer or reduce when time not given
  if (/\b(simmer|reduce)\b/.test(s)) return 10;

  // Fall back: use pack default if any (handled by caller), else small attended step
  if (verbCanon === "stir") return 2;
  if (verbCanon === "season") return 1;
  return null;
}

/* --------------------------------------------------------------------- */

export default function AuthoringPanel({ onLoadMeal }) {
  const [text, setText] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [autoDeps, setAutoDeps] = useState(true);
  const [preview, setPreview] = useState([]);

  // Prefilter lines for the preview/parser
  const rows = useMemo(() => prefilterLines(text), [text]);

  // v1.3.1: Fill title ONLY if user hasn't typed one yet
  const detectedTitle = useMemo(() => detectTitle(text), [text]);
  useEffect(() => {
    if (!titleTouched && !title && detectedTitle) {
      setTitle(detectedTitle);
    }
  }, [detectedTitle, titleTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  async function importFromUrlOrHtml() {
    const packs = await getPacks(); // reserved for future pack-aware transforms
    const draft = await ingestFromUrlOrHtml(text, packs);
    setText(draft); // preview table reacts via rows
  }

  function parseLines() {
    const tasks = rows.map((raw, idx) => {
      const line = cleanLine(raw);
      const vMeta = findVerbSmart(line);
      const verb = vMeta?.name || "free_text";

      // explicit minutes?
      const durMin = parseDurationMin(line);

      // smarter planned_min:
      // 1) explicit minutes
      // 2) pack default planned
      // 3) heuristic hint from text
      // 4) global defaults by verb
      const hinted = hintDurationMinutes(line, verb);
      const planned_min =
        durMin ??
        vMeta?.default_planned ??
        hinted ??
        DEFAULTS_BY_VERB[verb] ??
        null;

      return {
        id: `draft_${idx + 1}`,
        name: line.replace(/\s*—\s*\d+\s*min(?:utes?)?$/i, ""),
        canonical_verb: verb,
        duration_min: toDurationObj(durMin),
        planned_min,
        requires_driver: vMeta ? vMeta.attention === "attended" : true,
        self_running_after_start: vMeta ? vMeta.attention === "unattended_after_start" : false,
        inputs: [],
        outputs: [],
        edges: [],
      };
    });

    if (autoDeps) {
      for (let i = 1; i < tasks.length; i++) {
        tasks[i].edges.push({ from: tasks[i - 1].id, type: "FS" });
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
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 12,
        background: "#ffe7b3", // authoring panel color
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.3.1)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={parseLines}>Parse → Draft</button>
          <button onClick={loadAsMeal}>Load into Preview</button>
        </div>
      </div>

      {/* TOP ROW — responsive 2-column grid (stacks on narrow widths) */}
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

        {/* Right: title + tip + actions */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Meal title</div>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
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
          <div
            style={{
              fontSize: 14,
              color: "#4b5563",
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
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