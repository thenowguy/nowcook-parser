import { useNavigate } from 'react-router-dom';
import { MEALS, calculateMinCookTime } from '../data/meals';

export default function MealChooser() {
  const navigate = useNavigate();

  const handleCookClick = (meal) => {
    // For alpha testing: skip scheduling modal, go straight to runtime
    navigate(`/runtime/${meal.idx}`, { 
      state: { meal } 
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#222328', // Match timeline background
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
          {/* NowCook Logo */}
          <img
            src="/nowcook-icon.png"
            alt="NowCook"
            style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 16px auto',
              display: 'block'
            }}
          />
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
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: '4px solid #d0d0d0', // Neutral light grey top accent
                  backgroundImage: 'linear-gradient(to bottom, rgba(208, 208, 208, 0.15) 0%, transparent 60px)' // Subtle gradient fade
                }}
              >
                {/* Hero Image */}
                <div style={{
                  width: '100%',
                  height: '200px',
                  background: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: '#999'
                }}>
                  {meal.image ? (
                    <img
                      src={meal.image}
                      alt={meal.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#999;">Image Coming Soon</div>';
                      }}
                    />
                  ) : (
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',color:'#999'}}>
                      Image Coming Soon
                    </div>
                  )}
                </div>

                <div style={{ padding: '20px' }}>
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

                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: 'auto'
                  }}>
                    <button 
                      onClick={() => navigate(`/shop/${meal.idx}`)}
                      style={{
                        flex: 1,
                        padding: '16px 24px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        background: '#88aa55',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(136, 170, 85, 0.4)',
                        minHeight: '56px'
                      }}
                    >
                      🛒 SHOP
                    </button>
                    <button 
                      onClick={() => handleCookClick(meal)}
                      style={{
                        flex: 1,
                        padding: '16px 24px',
                        fontSize: '16px',
                        fontWeight: 'bold',
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
