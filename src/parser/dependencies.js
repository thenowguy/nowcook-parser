/**
 * Parser: Dependency Inference
 * Automatically infer task dependencies based on ingredient flow, equipment reuse, etc.
 * Ported from Google Apps Script _inferDependenciesForRows_()
 */

/**
 * Infer dependencies between tasks
 * @param {Object[]} tasks - Array of task objects
 * @returns {Object[]} - Tasks with inferred edges added
 */
export function inferDependencies(tasks) {
  if (!tasks || tasks.length === 0) return tasks;

  // Track what's been produced and consumed
  const outputTracker = new Map(); // ingredient/equipment → task ID that produced it
  const updatedTasks = tasks.map(t => ({ ...t, edges: [...(t.edges || [])] }));

  for (let i = 0; i < updatedTasks.length; i++) {
    const task = updatedTasks[i];
    const dependencies = new Set();

    // Rule 1: If task uses an ingredient that was output by previous task, create dependency
    if (task.inputs && task.inputs.length > 0) {
      for (const input of task.inputs) {
        const inputKey = normalizeKey(input);
        if (outputTracker.has(inputKey)) {
          const producerId = outputTracker.get(inputKey);
          if (producerId !== task.id) {
            dependencies.add(producerId);
          }
        }
      }
    }

    // Rule 2: If task uses equipment that was last used by previous task, create dependency
    if (task.equipment && task.equipment.length > 0) {
      for (const equip of task.equipment) {
        const equipKey = `equipment:${normalizeKey(equip)}`;
        if (outputTracker.has(equipKey)) {
          const userId = outputTracker.get(equipKey);
          if (userId !== task.id) {
            dependencies.add(userId);
          }
        }
      }
    }

    // Rule 3: Subject continuity - if step starts with pronoun or "the X", likely refers to previous step's output
    if (task.name) {
      const startsWithReference = /^(?:the|it|this|these|them)\b/i.test(task.name.trim());
      if (startsWithReference && i > 0) {
        dependencies.add(updatedTasks[i - 1].id);
      }
    }

    // Rule 4: Explicit temporal markers
    if (task.name) {
      const hasAfterMarker = /\b(?:after|once|when).*(?:done|finished|ready|cooked)\b/i.test(task.name);
      if (hasAfterMarker && i > 0) {
        dependencies.add(updatedTasks[i - 1].id);
      }
    }

    // Rule 5: Sauce/liquid dependencies - if adding sauce, depend on task that made it
    if (task.canonical_verb === "add" && task.name) {
      const addingSauce = /\b(?:sauce|gravy|liquid|broth|stock)\b/i.test(task.name);
      if (addingSauce) {
        // Look backwards for a simmer/reduce task
        for (let j = i - 1; j >= 0; j--) {
          if (["simmer", "reduce", "boil"].includes(updatedTasks[j].canonical_verb)) {
            dependencies.add(updatedTasks[j].id);
            break;
          }
        }
      }
    }

    // Convert dependencies to edges (FS = Finish-to-Start)
    for (const depId of dependencies) {
      // Don't add duplicate edges
      const alreadyExists = task.edges.some(e => e.from === depId);
      if (!alreadyExists) {
        task.edges.push({ from: depId, type: "FS" });
      }
    }

    // Update output tracker with this task's outputs
    if (task.outputs && task.outputs.length > 0) {
      for (const output of task.outputs) {
        outputTracker.set(normalizeKey(output), task.id);
      }
    }

    // Track equipment usage
    if (task.equipment && task.equipment.length > 0) {
      for (const equip of task.equipment) {
        outputTracker.set(`equipment:${normalizeKey(equip)}`, task.id);
      }
    }

    // If this is a prep task (slice, dice, etc.), mark its subject as output
    if (["slice", "dice", "chop", "mince", "peel"].includes(task.canonical_verb)) {
      const subject = extractSubject(task.name);
      if (subject) {
        outputTracker.set(normalizeKey(subject), task.id);
      }
    }
  }

  return updatedTasks;
}

/**
 * Infer sequential dependencies (simple mode)
 * Each task depends on the previous task
 * @param {Object[]} tasks - Array of task objects
 * @returns {Object[]} - Tasks with sequential edges added
 */
export function inferSequentialDependencies(tasks) {
  if (!tasks || tasks.length <= 1) return tasks;

  return tasks.map((task, i) => {
    if (i === 0) return task;

    const edges = [...(task.edges || [])];
    const previousTaskId = tasks[i - 1].id;

    // Don't add duplicate
    const alreadyExists = edges.some(e => e.from === previousTaskId);
    if (!alreadyExists) {
      edges.push({ from: previousTaskId, type: "FS" });
    }

    return { ...task, edges };
  });
}

/**
 * Normalize ingredient/equipment key for matching
 * @param {string} text - Ingredient or equipment name
 * @returns {string}
 */
function normalizeKey(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .replace(/\b(?:the|a|an)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Extract likely subject from instruction
 * @param {string} text - Instruction text
 * @returns {string|null}
 */
function extractSubject(text) {
  if (!text) return null;

  // Look for pattern: "Verb the SUBJECT" or "Verb SUBJECT"
  const match = text.match(/^(?:\w+)\s+(?:the\s+)?([a-z\s]+?)(?:\s+(?:into|to|until|for|in|on|and|with)|\s*[,\.\-–—]|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

/**
 * Detect parallel tasks that can run simultaneously
 * @param {Object[]} tasks - Array of task objects
 * @returns {Object} - Map of task IDs that can run in parallel
 */
export function detectParallelTasks(tasks) {
  const parallelGroups = [];
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    
    // Tasks with "meanwhile" or "while" can run in parallel
    if (task.name && /\b(?:meanwhile|while|at the same time)\b/i.test(task.name)) {
      // Find what it's parallel to
      for (let j = i - 1; j >= 0; j--) {
        const candidate = tasks[j];
        
        // Can run parallel if:
        // 1. Different equipment
        // 2. One is unattended_after_start
        if (candidate.canonical_verb) {
          const taskEquip = task.equipment || [];
          const candEquip = candidate.equipment || [];
          
          const sharedEquip = taskEquip.some(e => candEquip.includes(e));
          const oneUnattended = task.self_running_after_start || candidate.self_running_after_start;
          
          if (!sharedEquip && oneUnattended) {
            parallelGroups.push({ task: task.id, parallelTo: candidate.id });
            break;
          }
        }
      }
    }
  }
  
  return parallelGroups;
}
