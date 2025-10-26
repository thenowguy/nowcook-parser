import { useMemo, useState, useRef, useEffect } from 'react';
import Lottie from 'lottie-react';
import { getPlannedMinutes } from '../utils/runtime';
import chevronAnimation from '../assets/chevron-left-green.json';

export default function TimelineFlow({ tasks, chains = [], ingredients = [], textMode = 'instructions', running, ready = [], driverBusy = [], blocked = [], completed = [], doneIds, nowMs, onStartTask, onDismissTask, showOnlySmartTasks = false }) {
  // iPhone 11 Configuration - Physical dimensions (2x scale)
  const PIXELS_PER_SECOND = 2;
  const TRACK_HEIGHT = 120; // 240px physical / 2 = 120px logical
  const CHAIN_HEADER_HEIGHT = 40; // 80px physical / 2 = 40px logical
  const LEFT_PANEL_WIDTH = 160; // 320px physical / 2 = 160px logical
  const LOZENGE_HEIGHT = 100; // 200px physical / 2 = 100px logical
  const LOZENGE_RADIUS = 50; // 100px physical / 2 = 50px logical (pill shape)
  const NOWLINE_X = 160; // 320px physical / 2 = 160px logical (at edge of left panel)
  const NOWLINE_WIDTH = 2; // 4px physical / 2 = 2px logical
  const TEXT_PADDING = 15; // 30px physical / 2 = 15px logical (from NowLine)

  // Chain color palette (vibrant, contemporary colors for dark mode)
  const CHAIN_COLORS = [
    { bg: 'rgba(100, 181, 246, 0.12)', accent: '#64b5f6', label: '#90caf9', lozengeTint: 'rgba(100, 181, 246, 0.08)' }, // vibrant blue
    { bg: 'rgba(255, 167, 38, 0.12)', accent: '#ffa726', label: '#ffb74d', lozengeTint: 'rgba(255, 167, 38, 0.08)' }, // vibrant orange
    { bg: 'rgba(240, 98, 146, 0.12)', accent: '#f06292', label: '#f48fb1', lozengeTint: 'rgba(240, 98, 146, 0.08)' }, // vibrant pink
    { bg: 'rgba(129, 199, 132, 0.12)', accent: '#81c784', label: '#a5d6a7', lozengeTint: 'rgba(129, 199, 132, 0.08)' }, // vibrant green
    { bg: 'rgba(149, 117, 205, 0.12)', accent: '#9575cd', label: '#b39ddb', lozengeTint: 'rgba(149, 117, 205, 0.08)' }, // vibrant purple
    { bg: 'rgba(255, 238, 88, 0.12)', accent: '#ffee58', label: '#fff59d', lozengeTint: 'rgba(255, 238, 88, 0.08)' }  // vibrant yellow
  ];
  
  // Get viewport width for full-width lozenges
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 414;
  const AVAILABLE_WIDTH = viewportWidth - NOWLINE_X; // Width from NowLine to right edge
  
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Helper to extract chain ID from task ID (e.g., "chain_1/step_2" -> "chain_1")
  const getChainId = (taskId) => {
    const match = taskId.match(/^(chain_\d+)\//);
    return match ? match[1] : null;
  };

  // Helper to get chain index for color mapping
  const getChainIndex = (chainId) => {
    const match = chainId?.match(/^chain_(\d+)$/);
    return match ? parseInt(match[1]) : 0; // chain_0 -> index 0, chain_1 -> index 1
  };

  // Helper to get chain metadata
  const getChainMeta = (chainId) => {
    const chain = chains.find(c => c.id === chainId);
    return chain || { id: chainId, name: 'Unknown Chain' };
  };

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
        // Handle both string inputs and object inputs {ingredient: "...", ...}
        const ingredientId = typeof input === 'string' ? input : (input.ingredient || input);

        // Try to find ingredient with quantity from ingredients array
        const fullIngredient = ingredients?.find(ing => {
          const normalizedItem = ing.item.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          const normalizedId = ingredientId.toLowerCase();

          // Direct match or ID contains item name
          return normalizedItem === normalizedId ||
                 normalizedItem.includes(normalizedId) ||
                 normalizedId.includes(normalizedItem);
        });

        if (fullIngredient && fullIngredient.amount) {
          // Show quantity + ingredient name
          return `${fullIngredient.amount} ${fullIngredient.item}`;
        }

        // Fallback: format ingredient name nicely (replace underscores, capitalize)
        const formattedName = ingredientId
          .replace(/_/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        return formattedName;
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
  
  // SFX paths (must be defined before useMemo that calls playSFX)
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

  // Sound effects player (must be defined before useMemo that calls it)
  function playSFX(type) {
    if (!isMobile) return;
    try {
      const audio = new window.Audio(SFX[type]);
      audio.volume = 0.7;
      audio.play().catch(err => console.log('Audio play error:', err));
    } catch (err) {
      console.log('Audio setup error:', err);
    }
  }

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

      // Check if running (needed for filter logic below)
      const runningState = running.find(r => r.id === task.id);

      // If smart task filter is active, only show tasks that are:
      // 1. Ready (can-do at NowLine) OR already running
      // 2. Unattended after start (can run in background)
      if (showOnlySmartTasks) {
        const isReady = ready.find(t => t.id === task.id);
        const isRunning = !!runningState;
        const isSmartTask = task.self_running_after_start === true;

        // Show if it's a smart task AND (ready OR running)
        if (!isSmartTask || (!isReady && !isRunning)) return;
      }
      
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
        
        const chainId = getChainId(task.id);
        const chainIdx = getChainIndex(chainId);
        const chainColor = CHAIN_COLORS[chainIdx % CHAIN_COLORS.length];

        tracks.push({
          id: task.id,
          task: task, // Keep full task object for display text
          taskName: getDisplayText(task, textMode, remainingMs),
          lozengeX,
          lozengeWidth,
          status,
          remainingMs,
          color: status === 'stopped-waiting' ? '#9e1212' : '#4caf50',
          needsAction: status === 'stopped-waiting',
          chainId,
          chainColor,
          circleX: NOWLINE_X + 10 // Circle stays fixed at NowLine + 10px inset (where it was when ready)
        });
      } else if (ready.find(t => t.id === task.id)) {
        // READY
        const durationMin = getPlannedMinutes(task);

        // Linear width: 1 minute = 200px (2:1 ratio with 100px height)
        const lozengeWidth = durationMin * 200;
        const lozengeX = NOWLINE_X;

        const chainId = getChainId(task.id);
        const chainIdx = getChainIndex(chainId);
        const chainColor = CHAIN_COLORS[chainIdx % CHAIN_COLORS.length];

        tracks.push({
          id: task.id,
          task: task,
          taskName: getDisplayText(task, textMode),
          lozengeX,
          lozengeWidth,
          status: 'ready',
          color: '#4caf50',
          needsAction: true,
          chainId,
          chainColor,
          circleX: lozengeX + 10 // Circle position: 10px inset from lozenge left edge
        });
      } else if (driverBusy.find(t => t.id === task.id)) {
        // DRIVER-BUSY
        const durationMin = getPlannedMinutes(task);

        // Linear width: 1 minute = 200px (2:1 ratio with 100px height)
        const lozengeWidth = durationMin * 200;
        const lozengeX = NOWLINE_X;

        const chainId = getChainId(task.id);
        const chainIdx = getChainIndex(chainId);
        const chainColor = CHAIN_COLORS[chainIdx % CHAIN_COLORS.length];

        tracks.push({
          id: task.id,
          task: task,
          taskName: getDisplayText(task, textMode),
          lozengeX,
          lozengeWidth,
          status: 'driver-busy',
          color: '#565761',
          needsAction: false,
          chainId,
          chainColor
        });
      } else if (blocked.find(t => t.id === task.id)) {
        // BLOCKED (preview only)
        const chainId = getChainId(task.id);
        const chainIdx = getChainIndex(chainId);
        const chainColor = CHAIN_COLORS[chainIdx % CHAIN_COLORS.length];

        tracks.push({
          id: task.id,
          task: task,
          taskName: getDisplayText(task, textMode),
          lozengeX: 0,
          lozengeWidth: 0,
          status: 'blocked',
          color: '#666',
          needsAction: false,
          chainId,
          chainColor
        });
      }
    });
    
    return tracks;
  }, [tasks, running, ready, driverBusy, blocked, doneIds, nowMs, byId, textMode, ingredients, showOnlySmartTasks]);

  // Group tracks by chain and insert chain headers
  const groupedItems = useMemo(() => {
    const items = [];
    let currentChainId = null;

    allTracks.forEach((track) => {
      // If chain changed, insert header
      if (track.chainId !== currentChainId) {
        currentChainId = track.chainId;
        const chainMeta = getChainMeta(currentChainId);
        const chainIdx = getChainIndex(currentChainId);
        const chainColor = CHAIN_COLORS[chainIdx % CHAIN_COLORS.length];

        items.push({
          type: 'chain-header',
          chainId: currentChainId,
          chainName: chainMeta.name,
          chainColor
        });
      }

      // Add the track
      items.push({ type: 'track', ...track });
    });

    return items;
  }, [allTracks, chains]);

  // Gesture handlers
  const handleDoubleTap = (trackId, status) => {
    if (status === 'ready' && onStartTask) {
      // Get the full task object
      const task = byId.get(trackId);
      if (!task) return;

      // Play start sound immediately for feedback
      playSFX('start');

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

    // CIRCLE TIMER: Renders for both READY and RUNNING states
    // Ready: shows full circle 10px inset from lozenge left edge
    // Running: shows depleting circle FIXED at same position while lozenge slides left
    const isCircleTimer = track.status === 'ready' || track.status === 'running';
    let circleElement = null;

    if (isCircleTimer) {
      const durationMin = track.task ? getPlannedMinutes(track.task) : 10;
      const circleSize = 80; // 80px diameter (160px physical)
      const strokeWidth = 6;
      const radius = (circleSize - strokeWidth) / 2;
      const circumference = 2 * Math.PI * radius;

      // Calculate progress based on status
      let progress = 100; // Ready: full circle
      let remainingMin = durationMin;

      if (track.status === 'running' && track.remainingMs !== undefined) {
        // Running: deplete circle as time runs out
        const totalMs = durationMin * 60000;
        progress = (track.remainingMs / totalMs) * 100;
        remainingMin = Math.ceil(track.remainingMs / 60000);
      }

      const dashOffset = circumference - (progress / 100) * circumference;

      // Circle position: use stored circleX (stays fixed even when lozenge moves)
      const circleX = track.circleX;

      // Circle colors: consistent green (#6DAD59) for both fill and stroke
      const isReady = track.status === 'ready';
      const greenColor = '#6DAD59'; // Bright green for can-do indicator

      circleElement = (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          style={{
            position: 'absolute',
            left: `${circleX}px`, // Left edge aligns with lozenge left edge
            top: `${(TRACK_HEIGHT - circleSize) / 2}px`,
            width: `${circleSize}px`,
            height: `${circleSize}px`,
            zIndex: 3, // Always on top (buttons sit on lozenges)
            cursor: 'pointer', // Always show pointer cursor for circle timers
            animation: isFlashing ? 'flash 0.3s ease-out' : 'none',
            touchAction: 'none',
            userSelect: 'none',
            pointerEvents: 'auto' // Circle is always interactive (tap to start/dismiss)
          }}
        >
          <svg width={circleSize} height={circleSize} style={{ transform: 'rotate(-90deg)' }}>
            {/* Background circle - solid green for ready, depleting for running */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              fill={greenColor}
              stroke={greenColor}
              strokeWidth={strokeWidth}
              opacity={isReady ? 1.0 : 0.3}
            />
            {/* Progress circle - radial wipe countdown (only visible for running tasks) */}
            {!isReady && (
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                fill="transparent"
                stroke={greenColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            )}
          </svg>
          {/* Remaining time text in center */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
            fontSize: isReady ? '24px' : '20px', // +50% larger (was 16px/13px)
            fontWeight: '700', // Bold for better readability at arm's length
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Mono", Menlo, Consolas, "Courier New", monospace', // Clean zeros, no slash
            opacity: 0.9, // 90% opacity for softer appearance
            transition: 'font-size 0.3s ease-out'
          }}>
            {(() => {
              // Smart time formatting based on threshold:
              // ≥10min: show minutes only (150m, 76m, 34m, 11m, 10m)
              // <10min: show mm:ss format (9:59, 5:30, 1:00) - no leading zeros
              const mins = Math.ceil(remainingMin);

              if (mins >= 10) {
                // Show minutes only
                return `${mins}m`;
              } else {
                // Show mm:ss (no leading zero on minutes)
                const totalSeconds = Math.ceil(remainingMin * 60);
                const m = Math.floor(totalSeconds / 60);
                const s = totalSeconds % 60;
                return `${m}:${String(s).padStart(2, '0')}`;
              }
            })()}
          </div>
        </div>
      );

      // For READY tasks, return both grey lozenge AND green circle
      if (track.status === 'ready') {
        // Continue to render grey lozenge below
      }

      // For RUNNING tasks, we'll render the circle along with the lozenge below
    }

    // GREY LOZENGE RENDERING: All lozenges are grey, state shown by circle color
    const chainAccent = track.chainColor?.accent || '#888';

    // Lozenge color: grey by default, dark green when running
    const lozengeGrey = '#4D535E'; // Neutral grey for all lozenges
    const lozengeRunning = '#365236'; // Dark green when task is started
    const lozengeColor = track.status === 'running' ? lozengeRunning : lozengeGrey;

    const lozengeElement = (
      <div
        style={{
          position: 'absolute',
          left: `${track.lozengeX}px`,
          top: `${(TRACK_HEIGHT - LOZENGE_HEIGHT) / 2}px`,
          width: `${track.lozengeWidth}px`,
          height: `${LOZENGE_HEIGHT}px`,
          background: lozengeColor, // Grey normally, dark green when running
          borderRadius: `${LOZENGE_RADIUS}px`,
          borderLeft: `4px solid ${chainAccent}`, // Only chain color is the left stripe
          zIndex: 1,
          transition: 'left 1s linear',
          cursor: 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.7)', // White text on grey
          fontSize: '14px',
          fontWeight: '600',
          touchAction: 'none',
          userSelect: 'none',
          pointerEvents: 'none' // Non-interactive - only circle handles touches
        }}
      ></div>
    );

    // For READY and RUNNING tasks, return both lozenge AND circle
    // (Ready: grey lozenge + solid green circle, Running: grey lozenge + depleting timer circle)
    if (isCircleTimer) {
      return (
        <>
          {lozengeElement}
          {circleElement}
        </>
      );
    }

    // For all other tasks (stopped-waiting, driver-busy), return just the lozenge
    return lozengeElement;
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
        
        {/* Tracks Stack with Chain Headers */}
        {groupedItems.map((item, idx) => {
          // Render chain header
          if (item.type === 'chain-header') {
            // Remove "Prepare " prefix from chain name
            const cleanChainName = item.chainName.replace(/^Prepare\s+/i, '');

            return (
              <div
                key={`header-${item.chainId}`}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: `${CHAIN_HEADER_HEIGHT}px`,
                  background: item.chainColor.bg,
                  borderBottom: `1px solid ${item.chainColor.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: `${NOWLINE_X + 10}px`, // 10px to the right of NowLine
                  paddingTop: '10px', // Match spacing above and below header
                  zIndex: 2
                }}
              >
                <span style={{
                  color: item.chainColor.label,
                  fontSize: '15px', // Increased from 13px for better readability
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {cleanChainName}
                </span>
              </div>
            );
          }

          // Render track
          const track = item;
          const isSwiping = swipingId === track.id;

          // Check if previous item was a chain header (first track in group)
          const isFirstInGroup = idx > 0 && groupedItems[idx - 1].type === 'chain-header';

          return (
            <div
              key={track.id}
              className={isSwiping ? 'swiping-track' : ''}
              style={{
                position: 'relative',
                width: '100%',
                height: `${TRACK_HEIGHT}px`,
                marginTop: isFirstInGroup ? '10px' : '0', // Add 10px margin above first track in group
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
                left: `${NOWLINE_X + 150}px`, // Fixed at 150px right of NowLine (moved 40px further right)
                top: `${TRACK_HEIGHT / 2}px`,
                width: '80px', // Same as circle diameter
                height: '80px', // Same as circle diameter
                transform: 'translate(-50%, -50%) rotate(90deg)',
                zIndex: 3,
                pointerEvents: 'none',
                opacity: 0.25 // 25% opacity - subtle sense of movement
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
              background: 'rgba(34, 35, 40, 0.3)', // 30% opacity of #222328
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
              color: 'rgba(255, 255, 255, 0.8)', // 80% white - softer for mobile
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
