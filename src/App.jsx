// ============================== NowCook Parser — v1.8.6 ==============================
// v1.8.6 = v1.8.5 + dark page background
//  - Page (outside panels):  #4f5b66
//  - Author Ingestion panel: #ffe7b3
//  - Meals panel:            #c0efff
//  - Time Budget panel:      #b3ffb3
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import AuthoringPanel from "./components/AuthorIngPanel.jsx"; // <- updated to match actual filename

// ----------------------------------------------------------------------
// Packs (src/packs)
// ----------------------------------------------------------------------
import VERB_PACK from "./packs/verbs.en.json";
import DURATIONS_PACK from "./packs/durations.en.json";
import READINESS_PACK from "./packs/readiness.en.json";   // reserved (not used yet)
import SYNONYMS_PACK from "./packs/synonyms.en.json";     // optional

// ----------------------------------------------------------------------
// Sample meals (src/meals) — Alpha MVP Suite (5 perfect meals)
// ----------------------------------------------------------------------
import MEAL_GARLIC_PASTA from "./meals/garlic_butter_pasta.json";
import MEAL_MAC_CHEESE from "./meals/mac_and_cheese.json";
import MEAL_CHICKEN_RICE from "./meals/chicken_and_rice.json";
import MEAL_SALMON from "./meals/salmon_asparagus_couscous.json";
import MEAL_STEAK from "./meals/steak_potatoes_beans.json";

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
function consumesDriver(task) {
  return task.requires_driver || task.is_attended;
}

function hasTimeSensitivity(task) {
  // Time-sensitive tasks must be done close to serve time
  // Examples: steaming broccoli, removing from oven, plating
  const timeSensitiveVerbs = ['steam', 'plate', 'serve', 'remove', 'flip', 'stir'];
  const verb = (task.canonical_verb || '').toLowerCase();
  return timeSensitiveVerbs.includes(verb);
}

