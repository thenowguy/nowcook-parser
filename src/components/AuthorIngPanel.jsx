/* AuthoringPanel.jsx — v1.1.2 (Phase 1.1b)
   - Small, safe wins over v1.1.1:
     * Duration: understands seconds + unicode fractions; better hour/min normalization
     * Ingredient filtering: accepts "-" bullets as well as "•"; stronger detector
     * Line hygiene: collapse spaces, trim punctuation tails, de-duplicate filtered lines
   - Keeps URL/HTML import hook, layout, and panel colors identical
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

// ---------------- duration defaults ----------------
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

// ---------------- verb matching helpers ----------------
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

// ---------------- small helpers ----------------
const toDurationObj = (min) => (min == null ? null : { value: min });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Convert unicode fractions we commonly see (½, ¼, ¾, etc.) → decimal
function normalizeFractions(s) {
  return s
    .replace(/½/g, " 1/2")
    .replace(/¼/g, " 1/4")
    .replace(/¾/g, " 3/4")
    .replace(/⅓/g, " 1/3")
    .replace(/⅔/g, " 2/3")
    .replace(/⅛/g, " 1/8")
    .replace(/⅜/g, " 3/8")
    .replace(/⅝/g, " 5/8")
    .replace(/⅞/g, " 7/8");
}

// Parse explicit "— 5 min" / "3-5 minutes" / "~10 min" suffixes (plus seconds/hours)
function parseDurationMin(input) {
  if (!input) return null;
  const s = normalizeFractions(String(input).toLowerCase()).replace(/[–—]/g, "-"); // normalize dashes

  // Helpers
  const toMinutes = (num, unit) => {
    if (!Number.isFinite(num)) return null;
    if (/^s(ec|econd)s?$/.test(unit)) return clamp(num > 0 ? 1 : 0, 0, 24 * 60); // any seconds → at least 1 min
    if (/^h(rs?|ours?)$/.test(unit)) return clamp(Math.round(num * 60), 1, 24 * 60);
    return clamp(Math.round(num), 1, 24 * 60); // minutes default
  };

  // Range with units (min/sec/hr): "10-20 sec", "1-2 min"
  const range = s.match(
    /(?:~|about|approx(?:\.|imately)?|around)?\s*(\d+(?:\s*\d+\/\d+)?)\s*(?:-|to)\s*(\d+(?:\s*\d+\/\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/
  );
  if (range) {
    const hiRaw = evalFraction(range[2]);
    const unit = unitKey(range[3]);
    return toMinutes(hiRaw, unit);
  }

  // Single value + unit: "~30 sec", "about 10 minutes", "1.5 hours"
  const single = s.match(
    /(?:~|about|approx(?:\.|imately)?|around)?\s*(\d+(?:\.\d+)?(?:\s*\d+\/\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/
  );
  if (single) {
    const val = evalFraction(single[1]);
    const unit = unitKey(single[2]);
    return toMinutes(val, unit);
  }

  // Bare minutes (fallback): "~ 12 min" already matched above, but keep a light catch
  const bareMin = s.match(/(\d{1,4})\s*(?:m|min|mins|minute|minutes)\b/);
  if (bareMin) {
    const v = parseInt(bareMin[1], 10);
    return clamp(isNaN(v) ? 0 : v, 1, 24 * 60);
  }

  return null;
}

function unitKey(u) {
  const k = String(u || "").toLowerCase();
  if (/^s/.test(k)) return "sec";
  if (/^h/.test(k)) return "hr";
  return "min";
}

function evalFraction(raw) {
  // "1 1/2" or "1/2" or "1.5"
  const s = String(raw).trim();
  if (s.includes("/")) {
    const [a, b] = s.split(/\s+/);
    if (b && a.includes("/")) {
      // "1/2" only
      const [n1, d1] = a.split("/").map(Number);
      return n1 / d1;
    }
    if (b) {
      // "1 1/2"
      const [n2, d2] = b.split("/").map(Number);
      return Number(a) + n2 / d2;
    }
    const [n, d] = s.split("/").map(Number);
    return n / d;
  }
  return Number(s);
}

/* -------------------------- Phase 1.1 helpers -------------------------- */

