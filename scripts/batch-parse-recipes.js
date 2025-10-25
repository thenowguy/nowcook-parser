#!/usr/bin/env node

/**
 * Batch Parse Narrative Recipes
 *
 * Parses all narrative recipes through the new parser system with:
 * - Semantic chain detection
 * - Emergent ingredient hold windows
 * - Ingredient prep extraction
 * - FLEXIBLE/RIGID constraints
 *
 * Usage: node scripts/batch-parse-recipes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseRecipe } from '../src/parser/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECIPES_DIR = path.join(__dirname, '../recipes/narrative');
const OUTPUT_DIR = path.join(__dirname, '../public/meals');

// Recipe metadata
const RECIPES = [
  {
    file: '01-spaghetti-bolognese.txt',
    title: 'Spaghetti Bolognese',
    author: 'RecipeTin Eats',
    serves: 4,
    tags: ['pasta', 'italian', 'beef']
  },
  {
    file: '02-chicken-veg-stir-fry.txt',
    title: 'Chicken & Veg Stir-Fry',
    author: 'Jamie Oliver',
    serves: 2,
    tags: ['chicken', 'stir-fry', 'asian', 'noodles']
  },
  {
    file: '03-sheet-pan-salmon.txt',
    title: 'Sheet Pan Salmon with Vegetables',
    author: 'The Mediterranean Dish',
    serves: 4,
    tags: ['salmon', 'fish', 'vegetables', 'mediterranean']
  },
  {
    file: '04-fish-tacos.txt',
    title: 'Fish Tacos',
    author: "Natasha's Kitchen",
    serves: 8,
    tags: ['fish', 'tacos', 'mexican']
  },
  {
    file: '05-chocolate-chip-cookies.txt',
    title: 'Chocolate Chip Cookies',
    author: 'Love and Lemons',
    serves: 24,
    tags: ['dessert', 'cookies', 'baking']
  }
];

async function parseAllRecipes() {
  console.log('🔄 Batch Parsing Narrative Recipes...\n');

  const results = [];

  for (const recipe of RECIPES) {
    const recipePath = path.join(RECIPES_DIR, recipe.file);

    console.log(`\n📖 Parsing: ${recipe.title}`);
    console.log(`   Source: ${recipe.author}`);

    try {
      // Read recipe text
      const rawText = fs.readFileSync(recipePath, 'utf-8');

      // Parse with new system
      const parsed = await parseRecipe(rawText, recipe.title, {
        autoDependencies: false,
        detectTaskChains: true,
        useSemanticChains: true  // Use two-phase hybrid approach
      });

      // Add metadata
      parsed.author = { name: recipe.author };
      parsed.serves = recipe.serves;
      parsed.tags = recipe.tags;

      // Stats
      const taskCount = parsed.tasks.length;
      const chainCount = parsed.chains?.length || 0;
      const flexibleEdges = parsed.tasks.reduce((sum, t) =>
        sum + (t.edges?.filter(e => e.constraint === 'FLEXIBLE').length || 0), 0);
      const rigidEdges = parsed.tasks.reduce((sum, t) =>
        sum + (t.edges?.filter(e => e.constraint === 'RIGID').length || 0), 0);
      const emergentIngredients = parsed.tasks.reduce((sum, t) =>
        sum + (t.edges?.filter(e => e.emergent_ingredient).length || 0), 0);

      console.log(`   ✅ Parsed: ${taskCount} tasks, ${chainCount} chains`);
      console.log(`   🔗 Edges: ${flexibleEdges} FLEXIBLE, ${rigidEdges} RIGID`);
      console.log(`   🌱 Emergent ingredients: ${emergentIngredients} detected`);

      // Save to file
      const outputFile = recipe.file.replace('.txt', '.json');
      const outputPath = path.join(OUTPUT_DIR, outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));

      console.log(`   💾 Saved: ${outputFile}`);

      results.push({
        recipe: recipe.title,
        success: true,
        stats: { taskCount, chainCount, flexibleEdges, rigidEdges, emergentIngredients }
      });

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        recipe: recipe.title,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n\n📊 Batch Parse Summary:');
  console.log('═'.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${RECIPES.length}`);
  console.log(`❌ Failed: ${failed.length}/${RECIPES.length}`);

  if (successful.length > 0) {
    console.log('\n📈 Statistics:');
    const totalTasks = successful.reduce((sum, r) => sum + r.stats.taskCount, 0);
    const totalChains = successful.reduce((sum, r) => sum + r.stats.chainCount, 0);
    const totalFlexible = successful.reduce((sum, r) => sum + r.stats.flexibleEdges, 0);
    const totalRigid = successful.reduce((sum, r) => sum + r.stats.rigidEdges, 0);
    const totalEmergent = successful.reduce((sum, r) => sum + r.stats.emergentIngredients, 0);

    console.log(`   Total tasks: ${totalTasks}`);
    console.log(`   Total chains: ${totalChains}`);
    console.log(`   FLEXIBLE edges: ${totalFlexible}`);
    console.log(`   RIGID edges: ${totalRigid}`);
    console.log(`   Emergent ingredients detected: ${totalEmergent}`);
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed recipes:');
    failed.forEach(f => {
      console.log(`   - ${f.recipe}: ${f.error}`);
    });
  }

  console.log('\n✨ Done!\n');
}

// Run
parseAllRecipes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
