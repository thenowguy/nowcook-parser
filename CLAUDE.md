# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NowCook** is a React-based mobile-first cooking assistant that transforms recipe text into interactive, timeline-driven cooking interfaces. It's "Google Maps for cooking" - treating time as the primary coordinate with the **NowLine** concept: tasks exist relative to NOW, flowing through time like cars on a road.

**Two Distinct Applications**:
1. **"The Parser"** ([public/parser-v1-original.html](public/parser-v1-original.html)) - Development sandbox/playground
   - Standalone HTML page for testing recipe parsing
   - Shows parsed tasks, dependencies, chains, and timeline
   - Used for ontology refinement and dependency inference testing
   - Does NOT affect the production app

2. **"The Alpha App"** (Vite React app deployed on Vercel)
   - User-facing cooking application
   - Mobile-first multi-page interface
   - Production codebase in `src/`
   - **Version**: 2.0.0 (Mobile-first multi-page refactor)

## Development Commands

```bash
# Development (Vite often uses port 5174 as 5173 is occupied)
npm run dev -- --host --force   # --force clears module cache (important after component renames)

# Building & Preview
npm run build                    # Production build
npm run preview                  # Preview production build

# Testing & Validation
npm run validate                 # Validate meal JSON against schemas
npm run validate:ontology        # Validate ontology JSON files
npm run test:parser              # Test parser with sample recipes

# Utilities
npm run scaffold:meal            # Create new meal template
npm run lint                     # ESLint check
```

**Important**: Vite dev server sometimes needs `--force` flag after major component changes. If seeing stale components, restart with `--force` and hard refresh browser (Cmd+Shift+R or close/reopen mobile tab).

## High-Level Architecture

### Core Problem & Solution

1. **Recipe Parsing**: Unstructured text → structured task graphs with dependencies
2. **Dependency Inference**: Automatically understand which steps must happen before others (ingredients, equipment, temporal markers)
3. **Parallel Cooking**: Show what's available NOW vs. blocked/waiting
4. **Real-time Timeline**: Time-based UI that syncs with actual cooking

### Main Components

**Router Structure** ([App.jsx](src/App.jsx)):
- `/` - MealChooser: Recipe selection
- `/schedule/:mealIdx` - SchedulingModal: Pre-cooking configuration
- `/runtime/:mealIdx` - Runtime: Main cooking interface with timeline
- `/shop/:mealIdx` - ShoppingList: Ingredients view

**Critical Files**:

1. **[src/components/TimelineFlow.jsx](src/components/TimelineFlow.jsx)** - NEW vertical timeline (NOT Timeline.jsx.old)
   - `NOWLINE_X = 160px` - vertical line representing current moment
   - Tasks slide LEFT as time passes (lozengeX = NOWLINE_X - elapsedPixels)
   - "Turnstile pattern": running tasks stop at NowLine waiting for dismissal
   - iPhone 11 dimensions: TRACK_HEIGHT=115px, LOZENGE_HEIGHT=100px, PIXELS_PER_SECOND=2

2. **[src/pages/Runtime.jsx](src/pages/Runtime.jsx)** - Main cooking interface
   - Renders `<TimelineFlow />` (NOT old Timeline component)
   - Uses `useRuntime()` hook for state management
   - Hero image, timer badge, text-mode toggle (instructions/ingredients/time)

3. **[src/utils/runtime.js](src/utils/runtime.js)** - Core cooking logic
   - `useRuntime(tasks)` - Real-time task orchestration (100ms tick)
   - `depsSatisfied()` - Checks SS/FS/FF edge types
   - `consumesDriver()` - Tasks requiring active attention (requires_driver)
   - `hasTimeSensitivity()` - Tasks that spoil if done too early (boil, steam, drain)
   - `isPrepTask()` - Flexible tasks (grate, chop, dice) that can be done early

