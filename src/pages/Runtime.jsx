import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMemo, useState, useEffect, useRef } from 'react';
import { getMeal } from '../data/meals';
import { useRuntime, mmss, getPlannedMinutes, orderForLanes, suggestQueue } from '../utils/runtime';
import TimelineFlow from '../components/TimelineFlow';

export default function Runtime() {
  const navigate = useNavigate();
  const { mealIdx } = useParams();
  const location = useLocation();
  
  const meal = getMeal(parseInt(mealIdx));
  
  if (!meal || !meal.data) {
    navigate('/');
    return null;
  }

  const tasks = meal.data.tasks || [];
  const rt = useRuntime(tasks);
  
  // Auto-start cooking interface immediately for alpha testing
  useEffect(() => {
    rt.setStarted(true);
  }, []);
  
  // Toggle state for showing/hiding blocked tasks
  const [showBlocked, setShowBlocked] = useState(true);
  
  // Toggle state for text display mode: 'instructions' | 'ingredients' | 'time'
  const [textMode, setTextMode] = useState('instructions');
  
  // Auto-reset timer for text mode
  const textModeTimerRef = useRef(null);
  
  // Auto-reset textMode to 'instructions' after 5 seconds
  useEffect(() => {
    if (textMode !== 'instructions') {
      // Clear any existing timer
      if (textModeTimerRef.current) {
        clearTimeout(textModeTimerRef.current);
      }
      
      // Set new timer to reset after 5 seconds
      textModeTimerRef.current = setTimeout(() => {
        setTextMode('instructions');
      }, 5000);
    }
    
    // Cleanup on unmount
    return () => {
      if (textModeTimerRef.current) {
        clearTimeout(textModeTimerRef.current);
      }
    };
  }, [textMode]);
  
  const byId = useMemo(() => 
    new Map(tasks.map((t) => [t.id, t])), 
    [tasks]
  );

  // Wrapper for startTask that also resets text mode to instructions
  const handleStartTask = (taskId) => {
    setTextMode('instructions');
    rt.startTask(taskId);
  };

  const handleStart = () => {
    // Unlock audio on mobile browsers (requires user gesture)
    // Play a silent sound to enable future audio playback
    try {
      const silentAudio = new Audio('/SFX/arrive.wav');
      silentAudio.volume = 0.01; // Nearly silent
      silentAudio.play().catch(() => {}); // Ignore errors
    } catch (err) {
      // Ignore audio unlock errors
    }

    rt.setStarted(true);
  };

  const handleFinish = () => {
    rt.reset();
    navigate('/');
  };

  // Calculate serve time
  const serveTimeMs = rt.started ? Date.now() + (meal.data.min_time || 20) * 60000 : null;
  const serveTimeStr = serveTimeMs 
    ? new Date(serveTimeMs).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      })
    : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Mobile Background Image - CSS in head */}
      <style>{`
        @media (max-width: 768px) {
          .timeline-background {
            background-image: url('/TimelineBG.jpg') !important;
            background-size: cover !important;
            background-position: top left !important;
            background-repeat: no-repeat !important;
            background-color: #222328 !important;
          }
        }
        @media (min-width: 769px) {
          .timeline-background {
            background: #222328 !important;
          }
        }
      `}</style>

      {/* Start Screen */}
      {!rt.started && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>
              Ready to cook?
            </h2>
            <p style={{ color: '#666', marginBottom: '32px', fontSize: '16px' }}>
              Min cook time: <strong>{meal.data.min_time || 20} minutes</strong>
            </p>
            <button
              onClick={handleStart}
              style={{
                padding: '20px 40px',
                fontSize: '20px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                minHeight: '60px',
                minWidth: '200px'
              }}
            >
              🍳 START COOKING
            </button>
          </div>
        </div>
      )}

      {/* Cooking Interface */}
      {rt.started && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Hero Image */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '150px', // 300px physical / 2 = 150px logical
            overflow: 'hidden',
            background: '#000'
          }}>
            <img 
              src="/MacnCheese_pic.png" 
              alt={meal.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            
            {/* Home button - top left corner of hero image */}
            <button
              onClick={() => navigate('/')}
              style={{
                position: 'absolute',
                left: '20px',
                top: '20px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              <img 
                src="/nowcook-icon.png"
                alt="Home"
                style={{
                  width: '60px',
                  height: '60px',
                  opacity: 1
                }}
              />
            </button>
          </div>

          {/* Dark Panel with NOW Time Badge */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '50px', // 100px physical / 2 = 50px logical
            background: '#575762',
            opacity: 0.7
          }}>
            {/* Text mode toggle button - 30px from left edge */}
            <button
              onClick={() => {
                const modes = ['instructions', 'ingredients', 'time'];
                const currentIndex = modes.indexOf(textMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                setTextMode(modes[nextIndex]);
              }}
              style={{
                position: 'absolute',
                left: '30px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img 
                src={
                  textMode === 'instructions' ? '/info-icon.png' :
                  textMode === 'ingredients' ? '/ingredients-icon.png' :
                  '/clock-icon.png'
                }
                alt={`Show ${textMode}`}
                style={{
                  width: '40px',
                  height: '40px',
                  opacity: 0.9
                }}
              />
            </button>
            
            {/* Time badge positioned over NowLine at 160px */}
            <div style={{
              position: 'absolute',
              left: '160px',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#4caf50',
              color: 'white',
              padding: '0px 12px',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap'
            }}>
              {new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              })}
            </div>
            
            {/* Eye toggle button - 40px from right edge */}
            <button
              onClick={() => setShowBlocked(!showBlocked)}
              style={{
                position: 'absolute',
                right: '40px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img 
                src={showBlocked ? '/eye-open.png' : '/eye-closed.png'}
                alt={showBlocked ? 'Hide blocked tasks' : 'Show blocked tasks'}
                style={{
                  width: '40px',
                  height: '40px',
                  opacity: 0.9
                }}
              />
            </button>
          </div>

          {/* Timeline - THE main interface */}
          <div
            className="timeline-background"
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 0,
              background: '#222328'
            }}
          >
            <TimelineFlow
              tasks={tasks}
              chains={meal.data.chains || []}
              ingredients={meal.data.ingredients || []}
              textMode={textMode}
              running={rt.running}
              ready={rt.ready}
              driverBusy={showBlocked ? rt.driverBusyTasks : []}
              blocked={showBlocked ? rt.blocked : []}
              completed={rt.completed}
              doneIds={rt.doneIds}
              nowMs={rt.nowMs}
              onStartTask={handleStartTask}
              onDismissTask={rt.finishTask}
            />
          </div>

          {/* Bottom Controls - HIDDEN for now */}
          <div style={{
            display: 'none',  // Hidden - functionality moved to timeline
            background: 'white',
            borderTop: '1px solid #e0e0e0',
            padding: '16px 20px',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
          }}>
            {/* Running Tasks */}
            {rt.running.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  color: '#666'
                }}>
                  Active Tasks
                </h3>
                {rt.running.map((r) => {
                  const task = byId.get(r.id);
                  const remainMs = Math.max(0, r.endsAt - rt.nowMs);
                  const timeUp = remainMs <= 0;
                  
                  return (
                    <div 
                      key={r.id}
                      style={{
                        background: timeUp ? '#ffebee' : '#f5f5f5',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                          {task?.name || 'Task'}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {timeUp ? '⏰ Time up!' : `⏱️ ${mmss(remainMs)} remaining`}
                        </div>
                      </div>
                      <button
                        onClick={() => rt.finishTask(r.id)}
                        style={{
                          padding: '12px 20px',
                          background: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          minWidth: '100px'
                        }}
                      >
                        ✓ Done
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Can Do Now Tasks */}
            {rt.canDoNow.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  color: '#1976d2'
                }}>
                  Ready to Start ({rt.canDoNow.length})
                </h3>
                {rt.canDoNow.slice(0, 3).map((task) => (
                  <div 
                    key={task.id}
                    style={{
                      background: '#e3f2fd',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {task.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {getPlannedMinutes(task)} min
                      </div>
                    </div>
                    <button
                      onClick={() => rt.startTask(task)}
                      style={{
                        padding: '12px 20px',
                        background: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        minWidth: '100px'
                      }}
                    >
                      Start
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Could Do Now (Optional Prep) */}
            {rt.couldDoNow.length > 0 && (
              <details style={{ marginBottom: '16px' }}>
                <summary style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  color: '#4CAF50',
                  cursor: 'pointer',
                  marginBottom: '8px'
                }}>
                  Optional Prep ({rt.couldDoNow.length})
                </summary>
                {rt.couldDoNow.map((task) => (
                  <div 
                    key={task.id}
                    style={{
                      background: '#f1f8e9',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {task.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {getPlannedMinutes(task)} min • Can do anytime
                      </div>
                    </div>
                    <button
                      onClick={() => rt.startTask(task)}
                      style={{
                        padding: '12px 20px',
                        background: '#8BC34A',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        minWidth: '100px'
                      }}
                    >
                      Start
                    </button>
                  </div>
                ))}
              </details>
            )}

            {/* All Done! */}
            {rt.doneIds.size === tasks.length && (
              <div style={{
                background: '#4CAF50',
                color: 'white',
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                <h2 style={{ fontSize: '24px', margin: '0 0 8px 0' }}>
                  🎉 All done!
                </h2>
                <p style={{ margin: '0 0 16px 0' }}>
                  Enjoy your {meal.title}
                </p>
                <button
                  onClick={handleFinish}
                  style={{
                    padding: '12px 24px',
                    background: 'white',
                    color: '#4CAF50',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
