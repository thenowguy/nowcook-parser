/* AuthoringPanel.jsx — v1.6.14 (Phase 1.6e)
   Fixes:
     • Qualifier lines (While/When/If/After/Before/Until/…) now split into note + action
       BEFORE treating them as pure notes.
     • Expanded imperative detector: peel, mince, chop, slice, grate, season, set, put,
       melt, transfer, use, toss, etc.
     • Notes now auto-depend on the previous task so they stay visually attached.
   Keeps prior phases (cleanup, fractions, action-splitting, duration rounding, packs, optional ontology).
*/
/* eslint-disable */
import React, { useMemo, useState } from "react";

import { ingestFromUrlOrHtml } from "../ingestion/url_or_text.js";
import { getPacks } from "../ingestion/packs_bridge.js";

// Optional ontology bridge
let mapVerbOntology = null;
try {
  const ob = await import("../ingestion/ontology_bridge.js");
  mapVerbOntology = ob?.mapVerb || null;
} catch (_) {}

import VERB_PACK from "../packs/verbs.en.json";
import DURATIONS_PACK from "../packs/durations.en.json";

/* ---------------- Canonical verbs ---------------- */
const VERBS_ARRAY = Array.isArray(VERB_PACK) ? VERB_PACK : Array.isArray(VERB_PACK?.verbs) ? VERB_PACK.verbs : [];
const CANONICAL =
  VERBS_ARRAY.map((v) => ({
    name: v.canon,
    attention: v.attention,
    patterns: (v.patterns || []).map((p) => new RegExp(p, "i")),
    default_planned: v?.defaults?.planned_min ?? null,
  })) ?? [];
const CANON_BY_NAME = new Map(CANONICAL.map((v) => [String(v.name).toLowerCase(), v]));