4. **[src/parser/](src/parser/)** - Recipe text parser (v2.0 local, replaces Google Sheets)
   - [index.js](src/parser/index.js): `parseRecipe(rawText, title, options)` - main orchestrator
   - [splitter.js](src/parser/splitter.js): Text tokenization into steps, filters section headers
   - [verbMatcher.js](src/parser/verbMatcher.js): 4-tier verb recognition with confidence scoring
   - [extractors.js](src/parser/extractors.js): Duration/temperature extraction
   - [dependencies.js](src/parser/dependencies.js): 6-rule dependency inference system
   - [chains.js](src/parser/chains.js): Chain detection from section headers and temporal markers
   - [emergentIngredients.js](src/parser/emergentIngredients.js): Generate emergent IDs and match to inputs (currently disabled)
   - [criticalPath.js](src/parser/criticalPath.js): **NEW** Critical path calculator for temporal feasibility
     - `calculateCriticalPath(tasks, serveTimeMs, nowMs)` - Main entry point
     - Works backward from serve time (latest finish/start times)
     - Works forward from now (earliest finish/start times)
     - Calculates slack time (latest - earliest)
     - Identifies critical path tasks (zero slack)
     - Determines meal feasibility (can it be done in time?)
     - Assigns urgency levels: must_do_now, should_start_soon, flexible, could_do_now
     - Returns enhanced tasks with timing metadata

5. **[src/ontology/](src/ontology/)** - Unified cooking knowledge base (JSON-based)
   - [verbs.json](src/ontology/verbs.json): Canonical verbs, attention modes, regex patterns, defaults
   - [ingredients.json](src/ontology/ingredients.json): Ingredient classes, traits, verb compatibility
   - [parameters.json](src/ontology/parameters.json): Heat levels, temperatures, validation rules
   - [patterns.json](src/ontology/patterns.json): Natural language patterns for parser
   - [guards.json](src/ontology/guards.json): Safety redirects (e.g., "don't boil chicken breast" → sear + simmer)

### Key Concepts

**The NowLine** (Active Temporal Gate):
- NOT a passive marker - it's an active turnstile that tasks STOP at
- Vertical line at NOWLINE_X = 160px representing current moment
- Past = left, future = right
- Ready tasks sit with left edge at NowLine
- Running tasks slide LEFT over time
- Completed tasks "stop at turnstile" when rightEdge ≤ NOWLINE_X
- **Critical**: Tasks don't auto-advance through NowLine - they require explicit user action (start/dismiss)

**Driver Mutex** (Single Cook Constraint):
- Only ONE attended task (`requires_driver: true`) can run at a time
- Simulates reality: one person cooking can only actively do one thing
- SRAS tasks (`self_running_after_start: true`) can run in parallel with attended tasks
- Multiple unattended tasks can run simultaneously

**Temporal Flexibility** (4 task states):
1. **Could do now** ⏰ - Flexible prep (!requires_driver, !timeSensitive) - can be done hours early
2. **Can do now** ✅ - Ready with dependencies satisfied, optimal timing
3. **Can't do yet** ⏸️ - Blocked by dependencies or too early
4. **Must do now** 🔥 - Time-critical, will miss deadline if not started

**Task Chains** (Logical Grouping):
- **THREE-LEVEL ARCHITECTURE**: Chains → Tasks → Emergent IDs
- Chains group related tasks (e.g., "Cook the Pasta", "Make the Sauce", "Prepare Dessert")
- Chains provide LOGICAL organization, NOT temporal constraints
- A dessert task can be "Can Do Now" even though dessert is served last
- Example: "Make chocolate mousse" (Chain 3) can start 8 hours before serving
- Chains detected from section headers ("For the pasta:", "Meanwhile, for the sauce:")
- Tasks renumbered with chain context: `chain_1/step_1`, `chain_1/step_2`, etc.
- Chain-level dependencies AND task-level dependencies both tracked

**Critical Path & Feasibility**:
- **Work backwards from serve time** through dependency graph
- Calculate earliest/latest start times for each task
- Determine if meal is FEASIBLE given current time and serve time
- Example: 4-hour recipe cannot be cooked if serve time is 2 hours away
- Future: Filter recipe catalog to show only feasible meals
- "Hidden time bombs" (like "chill 2 hours") are EXPLICIT tasks, not notes

**Task Dependencies** (edge types):
```json
"edges": [
  { "from": "t1", "to": "t2", "type": "FS" },  // Finish-to-Start (most common)
  { "from": "t1", "to": "t2", "type": "SS" },  // Start-to-Start (parallel tasks)
  { "from": "t1", "to": "t2", "type": "FF" }   // Finish-to-Finish (rare)
]
```

**Attention Modes** (from verbs.json):
- `"attended"` - Requires active driver (requires_driver: true) - sauté, stir, flip
- `"unattended_after_start"` - Self-running once started (self_running_after_start: true) - boil, simmer, bake
- `"unattended"` - Can be done independently - grate, chop, measure

