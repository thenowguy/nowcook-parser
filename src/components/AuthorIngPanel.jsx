/* AuthoringPanel.jsx — v1.6.6 (Phase 1.6c)
   Chef Notes restored + robust:
     • Preserve standalone “Note:” lines before meta/ingredient filtering
     • Split inline notes “... — Note: …” into Action + Note rows
     • Don’t sentence-split note lines; render with 🗒️ icon
     • Notes load as zero-duration, non-blocking items (requires_driver:false)

   Keeps prior phases:
     • Skip INGREDIENTS and ingredient-like lines
     • Ignore common meta (Author/Serves/Prep/Cook/Notes headers)
     • Normalize bullets/dashes; strip "Step X" prefixes
     • Coerce “for 5 minutes / 1 hour” → append “— X min”
     • Unicode fraction normalization; strip measurement-y parentheticals
     • Action-level splitting on “.”, “;”, “then/and then” (not inside (…) )
     • Safe verb detection (pack patterns, then light heuristics)
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
const findVerbByPack = (text) => {
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
  return findVerbByPack(text) || guessVerbHeuristic(text);
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

// Metadata we should skip (but NOT Chef Notes)
const META_SKIP_RE = /^\s*(author:|serves?\b|yield\b|prep time\b|cook time\b|total time\b|notes?:?)\s*$/i;

// v1.4: fraction normalization + measurement-parenthetical stripping
const FRACTION_MAP = {
  "¼":"1/4","½":"1/2","¾":"3/4","⅐":"1/7","⅑":"1/9","⅒":"1/10",
  "⅓":"1/3","⅔":"2/3","⅕":"1/5","⅖":"2/5","⅗":"3/5","⅘":"4/5",
  "⅙":"1/6","⅚":"5/6","⅛":"1/8","⅜":"3/8","⅝":"5/8","⅞":"7/8",
};
function normalizeFractions(s) {
  return s.replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (m) => FRACTION_MAP[m] || m);
}
const UNIT_WORDS = "(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|g|gram|grams|kg|ml|l|liter|liters|pound|pounds|lb|lbs)";
function stripMeasurementParens(s) {
  // remove parentheticals that look like purely measurement/notes e.g., "(about 1/2 cup)", "(7 oz)"
  return s.replace(/\(([^)]*)\)/g, (m, inside) => {
    const t = inside.trim();
    if (/^\s*(?:about|around|approx\.?)?\s*\d+(?:\/\d+)?\s*(?:-?\s*\d+(?:\/\d+)?)?\s*/i.test(t) && new RegExp(UNIT_WORDS,"i").test(t)) {
      return "";
    }
    return m; // keep descriptive ones
  });
}

function cleanLine(line) {
  return normalizeFractions(
    stripMeasurementParens(
      line
        // drop section headers
        .replace(/^ingredients[:]?$/i, "")
        .replace(/^For the .*?:\s*/i, "")
        // drop "Step X" markers
        .replace(/^Step\s*\d+[:.]?\s*/i, "")
    )
  ).trim();
}

/* -------------------------- Chef Notes helpers -------------------------- */

// Standalone note detector (do NOT strip its label)
const NOTE_LINE_RE = /^\s*(?:[-*]\s*)?note\s*[:.]\s*/i;
// Inline split marker: em dash/en dash/hyphen before Note:
const NOTE_INLINE_SPLIT_RE = /\s*[—–-]\s*Note\s*[:.]\s*/i;

function isChefNoteLine(line) {
  return NOTE_LINE_RE.test(line);
}

/* -------------------------- Prefilter (with notes) -------------------------- */

function prefilterLines(rawText) {
  const src = rawText.split(/\r?\n/);
  let inIngredients = false;
  let seenDirections = false;

  const out = [];
  for (let raw of src) {
    let line = normalizeText(raw);
    if (!line) continue;

    // 1) Keep Chef Notes BEFORE any meta/ingredient filtering
    if (isChefNoteLine(line)) {
      // normalize leading bullet "Note:" forms to "Note: ..."
      const norm = line.replace(NOTE_LINE_RE, "Note: ").trim();
      out.push(norm);
      continue;
    }

    // 2) Meta/section handling
    if (META_SKIP_RE.test(line)) continue;

    if (SECTION_START_ING.test(line)) { inIngredients = true; continue; }
    if (SECTION_START_DIRS.test(line)) { inIngredients = false; seenDirections = true; continue; }

    if (inIngredients || (!seenDirections && ING_LIKE_RE.test(line))) continue;
    if (/^•\s+/.test(line) && ING_LIKE_RE.test(line)) continue;

    // 3) Inline note split: "… — Note: …"
    if (NOTE_INLINE_SPLIT_RE.test(line)) {
      const [actionPart, notePart] = line.split(NOTE_INLINE_SPLIT_RE);
      let action = stripStepPrefix(actionPart);
      action = coerceDurationSuffix(action);
      action = cleanLine(action);
      if (action && !/^step\s*\d+\s*$/i.test(action)) out.push(action);

      const noteLine = `Note: ${notePart.trim()}`;
      if (notePart.trim()) out.push(noteLine);
      continue;
    }

    // 4) Normal non-note line cleanup
    line = stripStepPrefix(line);
    line = coerceDurationSuffix(line);
    if (!line || /^step\s*\d+\s*$/i.test(line)) continue;

    line = cleanLine(line);
    out.push(line);
  }

  return out.length ? out : src.map((l) => l.trim()).filter(Boolean);
}

/* -------------------------- Phase 1.5 action explosion -------------------------- */

