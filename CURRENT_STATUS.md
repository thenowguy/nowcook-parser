# NowCook Current Status - Oct 25, 2024

## 🎯 Where We Are

### ✅ WORKING (Production-Ready)
1. **Human API Bridge Pattern** - Validated with 5 recipes, $0 cost
2. **Ontology System** - 51 verbs with attention modes, hold windows, temporal flexibility
3. **Recipe Parsing** - Sonnet can parse narrative recipes to structured JSON (100% success rate)
4. **Chain Detection** - 6-chain baking workflow, 7-chain roasting, 4-chain stir-fry all working
5. **Dependency Modeling** - Complex cross-chain dependencies (convergence points, shared resources)
6. **Alpha App Integration** - Chocolate Chip Cookies (Sonnet) now live in app

### 🚧 IN PROGRESS (Partially Implemented)
1. **Hold Windows** - Ontology complete, runtime evaluation works, but **NOT in Sonnet recipes**
2. **Emergent Ingredients** - System designed (emergent-ingredients.json exists), but **NOT being generated**
3. **Chain Visualization** - Chains exist in JSON, but **NO UI visualization** in Alpha app

### ❌ NOT IMPLEMENTED (Designed but Not Built)
1. **Hold Window UI** - "Channel extension" visualization (hold-window-prototype.html exists as proof-of-concept)
2. **Emergent Ingredient Generation** - Parser has the logic (emergentIngredients.js) but it's **DISABLED**
3. **Chain Subheadings** - JSON has chains array, but Runtime/TimelineFlow **don't display them**

---

## 📋 Detailed Status by Feature

### 1. Hold Windows

**What Exists**:
- ✅ [src/ontology/verbs.json](src/ontology/verbs.json) - 51 verbs with `hold_window_minutes` and `temporal_flexibility`
- ✅ [src/ontology/emergent-ingredients.json](src/ontology/emergent-ingredients.json) - 52 emergent ingredients with hold windows
- ✅ [src/ontology/loadEmergentIngredients.js](src/ontology/loadEmergentIngredients.js) - Lookup functions
- ✅ [src/parser/index.js](src/parser/index.js) - Code to add hold window metadata to edges (lines 237-287)
- ✅ [src/utils/runtime.js](src/utils/runtime.js) - `depsSatisfied()` respects hold windows at runtime
- ✅ [public/hold-window-prototype.html](public/hold-window-prototype.html) - Visual proof-of-concept

**What's Missing**:
- ❌ Sonnet recipes **don't have hold window metadata on edges**
- ❌ Alpha app UI **doesn't show hold windows visually**
- ❌ TimelineFlow **doesn't render "channel extensions"**

**Why Sonnet Recipes Don't Have Hold Windows**:
The Sonnet recipes use `planned_min` only - they don't have:
```json
"edges": [
  {
    "from": "chain_1/step_1",
    "to": "chain_1/step_2",
    "type": "FS",
    "constraint": "FLEXIBLE",              // ← MISSING
    "hold_window_minutes": 30,             // ← MISSING
    "temporal_flexibility": "hold_minutes" // ← MISSING
  }
]
```

**To Fix**: Run Sonnet recipes through the emergent ingredient parser (src/parser/index.js lines 237-287) to add hold window metadata.

---

### 2. Emergent Ingredients

**What Exists**:
- ✅ [src/ontology/emergent-ingredients.json](src/ontology/emergent-ingredients.json) - 52 emergent ingredients defined
- ✅ [src/ontology/loadEmergentIngredients.js](src/ontology/loadEmergentIngredients.js) - `inferEmergentKey()` function
- ✅ [src/parser/emergentIngredients.js](src/parser/emergentIngredients.js) - **DISABLED** extraction logic
- ✅ [src/parser/index.js](src/parser/index.js:237-287) - Code to match tasks to emergent ingredients

