# UI Rethink: Two-Zone Layout Proposal

## The Core Idea: Split Timeline from Active Tasks

```
┌─────────────────────────────────────────────────┐
│  📊 MINIATURE TIMELINE (top 80px)               │
│  ════════════════════════════════════════════   │
│  NOW│░░░░░░░░░░░░░░░░░░░░░░░░░░░→ SERVE        │
│     │                                            │
│  Chain colors show visual progress through time │
│  Compressed view - all tasks as small blocks    │
│  Click/tap a block to jump to that task below   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  🎯 ACTIVE TASKS (main area - scrollable)       │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ ⏱️ RUNNING (1:23 remaining)               │  │
│  │ ═══════════════════════════════════════   │  │
│  │ Boil pasta                                │  │
│  │ [Dismiss button]                          │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ ✅ CAN DO NOW                             │  │
│  │ ═══════════════════════════════════════   │  │
│  │ Sauté garlic & onions                     │  │
│  │ [Start button]                            │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ ⏰ BACKGROUND TASKS                       │  │
│  │ ═══════════════════════════════════════   │  │
│  │ Oven preheating (8min left)               │  │
│  │ Meat marinating (12min left)              │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ 📋 UP NEXT (collapsed)                    │  │
│  │ ═══════════════════════════════════════   │  │
│  │ 3 tasks ready in 5 minutes ▼              │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Key Principles:

### 1. Timeline = Context, Not Primary Interface
- **Top 80px**: Compressed timeline showing ALL tasks
- Color-coded by chain (maintains chain clarity)
- Shows temporal relationships (what's coming, when)
- Tap a block to jump to that task in main area
- **NOT for starting/stopping tasks** - just navigation/awareness

### 2. Active Tasks = Focus Area
- **Main scrollable area**: Only shows what matters NOW
- Large, readable text (18-24px)
- Big touch targets for Start/Dismiss
- Grouped by state, not by chain:
  - 🏃 **RUNNING** (1-2 tasks typically)
  - ✅ **CAN DO NOW** (2-4 tasks available)
  - 🔄 **BACKGROUND** (SRAS tasks running unattended)
  - 📋 **UP NEXT** (collapsed - tap to expand)

### 3. Auto-Scroll Behavior
- When you start a task → jumps to RUNNING section
- When task finishes → auto-scrolls to newly available tasks
- Smart scrolling keeps relevant tasks visible

### 4. Text Length Problem = Solved
- Task cards have full width (~350px) for text
- Can wrap to 2 lines if needed
- Much more readable than 160px constraint

### 5. Information Overload = Solved
- Only show ~6-8 task cards at once
- Everything else collapsed in "Up Next"
- No more scrolling through 20 tasks to find the running one

## Example Scenarios:

### Scenario A: Starting to Cook (T=0)
```
TIMELINE: All tasks visible, most are gray (future)
         First 2-3 tasks are green (can-do)

ACTIVE TASKS:
  ✅ CAN DO NOW
     - Preheat oven
     - Chop onions
     - Mince garlic

  📋 UP NEXT (5 tasks ready in 12min)
```

### Scenario B: Mid-Cooking (T=20min)
```
TIMELINE: Some tasks completed (faded),
         one task at NowLine (running),
         future tasks visible ahead

ACTIVE TASKS:
  🏃 RUNNING (3:45 left)
     - Simmer sauce

  🔄 BACKGROUND
     - Oven at 450°F (ready)

  ✅ CAN DO NOW
     - Prepare salad
     - Set table

  📋 UP NEXT (2 tasks ready in 4min)
```

### Scenario C: Busy Moment (4 things happening)
```
TIMELINE: Shows you're in the thick of it!

ACTIVE TASKS:
  🏃 RUNNING (0:23 left)
     - Sear steak

  🔄 BACKGROUND
     - Potatoes boiling (2min left)
     - Asparagus roasting (4min left)
     - Sauce reducing (8min left)

  ✅ CAN DO NOW
     - (none - you're maxed out!)

  📋 UP NEXT (3 tasks ready in 2min) ⚠️
```

## Benefits:

### ✅ Solves Current Problems
- **Text overflow**: Full width for task names
- **Scrolling hiding tasks**: Running tasks always at top
- **Information overload**: Only show relevant tasks
- **Lost in timeline**: Quick visual scan of timeline at top

### ✅ Maintains What Works
- **Chain clarity**: Timeline shows chain colors
- **Temporal awareness**: Timeline shows time relationships
- **Parallel cooking**: BACKGROUND section shows all SRAS tasks
- **At-a-glance**: Large text, clear groupings

### ✅ Better for Solo Cook
- Matches mental model: "What am I doing now?"
- Not: "Show me all 20 tasks in temporal order"
- Fits 4-task simultaneous limit naturally

## Technical Implementation Notes:

### Timeline Component (New - Compressed)
- Height: 80px
- Shows all tasks as small rectangles
- Color = chain color
- Width = duration (scaled down)
- Position = time (horizontal)
- Click → scrolls to that task in main area

### Task Cards Component (New - Vertical List)
- Full width (~350px)
- Grouped by state (Running, Can-Do, Background, Up-Next)
- Large touch targets (80px height minimum)
- Auto-scroll on state changes
- Collapse/expand sections

### State Management
- Filter tasks by state (running, ready, background, upcoming)
- Sort by urgency within each group
- Limit "Can Do Now" to top 3-4 most urgent
- Everything else goes to "Up Next" collapsed section

## Open Questions:

1. **Timeline interaction**: Tap to jump? Or just visual reference?
2. **Up Next expansion**: Show all? Or still paginate?
3. **Transition animation**: When task moves from Up Next → Can Do Now?
4. **Chain headers in main view**: Still show them? Or just in timeline?

## What This Doesn't Solve:

- Still need concise task names (40 char limit still applies)
- Ingredient quantities display (separate issue)
- Hold window visualization (could add to timeline?)

---

**This is a sketch, not a spec.** Just trying to visualize how we could use vertical space differently by separating "temporal navigation" (timeline) from "immediate action" (task cards).
