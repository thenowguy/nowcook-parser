import MEAL_GARLIC_PASTA from "../meals/garlic_butter_pasta.json";
import MEAL_MAC_CHEESE from "../meals/mac_and_cheese.json";
import MEAL_CHICKEN_RICE from "../meals/chicken_and_rice.json";
import MEAL_SALMON from "../meals/salmon_asparagus_couscous.json";
import MEAL_STEAK from "../meals/steak_potatoes_beans.json";

export const MEALS = [
  { 
    title: "Garlic Butter Pasta", 
    author: "Trev Harmon", 
    idx: 0,
    data: MEAL_GARLIC_PASTA 
  },
  { 
    title: "Mac & Cheese", 
    author: "Trev Harmon", 
    idx: 1,
    data: MEAL_MAC_CHEESE 
  },
  { 
    title: "Chicken & Rice", 
    author: "Trev Harmon", 
    idx: 2,
    data: MEAL_CHICKEN_RICE 
  },
  { 
    title: "Salmon, Asparagus & Couscous", 
    author: "Trev Harmon", 
    idx: 3,
    data: MEAL_SALMON 
  },
  { 
    title: "Steak, Potatoes & Green Beans", 
    author: "Trev Harmon", 
    idx: 4,
    data: MEAL_STEAK 
  },
];

export function getMeal(idx) {
  return MEALS[idx] || null;
}

export function calculateMinCookTime(meal) {
  if (!meal || !meal.data || !meal.data.tasks) return 0;
  
  // Simple calculation: sum of all task durations on critical path
  // For now, just return the meal's min_time if available
  if (meal.data.min_time) return meal.data.min_time;
  
  // Fallback: sum all task durations
  const tasks = meal.data.tasks || [];
  return tasks.reduce((sum, t) => sum + (t.duration_min || 0), 0);
}