**Emergent Ingredients**:
Ingredients created during cooking (e.g., "grated cheese", "minced garlic") enable flexible early prep:
```json
{
  "id": "t6",
  "canonical_verb": "grate",
  "outputs": [{ "ingredient": "cheddar_cheese", "state": "grated", "emergent": true }],
  "edges": []  // No dependencies - can do early!
}
```
Consumers of emergent ingredients MUST have FS edge to producer.

**Gantt Timeline Visualization** (IMPLEMENTED in The Parser):
- **Horizontal timeline**: NowLine (left edge, green) → Serve Time (right edge, red)
- **Swim lanes**: Each chain gets its own colored horizontal track (light blue, orange, pink, green, purple, yellow)
- **Task bars positioned temporally**: horizontal position = when task can start (`earliest_start_ms`)
- **Bar width** = task duration (visual representation of time required)
- **Bar color based on current availability**:
  - 🟢 Green = Can start NOW (at NowLine, dependencies satisfied)
  - ⚪ Gray = Too early (earliest start time is in the future)
  - 🔴 Red = Urgent/critical or past deadline
  - 🟠 Orange = Coming up soon
- **Toggle-able view**: Switch between List view and Gantt view with buttons
- **Key insight**: Tasks from "later" chains (dessert) can appear at NowLine if they need prep time
- **Freedom windows**: Gaps between bars = time available for ancillary activities
- **Critical path visible**: Tight recipes show bars packed together, red bars show bottlenecks
- **Feasibility check**: If critical path calculation shows impossible timing, bars will be red and log shows "❌ IMPOSSIBLE"
- **Serve time control**: Adjustable "Serve in X hours" input affects all bar positions and colors

### Data Flow

**Parsing Journey** (for new recipes):
```
Raw Recipe Text
  ↓ splitIntoSteps() → Step array (section headers filtered out)
  ↓ For each step:
    ├─ cleanInstructionText()
    ├─ findCanonicalVerb() → 4-tier matching + confidence
    ├─ extractDuration() → parse "15 min", round to presets
    ├─ extractTemperature() → parse "350°F"
    ├─ extractIngredients() / extractEquipment()
  ↓ Task array [{ id: "step_1", name, canonical_verb, duration_min, ... }]
  ↓ inferDependencies() → Add edge arrays (FS, SS, FF)
  ↓ detectChains() → Group tasks into logical chains
  ↓ renumberTasksWithChainContext() → Update IDs to chain_1/step_1 format
  ↓ calculateCriticalPath(tasks, serveTimeMs) → Add timing metadata
  ↓ Meal object with tasks[], chains[], timing data
  ↓ Validation against schemas/meal.schema.json
  ↓ Ready for useRuntime() or Gantt visualization
```

**Cooking Journey** (runtime):
```
1. User selects meal → Meal JSON loaded
2. Runtime instantiates useRuntime(tasks)
3. TimelineFlow renders tasks on horizontal timeline
4. User taps task → startTask(taskId) → added to running[]
5. Clock increments nowMs every 100ms
6. TimelineFlow re-renders, lozenges animate
7. Timer expires → task ready to dismiss
8. User swipes/taps done → finishTask(taskId)
9. Dependencies re-evaluated → new tasks become available
10. Timeline updates automatically
11. All tasks done → "All Done!" screen
```

## Important Conventions

**Task Object Structure**:
```json
{
  "id": "chain_1/step_1",               // Chain-aware ID (was "t1" or "step_1")
  "name": "Bring water to a boil",
  "canonical_verb": "bring_to_boil",
  "duration_min": 8,                    // OR planned_min (parser uses both)
  "requires_driver": false,             // Needs active attention?
  "self_running_after_start": true,     // Runs independently once started?
  "inputs": [/*...*/],
  "outputs": [/*...*/],
  "equipment": ["pot"],
  "edges": [{ "from": "chain_1/step_0", "to": "chain_1/step_1", "type": "FS" }],
  "timing": {                           // NEW: Added by calculateCriticalPath()
    "earliest_start_ms": 1234567890,    // Earliest possible start time
    "latest_start_ms": 1234567900,      // Latest allowable start time
    "earliest_finish_ms": 1234568370,   // When it would finish if started at earliest
    "latest_finish_ms": 1234568380,     // When it must finish by
    "slack_ms": 10000,                  // Flexibility (latest - earliest)
    "is_critical": false,               // True if on critical path (zero slack)
    "urgency": "flexible"               // must_do_now | should_start_soon | flexible | could_do_now
  }
}
```

