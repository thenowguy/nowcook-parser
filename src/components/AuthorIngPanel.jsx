/* AuthoringPanel.jsx — v1.4.0 (Phase 1.4)
   - Builds on v1.3.1:
     * Cleans inline ingredient parentheticals in steps, e.g. "(about 1/2 cup)", "(200 g)", "(2 tbsp)"
       while preserving non-measurement notes like "(no longer chalky ...)".
     * Normalizes unicode fractions (¼ ½ ¾ ⅓ ⅔ ⅛ ⅜ ⅝ ⅞ → ASCII).
   - Keeps: pre-ingestion heuristics, smart verb detection, URL/HTML import hook, layout/colors.
*/
/* eslint-disable */
import React, { useMemo, useState } from "react";
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

// duration defaults
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

// --- verb matching helpers ---
const findVerb = (text) => {
  for (const v of CANONICAL) for (const re of v.patterns) if (re.test(text)) return v;
  return null;
};

// quick lookup of canonical verbs present in the pack
const CANON_BY_NAME = new Map(CANONICAL.map((v) => [String(v.name).toLowerCase(), v]));

// Minimal heuristics used only if pack patterns miss
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

// small helpers
const toDurationObj = (min) => (min == null ? null : { value: min });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Parse explicit "— 5 min" / "3-5 minutes" / "~10 min" suffixes
function parseDurationMin(input) {
  if (!input) return null;
  const s = String(input).toLowerCase().replace(/[–—]/g, "-"); // normalize dashes

  // Range: "3-5 min", "3 to 5 minutes"
  const range = s.match(
    /(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:-|to)\s*(\d{1,4})\s*(?:m(?:in(?:ute)?s?)?)\b/
  );
  if (range) {
    const hi = parseInt(range[2], 10);
    return clamp(isNaN(hi) ? 0 : hi, 1, 24 * 60);
  }

  // Single value: "~3 min", "about 10 minutes", "5m"
  const single = s.match(
    /(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:m(?:in(?:ute)?s?)?)\b/
  );
  if (single) {
    const v = parseInt(single[1], 10);
    return clamp(isNaN(v) ? 0 : v, 1, 24 * 60);
  }

  return null;
}

/* -------------------------- Phase 1.4 helpers -------------------------- */

// Basic unicode + bullets cleanup
function normalizeText(s) {
  return s
    .replace(/\u2013|\u2014/g, "—")              // en/em dash → em dash
    .replace(/\u2022|\u25CF|\u2219|\*/g, "•")    // bullets → •
    .replace(/\s+/g, " ")
    .trim();
}

// Unicode fractions → ASCII
function normalizeFractions(s) {
  return s
    .replace(/¼/g, "1/4")
    .replace(/½/g, "1/2")
    .replace(/¾/g, "3/4")
    .replace(/⅓/g, "1/3")
    .replace(/⅔/g, "2/3")
    .replace(/⅛/g, "1/8")
    .replace(/⅜/g, "3/8")
    .replace(/⅝/g, "5/8")
    .replace(/⅞/g, "7/8");
}

// Strip "Step 1:" / "Step 1." / "STEP 1 –"
function stripStepPrefix(s) {
  return s.replace(/^\s*step\s*\d+\s*[:.\-\u2013\u2014]\s*/i, "");
}

// Coerce "for 5 minutes" / "about 1 hour" → append "— X min"
function coerceDurationSuffix(s) {
  let line = s;
  let min = null;

  const hr = line.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  const mn = line.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/i);

  if (hr) min = Math.round(parseFloat(hr[1]) * 60);
  if (mn) min = (min ?? 0) + Math.round(parseFloat(mn[1]));

  if (min && !/—\s*\d+\s*min/i.test(line)) {
    line = `${line} — ${min} min`;
  }
  return line;
}

const SECTION_START_ING = /^(ingredients?|what you need)\b/i;
const SECTION_START_DIRS = /^(directions?|method|instructions?)\b/i;

