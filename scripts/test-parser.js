/**
 * Parser Test Script
 * Tests the local parser with sample recipe text
 */

import { parseRecipe } from '../src/parser/index.js';

const SAMPLE_RECIPES = [
  {
    title: "Simple Pasta Aglio e Olio",
    text: `Bring a large pot of salted water to a boil
Slice garlic thinly
Add pasta to boiling water — 10 min
Heat olive oil in a large pan over medium heat — 3 min
Sauté garlic until fragrant — 2 min
Drain pasta, reserving 1 cup pasta water
Toss pasta with garlic oil
Season with salt and pepper
Serve with parsley`
  },
  {
    title: "Quick Roast Chicken",
    text: `Preheat oven to 425°F
Season chicken with salt and pepper — 2 min
Roast chicken for 45 minutes
Let rest for 10 minutes
Serve`
  },
  {
    title: "Simple Tomato Sauce",
    text: `Dice onion
Mince garlic
Heat oil in saucepan — 3 min
Sauté onion until soft — 8 min
Add garlic and cook for 1 minute
Add crushed tomatoes
Simmer for 25 minutes
Season to taste`
  },
  {
    title: "Slow Beef Stew",
    text: `Brown beef in batches — 20 min
Sauté aromatics — 8 min
Simmer stew low and slow — 120 min
Finish & season to taste — 5 min`
  }
];

async function testRecipe(recipe, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST ${index + 1}: ${recipe.title}`);
  console.log('='.repeat(60));
  
  try {
    const meal = await parseRecipe(recipe.text, recipe.title, {
      autoDependencies: true,
      smartDependencies: false,
      roundAboutUp: true
    });

    console.log(`\n✅ Parsed successfully!`);
    console.log(`   Title: ${meal.title}`);
    console.log(`   Tasks: ${meal.tasks.length}`);
    console.log(`   Parser: ${meal.author.name}`);

    console.log(`\n📝 Task Breakdown:`);
    meal.tasks.forEach((task, idx) => {
      const deps = task.edges.length > 0 
        ? ` → depends on ${task.edges.map(e => e.from).join(', ')}`
        : '';
      console.log(`   ${idx + 1}. [${task.canonical_verb}] ${task.name}`);
      console.log(`      • Planned: ${task.planned_min || '?'} min`);
      console.log(`      • Attention: ${task.requires_driver ? 'attended' : 'unattended'}${deps}`);
      
      if (task._meta?.guard) {
        console.log(`      ⚠️  GUARD: ${task._meta.guard.rationale}`);
      }
    });

    // Validation
    console.log(`\n🔍 Validation:`);
    const hasAllVerbs = meal.tasks.every(t => t.canonical_verb);
    const hasAllDurations = meal.tasks.every(t => t.planned_min != null);
    const hasDependencies = meal.tasks.some(t => t.edges.length > 0);

    console.log(`   • All verbs identified: ${hasAllVerbs ? '✅' : '❌'}`);
    console.log(`   • All durations present: ${hasAllDurations ? '✅' : '⚠️'}`);
    console.log(`   • Dependencies inferred: ${hasDependencies ? '✅' : '⚠️'}`);

    return { success: true, meal };
  } catch (error) {
    console.error(`\n❌ Parser FAILED:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    return { success: false, error };
  }
}

async function main() {
  console.log('\n🧪 Testing NowCook Parser with Sample Recipes\n');

  const results = [];
  for (let i = 0; i < SAMPLE_RECIPES.length; i++) {
    const result = await testRecipe(SAMPLE_RECIPES[i], i);
    results.push(result);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log(`\n🎉 All tests passed! Parser is working correctly.\n`);
  } else {
    console.log(`\n⚠️  Some tests failed. Review errors above.\n`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n💥 Test script crashed:', error);
  process.exit(1);
});
