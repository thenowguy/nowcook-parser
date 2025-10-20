import { useMemo } from 'react';
import { orderForLanes, getPlannedMinutes, mmss, clamp } from '../utils/runtime';

const GRACE_MS = 4000;

export default function Timeline({ tasks, running, ready = [], completed = [], doneIds, nowMs }) {
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
    <div style={{ 
      background: 'white', 
      borderRadius: '8px', 
      padding: '16px',
      overflowX: 'auto'
    }}>
      <h3 style={{ 
        margin: '0 0 16px 0', 
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#333'
      }}>
        Timeline
      </h3>
      <svg width={width} height={height}>
        <rect x={0} y={0} width={MID} height={height} fill="#fafafa" />
        <line x1={MID} x2={MID} y1={0} y2={height} stroke="#ef4444" strokeWidth="3" />
        <text x={MID + 8} y={18} fontSize="14" fill="#ef4444" fontWeight="bold">Now</text>

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

        {/* Lane labels */}
        {orderedTasks.map((t, i) => {
          if (doneIds.has(t.id)) return null;
          const y = PADDING + i * ROW_H + ROW_H * 0.55;
          return (
            <text key={t.id} x={12} y={y} fontSize="14" fill="#374151">
              {i + 1}. {t.name}
            </text>
          );
        })}

        {/* Ghost bars (ready tasks) */}
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
                {timeUp ? " • time up" : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
