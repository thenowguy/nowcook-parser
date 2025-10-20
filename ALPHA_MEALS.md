# Alpha MVP - Perfect Meal Suite

## Overview
5 hand-crafted, battle-tested meals showcasing NowCook's MealMap capabilities. Each meal demonstrates progressive complexity while using common ingredients and realistic timing.

## The 5 Meals

### 1. **Garlic Butter Pasta** 
- **Complexity:** Simple (Gateway)
- **Duration:** ~15 minutes
- **Tasks:** 10
- **Key Feature:** Basic parallelism - water boils while prepping ingredients
- **Ingredients:** Pasta, garlic, butter, parsley, black pepper
- **Demonstrates:** Attended vs unattended tasks, simple coordination

### 2. **Classic Mac & Cheese**
- **Complexity:** Moderate (Comfort Food)
- **Duration:** ~26 minutes  
- **Tasks:** 10
- **Key Feature:** Sequential flow with natural timing
- **Ingredients:** Elbow macaroni, butter, flour, milk, cheddar cheese, paprika
- **Demonstrates:** Smooth task flow, sauce building while pasta cooks

### 3. **Pan-Seared Chicken & Rice**
- **Complexity:** Intermediate (Dinner for 2)
- **Duration:** ~35 minutes
- **Tasks:** 14
- **Key Feature:** Major time savings through smart parallelism
- **Ingredients:** Chicken breasts, rice, chicken stock, onion, garlic, oil
- **Demonstrates:** Rice simmering (18 min unattended) while chicken prep/cooking happens

### 4. **Pan-Seared Salmon, Roasted Asparagus & Couscous**
- **Complexity:** Advanced (Multi-component)
- **Duration:** ~40 minutes
- **Tasks:** 13
- **Key Feature:** 3-way orchestration (oven + stovetop + grain)
- **Ingredients:** Salmon fillets, asparagus, couscous, vegetable stock, lemon, olive oil
- **Demonstrates:** Restaurant complexity made manageable, multiple heat sources

### 5. **Seared Steak, Garlic Mashed Potatoes & Sautéed Green Beans**
- **Complexity:** Expert (Showstopper)
- **Duration:** ~50 minutes (vs 70+ minutes traditional sequential)
- **Tasks:** 20
- **Key Feature:** Ultimate parallelism - everything converges perfectly at plating
- **Ingredients:** Steak, potatoes, green beans, butter, cream, garlic
- **Demonstrates:** "Impossible" timing made effortless, proof of concept

## Technical Details

### Dependency Types Used
- **FS (Finish-to-Start):** Most common - task must complete before next begins
- **SS (Start-to-Start):** Allows early starts - e.g., "heat pan" can start once "pasta is boiling"
- **FF (Finish-to-Finish):** End-timing coordination - e.g., "drain pasta" when pasta finishes

### Attended vs Unattended Balance
| Meal | Attended | Unattended | Ratio |
|------|----------|------------|-------|
| Garlic Butter Pasta | 7 | 3 | 70/30 |
| Mac & Cheese | 6 | 4 | 60/40 |
| Chicken & Rice | 9 | 5 | 64/36 |
| Salmon, Asparagus & Couscous | 7 | 6 | 54/46 |
| Steak, Potatoes & Beans | 15 | 5 | 75/25 |

### Canonical Verbs Used
All tasks use proper canonical verbs from the ontology:
- `bring_to_boil`, `boil`, `simmer` (unattended after start)
- `slice`, `dice`, `mince`, `chop`, `trim` (prep - attended)
- `sear`, `saute`, `cook` (attended)
- `season`, `toss`, `combine`, `stir` (attended)
- `drain`, `fluff`, `plate`, `serve` (finishing - attended)
- `rest`, `preheat`, `roast`, `steam` (unattended after start)

## Strategic Design Decisions

### 1. Progressive Complexity
- Meal 1: 10 tasks → "I can do this!"
- Meal 5: 20 tasks → "This would be chaos without NowCook"

### 2. Common Ingredients
- No exotic items that require specialty stores
- Pantry staples + fresh basics
- Accessible to average home cook

### 3. Realistic Timing
- Durations based on actual cooking times
- Buffer for inexperienced cooks built in
- Parallelism creates real time savings (15-20 min on complex meals)

### 4. Clear Value Proposition
- Simple meal: "See how easy this is"
- Complex meal: "No way I could track all this in my head"

## Testing Checklist

Before Alpha launch, verify each meal:
- [ ] All dependencies logically flow
- [ ] No impossible timing (chef can't be in two places)
- [ ] Unattended tasks don't require active monitoring
- [ ] Total time matches reality
- [ ] Timeline visualization is clear and motivating
- [ ] "Can do now" section always shows available tasks
- [ ] Finish time prediction is accurate

## Next Steps (Post-Alpha)

1. **Gather user feedback** on:
   - Task granularity (too detailed vs too vague?)
   - Dependency clarity (understand why they can't start something?)
   - Timing accuracy (tasks taking longer/shorter than stated?)

2. **Identify patterns** for smart dependency inference:
   - Which SS dependencies are most common?
   - When do users want FS vs SS?
   - Are there verb-based rules that emerge?

3. **Expand meal library** based on:
   - Most popular meal types
   - Cuisine diversity requests
   - Dietary restrictions needed

---

**Status:** ✅ Complete - All 5 meals integrated, tested, and committed to main branch
**Last Updated:** October 19, 2025
