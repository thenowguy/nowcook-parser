# Parsing Request: Seared Steak with Garlic Mashed Potatoes & Green Beans

## Context
This is a **RE-PARSE** of an existing recipe that has semantic dependency issues. The old version had tasks appearing as "Can Do Now" when they shouldn't be (e.g., "Take steak out to reach room temperature" showed as available before the steak was even cooked).

## Recipe Text (Original)

```
Peel and cube potatoes
Boil potatoes in salted water until tender
Trim green beans
Bring pot of salted water to a boil for beans
Blanch green beans until bright green
Shock beans in ice water
Take steak out to reach room temperature
Season steak generously with salt and pepper
Mince garlic for potatoes
Mince garlic for beans
Drain potatoes
Mash potatoes with butter, cream, and garlic
Heat cast iron skillet until smoking
Sear steak until crusty crust forms
Flip and cook to desired doneness
Rest steak
Heat butter in sauté pan
Sauté green beans with garlic
Slice steak against the grain
Plate steak, mashed potatoes, and green beans
```

## Key Semantic Issues to Fix

### 1. "Take steak out to reach room temperature"
**Problem**: This sounds like removing COOKED steak, but it actually means tempering RAW steak before cooking.

**Better phrasing**: "Let steak come to room temperature (temper)" or "Remove steak from refrigerator to temper"

**Correct dependencies**:
- No dependencies (this is PREP work, can happen at the start)
- But it MUST complete before "Season steak" (which must complete before "Sear steak")

### 2. Missing Chain Context
The recipe has 3 clear parallel workflows:
- **Chain 1: Potatoes** (peel, boil, mince garlic, drain, mash)
- **Chain 2: Green Beans** (trim, boil water, blanch, shock, mince garlic, sauté)
- **Chain 3: Steak** (temper, season, heat pan, sear, flip, rest, slice)
- **Chain 4: Plate** (final assembly requiring all 3 components)

### 3. Missing Emergent Ingredients
The recipe creates several emergent ingredients:
- `tempered_steak` (from "Let steak temper")
- `seasoned_steak` (from "Season steak")
- `blanched_beans` (from "Blanch beans")
- `shocked_beans` (from "Shock beans in ice water")
- `mashed_potatoes` (from "Mash potatoes")
- `seared_steak` (from "Sear steak" + "Flip and cook")
- `rested_steak` (from "Rest steak")

## Special Instructions

### Tempering Steak (Critical Fix)
```json
{
  "id": "chain_3/step_1",
  "name": "Remove steak from refrigerator and let come to room temperature (temper)",
  "canonical_verb": "rest",
  "planned_min": 20,
  "requires_driver": false,
  "self_running_after_start": false,
  "inputs": ["steak"],
  "outputs": [
    { "ingredient": "steak", "state": "tempered", "emergent": true }
  ],
  "equipment": [],
  "edges": []  // No dependencies - this is prep work done at start
}
```

### Resting Steak (After Cooking)
```json
{
  "id": "chain_3/step_6",
  "name": "Transfer steak to cutting board and let rest",
  "canonical_verb": "rest_meat",
  "planned_min": 10,
  "requires_driver": false,
  "self_running_after_start": true,
  "inputs": [],
  "outputs": [
    { "ingredient": "steak", "state": "rested", "emergent": true }
  ],
  "equipment": ["cutting_board"],
  "edges": [
    { "from": "chain_3/step_5", "to": "chain_3/step_6", "type": "FS" }
  ]
}
```

### Two Different "Mince garlic" Tasks
There are TWO garlic mincing tasks - one for potatoes, one for beans. These should be separate tasks in different chains:

**Chain 1** (Potatoes):
```json
{
  "id": "chain_1/step_3",
  "name": "Mince garlic for potatoes",
  "canonical_verb": "mince",
  "planned_min": 2,
  "outputs": [
    { "ingredient": "garlic", "state": "minced", "emergent": true }
  ]
}
```

**Chain 2** (Beans):
```json
{
  "id": "chain_2/step_5",
  "name": "Mince garlic for beans",
  "canonical_verb": "mince",
  "planned_min": 1,
  "outputs": [
    { "ingredient": "garlic", "state": "minced", "emergent": true }
  ]
}
```

**Note**: These are SEPARATE emergent ingredients - they can't share the same emergent ID because they're used at different times in different chains.

### Parallel Timing Opportunities
- Chain 1 (Potatoes): ~24 min total (5 peel + 15 boil + 2 mince + 2 drain/mash)
- Chain 2 (Beans): ~17 min total (4 trim + 8 boil water + 3 blanch + 1 shock + 1 mince)
- Chain 3 (Steak): ~33 min total (20 temper + 1 season + 3 heat pan + 5 sear + 2 flip + 10 rest)

**Optimal strategy**:
1. Start steak tempering immediately (20 min unattended)
2. While tempering: prepare potatoes and beans in parallel
3. Once steak is tempered: cook steak while potatoes/beans are finishing
4. Everything converges at plating

## Expected Chains

**Chain 1: Prepare Garlic Mashed Potatoes**
1. Peel and cube potatoes
2. Boil potatoes in salted water until tender
3. Mince garlic for mashed potatoes
4. Drain potatoes
5. Mash potatoes with butter, cream, and minced garlic

**Chain 2: Prepare Sautéed Green Beans**
1. Trim green beans
2. Bring pot of salted water to a boil
3. Blanch green beans until bright green
4. Shock beans in ice water to stop cooking
5. Mince garlic for green beans
6. Heat butter in sauté pan
7. Sauté beans with minced garlic

**Chain 3: Prepare Seared Steak**
1. Remove steak from refrigerator and let temper to room temperature
2. Season steak generously with salt and pepper
3. Heat cast iron skillet until smoking hot
4. Sear steak until crusty crust forms
5. Flip steak and cook to desired doneness
6. Transfer steak to cutting board and let rest
7. Slice steak against the grain

**Chain 4: Plate and Serve**
1. Arrange sliced steak, mashed potatoes, and sautéed beans on plates

## Cross-Chain Dependencies

**Chain 1 → Chain 4**: Mashed potatoes must be ready
**Chain 2 → Chain 4**: Sautéed beans must be ready
**Chain 3 → Chain 4**: Sliced steak must be ready

All three chains must complete before plating can begin.

## Validation Checklist

Before submitting your parsed JSON, verify:

✅ "Temper steak" task has NO dependencies (can start immediately)
✅ "Temper steak" has `outputs` with emergent `tempered_steak`
✅ "Season steak" depends on "Temper steak" (uses tempered_steak)
✅ "Rest steak" uses `rest_meat` canonical verb (not `rest`)
✅ "Rest steak" task comes AFTER cooking, not before
✅ Two separate "Mince garlic" tasks (one in Chain 1, one in Chain 2)
✅ Each garlic task produces separate emergent ingredient
✅ Chain 4 (Plate) requires ALL three chains to complete
✅ All emergent ingredients have `"emergent": true` flag
✅ All cross-chain edges are present

## Output Format

Please provide complete JSON following the standard format from FOR_SONNET.md, with special attention to:
1. Clear task names that indicate WHEN things happen (e.g., "Temper steak" not "Take steak out")
2. Complete `outputs` arrays for tasks that produce emergent ingredients
3. Correct dependencies showing the true cooking workflow
4. Four distinct chains with meaningful names

---

**Ready for you to parse!** This will replace the buggy old steak recipe with a properly structured one.
