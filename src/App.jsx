// ============================== NowCook Parser — v1.8.3 ==============================
// v1.8.3 = v1.8.2 + grace fade for finished tasks (keeps lane briefly, then disappears)
//  - Finished bars stay in-place for GRACE_MS and fade out; after that, lanes compact.
//  - Running lanes remain stable (ordered by startedAt).
//  - Concurrency, manual completion, queue hint, exports unchanged.
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import AuthorIngestPanel from "./components/AuthorIngestPanel.jsx";

// ----------------------------------------------------------------------
// Packs (src/packs)
// ----------------------------------------------------------------------
import VERB_PACK from "./packs/verbs.en.json";
import DURATIONS_PACK from "./packs/durations.en.json";
import READINESS_PACK from "./packs/readiness.en.json";   // reserved (not used yet)
import SYNONYMS_PACK from "./packs/synonyms.en.json";     // optional

// ----------------------------------------------------------------------
// Sample meals (src/meals) — underscore filenames
// ----------------------------------------------------------------------
import MEAL_PASTA from "./meals/quick_pasta.json";
import MEAL_ROAST from "./meals/roast_chicken.json";
import MEAL_STEW  from "./meals/slow_beef_stew.json";

// ----------------------------------------------------------------------
// Tiny helpers
// ----------------------------------------------------------------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mmss = (ms) => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};
const minToMs = (m) => (m == null ? 0 : Math.max(0, Math.round(m))) * 60_000;
const uuid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `task_${Math.random().toString(36).slice(2, 10)}`);

// ----------------------------------------------------------------------
// Canon & defaults from packs (shape-agnostic)
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// Synonyms (optional; exposed on meal.meta for later use)
// ----------------------------------------------------------------------
const SYNONYMS = (() => {
  const pack = SYNONYMS_PACK;
  if (!pack) return {};
  if (Array.isArray(pack)) {
    if (pack.length && Array.isArray(pack[0])) {
      return Object.fromEntries(
        pack
          .filter((t) => Array.isArray(t) && t.length === 2 && typeof t[0] === "string")
          .map(([head, aliases]) => [String(head).toLowerCase(), Array.isArray(aliases) ? aliases : []])
      );
    }
    return Object.fromEntries(
      pack
        .filter((x) => x && typeof x.head === "string")
        .map((x) => [x.head.toLowerCase(), Array.isArray(x.aliases) ? x.aliases : []])
    );
  }
  if (typeof pack === "object") {
    return Object.fromEntries(
      Object.entries(pack).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v : []])
    );
  }
  return {};
})();

// ----------------------------------------------------------------------
// Parse helpers (kept for future paste-mode)
// ----------------------------------------------------------------------
function parseDurationMin(s) {
  const m = s.match(/(\d+)\s*(?:min|minutes?)/i);
  return m ? clamp(parseInt(m[1], 10), 1, 24 * 60) : null;
}
function parseReadiness(_s) { return null; }
function findVerb(text) {
  for (const v of CANONICAL) {
    for (const re of v.patterns) {
      if (re.test(text)) return v;
    }
  }
  return null;
}
const toDurationObj = (min) => (min == null ? null : { value: min });

// Prefer explicit per-task duration over planned/defaults; return integer minutes >= 1
const getPlannedMinutes = (t) => {
  if (!t) return 1;
  const explicit = t?.duration_min?.value;
  const planned  = t?.planned_min;
  const byVerb   = DEFAULTS_BY_VERB?.[t?.canonical_verb];
  const val = explicit ?? planned ?? byVerb ?? 1;
  return Math.max(1, Math.round(val));
};

// (kept for completeness)
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
    readiness_signal: parseReadiness(text),
    requires_driver,
    self_running_after_start,
    inputs: [],
    outputs: [],
    edges: [],
  };
}

