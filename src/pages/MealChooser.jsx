import { useNavigate } from 'react-router-dom';
import { MEALS, calculateMinCookTime } from '../data/meals';

export default function MealChooser() {
  const navigate = useNavigate();

  const handleCookClick = (meal) => {
    navigate(`/schedule/${meal.idx}`, { 
      state: { meal } 
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '500px',
        margin: '0 auto',
      }}>
        <header style={{
          textAlign: 'center',
          color: 'white',
          marginBottom: '32px',
          paddingTop: '20px'
        }}>
          <h1 style={{ 
            fontSize: '32px', 
            margin: '0 0 8px 0',
            fontWeight: 'bold'
          }}>
            NowCook
          </h1>
          <p style={{ 
            fontSize: '16px', 
            margin: 0,
            opacity: 0.9
          }}>
            What are we cooking today?
          </p>
        </header>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {MEALS.map((meal) => {
            console.log('Rendering meal:', meal.title, meal);
            const min = calculateMinCookTime(meal);
            const serveTime = new Date(Date.now() + min * 60000);
            const serveTimeStr = serveTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit' 
            });

            return (
              <div 
                key={meal.idx}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <h2 style={{
                  fontSize: '24px',
                  margin: '0 0 8px 0',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {meal.title || 'Untitled Meal'}
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#666',
                  margin: '0 0 16px 0'
                }}>
                  by {meal.author}
                </p>
                
                <div style={{ 
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  <div>Min cook time: <strong>{Math.round(min)} min</strong></div>
                  <div>Serve at: <strong>{serveTimeStr}</strong></div>
                </div>

                <button 
                  onClick={() => handleCookClick(meal)}
                  style={{
                    marginTop: 'auto',
                    padding: '16px 32px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    width: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                    minHeight: '56px'
                  }}
                >
                  🍳 COOK
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