**What's Missing**:
- ❌ Sonnet recipes **don't generate emergent ingredient outputs**
- ❌ No `"outputs": [{ "ingredient": "cheddar_cheese", "state": "grated", "emergent": true }]`
- ❌ Parser doesn't auto-detect which tasks CREATE emergent ingredients
- ❌ Parser doesn't auto-add emergent ingredient INPUTS to consuming tasks

**Example of What's Missing**:

**Current Sonnet Output**:
```json
{
  "id": "chain_3/step_1",
  "name": "Fold dry ingredients into wet ingredients using a spatula",
  "canonical_verb": "fold",
  "outputs": [],  // ← Should be emergent "cookie_dough"
  "edges": [
    { "from": "chain_1/step_1", "to": "chain_3/step_1", "type": "FS" },
    { "from": "chain_2/step_4", "to": "chain_3/step_1", "type": "FS" }
  ]
}
```

**What It Should Be**:
```json
{
  "id": "chain_3/step_1",
  "name": "Fold dry ingredients into wet ingredients using a spatula",
  "canonical_verb": "fold",
  "outputs": [
    { "ingredient": "cookie_dough", "state": "mixed", "emergent": true }
  ],
  "edges": [
    {
      "from": "chain_1/step_1",
      "to": "chain_3/step_1",
      "type": "FS",
      "constraint": "FLEXIBLE",
      "hold_window_minutes": 60,
      "temporal_flexibility": "hold_hours",
      "emergent_ingredient": "mixed_dry_ingredients"
    },
    {
      "from": "chain_2/step_4",
      "to": "chain_3/step_1",
      "type": "FS",
      "constraint": "FLEXIBLE",
      "hold_window_minutes": 30,
      "temporal_flexibility": "hold_minutes",
      "emergent_ingredient": "wet_mixture"
    }
  ]
}
```

**Why It's Missing**:
Sonnet doesn't know about emergent ingredients - it's not in FOR_SONNET.md. The parser has logic to detect them, but it's currently disabled.

---

### 3. Chain Visualization

**What Exists**:
- ✅ All 5 Sonnet recipes have `"chains": [...]` array in JSON
- ✅ Chains have meaningful names ("Mix Dry Ingredients", "Prepare Vegetables", etc.)
- ✅ Each task has chain-aware ID (`chain_1/step_1`)

**What's Missing**:
- ❌ Runtime UI **doesn't show chain groupings**
- ❌ TimelineFlow **doesn't render chain dividers/headers**
- ❌ No visual indication which tasks belong to which chain

**What It Should Look Like** (in Runtime):

```
┌─────────────────────────────────────┐
│ 🔵 Chain 1: Mix Dry Ingredients     │
├─────────────────────────────────────┤
│ ✅ Whisk together flour, soda, salt │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🟢 Chain 2: Mix Wet Ingredients     │
├─────────────────────────────────────┤
│ ⏸️ Combine butter with sugars       │
│ ⏸️ Add egg and egg yolk             │
│ ⏸️ Whisk until combined             │
│ ⏸️ Mix in vanilla                   │
└─────────────────────────────────────┘
```

**Files to Modify**:
- [src/pages/Runtime.jsx](src/pages/Runtime.jsx) - Add chain headers
- [src/components/TimelineFlow.jsx](src/components/TimelineFlow.jsx) - Add swim lanes with chain labels

---

### 4. Task Dependencies

**What Exists**:
- ✅ All tasks have `edges` arrays with proper `from`, `to`, `type`
- ✅ Cross-chain dependencies working (e.g., Chain 3 requires Chains 1 & 2)
- ✅ Multi-convergence points (e.g., "combine" requires both sauce AND pasta)
- ✅ `depsSatisfied()` in runtime.js correctly evaluates edges

**What's Working**:
- FS (Finish-to-Start) edges
- SS (Start-to-Start) edges (parallel work)
- FF (Finish-to-Finish) edges (rare)