/* ---------------- Duration defaults ---------------- */
function extractDurationEntries(pack) {
  const asEntryList = (arr) =>
    (arr || [])
      .filter((d) => d && (d.verb || d.canon || d.name))
      .map((d) => [d.verb ?? d.canon ?? d.name, d.planned_min ?? d.default_planned ?? d.min ?? d.value])
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

/* ---------------- Verb matching ---------------- */
const findVerbByPack = (text) => {
  for (const v of CANONICAL) for (const re of v.patterns) if (re.test(text)) return v;
  return null;
};
const HEUR_RULES = [
  { re: /\b(sauté|saute|brown|cook\s+(?:until|till)\s+(?:soft|softened|translucent))\b/i, canon: "sauté" },
  { re: /\b(stir|mix|combine|whisk)\b/i, canon: "stir" },
  { re: /\b(add|stir\s+in|fold\s+in|pour\s+in)\b/i, canon: "add" },
  { re: /\b(bring .* to a boil|boil)\b/i, canon: "boil" },
  { re: /\b(simmer|reduce heat(?: to (?:low|medium-low))?)\b/i, canon: "simmer" },
  { re: /\b(season(?:\s+to\s+taste)?)\b/i, canon: "season" },
  { re: /\b(drain|strain)\b/i, canon: "drain" },
  { re: /\b(serve|plate)\b/i, canon: "plate" },
  { re: /\b(slice|chop|mince|dice|peel|grate)\b/i, canon: "slice" },
  { re: /\b(preheat)\b/i, canon: "preheat" },
  { re: /\b(bake|roast)\b/i, canon: "bake" },
  { re: /\b(toss)\b/i, canon: "toss" },
];
function guessVerbHeuristic(text) {
  if (!text) return null;
  for (const r of HEUR_RULES) if (r.re.test(text)) return CANON_BY_NAME.get(r.canon.toLowerCase()) || null;
  return null;
}
function findVerbSmart(text, useOntologyUpgrade) {
  let meta = findVerbByPack(text) || guessVerbHeuristic(text);
  if (useOntologyUpgrade && mapVerbOntology) {
    const up = mapVerbOntology(text, meta?.name || null);
    if (up && CANON_BY_NAME.has(String(up).toLowerCase())) meta = CANON_BY_NAME.get(String(up).toLowerCase());
  }
  return meta;
}

/* ---------------- Helpers ---------------- */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const toDurationObj = (min) => (min == null ? null : { value: min });

function parseDurationMin(input, roundAbout) {
  if (!input) return null;
  const s = String(input).toLowerCase().replace(/[–—]/g, "-");
  const mRange = s.match(/(?:~|about|approx(?:\.|imately)?|around)?\s*(\d{1,4})\s*(?:-|to)\s*(\d{1,4})\s*m(?:in(?:ute)?s?)?\b/);
  if (mRange) {
    const a = parseInt(mRange[1], 10), b = parseInt(mRange[2], 10);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    const val = roundAbout ? hi : Math.round((lo + hi) / 2);
    return clamp(val, 1, 24 * 60);
  }
  const mSingle = s.match(/(?:(~|about|approx(?:\.|imately)?|around)\s*)?(\d{1,4})\s*m(?:in(?:ute)?s?)?\b/);
  if (mSingle) {
    const approx = !!mSingle[1];
    const v = parseInt(mSingle[2], 10);
    const val = roundAbout && approx ? Math.ceil(v) : v;
    return clamp(val, 1, 24 * 60);
  }
  return null;
}

/* ---------------- Phase 1.1 cleanup ---------------- */
function normalizeText(s) {
  return s.replace(/\u2013|\u2014/g, "—").replace(/\u2022|\u25CF|\u2219|\*/g, "•").replace(/\s+/g, " ").trim();
}
function stripStepPrefix(s) { return s.replace(/^\s*step\s*\d+\s*[:.\-\u2013\u2014]\s*/i, ""); }
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
const UNIT="(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|g|gram|grams|kg|ml|l|liters?|pounds?|lbs?|cloves?|sticks?|slices?|dash|pinch|sprigs?|leaves?)";
const AMOUNT="(?:\\d+\\/\\d+|\\d+(?:\\.\\d+)?)";
const ING_LIKE_RE = new RegExp(`^(?:•\\s*)?(?:${AMOUNT}\\s*(?:${UNIT})\\b|\\d+\\s*(?:${UNIT})\\b)`,"i");
const META_SKIP_RE = /^\s*(author:|serves?\b|yield\b|prep time\b|cook time\b|total time\b|notes?:?)\s*/i;
const FRACTION_MAP={"¼":"1/4","½":"1/2","¾":"3/4","⅐":"1/7","⅑":"1/9","⅒":"1/10","⅓":"1/3","⅔":"2/3","⅕":"1/5","⅖":"2/5","⅗":"3/5","⅘":"4/5","⅙":"1/6","⅚":"5/6","⅛":"1/8","⅜":"3/8","⅝":"5/8","⅞":"7/8"};
function normalizeFractions(s){return s.replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g,(m)=>FRACTION_MAP[m]||m);}
const UNIT_WORDS="(?:cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|g|gram|grams|kg|ml|l|liter|liters|pound|pounds|lb|lbs)";
function stripMeasurementParens(s){
  return s.replace(/\(([^)]*)\)/g,(m,inside)=>{
    const t=inside.trim();
    if(/^\s*(?:about|around|approx\.?)?\s*\d+(?:\/\d+)?\s*(?:-?\s*\d+(?:\/\d+)?)?\s*/i.test(t)&&new RegExp(UNIT_WORDS,"i").test(t)){return "";}
    return m;
  });
}
function cleanLine(line){
  return normalizeFractions(
    stripMeasurementParens(
      line.replace(/^ingredients[:]?$/i,"")
          .replace(/^For the .*?:\s*/i,"")
          .replace(/^Step\s*\d+[:.]?\s*/i,"")
          .replace(/^[-*]?\s*Note[:.]?\s*/i,"")
    )
  ).trim();
}
function prefilterLines(rawText){
  const src=rawText.split(/\r?\n/);
  let inIngredients=false, seenDirections=false;
  const out=[];
  for(let raw of src){
    let line=normalizeText(raw);
    if(!line) continue;
    if(META_SKIP_RE.test(line)) continue;
    if(SECTION_START_ING.test(line)){inIngredients=true;continue;}
    if(SECTION_START_DIRS.test(line)){inIngredients=false;seenDirections=true;continue;}
    if(inIngredients||(!seenDirections&&ING_LIKE_RE.test(line))) continue;
    if(/^•\s+/.test(line)&&ING_LIKE_RE.test(line)) continue;
    line=stripStepPrefix(line);
    line=coerceDurationSuffix(line);
    if(!line||/^step\s*\d+\s*$/i.test(line)) continue;
    line=cleanLine(line);
    out.push(line);
  }
  return out.length?out:src.map((l)=>l.trim()).filter(Boolean);
}

