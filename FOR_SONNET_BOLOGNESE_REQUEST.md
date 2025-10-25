# Parsing Request: Spaghetti Bolognese with Emergent Ingredients

## Context

You previously parsed this Spaghetti Bolognese recipe and produced excellent task/chain structure. Now we need to **add emergent ingredients** to unlock the hold window system and proper temporal dependencies.

## Your Previous Parse (Current State)

- **19 tasks, 3 chains**
- ✅ Chain detection: PERFECT ("Make the Bolognese Sauce", "Cook the Spaghetti", "Assemble and Serve")
- ✅ Verb canonicalization: EXCELLENT (all verbs match ontology)
- ✅ Dependencies: GOOD structural edges
- ❌ Missing: Emergent ingredient outputs (needed for hold windows)

## Task: Add Emergent Ingredients

Please **update your existing JSON** by adding `outputs` arrays with emergent ingredients where semantically appropriate.

### Key Emergent Ingredients to Add

Based on your existing tasks, here are the critical emergent ingredients this recipe needs:

#### Chain 1: Make the Bolognese Sauce
1. **Task: "Add the onion and garlic"** (chain_1/step_2)
   - Inputs include "onion" and "garlic" but these should be MINCED/CHOPPED
   - Missing prep task! See "Missing Prep Work" section below

2. **Task: "Cook until light golden and softened"** (chain_1/step_3)
   - Output: `{ "ingredient": "aromatics", "state": "softened", "emergent": true }`
   - This is sautéed onion/garlic base - holds for hours

3. **Task: "Cook until browned"** (chain_1/step_6)
   - Output: `{ "ingredient": "beef", "state": "browned", "emergent": true }`
   - Browned meat - holds for hours

4. **Task: "Cook uncovered for twenty to thirty minutes"** (chain_1/step_13)
   - Output: `{ "ingredient": "bolognese_sauce", "state": "simmered", "emergent": true }`
   - The finished sauce - this is the main output of Chain 1!
   - Holds for DAYS (this is the whole point - sauce can be made ahead)

#### Chain 2: Cook the Spaghetti
5. **Task: "Drain the spaghetti"** (chain_2/step_4)
   - Output: `{ "ingredient": "spaghetti", "state": "cooked", "emergent": true }`
   - serve_immediate! Must be used within minutes

#### Chain 3: Assemble and Serve
6. **Task: "Serve the sauce over the cooked spaghetti"** (chain_3/step_2)
   - Inputs: `bolognese_sauce` and `cooked_spaghetti` (emergent ingredients from previous chains)
   - This task MUST have FS edges to:
     - chain_1/step_13 (for bolognese_sauce)
     - chain_2/step_4 (for cooked_spaghetti)

### Missing Prep Work (IMPORTANT!)

Your current parse assumes "onion and garlic" are already prepped. Recipe text likely said "1 onion, finely diced" and "3 cloves garlic, minced".

**Add Chain 0: Prep Work** with these tasks:

```json
{
  "id": "chain_0/step_1",
  "name": "Dice the onion",
  "canonical_verb": "dice",
  "planned_min": 3,
  "requires_driver": true,
  "self_running_after_start": false,
  "inputs": ["onion"],
  "outputs": [
    {
      "ingredient": "onion",
      "state": "diced",
      "emergent": true
    }
  ],
  "equipment": ["knife", "cutting_board"],
  "edges": []
}
```

```json
{
  "id": "chain_0/step_2",
  "name": "Mince the garlic",
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

Then update **chain_1/step_2** ("Add the onion and garlic") to require these:
```json
{
  "id": "chain_1/step_2",
  "name": "Add the diced onion and minced garlic to the pot",
  "canonical_verb": "add",
  "planned_min": 1,
  "requires_driver": true,
  "self_running_after_start": false,
  "inputs": ["diced_onion", "minced_garlic"],  // Using emergent ingredients
  "outputs": [],
  "equipment": ["pot"],
  "edges": [
    { "from": "chain_1/step_1", "to": "chain_1/step_2", "type": "FS" },
    { "from": "chain_0/step_1", "to": "chain_1/step_2", "type": "FS" },  // NEW
    { "from": "chain_0/step_2", "to": "chain_1/step_2", "type": "FS" }   // NEW
  ]
}
```

### Chain Renumbering

After adding Chain 0, renumber existing chains:
- Chain 0: Prep Work (NEW)
- Chain 1 → Chain 2: Make the Bolognese Sauce
- Chain 2 → Chain 3: Cook the Spaghetti
- Chain 3 → Chain 4: Assemble and Serve

Update all task IDs accordingly (chain_1/step_X → chain_2/step_X, etc.)

## Important Guidelines

1. **Simple names**: Use `bolognese_sauce` NOT `bolognese_sauce_001`
2. **Only semantically important outputs**: Don't add outputs for every task - only when:
   - Another task explicitly needs it as input
   - It can be prepped hours/days in advance
   - It represents a meaningful transformation
3. **State descriptors**: Use past tense (softened, browned, simmered, cooked, diced, minced)
4. **DON'T specify hold windows**: System infers from verb ontology automatically

## Expected Result

Updated JSON with:
- **Chain 0**: Prep Work (dice onion, mince garlic)
- **Chain 2**: Sauce with emergent outputs (softened_aromatics, browned_beef, bolognese_sauce)
- **Chain 3**: Pasta with emergent output (cooked_spaghetti)
- **Chain 4**: Assembly with proper FS edges to emergent ingredients
- All chains renumbered correctly
- All task IDs updated (chain_1 → chain_2, etc.)

## What We'll Do With This

1. Validate against schema (should pass with object-format outputs)
2. Add to Alpha app for testing
3. Parser will automatically enrich edges with hold window metadata
4. Runtime will evaluate hold window expiration (e.g., pasta must be used quickly, sauce can wait days)

Please provide the complete updated JSON. Thank you!
