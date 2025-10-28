# Answers to Sonnet's Questions - Re: New Parsing Instructions

## Question 1: The "cook" Verb

**Answer: Option C - Flag `cook` as a missing verb**

You're absolutely right that `cook` appears in the example but not in the canonical verbs list. This is an oversight.

**For now**:
- Use `boil` specifically when cooking pasta/food in boiling water
- Use `simmer` when cooking at lower heat in liquid
- Use `bake` when cooking in the oven
- If none of these fit, **flag `cook` as missing** and use the closest match

**Example**:
```json
// Pasta cooking in boiling water
{
  "name": "Cook the pasta until al dente, stirring occasionally",
  "canonical_verb": "boil",  // More specific than "cook"
  "planned_min": 9
}
```

---

## Question 2: Hold Windows for Missing Verbs

**Answer: Apply the "safe default" (hold_hours, 60min) to ALL missing verbs**

For the verbs you listed that are missing from the hold window table:
- `deglaze`, `reduce_heat`, `heat_oil`, `increase_heat`, `fold`, `cover`, `arrange`, `drizzle`, `divide`, `separate`, `stuff`, `truss`, `rest_meat`

**Use**:
```json
{
  "hold_window_minutes": 60,
  "temporal_flexibility": "hold_hours"
}
```

This is the **safest conservative default**. We can refine these later with more specific values once we analyze usage patterns.

**Exception**: If you have strong intuition that a verb should be in a different category, flag it in your response and use your best judgment. For example:
- `rest_meat` probably should be `serve_immediate` (5min) since rested meat shouldn't sit too long
- `cover` is probably `hold_hours` (60min) - correct default

---

## Question 3: Ingredients Array - Which Section?

**Answer: Extract from the narrative ingredients list AND normalize them**

The recipes in `REPARSE_REQUEST_5_RECIPES.md` all have **ingredients sections at the top**. Extract from there.

**Normalization rules**:
1. **Separate prep state from name**:
   - Input: `1 onion, peeled and finely chopped`
   - Output: `name: "onion"`, `quantity: "1"`, `unit: ""`, `prep_state: "peeled and finely chopped"`

2. **Keep quantities as written** (preserve fractions, dual units):
   - `"1 1/2"` ✅ (not `"1.5"`)
   - `"1 lb / 500g"` ✅ (preserve both)

3. **Extract unit separately**:
   - Input: `2 tbsp olive oil`
   - Output: `name: "olive oil"`, `quantity: "2"`, `unit: "tbsp"`

4. **Handle parenthetical notes** (alternate names):
   - Input: `1 lb / 500g beef mince (ground beef)`
   - Output: `name: "beef mince"`, `quantity: "1 lb / 500g"`, `unit: ""`
   - (Use primary name, ignore parenthetical)

5. **If no unit or prep state, use empty string** `""`

---

## Question 4: Multi-Stage Emergent Ingredients

**Answer: Option A - Always reference base ingredient in inputs**

The `inputs` field should reference the **base ingredient name** (as it appears in the ingredients list), NOT the emergent state.

**Correct approach**:
```json
// Task 1: Raw → Blanched
{
  "name": "Blanch green beans",
  "inputs": ["green_beans"],
  "outputs": [{ "ingredient": "green_beans", "state": "blanched", "emergent": true }]
}

// Task 2: Blanched → Shocked
{
  "name": "Shock beans in ice water",
  "inputs": ["green_beans"],  // ✅ Base ingredient, not "blanched_green_beans"
  "outputs": [{ "ingredient": "green_beans", "state": "shocked", "emergent": true }],
  "edges": [{ "from": "blanch_task", "to": "shock_task", "type": "FS" }]
}

// Task 3: Shocked → Sautéed
{
  "name": "Sauté beans with garlic",
  "inputs": ["green_beans", "garlic"],  // ✅ Base ingredients
  "outputs": [{ "ingredient": "green_beans", "state": "sautéed", "emergent": true }],
  "edges": [{ "from": "shock_task", "to": "sauté_task", "type": "FS" }]
}
```

**Why**: The `edges` array handles the state dependencies. The `inputs` field just indicates which base ingredients are required.

---

## Question 5: Five Recipes Scope

**Answer: The 5 recipes are ALREADY in REPARSE_REQUEST_5_RECIPES.md - proceed now!**

You do NOT need to wait for uploads. The file `REPARSE_REQUEST_5_RECIPES.md` contains all 5 recipes with full narrative text:

1. **Recipe 1**: Spaghetti Bolognese (lines 19-62)
2. **Recipe 2**: Chicken & Veg Stir-Fry (lines 64-105)
3. **Recipe 3**: Sheet Pan Salmon with Vegetables (lines 107-149)
4. **Recipe 4**: Chocolate Chip Cookies (lines 151-192)
5. **Recipe 5**: Seared Steak with Garlic Mashed Potatoes & Green Beans (lines 194-238)

**These are RE-PARSES** of existing recipes to add:
- `ingredients` array with quantities
- `hold_window_minutes` and `temporal_flexibility` fields

**For Recipe 5 (Steak)**: Also refer to the detailed chain structure notes in `FOR_SONNET_STEAK_REQUEST.md` if needed (Chain 1: Potatoes, Chain 2: Beans, Chain 3: Steak, Chain 4: Plating).

---

## Summary: You're Ready to Proceed! 🚀

**Instructions**:
1. Parse all 5 recipes from `REPARSE_REQUEST_5_RECIPES.md`
2. For each recipe, output complete JSON with:
   - ✅ `ingredients` array (from ingredients section at top)
   - ✅ `hold_window_minutes` + `temporal_flexibility` on every task
   - ✅ Emergent ingredients with `outputs` arrays
   - ✅ Proper chain structure and dependencies

3. **For missing verbs in hold window table**: Use default `hold_hours` (60min)
4. **For `cook` verb**: Use more specific verb (`boil`, `simmer`, `bake`) or flag as missing
5. **For multi-stage emergent ingredients**: Always use base ingredient in `inputs`

**Output format**: 5 separate JSON objects (one per recipe), each ready to save as `.json` files.

Let me know if any other questions come up! 🎯
