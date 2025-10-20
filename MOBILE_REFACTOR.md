# NowCook v2.0.0 - Mobile-First Refactor

## What Changed

### Architecture
- **Before**: Single-page app with all features in one massive App.jsx (1309 lines)
- **After**: Multi-page app with React Router and focused page components

### New Structure
```
src/
  pages/
    MealChooser.jsx     - Browse and select meals (mobile-optimized cards)
    SchedulingModal.jsx - Full-page scheduling interface
    Runtime.jsx         - Timeline-first cooking interface
  
  components/
    Timeline.jsx        - Extracted timeline visualization component
    AuthorIngPanel.jsx  - (kept for future meal authoring)
  
  utils/
    runtime.js          - Extracted runtime logic and helpers
  
  data/
    meals.js            - Centralized meal data management
  
  App.jsx             - Simple router setup (23 lines!)
```

### Page Flow
```
┌──────────────┐
│ MealChooser  │  Browse 5 Alpha meals
│   (/)        │  Click "COOK" button
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Scheduling   │  When would you like to serve?
│ (/schedule/  │  • Start now (primary)
│  :mealIdx)   │  • Add 30 min / 1 hr / 2 hr
└──────┬───────┘  • Tonight at 6pm / 7pm
       │          • Tomorrow at 7pm
       │
       ▼
┌──────────────┐
│   Runtime    │  TIMELINE-FIRST INTERFACE
│ (/runtime/   │  • Full-screen timeline
│  :mealIdx)   │  • Serve time banner
└──────────────┘  • Task controls at bottom
                  • Color-coded by state
```

### Mobile-First Design Principles

#### 1. Timeline IS the Interface
The timeline communicates task states through **position and color**, not text:

- **Green tasks** = "Could do now" (flexible prep - grate, chop, measure)
- **Blue tasks** = "Can do now" (critical path - ready to start)  
- **Gray tasks** = "Can't do yet" (blocked by dependencies)
- **Pulsing tasks** = "Must do now" (urgent - time is up!)

Text lists are **debug aids only**, not user-facing UI.

#### 2. Touch-First Controls
- **56px minimum button height** (exceeds iOS 44px requirement)
- **Large touch targets** throughout
- **Single-column layout** optimized for portrait phones
- **Full-page modals** for focused interactions
- **Glanceable information** (large timers, clear serve time)

#### 3. Progressive Disclosure
- **Start screen**: Simple "START COOKING" button
- **During cooking**: Timeline + active task controls
- **Optional prep**: Collapsed in `<details>` by default
- **Completed**: Celebration screen with "Done" button

### Key Features Preserved
✅ **Temporal Flexibility** (Universal Prior #3)
✅ **4-way task classification** (Could/Can/Can't/Must do now)
✅ **Dependency tracking** (FS, SS, FF edges)
✅ **Serve time prediction**
✅ **Timeline visualization**
✅ **Manual task completion** (no auto-finish)

### Key Features Enhanced
🎯 **Mobile-optimized** - designed for kitchen use on phones
🎯 **Navigation flow** - clear page transitions
🎯 **Timeline-first** - visual state communication
🎯 **Touch-friendly** - large buttons and controls
🎯 **Reduced cognitive load** - one thing per page

### Testing the Refactor
```bash
npm run dev
# App running on http://localhost:5174

# Test flow:
1. Browse meals on homepage (/)
2. Click "COOK" on any meal
3. Choose "Start now" on scheduling page
4. See timeline-first runtime interface
5. Start tasks, finish tasks, complete meal
```

### What Stayed in Old App.jsx
The old single-page app is backed up as:
- `src/App-old.jsx` (1309 lines)
- `src/App.jsx.backup` (identical copy)

These contain:
- AuthoringPanel integration
- Meal Editor
- Parser logic
- Export functions
- All the legacy UI

We can port these features back as separate pages/tools later.

### Next Steps
1. ✅ Test mobile-first flow on localhost:5174
2. Verify all 5 Alpha meals load correctly
3. Test runtime with Mac & Cheese
4. Add mobile viewport meta tags if needed
5. Consider PWA features (install to homescreen)

### Breaking Changes
- **URL structure changed**: `/` → `/schedule/:id` → `/runtime/:id`
- **No more single-page state management**
- **AuthoringPanel temporarily removed** from main UI
- **Meal Editor temporarily removed** from runtime view

### Benefits
✨ **~95% code reduction** in main App.jsx (1309 lines → 23 lines)
✨ **Clear separation of concerns** (each page has ONE job)
✨ **Mobile-first by default** (no responsive gymnastics)
✨ **Easier testing** (test each page independently)
✨ **Better performance** (code splitting by route)
✨ **Simpler mental model** (navigation matches user flow)

## Philosophy
**The timeline IS the interface.** Everything else is just controls and information display. Color and position communicate state. The app gets out of the user's way and lets them cook.

---
**Version**: 2.0.0  
**Date**: October 20, 2025  
**Status**: Ready for mobile testing 🚀
