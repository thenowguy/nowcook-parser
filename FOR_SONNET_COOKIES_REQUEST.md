# Parsing Request: Chocolate Chip Cookies with Emergent Ingredients

## Context

You previously parsed this Chocolate Chip Cookies recipe and produced excellent task/chain structure. Now we need to **add emergent ingredients** to unlock the hold window system and proper temporal dependencies.

## Your Previous Parse (Current State)

- **17 tasks, 6 chains**
- ✅ Chain detection: PERFECT ("Mix Dry Ingredients", "Mix Wet Ingredients", "Combine Dough", "Chill Dough", "Prepare for Baking", "Bake and Cool Cookies")
- ✅ Verb canonicalization: EXCELLENT (all verbs match ontology)
- ✅ Good separation of wet/dry, chill time captured
- ❌ Missing: Emergent ingredient outputs (needed for hold windows)

## Task: Add Emergent Ingredients

Please **update your existing JSON** by adding `outputs` arrays with emergent ingredients where semantically appropriate.

### Key Emergent Ingredients to Add

Based on your existing tasks, here are the critical emergent ingredients this recipe needs:

#### Chain 1: Mix Dry Ingredients

1. **"Whisk together flour, baking soda, and salt"** (chain_1/step_1)
   - Output: `{ "ingredient": "dry_mixture", "state": "mixed", "emergent": true }`
   - This dry mixture is used later in chain_3/step_1 (fold into wet)

#### Chain 2: Mix Wet Ingredients

2. **"Combine melted butter with brown sugar and granulated sugar"** (chain_2/step_1)
   - Output: `{ "ingredient": "butter_mixture", "state": "creamed", "emergent": true }`

3. **"Whisk until well combined with no egg white streaks remaining"** (chain_2/step_3)
   - Output: `{ "ingredient": "wet_mixture", "state": "mixed", "emergent": true }`

4. **"Mix in vanilla extract"** (chain_2/step_4)
   - Output: `{ "ingredient": "wet_mixture", "state": "flavored", "emergent": true }`
   - This is the complete wet mixture ready for combining

#### Chain 3: Combine Dough

5. **"Fold dry ingredients into wet ingredients"** (chain_3/step_1)
   - Inputs should reference: `dry_mixture` (from chain_1/step_1), `wet_mixture` (from chain_2/step_4)
   - Already has FS edges to both ✅

6. **"Mix until no dry flour remains"** (chain_3/step_3)
   - Output: `{ "ingredient": "cookie_dough", "state": "mixed", "emergent": true }`
   - This is the complete unbaked dough

#### Chain 4: Chill Dough

7. **"Refrigerate for at least 30 minutes"** (chain_4/step_2)
   - Output: `{ "ingredient": "cookie_dough", "state": "chilled", "emergent": true }`
   - Chilled dough - can actually hold for DAYS! This is a prep_any_time task
   - Cookie dough holds for 3-5 days refrigerated, months frozen

#### Chain 5: Prepare for Baking

8. **"Preheat oven to 350°F"** (chain_5/step_1)
   - Output: `{ "ingredient": "oven", "state": "preheated", "emergent": true }`
   - Preheated oven - holds for 15-30 minutes before losing temp

#### Chain 6: Bake and Cool Cookies

9. **"Bake one sheet for 9-11 minutes"** (chain_6/step_2)
   - Output: `{ "ingredient": "cookies", "state": "baked", "emergent": true }`

10. **"Let cookies cool on baking sheet for 10 minutes"** (chain_6/step_3)
    - Output: `{ "ingredient": "cookies", "state": "cooled", "emergent": true }`

11. **"Transfer cookies to a wire rack"** (chain_6/step_4)
    - This is final handling - no emergent output needed

### Important Note: Butter State

The recipe says "melted butter" - was there a PREP task to melt the butter?

**Consider adding to Chain 2**:
```json
{
  "id": "chain_2/step_0",
  "name": "Melt the butter",
  "canonical_verb": "melt",
  "planned_min": 2,
  "requires_driver": true,
  "self_running_after_start": false,
  "inputs": ["butter"],
  "outputs": [
    {
      "ingredient": "butter",
      "state": "melted",
      "emergent": true
    }
  ],
  "equipment": ["microwave"],
  "edges": []
}
```

Then update **chain_2/step_1** (which becomes chain_2/step_2 after renumbering):
- Add FS edge from chain_2/step_0
- Change inputs to use `melted_butter`

Renumber all subsequent chain_2 tasks (step_1→step_2, step_2→step_3, etc.)

### Hold Window Advantage: Cookie Dough

This recipe has AMAZING flexibility because:
1. **Dry mixture** (chain_1/step_1) can be made DAYS ahead (holds_days)
2. **Wet mixture** (chain_2/step_4) can be made HOURS ahead (holds_hours)
3. **Cookie dough** (chain_4/step_2) can be made 3-5 DAYS ahead (holds_days!)

The parser will automatically mark chain_4/step_2 with:
- `hold_window_minutes: 4320` (3 days)
- `temporal_flexibility: "hold_days"`

This means you can make the dough on Monday and bake cookies on Friday!

## Important Guidelines

1. **Simple names**: Use `cookie_dough` NOT `cookie_dough_001`
2. **Only semantically important outputs**: Don't add outputs for "Cover the dough" or "Line baking sheets" - only meaningful transformations
3. **State descriptors**: Use past tense (mixed, creamed, flavored, chilled, baked, cooled)
4. **DON'T specify hold windows**: System infers from verb ontology automatically
5. **Prepped oven**: The preheated oven is an emergent "ingredient" (resource) that chain_6/step_2 depends on

## Expected Result

Updated JSON with:
- **Chain 1**: Dry mixture with emergent output (dry_mixture)
- **Chain 2**: Wet ingredients with emergent outputs (melted_butter, butter_mixture, wet_mixture)
  - NEW chain_2/step_0 for melting butter
  - Renumbered subsequent tasks
- **Chain 3**: Cookie dough with emergent output (cookie_dough)
- **Chain 4**: Chilled dough with emergent output (chilled_dough)
- **Chain 5**: Preheated oven with emergent output (preheated_oven)
- **Chain 6**: Baked and cooled cookies with emergent outputs (baked_cookies, cooled_cookies)
- All existing FS edges remain, plus new edge to melted_butter

## What We'll Do With This

1. Validate against schema (should pass with object-format outputs)
2. Add to Alpha app for testing
3. Parser will automatically enrich edges with hold window metadata
4. Runtime will show this recipe has INCREDIBLE flexibility - almost everything can be prepped days ahead!

Please provide the complete updated JSON. Thank you!