// ----------------------------------------------------------------------
// Minimum makespan (critical path across FS/FF/SF; SS imposes no finish wait)
// ----------------------------------------------------------------------
function computeCriticalPathMin(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  const idxById = new Map(tasks.map((t, i) => [t.id, i]));
  const planned = (t) => getPlannedMinutes(t);
  const finishPreds = tasks.map((t) =>
    (t.edges || [])
      .filter((e) => e && idxById.has(e.from) && e.type !== "SS")
      .map((e) => idxById.get(e.from))
  );
  const memo = new Array(tasks.length).fill(null);
  function earliestFinish(i) {
    if (memo[i] != null) return memo[i];
    const preds = finishPreds[i];
    const start = preds.length ? Math.max(...preds.map(earliestFinish)) : 0;
    const fin = start + planned(tasks[i]);
    memo[i] = fin;
    return fin;
  }
  let makespan = 0;
  for (let i = 0; i < tasks.length; i++) {
    makespan = Math.max(makespan, earliestFinish(i));
  }
  return makespan; // integer minutes
}

// ----------------------------------------------------------------------
// Runtime (driver semantics: unattended doesn't block)
// ----------------------------------------------------------------------
function consumesDriver(task) { return !!task.requires_driver; }
function depsSatisfied(task, status) {
  const edges = Array.isArray(task.edges) ? task.edges : [];
  if (edges.length === 0) return true;
  return edges.every((e) => {
    const pred = status(e.from);
    if (!pred) return true;
    switch (e.type) {
      case "SS": return pred.started || pred.done; // can start when predecessor starts
      case "FS":
      case "FF":
      case "SF":
      default:   return pred.done; // conservative finish-gate
    }
  });
}

function useRuntime(tasks) {
  const [started, setStarted] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [running, setRunning] = useState([]); // {id, startedAt, endsAt, consumesDriver}
  const [doneIds, setDoneIds] = useState(new Set());
  const [completed, setCompleted] = useState([]); // {id, startedAt, finishedAt, consumesDriver}

  // Clock
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNowMs((n) => n + 1000), 1000);
    return () => clearInterval(t);
  }, [started]);

  // Manual completion: do NOT auto-move items to done when time is up.
  useEffect(() => {
    if (!started) return;
    // no-op
  }, [nowMs, started]);

  const driverBusy = running.some((r) => r.consumesDriver);

  const startTask = (task) => {
    const p = getPlannedMinutes(task);
    const endsAt = nowMs + minToMs(p);
    setRunning((prev) => [
      ...prev,
      { id: task.id, startedAt: nowMs, endsAt, consumesDriver: consumesDriver(task) },
    ]);
  };

  const finishTask = (taskId) => {
    setRunning((prev) => {
      const r = prev.find((x) => x.id === taskId);
      if (r) {
        setCompleted((c) => [
          ...c,
          { id: r.id, startedAt: r.startedAt, finishedAt: nowMs, consumesDriver: r.consumesDriver },
        ]);
      }
      return prev.filter((x) => x.id !== taskId);
    });
    setDoneIds((prev) => new Set(prev).add(taskId));
  };

  const reset = () => {
    setStarted(false);
    setNowMs(0);
    setRunning([]);
    setDoneIds(new Set());
    setCompleted([]);
  };

  // Ready vs Blocked
  const ready = [], blocked = [];
  const runningIds = new Set(running.map((r) => r.id));
  for (const t of tasks) {
    if (doneIds.has(t.id) || runningIds.has(t.id)) continue;
    const depsOK = depsSatisfied(t, (id) => ({
      started: runningIds.has(id),
      done: doneIds.has(id),
    }));
    if (!depsOK) { blocked.push(t); continue; }
    if (t.requires_driver && driverBusy) blocked.push(t);
    else ready.push(t);
  }

  return {
    started, setStarted, nowMs,
    running, doneIds, completed,
    driverBusy, ready, blocked,
    startTask, finishTask, reset
  };
}

// ----------------------------------------------------------------------
// Ordering helpers (stable lanes + grace fade)
//  - Lane set = running tasks + recently finished (within GRACE_MS), ordered by startedAt
//  - After grace, finished disappear and lanes compact
// ----------------------------------------------------------------------
const GRACE_MS = 4000;

