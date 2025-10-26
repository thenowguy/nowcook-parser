#!/bin/bash
# Sync Sonnet recipes between public/meals/ (editor) and src/meals/ (app)
# Run this after editing recipes in /editor.html

echo "Syncing Sonnet recipes from public/meals/ to src/meals/..."

cp public/meals/01-spaghetti-bolognese.json src/meals/sonnet-bolognese-v2.json
cp public/meals/02-chicken-veg-stir-fry.json src/meals/sonnet-chicken-stir-fry-v2.json
cp public/meals/03-sheet-pan-salmon.json src/meals/sonnet-sheet-pan-salmon-v2.json
cp public/meals/05-chocolate-chip-cookies.json src/meals/sonnet-chocolate-chip-cookies-v2.json
cp public/meals/06-seared-steak-dinner.json src/meals/sonnet-steak-dinner.json

echo "✅ Sync complete! App will now use the updated recipes."
