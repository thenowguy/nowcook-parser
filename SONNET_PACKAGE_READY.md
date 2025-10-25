# Package Ready for Sonnet: 4 Recipe Updates

## Status: ✅ READY TO SEND

All parsing request documents have been created for adding emergent ingredients to 4 recipes.

---

## Package Contents

### Master Document (Start Here)
📄 **[FOR_SONNET_ALL_4_RECIPES.md](FOR_SONNET_ALL_4_RECIPES.md)**
- Overview of all 4 recipe updates
- Quick summary of changes needed
- Guidelines and conventions
- Reference to successful steak recipe

### Individual Recipe Requests (Detailed Instructions)

1. 📄 **[FOR_SONNET_BOLOGNESE_REQUEST.md](FOR_SONNET_BOLOGNESE_REQUEST.md)**
   - Add Chain 0: Prep Work (dice onion, mince garlic)
   - Add emergent outputs to sauce chain
   - 19 tasks → ~22 tasks

2. 📄 **[FOR_SONNET_STIR_FRY_REQUEST.md](FOR_SONNET_STIR_FRY_REQUEST.md)**
   - Add emergent outputs to ALL 12 prep tasks
   - Highlight parallel prep advantage
   - 28 tasks (no new tasks needed)

3. 📄 **[FOR_SONNET_SALMON_REQUEST.md](FOR_SONNET_SALMON_REQUEST.md)**
   - Add chain_3/step_0 for mincing garlic
   - Highlight spice_blend used in TWO places
   - 18 tasks → ~19 tasks

4. 📄 **[FOR_SONNET_COOKIES_REQUEST.md](FOR_SONNET_COOKIES_REQUEST.md)**
   - Add chain_2/step_0 for melting butter
   - Highlight cookie dough can be made days ahead
   - 17 tasks → ~18 tasks

### Supporting Context

📄 **[FOR_SONNET.md](FOR_SONNET.md)**
- Complete verb ontology (51 verbs)
- Emergent ingredients section
- All parsing guidelines

📄 **[SONNET_CLARIFICATIONS.md](SONNET_CLARIFICATIONS.md)**
- Answers to 3 previous questions about emergent ingredients
- Naming conventions (no _001 suffixes)
- When to add outputs
- Hold window inference

### Original Parsed JSONs (For Reference)

📄 **[sonnet-bolognese.json](sonnet-bolognese.json)** - Current state (no emergent ingredients)
📄 **[sonnet-chicken-stir-fry.json](sonnet-chicken-stir-fry.json)** - Current state
📄 **[sonnet-sheet-pan-salmon.json](sonnet-sheet-pan-salmon.json)** - Current state
📄 **[sonnet-chocolate-chip-cookies.json](sonnet-chocolate-chip-cookies.json)** - Current state

### Successful Example

📄 **[sonnet-steak-dinner.json](src/meals/sonnet-steak-dinner.json)** - ✅ WORKING IN PRODUCTION
- 19 tasks with 9 emergent ingredients
- Already validated and added to Alpha app
- User confirmed: "It seems flawless"

---

## What to Send to Sonnet

### Option A: Send Everything
Copy all 5 request documents to Sonnet in one conversation:
1. FOR_SONNET_ALL_4_RECIPES.md (master overview)
2. FOR_SONNET_BOLOGNESE_REQUEST.md
3. FOR_SONNET_STIR_FRY_REQUEST.md
4. FOR_SONNET_SALMON_REQUEST.md
5. FOR_SONNET_COOKIES_REQUEST.md

Plus FOR_SONNET.md and SONNET_CLARIFICATIONS.md as context.

### Option B: Send One at a Time
Start with FOR_SONNET_ALL_4_RECIPES.md and see if Sonnet needs the detailed requests or can work from the summary.

---

## Expected Deliverables from Sonnet

4 complete updated JSON files:

1. **sonnet-bolognese-v2.json** (~22 tasks, 4 chains)
   - Chain 0: Prep Work (NEW)
   - Chain 2: Make Bolognese Sauce (was Chain 1)
   - Chain 3: Cook Spaghetti (was Chain 2)
   - Chain 4: Assemble and Serve (was Chain 3)

2. **sonnet-chicken-stir-fry-v2.json** (28 tasks, 4 chains)
   - Chain 1: Prepare Ingredients (all 12 tasks now have emergent outputs)
   - Chain 2: Stir-Fry (emergent outputs added)
   - Chain 3: Cook Noodles (emergent output added)
   - Chain 4: Combine and Serve (inputs updated)

3. **sonnet-sheet-pan-salmon-v2.json** (~19 tasks, 7 chains)
   - Chain 3: Prepare Vegetables (NEW step_0 for mincing garlic)
   - All other chains: emergent outputs added
   - spice_blend used in TWO places

4. **sonnet-chocolate-chip-cookies-v2.json** (~18 tasks, 6 chains)
   - Chain 2: Mix Wet Ingredients (NEW step_0 for melting butter)
   - All chains: emergent outputs added
   - Highlights incredible hold window flexibility

---

## Validation Plan

Once Sonnet provides updated JSONs:

```bash
# Save JSONs to root directory
# Then validate
npm run validate -- sonnet-bolognese-v2.json
npm run validate -- sonnet-chicken-stir-fry-v2.json
npm run validate -- sonnet-sheet-pan-salmon-v2.json
npm run validate -- sonnet-chocolate-chip-cookies-v2.json
```

If all pass:
```bash
# Move to src/meals/
mv sonnet-*-v2.json src/meals/

# Add to src/data/meals.js
# Test in Alpha app at http://localhost:5173/
```

---

## Success Criteria

✅ All 4 JSONs validate against schema
✅ All emergent ingredients have proper format
✅ All FS edges to emergent ingredient producers exist
✅ Missing prep tasks added (mince garlic, melt butter, dice onion)
✅ Chain renumbering correct where applicable
✅ Test in Alpha app shows proper "Can Do Now" behavior
✅ Hold windows work correctly (sauce can wait days, pasta must be used immediately)

---

## Timeline Estimate

- **Sonnet parsing**: ~30-60 minutes (all 4 recipes)
- **Validation**: ~5 minutes
- **Add to Alpha app**: ~10 minutes
- **Testing**: ~15 minutes per recipe

**Total**: ~2 hours from request to fully tested recipes in production

---

## Notes

- Schema already updated to accept object format for outputs ✅
- Steak recipe proved the pattern works perfectly ✅
- All 51 verbs in ontology are known to Sonnet ✅
- Emergent ingredients guidelines documented in FOR_SONNET.md ✅
- No surprises expected - this is a straightforward update ✅

**Ready to send! 🚀**
