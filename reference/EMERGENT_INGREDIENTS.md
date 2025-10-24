# Emergent Ingredients - Core NowCook Concept

## The Problem

Traditional recipes hide transformation work in the ingredients list:

```
Ingredients:
- 2 cups sharp cheddar cheese, finely grated
- 2 cloves garlic, minced  
- 1 onion, diced

Instructions:
1. Stir in the grated cheese
2. Add the minced garlic
3. Add the diced onion
```

**Where does the grating, mincing, and dicing happen?** It's invisible to the timeline!

## The NowCook Solution

### Principle: **Separate Ingredients from Transformations**

**Ingredients List (Pure Base States Only):**
```json
{
  "ingredients": [
    { "item": "sharp cheddar cheese", "amount": "2 cups", "state": "raw" },
    { "item": "garlic", "amount": "2 cloves", "state": "raw" },
    { "item": "onion", "amount": "1 medium", "state": "raw" }
  ]
}
```

**Tasks (Include All Transformations):**
```json
{
  "tasks": [
    {
      "id": "t1",
      "name": "Grate cheddar cheese",
      "canonical_verb": "grate",
      "duration_min": 3,
      "inputs": [{ "ingredient": "cheddar_cheese", "state": "raw" }],
      "outputs": [{ "ingredient": "cheddar_cheese", "state": "grated", "emergent": true }]
    },
    {
      "id": "t2",
      "name": "Mince garlic",
      "canonical_verb": "mince",
      "duration_min": 2,
      "inputs": [{ "ingredient": "garlic", "state": "raw" }],
      "outputs": [{ "ingredient": "garlic", "state": "minced", "emergent": true }]
    },
    {
      "id": "t3",
      "name": "Dice onion",
      "canonical_verb": "dice",
      "duration_min": 3,
      "inputs": [{ "ingredient": "onion", "state": "raw" }],
      "outputs": [{ "ingredient": "onion", "state": "diced", "emergent": true }]
    },
    {
      "id": "t10",
      "name": "Stir in grated cheese",
      "canonical_verb": "stir",
      "inputs": [{ "ingredient": "cheddar_cheese", "state": "grated", "emergent": true }],
      "edges": [
        { "from": "t1", "to": "t10", "type": "FS" }
      ]
    }
  ]
}
```

## Why This Is Critical

### Without Emergent Ingredients:
- ❌ Hidden prep work = invisible time
- ❌ Can't create dependencies (can't use grated cheese before it's grated!)
- ❌ Can't parallelize prep work
- ❌ Total time estimates are wrong
- ❌ Timeline doesn't show all work

