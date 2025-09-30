/* eslint-disable react/prop-types */
/* eslint-disable no-console */
import React, { useMemo, useState } from "react";

// Packs (so preview uses the same defaults you run-time with)
import VERB_PACK from "../packs/verbs.en.json";
import DURATIONS_PACK from "../packs/durations.en.json";

// --- tiny local helpers (duplicated from App on purpose to keep this file standalone)
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const uuid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `task_${Math.random().toString(36).slice(2, 10)}`);

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

function parseDurationMin(s) {
  const m = s.match(/(?:—|-|–)\s*(\d+)\s*(?:min|minutes?)/i) || s.match(/(\d+)\s*(?:min|minutes?)/i);
  return m ? clamp(parseInt(m[1], 10), 1, 24 * 60) : null;
}
function findVerb(text) {
  for (const v of CANONICAL) {
    for (const re of v.patterns) {
      if (re.test(text)) return v;
    }
  }
  return null;
}
const toDurationObj = (min) => (min == null ? null : { value: min });
const getPlannedMinutes = (t) => {
  if (!t) return 1;
  const explicit = t?.duration_min?.value;
  const planned  = t?.planned_min;
  const byVerb   = DEFAULTS_BY_VERB?.[t?.canonical_verb];
  const val = explicit ?? planned ?? byVerb ?? 1;
  return Math.max(1, Math.round(val));
};

// ----------------------------------------------------------------------------

export default function AuthoringPanel({ onLoadMeal }) {
  const [open, setOpen] = useState(true);
  const [autoChainFS, setAutoChainFS] = useState(true);

  const [raw, setRaw] = useState(
    // tiny starter to make the panel feel alive
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");

  // Live parse (preview only)
  const previewTasks = useMemo(() => {
    const lines = String(raw || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && s !== "…" && s !== "...")
      .slice(0, 200);

    const tasks = [];
    for (const line of lines) {
      const verbMeta = findVerb(line);
      const verb = verbMeta?.name || "free_text";
      const durMin = parseDurationMin(line);
      const planned_min =
        durMin ??
        verbMeta?.default_planned ??
        DEFAULTS_BY_VERB[verb] ??
        null;

      const requires_driver = verbMeta ? verbMeta.attention === "attended" : true;

      tasks.push({
        id: uuid(),
        name: line.replace(/\s*(?:—|-|–)\s*\d+\s*(?:min|minutes?)\s*$/i, "").replace(/\.$/, ""),
        canonical_verb: verb,
        duration_min: toDurationObj(durMin),
        planned_min,
        readiness_signal: null,
        requires_driver,
        self_running_after_start: !requires_driver,
        inputs: [],
        outputs: [],
        edges: [],
      });
    }

    // simple FS chain for preview
    if (autoChainFS) {
      for (let i = 1; i < tasks.length; i++) {
        tasks[i].edges.push({ type: "FS", from: tasks[i - 1].id });
      }
    }

    return tasks;
  }, [raw, autoChainFS]);

  const minWidthCell = { minWidth: 60 };

  const doParseToDraft = () => {
    const tasks = previewTasks;
    const meal = {
      title: title?.trim() || "Untitled meal",
      author: { name: "Author" },
      tasks,
      meta: { createdAt: new Date().toISOString() },
    };
    if (typeof onLoadMeal === "function") onLoadMeal(meal);
  };

  if (!open) {
    return (
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#fafafa", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Author Ingestion (v1.0)</div>
          <button onClick={() => setOpen(true)}>Show</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Author Ingestion (v1.0)</div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="One step per line…"
            rows={8}
            style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, fontFamily: "system-ui, sans-serif" }}
          />
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Recipe text (one step per line)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={autoChainFS} onChange={(e) => setAutoChainFS(e.target.checked)} />
              Auto-create sequential dependencies (FS)
            </label>
            <button onClick={doParseToDraft}>Parse → Draft</button>
          </div>
        </div>

        <div style={{ width: 360 }}>
          <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>Meal title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Quick Pasta with Garlic Oil"
            style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}
          />
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
            Tip: durations like “— 3 min” are optional — packs provide sensible defaults per verb.
          </div>
          <div style={{ textAlign: "right", marginTop: 8 }}>
            <button onClick={() => setOpen(false)}>Hide</button>
          </div>
        </div>
      </div>

      {/* Inline parse preview */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Preview</div>
        {previewTasks.length === 0 ? (
          <div style={{ fontSize: 14, color: "#6b7280" }}>Nothing to preview yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>Step</th>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>Verb</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", ...minWidthCell }}>Planned (min)</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", ...minWidthCell }}>Attention</th>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>Depends on</th>
                </tr>
              </thead>
              <tbody>
                {previewTasks.map((t, i) => {
                  const planned = getPlannedMinutes(t);
                  const depends = (t.edges || [])
                    .filter((e) => e?.type === "FS")
                    .map((e) => {
                      const idx = previewTasks.findIndex((x) => x.id === e.from);
                      return idx >= 0 ? `#${idx + 1}` : "";
                    })
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr key={t.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "6px 10px", color: "#6b7280" }}>{i + 1}</td>
                      <td style={{ padding: "6px 10px" }}>{t.name}</td>
                      <td style={{ padding: "6px 10px", color: "#334155" }}>{t.canonical_verb}</td>
                      <td style={{ padding: "6px 10px" }}>{planned}</td>
                      <td style={{ padding: "6px 10px" }}>
                        {t.requires_driver ? (
                          <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #cbd5e1" }}>attended</span>
                        ) : (
                          <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f0fdf4" }}>
                            unattended
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "6px 10px", color: "#64748b" }}>{depends || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}