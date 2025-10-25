# Human API Bridge - Quick Reference

## What This Is
You act as a "human API call" between:
- **Claude Sonnet** (semantic AI - reads recipes, understands structure)
- **Claude Code** (file access - validates JSON, manages repo)

## Workflow

### Step 1: Give Sonnet Instructions
Share [FOR_SONNET.md](FOR_SONNET.md) with Claude Sonnet in your other chat session.

**Say to Sonnet**:
```
Read FOR_SONNET.md and use it as your guide for parsing recipes.
I'll provide narrative recipe text, you output JSON.
```

### Step 2: Give Sonnet a Recipe
Paste narrative recipe text from the `/recipes` folder (or any source).

**Example**:
```
Here's a recipe to parse:

[paste Chicken Stir Fry recipe text]
```

### Step 3: Relay Sonnet's JSON to Claude Code
Copy Sonnet's JSON output and paste it to me (Claude Code) with:
```
From Sonnet:

[paste JSON here]
```

I will:
1. Save it to a file
2. Validate against schema
3. Provide detailed feedback

### Step 4: Relay Feedback Back to Sonnet
If I find issues, copy my feedback and paste it to Sonnet.

Sonnet will revise and send corrected JSON.

### Step 5: Accumulate Missing Verbs
After each recipe, Sonnet will flag missing verbs like:
```
Missing Verbs Flagged:
- "taste": attended, 1min, serve_immediate
- "adjust_heat": attended, 1min, serve_immediate
```

Keep a running list. After 3-5 recipes, give the list to me (Claude Code) and I'll add them to verbs.json in one batch.

### Step 6: Repeat
Continue with more recipes. The pattern is:
```
You → Sonnet: Recipe text
Sonnet → You: JSON + flags
You → Claude Code: JSON
Claude Code → You: Validation result
You → Sonnet: Feedback (if needed)
```

---

## Current Status

### ✅ Validated Recipes:
1. **test-sonnet-output.json** - Simple pasta chain (4 tasks, 1 chain) - VALID
2. **sonnet-bolognese.json** - Spaghetti Bolognese (19 tasks, 3 chains) - VALID

### 📋 Missing Verbs Accumulated So Far:
- `adjust_heat` → Sonnet used this, should use `increase_heat` or `reduce_heat`
- `taste` → Not in verbs.json (attended, 1min, serve_immediate)
- `serve` → Sonnet used this, should use `plate`
- `heat` (generic) → Not in verbs.json (attended, 3min, hold_minutes)
- `cook` (generic) → Not in verbs.json (needs classification: attended vs SRAS depending on context)

---

## Files Reference

### For Sonnet:
- **[FOR_SONNET.md](FOR_SONNET.md)** - Complete instructions + verbs list

### For You:
- **This file** - Quick workflow reference
- **[CLAUDE.md](CLAUDE.md)** - Full project documentation

### Recipe Sources:
- `/recipes/*.txt` - Narrative recipe files
- `sonnet-*.json` - Parsed JSON outputs (working area)
- `src/meals/*.json` - Production recipes (5 existing, working)

---

## Tips

### When Sonnet Makes Mistakes:
Be specific with feedback. Example:
```
From Claude Code:

Your JSON has these issues:
1. chain_2/step_5 references chain_1/step_10 in edges, but chain_1 only has 9 steps
2. "canonical_verb": "heat" is not in verbs.json - use "heat_oil" instead
3. Task durations look good

Please revise.
```

### When Everything Works:
```
From Claude Code:

✅ VALID! Your JSON passes all checks.
Ready to add to production.

Missing verbs you flagged have been noted.
```

### Batching Verbs:
After 3-5 recipes, consolidate missing verbs and say to me:
```
Please add these verbs to verbs.json:

1. "taste": attended, 1min, serve_immediate
2. "adjust_heat": attended, 1min, serve_immediate
3. "heat": attended, 3min, hold_minutes
4. "cook": needs context - sometimes attended, sometimes SRAS
```

I'll discuss each one with you, then add them properly to the ontology.

---

## Why This Works

**Claude Sonnet strengths**:
- Semantic understanding of narrative recipes
- Logical chain detection
- Atomic task extraction
- Cross-chain dependency inference

**Claude Code strengths**:
- File system access
- JSON schema validation
- Git operations
- Ontology management

**Your role**:
- Bridge the gap between semantic AI and file operations
- Quality control checkpoint
- Decision-making on ontology additions

**Result**: High-quality parsed recipes without expensive API calls or server infrastructure.

---

## Next Steps

1. Share FOR_SONNET.md with Sonnet
2. Pick next recipe from `/recipes` folder
3. Start the workflow!
4. After 3-5 recipes, we'll batch-add missing verbs to verbs.json
5. Share updated verbs.json with Sonnet for next batch

Happy parsing! 🎉