**Naming**:
- Canonical verbs: snake_case (e.g., `bring_to_boil`, `self_running_after_start`)
- Components: PascalCase.jsx
- Utilities: camelCase.js
- Use `requires_driver` NOT `is_attended` (legacy)
- Use `duration_min` OR `planned_min` (runtime checks both via `getPlannedMinutes()`)

**Duration Representation**:
- Always in minutes in JSON
- Conversion to ms happens at runtime (`minToMs()`)
- Parser rounds approximate values to DURATION_PRESETS: [1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180]

**Confidence Scoring** (verbMatcher):
- "high": Pattern match or explicit verb pattern
- "medium": Heuristic match or redirected
- "low": Default fallback to "free_text"

## Common Workflows

### Adding a New Verb
1. Edit [src/ontology/verbs.json](src/ontology/verbs.json):
```json
{
  "canon": "blanch",
  "attention": "unattended_after_start",
  "patterns": ["\\bblanch\\b", "\\bboil.*briefly\\b"],
  "defaults": { "planned_min": 3 }
}
```
2. Run `npm run validate:ontology`
3. Test with `npm run test:parser`

### Creating a New Meal
1. Run `npm run scaffold:meal` for template
2. Add meal JSON to `src/meals/your_meal.json`
3. Import in [src/data/meals.js](src/data/meals.js):
```javascript
import MEAL_YOUR_MEAL from "../meals/your_meal.json";
export const MEALS = [
  { title: "Your Meal", author: "You", idx: N, data: MEAL_YOUR_MEAL },
  // ...
];
```
4. Run `npm run validate` to check schema

### Modifying Timeline UI
- Edit [src/components/TimelineFlow.jsx](src/components/TimelineFlow.jsx) (NOT Timeline.jsx.old)
- Mobile-first: all dimensions in logical pixels (iPhone 11 = 414px width)
- Inline styles (no CSS modules)
- Use `useMemo` for expensive computations (task maps, track layouts)

## Common Pitfalls

**❌ Don't import old Timeline component**:
```javascript
import Timeline from '../components/Timeline';  // WRONG - deprecated
```
✅ Use TimelineFlow:
```javascript
import TimelineFlow from '../components/TimelineFlow';
```

**❌ Don't assume meal.min exists**:
```javascript
const minCookTime = meal.min;  // WRONG - undefined in new meals
```
✅ Use calculateMinCookTime:
```javascript
import { calculateMinCookTime } from '../data/meals';
const minCookTime = calculateMinCookTime(meal);
```

**❌ Don't use hardcoded "blocked" state**:
Tasks are never truly "blocked" - they're "could do now" (flexible prep) or "can't do yet" (dependencies).

**❌ Don't ignore emergent ingredients**:
If a task uses "grated cheese", ensure an FS edge exists to the "grate cheese" task.

**❌ Don't cache-bust with meta tags alone**:
After major component changes, restart dev server with `--force` flag and hard refresh browser.

## Architecture Notes

**No Backend**: Frontend-only app (Vite + React). Meals are static JSON in `src/meals/` and `public/meals/`. No database, no persistence (resets on page refresh).

**State Management**: Custom `useRuntime()` hook (no Redux/Zustand). Sufficient for current complexity. Uses React hooks with 100ms tick interval.

**Validation System**: JSON Schema (2020-12) + AJV validator. Schemas in `schemas/` directory. Run `npm run validate` before commits.

**Mobile-First**: Optimized for iPhone 11 (414px logical width). Assumes 2-second pixel scale for animation smoothness. Responsive but designed mobile-first.

**Parser Limitations**: Ingredient/equipment extraction is basic keyword matching. For production, consider integrating NLP. Guards system is extensible for safety rules.

**Clock Precision**: Uses `setInterval` with 100ms granularity. Relative time display (time from now, not absolute). Sufficient for cooking (not sub-second).

## File Structure