// Basic unicode cleanup + bullets + spacing tidy
function normalizeText(s) {
  return s
    .replace(/\u2013|\u2014/g, "—")           // en/em dash → em dash
    .replace(/\u2022|\u25CF|\u2219|\*/g, "•") // bullets → •
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Strip "Step 1:" / "Step 1." / "STEP 1 –"
function stripStepPrefix(s) {
  return s.replace(/^\s*step\s*\d+\s*[:.\-\u2013\u2014]\s*/i, "");
}

// Coerce "for 5 minutes" / "about 1 hour" / "30 seconds" → append "— X min"
function coerceDurationSuffix(s) {
  let line = s;
  let min = 0;

  const txt = normalizeFractions(line);

  // hours (including decimals/fractions)
  const hr = txt.match(/(\d+(?:\.\d+)?(?:\s*\d+\/\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (hr) min += Math.round(evalFraction(hr[1]) * 60);

  // minutes
  const mn = txt.match(/(\d+(?:\.\d+)?(?:\s*\d+\/\d+)?)\s*(?:minutes?|mins?)\b/i);
  if (mn) min += Math.round(evalFraction(mn[1]));

  // seconds → bump to at least 1 minute if present
  const sc = txt.match(/(\d+(?:\.\d+)?(?:\s*\d+\/\d+)?)\s*(?:seconds?|secs?)\b/i);
  if (sc) min = Math.max(1, min); // any seconds → at least 1 minute

  if (min && !/—\s*\d+\s*min/i.test(line)) {
    line = `${line} — ${min} min`;
  }
  return line;
}

const SECTION_START_ING = /^(ingredients?|what you need)\b/i;
const SECTION_START_DIRS = /^(directions?|method|instructions?)\b/i;

// Ingredient-like detector (amount + unit; accepts "• " or "- " lead)
const UNIT =
  "(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|g|gram|grams|kg|ml|l|liters?|pounds?|lbs?|cloves?|sticks?|slices?|dash|pinch|sprigs?|leaves?|heads?|bunch(?:es)?|pieces?)";
const AMOUNT = "(?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
const ING_LIKE_RE = new RegExp(
  `^(?:[•\\-]\\s*)?(?:${AMOUNT}\\s*(?:${UNIT})\\b|\\d+\\s*(?:${UNIT})\\b|${AMOUNT}\\s+\\w+\\b)`,
  "i"
);

// Metadata we should skip
const META_SKIP_RE = /^\s*(author:|serves?\b|yield\b|prep time\b|cook time\b|total time\b|notes?:?)\s*/i;

function cleanLine(line) {
  return line
    // drop section headers
    .replace(/^ingredients[:]?$/i, "")
    .replace(/^For the .*?:\s*/i, "")
    // drop "Step X" markers
    .replace(/^Step\s*\d+[:.]?\s*/i, "")
    // downgrade "Note:" → keep text but remove the label
    .replace(/^[-*•]?\s*Note[:.]?\s*/i, "")
    // tidy punctuation tails
    .replace(/[,\s.]+$/g, "")
    .trim();
}

function prefilterLines(rawText) {
  const src = rawText.split(/\r?\n/);
  let inIngredients = false;
  let seenDirections = false;

  const out = [];
  const seen = new Set();

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
    if (/^(?:[•\-])\s+/.test(line) && ING_LIKE_RE.test(line)) continue;

    // Step cleanup + duration coercion
    line = stripStepPrefix(line);
    line = coerceDurationSuffix(line);

    // Ignore singleton headings like "Step 3" after stripping
    if (!line || /^step\s*\d+\s*$/i.test(line)) continue;

    // Final polish for preview
    line = cleanLine(line);

    // De-dup identical post-processed lines
    if (!line || seen.has(line)) continue;
    seen.add(line);

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

  // Phase 1.1: prefilter lines for the preview/parser
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