### With Emergent Ingredients:
- ✅ **All work visible** on timeline
- ✅ **Dependencies track ingredient flow** (raw → transformed → consumed)
- ✅ **Parallelism opportunities** (grate while sauce simmers!)
- ✅ **Accurate time estimates** (includes all prep)
- ✅ **Validation possible** (can't use minced garlic before mincing task completes)

## Transformation Verbs

Verbs that create emergent ingredients:

| Verb | Input Example | Output Example |
|------|---------------|----------------|
| `grate` | raw cheese | grated cheese |
| `mince` | raw garlic | minced garlic |
| `dice` | raw onion | diced onion |
| `chop` | raw vegetables | chopped vegetables |
| `cube` | raw chicken | cubed chicken |
| `slice` | raw tomatoes | sliced tomatoes |
| `peel` | raw potatoes | peeled potatoes |
| `julienne` | raw carrots | julienned carrots |
| `puree` | cooked tomatoes | tomato puree |
| `marinate` | raw chicken | marinated chicken |

## Parser Rules

### 1. Detect Hybrid Ingredients
**Pattern:** `"[amount] [ingredient], [transformation]"`

**Examples:**
- "2 cups cheddar cheese, finely grated"
- "3 cloves garlic, minced"  
- "1 onion, diced"
- "2 lbs chicken breast, cut into cubes"

### 2. Split Into Components

**Input:** `"2 cups cheddar cheese, finely grated"`

**Create:**
1. **Base Ingredient:**
   ```json
   { "item": "cheddar cheese", "amount": "2 cups", "state": "raw" }
   ```

2. **Transformation Task:**
   ```json
   {
     "name": "Grate cheddar cheese",
     "canonical_verb": "grate",
     "duration_min": 3,
     "inputs": [{ "ingredient": "cheddar_cheese", "state": "raw" }],
     "outputs": [{ "ingredient": "cheddar_cheese", "state": "grated", "emergent": true }]
   }
   ```

3. **Update References:**
   Any task mentioning "grated cheese" must have FS dependency on grating task

### 3. Validate Ingredient Flow

```javascript
function validateEmergentIngredients(meal) {
  for (const task of meal.tasks) {
    for (const input of task.inputs || []) {
      if (input.emergent) {
        // Find the task that produces this emergent ingredient
        const producer = meal.tasks.find(t => 
          t.outputs?.some(o => 
            o.ingredient === input.ingredient && 
            o.state === input.state
          )
        );
        
        // Ensure consumer depends on producer
        const hasDependency = task.edges?.some(e => e.from === producer.id);
        if (!hasDependency) {
          throw new Error(`Task "${task.name}" uses emergent "${input.state} ${input.ingredient}" but doesn't depend on producer task "${producer.name}"`);
        }
      }
    }
  }
}
```

## The 1-Minute Minimum Rule

**"NOTHING IN COOKING TAKES NO TIME"**

Every task duration includes the **full kitchen reality:**

**"Grate the cheese" = 3 minutes:**
1. "How much cheese?" → Check recipe (15 sec)
2. Walk to fridge → Find cheese (30 sec)
3. Walk to drawer → Get grater (20 sec)
4. Walk to counter → Get board (15 sec)
5. **Actually grate** ← (90 sec)
6. Transfer to bowl (20 sec)
7. Set aside grater for cleaning (10 sec)

**Absolute minimum for any task: 1 minute**  
(Even "add salt" includes: find salt, walk to pot, add, walk back)

## Mac & Cheese Example

### Before (Broken):
```json
{
  "tasks": [
    ...
    {
      "id": "t7",
      "name": "Stir in shredded cheddar cheese",
      "duration_min": 2
    }
  ]
}
```
**Problem:** When did the cheese get grated? Invisible work!

### After (Correct):
```json
{
  "ingredients": [
    { "item": "sharp cheddar cheese", "amount": "2 cups", "state": "raw" }
  ],
  "tasks": [
    {
      "id": "t6",
      "name": "Grate cheddar cheese",
      "canonical_verb": "grate",
      "duration_min": 3,
      "inputs": [{ "ingredient": "cheddar_cheese", "state": "raw" }],
      "outputs": [{ "ingredient": "cheddar_cheese", "state": "grated", "emergent": true }],
      "edges": [
        { "from": "t2", "to": "t6", "type": "SS", "note": "Can grate while pasta boils" }
      ]
    },
    {
      "id": "t8",
      "name": "Stir in grated cheese",
      "canonical_verb": "stir",
      "duration_min": 2,
      "inputs": [{ "ingredient": "cheddar_cheese", "state": "grated", "emergent": true }],
      "edges": [
        { "from": "t6", "to": "t8", "type": "FS", "note": "Must have grated cheese" },
        { "from": "t7", "to": "t8", "type": "FS", "note": "Sauce must be ready" }
      ]
    }
  ]
}
```

**Result:**
- Grating is visible (3 min on timeline)
- Can happen during pasta boiling (parallelism!)
- Dependencies ensure cheese is grated before stirring in
- Total time is accurate

## Implementation Checklist

- [ ] Parser detects hybrid ingredient patterns
- [ ] Parser splits into base ingredient + transformation task
- [ ] Parser generates emergent ingredient name
- [ ] Parser creates FS dependencies for consumers
- [ ] Validator checks emergent ingredient flow
- [ ] Ontology includes all transformation verbs
- [ ] Duration estimates include full kitchen reality
- [ ] UI shows emergent ingredients distinctly
- [ ] Timeline displays all transformation tasks

## Success Criteria

**A meal is correctly modeled when:**
1. ✅ Ingredients list contains only base/raw states
2. ✅ Every transformation is an explicit task with duration
3. ✅ All emergent ingredients are produced before consumed
4. ✅ Dependencies track ingredient flow accurately
5. ✅ Timeline shows all work (no invisible prep)
6. ✅ Total time matches kitchen reality

---

**Bottom Line:** Without emergent ingredients properly modeled, there is no NowCook.

Every transformation must be visible, timed, and tracked. This is what enables:
- Accurate time estimates
- Smart parallelization  
- Dependency validation
- Timeline visualization
- Real-world usability

**Status:** ✅ Implemented in Mac & Cheese v2.0  
**Next:** Apply to remaining 4 Alpha meals  
**Last Updated:** October 19, 2025
