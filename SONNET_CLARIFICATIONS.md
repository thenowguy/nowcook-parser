# Answers to Sonnet's Questions

## Question 1: Emergent Ingredient Naming

**Should I infer IDs like `tempered_steak`, `minced_garlic_001`, `minced_garlic_002`? Or use a specific format?**

### Answer: Use Simple Descriptive Names (NO _001 suffixes needed)

**Format**: `{state}_{ingredient}` (e.g., `tempered_steak`, `minced_garlic`, `blanched_beans`)

**Special case for duplicate ingredients in different chains**:
When you have TWO "mince garlic" tasks (one for potatoes, one for beans), use the **same emergent ingredient name** but they'll be **separate instances** because they're in different chains and used at different times.

**Example**:
```json
// Chain 1: Potatoes
{
  "id": "chain_1/step_3",
  "name": "Mince garlic for mashed potatoes",
  "outputs": [
    { "ingredient": "garlic", "state": "minced", "emergent": true }
  ]
}

// Chain 2: Beans (DIFFERENT chain, DIFFERENT time)
{
  "id": "chain_2/step_5",
  "name": "Mince garlic for sautéed beans",
  "outputs": [
    { "ingredient": "garlic", "state": "minced", "emergent": true }
  ]
}
```

**The system will understand they're separate** because:
- They're in different chains
- They have different task IDs
- The consuming tasks reference the specific task ID in edges

**DO NOT use _001, _002 suffixes** - the task ID and chain context already make them unique.

---

## Question 2: When to Add Outputs

**Should I add outputs for EVERY task that transforms ingredients, or only when it's semantically important for dependency tracking?**

### Answer: Only When Semantically Important for Dependencies

**ADD outputs when**:
✅ Another task will explicitly USE this transformed ingredient
✅ The state change matters for timing/dependencies
✅ The item can be prepared in advance (flexible prep)

**Example - DO add output**:
```json
// Task 1: Creates emergent
{
  "name": "Temper steak to room temperature",
  "outputs": [
    { "ingredient": "steak", "state": "tempered", "emergent": true }
  ]
}

// Task 2: USES the emergent
{
  "name": "Season tempered steak with salt and pepper",
  "inputs": ["steak"],  // Uses the tempered steak
  "edges": [{ "from": "temper_task", "to": "season_task", "type": "FS" }]
}
```

**DON'T add outputs when**:
❌ The transformation is immediate and consumed in the next step with no flexibility
❌ It's an assembly action that doesn't create a "keepable" intermediate
❌ It's equipment setup or final plating

**Example - DON'T add output**:
```json
// These don't need outputs:
{
  "name": "Heat cast iron skillet until smoking",
  "outputs": []  // Equipment setup, not an ingredient transformation
}

{
  "name": "Plate steak, potatoes, and beans",
  "outputs": []  // Final assembly, no further use
}
```

**Rule of thumb**: If someone could prepare this step HOURS in advance and store it, it's probably an emergent ingredient.

---

## Question 3: Hold Windows

**Should I specify hold windows in the JSON, or does the system infer them from the ontology?**

### Answer: DON'T Specify - System Infers Automatically

**You should NOT include hold windows in your JSON.** The system will automatically add them based on:
1. The emergent ingredient ontology ([emergent-ingredients.json](../src/ontology/emergent-ingredients.json))
2. The verb's temporal flexibility ([verbs.json](../src/ontology/verbs.json))

**What you provide**:
```json
{
  "id": "chain_2/step_4",
  "name": "Shock beans in ice water",
  "canonical_verb": "shock",
  "outputs": [
    { "ingredient": "green_beans", "state": "shocked", "emergent": true }
  ],
  "edges": [
    { "from": "chain_2/step_3", "to": "chain_2/step_4", "type": "FS" }
  ]
}
```

**What the parser will auto-add** (you don't do this):
```json
{
  "edges": [
    {
      "from": "chain_2/step_3",
      "to": "chain_2/step_4",
      "type": "FS",
      "constraint": "FLEXIBLE",              // ← Parser adds this
      "hold_window_minutes": 1440,           // ← Parser adds this (24 hours)
      "temporal_flexibility": "hold_hours",  // ← Parser adds this
      "emergent_ingredient": "shocked_beans" // ← Parser adds this
    }
  ]
}
```

**Your job**: Just specify the emergent ingredient in `outputs`. The system handles the rest.

---

## Summary: What Sonnet Should Do

### ✅ DO:
1. **Use simple names**: `tempered_steak`, `minced_garlic`, `blanched_beans` (NO _001 suffixes)
2. **Add outputs only for meaningful transformations** that create "keepable" intermediates
3. **Trust the system** to infer hold windows - don't specify them yourself

### ❌ DON'T:
1. Don't use numbered suffixes (_001, _002) - chain context makes them unique
2. Don't add outputs for equipment setup or final plating
3. Don't specify hold_window_minutes or constraint in edges - system adds automatically

---

## Example: Complete Task with Emergent Output

```json
{
  "id": "chain_3/step_1",
  "name": "Remove steak from refrigerator and let come to room temperature (temper)",
  "canonical_verb": "rest",
  "planned_min": 20,
  "requires_driver": false,
  "self_running_after_start": false,
  "inputs": ["steak"],
  "outputs": [
    {
      "ingredient": "steak",
      "state": "tempered",
      "emergent": true
    }
  ],
  "equipment": [],
  "edges": []
}
```

**That's it!** Clean, simple, and the system will enrich it with hold window metadata automatically.

---

Ready to parse! 🚀