function orderForLanes(tasks, running, completed, nowMs, doneIds) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const recentFinished = completed
    .filter(c => nowMs - c.finishedAt < GRACE_MS)
    .map(c => ({ ...c, _kind: "finished" }));

  const laneStackIds = [
    ...running.map(r => ({ id: r.id, startedAt: r.startedAt, _kind: "running" })),
    ...recentFinished.map(f => ({ id: f.id, startedAt: f.startedAt, _kind: "finished", finishedAt: f.finishedAt })),
  ]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map(x => x.id);

  const laneSet = new Set(laneStackIds);

  // Start with lanes (running + recent finished), then the rest (not started, not done)
  const head = laneStackIds.map(id => byId.get(id)).filter(Boolean);
  const tail = tasks.filter(t => !laneSet.has(t.id) && !doneIds.has(t.id));
  return [...head, ...tail];
}

function suggestQueue(ready, running, byId) {
  const hasUnattended = running.some(r => byId.get(r.id) && !byId.get(r.id).requires_driver);
  if (!hasUnattended) return [];
  return [...ready]
    .filter(t => t.requires_driver)
    .sort((a, b) => getPlannedMinutes(a) - getPlannedMinutes(b))
    .slice(0, 4);
}

// ----------------------------------------------------------------------
// Timeline (SVG) — move-only bars; stable lanes; grace fade for finished
// ----------------------------------------------------------------------
function Timeline({ tasks, running, ready = [], completed = [], doneIds, nowMs }) {
  const PX_PER_MIN = 100;
  const ROW_H = 100;
  const PADDING = 16;
  const PAST_MIN = 3;
  const FUTURE_MIN = 35;

  const byId  = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Stable ordering with grace-finished included
  const orderedTasks = useMemo(
    () => orderForLanes(tasks, running, completed, nowMs, doneIds),
    [tasks, running, completed, nowMs, doneIds]
  );

  const lanes  = orderedTasks.map((t, i) => ({ id: t.id, y: PADDING + i * ROW_H }));
  const height = PADDING * 2 + lanes.length * ROW_H;
  const width  = Math.max(960, (PAST_MIN + FUTURE_MIN) * PX_PER_MIN + 160);
  const MID    = Math.round(PAST_MIN * PX_PER_MIN) + 80;

  // Running bars: left drifts; width fixed; freeze at Now when time is up
  const runningBars = running.map((r) => {
    const t = byId.get(r.id);
    const lane = lanes.find((ln) => ln.id === r.id) || { y: 0 };

    const durMin = getPlannedMinutes(t);
    const durMs  = durMin * 60000;

    const elapsedMs = clamp(nowMs - r.startedAt, 0, durMs);
    const remainMs  = clamp(r.endsAt - nowMs, 0, durMs);

    const elapsedMin = elapsedMs / 60000;
    const w = Math.max(10, durMin * PX_PER_MIN);
    const x = MID - elapsedMin * PX_PER_MIN;

    return {
      id: r.id,
      x, y: lane.y + 8, w, h: ROW_H - 16,
      attended: !!t?.requires_driver,
      name: t?.name || "Task",
      leftMs: remainMs,
    };
  });

  // Finished-in-grace bars: keep lane; right edge anchored to true finish; fade out
  const finishedBars = completed
    .map((c) => {
      const t = byId.get(c.id);
      if (!t) return null;
      const age = nowMs - c.finishedAt;
      if (age >= GRACE_MS) return null; // out of grace -> not drawn
      const lane = lanes.find((ln) => ln.id === c.id) || { y: 0 };

      const durMin = getPlannedMinutes(t);
      const w = Math.max(10, durMin * PX_PER_MIN);

      const minutesSinceFinish = age / 60000;
      const rightX = MID - minutesSinceFinish * PX_PER_MIN; // Now minus age
      const x = rightX - w;

      // Fade from 0.8 -> 0 over GRACE_MS
      const opacity = clamp(0.8 * (1 - age / GRACE_MS), 0, 0.8);

      return {
        id: c.id, x, y: lane.y + 8, w, h: ROW_H - 16,
        attended: !!t?.requires_driver,
        name: t?.name || "Task",
        opacity,
      };
    })
    .filter(Boolean);

  // Ghost bars: preview at Now
  const ghostBars = (ready || []).map((t) => {
    const pMin = getPlannedMinutes(t);
    const lane = lanes.find((ln) => ln.id === t.id) || { y: 0 };
    if (!lane) return null;
    return {
      id: t.id,
      x: MID,
      y: lane.y + 22,
      w: Math.max(10, pMin * PX_PER_MIN),
      h: ROW_H - 44,
      attended: !!t.requires_driver,
      name: t.name || "Task",
    };
  }).filter(Boolean);

  // Axis ticks
  const ticks = [];
  for (let m = 0; m <= FUTURE_MIN; m += 1) {
    ticks.push({ x: MID + m * PX_PER_MIN, label: m % 5 === 0 ? `${m}m` : null, major: m % 5 === 0 });
  }
  const pastTicks = [];
  for (let m = 1; m <= PAST_MIN; m += 1) pastTicks.push({ x: MID - m * PX_PER_MIN });

  const fmt = (ms) => mmss(ms);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, overflowX: "auto", overflowY: "visible", maxWidth: 1600, marginInline: "auto" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Timeline (zoomed preview)</div>
      <svg width={width} height={height}>
        {/* Past shading */}
        <rect x={0} y={0} width={MID} height={height} fill="#fafafa" />

        {/* NowLine */}
        <line x1={MID} x2={MID} y1={0} y2={height} stroke="#ef4444" strokeWidth="3" />
        <text x={MID + 8} y={18} fontSize="14" fill="#ef4444">Now</text>

        {/* Future ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={0} y2={height} stroke={t.major ? "#e5e7eb" : "#f1f5f9"} strokeWidth={t.major ? 2 : 1} />
            {t.label && (
              <text x={t.x + 6} y={height - 8} fontSize="12" fill="#475569" style={{ fontWeight: 600 }}>
                {t.label}
              </text>
            )}
          </g>
        ))}

        {/* Past ticks */}
        {pastTicks.map((t, i) => (
          <line key={i} x1={t.x} x2={t.x} y1={0} y2={height} stroke="#f3f4f6" />
        ))}

        {/* Lane labels (hide labels for finished-in-grace lanes) */}
{orderedTasks.map((t, i) => {
  if (doneIds.has(t.id)) return null; // no label once task is done
  const y = PADDING + i * ROW_H + ROW_H * 0.55;
  return (
    <text key={t.id} x={12} y={y} fontSize="14" fill="#374151">
      {i + 1}. {t.name}
    </text>
  );
})}

        {/* Ghost bars */}
        {ghostBars.map((b) => (
          <g key={`ghost_${b.id}`} opacity={0.55}>
            <rect
              x={b.x} y={b.y}
              width={b.w} height={b.h}
              rx="12" ry="12"
              fill="#fef3c7"
              stroke="#f59e0b"
              strokeDasharray="6 4"
              strokeWidth="2"
            />
            <text x={b.x + 10} y={b.y + b.h / 2 + 5} fontSize="14" fill="#92400e" style={{ fontStyle: "italic" }}>
              {b.attended ? "attended" : "unattended"} • {getPlannedMinutes({ ...byId.get(b.id) })}m
            </text>
          </g>
        ))}

        {/* Finished (grace) bars */}
        {finishedBars.map((b) => (
          <g key={`done_${b.id}`} opacity={b.opacity}>
            <rect
              x={b.x} y={b.y}
              width={b.w} height={b.h}
              rx="12" ry="12"
              fill={b.attended ? "#bfdbfe" : "#d1fae5"}
              stroke="#cbd5e1"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Running bars */}
        {runningBars.map((b) => {
          const timeUp = b.leftMs <= 0;
          return (
            <g key={b.id}>
              <rect
                x={b.x} y={b.y}
                width={b.w} height={b.h}
                rx="12" ry="12"
                fill={b.attended ? "#bfdbfe" : "#d1fae5"}
                stroke={b.attended ? "#60a5fa" : "#34d399"}
                strokeWidth="2"
              />
              <text x={b.x + 10} y={b.y + b.h / 2 + 5} fontSize="14" fill="#111827">
                {b.attended ? "attended" : "unattended"} • {fmt(b.leftMs)}
                {timeUp ? " • time up — click Finish" : ""}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
        Tip: when you click <b>Finish</b>, the bar lingers ~4s (fading) in the same lane, then disappears.
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Small UI atoms
// ----------------------------------------------------------------------
const Chip = ({ children, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      border: "1px solid #ddd",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 14,
      marginRight: 8,
      marginBottom: 8,
      background: "#fff",
      ...style,
    }}
  >
    {children}
  </span>
);

const DURATION_PRESETS = [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60];
function DurationEditor({ duration, onChangeMinutes, disabled = false }) {
  let value = "";
  if (duration && "value" in duration && duration.value != null) value = String(duration.value);
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => {
        const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
        onChangeMinutes(v == null ? null : Math.max(1, v));
      }}
    >
      <option value="">—</option>
      {DURATION_PRESETS.map((m) => (
        <option key={m} value={m}>{m} min</option>
      ))}
    </select>
  );
}
function VerbEditor({ value, onChange }) {
  const options = ["free_text", ...CANONICAL.map((v) => v.name)];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((v) => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  );
}

// ----------------------------------------------------------------------
// Meals browser helpers
// ----------------------------------------------------------------------
function computeMealMinTime(meal) {
  return computeCriticalPathMin(meal.tasks || []);
}

// ----------------------------------------------------------------------
// App
// ----------------------------------------------------------------------
export default function App() {
  const MEALS = useMemo(() => ([
    { id: "pasta", title: "Quick Pasta with Garlic Oil", author: "Sample", data: MEAL_PASTA },
    { id: "roast", title: "Easy One-pan Roast Chicken and Vegetables", author: "Nicole Maquire", data: MEAL_ROAST },
    { id: "stew",  title: "Slow Beef Stew", author: "Sample", data: MEAL_STEW },
  ]), []);

  const [mealIdx, setMealIdx] = useState(0);
  const [state, setState] = useState(() => ({
    meal: { ...(MEALS[0].data || {}), title: MEALS[0].title, author: { name: MEALS[0].author } },
    warnings: [],
  }));

  // Serve-at input (15-min step)
  const [serveAt, setServeAt] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return now.toTimeString().slice(0, 5);
  });

  // Minutes from now → serveAt
  const windowMin = useMemo(() => {
    const now = new Date();
    const [hh, mm] = serveAt.split(":").map(Number);
    const serveTime = new Date(now);
    serveTime.setHours(hh, mm, 0, 0);
    const diff = (serveTime - now) / 60000;
    return Math.max(0, Math.round(diff));
  }, [serveAt]);

  // Correct minimum time using critical path
  const minBudget = useMemo(
    () => computeCriticalPathMin(state.meal.tasks),
    [state.meal.tasks]
  );

  const fits = minBudget <= windowMin;
  const earliestServe = useMemo(() => {
    const now = new Date();
    const when = new Date(now.getTime() + minToMs(minBudget));
    return when.toTimeString().slice(0, 5);
  }, [minBudget]);

  // runtime
  const rt = useRuntime(state.meal.tasks);

  // export json/log
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state.meal, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.meal.title.replace(/\s+/g, "_")}.mealmap.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const byId = useMemo(() => new Map(state.meal.tasks.map((t) => [t.id, t])), [state.meal.tasks]);

  const exportLogJSON = () => {
    const data = {
      started: rt.started,
      nowMs: rt.nowMs,
      running: rt.running.map(r => ({
        id: r.id,
        name: byId.get(r.id)?.name || "Task",
        startedAtMs: r.startedAt,
        plannedMin: getPlannedMinutes(byId.get(r.id)),
        attended: !!byId.get(r.id)?.requires_driver,
      })),
      completed: rt.completed.map(c => ({
        id: c.id,
        name: byId.get(c.id)?.name || "Task",
        startedAtMs: c.startedAt,
        finishedAtMs: c.finishedAt,
        plannedMin: getPlannedMinutes(byId.get(c.id)),
        attended: !!byId.get(c.id)?.requires_driver,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runtime_log.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLogCSV = () => {
    const rows = [
      ["phase","id","name","startedAtMs","finishedAtMs","plannedMin","attended"].join(","),
      ...rt.running.map(r => ["running", r.id, (byId.get(r.id)?.name || "Task").replace(/,/g," "), r.startedAt, "", getPlannedMinutes(byId.get(r.id)), !!byId.get(r.id)?.requires_driver].join(",")),
      ...rt.completed.map(c => ["completed", c.id, (byId.get(c.id)?.name || "Task").replace(/,/g," "), c.startedAt, c.finishedAt, getPlannedMinutes(byId.get(c.id)), !!byId.get(c.id)?.requires_driver].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runtime_log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load a meal from catalog
  const loadMeal = (idx) => {
    const m = MEALS[idx];
    setMealIdx(idx);
    setState({
      meal: { ...(m.data || {}), title: m.title, author: { name: m.author }, packs_meta: { synonyms: SYNONYMS } },
      warnings: [],
    });
    rt.reset();
  };

  // Filter helpers
  const [query, setQuery] = useState("");
  const [onlyFits, setOnlyFits] = useState(false);

  const cards = MEALS
    .map((m, idx) => {
      const meal = { ...(m.data || {}), title: m.title, author: { name: m.author } };
      const min = computeMealMinTime(meal);
      const card = { idx, title: m.title, author: m.author, min, tasks: (meal.tasks || []).length };
      card.fits = min <= windowMin;
      return card;
    })
    .filter((c) => (query ? c.title.toLowerCase().includes(query.toLowerCase()) : true))
    .filter((c) => (onlyFits ? c.fits : true));

  // Explain blocked reasons
  const runningIds = useMemo(() => new Set(rt.running.map((r) => r.id)), [rt.running]);
  const isStarted = (id) => runningIds.has(id) || rt.doneIds.has(id);
  const isDone = (id) => rt.doneIds.has(id);

  function reasonsForBlocked(task) {
    const reasons = [];
    const edges = Array.isArray(task.edges) ? task.edges : [];
    const unmet = edges
      .filter((e) => {
        if (!e || !byId.has(e.from)) return false;
        if (e.type === "SS") return !(isStarted(e.from));
        return !(isDone(e.from)); // FS / FF / SF wait for finish
      })
      .map((e) => byId.get(e.from)?.name || "previous step");

    if (unmet.length) reasons.push(`waiting on: ${unmet.join(", ")}`);
    if (task.requires_driver && rt.driverBusy) reasons.push("driver busy");
    return reasons.join("; ");
  }

  function isBlockedByFinish(task) {
    const edges = Array.isArray(task.edges) ? task.edges : [];
    for (const e of edges) {
      if (!e || !byId.has(e.from)) continue;
      if (e.type === "SS") continue;
      if (!rt.doneIds.has(e.from)) return true;
    }
    return false;
  }

  // Queue hint (during unattended)
  const queueHint = useMemo(
    () => suggestQueue(rt.ready, rt.running, byId),
    [rt.ready, rt.running, byId]
  );

  return (
    <div style={{ minHeight: "100vh", padding: 16, display: "grid", gap: 14 }}>
      {/* Top: Meals & Time Budget */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Meals browser */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Meals</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <input
              placeholder="Search by title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} />
              Only show meals that fit
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {cards.map((c) => (
              <div key={c.idx} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>by {c.author}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <Chip>Min time:{Math.round(c.min)}min</Chip>
                  <Chip style={{ background: c.fits ? "#e6ffed" : "#fff5f5" }}>
                    Fits:{c.fits ? "Yes" : "No"}
                  </Chip>
                  <Chip>Tasks:{c.tasks}</Chip>
                </div>
                <button onClick={() => loadMeal(c.idx)}>Load this meal</button>
              </div>
            ))}
          </div>
        </div>

        {/* Time Budget */}
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Time Budget</div>
          <div style={{ marginBottom: 8 }}>
            Need to serve at:&nbsp;
            <input type="time" step={900} value={serveAt} onChange={(e) => setServeAt(e.target.value)} />
          </div>
          <Chip>Minimum prep &amp; cook time:{Math.round(minBudget)}min</Chip>
          <Chip style={{ background: fits ? "#e6ffed" : "#fff5f5" }}>
            Fits your window:{fits ? "Yes" : "No"}
          </Chip>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 999, padding: "6px 12px", width: "fit-content", marginTop: 6 }}>
            Earliest serve if you start now: <b>{earliestServe}</b>
          </div>
        </div>
      </div>

      {/* ------------------------ Runtime preview ------------------------ */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          maxWidth: 1600,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>MealMap Runtime (preview)</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div><b>NowLine:</b> {mmss(rt.nowMs)} — <span style={{ opacity: 0.8 }}>{rt.driverBusy ? "driver busy" : "driver free"}</span></div>
            <button onClick={() => rt.setStarted(true)} disabled={rt.started}>Start run</button>
            <button onClick={rt.reset}>Reset</button>
          </div>
        </div>

        {/* Queue hint (during unattended) */}
        {queueHint.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, border: "1px dashed #eab308", borderRadius: 8, background: "#fffbeb" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>While the unattended timer runs, consider:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {queueHint.map((t) => (
                <Chip key={`q_${t.id}`} style={{ background: "#fff7ed", borderColor: "#fdba74" }}>
                  {t.name} — {getPlannedMinutes(t)}m&nbsp;
                  <button onClick={() => rt.startTask(t)} disabled={t.requires_driver && rt.driverBusy} style={{ marginLeft: 8 }}>
                    Start
                  </button>
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* Running */}
        <div style={{ marginTop: 8 }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Running</h3>
          {rt.running.length === 0 ? (
            <div>Nothing running.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rt.running
                .slice()
                .sort((a, b) => a.startedAt - b.startedAt) // match lane order
                .map((r) => {
                  const t = state.meal.tasks.find((x) => x.id === r.id);
                  const left = Math.max(0, r.endsAt - rt.nowMs);
                  const timeUp = left <= 0;
                  return (
                    <li key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div>
                        <b>{t?.name}</b>{" "}
                        <span style={{ opacity: 0.8 }}>
                          ({t?.requires_driver ? "attended" : "unattended"}) ({mmss(left)} left{timeUp ? " • time up — click Finish" : ""})
                        </span>
                      </div>
                      <button onClick={() => rt.finishTask(r.id)}>Finish now</button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        {/* Can do now */}
        <div style={{ marginTop: 10 }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Can do now</h3>
          {rt.ready.length === 0 ? (
            <div>
              No tasks are ready yet.
              {!rt.driverBusy && rt.running.length > 0 && (
                <span style={{ opacity: 0.7 }}>
                  {" "}Driver is free, but all next steps are waiting on predecessors (e.g., current boil).
                </span>
              )}
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rt.ready.map((t) => (
                <li key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <b>{t.name}</b>{" "}
                    <span style={{ opacity: 0.8 }}>— {t.requires_driver ? "attended" : "unattended"}</span>
                  </div>
                  <button onClick={() => rt.startTask(t)} disabled={t.requires_driver && rt.driverBusy}>Start</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Blocked */}
        <div style={{ marginTop: 10 }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Blocked</h3>
          {rt.blocked.length === 0 ? (
            <div>Nothing blocked.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rt.blocked.map((t) => (
                <li
                  key={t.id}
                  style={{
                    borderLeft: isBlockedByFinish(t) ? "3px solid #f59e0b" : "3px solid transparent",
                    paddingLeft: 8
                  }}
                >
                  <b>{t.name}</b>
                  <span style={{ opacity: 0.75, fontStyle: "italic", fontWeight: 400 }}>
                    {" — "}{reasonsForBlocked(t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Done */}
        <div style={{ marginTop: 10 }}>
          <h3 style={{ margin: 0, marginBottom: 6 }}>Done</h3>
          {state.meal.tasks.filter((t) => rt.doneIds.has(t.id)).length === 0 ? (
            <div>Nothing completed yet.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {state.meal.tasks.filter((t) => rt.doneIds.has(t.id)).map((t) => (<li key={t.id}>{t.name}</li>))}
            </ul>
          )}
        </div>

        {/* SVG timeline */}
        <div style={{ marginTop: 14 }}>
          <Timeline
            tasks={state.meal.tasks}
            running={rt.running}
            ready={rt.ready}
            completed={rt.completed}
            doneIds={rt.doneIds}
            nowMs={rt.nowMs}
          />
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={exportJson}>Export JSON</button>
          <button onClick={exportLogJSON}>Export runtime log (JSON)</button>
          <button onClick={exportLogCSV}>Export runtime log (CSV)</button>
        </div>
      </div>
    </div>
  );
}