// Units for ingredient-y detection
const UNIT = "(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|g|gram|grams|kg|ml|l|liters?|pounds?|lbs?|cloves?|sticks?|slices?|dash|pinch|sprigs?|leaves?)";
const AMOUNT = "(?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
const ING_LIKE_RE = new RegExp(
  `^(?:•\\s*)?(?:${AMOUNT}\\s*(?:${UNIT})\\b|\\d+\\s*(?:${UNIT})\\b)`,
  "i"
);

// Remove inline parentheticals that are *just* quantities/units, e.g. "(about 1/2 cup)", "(200 g)", "(2 tbsp oil)"
// but keep descriptive parentheticals.
const PAREN_MEASURE_RE = new RegExp(
  String.raw`$begin:math:text$(?:about|around|approx(?:\\.|imately)?\\s*)?(?:${AMOUNT})\\s*(?:${UNIT})(?:[^)]*)$end:math:text$`,
  "i"
);

// Metadata to skip entirely
const META_SKIP_RE = /^\s*(author:|serves?\b|yield\b|prep time\b|cook time\b|total time\b|notes?:?)\s*/i;

function cleanLine(line) {
  return line
    // drop section headers
    .replace(/^ingredients[:]?$/i, "")
    .replace(/^For the .*?:\s*/i, "")
    // drop "Step X" markers
    .replace(/^Step\s*\d+[:.]?\s*/i, "")
    // downgrade "Note:" → keep text but remove the label
    .replace(/^[-*]?\s*Note[:.]?\s*/i, "")
    .trim();
}

function stripMeasureParentheticals(s) {
  let out = s;
  // remove multiple measurement parens if present
  for (let i = 0; i < 4; i++) { // conservative cap
    const before = out;
    out = out.replace(PAREN_MEASURE_RE, "").replace(/\s{2,}/g, " ").trim();
    if (out === before) break;
  }
  // tidy stray spaces before punctuation
  out = out.replace(/\s+([,.;:])\b/g, "$1");
  return out;
}

function prefilterLines(rawText) {
  const src = rawText.split(/\r?\n/);
  let inIngredients = false;
  let seenDirections = false;

  const out = [];
  for (let raw of src) {
    let line = normalizeText(normalizeFractions(raw));

    if (!line) continue;
    if (META_SKIP_RE.test(line)) continue;

    // Section toggles
    if (SECTION_START_ING.test(line)) { inIngredients = true; continue; }
    if (SECTION_START_DIRS.test(line)) { inIngredients = false; seenDirections = true; continue; }

    // Skip ingredient lines while in ingredients (or pre-directions lists)
    if (inIngredients || (!seenDirections && ING_LIKE_RE.test(line))) continue;

    // Leading bullets and leftover commas look like ingredients
    if (/^•\s+/.test(line) && ING_LIKE_RE.test(line)) continue;

    // Step cleanup + duration coercion
    line = stripStepPrefix(line);
    line = coerceDurationSuffix(line);
    line = stripMeasureParentheticals(line);

    // Ignore singleton headings like "Step 3" after stripping
    if (!line || /^step\s*\d+\s*$/i.test(line)) continue;

    // Final polish for preview
    line = cleanLine(line);

    out.push(line);
  }

  // If we filtered everything, fall back to original lines to avoid surprising empties
  return out.length ? out : src.map((l) => l.trim()).filter(Boolean);
}

/* --------------------------------------------------------------------- */

export default function AuthoringPanel({ onLoadMeal }) {
  const [text, setText] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");
  const [autoDeps, setAutoDeps] = useState(true);
  const [preview, setPreview] = useState([]);

  // Phase 1.4: prefilter lines for the preview/parser (now also strips measure parens + normalizes fractions)
  const rows = useMemo(() => prefilterLines(text), [text]);

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
      const durMin = parseDurationMin(line);
      const planned_min = durMin ?? vMeta?.default_planned ?? DEFAULTS_BY_VERB[verb] ?? null;

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

  // v1.3 auto-title behavior retained:
  // If the user hasn't typed a title, mirror the first non-empty line.
  React.useEffect(() => {
    if (title && title.trim()) return;
    const first = rows.find((r) => r && r.trim());
    if (first) setTitle(first.slice(0, 120));
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.4)</div>
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