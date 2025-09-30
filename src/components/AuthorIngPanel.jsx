/* AuthoringPanel.jsx — v1.1.0 (Phase 1.1)
   - Adds pre-ingestion heuristics:
     * Skip INGREDIENTS section and ingredient-like lines
     * Ignore common meta (Author/Serves/Prep/Cook/Notes)
     * Normalize bullets/dashes; strip "Step X" prefixes
     * Coerce "for 5 minutes" → "— 5 min" (and hours)
   - Preserves URL/HTML import hook and existing layout/colors
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

const findVerb = (text) => {
  for (const v of CANONICAL) for (const re of v.patterns) if (re.test(text)) return v;
  return null;
};
const toDurationObj = (min) => (min == null ? null : { value: min });

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const parseDurationMin = (s) => {
  const m = s.match(/(\d+)\s*(?:min|minutes?)/i);
  return m ? clamp(parseInt(m[1], 10), 1, 24 * 60) : null;
};
const getPlannedMinutes = (t) => {
  if (!t) return 1;
  const explicit = t?.duration_min?.value;
  const planned = t?.planned_min;
  const byVerb = DEFAULTS_BY_VERB?.[t?.canonical_verb];
  const val = explicit ?? planned ?? byVerb ?? 1;
  return Math.max(1, Math.round(val));
};

/* -------------------------- Phase 1.1 helpers -------------------------- */

// Basic unicode cleanup
function normalizeText(s) {
  return s
    .replace(/\u2013|\u2014/g, "—")              // en/em dash → em dash
    .replace(/\u2022|\u25CF|\u2219|\*/g, "•")    // bullets → •
    .replace(/\s+/g, " ")
    .trim();
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

// Rough ingredient detector (amount + unit OR bullet + food-y thing)
const UNIT = "(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|g|gram|grams|kg|ml|l|liters?|pounds?|lbs?|cloves?|sticks?|slices?|dash|pinch|sprigs?|leaves?)";
const AMOUNT = "(?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
const ING_LIKE_RE = new RegExp(
  `^(?:•\\s*)?(?:${AMOUNT}\\s*(?:${UNIT})\\b|\\d+\\s*(?:${UNIT})\\b)`,
  "i"
);

// Metadata we should skip
const META_SKIP_RE = /^\s*(author:|serves?\b|yield\b|prep time\b|cook time\b|total time\b|notes?:?)\s*/i;

function prefilterLines(rawText) {
  const src = rawText.split(/\r?\n/);
  let inIngredients = false;
  let seenDirections = false;

  const out = [];
  for (let raw of src) {
    let line = normalizeText(raw);

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

    // Ignore singleton headings like "Step 3" after stripping
    if (!line || /^step\s*\d+\s*$/i.test(line)) continue;

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

  // NEW: use prefilterLines (Phase 1.1). If it returns nothing, rows will still be safe.
  const rows = useMemo(() => prefilterLines(text), [text]);

  async function importFromUrlOrHtml() {
    const packs = await getPacks(); // future use; currently no-op passthrough
    const draft = await ingestFromUrlOrHtml(text, packs);
    // We simply replace the textarea content; the preview table will reflect it.
    setText(draft);
  }

  function parseLines() {
    const tasks = rows.map((line, idx) => {
      const vMeta = findVerb(line);
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
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.1)</div>
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