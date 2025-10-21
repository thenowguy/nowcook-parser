# NowCook Parser - AI Coding Agent Instructions

## Project Overview

**NowCook** is a GPS-like cooking assistant that transforms recipe text into interactive, time-aware cooking timelines. Think "Google Maps for cooking" - it handles dependencies, concurrency, and real-time task scheduling so cooks can focus on the act of cooking rather than mental project management.

**Core Philosophy**: The "NowLine" - tasks exist relative to NOW, flowing through time like cars on a road. Tasks "wait at the NowLine" until ready, then slide leftward as they execute, creating a turnstile pattern (see `Life at the NowLine/Life at the NowLine.md`).

## Architecture

### Tech Stack
- **React 19** + **Vite** + **React Router v7**
- Mobile-first, designed for **iPhone 11 (414px logical width)**
- No external state management - uses React hooks (`useRuntime`, `useState`, `useMemo`)
- JSON-based ontology (replaces legacy Google Sheets system)

### Key Directories

```
src/
├── parser/          # Recipe text → structured JSON (v2.0 local parser)
├── ontology/        # Single source of truth for verbs, ingredients, patterns, guards
├── components/      # TimelineFlow.jsx (NEW vertical timeline), Timeline.jsx.old (DEPRECATED)
├── pages/           # MealChooser → SchedulingModal → Runtime (cooking interface)
├── data/meals.js    # Meal loader + calculateMinCookTime()
├── utils/runtime.js # useRuntime hook, task state logic, dependency checking
└── meals/*.json     # Hand-crafted meal definitions with dependency edges

schemas/             # JSON Schema validation for meal structure
scripts/             # validate-ontology.js, test-parser.js, scaffold-meal.js
```

### Critical Files

1. **`src/components/TimelineFlow.jsx`** - NEW vertical timeline (turnstile pattern)
   - Uses `NOWLINE_X = 160px` (left panel width)
   - Tasks slide LEFT as time passes (lozengeX = NOWLINE_X - elapsedPixels)
   - When rightEdge ≤ NOWLINE_X, task "stops at turnstile" waiting for dismissal
   - **iPhone 11 dimensions**: TRACK_HEIGHT=115px, LOZENGE_HEIGHT=100px, PIXELS_PER_SECOND=2

2. **`src/pages/Runtime.jsx`** - Main cooking interface
   - Imports and renders `<TimelineFlow />` (line 5, 147)
   - Uses `useRuntime()` hook for task state management
   - **DO NOT** import old `Timeline.jsx` (now `.old`)

3. **`src/utils/runtime.js`** - Core cooking logic
   - `useRuntime(tasks)` - Real-time task orchestration with 100ms tick
   - `depsSatisfied()` - Checks SS (start-start), FS (finish-start), FF (finish-finish) edges
   - `getPlannedMinutes()` - Extracts duration_min OR planned_min OR defaults to 1
   - `consumesDriver()` - Tasks requiring active attention (requires_driver = true)
   - `hasTimeSensitivity()` - Tasks that spoil if done too early (boil, steam, drain, etc.)
   - `isPrepTask()` - Flexible tasks (grate, chop, dice) that can be done early

4. **`src/ontology/`** - Unified cooking knowledge base
   - **verbs.json**: Canonical verbs with attention modes, regex patterns, default durations
   - **ingredients.json**: Ingredient classes, traits, verb compatibility, typical parameters
   - **parameters.json**: Heat levels, temperatures, time ranges with validation rules
   - **patterns.json**: Natural language patterns for parser (e.g., "until fork tender")
   - **guards.json**: Safety redirects (e.g., "don't boil chicken breast" → sear + simmer)

5. **`src/parser/index.js`** - Recipe text parser (v2.0 local, replaces Google Sheets)
   - `parseRecipe(rawText, title, options)` - Main entry point
   - Uses splitter → verb matcher → extractor → dependency inference
   - Returns structured meal JSON with tasks array

## Key Concepts

### The NowLine
- Vertical line at `NOWLINE_X = 160px` representing the current moment
- Tasks are positioned relative to NOW (past = left, future = right)
- Ready tasks sit WITH LEFT EDGE at NowLine (lozengeX = NOWLINE_X)
- Running tasks slide LEFT over time (lozengeX = NOWLINE_X - elapsedPixels)
- Completed tasks "stop at turnstile" when rightEdge ≤ NOWLINE_X

### Temporal Flexibility (TEMPORAL_FLEXIBILITY.md)
Four task states relative to time:
1. **Could do now** ⏰ - Flexible prep (!requires_driver, !timeSensitive) - can do anytime
2. **Can do now** ✅ - Ready with dependencies satisfied
3. **Can't do yet** ⏸️ - Blocked by dependencies or too early
4. **Must do now** 🔥 - Time-critical, will miss serve deadline if not started

### Emergent Ingredients (EMERGENT_INGREDIENTS.md)
Ingredients created during cooking (e.g., "grated cheese", "minced garlic"):
```json
{
  "id": "t6",
  "name": "Grate cheddar cheese",
  "canonical_verb": "grate",
  "outputs": [{ "ingredient": "cheddar_cheese", "state": "grated", "emergent": true }],
  "edges": []  // No dependencies - can do early!
}
```
- **Key**: Consumers of emergent ingredients MUST have FS edge to producer
- Enables flexible early prep (grate cheese Thursday for Friday Mac & Cheese)