**What Could Be Better**:
- ⚠️ Hold window expiration not tested in production runtime
- ⚠️ No visual indication of WHY a task is blocked (which dependency is unsatisfied)

---

### 5. Emergent Ingredient ID Generation

**Current State**: **NOT HAPPENING**

**What Should Happen**:

When Sonnet says:
```
"name": "Fold dry ingredients into wet ingredients"
```

Parser should detect:
1. This task CONSUMES two emergent ingredients:
   - `mixed_dry_ingredients` (from Chain 1)
   - `wet_mixture` (from Chain 2)
2. This task PRODUCES one emergent ingredient:
   - `cookie_dough` (used by Chain 4)

**Auto-Generation Logic** (exists but disabled):
```javascript
// src/parser/emergentIngredients.js (CURRENTLY DISABLED)
function detectEmergentOutputs(task, allTasks) {
  // If task produces something that other tasks consume, it's emergent
  // Example: "grate cheese" → outputs "grated_cheese"
  // Then "add cheese" → inputs "grated_cheese"
}
```

**Why It's Disabled**:
The logic was brittle - too many false positives. Needs refinement or Sonnet needs to do it.

---

## 🎯 Priority Decision Tree

### Option A: **Add Emergent Ingredients to Sonnet's Workflow** (Recommended)
**Impact**: HIGH - Unlocks hold windows, temporal flexibility, better dependency modeling

**Steps**:
1. Update FOR_SONNET.md to include emergent ingredient guidelines
2. Add examples showing `outputs` array with emergent ingredients
3. Sonnet re-parses 5 recipes with emergent outputs
4. Parser adds hold window metadata to edges automatically
5. Test in Alpha app

**Effort**: Medium (2-3 hours with Sonnet)

---

### Option B: **Add Chain Visualization to Runtime UI** (User-Facing Impact)
**Impact**: MEDIUM - Better UX, clearer organization

**Steps**:
1. Modify Runtime.jsx to group tasks by chain
2. Add chain headers/dividers with colors
3. Modify TimelineFlow to show swim lanes
4. Test with Cookies recipe

**Effort**: Medium (3-4 hours)

---

### Option C: **Enable Hold Window Visualization** (Visual Feedback)
**Impact**: HIGH - Shows temporal flexibility visually

**Steps**:
1. First complete Option A (need hold window metadata)
2. Integrate hold-window-prototype.html concepts into TimelineFlow
3. Render "channel extensions" (striped bars after task completion)
4. Add color coding (green = fresh, yellow = aging, red = expiring)

**Effort**: High (4-6 hours, depends on Option A)

---

### Option D: **Test Current Recipes in Runtime** (Validation)
**Impact**: LOW - Confirms what we know (dependencies work)