/* ---------------- v1.5 action-splitting ---------------- */
const ABBRV=/(?:e\.g|i\.e|approx|vs|min|hr|hrs)\.$/i;
function explodeActions(lines){
  const out=[];
  for(let raw of lines){
    if(!raw) continue;
    const masks=[]; let masked=""; let depth=0, buf="";
    for(let i=0;i<raw.length;i++){
      const ch=raw[i];
      if(ch==="("){ if(depth===0&&buf){masked+=buf;buf="";} depth++; buf+=ch; }
      else if(ch===")"){ buf+=ch; depth=Math.max(0,depth-1);
        if(depth===0){ const token=`@@P${masks.length}@@`; masks.push(buf); masked+=token; buf=""; }
      } else { if(depth>0) buf+=ch; else masked+=ch; }
    }
    if(buf) masked+=buf;
    const parts=masked.split(/(?:\.\s+|;\s+|\s+(?:and\s+then|then)\s+)/i).map(p=>p.trim()).filter(Boolean);
    const unmasked=parts.map(p=>p.replace(/@@P(\d+)@@/g,(m,idx)=>masks[Number(idx)]||""));
    const merged=[];
    for(const p of unmasked){
      const seg=p.replace(/\s+/g," ").trim();
      if(seg.length<18 && merged.length){ merged[merged.length-1]=`${merged[merged.length-1].replace(/[.]\s*$/,"")}; ${seg}`;}
      else merged.push(seg);
    }
    for(const seg of merged){ if(!seg) continue; if(ABBRV.test(seg)){ out.push(raw); break; } else out.push(seg); }
  }
  return out;
}

