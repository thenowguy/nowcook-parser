# Parsing Request: Sheet Pan Salmon with Emergent Ingredients

## Context

You previously parsed this Sheet Pan Salmon recipe and produced excellent task/chain structure. Now we need to **add emergent ingredients** to unlock the hold window system and proper temporal dependencies.

## Your Previous Parse (Current State)

- **18 tasks, 7 chains**
- ✅ Chain detection: PERFECT (detailed chains showing prep, roast, prepare salmon, etc.)
- ✅ Verb canonicalization: EXCELLENT (all verbs match ontology)
- ✅ Good separation of prep and cooking stages
- ❌ Missing: Emergent ingredient outputs (needed for hold windows)

## Task: Add Emergent Ingredients

Please **update your existing JSON** by adding `outputs` arrays with emergent ingredients where semantically appropriate.

### Key Emergent Ingredients to Add

Based on your existing tasks, here are the critical emergent ingredients this recipe needs:

#### Chain 2: Make Spice Blend

1. **"Combine paprika, baharat, salt, and pepper"** (chain_2/step_1)
   - Output: `{ "ingredient": "spice_blend", "state": "mixed", "emergent": true }`
   - This spice mix is used in TWO places: vegetables (chain_3/step_5) and salmon (chain_5/step_2)
   - Both tasks should have FS edges to this task

#### Chain 3: Prepare Vegetables

2. **"Cut cauliflower florets into bite-sized pieces"** (chain_3/step_2)
   - Output: `{ "ingredient": "cauliflower", "state": "chopped", "emergent": true }`

3. **"Cut carrots diagonally into 1/2-inch pieces"** (chain_3/step_4)
   - Output: `{ "ingredient": "carrots", "state": "sliced", "emergent": true }`

4. **"Toss vegetables with garlic, 2 tablespoons oil, and 3/4 of the spice mixture"** (chain_3/step_5)
   - Output: `{ "ingredient": "vegetables", "state": "seasoned", "emergent": true }`
   - Inputs should reference: `chopped_cauliflower`, `sliced_carrots`, `spice_blend`
   - This task MUST have FS edge to chain_2/step_1 (spice blend)

#### Chain 4: Roast Vegetables

5. **"Bake vegetables for 15 minutes"** (chain_4/step_1)
   - Output: `{ "ingredient": "vegetables", "state": "roasted", "emergent": true }`
   - Partially roasted vegetables - can hold for 30-60 minutes before adding salmon

#### Chain 5: Prepare Salmon

6. **"Sprinkle salmon with remaining spice mixture"** (chain_5/step_2)
   - Output: `{ "ingredient": "salmon", "state": "seasoned", "emergent": true }`
   - This task MUST have FS edge to chain_2/step_1 (spice blend)

#### Chain 6: Combine and Finish Roasting

7. **"Bake for 5-8 minutes until fish is opaque"** (chain_6/step_5)
   - Output: `{ "ingredient": "salmon", "state": "baked", "emergent": true }`
   - serve_immediate! Salmon should be served hot, within minutes

#### Chain 7: Finish and Serve

8. **"Squeeze half the lemon over everything"** (chain_7/step_2)
   - This is the final plating moment - no emergent output needed

### Important Missing Dependencies

Your current parse is missing a critical dependency:

**chain_3/step_5** ("Toss vegetables with spice mixture") has edges to:
- chain_3/step_2 (cauliflower) ✅
- chain_3/step_4 (carrots) ✅
- chain_2/step_1 (spice blend) ✅

**chain_5/step_2** ("Sprinkle salmon with spice mixture") has edges to:
- chain_5/step_1 (brushed salmon) ✅
- chain_2/step_1 (spice blend) ✅

These are CORRECT - both tasks need the spice blend!

### Clarification on Garlic

**chain_3/step_5** mentions "garlic" in the task name, but your current inputs are:
```json
"inputs": ["garlic", "olive_oil"]
```

The recipe likely said "2 cloves garlic, minced" - this should be a PREP task!

**Add to beginning of Chain 3**:
```json
{
  "id": "chain_3/step_0",
  "name": "Mince the garlic cloves",
  "canonical_verb": "mince",
  "planned_min": 2,
  "requires_driver": true,
  "self_running_after_start": false,
  "inputs": ["garlic"],
  "outputs": [
    {
      "ingredient": "garlic",
      "state": "minced",
      "emergent": true
    }
  ],
  "equipment": ["knife", "cutting_board"],
  "edges": []
}
```

Then update **chain_3/step_5** (which becomes chain_3/step_6 after renumbering):
- Add FS edge from chain_3/step_0
- Change inputs to use `minced_garlic`

Renumber all subsequent chain_3 tasks (step_1→step_2, step_2→step_3, etc.)

## Important Guidelines

1. **Simple names**: Use `spice_blend` NOT `spice_blend_001`
2. **Only semantically important outputs**: Don't add outputs for intermediate steps like "Remove pan from oven" - only meaningful transformations
3. **State descriptors**: Use past tense (mixed, chopped, sliced, seasoned, roasted, baked)
4. **DON'T specify hold windows**: System infers from verb ontology automatically
5. **Multi-use emergents**: The `spice_blend` is used in TWO places - this is a perfect example of why emergent ingredients matter!

## Expected Result

Updated JSON with:
- **Chain 2**: Spice blend with emergent output (spice_blend)
- **Chain 3**: Vegetable prep with emergent outputs (minced_garlic, chopped_cauliflower, sliced_carrots, seasoned_vegetables)
  - NEW chain_3/step_0 for mincing garlic
  - Renumbered subsequent tasks
- **Chain 4**: Roasted vegetables with emergent output (roasted_vegetables)
- **Chain 5**: Seasoned salmon with emergent output (seasoned_salmon)
- **Chain 6**: Baked salmon with emergent output (baked_salmon)
- **Chain 7**: Final assembly (no emergent output - immediate serving)
- All existing FS edges remain, plus new edges to spice_blend and minced_garlic

## What We'll Do With This

1. Validate against schema (should pass with object-format outputs)
2. Add to Alpha app for testing
3. Parser will automatically enrich edges with hold window metadata
4. Runtime will show this recipe has good flexibility - spice blend and vegetable prep can be done ahead

Please provide the complete updated JSON. Thank you!
