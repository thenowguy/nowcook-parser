import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
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
  
  const byId = useMemo(() => 
    new Map(tasks.map((t) => [t.id, t])), 
    [tasks]
  );

  const handleStart = () => {
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
            width: '100%',
            height: '150px', // 300px physical / 2 = 150px logical
            overflow: 'hidden',
            background: '#000'
          }}>
            <img 
              src="/mac-cheese-hero.png" 
              alt={meal.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>

          {/* Dark Panel with NOW Time Badge */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '50px', // 100px physical / 2 = 50px logical
            background: '#575762'
          }}>
            {/* Time badge positioned over NowLine at 160px */}
            <div style={{
              position: 'absolute',
              left: '160px',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#4caf50',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}>
              {new Date().toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>

          {/* Timeline - THE main interface */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: 0,
            background: 'white'
          }}>
            <TimelineFlow
              tasks={tasks}
              running={rt.running}
              ready={rt.ready}
              completed={rt.completed}
              doneIds={rt.doneIds}
              nowMs={rt.nowMs}
            />
          </div>

          {/* Bottom Controls */}
          <div style={{
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
