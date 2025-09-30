/* eslint-disable no-console */
import React, { useMemo, useState } from "react";

// Packs (relative to /src/components)
import VERB_PACK from "../packs/verbs.en.json";
import DURATIONS_PACK from "../packs/durations.en.json";
import SYNONYMS_PACK from "../packs/synonyms.en.json"; // not used yet, kept for future

// ---------------- tiny helpers ----------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const uuid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `task_${Math.random().toString(36).slice(2, 10)}`);

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

const DUR_DEFAULTS = Object.fromEntries(extractDurationEntries(DURATIONS_PACK));

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

function findVerb(text) {
  for (const v of CANONICAL) {
    for (const re of v.patterns) {
      if (re.test(text)) return v;
    }
  }
  return null;
}

// Accept things like: "— 3 min", "- 3min", "(3 minutes)", "for 5 min", "... 8min"
function parseDurationMin(s) {
  const m = s.match(
    /(?:-|—|\(|\bfor\s+)?\s*(\d+)\s*(?:min|mins|minutes?)\)?/i
  );
  return m ? clamp(parseInt(m[1], 10), 1, 24 * 60) : null;
}

const toDurationObj = (min) => (min == null ? null : { value: min });
const plannedMinutes = (task) => {
  const explicit = task?.duration_min?.value;
  const planned = task?.planned_min;
  const byVerb = DUR_DEFAULTS?.[task?.canonical_verb];
  const val = explicit ?? planned ?? byVerb ?? 1;
  return Math.max(1, Math.round(val));
};

// ---------------- parser ----------------
function lineToTask(line) {
  const text = line.replace(/\s+—\s*$/, "").trim();
  const durMin = parseDurationMin(text);

  const verbMeta = findVerb(text);
  const canonical = verbMeta?.name || "free_text";
  const requires_driver = verbMeta
    ? verbMeta.attention === "attended"
    : true;
  const self_running_after_start = verbMeta
    ? verbMeta.attention === "unattended_after_start"
    : false;

  let planned_min = null;
  if (durMin == null) {
    planned_min =
      verbMeta?.default_planned ??
      DUR_DEFAULTS[canonical] ??
      null;
  }

  return {
    id: uuid(),
    name: text.replace(/\.$/, ""),
    canonical_verb: canonical,
    duration_min: toDurationObj(durMin),
    planned_min,
    readiness_signal: null,
    requires_driver,
    self_running_after_start,
    inputs: [],
    outputs: [],
    edges: [],
  };
}

function parseRecipeToMeal({ title, raw, autoFS = true }) {
  const warnings = [];
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));

  const tasks = lines.map(lineToTask);

  // Warnings: unknown verb or no duration available anywhere
  tasks.forEach((t, i) => {
    if (t.canonical_verb === "free_text") {
      warnings.push(`Line ${i + 1}: unknown verb → marked as attended/free_text`);
    }
    if (
      t.duration_min == null &&
      t.planned_min == null
    ) {
      warnings.push(
        `Line ${i + 1}: no duration found and no default in packs (${t.name})`
      );
    }
  });

  // Edges: simple FS chain if requested
  if (autoFS) {
    for (let i = 1; i < tasks.length; i++) {
      const from = tasks[i - 1].id;
      tasks[i].edges.push({ from, type: "FS" });
    }
  }

  // Fill any missing planned using pack/default at the end (safety)
  tasks.forEach((t) => {
    if (t.planned_min == null && t.duration_min == null) {
      const byVerb = DUR_DEFAULTS?.[t.canonical_verb];
      if (Number.isFinite(byVerb)) t.planned_min = byVerb;
    }
  });

  const meal = {
    title: title?.trim() || "Untitled Meal",
    author: { name: "Draft (Author Panel)" },
    tasks,
    meta: {
      packs: { synonyms: SYNONYMS_PACK || {} },
      created_at: new Date().toISOString(),
      source: "author_ingest_v1",
    },
  };

  return { meal, warnings };
}

// ---------------- component ----------------
export default function AuthoringPanel({ onLoadMeal }) {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState("");
  const [raw, setRaw] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min"
  );
  const [autoFS, setAutoFS] = useState(true);
  const [lastWarnings, setLastWarnings] = useState([]);

  const parseAndLoad = () => {
    const { meal, warnings } = parseRecipeToMeal({ title, raw, autoFS });
    setLastWarnings(warnings);
    try {
      onLoadMeal?.(meal);
    } catch (e) {
      console.error("onLoadMeal failed:", e);
    }
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.0)</div>
        <button onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Show"}</button>
      </div>

      {open && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 10, marginTop: 8 }}>
            <div>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="One task per line…"
                rows={8}
                style={{
                  width: "100%",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 10,
                  fontFamily: "inherit",
                }}
              />
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                Recipe text (one step per line)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Meal title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Quick Pasta with Garlic Oil"
                style={{
                  width: "100%",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "6px 10px",
                  marginBottom: 10,
                }}
              />
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Tip: durations like “— 3 min” or “(5 minutes)” are optional; packs will fill defaults.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={autoFS}
                onChange={(e) => setAutoFS(e.target.checked)}
              />
              Auto-create sequential dependencies (FS)
            </label>
            <button onClick={parseAndLoad}>Parse → Draft</button>
          </div>

          {lastWarnings.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                border: "1px solid #fde68a",
                background: "#fffbeb",
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Parsed with {lastWarnings.length} warning{lastWarnings.length > 1 ? "s" : ""}:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {lastWarnings.map((w, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}