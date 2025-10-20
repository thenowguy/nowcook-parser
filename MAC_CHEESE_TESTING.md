# Mac & Cheese - Perfection Testing Guide

## Goal
Create the **perfect** reference meal that demonstrates NowCook's value with zero errors. This will be the template for refining the other 4 Alpha meals.

## Current State

**Mac & Cheese v1.0**
- **10 tasks** from water boiling to final seasoning
- **Total time:** ~26 minutes (8+8+2+2+2+5+2+1+2+1)
- **Parallelism:** Sauce starts (t3) as soon as pasta starts boiling (t2 SS dependency)

### Task Breakdown:
1. Bring water to boil - 8min (unattended)
2. Boil macaroni - 8min (unattended) 
3. Melt butter - 2min (attended) ← starts when pasta starts
4. Whisk in flour (roux) - 2min (attended)
5. Whisk in milk - 2min (attended)
6. Simmer sauce - 5min (unattended)
7. Stir in cheese - 2min (attended)
8. Drain pasta - 1min (attended)
9. Combine pasta + sauce - 2min (attended)
10. Season - 1min (attended)

## Testing Protocol

### Phase 1: Kitchen Reality Check
**Objective:** Cook the actual meal with a timer

1. **Setup:**
   - Print this guide
   - Have all ingredients ready
   - Timer/stopwatch ready
   - Notepad for observations

2. **Cook & Time:**
   - Start timer when you begin task #1
   - Note actual time for each task
   - Mark when you could have started another task (parallelism opportunities)
   - Note if you felt rushed or had too much idle time

3. **Record Issues:**
   - [ ] Task too short/long (by how much?)
   - [ ] Dependency wrong (could start earlier/later?)
   - [ ] Task too granular or too coarse?
   - [ ] Attended/unattended classification wrong?
   - [ ] Missing steps?

### Phase 2: App Editing
**Objective:** Use the new editor to fix issues

1. **Load Mac & Cheese** in http://localhost:5174
2. **Scroll to Meal Editor** section (orange box at bottom)
3. **Adjust based on Phase 1 notes:**
   - Change durations
   - Toggle attended/unattended checkboxes
   - Edit task names for clarity

4. **Test in Runtime:**
   - Click "Start run"
   - Watch the timeline
   - Verify tasks become available at right times
   - Check if driver busy/free makes sense

5. **Iterate:**
   - Reset and adjust
   - Test again
   - Repeat until perfect

### Phase 3: Save Perfect Version
1. **Click "Copy JSON"** button in editor
2. **Paste into** `/src/meals/mac_and_cheese.json`
3. **Commit** with detailed notes on what you changed and why

## Questions to Answer

### Timing
- [ ] Is 8 min realistic for water to boil? (depends on pot size, burner power)
- [ ] Is 8 min enough for elbow macaroni? (box usually says 7-8 min)
- [ ] Is 2 min enough to melt butter AND have pan ready? (or too much?)
- [ ] Roux: 2 min to whisk flour into butter until smooth?
- [ ] Milk addition: 2 min to gradually add and whisk?
- [ ] Simmer: Does 5 min actually thicken the sauce enough?

### Dependencies
- [ ] Should sauce start (t3) when pasta *starts* (SS) or after some time?
- [ ] Is there prep we could do *before* water boils? (measure ingredients, grate cheese?)

### Task Granularity
- [ ] Should "Whisk in flour" and "Whisk in milk" be one combined task?
- [ ] Should there be a "Get out ingredients" task at start?
- [ ] Is "Season" too vague? (Should it specify salt, pepper, paprika separately?)

### Attended/Unattended
- [ ] Is "Simmer sauce" truly unattended? (Do you need to stir occasionally?)
- [ ] Is "Boil macaroni" truly unattended? (Do you check for doneness?)

### Missing Steps
- [ ] Clean pot before starting?
- [ ] Grate cheese beforehand?
- [ ] Reserve pasta water? (for adjusting sauce consistency)
- [ ] Let rest before serving?

## Success Criteria

The meal is "perfect" when:
1. ✅ Every duration matches kitchen reality (±30 sec acceptable)
2. ✅ You can follow the MealMap without confusion
3. ✅ Parallelism actually saves time without creating chaos
4. ✅ No moments where you're waiting with nothing to do
5. ✅ No moments where you feel rushed or overwhelmed
6. ✅ Dependencies make logical sense
7. ✅ Someone unfamiliar with the recipe could follow it successfully

## Learnings to Extract

Once Mac & Cheese is perfect, document:
- **Timing patterns:** Are our estimates generally too optimistic/pessimistic?
- **Dependency patterns:** When should we use SS vs FS?
- **Task patterns:** What level of granularity works best?
- **Verb patterns:** Which verbs are truly unattended? Which need attention?

These patterns will guide refinement of the other 4 Alpha meals.

---

**Current Status:** 🏗️ In Progress
**Last Updated:** October 19, 2025
**Tester:** [Your name]
**Test Date:** [Date you cook it]
