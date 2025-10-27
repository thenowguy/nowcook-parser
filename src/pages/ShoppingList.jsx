import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MEALS } from '../data/meals';

// Canonical department order
const DEPARTMENT_ORDER = ['MEAT', 'FISH', 'PRODUCE', 'DAIRY', 'BAKED', 'SPICES', 'FROZEN', 'OTHER'];

export default function ShoppingList() {
  const navigate = useNavigate();
  const { mealIdx } = useParams();
  const meal = MEALS.find(m => m.idx === parseInt(mealIdx));
  
  // Load checked state from localStorage
  const [checkedItems, setCheckedItems] = useState(() => {
    const saved = localStorage.getItem(`shopping_${mealIdx}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Save to localStorage whenever checked state changes
  useEffect(() => {
    localStorage.setItem(`shopping_${mealIdx}`, JSON.stringify(checkedItems));
  }, [checkedItems, mealIdx]);

  // Get shopping list from meal data
  const shoppingList = meal?.data?.shopping_list || [];

  // Group and sort ingredients by department
  const groupedIngredients = useMemo(() => {
    const groups = {};
    
    shoppingList.forEach(item => {
      const dept = item.department || 'OTHER';
      if (!groups[dept]) {
        groups[dept] = [];
      }
      groups[dept].push(item);
    });

    // Sort by canonical order
    return DEPARTMENT_ORDER
      .filter(dept => groups[dept] && groups[dept].length > 0)
      .map(dept => ({
        department: dept,
        items: groups[dept]
      }));
  }, [shoppingList]);

  // Count unchecked items
  const uncheckedCount = useMemo(() => {
    return shoppingList.filter(item => !checkedItems[item.name]).length;
  }, [shoppingList, checkedItems]);

  const toggleItem = (itemName) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const resetList = () => {
    if (window.confirm('Reset all checkmarks?')) {
      setCheckedItems({});
    }
  };

  const checkAll = () => {
    const allChecked = {};
    shoppingList.forEach(item => {
      allChecked[item.name] = true;
    });
    setCheckedItems(allChecked);
  };

  const handleDone = () => {
    if (uncheckedCount === 0) {
      navigate(`/runtime/${mealIdx}`, { state: { meal: meal.data } });
    }
  };

  if (!meal) {
    return <div>Meal not found</div>;
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: '#2a2a2a',
      color: '#ffffff',
      fontFamily: 'Verdana, sans-serif',
      overflowX: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        width: '100%',
        height: '80px',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 15px',
        borderBottom: '1px solid #444',
        zIndex: 100,
        boxSizing: 'border-box'
      }}>
        {/* Home Button */}
        <div
          onClick={() => navigate('/')}
          style={{
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img 
            src="/icons/NC_BrandTint.png" 
            alt="NowCook" 
            style={{ 
              width: '32px', 
              height: '32px',
              objectFit: 'contain'
            }} 
          />
        </div>

        {/* Title */}
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#d4af37',
          letterSpacing: '2px'
        }}>
          SHOP
        </div>

        {/* Done Button */}
        <button
          onClick={handleDone}
          disabled={uncheckedCount > 0}
          style={{
            background: uncheckedCount === 0 ? '#88aa55' : '#555',
            color: uncheckedCount === 0 ? '#ffffff' : '#888',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: uncheckedCount === 0 ? 'pointer' : 'not-allowed',
            opacity: uncheckedCount === 0 ? 1 : 0.6,
            whiteSpace: 'nowrap',
            minWidth: '70px'
          }}
        >
          DONE
        </button>
      </div>

      {/* Meal Name */}
      <div style={{
        padding: '20px',
        fontSize: '22px',
        fontWeight: '600',
        color: '#ffffff',
        borderBottom: '1px solid #444'
      }}>
        {meal.title}
      </div>

      {/* Count Badge */}
      {uncheckedCount > 0 && (
        <div style={{
          position: 'fixed',
          top: '90px',
          right: '20px',
          background: '#88aa55',
          color: '#ffffff',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: '700',
          zIndex: 99
        }}>
          {uncheckedCount}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={checkAll}
          style={{
            background: 'transparent',
            color: '#88aa55',
            border: '1px solid #88aa55',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Check All
        </button>
        <button
          onClick={resetList}
          style={{
            background: 'transparent',
            color: '#888',
            border: '1px solid #555',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Reset List
        </button>
      </div>

      {/* Shopping List */}
      <div style={{ paddingBottom: '40px' }}>
        {groupedIngredients.map(group => (
          <div key={group.department}>
            {/* Department Header */}
            <div style={{
              padding: '12px 20px',
              background: '#1a1a1a',
              fontSize: '18px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.8)',
              letterSpacing: '1px',
              borderTop: '1px solid #444',
              borderBottom: '1px solid #444'
            }}>
              {group.department}
            </div>

            {/* Items */}
            {group.items.map((item, idx) => {
              const isChecked = checkedItems[item.name];
              return (
                <div
                  key={idx}
                  onClick={() => toggleItem(item.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    background: isChecked ? '#1a1a1a' : 'transparent'
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: '50px',
                    height: '50px',
                    minWidth: '50px',
                    border: '2px solid #88aa55',
                    borderRadius: '8px',
                    marginRight: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isChecked ? '#88aa55' : 'transparent'
                  }}>
                    {isChecked && (
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                        <polyline points="20 6 9 17 4 12" stroke="#ffffff" strokeWidth="3"/>
                      </svg>
                    )}
                  </div>

                  {/* Item Details */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      fontSize: '18px',
                      color: '#d4af37',
                      textDecoration: isChecked ? 'line-through' : 'none',
                      opacity: isChecked ? 0.5 : 1
                    }}>
                      {item.name}
                    </div>
                    <div style={{
                      fontSize: '20px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      textAlign: 'right',
                      textDecoration: isChecked ? 'line-through' : 'none',
                      opacity: isChecked ? 0.5 : 1
                    }}>
                      {item.quantity} {item.unit}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
