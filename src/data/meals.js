import MEAL_GARLIC_PASTA from "../meals/garlic_butter_pasta.json";
import MEAL_MAC_CHEESE from "../meals/mac_and_cheese.json";
import MEAL_CHICKEN_RICE from "../meals/chicken_and_rice.json";
import MEAL_SALMON from "../meals/salmon_asparagus_couscous.json";
import MEAL_STEAK from "../meals/steak_potatoes_beans.json";
import MEAL_STEAK_SONNET from "../meals/sonnet-steak-dinner.json";
import MEAL_BOLOGNESE_SONNET from "../meals/sonnet-bolognese-v2.json";
import MEAL_STIR_FRY_SONNET from "../meals/sonnet-chicken-stir-fry-v2.json";
import MEAL_SALMON_SONNET from "../meals/sonnet-sheet-pan-salmon-v2.json";
import MEAL_COOKIES_SONNET_V2 from "../meals/sonnet-chocolate-chip-cookies-v2.json";
import MEAL_COOKIES_SONNET from "../meals/chocolate_chip_cookies_sonnet.json";

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
  {
    title: "Chocolate Chip Cookies (Sonnet)",
    author: "Love and Lemons",
    idx: 5,
    data: MEAL_COOKIES_SONNET
  },
  {
    title: "Seared Steak with Garlic Mashed Potatoes & Green Beans (Sonnet)",
    author: "NowCook",
    idx: 6,
    data: MEAL_STEAK_SONNET
  },
  {
    title: "Spaghetti Bolognese (Sonnet v2)",
    author: "RecipeTin Eats",
    idx: 7,
    data: MEAL_BOLOGNESE_SONNET
  },
  {
    title: "Chicken & Veg Stir-Fry (Sonnet v2)",
    author: "Jamie Oliver",
    idx: 8,
    data: MEAL_STIR_FRY_SONNET
  },
  {
    title: "Sheet Pan Salmon with Vegetables (Sonnet v2)",
    author: "The Mediterranean Dish",
    idx: 9,
    data: MEAL_SALMON_SONNET
  },
  {
    title: "Chocolate Chip Cookies (Sonnet v2)",
    author: "Love and Lemons",
    idx: 10,
    data: MEAL_COOKIES_SONNET_V2
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
