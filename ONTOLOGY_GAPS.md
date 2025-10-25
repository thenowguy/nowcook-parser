# Ontology Gap Analysis

**Date**: 2025-10-24
**Source**: Parsing 5 narrative recipes (Bolognese, Stir-fry, Salmon, Fish Tacos, Cookies)

## Summary

Current emergent ingredient detection: **Only 3 matches across all 5 recipes** (minced_garlic, sliced_carrot, boiled_noodles)

This gap analysis identifies what needs to be completed in the ontology to improve coverage.

---

## 1. Verb Matching Issues (HIGH PRIORITY)

**Problem**: Too many tasks classified as "free_text" instead of proper canonical verbs.

### Examples from logs:
- ❌ "Make the spice blend" → verb: `free_text` (should be: `mix` or `combine`)
- ❌ "Remove cauliflower leaves and core" → verb: `free_text` (should be: `remove` or `trim`)
- ❌ "Squeeze half the lemon over everything" → verb: `free_text` (should be: `squeeze`)
- ❌ "While vegetables roast, brush salmon..." → verb: `free_text` (should be: `brush`)

### Fix Required:
Update `src/parser/verbMatcher.js` to recognize more verb patterns. Add to verbs.json:
- `mix`, `combine`, `blend` (mixing verbs)
- `remove`, `trim`, `clean` (prep verbs)
- `squeeze`, `juice`, `zest` (citrus verbs)
- `brush`, `coat`, `season` (application verbs)

---

## 2. Missing Emergent Ingredients

### Actually Missing (need to add):

```json
"chopped_cauliflower": {
  "source_verb": "chop",
  "hold_window_minutes": 10080,
  "temporal_flexibility": "hold_days"
},
"melted_butter": {
  "source_verb": "melt",
  "hold_window_minutes": 120,
  "temporal_flexibility": "hold_hours"
}
```

### Already Exists But Not Found:
- `roasted_vegetables` - exists in ontology but matching failed (investigate why)

---

## 3. Assembly Verbs (DON'T Create Emergents)

These verbs combine already-prepared ingredients. They shouldn't create new emergent ingredients:

**Verbs to exclude from emergent detection**:
- `add` - "Add the chicken" (chicken already cooked)
- `toss` - "Toss with the sauce" (sauce already made)
- `combine` - "Combine the ingredients"
- `mix` (when used for assembly, not initial mixing)
- `stir` (when stirring together, not creating)

**Strategy**: Add a blacklist in the parser - if verb is in assembly list, skip emergent ingredient lookup.

---

## 4. Verb-Specific Patterns Discovered

### "add" verb findings:
- chicken, garlic, ginger, chilli, noodles, sauce
- **All are assembly steps** - ingredients already prepared earlier

### "toss" verb findings:
- vegetables, garlic, oil, mixture, salmon, olive
- **All are coating/mixing steps** - not creating new emergents

### "drizzle" verb findings:
- fish, butter, olive, oil
- **Application verb** - doesn't create emergent (fish is already baked, just adding oil)

---

## 5. Recommended Ontology Completion Strategy

### Phase 1: Fix Verb Matching (Foundation)
1. Audit all verb patterns in `verbs.json`
2. Add missing common verbs (20-30 verbs)
3. Test verb matching against our 5 recipes
4. Target: <10% "free_text" classifications

### Phase 2: Complete Emergent Ingredients (Systematic)
1. Create ingredient × verb matrix for top 20 ingredients
2. For each ingredient, add emergent entries for:
   - Prep verbs: chop, dice, slice, mince, grate
   - Cook verbs: sauté, roast, bake, boil, steam
   - Only add combinations that make sense (e.g., no "boiled butter")
3. Estimated additions: 100-150 emergent ingredients

### Phase 3: Add Assembly Verb Blacklist
1. Define assembly verbs that don't create emergents
2. Update parser to skip emergent lookup for these verbs
3. Prevents false attempts to find "added_chicken", "tossed_vegetables"

### Phase 4: Re-test
1. Re-parse all 5 recipes
2. Target: 70%+ emergent ingredient detection
3. Document remaining gaps for edge cases

---

## 6. Quick Wins (Can Add Now)

Add these to emergent-ingredients.json immediately:

```json
"chopped_cauliflower": { "hold_window_minutes": 10080, "temporal_flexibility": "hold_days" },
"melted_butter": { "hold_window_minutes": 120, "temporal_flexibility": "hold_hours" },
"squeezed_lemon": { "hold_window_minutes": 1440, "temporal_flexibility": "hold_hours" },
"brushed_salmon": { "hold_window_minutes": 10, "temporal_flexibility": "hold_minutes" }
```

---

## 7. Long-tail Items (Lower Priority)

These appeared once but are edge cases:
- `roasted_olive` (olives are added to roasted veg, not roasted themselves)
- `tossed_mixture` (too vague)
- `drizzled_oil` (oil is the agent, not the output)

**Strategy**: Don't add these. They represent parsing ambiguities, not missing ontology entries.

---

## Conclusion

**Immediate actions**:
1. ✅ Note gaps in this document
2. Continue with current recipes (accept 3 emergent ingredient matches for now)
3. Download JSON files
4. Schedule ontology completion as separate task

**Expected improvement after ontology completion**:
- Current: 3 emergent ingredients detected across 5 recipes (~6% coverage)
- Target: 35-50 emergent ingredients detected (~70-80% coverage)
