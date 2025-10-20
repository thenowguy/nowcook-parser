# Universal Prior #3: Temporal Flexibility

## The Problem

Traditional cooking timers and recipe apps treat all tasks as rigid: "do this now, then do that." But kitchen reality is more flexible:

- **Thursday 4:26pm**: You could grate cheese for tomorrow's Mac & Cheese
- **Friday morning**: You could prep vegetables for dinner
- **Friday 7:00pm**: You must start water boiling to serve by 7:30pm

Current NowCook implementation showed "Grate cheese" as "Blocked" when it should be available immediately. The app was corralling users to cook on its schedule, not theirs.

## The Solution: Four Task States

Every task exists in one of four states relative to the NowLine and your desired serve time:

### 1. **Could do now** ⏰
**Flexible prep tasks with no time urgency**

These can be done **anytime**: the night before, this morning, right now, or later during cooking. They sit at the NowLine waiting for you to choose when to execute.

**Examples:**
- "Grate cheddar cheese" - can prep Thursday for Friday dinner
- "Mince garlic" - could do now or while water boils
- "Cube chicken" - prep whenever convenient
- "Trim asparagus" - any time before cooking

**Characteristics:**
- Unattended (doesn't require driver)
- No time sensitivity (won't spoil if done early)
- Dependencies satisfied (if any)
- User decides when to execute

**Implementation:**
```javascript
// Could do now: unattended prep with no time urgency
if (!t.requires_driver && !hasTimeSensitivity(t)) {
  couldDoNow.push(t);
}
```

### 2. **Can do now** ✅
**Ready to execute when driver becomes available**

Dependencies are met, but these tasks follow the normal flow. Not time-critical, but follow dependency chain.

**Examples:**
- "Bring water to a boil" - ready when you are
- "Heat skillet over medium-high" - can start anytime
- "Measure flour" - ready to do
- "Preheat oven" - available now

**Characteristics:**
- May require driver
- Dependencies satisfied
- Ready to execute immediately
- Follows normal cooking flow

**Implementation:**
```javascript
// Can do now: ready when driver available
if (t.requires_driver && driverBusy) {
  cantDoYet.push(t);
} else {
  canDoNow.push(t);
}
```

### 3. **Can't do yet** ⏸️
**Waiting on dependencies or too early**

These are blocked by unfinished predecessors or would spoil if done too early.

**Examples:**
- "Drain pasta" - water not boiling yet
- "Add pasta to boiling water" - waiting on boil
- "Stir in grated cheese" - cheese not grated yet, sauce not ready
- "Steam broccoli" - too early, would get cold before serving

**Characteristics:**
- Dependencies not yet satisfied
- OR driver is busy (for attended tasks)
- OR too early (would spoil/cool)
- Cannot be executed yet

**Implementation:**
```javascript
// Can't do yet: dependencies not satisfied
if (!depsOK) { 
  cantDoYet.push(t); 
}
```

### 4. **Must do now** 🔥
**Critical path - time-sensitive actions**

These must be done immediately or within a tight window, or the meal will fail.

**Examples:**
- "Remove from oven" - will burn if delayed
- "Flip steak" - needs flipping now
- "Plate and serve" - food is ready, serve immediately
- "Steam broccoli" - must do close to serve time or gets cold

**Characteristics:**
- Time-sensitive verbs (steam, plate, serve, remove, flip)
- Critical to meal success
- Must execute in tight window
- No flexibility in timing

**Implementation:**
```javascript
function hasTimeSensitivity(task) {
  const timeSensitiveVerbs = ['steam', 'plate', 'serve', 'remove', 'flip', 'stir'];
  const verb = (task.canonical_verb || '').toLowerCase();
  return timeSensitiveVerbs.includes(verb);
}
```

## Kitchen Reality Example: Mac & Cheese

### Scenario
**Thursday 4:26pm**: User wants to serve Mac & Cheese **Friday 7:30pm**

**Traditional app behavior:**
- User opens app
- Must wait until ~7:00pm Friday to start
- App dictates: "eat at 7:28pm sharp"
- No flexibility, no choices

**NowCook behavior with temporal flexibility:**

**Thursday 4:26pm:**
```
Could do now:
  ⏰ Grate cheddar cheese (3 min, unattended)
  ⏰ Measure milk (1 min, unattended)

Can do now:
  ✅ Bring large pot of salted water to a boil (10 min, unattended)

Can't do yet:
  ⏸️ Add pasta to boiling water
  ⏸️ Drain pasta
  ⏸️ Make cheese sauce
  ... (all downstream tasks)
```

**User choice: Grate cheese now?**
- ✅ Yes → Completes prep early, less work tomorrow
- ⏹️ No → Leave it for tomorrow, more flexibility

**Friday 7:05pm (25 minutes before serve):**
```
Could do now:
  ⏰ Grate cheddar cheese (3 min) [if not done Thursday]

Can do now:
  ✅ Bring large pot of salted water to a boil (10 min)
  ✅ Make cheese sauce (5 min)

You'll be serving at: 7:30pm ✓
```

## The GPS Metaphor

Just like GPS navigation:
- **"You could leave by 6:15pm"** → You have flexibility, leave anytime before 6:45pm
- **"You must leave by 6:45pm"** → Critical path, no more buffer time
- **"Leave now"** → Must execute immediately to hit destination

NowCook provides the same guidance:
- **"Could do now"** → Flexible prep, do anytime
- **"Can do now"** → Ready when you are
- **"Must do now"** → Critical path, execute immediately

## Implementation Details

### Task Classification Logic

```javascript
for (const t of tasks) {
  if (doneIds.has(t.id) || runningIds.has(t.id)) continue;
  
  const depsOK = depsSatisfied(t, ...);
  
  // Can't do yet: dependencies not satisfied
  if (!depsOK) { 
    cantDoYet.push(t); 
    continue; 
  }
  
  // Dependencies satisfied - classify by temporal flexibility
  
  // Could do now: unattended prep with no time urgency
  if (!t.requires_driver && !hasTimeSensitivity(t)) {
    couldDoNow.push(t);
    continue;
  }
  
  // Can do now: ready when driver available
  if (t.requires_driver && driverBusy) {
    cantDoYet.push(t);
  } else {
    canDoNow.push(t);
  }
}
```

### Time-Sensitive Verb Detection

```javascript
function hasTimeSensitivity(task) {
  // Tasks that must be done close to serve time
  const timeSensitiveVerbs = [
    'steam',   // vegetables get cold
    'plate',   // food is ready now
    'serve',   // immediate action
    'remove',  // will burn/overcook
    'flip',    // timing critical
    'stir'     // ongoing attention needed
  ];
  
  const verb = (task.canonical_verb || '').toLowerCase();
  return timeSensitiveVerbs.includes(verb);
}
```

### Serve Time Prediction

```javascript
// Calculate when you'll be serving
const remainingTasks = state.meal.tasks.filter(t => 
  !rt.doneIds.has(t.id) && 
  !rt.running.find(r => r.id === t.id)
);

const remainingMinutes = remainingTasks.reduce((sum, t) => 
  sum + getPlannedMinutes(t), 0
);

const runningMinutes = rt.running.reduce((sum, r) => 
  sum + Math.ceil((r.endsAt - rt.nowMs) / 60000), 0
);

const totalMinutes = remainingMinutes + runningMinutes;
const serveTime = new Date(Date.now() + totalMinutes * 60000);
```

## UI Design

### Visual Hierarchy

**Could do now** (Blue background, ⏰ icon):
- Most flexible, optional
- Blue conveys calm, no urgency
- "Do now, later, or even the night before"

**Can do now** (Standard, ✅ icon):
- Normal flow, ready to execute
- Green checkmark: dependencies met
- "Dependencies met — ready when you are"

**Can't do yet** (Standard, ⏸️ icon):
- Blocked, waiting
- Pause icon: must wait
- "Waiting on dependencies or too early to start"

**Must do now** (Red/urgent, 🔥 icon):
- Critical path, immediate action
- Red conveys urgency
- "Critical path — will miss serve time if not done now"
- *(Future: when serve time mode implemented)*

### Serve Time Banner

Prominent purple gradient banner showing:
- 🕐 "You'll be serving at 7:30pm"
- "Estimated time remaining: 28 minutes"

Updates dynamically as tasks complete.

## Why This Matters for Alpha

Without temporal flexibility, NowCook becomes a dictatorial timer:
- "You must eat at 6:47pm"
- No prep flexibility
- Can't plan ahead
- Defeats GPS-like guidance value prop

With temporal flexibility:
- ✅ "Could grate cheese now or later" - user's choice
- ✅ "You'll be serving at 7:30pm" - prediction, not dictation
- ✅ Prep ahead when convenient
- ✅ True GPS-like flexibility

**This is foundational for Alpha**: without it, testers will reject the rigid scheduling and miss NowCook's core value proposition.

## Future: Full Serve Time Mode (Beta)

### Option A: Calendar Picker + Backward Planning

**User sets serve time:**
- "I want to serve Friday at 7:30pm"
- App calculates backward from serve time
- Shows all "Could do now" tasks available anytime before
- Shows "Must start by" time for critical path

**Example:**
```
Serve time: Friday 7:30pm

Could do now (available anytime before 7:30pm):
  ⏰ Grate cheddar cheese (3 min)
  ⏰ Measure milk (1 min)

Must start by 7:05pm:
  🔥 Bring water to boil (10 min)
  🔥 Cook pasta (8 min)
  🔥 Make sauce (5 min)
```

**Implementation complexity:**
- Calendar/time picker UI
- Backward critical path calculation
- "Must start by" warnings
- Time zone handling

**Scope:** Beta (full feature)

## Relationship to Other Universal Priors

### Universal Prior #1: Nothing Takes No Time
- Every task has realistic duration (minimum 1 minute)
- Includes all hidden work: finding ingredients, walking, setup, cleanup
- Affects serve time calculation accuracy

### Universal Prior #2: Emergent Ingredients
- Transformation tasks (grate, mince, dice) are explicit
- These transformations are perfect "Could do now" candidates
- Example: "Grate cheese" is emergent ingredient creation
- Can be done anytime before consumption

### Universal Prior #3: Temporal Flexibility
- Tasks have different timing requirements
- Some are flexible (could do now), some are rigid (must do now)
- Enables realistic cooking flow
- Delivers GPS-like guidance instead of rigid timer

Together, these three priors create NowCook's foundation:
1. **Realistic timing** (nothing is instant)
2. **Visible work** (transformations are tasks)
3. **Flexible guidance** (cook on your schedule)

## Testing Checklist

### Mac & Cheese v2.0
- [ ] "Grate cheese" shows in "Could do now" at start
- [ ] Can execute "Grate cheese" immediately (0:00 runtime)
- [ ] Serve time prediction shows in purple banner
- [ ] "Can do now" shows ready tasks
- [ ] "Can't do yet" shows blocked tasks correctly
- [ ] Completing tasks updates serve time prediction

### Other Alpha Meals
- [ ] Identify "Could do now" tasks in each meal
- [ ] Verify time-sensitive tasks classified correctly
- [ ] Test serve time prediction accuracy
- [ ] Validate user can prep ahead when desired

### Edge Cases
- [ ] All "Could do now" completed early - still shows correct serve time
- [ ] No "Could do now" tasks - still functions normally
- [ ] Time-sensitive task (steam) triggers urgency appropriately
- [ ] Driver busy with attended "Could do now" task - blocked correctly

## Success Criteria

✅ Alpha testers can prep ahead when convenient  
✅ App provides guidance, not dictation  
✅ "You'll be serving at X" prediction is accurate  
✅ Users understand four task states intuitively  
✅ No confusion about what's available vs blocked  
✅ GPS metaphor is clear in practice  

## Commit Message Template

```
Feature: Implement temporal flexibility (Universal Prior #3)

Four task states relative to NowLine and serve time:
- Could do now: flexible prep, do anytime (grate cheese)
- Can do now: ready when you are (boil water)
- Can't do yet: waiting on dependencies (drain pasta)
- Must do now: time-critical actions (remove from oven)

Adds serve time prediction: "You'll be serving at X"
Enables prep-ahead flexibility without rigid scheduling

This is foundational for Alpha: without temporal flexibility,
NowCook becomes a dictatorial timer instead of GPS-like guide.
```

---

**Status**: ✅ Implemented in App.jsx v1.7  
**Testing**: Kitchen validation needed with Mac & Cheese  
**Next**: Apply to all 5 Alpha meals, verify classification accuracy
