import { useNavigate, useParams, useLocation } from 'react-router-dom';

export default function SchedulingModal() {
  const navigate = useNavigate();
  const { mealIdx } = useParams();
  const location = useLocation();
  const meal = location.state?.meal;

  const handleSchedule = (scheduleType) => {
    // For now, all options just start the meal immediately
    // TODO: Implement actual scheduling logic for future serve times
    navigate(`/runtime/${mealIdx}`, {
      state: { meal, scheduleType }
    });
  };

  if (!meal) {
    navigate('/');
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          {meal.title}
        </h2>
        <p style={{ 
          margin: '0 0 24px 0', 
          color: '#666',
          fontSize: '16px'
        }}>
          Ready in {Math.round(meal.min)} minutes
        </p>
        
        <div style={{ 
          marginBottom: '24px', 
          fontSize: '16px', 
          fontWeight: '500' 
        }}>
          When would you like to serve?
        </div>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px' 
        }}>
          <button 
            onClick={() => handleSchedule('now')}
            style={{ 
              padding: '16px', 
              fontSize: '16px', 
              borderRadius: '8px',
              border: '2px solid #4CAF50',
              background: '#4CAF50',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
              minHeight: '56px'
            }}
          >
            🍳 Start now
          </button>
          
          <button 
            onClick={() => handleSchedule('30min')}
            style={{ 
              padding: '16px', 
              fontSize: '15px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              border: '1px solid #ddd',
              background: 'white',
              minHeight: '56px'
            }}
          >
            ⏰ Add 30 minutes
          </button>
          
          <button 
            onClick={() => handleSchedule('1hr')}
            style={{ 
              padding: '16px', 
              fontSize: '15px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              border: '1px solid #ddd',
              background: 'white',
              minHeight: '56px'
            }}
          >
            ⏰ Add 1 hour
          </button>
          
          <button 
            onClick={() => handleSchedule('2hr')}
            style={{ 
              padding: '16px', 
              fontSize: '15px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              border: '1px solid #ddd',
              background: 'white',
              minHeight: '56px'
            }}
          >
            ⏰ Add 2 hours
          </button>
          
          <button 
            onClick={() => handleSchedule('6pm')}
            style={{ 
              padding: '16px', 
              fontSize: '15px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              border: '1px solid #ddd',
              background: 'white',
              minHeight: '56px'
            }}
          >
            🌙 Tonight at 6pm
          </button>
          
          <button 
            onClick={() => handleSchedule('7pm')}
            style={{ 
              padding: '16px', 
              fontSize: '15px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              border: '1px solid #ddd',
              background: 'white',
              minHeight: '56px'
            }}
          >
            🌙 Tonight at 7pm
          </button>
          
          <button 
            onClick={() => handleSchedule('tomorrow7pm')}
            style={{ 
              padding: '16px', 
              fontSize: '15px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              border: '1px solid #ddd',
              background: 'white',
              minHeight: '56px'
            }}
          >
            📅 Tomorrow at 7pm
          </button>
        </div>
        
        <button 
          onClick={() => navigate('/')}
          style={{ 
            marginTop: '16px', 
            padding: '12px', 
            width: '100%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#666',
            fontSize: '16px'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
