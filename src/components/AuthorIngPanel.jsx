/* AuthoringPanel.jsx — v1.6.8 (Phase 1.6e)
   Chef Notes: action+note separation (robust), protected by sentinel
   • Extracts notes from:
     – dash splits: “… — be careful…”, “… – don’t…”, “… — Note: …”
     – semicolon tails: “…; don’t…”, “…; avoid…”
     – trailing parentheses: “(don’t let it stick)”, “(be careful…)”
     – leading conditionals: “If the rice looks dry, add 1/2 cup broth.”
   • Notes are stored as ⟦NOTE⟧ … during parsing to prevent accidental splitting
   • Preview shows notes with Verb = 🗒️ note; no plan/attention/depends
   • Parse → Draft emits notes as zero-duration, non-blocking items

   Keeps previous phases (ingredients/meta skip, unicode/parenthetical cleanup,
   duration coercion, action-splitting, safe verb detection, “about” rounding).
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
    attention: v.attention,
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

/* ---------------- verb matching ---------------- */
const findVerbByPack = (text) => {
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
  return findVerbByPack(text) || guessVerbHeuristic(text);
}

/* ---------------- small helpers ---------------- */
const toDurationObj = (min) => (min == null ? null : { value: min });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function parseDurationMin(input) {
  if (!input) return null;
  const s = String(input).toLowerCase().replace(/[–—]/g, "-");
  const range = s.match(/(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:-|to)\s*(\d{1,4})\s*(?:m(?:in(?:ute)?s?)?)\b/);
  if (range) {
    const hi = parseInt(range[2], 10);
    return clamp(isNaN(hi) ? 0 : hi, 1, 24 * 60);
  }
  const single = s.match(/(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:m(?:in(?:ute)?s?)?)\b/);
  if (single) {
    const v = parseInt(single[1], 10);
    return clamp(isNaN(v) ? 0 : v, 1, 24 * 60);
  }
  return null;
}

/* ---------------- cleanup ---------------- */
function normalizeText(s) {
  return s
    .replace(/\u2013|\u2014/g, "—")
    .replace(/\u2022|\u25CF|\u2219/g, "•")
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
const UNIT = "(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|g|gram|grams|kg|ml|l|liters?|pounds?|lbs?|cloves?|sticks?|slices?|dash|pinch|sprigs?|leaves?)";
const AMOUNT = "(?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
const ING_LIKE_RE = new RegExp(`^(?:•\\s*)?(?:${AMOUNT}\\s*(?:${UNIT})\\b|\\d+\\s*(?:${UNIT})\\b)`, "i");
const META_SKIP_RE = /^\s*(author:|serves?\b|yield\b|prep time\b|cook time\b|total time\b|notes?\s*:?\s*)\s*$/i;

const FRACTION_MAP = {"¼":"1/4","½":"1/2","¾":"3/4","⅐":"1/7","⅑":"1/9","⅒":"1/10","⅓":"1/3","⅔":"2/3","⅕":"1/5","⅖":"2/5","⅗":"3/5","⅘":"4/5","⅙":"1/6","⅚":"5/6","⅛":"1/8","⅜":"3/8","⅝":"5/8","⅞":"7/8"};
function normalizeFractions(s) { return s.replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (m) => FRACTION_MAP[m] || m); }
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
    )
  ).trim();
}

