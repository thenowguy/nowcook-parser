# Parsing Request: Chicken Stir-Fry with Emergent Ingredients

## Context

You previously parsed this Chicken & Veg Stir-Fry recipe and produced excellent task/chain structure. Now we need to **add emergent ingredients** to unlock the hold window system and proper temporal dependencies.

## Your Previous Parse (Current State)

- **28 tasks, 4 chains**
- ✅ Chain detection: PERFECT ("Prepare Ingredients", "Stir-Fry the Chicken and Vegetables", "Cook the Noodles", "Combine and Serve")
- ✅ Verb canonicalization: EXCELLENT (all verbs match ontology)
- ✅ Extensive prep chain: GREAT (12 prep tasks showing all the chopping/slicing)
- ❌ Missing: Emergent ingredient outputs (needed for hold windows)

## Task: Add Emergent Ingredients

Please **update your existing JSON** by adding `outputs` arrays with emergent ingredients where semantically appropriate.

### Key Emergent Ingredients to Add

Based on your existing tasks, here are the critical emergent ingredients this recipe needs:

#### Chain 1: Prepare Ingredients (Lots of Prep!)

All these prep tasks should output emergent ingredients:

1. **"Peel and finely chop the garlic"** (chain_1/step_1)
   - Output: `{ "ingredient": "garlic", "state": "minced", "emergent": true }`

2. **"Peel and finely chop the ginger"** (chain_1/step_2)
   - Output: `{ "ingredient": "ginger", "state": "minced", "emergent": true }`

3. **"Deseed and finely chop the chilli"** (chain_1/step_3)
   - Output: `{ "ingredient": "chilli", "state": "minced", "emergent": true }`

4. **"Halve the carrots lengthways and slice finely"** (chain_1/step_5)
   - Output: `{ "ingredient": "carrots", "state": "sliced", "emergent": true }`

5. **"Peel the onion and slice thinly"** (chain_1/step_6)
   - Output: `{ "ingredient": "onion", "state": "sliced", "emergent": true }`

6. **"Deseed the pepper and slice thinly"** (chain_1/step_7)
   - Output: `{ "ingredient": "pepper", "state": "sliced", "emergent": true }`

7. **"Halve any larger mushroom pieces"** (chain_1/step_10)
   - Output: `{ "ingredient": "mushrooms", "state": "trimmed", "emergent": true }`

8. **"Trim the broccoli and halve any thick stalks"** (chain_1/step_8)
   - Output: `{ "ingredient": "broccoli", "state": "trimmed", "emergent": true }`

9. **"Cut the chicken into 1cm strips"** (chain_1/step_11)
   - Output: `{ "ingredient": "chicken", "state": "sliced", "emergent": true }`

10. **"Coat the chicken strips with Chinese five-spice and sesame oil"** (chain_1/step_12)
    - Output: `{ "ingredient": "chicken", "state": "marinated", "emergent": true }`
    - This depends on sliced_chicken, so needs FS edge from step_11

#### Chain 2: Stir-Fry the Chicken and Vegetables

11. **"Stir-fry for 1-2 minutes until golden"** (chain_2/step_5)
    - Output: `{ "ingredient": "chicken", "state": "seared", "emergent": true }`
    - Seared chicken - holds for hours

12. **"Stir-fry for 3-4 minutes until chicken is cooked through"** (chain_2/step_7)
    - Output: `{ "ingredient": "stir_fry", "state": "cooked", "emergent": true }`
    - The finished stir-fry mixture - holds for 30-60 minutes

#### Chain 3: Cook the Noodles

13. **"Cook the noodles according to packet instructions"** (chain_3/step_3)
    - Output: `{ "ingredient": "noodles", "state": "cooked", "emergent": true }`
    - serve_immediate! Must be used within minutes

#### Chain 4: Combine and Serve

14. **"Transfer the noodles directly into the wok"** (chain_4/step_1)
    - Inputs should reference emergent ingredients:
      - `cooked_noodles` (from chain_3/step_3)
      - `stir_fry` (from chain_2/step_7)

### Important Dependencies

**chain_2/step_1** ("Heat wok with oil, garlic, ginger, chilli") currently has FS edges to:
- chain_1/step_1 (minced_garlic)
- chain_1/step_2 (minced_ginger)
- chain_1/step_3 (minced_chilli)

✅ This is CORRECT - the task requires the emergent ingredients

**chain_2/step_6** ("Add all vegetables") currently has FS edges to:
- chain_1/step_5 (sliced_carrots)
- chain_1/step_6 (sliced_onion)
- chain_1/step_7 (sliced_pepper)
- chain_1/step_8 (trimmed_broccoli)
- chain_1/step_10 (trimmed_mushrooms)

✅ This is CORRECT - waits for all prepped vegetables

**chain_2/step_4** ("Add the chicken") needs FS edge to:
- chain_1/step_12 (marinated_chicken) - already has this ✅

### Renaming Suggestion

Consider renaming **chain_1/step_12** for clarity:
- Current: "Coat the chicken strips with Chinese five-spice and sesame oil"
- Better: "Marinate the chicken strips with Chinese five-spice and sesame oil"
- Canonical verb stays `toss` but name is clearer

## Important Guidelines

1. **Simple names**: Use `minced_garlic` NOT `minced_garlic_001`
2. **Only semantically important outputs**: This recipe has lots of prep - ALL prep tasks should output emergent ingredients because they're all used later
3. **State descriptors**: Use past tense (minced, sliced, trimmed, marinated, seared, cooked)
4. **DON'T specify hold windows**: System infers from verb ontology automatically
5. **Parallel prep advantage**: All 12 prep tasks in Chain 1 have NO dependencies (except carrot step_5 needs step_4, mushroom step_10 needs step_9) - this means they can ALL be done in parallel or hours/days ahead!

## Expected Result

Updated JSON with:
- **Chain 1**: All prep tasks output emergent ingredients (minced garlic/ginger/chilli, sliced vegetables, marinated chicken)
- **Chain 2**: Stir-fry with emergent outputs (seared_chicken, stir_fry)
- **Chain 3**: Noodles with emergent output (cooked_noodles)
- **Chain 4**: Assembly with proper inputs referencing emergent ingredients
- All existing FS edges remain (they're already correct!)
- Task chain_1/step_12 potentially renamed to "Marinate..." for clarity

## What We'll Do With This

1. Validate against schema (should pass with object-format outputs)
2. Add to Alpha app for testing
3. Parser will automatically enrich edges with hold window metadata
4. Runtime will show this recipe has AMAZING flexibility - almost ALL prep can be done days ahead!

Please provide the complete updated JSON. Thank you!