function depsSatisfied(task, getPred) {
  const edges = Array.isArray(task.edges) ? task.edges : [];
  if (edges.length === 0) return true;
  return edges.every((e) => {
    const pred = getPred(e.from);
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

  // Task classification: Could do now, Can do now, Can't do yet, Must do now
  const couldDoNow = [], canDoNow = [], cantDoYet = [], mustDoNow = [];
  const runningIds = new Set(running.map((r) => r.id));
  
  for (const t of tasks) {
    if (doneIds.has(t.id) || runningIds.has(t.id)) continue;
    
    const depsOK = depsSatisfied(t, (id) => ({
      started: runningIds.has(id),
      done: doneIds.has(id),
    }));
    
    // Can't do yet: dependencies not satisfied
    if (!depsOK) { 
      cantDoYet.push(t); 
      continue; 
    }
    
    // Dependencies are satisfied - now classify by temporal flexibility
    
    // Could do now: unattended prep tasks with no time urgency
    // These can be done anytime: night before, this morning, or right now
    // Example: "Grate cheese" - could prep Thursday for Friday dinner
    if (!t.requires_driver && !hasTimeSensitivity(t)) {
      couldDoNow.push(t);
      continue;
    }
    
    // Can do now: ready to execute when driver becomes available
    // These follow dependencies but aren't time-critical
    if (t.requires_driver && driverBusy) {
      cantDoYet.push(t);
    } else {
      canDoNow.push(t);
    }
  }

  // Legacy ready/blocked for backwards compatibility
  const ready = [...canDoNow, ...couldDoNow];
  const blocked = cantDoYet;

  return {
    started, setStarted, nowMs,
    running, doneIds, completed,
    driverBusy, 
    couldDoNow, canDoNow, cantDoYet, mustDoNow,
    ready, blocked,
    startTask, finishTask, reset
  };
}

// ----------------------------------------------------------------------
// Ordering helpers (stable lanes + grace fade)
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

  const orderedTasks = useMemo(
    () => orderForLanes(tasks, running, completed, nowMs, doneIds),
    [tasks, running, completed, nowMs, doneIds]
  );

  const lanes  = orderedTasks.map((t, i) => ({ id: t.id, y: PADDING + i * ROW_H }));
  const height = PADDING * 2 + lanes.length * ROW_H;
  const width  = Math.max(960, (PAST_MIN + FUTURE_MIN) * PX_PER_MIN + 160);
  const MID    = Math.round(PAST_MIN * PX_PER_MIN) + 80;

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

  const finishedBars = completed
    .map((c) => {
      const t = byId.get(c.id);
      if (!t) return null;
      const age = nowMs - c.finishedAt;
      if (age >= GRACE_MS) return null;
      const lane = lanes.find((ln) => ln.id === c.id) || { y: 0 };

      const durMin = getPlannedMinutes(t);
      const w = Math.max(10, durMin * PX_PER_MIN);

      const minutesSinceFinish = age / 60000;
      const rightX = MID - minutesSinceFinish * PX_PER_MIN;
      const x = rightX - w;

      const opacity = clamp(0.8 * (1 - age / GRACE_MS), 0, 0.8);

      return {
        id: c.id, x, y: lane.y + 8, w, h: ROW_H - 16,
        attended: !!t?.requires_driver,
        name: t?.name || "Task",
        opacity,
      };
    })
    .filter(Boolean);

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

  const ticks = [];
  for (let m = 0; m <= FUTURE_MIN; m += 1) {
    ticks.push({ x: MID + m * PX_PER_MIN, label: m % 5 === 0 ? `${m}m` : null, major: m % 5 === 0 });
  }
  const pastTicks = [];
  for (let m = 1; m <= PAST_MIN; m += 1) pastTicks.push({ x: MID - m * PX_PER_MIN });

  const fmt = (ms) => mmss(ms);

  return (
    <div className="timeline-panel">
      <div className="timeline-title">Timeline (zoomed preview)</div>
      <svg width={width} height={height}>
        <rect x={0} y={0} width={MID} height={height} fill="#fafafa" />
        <line x1={MID} x2={MID} y1={0} y2={height} stroke="#ef4444" strokeWidth="3" />
        <text x={MID + 8} y={18} fontSize="14" fill="#ef4444">Now</text>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} x2={t.x} y1={0} y2={height} stroke={t.major ? "#e5e7eb" : "#f1f5f9"} strokeWidth={t.major ? 2 : 1} />
            {t.label && (
              <text x={t.x + 6} y={height - 8} fontSize="12" fill="#475569" fontWeight="600">
                {t.label}
              </text>
            )}
          </g>
        ))}

        {pastTicks.map((t, i) => (
          <line key={i} x1={t.x} x2={t.x} y1={0} y2={height} stroke="#f3f4f6" />
        ))}

        {/* Lane labels (hide labels for finished-in-grace lanes) */}
        {orderedTasks.map((t, i) => {
          if (doneIds.has(t.id)) return null;
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
            <text x={b.x + 10} y={b.y + b.h / 2 + 5} fontSize="14" fill="#92400e" fontStyle="italic">
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

      <div className="timeline-tip">
        Tip: when you click <b>Finish</b>, the bar lingers ~4s (fading) in the same lane, then disappears.
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Small UI atoms
// ----------------------------------------------------------------------
const Chip = ({ children, className }) => (
  <span className={`chip ${className || ''}`}>
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
    { id: "garlic-pasta", title: "Garlic Butter Pasta", author: "Alpha Suite", data: MEAL_GARLIC_PASTA },
    { id: "mac-cheese", title: "Classic Mac & Cheese", author: "Alpha Suite", data: MEAL_MAC_CHEESE },
    { id: "chicken-rice", title: "Pan-Seared Chicken & Rice", author: "Alpha Suite", data: MEAL_CHICKEN_RICE },
    { id: "salmon", title: "Pan-Seared Salmon, Roasted Asparagus & Couscous", author: "Alpha Suite", data: MEAL_SALMON },
    { id: "steak", title: "Seared Steak, Garlic Mashed Potatoes & Sautéed Green Beans", author: "Alpha Suite", data: MEAL_STEAK },
  ]), []);

  const [mealIdx, setMealIdx] = useState(0);
  const [state, setState] = useState(() => ({
    meal: { ...(MEALS[0].data || {}), title: MEALS[0].title, author: { name: MEALS[0].author } },
    warnings: [],
  }));

  // NEW: Track recipe text for AuthoringPanel
  const [recipeText, setRecipeText] = useState("");

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

  // Load a meal from the catalog
  const loadMeal = (idx) => {
    const m = MEALS[idx];
    setMealIdx(idx);
    
    setState({
      meal: { ...(m.data || {}), title: m.title, author: { name: m.author }, packs_meta: { synonyms: SYNONYMS } },
      warnings: [],
    });
    // Populate the AuthoringPanel with the recipe text
    if (m.data?.recipe_text) {
      setRecipeText(m.data.recipe_text);
    }
    rt.reset();
  };

  // NEW: accept a parsed meal from AuthoringPanel
  const loadMealFromIngest = (meal) => {
    setState({ meal, warnings: [] });
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
        return !(isDone(e.from));
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
    <div className="page-container">
      {/* NEW: Author Ingestion / Authoring Panel */}
      <div className="panel panel-author">
        <AuthoringPanel 
          onLoadMeal={loadMealFromIngest} 
          recipeText={recipeText}
          onRecipeTextChange={setRecipeText}
        />
      </div>

      {/* Top: Meals & Time Budget */}
      <div className="grid-two-cols">
        {/* Meals browser */}
        <div className="panel panel-meals">
          <div className="panel-header">Meals</div>
          <div className="search-bar">
            <input
              className="search-input"
              placeholder="Search by title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label>
              <input type="checkbox" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} />
              Only show meals that fit
            </label>
          </div>
          <div className="grid-auto-fit">
            {cards.map((c) => (
              <div key={c.idx} className="meal-card">
                <div className="meal-card-title">{c.title}</div>
                <div className="meal-card-author">by {c.author}</div>
                <div className="meal-card-chips">
                  <Chip>Min time:{Math.round(c.min)}min</Chip>
                  <Chip className={c.fits ? "chip-success" : "chip-error"}>
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
        <div className="panel panel-budget">
          <div className="budget-title">Time Budget</div>
          <div className="budget-serve-input">
            Need to serve at:&nbsp;
            <input type="time" step={900} value={serveAt} onChange={(e) => setServeAt(e.target.value)} />
          </div>
          <Chip>Minimum prep &amp; cook time:{Math.round(minBudget)}min</Chip>
          <Chip className={fits ? "chip-success" : "chip-error"}>
            Fits your window:{fits ? "Yes" : "No"}
          </Chip>
          <div className="budget-earliest-serve">
            Earliest serve if you start now: <b>{earliestServe}</b>
          </div>
        </div>
      </div>

      {/* ------------------------ Runtime preview ------------------------ */}
      <div className="panel panel-runtime">
        <div className="runtime-header">
          <h2 className="runtime-title">MealMap Runtime (preview)</h2>
          <div className="runtime-controls">
            <div className="runtime-nowline"><b>NowLine:</b> {mmss(rt.nowMs)} — <span className="opacity-80">{rt.driverBusy ? "driver busy" : "driver free"}</span></div>
            <button onClick={() => rt.setStarted(true)} disabled={rt.started}>Start run</button>
            <button onClick={rt.reset}>Reset</button>
          </div>
        </div>

        {/* Serve time prediction */}
        {rt.started && (
          <div style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white',
            padding: '16px 20px',
            borderRadius: 8,
            marginBottom: 16,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: 4 }}>
              🕐 You'll be serving at {(() => {
                const remainingTasks = state.meal.tasks.filter(t => !rt.doneIds.has(t.id) && !rt.running.find(r => r.id === t.id));
                const remainingMinutes = remainingTasks.reduce((sum, t) => sum + getPlannedMinutes(t), 0);
                const runningMinutes = rt.running.reduce((sum, r) => sum + Math.ceil((r.endsAt - rt.nowMs) / 60000), 0);
                const totalMinutes = remainingMinutes + runningMinutes;
                const serveTime = new Date(Date.now() + totalMinutes * 60000);
                return serveTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              })()}
            </div>
            <div style={{ fontSize: '0.9em', opacity: 0.9 }}>
              Estimated time remaining: {(() => {
                const remainingTasks = state.meal.tasks.filter(t => !rt.doneIds.has(t.id) && !rt.running.find(r => r.id === t.id));
                const remainingMinutes = remainingTasks.reduce((sum, t) => sum + getPlannedMinutes(t), 0);
                const runningMinutes = rt.running.reduce((sum, r) => sum + Math.ceil((r.endsAt - rt.nowMs) / 60000), 0);
                return remainingMinutes + runningMinutes;
              })()} minutes
            </div>
          </div>
        )}

        {/* Queue hint (during unattended) */}
        {queueHint.length > 0 && (
          <div className="queue-hint">
            <div className="queue-hint-title">While the unattended timer runs, consider:</div>
            <div className="queue-hint-chips">
              {queueHint.map((t) => (
                <Chip key={`q_${t.id}`} className="chip-warning">
                  {t.name} — {getPlannedMinutes(t)}m&nbsp;
                  <button onClick={() => rt.startTask(t)} disabled={t.requires_driver && rt.driverBusy} className="ml-2">
                    Start
                  </button>
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* Running */}
        <div className="task-section">
          <h3 className="task-section-title">Running</h3>
          {rt.running.length === 0 ? (
            <div>Nothing running.</div>
          ) : (
            <ul className="task-list">
              {rt.running
                .slice()
                .sort((a, b) => a.startedAt - b.startedAt) // match lane order
                .map((r) => {
                  const t = state.meal.tasks.find((x) => x.id === r.id);
                  const left = Math.max(0, r.endsAt - rt.nowMs);
                  const timeUp = left <= 0;
                  
                  return (
                    <li key={r.id} className="task-item">
                      <div>
                        <b>{t?.name}</b>{" "}
                        <span className="opacity-80">
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

        {/* Could do now - Flexible prep */}
        <div className="task-section" style={{ background: '#f0f8ff', borderLeft: '4px solid #4682b4' }}>
          <h3 className="task-section-title">⏰ Could do now</h3>
          <div className="opacity-70" style={{ fontSize: '0.9em', marginBottom: 8 }}>
            Flexible prep — do now, later, or even the night before
          </div>
          {rt.couldDoNow.length === 0 ? (
            <div>No flexible prep tasks available.</div>
          ) : (
            <ul className="task-list">
              {rt.couldDoNow.map((t) => (
                <li key={t.id} className="task-item">
                  <div>
                    <b>{t.name}</b>{" "}
                    <span className="opacity-80">— {getPlannedMinutes(t)}min {t.requires_driver ? "attended" : "unattended"}</span>
                  </div>
                  <button onClick={() => rt.startTask(t)}>Start</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Can do now - Ready to execute */}
        <div className="task-section">
          <h3 className="task-section-title">✅ Can do now</h3>
          <div className="opacity-70" style={{ fontSize: '0.9em', marginBottom: 8 }}>
            Dependencies met — ready when you are
          </div>
          {rt.canDoNow.length === 0 ? (
            <div>
              No tasks ready to execute.
              {!rt.driverBusy && rt.running.length > 0 && (
                <span className="opacity-70">
                  {" "}Driver is free, but all next steps are waiting on predecessors.
                </span>
              )}
            </div>
          ) : (
            <ul className="task-list">
              {rt.canDoNow.map((t) => (
                <li key={t.id} className="task-item">
                  <div>
                    <b>{t.name}</b>{" "}
                    <span className="opacity-80">— {getPlannedMinutes(t)}min {t.requires_driver ? "attended" : "unattended"}</span>
                  </div>
                  <button onClick={() => rt.startTask(t)} disabled={t.requires_driver && rt.driverBusy}>Start</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Can't do yet - Blocked */}
        <div className="task-section">
          <h3 className="task-section-title">⏸️ Can't do yet</h3>
          <div className="opacity-70" style={{ fontSize: '0.9em', marginBottom: 8 }}>
            Waiting on dependencies or too early to start
          </div>
          {rt.cantDoYet.length === 0 ? (
            <div>Nothing blocked.</div>
          ) : (
            <ul className="task-list">
              {rt.cantDoYet.map((t) => (
                <li
                  key={t.id}
                  className={isBlockedByFinish(t) ? "task-blocked-finish" : "task-item"}
                >
                  <b>{t.name}</b>
                  <span className="task-blocked-reason">
                    {" — "}{reasonsForBlocked(t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Done */}
        <div className="task-section">
          <h3 className="task-section-title">Done</h3>
          {state.meal.tasks.filter((t) => rt.doneIds.has(t.id)).length === 0 ? (
            <div>Nothing completed yet.</div>
          ) : (
            <ul className="task-list">
              {state.meal.tasks.filter((t) => rt.doneIds.has(t.id)).map((t) => (<li key={t.id}>{t.name}</li>))}
            </ul>
          )}
        </div>

        {/* SVG timeline */}
        <div className="timeline-container">
          <Timeline
            tasks={state.meal.tasks}
            running={rt.running}
            ready={rt.ready}
            completed={rt.completed}
            doneIds={rt.doneIds}
            nowMs={rt.nowMs}
          />
        </div>

        {/* Meal Editor */}
        <div className="meal-editor" style={{ marginTop: 24, padding: 16, background: '#fffbf0', borderRadius: 8, border: '2px solid #ffc107' }}>
          <h3 style={{ marginBottom: 12, color: '#f57c00' }}>🛠️ Meal Editor (Beta)</h3>
          <details open>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 12 }}>Edit Tasks</summary>
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
              {state.meal.tasks.map((task, idx) => (
                <div key={task.id} style={{ 
                  marginBottom: 12, 
                  padding: 12, 
                  background: '#fff', 
                  borderRadius: 6,
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <b style={{ minWidth: 30 }}>#{idx + 1}</b>
                    <input 
                      type="text" 
                      value={task.name}
                      onChange={(e) => {
                        const newTasks = [...state.meal.tasks];
                        newTasks[idx] = { ...task, name: e.target.value };
                        setState({ ...state, meal: { ...state.meal, tasks: newTasks } });
                      }}
                      style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Duration (min):
                      <input 
                        type="number" 
                        value={task.duration_min || 0}
                        onChange={(e) => {
                          const newTasks = [...state.meal.tasks];
                          newTasks[idx] = { ...task, duration_min: parseInt(e.target.value) || 0 };
                          setState({ ...state, meal: { ...state.meal, tasks: newTasks } });
                        }}
                        style={{ width: 60, padding: 4, borderRadius: 4, border: '1px solid #ccc' }}
                        min="0"
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input 
                        type="checkbox" 
                        checked={!!task.requires_driver}
                        onChange={(e) => {
                          const newTasks = [...state.meal.tasks];
                          newTasks[idx] = { 
                            ...task, 
                            requires_driver: e.target.checked,
                            self_running_after_start: !e.target.checked
                          };
                          setState({ ...state, meal: { ...state.meal, tasks: newTasks } });
                        }}
                      />
                      Attended
                    </label>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Verb: <code>{task.canonical_verb || 'free_text'}</code>
                    </div>
                  </div>
                  {task.edges && task.edges.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#1976d2' }}>
                      ↳ Depends on: {task.edges.map(e => {
                        const depIdx = state.meal.tasks.findIndex(t => t.id === e.from);
                        return `#${depIdx + 1} (${e.type})`;
                      }).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={exportJson} style={{ flex: 1 }}>💾 Save as JSON</button>
            <button onClick={() => navigator.clipboard.writeText(JSON.stringify(state.meal, null, 2))} style={{ flex: 1 }}>📋 Copy JSON</button>
          </div>
        </div>

        <div className="export-buttons">
          <button onClick={exportJson}>Export JSON</button>
          <button onClick={exportLogJSON}>Export runtime log (JSON)</button>
          <button onClick={exportLogCSV}>Export runtime log (CSV)</button>
        </div>
      </div>
    </div>
  );
}