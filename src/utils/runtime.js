import { useEffect, useState } from "react";

// Helper functions
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const mmss = (ms) => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};
export const minToMs = (m) => (m == null ? 0 : Math.max(0, Math.round(m))) * 60_000;

export function getPlannedMinutes(task) {
  return task.duration_min ?? task.planned_min ?? 1;
}

export function consumesDriver(task) {
  return task.requires_driver || task.is_attended;
}

export function hasTimeSensitivity(task) {
  const timeSensitiveVerbs = [
    'steam', 'plate', 'serve', 'remove', 'flip', 'stir',
    'boil', 'simmer', 'cook', 'bake', 'roast', 'sauté', 'fry',
    'drain', 'combine', 'whisk', 'melt', 'heat'
  ];
  const verb = (task.canonical_verb || '').toLowerCase();
  const name = (task.name || '').toLowerCase();
  
  if (timeSensitiveVerbs.includes(verb)) return true;
  
  if (name.includes('boil') || name.includes('simmer') || name.includes('cook') ||
      name.includes('bake') || name.includes('heat') || name.includes('melt') ||
      name.includes('drain') || name.includes('combine') || name.includes('sauce')) {
    return true;
  }
  
  return false;
}

export function isPrepTask(task) {
  const prepVerbs = [
    'grate', 'mince', 'dice', 'chop', 'slice', 'cube',
    'peel', 'trim', 'julienne', 'measure', 'cut'
  ];
  const verb = (task.canonical_verb || '').toLowerCase();
  const name = (task.name || '').toLowerCase();
  
  if (prepVerbs.includes(verb)) return true;
  
  if (name.includes('grate') || name.includes('mince') || name.includes('dice') ||
      name.includes('chop') || name.includes('measure') || name.includes('cut') ||
      name.includes('peel') || name.includes('trim') || name.includes('slice')) {
    return true;
  }
  
  return false;
}

export function depsSatisfied(task, getPred) {
  const edges = Array.isArray(task.edges) ? task.edges : [];
  if (edges.length === 0) return true;
  return edges.every((e) => {
    const pred = getPred(e.from);
    if (!pred) return true;
    switch (e.type) {
      case "SS": return pred.started || pred.done;
      case "FS":
      case "FF":
      case "SF":
      default:   return pred.done;
    }
  });
}

export function useRuntime(tasks) {
  const [started, setStarted] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [running, setRunning] = useState([]);
  const [doneIds, setDoneIds] = useState(new Set());
  const [completed, setCompleted] = useState([]);

  // Clock
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNowMs((n) => n + 1000), 1000);
    return () => clearInterval(t);
  }, [started]);

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

  // Task classification
  const couldDoNow = [], canDoNow = [], cantDoYet = [], driverBusyTasks = [], mustDoNow = [];
  const runningIds = new Set(running.map((r) => r.id));
  
  for (const t of tasks) {
    if (doneIds.has(t.id) || runningIds.has(t.id)) continue;
    
    const depsOK = depsSatisfied(t, (id) => ({
      started: runningIds.has(id) || doneIds.has(id),
      done: doneIds.has(id),
    }));
    
    if (!depsOK) { 
      cantDoYet.push(t);
      continue; 
    }
    
    const isPurePrep = isPrepTask(t);
    if (!t.requires_driver && isPurePrep) {
      couldDoNow.push(t);
      continue;
    }
    
    if (t.requires_driver && driverBusy) {
      driverBusyTasks.push(t); // Separate from truly blocked
    } else {
      canDoNow.push(t);
    }
  }

  const ready = [...canDoNow, ...couldDoNow];
  const blocked = cantDoYet;

  return {
    started, setStarted, nowMs,
    running, doneIds, completed,
    driverBusy, 
    couldDoNow, canDoNow, cantDoYet, driverBusyTasks, mustDoNow,
    ready, blocked,
    startTask, finishTask, reset
  };
}

export function orderForLanes(tasks, running, completed, nowMs, doneIds) {
  const GRACE_MS = 4000;
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

export function suggestQueue(ready, running, byId) {
  const hasUnattended = running.some(r => byId.get(r.id) && !byId.get(r.id).requires_driver);
  if (!hasUnattended) return [];
  return [...ready]
    .filter(t => t.requires_driver)
    .sort((a, b) => (getPlannedMinutes(a) || 0) - (getPlannedMinutes(b) || 0))
    .slice(0, 3);
}