```
src/
├── App.jsx                      # Router root (4 routes)
├── pages/                       # MealChooser, SchedulingModal, Runtime, ShoppingList
├── components/                  # TimelineFlow.jsx (NEW), Timeline.jsx.old (DEPRECATED)
├── parser/                      # index.js, splitter.js, verbMatcher.js, extractors.js, dependencies.js
├── ontology/                    # verbs.json, ingredients.json, patterns.json, guards.json, parameters.json
├── ingestion/                   # phase1.js, packs_bridge.js, ontology_bridge.js
├── data/meals.js                # Meal catalog + calculateMinCookTime()
├── utils/runtime.js             # useRuntime() hook
└── meals/*.json                 # Static meal definitions

public/meals/                    # Additional meal JSON files
schemas/                         # JSON Schema validation (meal, verbs, durations, etc.)
scripts/                         # validate.js, validate-ontology.js, test-parser.js, scaffold-meal.js
```

## Recent Implementations (Latest Session)

### Chain Detection & Grouping ✅
- Section headers ("For the pasta:", "Meanwhile, for the sauce:") now filtered from tasks
- Tasks automatically grouped into logical chains
- Chain-aware task IDs: `chain_1/step_1`, `chain_2/step_1`, etc.
- Both chain-level and task-level dependencies tracked
- Visual chain dividers in both List and Timeline views

### Critical Path Calculator ✅
- New module: `src/parser/criticalPath.js`
- Works backward from serve time (latest start/finish times)
- Works forward from now (earliest start/finish times)
- Calculates slack time for each task
- Identifies critical path (zero-slack tasks)
- Determines meal feasibility (can it be done in time?)
- Urgency levels: must_do_now, should_start_soon, flexible, could_do_now
- Integrated into The Parser with "Serve in X hours" control

### Gantt Timeline Visualization ✅
- Toggle between List and Gantt views in The Parser
- Horizontal timeline: NOW (green line) → SERVE TIME (red line)
- Swim lanes: Each chain gets colored horizontal track
- Task bars positioned by `earliest_start_ms`
- Bar width = task duration
- Bar color based on current availability:
  - 🟢 Green = Can start NOW (dependencies satisfied)
  - ⚪ Gray = Too early (blocked by time)
  - 🔴 Red = Urgent/critical/overdue
  - 🟠 Orange = Coming up soon
- Hover shows full task name and duration
- Instantly shows feasibility and "freedom windows"

### Parser UI Improvements ✅
- Recipe dropdown selector (replaces Sample 1/2 buttons) with all 5 meals from Alpha app
- Chain headers more visible: uppercase, white, 📋 icon
- Persistent layout: Top row (Input | List), Middle row (Gantt full-width), Bottom row (Timeline full-width)
- No more toggling between views - all displays visible simultaneously

### Key Files Modified
- [public/parser-v1-original.html](public/parser-v1-original.html) - Added Gantt view, critical path integration, recipe dropdown, layout improvements
- [src/parser/index.js](src/parser/index.js) - Added `renumberTasksWithChainContext()`
- [src/parser/splitter.js](src/parser/splitter.js) - Updated SECTION_HEADERS regex
- [src/parser/criticalPath.js](src/parser/criticalPath.js) - **NEW** Critical path calculator
- [src/parser/chains.js](src/parser/chains.js) - Attempted algorithmic chain detection (see below)
- [CLAUDE.md](CLAUDE.md) - Updated with all concepts and implementations

## Critical Architecture Decision: Two-Phase Hybrid Parsing Approach

### The Problem Discovered ⚠️

**Algorithmic chain detection failed for the Salmon recipe:**
- Expected: 3 logical chains ("Prepare Asparagus", "Prepare Couscous", "Prepare Salmon")
- Got: 13 chains (one per task) with meaningless names like "Preparation", "Phase 1", "Phase 2"

**Why the algorithmic approach failed:**
1. **Multiple independent root tasks**: t1 (preheat oven), t2 (trim asparagus), t5 (boil stock), t8 (season salmon)
2. **Each root started its own cluster**: BFS traversal from each root created separate dependency chains
3. **Ingredient-based merging didn't work**: Clustering algorithm required `count > 1` for primary ingredient detection, which failed for small clusters
4. **Structured JSON loses narrative context**: Flat task list without section headers or natural language connectives ("meanwhile", "at the same time", "in a separate pan")

**User insight:**
> "I'm constantly astounded by AI's ability to read a document and deduce its meaning, nuances, purpose etc. Why is it harder for Claude to read a recipe and deduce 'well, boiling the water, salting the water, boil the pasta, drain the pasta are obviously a group — a chain'?"

### Pattern Matching vs Semantic Understanding