/* ---------------- Chef Notes (sentinel + extraction) ---------------- */
const NOTE_SENTINEL = "⟦NOTE⟧ ";
const NOTE_LINE_RE = /^\s*(?:[-*]\s*)?(?:note|tip|chef['’]?\s*s?\s*note)\s*[:.]\s*/i;
const NOTE_INLINE_LABEL_RE = /\s*[—–-]\s*(?:note|tip|chef['’]?\s*s?\s*note)\s*[:.]\s*/i;
const NOTE_CUE_RE = /^(?:be\s+careful|don['’]t|do\s+not|avoid|keep\b|make\s+sure|watch\s+for|ensure|if\b)/i;

const isNoteSentinel = (s) => typeof s === "string" && s.startsWith(NOTE_SENTINEL);
const toNoteSentinel = (txt) => NOTE_SENTINEL + txt.trim();
const fromNoteSentinel = (s) => s.replace(NOTE_SENTINEL, "").trim();

/** Try to split an action line into {action, note?}. Safe heuristics only. */
function extractActionAndNote(src) {
  let line = src.trim();

  // 0) Explicit: “Note:” line
  if (NOTE_LINE_RE.test(line)) {
    return { action: "", note: line.replace(NOTE_LINE_RE, "").trim() };
  }

  // 1) “— Note: …” label inline
  if (NOTE_INLINE_LABEL_RE.test(line)) {
    const [a, n] = line.split(NOTE_INLINE_LABEL_RE);
    return { action: a.trim(), note: cleanLine(n || "") };
  }

  // 2) Dash/semicolon tail with cue words on the right
  const dashSplit = line.split(/\s[—–-]\s/);
  if (dashSplit.length >= 2) {
    const rhs = dashSplit.slice(1).join(" — ").trim();
    if (NOTE_CUE_RE.test(rhs)) {
      return { action: dashSplit[0].trim(), note: rhs.replace(/^(?:note|tip)\s*[:.]\s*/i, "").trim() };
    }
  }
  const semiSplit = line.split(/\s*;\s*/);
  if (semiSplit.length >= 2) {
    const tail = semiSplit[semiSplit.length - 1].trim();
    if (NOTE_CUE_RE.test(tail)) {
      return { action: semiSplit.slice(0, -1).join("; ").trim(), note: tail };
    }
  }

  // 3) Trailing (…) whose content looks like a note
  const paren = line.match(/^(.*)\(([^)]+)\)\s*$/);
  if (paren) {
    const body = paren[2].trim();
    if (NOTE_CUE_RE.test(body)) {
      return { action: paren[1].trim(), note: body };
    }
  }

  // 4) Leading conditional: “If …, <do X>”
  const cond = line.match(/^\s*If\b([^,]+),\s*(.+)$/i);
  if (cond) {
    const action = cond[2].trim();
    const note = `If${cond[1]}.`.replace(/\s+/g, " ").trim();
    return { action, note };
  }

  return { action: line, note: "" };
}

/* ---------------- Prefilter (with note extraction) ---------------- */
function prefilterLines(rawText) {
  const src = rawText.split(/\r?\n/);
  let inIngredients = false;
  let seenDirections = false;

  const out = [];
  for (let raw of src) {
    let line = normalizeText(raw);
    if (!line) continue;

    // Standalone labeled note
    if (NOTE_LINE_RE.test(line)) {
      const body = line.replace(NOTE_LINE_RE, "").trim();
      if (body) out.push(toNoteSentinel(body));
      continue;
    }

    if (META_SKIP_RE.test(line)) continue;
    if (SECTION_START_ING.test(line)) { inIngredients = true; continue; }
    if (SECTION_START_DIRS.test(line)) { inIngredients = false; seenDirections = true; continue; }
    if (inIngredients || (!seenDirections && ING_LIKE_RE.test(line))) continue;
    if (/^•\s+/.test(line) && ING_LIKE_RE.test(line)) continue;

    // Main cleanup
    line = stripStepPrefix(line);
    line = coerceDurationSuffix(line);
    if (!line || /^step\s*\d+\s*$/i.test(line)) continue;
    line = cleanLine(line);

    // Action + (optional) note
    const { action, note } = extractActionAndNote(line);
    if (action) out.push(action);
    if (note) out.push(toNoteSentinel(note));
  }

  return out.length ? out : src.map((l) => l.trim()).filter(Boolean);
}

/* ---------------- Action explosion (notes are skipped) ---------------- */
function explodeActions(lines) {
  const out = [];
  const ABBRV = /(?:e\.g|i\.e|approx|vs|min|hr|hrs)\.$/i;

  for (let raw of lines) {
    if (!raw) continue;
    if (isNoteSentinel(raw)) { out.push(raw); continue; }

    // mask (…) to avoid splitting inside
    const masks = [];
    let masked = "", depth = 0, buf = "";
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

/* --------------------------------------------------------------------- */

export default function AuthoringPanel({ onLoadMeal }) {
  const [text, setText] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");
  const [autoDeps, setAutoDeps] = useState(true);
  const [roundAbout, setRoundAbout] = useState(true);
  const [useOntology, setUseOntology] = useState(false); // placeholder
  const [preview, setPreview] = useState([]);

  const rows = useMemo(() => explodeActions(prefilterLines(text)), [text]);

  async function importFromUrlOrHtml() {
    const packs = await getPacks();
    const draft = await ingestFromUrlOrHtml(text, packs);
    setText(draft);
  }

  function parseLines() {
    const tasks = rows.map((raw, idx) => {
      if (isNoteSentinel(raw)) {
        const body = fromNoteSentinel(raw);
        return {
          id: `draft_${idx + 1}`,
          name: body,
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

      const line = cleanLine(raw);
      const vMeta = findVerbSmart(line);
      const verb = vMeta?.name || "free_text";
      let durMin = parseDurationMin(line);
      if (roundAbout && durMin != null) durMin = Math.max(1, Math.round(durMin));
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
        if (tasks[i].is_note) continue;
        const prev = tasks[i - 1];
        if (prev && !prev.is_note) tasks[i].edges.push({ from: prev.id, type: "FS" });
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
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.6.8)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={parseLines}>Parse → Draft</button>
          <button onClick={loadAsMeal}>Load into Preview</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12, alignItems: "start", marginTop: 8, marginBottom: 8 }}>
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="One step per line… or paste a URL/HTML, then click “Import from URL/HTML”."
            style={{ width: "100%", minHeight: 190, border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", boxSizing: "border-box", resize: "vertical", background: "#fff" }}
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
            style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", marginBottom: 8, boxSizing: "border-box", background: "#fff" }}
          />
          <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.5, marginBottom: 10 }}>
            Tip: durations like “— 3 min” are optional — packs provide sensible defaults per verb.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={autoDeps} onChange={(e) => setAutoDeps(e.target.checked)} />
              Auto-create sequential dependencies (FS)
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={roundAbout} onChange={(e) => setRoundAbout(e.target.checked)} />
              Round “about/approx/range” durations up
            </label>

            <label title="Prototype only — not used yet" style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.8 }}>
              <input type="checkbox" checked={useOntology} onChange={(e) => setUseOntology(e.target.checked)} />
              (Experimental) Upgrade verbs via ontology
            </label>

            <button onClick={importFromUrlOrHtml}>Import from URL/HTML</button>
          </div>
        </div>
      </div>

      {/* Preview */}
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
            {(preview.length
              ? preview
              : rows.map((line, i) => ({ name: isNoteSentinel(line) ? fromNoteSentinel(line) : line, _row: i, is_note: isNoteSentinel(line) }))
            ).map((t, i) => {
              const idx = i + 1;
              const isNote = t.is_note === true;
              const resolvedVerb = isNote ? "🗒️ note" : (t.canonical_verb || findVerbByPack(t.name)?.name || "free_text");
              const planned = isNote ? "—" : (t.planned_min ?? DEFAULTS_BY_VERB[resolvedVerb] ?? "");
              const attention = isNote
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
                    {isNote ? <span style={{ fontSize: 12, color: "#6b7280" }}>—</span> : (
                      <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #d1d5db", background: attention === "attended" ? "#eef5ff" : "#ecfdf5", fontSize: 12 }}>
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

const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", fontWeight: 600 };
const td = { padding: "8px 10px", borderBottom: "1px solid #f1f5f9" };