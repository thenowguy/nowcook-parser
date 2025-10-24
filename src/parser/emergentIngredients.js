/**
 * Parser: Emergent Ingredient Tracking
 * Generates unique IDs for task outputs and matches them to downstream task inputs
 */

/**
 * Generate emergent ingredients with unique IDs for all tasks
 * @param {Object[]} tasks - Array of task objects
 * @returns {Object[]} - Tasks with emergent IDs added to outputs
 */
export function generateEmergentIds(tasks) {
  if (!tasks || tasks.length === 0) return tasks;

  let emergentCounter = 1;
  const emergentRegistry = new Map(); // ingredient+state -> emergent_id

  return tasks.map(task => {
    const outputs = [];

    // Detect what this task produces based on verb and ingredients
    const produced = detectTaskOutput(task);

    if (produced) {
      const emergentId = `e_${normalizeForId(produced.ingredient)}_${produced.state}_${emergentCounter++}`;

      const output = {
        emergent_id: emergentId,
        ingredient: produced.ingredient,
        state: produced.state,
        emergent: true
      };

      // Add vessel if relevant
      if (produced.vessel) {
        output.vessel = produced.vessel;
      }

      // Add temperature if relevant
      if (task.temperature?.value) {
        output.temperature = task.temperature.value;
      }

      outputs.push(output);

      // Register this emergent ingredient
      const key = `${produced.ingredient}:${produced.state}`;
      emergentRegistry.set(key, emergentId);
    }

    return {
      ...task,
      outputs: outputs.length > 0 ? outputs : task.outputs || []
    };
  });
}

/**
 * Match emergent IDs to task inputs
 * @param {Object[]} tasks - Tasks with emergent IDs in outputs
 * @returns {Object[]} - Tasks with emergent IDs added to inputs and edges updated
 */
export function matchEmergentInputs(tasks) {
  if (!tasks || tasks.length === 0) return tasks;

  // Build registry of what's been produced
  const emergentRegistry = new Map(); // ingredient+state -> { emergent_id, taskId }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (task.outputs && task.outputs.length > 0) {
      for (const output of task.outputs) {
        if (output.emergent_id) {
          const key = `${output.ingredient}:${output.state}`;
          emergentRegistry.set(key, {
            emergent_id: output.emergent_id,
            taskId: task.id,
            taskIndex: i
          });
        }
      }
    }
  }

  // Now match inputs to emergent outputs
  return tasks.map((task, taskIndex) => {
    const requiredInputs = detectTaskInputs(task, tasks, taskIndex);
    const inputs = [];
    const newEdges = [...(task.edges || [])];

    for (const input of requiredInputs) {
      const key = `${input.ingredient}:${input.state}`;

      if (emergentRegistry.has(key)) {
        const producer = emergentRegistry.get(key);

        // Only use if producer comes BEFORE this task
        if (producer.taskIndex < taskIndex) {
          inputs.push({
            emergent_id: producer.emergent_id,
            ingredient: input.ingredient,
            state: input.state,
            required: input.required !== false
          });

          // Add FS edge if not already present
          const edgeExists = newEdges.some(e => e.from === producer.taskId);
          if (!edgeExists) {
            newEdges.push({
              from: producer.taskId,
              to: task.id,
              type: 'FS',
              reason: `Requires ${producer.emergent_id}`
            });
          }
        }
      } else if (input.rawIngredient) {
        // Raw ingredient (not emergent)
        inputs.push({
          ingredient: input.ingredient,
          state: 'raw',
          required: input.required !== false
        });
      }
    }

    return {
      ...task,
      inputs: inputs.length > 0 ? inputs : task.inputs || [],
      edges: newEdges
    };
  });
}

/**
 * Detect what a task produces (outputs)
 * @param {Object} task - Task object
 * @returns {Object|null} - { ingredient, state, vessel? }
 */
function detectTaskOutput(task) {
  const verb = task.canonical_verb;
  const name = (task.name || '').toLowerCase();

  // VERB-BASED OUTPUT DETECTION

  // Boiling creates boiling liquid
  if (verb === 'bring_to_boil' || verb === 'boil_water') {
    return {
      ingredient: extractIngredient(name, ['water', 'liquid', 'broth', 'stock']) || 'water',
      state: 'boiling',
      vessel: extractVessel(name) || 'pot'
    };
  }

  // Boiling pasta/vegetables produces cooked item
  if (verb === 'boil' && !name.includes('water')) {
    const ingredient = extractIngredient(name, ['pasta', 'spaghetti', 'noodles', 'potatoes', 'eggs']);
    if (ingredient) {
      return {
        ingredient,
        state: name.includes('al dente') ? 'al_dente' : 'boiled'
      };
    }
  }

  // Draining produces drained item
  if (verb === 'drain') {
    const ingredient = extractIngredient(name, ['pasta', 'spaghetti', 'noodles', 'potatoes', 'vegetables']);
    if (ingredient) {
      return {
        ingredient,
        state: 'drained'
      };
    }
  }

  // Prep tasks (slice, dice, chop, mince, grate) produce prepared ingredient
  if (['slice', 'dice', 'chop', 'mince', 'grate', 'peel'].includes(verb)) {
    const ingredient = extractSubject(name);
    if (ingredient) {
      return {
        ingredient: ingredient,
        state: verb === 'peel' ? 'peeled' : verb + 'ed' // sliced, diced, chopped, etc.
      };
    }
  }

  // Sautéing produces sautéed item
  if (verb === 'saute' || verb === 'cook') {
    const ingredient = extractIngredient(name, ['garlic', 'onion', 'onions', 'vegetables', 'mushrooms']);
    if (ingredient) {
      return {
        ingredient,
        state: 'sauteed'
      };
    }
  }

  // Making sauce
  if (verb === 'simmer' || verb === 'reduce') {
    if (name.includes('sauce') || name.includes('liquid')) {
      return {
        ingredient: 'sauce',
        state: 'reduced'
      };
    }
  }

  // Mixing/combining produces mixture
  if (verb === 'mix' || verb === 'combine' || verb === 'whisk') {
    return {
      ingredient: 'mixture',
      state: 'combined'
    };
  }

  // Baking/roasting produces cooked item
  if (verb === 'bake' || verb === 'roast') {
    const ingredient = extractIngredient(name, ['chicken', 'meat', 'fish', 'vegetables', 'dish']);
    if (ingredient) {
      return {
        ingredient,
        state: 'roasted'
      };
    }
  }

  return null;
}