### Task Dependencies (edges)
```json
"edges": [
  { "from": "t1", "to": "t2", "type": "FS" }  // Finish-to-Start (most common)
  { "from": "t1", "to": "t2", "type": "SS" }  // Start-to-Start (parallel tasks)
  { "from": "t1", "to": "t2", "type": "FF" }  // Finish-to-Finish (rare)
]
```
- Checked by `depsSatisfied(task, getPred)` in runtime.js
- SS allows concurrent execution (e.g., boil pasta WHILE making sauce)

### Attention Modes (verbs.json)
- **"attended"** - Requires active driver (requires_driver: true) - sauté, stir, flip
- **"unattended_after_start"** - Self-running once started (self_running_after_start: true) - boil, simmer, bake
- **"unattended"** - Can be done independently (grate, chop, measure)

## Common Workflows

### Development
```bash
npm run dev -- --host --force    # Start Vite dev server (--force clears module cache)
                                 # Usually runs on port 5174 (5173 often occupied)
```

### Validation & Testing
```bash
npm run validate:ontology        # Validate all ontology JSON files
npm run test:parser              # Test parser with sample recipes
npm run validate                 # Validate meal JSON against schema
npm run scaffold:meal            # Create new meal template
```

### Adding a New Verb
1. Edit `src/ontology/verbs.json`:
```json
{
  "canon": "blanch",
  "attention": "unattended_after_start",
  "patterns": ["\\bblanch\\b", "\\bboil.*briefly\\b"],
  "defaults": { "planned_min": 3 }
}
```
2. Run `npm run validate:ontology` to check
3. Test with `npm run test:parser`

### Creating a New Meal
1. Run `npm run scaffold:meal` for template
2. Add meal JSON to `src/meals/your_meal.json`
3. Import in `src/data/meals.js`:
```javascript
import MEAL_YOUR_MEAL from "../meals/your_meal.json";
export const MEALS = [
  { title: "Your Meal", author: "You", idx: N, data: MEAL_YOUR_MEAL },
  // ...
];
```

## Coding Conventions

### Task Object Structure
```json
{
  "id": "t1",                          // Unique within meal
  "name": "Bring water to a boil",     // User-facing instruction
  "canonical_verb": "bring_to_boil",   // From verbs.json
  "duration_min": 8,                   // OR planned_min (parser uses both)
  "requires_driver": false,            // Needs active attention?
  "self_running_after_start": true,    // Runs independently once started?
  "inputs": [/*...*/],                 // Ingredient dependencies
  "outputs": [/*...*/],                // Emergent ingredients
  "equipment": ["pot"],                // Optional
  "edges": [                           // Dependency edges
    { "from": "t0", "to": "t1", "type": "FS" }
  ]
}
```

### Component Patterns
- **Mobile-first**: All dimensions in logical pixels (iPhone 11 = 414px width)
- **Inline styles**: No CSS modules, use inline style objects
- **useMemo** for expensive computations (task maps, track layouts)
- **No TypeScript**: Plain JavaScript with JSDoc comments where helpful

### Naming
- Use `canonical_verb` for verb identifiers (snake_case)
- Use `requires_driver` NOT `is_attended` (legacy name)
- Use `duration_min` OR `planned_min` (parser uses both, runtime checks both)
- Component files: PascalCase.jsx, utilities: camelCase.js

## Common Pitfalls

### ❌ Don't import old Timeline component
```javascript
import Timeline from '../components/Timeline';  // WRONG - deprecated
```
✅ Use TimelineFlow instead:
```javascript
import TimelineFlow from '../components/TimelineFlow';
```

### ❌ Don't assume meal.min exists
```javascript
const minCookTime = meal.min;  // WRONG - undefined in new meals
```
✅ Use calculateMinCookTime:
```javascript
import { calculateMinCookTime } from '../data/meals';
const minCookTime = calculateMinCookTime(meal);
```

### ❌ Don't use hardcoded "blocked" state
Tasks are never truly "blocked" - they're "could do now" (flexible prep) or "can't do yet" (dependencies).

### ❌ Don't ignore emergent ingredients
If a task uses "grated cheese", ensure an FS edge exists to the "grate cheese" task.

### ❌ Don't cache-bust with meta tags alone
Vite dev server sometimes needs `--force` flag to clear module cache, especially after renaming components.

## Browser Caching Issues

**Known Issue**: Vite HMR can fail to update modules after major component changes (like renaming Timeline → TimelineFlow). Browsers may cache old JavaScript modules.

**Solutions**:
1. Restart dev server with `--force`: `npm run dev -- --host --force`
2. Hard refresh browser: Cmd+Shift+R (desktop) or close/reopen tab (mobile)
3. Clear Vite cache: `rm -rf dist node_modules/.vite`
4. Rename old components to `.old` to force cache invalidation
5. Check browser Network tab to verify new modules are being requested

## Resources

- **Philosophy**: `Life at the NowLine/Life at the NowLine.md` - Origin story and NowLine concept
- **Temporal Flexibility**: `TEMPORAL_FLEXIBILITY.md` - Four task states
- **Emergent Ingredients**: `EMERGENT_INGREDIENTS.md` - Flexible prep patterns
- **Ontology Guide**: `src/ontology/README.md` - Editing verbs, ingredients, guards
- **Mobile Refactor**: `MOBILE_REFACTOR.md` - v2.0 architecture decisions
- **Alpha Meals**: `ALPHA_MEALS.md` - Meal testing documentation

## Version Notes

- **v2.0.0** (Oct 2025): Mobile-first multi-page refactor, local parser, unified ontology
- **v1.x**: Legacy dual system (Google Sheets + Apps Script parser)
- Current dev on **main** branch, iPhone 11 target device
