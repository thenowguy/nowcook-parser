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

### Key Files Modified
- [public/parser-v1-original.html](public/parser-v1-original.html) - Added Gantt view, critical path integration
- [src/parser/index.js](src/parser/index.js) - Added `renumberTasksWithChainContext()`
- [src/parser/splitter.js](src/parser/splitter.js) - Updated SECTION_HEADERS regex
- [src/parser/criticalPath.js](src/parser/criticalPath.js) - **NEW** Critical path calculator
- [CLAUDE.md](CLAUDE.md) - Updated with all concepts and implementations

## Additional Resources

- **Philosophy**: `Life at the NowLine/Life at the NowLine.md` - Origin story
- **Temporal Flexibility**: `TEMPORAL_FLEXIBILITY.md` - Four task states
- **Emergent Ingredients**: `EMERGENT_INGREDIENTS.md` - Flexible prep patterns
- **Mobile Refactor**: `MOBILE_REFACTOR.md` - v2.0 architecture decisions
