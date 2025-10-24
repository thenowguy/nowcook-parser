/**
 * Test ingredient prep extraction
 */

import { extractIngredientPrep, createPrepChain } from './src/parser/ingredientPrep.js';

const testRecipe = `
Ingredients
Kosher salt
1 pound elbow macaroni
4 cloves garlic, smashed and divided
5 1/2 cups shredded sharp white Cheddar
2 tablespoons butter
3 tablespoons all-purpose flour
1 tablespoon powdered mustard
3 cups milk
1/2 medium onion, peeled and chopped
1 bay leaf
1/2 teaspoon paprika
8 slices bacon, diced
1 large onion, diced
Thyme sprigs

Directions
Bring a pot of salted water to a boil over high heat.
Add the macaroni and cook for 8 to 9 minutes, until al dente.
Drain.
`;

console.log('=== TESTING INGREDIENT PREP EXTRACTION ===\n');

const { ingredients, prepTasks } = extractIngredientPrep(testRecipe);

console.log(`Found ${prepTasks.length} embedded prep tasks:\n`);

prepTasks.forEach((task, idx) => {
  console.log(`${idx + 1}. ${task.description}`);
  console.log(`   Verb: ${task.canonical_verb}`);
  console.log(`   Duration: ${task.estimated_min} min`);
  console.log(`   Source: ${task.source_line}`);
  console.log('');
});

console.log('\n=== PREP CHAIN ===\n');
const prepChain = createPrepChain(prepTasks);
if (prepChain) {
  console.log(`Chain ID: ${prepChain.id}`);
  console.log(`Chain Name: ${prepChain.name}`);
  console.log(`Purpose: ${prepChain.purpose}`);
  console.log(`\nTasks (${prepChain.tasks.length}):`);
  prepChain.tasks.forEach((task, idx) => {
    console.log(`  ${idx + 1}. ${task}`);
  });
  console.log(`\nOutputs (${prepChain.outputs.length}):`);
  prepChain.outputs.forEach(out => {
    console.log(`  - ${out.emergent_id}: ${out.description}`);
  });
}
