/**
 * Ontology Validation Script
 * Validates all ontology JSON files for correctness
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ONTOLOGY_DIR = path.join(__dirname, '../src/ontology');

const FILES_TO_VALIDATE = [
  'verbs.json',
  'parameters.json',
  'ingredients.json',
  'patterns.json',
  'guards.json'
];

let errorCount = 0;
let warningCount = 0;

function logError(file, message) {
  console.error(`❌ [${file}] ERROR: ${message}`);
  errorCount++;
}

function logWarning(file, message) {
  console.warn(`⚠️  [${file}] WARNING: ${message}`);
  warningCount++;
}

function logSuccess(file, message) {
  console.log(`✅ [${file}] ${message}`);
}

/**
 * Validate JSON syntax and basic structure
 */
function validateFile(filename) {
  const filePath = path.join(ONTOLOGY_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    logError(filename, `File not found at ${filePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    logSuccess(filename, 'Valid JSON syntax');
    return json;
  } catch (error) {
    logError(filename, `JSON parse error: ${error.message}`);
    return null;
  }
}

/**
 * Validate verbs.json structure
 */
function validateVerbs(data) {
  if (!data) return;

  const filename = 'verbs.json';
  
  if (!data.verbs || !Array.isArray(data.verbs)) {
    logError(filename, 'Missing or invalid "verbs" array');
    return;
  }

  const canonNames = new Set();
  
  data.verbs.forEach((verb, index) => {
    const id = `verb[${index}]`;
    
    // Check required fields
    if (!verb.canon) {
      logError(filename, `${id} missing "canon" field`);
    } else if (canonNames.has(verb.canon)) {
      logError(filename, `Duplicate canon name: "${verb.canon}"`);
    } else {
      canonNames.add(verb.canon);
    }

    if (!verb.attention) {
      logError(filename, `${id} (${verb.canon}) missing "attention" field`);
    } else if (!['attended', 'unattended_after_start', 'unattended'].includes(verb.attention)) {
      logError(filename, `${id} (${verb.canon}) invalid attention value: "${verb.attention}"`);
    }

    if (!verb.patterns || !Array.isArray(verb.patterns)) {
      logWarning(filename, `${id} (${verb.canon}) missing or invalid "patterns"`);
    } else {
      // Validate regex patterns
      verb.patterns.forEach((pattern, pIndex) => {
        try {
          new RegExp(pattern, 'i');
        } catch (error) {
          logError(filename, `${id} (${verb.canon}) pattern[${pIndex}] invalid regex: ${pattern}`);
        }
      });
    }

    if (!verb.defaults || typeof verb.defaults !== 'object') {
      logWarning(filename, `${id} (${verb.canon}) missing "defaults"`);
    } else if (!verb.defaults.planned_min) {
      logWarning(filename, `${id} (${verb.canon}) missing defaults.planned_min`);
    }
  });

  logSuccess(filename, `Validated ${data.verbs.length} verbs`);
}

/**
 * Validate parameters.json structure
 */
function validateParameters(data) {
  if (!data) return;

  const filename = 'parameters.json';
  
  if (!data.parameters || typeof data.parameters !== 'object') {
    logError(filename, 'Missing or invalid "parameters" object');
    return;
  }

  const paramCount = Object.keys(data.parameters).length;
  
  Object.entries(data.parameters).forEach(([name, param]) => {
    if (!param.type) {
      logError(filename, `Parameter "${name}" missing "type"`);
    } else if (!['enum', 'range', 'boolean', 'array'].includes(param.type)) {
      logError(filename, `Parameter "${name}" invalid type: "${param.type}"`);
    }

    if (param.type === 'enum' && !param.allowed_values) {
      logError(filename, `Parameter "${name}" (enum) missing "allowed_values"`);
    }

    if (param.type === 'range' && (param.min === undefined || param.max === undefined)) {
      logError(filename, `Parameter "${name}" (range) missing min/max`);
    }

    if (!param.verbs) {
      logWarning(filename, `Parameter "${name}" missing "verbs" array`);
    }
  });

  logSuccess(filename, `Validated ${paramCount} parameters`);
}

/**
 * Validate ingredients.json structure
 */
function validateIngredients(data) {
  if (!data) return;

  const filename = 'ingredients.json';
  
  if (!data.ingredients || typeof data.ingredients !== 'object') {
    logError(filename, 'Missing or invalid "ingredients" object');
    return;
  }

  const ingredientCount = Object.keys(data.ingredients).length;
  
  Object.entries(data.ingredients).forEach(([name, ingredient]) => {
    if (!ingredient.classes || !Array.isArray(ingredient.classes)) {
      logWarning(filename, `Ingredient "${name}" missing "classes"`);
    }

    if (!ingredient.compatible_verbs || !Array.isArray(ingredient.compatible_verbs)) {
      logWarning(filename, `Ingredient "${name}" missing "compatible_verbs"`);
    }
  });

  logSuccess(filename, `Validated ${ingredientCount} ingredients`);
}

/**
 * Validate patterns.json structure
 */
function validatePatterns(data) {
  if (!data) return;

  const filename = 'patterns.json';
  
  if (!data.patterns || !Array.isArray(data.patterns)) {
    logError(filename, 'Missing or invalid "patterns" array');
    return;
  }

  data.patterns.forEach((pattern, index) => {
    const id = `pattern[${index}]`;
    
    if (!pattern.pattern) {
      logWarning(filename, `${id} missing "pattern" field`);
    } else {
      // Validate regex
      try {
        new RegExp(pattern.pattern, 'i');
      } catch (error) {
        logError(filename, `${id} invalid regex: ${pattern.pattern}`);
      }
    }

    if (!pattern.canonical_verb && !pattern.readiness_cue && !pattern.note) {
      logWarning(filename, `${id} has no action (no canonical_verb, readiness_cue, or note)`);
    }
  });

  logSuccess(filename, `Validated ${data.patterns.length} patterns`);
}

/**
 * Validate guards.json structure
 */
function validateGuards(data) {
  if (!data) return;

  const filename = 'guards.json';
  
  if (!data.guards || !Array.isArray(data.guards)) {
    logError(filename, 'Missing or invalid "guards" array');
    return;
  }

  const guardIds = new Set();

  data.guards.forEach((guard, index) => {
    const id = `guard[${index}]`;
    
    if (!guard.id) {
      logError(filename, `${id} missing "id" field`);
    } else if (guardIds.has(guard.id)) {
      logError(filename, `Duplicate guard ID: "${guard.id}"`);
    } else {
      guardIds.add(guard.id);
    }

    if (!guard.trigger) {
      logError(filename, `${id} (${guard.id}) missing "trigger"`);
    }

    if (!guard.rationale) {
      logWarning(filename, `${id} (${guard.id}) missing "rationale"`);
    }

    if (!guard.severity) {
      logWarning(filename, `${id} (${guard.id}) missing "severity"`);
    } else if (!['critical', 'warning', 'caution', 'info', 'myth', 'technique'].includes(guard.severity)) {
      logError(filename, `${id} (${guard.id}) invalid severity: "${guard.severity}"`);
    }
  });

  logSuccess(filename, `Validated ${data.guards.length} guards`);
}

/**
 * Main validation
 */
async function main() {
  console.log('\n🔍 Validating NowCook Ontology...\n');

  const verbsData = validateFile('verbs.json');
  const paramsData = validateFile('parameters.json');
  const ingredientsData = validateFile('ingredients.json');
  const patternsData = validateFile('patterns.json');
  const guardsData = validateFile('guards.json');

  console.log('\n📊 Running Structure Validation...\n');

  validateVerbs(verbsData);
  validateParameters(paramsData);
  validateIngredients(ingredientsData);
  validatePatterns(patternsData);
  validateGuards(guardsData);

  // Summary
  console.log('\n' + '='.repeat(50));
  if (errorCount === 0 && warningCount === 0) {
    console.log('✅ All validation checks passed! Ontology is healthy.');
  } else {
    console.log(`Validation complete:`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  ⚠️  Warnings: ${warningCount}`);
    
    if (errorCount > 0) {
      console.log('\n❌ Validation FAILED. Fix errors before deploying.');
      process.exit(1);
    } else {
      console.log('\n⚠️  Validation passed with warnings. Review before deploying.');
    }
  }
  console.log('='.repeat(50) + '\n');
}

main().catch(error => {
  console.error('\n💥 Validation script crashed:', error);
  process.exit(1);
});
