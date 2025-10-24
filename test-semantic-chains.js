/**
 * Test script for semantic chain detection
 * Tests Phase 1 of the two-phase hybrid parsing approach
 */

import { detectChainsSemanticly, formatChainAnalysis } from './src/parser/semanticChains.js';

// Mac & Cheese narrative recipe (from user)
const MAC_CHEESE_NARRATIVE = `
Ingredients
Kosher salt
1 pound elbow macaroni
4 cups milk
2 or 3 sprigs thyme
4 cloves garlic, smashed and divided
3 tablespoons unsalted butter
3 tablespoons all-purpose flour
5 1/2 cups shredded sharp white Cheddar
Freshly ground black pepper
1/4 cup chopped flat-leaf parsley
4 slices bacon, cut crosswise into thin strips
1 large onion, diced
2 garlic cloves, smashed
Leaves from 1/4 bunch fresh thyme

Directions
Bring a pot of salted water to a boil over high heat. Add the macaroni and cook for 8 to 9 minutes, until al dente. Drain.

Preheat the oven to 400 degrees F.

In a small saucepan heat the milk with the thyme sprigs and 2 garlic cloves. Melt the butter in a large, deep skillet over medium-high heat. Whisk in the flour and cook for about 1 minute, stirring constantly, to keep lumps from forming. Strain the solids out of the milk and whisk it into the butter and flour mixture. Continue to whisk vigorously, and cook until the mixture is nice and smooth. Stir in the 4 cups of the cheese and continue to cook and stir to melt the cheese. Season with salt and pepper. Add the cooked macaroni and the parsley and fold that all in to coat the macaroni with the cheese mixture.

Scrape into a 3-quart baking dish and sprinkle with the remaining 1 1/2 cups cheese. Bake for 30 minutes, or until hot and bubbly.

While that bakes, heat a saute pan. Add the bacon, render the fat and cook until crispy. Add onion, garlic and thyme leaves and cook for about 5 minutes to soften the onion. Season with salt and pepper.

To serve, scatter the bacon mixture over the mac and cheese. Use a big spoon to scoop out servings, making sure you get some of the smoking bacon mixture on each spoonful.
`;

async function testSemanticChainDetection() {
  console.log('🧪 Testing Semantic Chain Detection (Phase 1)\n');
  console.log('=' .repeat(60));

  // Debug: show sections
  const sections = MAC_CHEESE_NARRATIVE.split('\n\n').filter(s => s.trim().length > 0);
  console.log(`\n📄 Found ${sections.length} sections in recipe:`);
  sections.forEach((section, idx) => {
    const preview = section.substring(0, 60).replace(/\n/g, ' ');
    console.log(`  ${idx + 1}. ${preview}...`);
  });
  console.log('');

  try {
    const result = await detectChainsSemanticly(MAC_CHEESE_NARRATIVE, 'Mac & Cheese');

    // Format and display results
    const formatted = formatChainAnalysis(result);
    console.log(formatted);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY:');
    console.log(`Total chains detected: ${result.chains.length}`);
    console.log(`High-confidence chains: ${result.chains.filter(c => c.metadata.confidence === 'high').length}`);
    console.log(`Medium-confidence chains: ${result.chains.filter(c => c.metadata.confidence === 'medium').length}`);
    console.log(`Low-confidence chains: ${result.chains.filter(c => c.metadata.confidence === 'low').length}`);

    // Check for chain-level dependencies
    const chainsWithDeps = result.chains.filter(c => c.inputs.length > 0);
    console.log(`\nChains with dependencies: ${chainsWithDeps.length}`);
    chainsWithDeps.forEach(chain => {
      console.log(`  - ${chain.name} depends on ${chain.inputs.length} other chain(s)`);
    });

    // Check for parallel execution
    const parallelChains = result.chains.filter(c => c.temporal_marker && c.temporal_marker.includes('parallel'));
    console.log(`\nParallel chains detected: ${parallelChains.length}`);
    parallelChains.forEach(chain => {
      console.log(`  - ${chain.name} (${chain.temporal_marker})`);
    });

    console.log('\n✅ Semantic chain detection test complete!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

testSemanticChainDetection();
