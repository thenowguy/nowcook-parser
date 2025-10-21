import { useMemo } from 'react';
import { getPlannedMinutes } from '../utils/runtime';

export default function TimelineFlow({ tasks, running, ready = [], completed = [], doneIds, nowMs, onStartTask, onDismissTask }) {
  // iPhone 11 Configuration - Physical dimensions (2x scale)
  const PIXELS_PER_SECOND = 2;
  const TRACK_HEIGHT = 115; // 230px physical / 2 = 115px logical
  const LEFT_PANEL_WIDTH = 160; // 320px physical / 2 = 160px logical
  const LOZENGE_HEIGHT = 100; // 200px physical / 2 = 100px logical
  const LOZENGE_RADIUS = 50; // 100px physical / 2 = 50px logical (pill shape)
  const NOWLINE_X = 160; // 320px physical / 2 = 160px logical (at edge of left panel)
  const NOWLINE_WIDTH = 2; // 4px physical / 2 = 2px logical
  const TEXT_PADDING = 15; // 30px physical / 2 = 15px logical (from NowLine)
  
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  
  const now = new Date();
  const currentTimeStr = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    second: '2-digit'
  });
  
  const allTracks = useMemo(() => {
    const tracks = [];
    
    // Running tasks
    running.forEach((r) => {
      const task = byId.get(r.id);
      if (!task) return;
      
      const durationMin = getPlannedMinutes(task);
      const durationMs = durationMin * 60000;
      const elapsedMs = nowMs - r.startedAt;
      const remainingMs = durationMs - elapsedMs;
      
      const lozengeWidth = (durationMs / 1000) * PIXELS_PER_SECOND;
      const elapsedPixels = (elapsedMs / 1000) * PIXELS_PER_SECOND;
      
      // Calculate position - slides left as time passes
      let lozengeX = NOWLINE_X - elapsedPixels;
      const rightEdge = lozengeX + lozengeWidth;
      
      // TURNSTILE: Stop when right edge hits NowLine
      let status = 'running';
      if (rightEdge <= NOWLINE_X) {
        lozengeX = NOWLINE_X - lozengeWidth;
        status = 'stopped-waiting';
      }
      
      tracks.push({
        id: r.id,
        taskName: task.name,
        lozengeX,
        lozengeWidth,
        status,
        remainingMs,
        color: '#4caf50', // Spec green
        needsAction: status === 'stopped-waiting'
      });
    });
    
    // Ready tasks
    ready.forEach((task) => {
      if (running.find(r => r.id === task.id) || doneIds.has(task.id)) return;
      
      const durationMin = getPlannedMinutes(task);
      const durationMs = durationMin * 60000;
      const lozengeWidth = (durationMs / 1000) * PIXELS_PER_SECOND;
      const lozengeX = NOWLINE_X; // Left edge AT NowLine
      
      tracks.push({
        id: task.id,
        taskName: task.name,
        lozengeX,
        lozengeWidth,
        status: 'ready',
        color: '#4caf50',
        needsAction: true
      });
    });
    
    return tracks;
  }, [tasks, running, ready, doneIds, nowMs, byId]);
  
  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { 
              opacity: 0.8;
              transform: scale(1);
            }
            50% { 
              opacity: 1;
              transform: scale(1.01);
            }
          }
        `}
      </style>
      
      {/* Parent Container - Full Width */}
      <div style={{
        position: 'relative',
        width: '100%', // Full width of viewport
        background: '#2a2a2a',
        overflow: 'hidden'
      }}>
        {/* Z-Layer 4: NowLine (fixed at 160px from left) */}
        <div style={{
          position: 'absolute',
          left: `${NOWLINE_X}px`,
          top: 0,
          bottom: 0,
          width: `${NOWLINE_WIDTH}px`,
          background: '#ffffff',
          zIndex: 4,
          pointerEvents: 'none'
        }} />
        
        {/* NowLine Time Badge */}
        <div style={{
          position: 'absolute',
          left: `${NOWLINE_X}px`,
          top: '10px',
          transform: 'translateX(-50%)',
          background: '#4caf50',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          zIndex: 100,
          pointerEvents: 'none'
        }}>
          {currentTimeStr}
        </div>
        
        {/* Tracks Stack */}
        {allTracks.map((track) => (
          <div
            key={track.id}
            style={{
              position: 'relative',
              width: '100%',
              height: `${TRACK_HEIGHT}px`,
              overflow: 'hidden'
            }}
          >
            {/* Z-Layer 0: Track Background */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: '#2a2a2a',
              zIndex: 0
            }} />
            
            {/* Z-Layer 1: Task Lozenge */}
            <div
              onClick={() => {
                if (track.status === 'ready' && onStartTask) {
                  onStartTask(track.id);
                } else if (track.status === 'stopped-waiting' && onDismissTask) {
                  onDismissTask(track.id);
                }
              }}
              style={{
                position: 'absolute',
                left: `${track.lozengeX}px`,
                top: `${(TRACK_HEIGHT - LOZENGE_HEIGHT) / 2}px`,
                width: `${track.lozengeWidth}px`,
                height: `${LOZENGE_HEIGHT}px`,
                background: track.color,
                borderRadius: `${LOZENGE_RADIUS}px`,
                zIndex: 1,
                transition: 'left 1s linear',
                cursor: track.needsAction ? 'pointer' : 'default',
                animation: track.needsAction ? 'pulse 2s ease-in-out infinite' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(0,0,0,0.7)',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {track.status === 'ready' && '▶ TAP'}
              {track.status === 'running' && track.remainingMs !== undefined && (
                <span>{Math.ceil(track.remainingMs / 60000)}m</span>
              )}
              {track.status === 'stopped-waiting' && '✓ DONE'}
            </div>
            
            {/* Z-Layer 2: "Past" Overlay (left of NowLine) */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${NOWLINE_X}px`,
              height: '100%',
              background: 'rgba(42, 42, 42, 0.3)',
              pointerEvents: 'none',
              zIndex: 2
            }} />
            
            {/* Z-Layer 2: Task Label Text */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${NOWLINE_X - TEXT_PADDING}px`,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: `${TEXT_PADDING}px`,
              paddingLeft: '10px',
              fontFamily: 'Verdana, sans-serif',
              fontSize: '16px',
              color: '#ffffff',
              textAlign: 'right',
              zIndex: 2,
              pointerEvents: 'none',
              lineHeight: '1.3',
              wordWrap: 'break-word',
              overflowWrap: 'break-word'
            }}>
              {track.taskName}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