// Split a line into action-sized steps, avoiding splits inside (...) and after common abbreviations.
// Do NOT split Chef Note lines.
function explodeActions(lines) {
  const out = [];
  const ABBRV = /(?:e\.g|i\.e|approx|vs|min|hr|hrs)\.$/i;

  for (let raw of lines) {
    if (!raw) continue;

    // 0) Never split notes
    if (isChefNoteLine(raw)) {
      out.push(raw);
      continue;
    }

    // Mask (...) so we don’t split inside them.
    const masks = [];
    let masked = "";
    let depth = 0, buf = "";
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "(") {
        if (depth === 0 && buf) { masked += buf; buf = ""; }
        depth++;
        buf += ch;
      } else if (ch === ")") {
        buf += ch;
        depth = Math.max(0, depth - 1);
        if (depth === 0) {
          const token = `@@P${masks.length}@@`;
          masks.push(buf);
          masked += token;
          buf = "";
        }
      } else {
        if (depth > 0) buf += ch;
        else masked += ch;
      }
    }
    if (buf) masked += buf; // any remainder

    // Split on ., ;, " then ", " and then "
    const parts = masked
      .split(/(?:\.\s+|;\s+|\s+(?:and\s+then|then)\s+)/i)
      .map((p) => p.trim())
      .filter(Boolean);

    const unmasked = parts.map((p) =>
      p.replace(/@@P(\d+)@@/g, (m, idx) => masks[Number(idx)] || "")
    );

    // Merge too-short tail fragments back into previous
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

/* --------------------------------------------------------------------- */

export default function AuthoringPanel({ onLoadMeal }) {
  const [text, setText] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");
  const [autoDeps, setAutoDeps] = useState(true);
  const [roundAbout, setRoundAbout] = useState(true);
  const [useOntology, setUseOntology] = useState(false); // reserved; UI toggle only for now
  const [preview, setPreview] = useState([]);

  // Prefilter lines (incl. notes), then explode into actions (notes untouched)
  const rows = useMemo(() => {
    const base = prefilterLines(text);
    return explodeActions(base);
  }, [text]);

  async function importFromUrlOrHtml() {
    const packs = await getPacks(); // reserved for future pack-aware transforms
    const draft = await ingestFromUrlOrHtml(text, packs);
    setText(draft); // preview table reacts via rows
  }

  function parseLines() {
    const tasks = rows.map((raw, idx) => {
      const is_note = isChefNoteLine(raw);
      const line = is_note ? raw.replace(NOTE_LINE_RE, "").trim() : cleanLine(raw);

      // Note rows become non-blocking, zero-duration info items
      if (is_note) {
        return {
          id: `draft_${idx + 1}`,
          name: line,
          canonical_verb: "note",
          duration_min: null,
          planned_min: null,
          requires_driver: false,
          self_running_after_start: true,
          is_note: true,
          inputs: [],
          outputs: [],
          edges: [],
        };
      }

      const vMeta = findVerbSmart(line);
      const verb = vMeta?.name || "free_text";
      let durMin = parseDurationMin(line);

      // Optional rounding for “about/approx/range”
      if (roundAbout && durMin != null) {
        // gentle round up to next whole minute (already is), keep as-is
        durMin = Math.max(1, Math.round(durMin));
      }

      const planned_min = durMin ?? vMeta?.default_planned ?? DEFAULTS_BY_VERB[verb] ?? null;

      return {
        id: `draft_${idx + 1}`,
        name: line.replace(/\s*—\s*\d+\s*min(?:utes?)?$/i, ""),
        canonical_verb: verb,
        duration_min: toDurationObj(durMin),
        planned_min,
        requires_driver: vMeta ? vMeta.attention === "attended" : true,
        self_running_after_start: vMeta ? vMeta.attention === "unattended_after_start" : false,
        is_note: false,
        inputs: [],
        outputs: [],
        edges: [],
      };
    });

    if (autoDeps) {
      for (let i = 1; i < tasks.length; i++) {
        // Don’t chain a note as a hard dependency
        if (tasks[i].is_note) continue;
        const prev = tasks[i - 1];
        if (prev && !prev.is_note) {
          tasks[i].edges.push({ from: prev.id, type: "FS" });
        }
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
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.6.6)</div>
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

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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

            <label title="Prototype only — not used yet" style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.8 }}>
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
            {(preview.length ? preview : rows.map((line, i) => ({ name: line, _row: i, is_note: isChefNoteLine(line) })) ).map((t, i) => {
              const idx = i + 1;
              const isNote = t.is_note === true || isChefNoteLine(t.name || t);
              const resolvedVerb = isNote
                ? "🗒️ note"
                : (t.canonical_verb || findVerbByPack(t.name)?.name || "free_text");
              const planned = isNote ? "—" : (t.planned_min ?? DEFAULTS_BY_VERB[resolvedVerb] ?? "");
              const attention =
                isNote
                  ? "—"
                  : (t.requires_driver != null
                      ? t.requires_driver ? "attended" : "unattended"
                      : (findVerbByPack(t.name)?.attention === "unattended_after_start" ? "unattended" : "attended"));
              const dep = t.edges?.[0]?.from ? `#${Number(String(t.edges[0].from).split("_").pop())}` : "—";
              return (
                <tr key={idx} style={{ background: i % 2 ? "rgba(255,255,255,0.45)" : "transparent" }}>
                  <td style={td}>{idx}</td>
                  <td style={td}>{t.name || t}</td>
                  <td style={td}>{resolvedVerb}</td>
                  <td style={td}>{planned || "—"}</td>
                  <td style={td}>
                    {isNote ? (
                      <span style={{ fontSize: 12, color: "#6b7280" }}>—</span>
                    ) : (
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
                    )}
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