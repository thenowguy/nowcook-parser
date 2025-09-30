/* eslint-disable */
import React, { useMemo, useState } from "react";

// Packs (reuse same packs you ship with the app)
import VERB_PACK from "../packs/verbs.en.json";
import DURATIONS_PACK from "../packs/durations.en.json";
import SYNONYMS_PACK from "../packs/synonyms.en.json"; // optional

// --------------------------- tiny helpers ---------------------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const uuid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `task_${Math.random().toString(36).slice(2, 10)}`);

// Canon from verbs pack (shape-agnostic)
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

function findVerb(text) {
  for (const v of CANONICAL) {
    for (const re of v.patterns) {
      if (re.test(text)) return v;
    }
  }
  return null;
}
const toDurationObj = (min) => (min == null ? null : { value: Math.max(1, Math.round(min)) });
const getPlannedMinutes = (t) => {
  if (!t) return 1;
  const explicit = t?.duration_min?.value;
  const planned  = t?.planned_min;
  const byVerb   = DEFAULTS_BY_VERB?.[t?.canonical_verb];
  const val = explicit ?? planned ?? byVerb ?? 1;
  return Math.max(1, Math.round(val));
};

function parseDurationMin(s) {
  const m = s.match(/(\d+)\s*(?:min|minutes?)/i);
  return m ? clamp(parseInt(m[1], 10), 1, 24 * 60) : null;
}

// --------------------------- mini editors ---------------------------
const DURATION_PRESETS = [1,2,3,5,8,10,12,15,20,25,30,40,45,50,60];

function DurationEditor({ valueMin, onChange, disabled }) {
  const val = valueMin == null ? "" : String(valueMin);
  return (
    <select
      disabled={disabled}
      value={val}
      onChange={(e) => {
        const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
        onChange(v == null ? null : Math.max(1, v));
      }}
    >
      <option value="">—</option>
      {DURATION_PRESETS.map((m) => (<option key={m} value={m}>{m} min</option>))}
    </select>
  );
}

function VerbEditor({ value, onChange }) {
  const options = ["free_text", ...CANONICAL.map((v) => v.name)];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((v) => (<option key={v} value={v}>{v}</option>))}
    </select>
  );
}

// --------------------------- core: line → task ---------------------------
function lineToTask(text) {
  const verbMeta = findVerb(text);
  const verb = verbMeta?.name || "free_text";
  const durMin = parseDurationMin(text);
  const packDefault = verbMeta?.default_planned ?? DEFAULTS_BY_VERB[verb] ?? null;
  const planned_min = durMin ?? packDefault ?? null;
  const requires_driver = verbMeta ? verbMeta.attention === "attended" : true;
  const self_running_after_start = verbMeta ? verbMeta.attention === "unattended_after_start" : false;
  return {
    id: uuid(),
    name: text.replace(/\.$/, ""),
    canonical_verb: verb,
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

// --------------------------- component ---------------------------
export default function AuthorIngestPanel({ onLoadMeal }) {
  const [open, setOpen] = useState(true);
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [autoDeps, setAutoDeps] = useState(true);

  const [draft, setDraft] = useState(null); // {meta, tasks}

  const parsedTasks = useMemo(() => {
    if (!raw.trim()) return [];
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(lineToTask);
  }, [raw]);

  function makeAutoDeps(tasks) {
    if (!autoDeps) return tasks;
    return tasks.map((t, i) => {
      const edges = i === 0 ? [] : [{ from: tasks[i-1].id, type: "FS" }];
      return { ...t, edges };
    });
  }

  function createDraft() {
    const tasks = makeAutoDeps(parsedTasks);
    const meal = {
      title: title || "Untitled Meal",
      author: { name: "Author" },
      tasks,
      meta: { packs_meta: { synonyms: SYNONYMS_PACK || {} } }
    };
    setDraft(meal);
  }

  function updateTask(idx, patch) {
    setDraft((prev) => {
      if (!prev) return prev;
      const tasks = prev.tasks.map((t, i) => i === idx ? { ...t, ...patch } : t);
      return { ...prev, tasks };
    });
  }

  function loadIntoPreview() {
    if (!draft) return;
    onLoadMeal?.(draft);
  }

  const warnings = useMemo(() => {
    if (!draft) return [];
    const w = [];
    draft.tasks.forEach((t, i) => {
      const p = getPlannedMinutes(t);
      if (!Number.isFinite(p) || p <= 0) w.push(`Task ${i+1} has no duration.`);
      if (!t.name?.trim()) w.push(`Task ${i+1} has no name.`);
    });
    return w;
  }, [draft]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Author Ingestion (v1.0)</div>
        <button onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show"}</button>
      </div>

      {open && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, marginTop: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Recipe text (one step per line)</label>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={`Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n...`}
                rows={8}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, fontFamily: "system-ui, sans-serif" }}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <input type="checkbox" checked={autoDeps} onChange={(e) => setAutoDeps(e.target.checked)} />
                  Auto-create sequential dependencies (FS)
                </label>
                <button onClick={createDraft} disabled={parsedTasks.length === 0}>Parse → Draft</button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Meal title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Quick Pasta with Garlic Oil"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                Tip: leave durations out and the parser will use defaults from packs (verbs/durations).
              </div>
            </div>
          </div>

          {/* Live parse preview (read-only) */}
          {parsedTasks.length > 0 && !draft && (
            <div style={{ marginTop: 10, borderTop: "1px dashed #e5e7eb", paddingTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Quick parse preview</div>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {parsedTasks.map((t) => (
                  <li key={t.id} style={{ marginBottom: 4 }}>
                    {t.name} <span style={{ opacity: 0.7 }}>({t.canonical_verb}; planned {getPlannedMinutes(t)}m)</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Draft editor */}
          {draft && (
            <div style={{ marginTop: 12, borderTop: "1px dashed #e5e7eb", paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600 }}>Draft editor</div>
                <div>
                  <button onClick={() => setDraft(null)} style={{ marginRight: 8 }}>Clear draft</button>
                  <button onClick={loadIntoPreview} disabled={warnings.length > 0}>Load into preview</button>
                </div>
              </div>

              {warnings.length > 0 && (
                <div style={{ marginTop: 8, background: "#FFF7ED", border: "1px solid #FDBA74", color: "#9A3412", borderRadius: 8, padding: 8, fontSize: 14 }}>
                  <b>Fix before loading:</b>
                  <ul style={{ marginTop: 6, marginBottom: 0 }}>
                    {warnings.map((w, i) => (<li key={i}>{w}</li>))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "40px 1fr 180px 140px", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>#</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Task</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Verb</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Duration</div>

                {draft.tasks.map((t, i) => (
                  <React.Fragment key={t.id}>
                    <div>{i + 1}</div>
                    <input
                      value={t.name}
                      onChange={(e) => updateTask(i, { name: e.target.value })}
                      style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px" }}
                    />
                    <VerbEditor
                      value={t.canonical_verb}
                      onChange={(v) => {
                        const requires_driver = CANONICAL.find((x) => x.name === v)?.attention === "attended";
                        updateTask(i, { canonical_verb: v, requires_driver });
                      }}
                    />
                    <DurationEditor
                      valueMin={t?.duration_min?.value ?? t?.planned_min ?? DEFAULTS_BY_VERB[t.canonical_verb] ?? null}
                      onChange={(min) => updateTask(i, { duration_min: min == null ? null : { value: min }, planned_min: min })}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}