**Pattern Matching** (current algorithmic approach):
- Word frequencies and keyword detection
- Dependency graph traversal (BFS/DFS)
- Equipment reuse tracking
- Ingredient transformation matching
- Temporal marker regex (TEMPORAL_CUES)
- **Limitation**: Cannot understand NARRATIVE PURPOSE - only sees disconnected patterns

**Semantic Understanding** (AI reading):
- Natural language comprehension of recipe narrative
- Understands PURPOSE: "this group of steps makes the sauce"
- Recognizes implied relationships: "add the sauce" → depends on making sauce
- Interprets temporal structure: "meanwhile" = parallel chain
- Infers emergent ingredients from context: "the cheese sauce" is output of chain 1
- **Advantage**: Works like a human reading a recipe

**Example: Jamie Oliver's Fish Pie (User-provided narrative)**
```
For the filling:
- Poach the fish in milk with bay leaf (15 min)
- Strain and reserve the poaching liquid
- Flake the fish, removing bones

For the sauce:
- Make a roux with butter and flour
- Add the reserved poaching liquid gradually
- Simmer until thickened (5 min)
- Stir in cream

To assemble:
- Combine flaked fish with sauce
- Transfer to baking dish
- Top with mashed potatoes
- Bake until golden (30 min)
```

**Semantic AI easily identifies**:
- **Chain 1**: "Prepare the Fish" (tasks 1-3) → produces `e_flaked_fish_001`
- **Chain 2**: "Make the Sauce" (tasks 4-7) → produces `e_cream_sauce_001`, requires `e_poaching_liquid_001`
- **Chain 3**: "Assemble and Bake" (tasks 8-11) → requires `e_flaked_fish_001` + `e_cream_sauce_001`

**Pattern matching struggles** because:
- No explicit section headers in structured JSON
- Temporal markers scattered or missing
- Dependency graph shows only task-to-task edges, not logical groupings
- Ingredient matching is too granular (sees "fish", "milk", "butter" not "the filling")

### The Solution: Two-Phase Hybrid Approach 🎯

**Phase 1: Semantic Chain Detection** (NEW - TO BE IMPLEMENTED)
- **Input**: Raw narrative recipe text (prose, not JSON)
- **Process**: AI semantic understanding reads recipe and identifies:
  1. Logical chains with meaningful names (e.g., "Make the Cheese Sauce")
  2. Chain purposes (what each chain produces/accomplishes)
  3. Emergent ingredient IDs for chain outputs (e.g., `e_cheese_sauce_001`)
  4. Chain-level dependencies (Chain 3 requires output from Chain 1 and Chain 2)
- **Output**: Chain structure with emergent IDs assigned

**Phase 2: Algorithmic Task Parsing** (EXISTING - KEEP)
- **Input**: Individual instruction lines from each chain
- **Process**: Existing parser modules handle:
  1. Verb extraction and canonicalization (`verbMatcher.js`)
  2. Duration and temperature extraction (`extractors.js`)
  3. Equipment and ingredient detection
  4. Task-level dependency inference (`dependencies.js`)
  5. Task numbering within chain context (`chain_1/step_1`, etc.)
- **Output**: Fully parsed task objects with all metadata

**Data Flow Diagram**:
```
Raw Narrative Recipe Text
  ↓
[PHASE 1: SEMANTIC AI]
  ├─ Read recipe narrative
  ├─ Identify logical chains: "Cook Pasta", "Make Sauce", "Assemble"
  ├─ Assign emergent IDs: e_boiled_pasta_001, e_cheese_sauce_002
  ├─ Infer chain dependencies: "Assemble" requires pasta + sauce
  ↓
Chain Structure with Emergent IDs
  {
    chain_1: { name: "Cook Pasta", outputs: [e_boiled_pasta_001], tasks: [...] },
    chain_2: { name: "Make Sauce", outputs: [e_cheese_sauce_002], tasks: [...] },
    chain_3: { name: "Assemble", inputs: [e_boiled_pasta_001, e_cheese_sauce_002], tasks: [...] }
  }
  ↓
[PHASE 2: ALGORITHMIC PARSING]
  For each task in each chain:
    ├─ Extract verb: "boil" → canonical_verb: "boil"
    ├─ Extract duration: "8 minutes" → duration_min: 8
    ├─ Extract equipment: "pot" → equipment: ["pot"]
    ├─ Infer task-level dependencies: FS edges within chain
  ↓
Fully Parsed Meal Object
  {
    chains: [...],
    tasks: [{ id: "chain_1/step_1", canonical_verb: "bring_to_boil", edges: [...], timing: {...} }]
  }
  ↓
Runtime / Gantt Visualization
```

