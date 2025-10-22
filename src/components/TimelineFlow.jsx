import { useMemo, useState, useRef, useEffect } from 'react';
import Lottie from 'lottie-react';
import { getPlannedMinutes } from '../utils/runtime';
import chevronAnimation from '../assets/chevron-left-green.json';

export default function TimelineFlow({ tasks, ingredients = [], textMode = 'instructions', running, ready = [], driverBusy = [], blocked = [], completed = [], doneIds, nowMs, onStartTask, onDismissTask }) {
  // iPhone 11 Configuration - Physical dimensions (2x scale)
  const PIXELS_PER_SECOND = 2;
  const TRACK_HEIGHT = 115; // 230px physical / 2 = 115px logical
  const LEFT_PANEL_WIDTH = 160; // 320px physical / 2 = 160px logical
  const LOZENGE_HEIGHT = 100; // 200px physical / 2 = 100px logical
  const LOZENGE_RADIUS = 50; // 100px physical / 2 = 50px logical (pill shape)
  const NOWLINE_X = 160; // 320px physical / 2 = 160px logical (at edge of left panel)
  const NOWLINE_WIDTH = 2; // 4px physical / 2 = 2px logical
  const TEXT_PADDING = 15; // 30px physical / 2 = 15px logical (from NowLine)
  
  // Get viewport width for full-width lozenges
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 414;
  const AVAILABLE_WIDTH = viewportWidth - NOWLINE_X; // Width from NowLine to right edge
  
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  
  // Helper to get display text based on mode
  const getDisplayText = (task, mode, remainingMs = null) => {
    if (mode === 'instructions') {
      return task.name;
    }
    
    if (mode === 'ingredients') {
      // Get ingredients from task inputs
      if (!task.inputs || task.inputs.length === 0) {
        return task.name; // Fallback to instruction if no ingredients
      }
      
      // Map ingredient IDs to full ingredient info
      const ingredientTexts = task.inputs.map(input => {
        const ingredientId = input.ingredient;
        // Try multiple matching strategies
        const fullIngredient = ingredients.find(ing => {
          const normalizedItem = ing.item.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          const normalizedId = ingredientId.toLowerCase();
          
          // Direct match or ID contains item name
          return normalizedItem === normalizedId || 
                 normalizedItem.includes(normalizedId) ||
                 normalizedId.includes(normalizedItem);
        });
        
        if (fullIngredient) {
          return `${fullIngredient.amount} ${fullIngredient.item}`;
        }
        // Fallback to just the ID if not found
        return ingredientId.replace(/_/g, ' ');
      });
      
      return ingredientTexts.join(', ') || task.name;
    }
    
    if (mode === 'time') {
      // Show 'DONE' for finished tasks
      if (task.status === 'finished' || task.status === 'completed') {
        return 'DONE';
      }
      
      // Show countdown for running tasks, planned time for others
      if (remainingMs !== null && remainingMs > 0) {
        const totalSeconds = Math.ceil(remainingMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // Format: MM:SS if less than 1 hour, H:MM:SS if 1+ hours
        if (hours > 0) {
          return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
          return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
      } else {
        // Show planned duration
        const durationMin = getPlannedMinutes(task);
        const totalSeconds = durationMin * 60;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // Format: MM:SS if less than 1 hour, H:MM:SS if 1+ hours
        if (hours > 0) {
          return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
          return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
      }
    }
    
    return task.name;
  };
  
  // Gesture state
  const [flashingId, setFlashingId] = useState(null);
  const [swipingId, setSwipingId] = useState(null);
  
  const now = new Date();
  const currentTimeStr = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    second: '2-digit'
  });
  
  const allTracks = useMemo(() => {
    const tracks = [];
    
    // Iterate through ALL tasks in their original order
    tasks.forEach((task) => {
      // Skip if dismissed
      if (doneIds.has(task.id)) return;
      
      // Check if running
      const runningState = running.find(r => r.id === task.id);
      
      if (runningState) {
        // RUNNING or STOPPED-WAITING
        const durationMin = getPlannedMinutes(task);
        const durationMs = durationMin * 60000;
        const elapsedMs = nowMs - runningState.startedAt;
        const remainingMs = durationMs - elapsedMs;
        
        // Linear width: 1 minute = 200px (2:1 ratio with 100px height)
        const lozengeWidth = durationMin * 200;
        const elapsedPixels = (elapsedMs / 1000) * PIXELS_PER_SECOND;
        
        let lozengeX = NOWLINE_X - elapsedPixels;
        const rightEdge = lozengeX + lozengeWidth;
        
        // TURNSTILE: Stop when right edge hits NowLine
        let status = 'running';
        if (rightEdge <= NOWLINE_X) {
          lozengeX = NOWLINE_X - lozengeWidth;
          status = 'stopped-waiting';
          playSFX('arrive');
        }
        
        tracks.push({
          id: task.id,
          task: task, // Keep full task object for display text
          taskName: getDisplayText(task, textMode, remainingMs),
          lozengeX,
          lozengeWidth,
          status,
          remainingMs,
          color: status === 'stopped-waiting' ? '#9e1212' : '#4caf50',
          needsAction: status === 'stopped-waiting'
        });
      } else if (ready.find(t => t.id === task.id)) {
        // READY
        const durationMin = getPlannedMinutes(task);
        
        // Linear width: 1 minute = 200px (2:1 ratio with 100px height)
        const lozengeWidth = durationMin * 200;
        const lozengeX = NOWLINE_X;
        
        tracks.push({
          id: task.id,
          task: task,
          taskName: getDisplayText(task, textMode),
          lozengeX,
          lozengeWidth,
          status: 'ready',
          color: '#4caf50',
          needsAction: true
        });
      } else if (driverBusy.find(t => t.id === task.id)) {
        // DRIVER-BUSY
        const durationMin = getPlannedMinutes(task);
        
        // Linear width: 1 minute = 200px (2:1 ratio with 100px height)
        const lozengeWidth = durationMin * 200;
        const lozengeX = NOWLINE_X;
        
        tracks.push({
          id: task.id,
          task: task,
          taskName: getDisplayText(task, textMode),
          lozengeX,
          lozengeWidth,
          status: 'driver-busy',
          color: '#565761',
          needsAction: false
        });
      } else if (blocked.find(t => t.id === task.id)) {
        // BLOCKED (preview only)
        tracks.push({
          id: task.id,
          task: task,
          taskName: getDisplayText(task, textMode),
          lozengeX: 0,
          lozengeWidth: 0,
          status: 'blocked',
          color: '#666',
          needsAction: false
        });
      }
    });
    
    return tracks;
  }, [tasks, running, ready, driverBusy, blocked, doneIds, nowMs, byId, textMode, ingredients]);
  
  // Gesture handlers
  const handleDoubleTap = (trackId, status) => {
    if (status === 'ready' && onStartTask) {
      // Get the full task object
      const task = byId.get(trackId);
      if (!task) return;
      
      // Flash confirmation
      setFlashingId(trackId);
      setTimeout(() => setFlashingId(null), 300);
      
      // Start task after flash with full task object
      setTimeout(() => onStartTask(task), 150);
    } else if (status === 'driver-busy') {
      // Play error sound when trying to start a task that can't be started
      playSFX('error');
    }
  };
  
  const handleSwipeLeft = (trackId, status) => {
    // Prevent multiple swipes on the same task
    if (swipingId === trackId) return;
    
    // Allow swipe on: stopped-waiting (completed), ready (early-finish), or running (early-finish)
    if ((status === 'stopped-waiting' || status === 'ready' || status === 'running') && onDismissTask) {
      // Start swipe animation
      setSwipingId(trackId);
      playSFX('dismiss');
      
      // Wait for complete animation sequence before dismissing
      // 1s swipe + 1s collapse = 2s total
      setTimeout(() => {
        onDismissTask(trackId);
        setSwipingId(null);
      }, 2100); // Slight buffer to ensure animations complete
    }
  };
  
  // SFX paths
  const SFX = {
    start: '/SFX/startTask.mp3',
    dismiss: '/SFX/dismiss.wav',
    arrive: '/SFX/arrive.wav',
    error: '/SFX/error.wav',
  };

  // Simple mobile detection
  const isMobile = typeof window !== 'undefined' && (
    'ontouchstart' in window || navigator.maxTouchPoints > 0
  );

  function playSFX(type) {
    if (!isMobile) return;
    const audio = new window.Audio(SFX[type]);
    audio.volume = 0.7;
    audio.play();
  }
  
  // Lozenge component with gesture detection
  const GestureLozenge = ({ track }) => {
    const lastTapRef = useRef(0);
    const touchStartRef = useRef({ x: 0, y: 0 });
    const mouseStartRef = useRef({ x: 0, y: 0 });
    
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };
    
    const handleTouchEnd = (e) => {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      
      // Detect swipe left (must move > 40px left, and not too much vertical)
      // Only allow swipe for non-driver-busy tasks
      if (deltaX < -40 && Math.abs(deltaY) < 50) {
        if (track.status !== 'driver-busy') {
          handleSwipeLeft(track.id, track.status);
        }
        return;
      }
      
      // Detect double-tap (two taps within 500ms, minimal movement)
      if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapRef.current;
        
        if (timeSinceLastTap < 500 && timeSinceLastTap > 50) {
          // Double tap detected
          handleDoubleTap(track.id, track.status);
          playSFX('start');
          lastTapRef.current = 0; // Reset
        } else {
          // First tap
          lastTapRef.current = now;
        }
      }
    };
    
    // Mouse handlers for desktop support
    const handleMouseDown = (e) => {
      mouseStartRef.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseUp = (e) => {
      const deltaX = e.clientX - mouseStartRef.current.x;
      const deltaY = e.clientY - mouseStartRef.current.y;
      
      // Only process clicks (minimal movement)
      if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) {
        const now = Date.now();
        const timeSinceLastClick = now - lastTapRef.current;
        
        if (timeSinceLastClick < 500 && timeSinceLastClick > 50) {
          // Double click detected
          handleDoubleTap(track.id, track.status);
          playSFX('start');
          lastTapRef.current = 0; // Reset
        } else {
          // First click
          lastTapRef.current = now;
        }
      }
    };
    
    // Context menu for desktop dismiss
    const handleContextMenu = (e) => {
      e.preventDefault(); // Prevent default context menu
      
      // Disable interaction for driver-busy tasks
      if (track.status === 'driver-busy') return;
      
      // Right-click to dismiss
      if (track.status === 'stopped-waiting' || track.status === 'ready' || track.status === 'running') {
        handleSwipeLeft(track.id, track.status);
      }
    };
    
    const isFlashing = flashingId === track.id;
    const isSwiping = swipingId === track.id;
    
    // Don't render lozenge for blocked tasks
    if (track.status === 'blocked') {
      return null;
    }
    
    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
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
          animation: isFlashing ? 'flash 0.3s ease-out' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(0,0,0,0.7)',
          fontSize: '14px',
          fontWeight: '600',
          touchAction: 'none', // Prevent default touch behaviors
          userSelect: 'none',
          pointerEvents: 'auto' // Re-enable pointer events on the lozenge
        }}
      ></div>
    );
  };
  
  return (
    <>
      <style>
        {`
          @keyframes flash {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
          }
          
          @keyframes swipeOut {
            from { 
              transform: translateX(0);
              opacity: 1;
            }
            to { 
              transform: translateX(-100%);
              opacity: 0;
            }
          }
          
          .swiping-track {
            animation: swipeOut 1s ease-out forwards !important;
          }
          
          @keyframes collapseTrack {
            0% {
              height: 115px;
              opacity: 1;
              margin-top: 0;
            }
            100% {
              height: 0;
              opacity: 0;
              margin-top: -115px;
              padding: 0;
            }
          }
        `}
      </style>
      
      {/* Parent Container - Full Width */}
      <div style={{
        position: 'relative',
        width: '100%', // Full width of viewport
        background: 'transparent', // Allow background image from parent to show through
        overflow: 'hidden',
        paddingTop: '20px'
      }}>
        {/* Z-Layer 5: Right edge shadow panel */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '20px',
          background: 'rgba(42, 42, 42, 0.3)',
          zIndex: 5,
          pointerEvents: 'none'
        }} />
        
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
        
        {/* Tracks Stack */}
        {allTracks.map((track) => {
          const isSwiping = swipingId === track.id;
          
          return (
            <div
              key={track.id}
              className={isSwiping ? 'swiping-track' : ''}
              style={{
                position: 'relative',
                width: '100%',
                height: `${TRACK_HEIGHT}px`,
                overflow: 'hidden',
                pointerEvents: 'none', // Allow touches to pass through to lower tracks
                transition: 'all 1s ease-out', // Smooth transition when tracks move up
                animation: isSwiping ? 'collapseTrack 1s ease-out 1s forwards' : 'none'
              }}
            >
            {/* Z-Layer 0: Track Background */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'transparent', // Allow background image to show through
              zIndex: 0,
              pointerEvents: 'none'
            }} />
            
            {/* Z-Layer 1: Task Lozenge with Gesture Support */}
            <GestureLozenge track={track} />
            
            {/* Z-Layer 1.5: Animated Chevron for Running Tasks */}
            {track.status === 'running' && (
              <div style={{
                position: 'absolute',
                left: `${NOWLINE_X + 50}px`, // Fixed at 50px right of NowLine (210px from left edge)
                top: `${TRACK_HEIGHT / 2}px`,
                width: '60px',
                height: '60px',
                transform: 'translate(-50%, -50%) rotate(90deg)',
                zIndex: 3,
                pointerEvents: 'none'
              }}>
                <Lottie 
                  animationData={chevronAnimation}
                  loop={true}
                  style={{
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>
            )}
            
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
              width: `${NOWLINE_X - TEXT_PADDING - 10}px`, // Extra 10px from right
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: `${TEXT_PADDING + 10}px`,
              paddingLeft: '10px',
              fontFamily: textMode === 'time' ? 'monospace' : 'Verdana, sans-serif',
              fontSize: textMode === 'time' ? '22px' : '18px',
              color: '#ffffff',
              opacity: (track.status === 'blocked' || track.status === 'driver-busy') ? 0.5 : 1.0,
              textAlign: 'right',
              zIndex: 2,
              pointerEvents: 'none',
              lineHeight: '1.3',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              letterSpacing: textMode === 'time' ? '1px' : 'normal'
            }}>
              {track.taskName}
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}