**Steps**:
1. Open Alpha app (http://localhost:5173/)
2. Select Chocolate Chip Cookies (Sonnet)
3. Walk through scheduling → runtime
4. Verify tasks become available when dependencies satisfied

**Effort**: Low (30 minutes)

---

## 💡 Recommendation: **Option A + D**

**Rationale**:
1. **Test first** (Option D) - Confirm current recipes work in runtime (30 min)
2. **Add emergent ingredients** (Option A) - Unlocks hold windows, temporal flexibility (2-3 hours)
3. **Defer UI** (Options B & C) - Once data is correct, UI is straightforward

**Why This Order**:
- Emergent ingredients are **data-level** (affects all future recipes)
- Chain visualization is **UI-level** (cosmetic, can be added later)
- Hold window visualization **depends on** emergent ingredients being present

---

## 📝 To Discuss

### 1. Hold Windows - Reworking UI to Show Channels?
**Answer**: Yes, but **AFTER** emergent ingredients are in the data.

**Current blocker**: Sonnet recipes don't have `hold_window_minutes` on edges because they don't have emergent ingredient metadata.

**Path forward**:
1. Add emergent ingredients to FOR_SONNET.md
2. Sonnet re-parses with emergent outputs
3. Parser auto-adds hold window metadata
4. THEN build channel visualization UI

---

### 2. Visual Depiction of Chains - Subheads for User?
**Answer**: Yes! This is **Option B** above.

**Design sketch**:
```
Runtime View:

🔵 Mix Dry Ingredients (Chain 1)
  ✅ Whisk flour, baking soda, salt (2 min)

🟢 Mix Wet Ingredients (Chain 2)
  ✅ Combine butter with sugars (2 min)
  ⏸️ Add eggs (1 min)
  ⏸️ Whisk until combined (2 min)
  ⏸️ Mix in vanilla (1 min)

🟣 Combine Dough (Chain 3)
  ⏸️ Fold dry into wet (2 min) ← WAITING for Chain 2
```

**Effort**: ~4 hours to implement in Runtime.jsx and TimelineFlow.jsx

---

### 3. Are Task-Level Dependencies Working to Their Best?
**Answer**: Yes for **structural dependencies** (FS/SS/FF edges), No for **temporal dependencies** (hold windows not evaluated).

**What works**:
- Cross-chain convergence (✅)
- Multi-dependency tasks (✅)
- Parallel work detection (✅)

**What doesn't work**:
- Hold window expiration (⚠️ code exists but not tested with real data)
- "Why blocked?" explanations (❌ UI doesn't show which dependency is unsatisfied)

---

### 4. Are We Generating Emergent Ingredient IDs per Task, per Chain?
**Answer**: **NO** - This is the key missing piece.

**Current state**:
```json
"outputs": []  // ← Always empty in Sonnet recipes
```

**Should be**:
```json
"outputs": [
  { "ingredient": "cookie_dough", "state": "mixed", "emergent": true }
]
```

**Two paths to fix**:
1. **Sonnet generates them** (add to FOR_SONNET.md) - Recommended
2. **Parser infers them** (enable src/parser/emergentIngredients.js) - Brittle

---

### 5. Are Task Starts Looking for Emergent Ingredient IDs?
**Answer**: **SORT OF** - The code exists but has no data to work with.

**Runtime logic** (src/utils/runtime.js:depsSatisfied):
```javascript
// Checks if edges are satisfied
edges.every((e) => {
  const pred = getPred(e.from);
  if (!pred || !pred.done) return false;

  // If edge has hold window metadata, check expiration
  if (e.constraint === 'FLEXIBLE') {
    const holdWindowMs = (e.hold_window_minutes || 60) * 60 * 1000;
    return timeSinceFinish <= holdWindowMs;
  }

  return true;
});
```

**Problem**: Sonnet recipes don't have `e.hold_window_minutes` or `e.emergent_ingredient`, so this code never runs.

---

## 🎬 Recommended Next Steps

### Immediate (Today):
1. ✅ Test Chocolate Chip Cookies in Alpha app runtime (Option D - 30 min)
2. Document findings (which dependencies work, any issues)

### Next Session:
1. Update FOR_SONNET.md with emergent ingredient guidelines (1 hour)
2. Sonnet re-parses Cookies with emergent outputs (30 min)
3. Validate emergent metadata appears in JSON (15 min)
4. Test in Alpha app - verify hold windows work (30 min)

### Future Sessions:
1. Add chain visualization to Runtime UI (4 hours)
2. Add hold window "channel extension" visualization (4-6 hours)
3. Sonnet parses remaining 4 recipes with emergent ingredients
4. Scale test with 10-20 more recipes

---

**Bottom Line**: We have **excellent structural foundation** (chains, dependencies, ontology). The missing piece is **emergent ingredient generation** - once that's in place, hold windows and temporal flexibility will "just work" because the runtime code already exists.

**Question for you**: Want to test the Cookies recipe in the Alpha app now, or jump straight to adding emergent ingredients to FOR_SONNET.md?