**Example: Mac & Cheese (User's reference recipe)**

**Phase 1 Output (Semantic)**:
```json
{
  "chains": [
    {
      "id": "chain_1",
      "name": "Cook the Pasta",
      "purpose": "Prepare pasta for dish",
      "outputs": [{ "emergent_id": "e_cooked_pasta_001", "ingredient": "pasta", "state": "al_dente" }],
      "inputs": [],
      "tasks": ["Bring water to boil", "Salt water", "Boil pasta", "Drain pasta"]
    },
    {
      "id": "chain_2",
      "name": "Make the Cheese Sauce",
      "purpose": "Create creamy cheese sauce",
      "outputs": [{ "emergent_id": "e_cheese_sauce_002", "ingredient": "cheese_sauce", "state": "creamy" }],
      "inputs": [],
      "tasks": ["Melt butter", "Add flour", "Pour in milk", "Stir until thick", "Add cheese", "Season"]
    },
    {
      "id": "chain_3",
      "name": "Assemble and Bake",
      "purpose": "Combine and finish dish",
      "outputs": [{ "emergent_id": "e_mac_cheese_finished_003", "ingredient": "mac_and_cheese", "state": "baked" }],
      "inputs": [
        { "emergent_id": "e_cooked_pasta_001", "required": true },
        { "emergent_id": "e_cheese_sauce_002", "required": true }
      ],
      "tasks": ["Mix pasta with sauce", "Transfer to baking dish", "Top with breadcrumbs", "Bake"]
    }
  ]
}
```

**Phase 2 Output (Algorithmic - for each task)**:
```json
{
  "id": "chain_1/step_1",
  "name": "Bring water to a boil",
  "canonical_verb": "bring_to_boil",
  "duration_min": 8,
  "requires_driver": false,
  "self_running_after_start": true,
  "equipment": ["pot"],
  "edges": [],  // First task in chain
  "timing": { /* from criticalPath.js */ }
}
```

### Implementation Strategy (Next Steps)

1. **Test with narrative recipes first** - Use human-written prose (Jamie Oliver, Serious Eats) NOT structured JSON
2. **Start with Mac & Cheese** - User's request: familiar, well-understood example
3. **Semantic AI prompt for Phase 1**:
   - "Read this recipe and identify logical chains (groups of related tasks)"
   - "For each chain, determine what it produces (emergent ingredients)"
   - "Identify which chains depend on outputs from other chains"
4. **Keep existing Phase 2 parser modules** - Already working well for task-level parsing
5. **Validate against existing meals** - Compare semantic detection vs manual chain assignments

### Why This Approach Will Work

**Narrative recipes provide rich context**:
- Section headers: "For the pasta:", "Meanwhile, for the sauce:"
- Temporal connectives: "at the same time", "while that's cooking", "once the water boils"
- Implicit references: "add the sauce" (sauce must exist), "toss with pasta" (pasta must be ready)
- Purpose statements: "to finish the dish", "to make the topping"

**Semantic AI excels at**:
- Understanding implied relationships
- Recognizing hierarchical structure
- Inferring emergent ingredients from context ("the cheese sauce" = output of sauce-making chain)
- Handling ambiguity and natural language variation

**Algorithmic parsing excels at**:
- Precise verb extraction and canonicalization
- Duration and temperature parsing
- Equipment and ingredient keyword matching
- Dependency graph construction (once chains are known)
- Critical path calculation

**Best of both worlds**: Semantic understanding for high-level structure, algorithmic precision for low-level details.

### Checkpoint Note

**Git commit f0ba63f** saved before implementing this approach. Can return to this state if needed.

**Files to create/modify for Phase 1**:
- New module: `src/parser/semanticChains.js` (semantic chain detection)
- Update: `src/parser/index.js` (orchestrate two-phase approach)
- Keep: All existing Phase 2 modules (splitter, verbMatcher, extractors, dependencies)

**Next immediate task**: Implement semantic chain detection for Mac & Cheese recipe (user's choice for testing)

## Recent Developments (Oct 2024)

### Hold Windows & Temporal Flexibility

**Problem**: Recipe authors embed prep work in ingredient lists ("4 cloves garlic, smashed and divided") and traditional parsers treat all dependencies as RIGID (must execute immediately in sequence). This creates artificial time pressure.

**Solution**: Three-part system implementing the 2012 "leave time" / "channel extension" concept:

#### 1. Hold Window Ontology (verbs.json)
Every verb now includes temporal metadata:
```json
{
  "canon": "sauté",
  "hold_window_minutes": 1440,           // 24 hours
  "temporal_flexibility": "hold_hours"   // prep_any_time | hold_days | hold_hours | hold_minutes | serve_immediate
}
```

**46 verbs total** with flexibility classifications:
- **prep_any_time** (1): marinate - 30 days
- **hold_days** (15): dice, chop, grate, smash - 7 days
- **hold_hours** (16): sauté, bake, roast, simmer - 1-24 hours
- **hold_minutes** (9): whisk, stir, add - 15-30 minutes
- **serve_immediate** (9): boil, drain, plate - 0-5 minutes

#### 2. Ingredient Prep Extraction (ingredientPrep.js)
Detects hidden prep tasks in ingredient lists:
- Pattern 1 (after comma): "4 cloves garlic, smashed and divided"
- Pattern 2 (inline): "5 1/2 cups shredded sharp white Cheddar"

Creates **Chain 0: Prep Work** with extracted tasks:
- Parses complex quantities (fractions, ranges, unicode)
- Estimates duration based on quantity and ingredient type
- All prep tasks get `hold_days` flexibility (7 days)

**Mac & Cheese Example**: Found 7 hidden prep tasks totaling 13.5 minutes:
1. Grate cheese (5.5 cups) - 4.5 min
2. Dice bacon (8 slices) - 4 min
3. Smash/divide garlic - 2 min
4. Chop/peel/dice onions - 3 min

#### 3. FLEXIBLE vs RIGID Constraints (index.js)
Dependencies now have constraint metadata:
```javascript
{
  from: "chain_1/step_1",
  to: "chain_1/step_2",
  type: "FS",
  constraint: "FLEXIBLE",              // or "RIGID"
  hold_window_minutes: 1440,
  temporal_flexibility: "hold_hours"
}
```

**Within-chain dependencies**: Based on predecessor's temporal flexibility
- `serve_immediate` → RIGID edge (must execute immediately)
- All others → FLEXIBLE edge (can wait for hold window)

**Cross-chain dependencies**: Based on source task's flexibility
- Cheese sauce → Assemble: FLEXIBLE (sauce holds for hours)
- Pasta → Drain: RIGID (pasta must be used immediately)

#### 4. Hold Window Visualization (hold-window-prototype.html)
Resurrects the 2012 "channel extension" concept:
- **Solid gradient bar**: Active work time (task duration)
- **Striped extension**: Hold window (output viability)
- **Same width scale**: Both rendered at same pixels/minute (default 12px/min)

Visual example:
```
"Melt butter"   [3min ████]═════════[10min ▒▒▒▒▒ can hold 10m]
"Whisk flour"   [1min ██]════════════[30min ▒▒▒▒▒ can hold 30m]
"Simmer sauce"  [20min ████████████]═══════[60min ▒▒▒▒▒ can hold 1h]
```

Makes temporal flexibility **immediately visible** - users can see at a glance which tasks have breathing room.

**Access**: http://localhost:5174/hold-window-prototype.html

### Task Object Updates

Tasks now include:
```json
{
  "id": "chain_2/step_3",
  "canonical_verb": "simmer",
  "hold_window_minutes": 60,
  "temporal_flexibility": "hold_hours",
  "edges": [
    {
      "from": "chain_2/step_2",
      "type": "FS",
      "constraint": "FLEXIBLE",
      "hold_window_minutes": 30,
      "temporal_flexibility": "hold_minutes"
    }
  ]
}
```

### Next Steps

1. **Expand visualization** to show all chains with dependencies
2. **Backward scheduling** from serve time using FLEXIBLE/RIGID constraints
3. **"Could do now" indicators** based on hold window availability
4. **Critical path calculation** respecting temporal flexibility

## Additional Resources

- **Philosophy**: `Life at the NowLine/Life at the NowLine.md` - Origin story
- **Temporal Flexibility**: `TEMPORAL_FLEXIBILITY.md` - Four task states
- **Emergent Ingredients**: `EMERGENT_INGREDIENTS.md` - Flexible prep patterns
- **Mobile Refactor**: `MOBILE_REFACTOR.md` - v2.0 architecture decisions
- **IP Assessment**: `reference/Document 4 — IP and Legal Report (Updated Oct 2024).md`