/**
 * Detect what a task requires as inputs
 * @param {Object} task - Task object
 * @param {Object[]} allTasks - All tasks
 * @param {number} taskIndex - Current task index
 * @returns {Object[]} - Array of required inputs
 */
function detectTaskInputs(task, allTasks, taskIndex) {
  const verb = task.canonical_verb;
  const name = (task.name || '').toLowerCase();
  const inputs = [];

  // VERB-BASED INPUT DETECTION

  // Boiling pasta requires boiling water
  if (verb === 'boil' && !name.includes('water')) {
    inputs.push({
      ingredient: 'water',
      state: 'boiling',
      required: true
    });

    // Also requires the pasta itself
    const pastaType = extractIngredient(name, ['pasta', 'spaghetti', 'noodles']);
    if (pastaType) {
      inputs.push({
        ingredient: pastaType,
        state: 'raw',
        rawIngredient: true,
        required: true
      });
    }
  }

  // Draining requires boiled item
  if (verb === 'drain') {
    const ingredient = extractIngredient(name, ['pasta', 'spaghetti', 'noodles', 'potatoes']);
    if (ingredient) {
      inputs.push({
        ingredient,
        state: 'boiled',
        required: true
      });
    }
  }

  // Sautéing prepared ingredients requires them to be prepped
  if (verb === 'saute' || verb === 'cook') {
    // Check if it mentions "sliced", "chopped", etc.
    if (name.includes('sliced') || name.includes('chopped') || name.includes('minced')) {
      const ingredient = extractIngredient(name, ['garlic', 'onion', 'onions', 'shallots']);
      const state = name.includes('sliced') ? 'sliced' : name.includes('minced') ? 'minced' : 'chopped';

      if (ingredient) {
        inputs.push({
          ingredient,
          state,
          required: true
        });
      }
    }
  }

  // Combining/tossing requires the components
  if (verb === 'combine' || verb === 'toss' || verb === 'mix') {
    // Look for "pasta with sauce" pattern
    if (name.includes('pasta') && (name.includes('sauce') || name.includes('oil'))) {
      inputs.push({
        ingredient: 'pasta',
        state: 'drained',
        required: true
      });

      if (name.includes('sauce')) {
        inputs.push({
          ingredient: 'sauce',
          state: 'reduced',
          required: true
        });
      }

      if (name.includes('oil') || name.includes('garlic oil')) {
        inputs.push({
          ingredient: 'garlic',
          state: 'sauteed',
          required: true
        });
      }
    }
  }

  return inputs;
}

/**
 * Extract ingredient from text using keyword list
 * @param {string} text - Text to search
 * @param {string[]} keywords - Ingredient keywords
 * @returns {string|null}
 */
function extractIngredient(text, keywords) {
  if (!text || typeof text !== 'string') return null;

  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    if (lowerText.includes(keyword)) {
      return keyword;
    }
  }
  return null;
}

/**
 * Extract vessel/equipment from text
 * @param {string} text - Text to search
 * @returns {string|null}
 */
function extractVessel(text) {
  if (!text || typeof text !== 'string') return null;

  const lowerText = text.toLowerCase();
  const vessels = ['pot', 'pan', 'saucepan', 'skillet', 'bowl', 'dish'];
  for (const vessel of vessels) {
    if (lowerText.includes(vessel)) {
      return vessel;
    }
  }
  return null;
}

/**
 * Extract subject from instruction (simple version)
 * @param {string} text - Instruction text
 * @returns {string|null}
 */
function extractSubject(text) {
  if (!text || typeof text !== 'string') return null;

  // Look for pattern: "Verb the SUBJECT"
  const match = text.match(/(?:the\s+)?([a-z]+)(?:\s+(?:into|until|for|in|on|and|with|,)|\s*$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

/**
 * Normalize text for use in emergent IDs
 * @param {string} text - Text to normalize
 * @returns {string}
 */
function normalizeForId(text) {
  if (!text || typeof text !== 'string') return 'unknown';

  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