/* ---------------- Chef Notes: improved splitter ---------------- */
// Leading qualifier patterns → note + action (if action is imperative)
const LEAD_QUALIFIER_RE = /^(?:when|while|once|after|before|until|if|unless|as soon as|meanwhile|during|as)\b[^,]*,\s*/i;
// Leading participle clause (“Stirring frequently, …”) → note + action
const LEAD_PARTICIPLE_RE = /^(?:stirring|cooking|simmering|whisking|mixing|seasoning|chopping|adding|working|continuing|heating|preheating|boiling|draining|baking|roasting)\b[^,]*,\s*/i;
// Tail advisory → note
const NOTE_TAIL_RE = /\b(?:be careful|do(?:n’|')t\b|do not\b|avoid\b|so it\b|so they\b|so you\b|as needed\b|if needed\b|if desired\b|if using\b|to taste\b)\b/i;
// Soft note lead
const NOTE_LEAD_RE = /^note[:.]?\s*/i;

// **Expanded** imperative detector (for splitting only)
const IMPERATIVE_RE = /\b(?:add|stir|mix|combine|whisk|cook|sauté|saute|simmer|reduce|increase|bring|boil|drain|strain|season|transfer|remove|plate|serve|heat|preheat|peel|mince|chop|slice|grate|set|put|melt|use|toss)\b/i;

function splitActionAndNote(line){
  if(!line) return {action: line, note: null};

  // 1) Qualifier at start? (While/When/If/After/Before/Until/…,)
  if (LEAD_QUALIFIER_RE.test(line)) {
    const idx = line.indexOf(",");
    const lead = line.slice(0, idx).trim();
    const rest = line.slice(idx + 1).trim();
    if (IMPERATIVE_RE.test(rest)) return { action: rest, note: lead };
    // no imperative on right → whole line is a note
    return { action: null, note: line };
  }

  // 2) Leading participle clause?
  if (LEAD_PARTICIPLE_RE.test(line)) {
    const idx = line.indexOf(",");
    const lead = line.slice(0, idx).trim();
    const rest = line.slice(idx + 1).trim();
    if (IMPERATIVE_RE.test(rest)) return { action: rest, note: lead };
    return { action: null, note: line };
  }

  // 3) Explicit "Note:" lead after other checks
  if (NOTE_LEAD_RE.test(line)) {
    const cleaned = line.replace(NOTE_LEAD_RE, "").trim();
    return { action: null, note: cleaned || line };
  }

  // 4) “; then <verb …>” or “; <verb …>”
  const semi = line.split(/;\s*(?:then\s+)?/i);
  if (semi.length === 2 && IMPERATIVE_RE.test(semi[1])) {
    return { action: semi[1].trim(), note: semi[0].trim() };
  }

  // 5) “, then <verb …>”
  const thenMatch = line.match(/,?\s+then\s+(.+)$/i);
  if (thenMatch && IMPERATIVE_RE.test(thenMatch[1])) {
    const before = line.slice(0, thenMatch.index).replace(/,\s*$/,"").trim();
    return { action: thenMatch[1].trim(), note: before || null };
  }

  // 6) Advisory tails
  const mDash=line.match(/\s[–—-]\s(.+)$/);
  if(mDash && NOTE_TAIL_RE.test(mDash[1])){
    return {action: line.replace(/\s[–—-]\s(.+)$/,"").trim(), note: mDash[1].trim()};
  }
  const semiIdx=line.lastIndexOf("; ");
  if(semiIdx>0){
    const head=line.slice(0,semiIdx).trim(); const tail=line.slice(semiIdx+2).trim();
    if(NOTE_TAIL_RE.test(tail)) return {action: head, note: tail};
  }
  const commaIdx=line.lastIndexOf(", ");
  if(commaIdx>0){
    const head=line.slice(0,commaIdx).trim(); const tail=line.slice(commaIdx+2).trim();
    if(NOTE_TAIL_RE.test(tail)) return {action: head, note: tail};
  }

  return {action: line, note: null};
}

/* ---------------- Component ---------------- */
export default function AuthoringPanel({ onLoadMeal }) {
  const [text, setText] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");
  const [autoDeps, setAutoDeps] = useState(true);
  const [roundAbout, setRoundAbout] = useState(true);
  const [useOntology, setUseOntology] = useState(false);
  const [preview, setPreview] = useState([]);

  const rows = useMemo(() => explodeActions(prefilterLines(text)), [text]);

  async function importFromUrlOrHtml() {
    const packs = await getPacks();
    const draft = await ingestFromUrlOrHtml(text, packs);
    setText(draft);
  }

  function parseLines() {
    const tasks = [];
    let idx = 0;
    let lastTaskId = null;

    for (const raw of rows) {
      const line = cleanLine(raw);
      if (!line) continue;

      const { action, note } = splitActionAndNote(line);

      // Pure note line
      if (!action && note) {
        idx += 1;
        const noteTask = {
          id: `draft_${idx}`,
          name: note,
          is_note: true,
          canonical_verb: "note",
          duration_min: null,
          planned_min: null,
          requires_driver: false,
          self_running_after_start: false,
          inputs: [],
          outputs: [],
          edges: [],
        };
        if (lastTaskId) noteTask.edges.push({ from: lastTaskId, type: "FS" });
        tasks.push(noteTask);
        continue;
      }

      const useText = action || line;
      const vMeta = findVerbSmart(useText, useOntology);
      const verb = vMeta?.name || "free_text";
      const durMin = parseDurationMin(useText, roundAbout);
      const planned_min = durMin ?? vMeta?.default_planned ?? DEFAULTS_BY_VERB[verb] ?? null;

      idx += 1;
      const mainTask = {
        id: `draft_${idx}`,
        name: useText.replace(/\s*—\s*\d+\s*min(?:utes?)?$/i, ""),
        canonical_verb: verb,
        duration_min: toDurationObj(durMin),
        planned_min,
        requires_driver: vMeta ? vMeta.attention === "attended" : true,
        self_running_after_start: vMeta ? vMeta.attention === "unattended_after_start" : false,
        inputs: [],
        outputs: [],
        edges: [],
      };
      if (autoDeps && lastTaskId) mainTask.edges.push({ from: lastTaskId, type: "FS" });
      tasks.push(mainTask);
      lastTaskId = mainTask.id;

      if (note) {
        idx += 1;
        const noteTask = {
          id: `draft_${idx}`,
          name: note,
          is_note: true,
          canonical_verb: "note",
          duration_min: null,
          planned_min: null,
          requires_driver: false,
          self_running_after_start: false,
          inputs: [],
          outputs: [],
          edges: [{ from: mainTask.id, type: "FS" }],
        };
        tasks.push(noteTask);
        lastTaskId = noteTask.id;
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
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.6.14)</div>
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

            <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: mapVerbOntology ? 1 : 0.5 }}>
              <input type="checkbox" disabled={!mapVerbOntology} checked={useOntology} onChange={(e) => setUseOntology(e.target.checked)} />
              (Experimental) Upgrade verbs via ontology
            </label>

            <button onClick={importFromUrlOrHtml}>Import from URL/HTML</button>
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
            {(preview.length ? preview : rows.map((line, i) => ({ name: line, _row: i })) ).map((t, i) => {
              const idx = i + 1;

              if (t.is_note) {
                const dep = t.edges?.[0]?.from ? `#${Number(String(t.edges[0].from).split("_").pop())}` : "—";
                return (
                  <tr key={`note_${idx}`} style={{ background: i % 2 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)" }}>
                    <td style={td}>{idx}</td>
                    <td style={{ ...td, paddingLeft: 28, fontStyle: "italic", color: "#475569", borderLeft: "3px solid #dbeafe", background: "rgba(59,130,246,0.04)" }}>
                      <span style={{ opacity: 0.9, marginRight: 6 }}>🗒️</span>
                      {t.name}
                    </td>
                    <td style={td}>note</td>
                    <td style={td}>—</td>
                    <td style={td}>—</td>
                    <td style={td}>{dep}</td>
                  </tr>
                );
              }

              const verb = t.canonical_verb || findVerbByPack(t.name)?.name || "free_text";
              const planned = t.planned_min ?? DEFAULTS_BY_VERB[verb] ?? "";
              const attention =
                t.requires_driver != null
                  ? t.requires_driver ? "attended" : "unattended"
                  : (findVerbByPack(t.name)?.attention === "unattended_after_start" ? "unattended" : "attended");
              const dep = t.edges?.[0]?.from ? `#${Number(String(t.edges[0].from).split("_").pop())}` : "—";

              return (
                <tr key={idx} style={{ background: i % 2 ? "rgba(255,255,255,0.45)" : "transparent" }}>
                  <td style={td}>{idx}</td>
                  <td style={td}>{t.name || t}</td>
                  <td style={td}>{verb}</td>
                  <td style={td}>{planned || "—"}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #d1d5db", background: attention === "attended" ? "#eef5ff" : "#ecfdf5", fontSize: 12 }}>
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

const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", fontWeight: 600 };
const td = { padding: "8px 10px", borderBottom: "1px solid #f1f5f9" };