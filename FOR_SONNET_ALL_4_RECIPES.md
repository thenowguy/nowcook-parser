# Emergent Ingredients Package: 4 Recipe Updates

## Overview

You previously parsed 4 recipes (Bolognese, Stir-Fry, Salmon, Cookies) with excellent task/chain structure. Now we need to **add emergent ingredients** to all 4 to unlock the hold window system and proper temporal dependencies.

**What Changed Since Last Parse:**
- Schema now accepts object format for outputs: `{ "ingredient": "...", "state": "...", "emergent": true }`
- Your steak recipe with emergent ingredients WORKS PERFECTLY in production!
- We're ready to add emergent ingredients to the remaining 4 recipes

**Instructions Format:**
Each recipe has a dedicated detailed request document:
1. `FOR_SONNET_BOLOGNESE_REQUEST.md`
2. `FOR_SONNET_STIR_FRY_REQUEST.md`
3. `FOR_SONNET_SALMON_REQUEST.md`
4. `FOR_SONNET_COOKIES_REQUEST.md`

**Please read each request file and produce updated JSON for all 4 recipes.**

---

## Quick Summary of Changes Needed

### 1. Spaghetti Bolognese (19 tasks → ~22 tasks)
- **Add Chain 0**: Prep Work (dice onion, mince garlic)
- **Chain 2** (was Chain 1): Add emergent outputs (softened_aromatics, browned_beef, bolognese_sauce)
- **Chain 3** (was Chain 2): Add emergent output (cooked_spaghetti)
- **Chain 4** (was Chain 3): Update inputs to reference emergent ingredients
- **Key insight**: Bolognese sauce can be made DAYS ahead!

### 2. Chicken Stir-Fry (28 tasks, no new tasks needed)
- **Chain 1**: Add emergent outputs to ALL 12 prep tasks (minced garlic/ginger/chilli, sliced vegetables, marinated chicken)
- **Chain 2**: Add emergent outputs (seared_chicken, stir_fry)
- **Chain 3**: Add emergent output (cooked_noodles)
- **Chain 4**: Update inputs to reference emergent ingredients
- **Key insight**: ALL prep can be done days ahead - this recipe has amazing flexibility!

### 3. Sheet Pan Salmon (18 tasks → ~19 tasks)
- **Add chain_3/step_0**: Mince garlic (missing prep task)
- **Chain 2**: Add emergent output (spice_blend) - used in TWO places!
- **Chain 3**: Add emergent outputs (minced_garlic, chopped_cauliflower, sliced_carrots, seasoned_vegetables)
- **Chain 4**: Add emergent output (roasted_vegetables)
- **Chain 5**: Add emergent output (seasoned_salmon)
- **Chain 6**: Add emergent output (baked_salmon)
- **Key insight**: Spice blend and vegetable prep can be done ahead

### 4. Chocolate Chip Cookies (17 tasks → ~18 tasks)
- **Add chain_2/step_0**: Melt butter (missing prep task)
- **Chain 1**: Add emergent output (dry_mixture)
- **Chain 2**: Add emergent outputs (melted_butter, butter_mixture, wet_mixture)
- **Chain 3**: Add emergent output (cookie_dough)
- **Chain 4**: Add emergent output (chilled_dough)
- **Chain 5**: Add emergent output (preheated_oven)
- **Chain 6**: Add emergent outputs (baked_cookies, cooled_cookies)
- **Key insight**: Cookie dough can be made 3-5 DAYS ahead!

---

## Guidelines for All Recipes

### Emergent Ingredient Format
```json
"outputs": [
  {
    "ingredient": "ingredient_name",
    "state": "past_tense_descriptor",
    "emergent": true
  }
]
```

### Naming Conventions
- ✅ Use simple names: `bolognese_sauce`, `cookie_dough`, `spice_blend`
- ❌ NO numbering: NOT `bolognese_sauce_001`
- ✅ State descriptors: Past tense (minced, sliced, seasoned, cooked, baked)

### When to Add Outputs
✅ **DO add emergent outputs when**:
- Another task explicitly needs it as input
- It can be prepped hours/days in advance
- It represents a meaningful transformation
- Multiple tasks use it (like spice_blend in Salmon)

❌ **DON'T add emergent outputs for**:
- Equipment setup ("Line baking sheets")
- Final plating ("Transfer to plates")
- Immediate consumption steps
- Heat adjustments ("Reduce heat to medium")

### What NOT to Specify
- ❌ DON'T add `hold_window_minutes` field - parser infers from verb ontology
- ❌ DON'T add `temporal_flexibility` field - parser infers from verb ontology
- ❌ DON'T add `constraint` field to edges - parser infers from outputs

### Dependencies
- Tasks that use emergent ingredients MUST have FS edges to the task that produces them
- Your existing FS edge structure is mostly correct - just need to add outputs!

---

## Deliverables

Please provide 4 complete updated JSON files:
1. **sonnet-bolognese-v2.json** - With emergent ingredients
2. **sonnet-chicken-stir-fry-v2.json** - With emergent ingredients
3. **sonnet-sheet-pan-salmon-v2.json** - With emergent ingredients
4. **sonnet-chocolate-chip-cookies-v2.json** - With emergent ingredients

Each should:
- ✅ Validate against updated schema (object format for outputs)
- ✅ Include all emergent ingredient outputs
- ✅ Have proper FS edges to emergent ingredient producers
- ✅ Include any new prep tasks (mince garlic, melt butter, dice onion)
- ✅ Have renumbered task IDs if chains were added (Bolognese, Salmon, Cookies)

---

## Reference: Your Successful Steak Recipe

Here's an example from your steak recipe that's working perfectly:

```json
{
  "id": "chain_3/step_1",
  "name": "Remove steak from refrigerator and let come to room temperature (temper)",
  "canonical_verb": "rest",
  "planned_min": 20,
  "outputs": [
    {
      "ingredient": "steak",
      "state": "tempered",
      "emergent": true
    }
  ],
  "edges": []
}
```

```json
{
  "id": "chain_3/step_2",
  "name": "Season the steak with salt and pepper",
  "canonical_verb": "season",
  "planned_min": 1,
  "inputs": ["salt", "pepper"],
  "outputs": [
    {
      "ingredient": "steak",
      "state": "seasoned",
      "emergent": true
    }
  ],
  "edges": [
    {
      "from": "chain_3/step_1",
      "to": "chain_3/step_2",
      "type": "FS"
    }
  ]
}
```

This pattern works beautifully - the system automatically:
1. Infers hold windows from verb ontology
2. Adds constraint metadata to edges
3. Evaluates hold window expiration at runtime
4. Shows proper "Can Do Now" / "Can't Do Yet" states

---

## What We'll Do Next

Once you provide the 4 updated JSONs:
1. ✅ Validate all 4 against schema
2. ✅ Add to Alpha app for testing
3. ✅ Test hold window system end-to-end
4. ✅ Verify temporal flexibility works correctly
5. 🎉 Have complete recipe catalog with emergent ingredients!

Thank you! Looking forward to the updated recipes.

---

## Detailed Instructions

Please refer to these files for complete details on each recipe:
- [FOR_SONNET_BOLOGNESE_REQUEST.md](FOR_SONNET_BOLOGNESE_REQUEST.md)
- [FOR_SONNET_STIR_FRY_REQUEST.md](FOR_SONNET_STIR_FRY_REQUEST.md)
- [FOR_SONNET_SALMON_REQUEST.md](FOR_SONNET_SALMON_REQUEST.md)
- [FOR_SONNET_COOKIES_REQUEST.md](FOR_SONNET_COOKIES_REQUEST.md)
