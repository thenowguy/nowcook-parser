/**
 * Parser: Chain Detection
 * Groups tasks into logical chains based on section headers, temporal markers, convergence points, etc.
 */

/**
 * Detect chains from tasks and raw recipe text
 * Uses intelligent clustering when section headers aren't available
 * @param {Object[]} tasks - Array of task objects
 * @param {string} rawText - Original recipe text
 * @returns {Object[]} - Array of chain objects
 */
export function detectChains(tasks, rawText = '') {
  if (!tasks || tasks.length === 0) return [];

  let chains = [];
  let emergentCounter = 1;

  // Try to detect chains from section headers in raw text
  const sections = detectSectionsFromText(rawText);

  if (sections.length > 1) {
    // Use detected sections (only if we found multiple sections)
    chains = buildChainsFromSections(tasks, sections);
  } else {
    // Use intelligent clustering based on multiple signals
    chains = detectChainsAlgorithmically(tasks);
  }

  // Infer chain-level dependencies
  inferChainDependencies(chains, tasks);

  // Generate emergent IDs for chain outputs
  chains.forEach(chain => {
    chain.outputs = generateChainOutputs(chain, tasks, emergentCounter);
    emergentCounter += chain.outputs.length;
  });

  return chains;
}

/**
 * Detect chains algorithmically without section headers
 * Uses equipment, ingredients, dependency clusters, and temporal markers
 * @param {Object[]} tasks - Array of task objects
 * @returns {Object[]} - Array of chain objects
 */
function detectChainsAlgorithmically(tasks) {
  // Build dependency graph
  const dependencyGraph = buildDependencyGraph(tasks);

  // Find strongly connected components (groups of tasks that depend on each other)
  const clusters = findDependencyClusters(tasks, dependencyGraph);

  // Analyze each cluster for common signals (prioritize ingredient flows)
  const chains = clusters.map((cluster, idx) => {
    const clusterTasks = cluster.taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);

    // Determine chain characteristics (ingredient is primary signal)
    const primaryIngredient = findPrimaryIngredient(clusterTasks);
    const chainVerb = findDominantVerb(clusterTasks);

    // Generate meaningful name based on ingredient flow
    let chainName = '';
    if (primaryIngredient) {
      // Ingredient is the best signal - use it
      chainName = `Prepare ${capitalizeFirst(primaryIngredient)}`;
    } else if (chainVerb) {
      // Fallback to verb
      chainName = `${capitalizeFirst(chainVerb)} Phase`;
    } else {
      // Last resort
      chainName = `Phase ${idx + 1}`;
    }

    return {
      id: `chain_${idx + 1}`,
      name: chainName,
      purpose: `Complete ${chainName.toLowerCase()}`,
      tasks: cluster.taskIds,
      outputs: [],
      inputs: [],
      edges: [],
      metadata: {
        detected_by: 'algorithmic_clustering',
        confidence: cluster.confidence || 'medium',
        signals: {
          ingredient: primaryIngredient,
          verb: chainVerb
        }
      }
    };
  });

  // Finalize all chains
  chains.forEach(chain => finalizeChain(chain, tasks));

  return chains;
}

/**
 * Build dependency graph from tasks
 * @param {Object[]} tasks - Array of tasks
 * @returns {Map} - Map of task ID to dependent task IDs
 */
function buildDependencyGraph(tasks) {
  const graph = new Map();

  tasks.forEach(task => {
    if (!graph.has(task.id)) {
      graph.set(task.id, { dependencies: [], dependents: [] });
    }

    if (task.edges) {
      task.edges.forEach(edge => {
        // This task depends on edge.from
        graph.get(task.id).dependencies.push(edge.from);

        // edge.from has this task as a dependent
        if (!graph.has(edge.from)) {
          graph.set(edge.from, { dependencies: [], dependents: [] });
        }
        graph.get(edge.from).dependents.push(task.id);
      });
    }
  });

  return graph;
}

/**
 * Find dependency clusters - groups of tasks that work together
 * @param {Object[]} tasks - Array of tasks
 * @param {Map} graph - Dependency graph
 * @returns {Object[]} - Array of clusters
 */
function findDependencyClusters(tasks, graph) {
  const visited = new Set();
  const initialClusters = [];

  // Find root tasks (no dependencies)
  const roots = tasks.filter(t => !t.edges || t.edges.length === 0);

  // If no roots, just create clusters by traversal order
  if (roots.length === 0) {
    // Fallback: group by sequential batches
    const batchSize = Math.max(3, Math.floor(tasks.length / 3));
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      initialClusters.push({
        taskIds: batch.map(t => t.id),
        confidence: 'low'
      });
    }
    return initialClusters;
  }

  // For each root, traverse its dependency tree downstream
  roots.forEach(root => {
    if (visited.has(root.id)) return;

    const cluster = {
      taskIds: [],
      confidence: 'medium'
    };

    // BFS from this root - follow dependents downstream
    const queue = [root.id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;

      visited.add(current);
      cluster.taskIds.push(current);

      const node = graph.get(current);
      if (node && node.dependents) {
        node.dependents.forEach(dep => {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        });
      }
    }

    if (cluster.taskIds.length > 0) {
      initialClusters.push(cluster);
    }
  });

  // Catch any orphan tasks
  const clusteredIds = new Set(initialClusters.flatMap(c => c.taskIds));
  const orphans = tasks.filter(t => !clusteredIds.has(t.id));
  if (orphans.length > 0) {
    initialClusters.push({
      taskIds: orphans.map(t => t.id),
      confidence: 'low'
    });
  }

  // Merge clusters with similar characteristics
  const mergedClusters = mergeSimilarClusters(initialClusters, tasks);

  return mergedClusters;
}

/**
 * Merge clusters that have similar characteristics
 * @param {Object[]} clusters - Initial clusters
 * @param {Object[]} tasks - All tasks
 * @returns {Object[]} - Merged clusters
 */
function mergeSimilarClusters(clusters, tasks) {
  if (clusters.length <= 3) {
    // If we already have 3 or fewer clusters, keep them
    return clusters;
  }

  // Analyze each cluster's characteristics (focus on ingredient flows)
  const clusterProfiles = clusters.map(cluster => {
    const clusterTasks = cluster.taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);

    return {
      cluster,
      ingredient: findPrimaryIngredient(clusterTasks),
      taskCount: cluster.taskIds.length
    };
  });

  // Merge clusters with same ingredient
  const merged = [];
  const processed = new Set();

  clusterProfiles.forEach((profile, i) => {
    if (processed.has(i)) return;

    const group = [profile];
    processed.add(i);

    // Find other clusters working on the same ingredient
    for (let j = i + 1; j < clusterProfiles.length; j++) {
      if (processed.has(j)) continue;

      const other = clusterProfiles[j];

      // Merge if same ingredient (strong signal that they're the same chain)
      const sameIngredient = profile.ingredient && profile.ingredient === other.ingredient;

      if (sameIngredient) {
        group.push(other);
        processed.add(j);
      }
    }

    // Combine the group into one cluster
    const combinedTaskIds = group.flatMap(p => p.cluster.taskIds);
    merged.push({
      taskIds: combinedTaskIds,
      confidence: group.length > 1 ? 'high' : 'medium'
    });
  });

  return merged;
}

/**
 * Find primary ingredient being worked on
 * @param {Object[]} tasks - Tasks in cluster
 * @returns {string|null}
 */
function findPrimaryIngredient(tasks) {
  // Look for repeated words in task names
  const wordCounts = {};

  tasks.forEach(task => {
    const words = (task.name || '').toLowerCase().split(/\s+/);
    words.forEach(word => {
      // Skip common words and cooking verbs
      const skipWords = ['with', 'until', 'from', 'into', 'over', 'salt', 'pepper', 'olive', 'large', 'small', 'fresh'];
      if (word.length < 4 || skipWords.includes(word)) {
        return;
      }
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
  });

  // Find most common meaningful word (lower threshold to >= 1 for small clusters)
  let maxCount = 0;
  let primary = null;
  Object.entries(wordCounts).forEach(([word, count]) => {
    if (count >= 1 && count > maxCount) {
      maxCount = count;
      primary = word;
    }
  });

  return primary;
}

/**
 * Find dominant verb in cluster
 * @param {Object[]} tasks - Tasks in cluster
 * @returns {string|null}
 */
function findDominantVerb(tasks) {
  const verbCounts = {};

  tasks.forEach(task => {
    if (task.canonical_verb) {
      verbCounts[task.canonical_verb] = (verbCounts[task.canonical_verb] || 0) + 1;
    }
  });

  let maxCount = 0;
  let dominant = null;
  Object.entries(verbCounts).forEach(([verb, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominant = verb;
    }
  });

  return dominant;
}

/**
 * Capitalize first letter of string
 * @param {string} str
 * @returns {string}
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

/**
 * Detect section headers from raw recipe text
 * @param {string} text - Raw recipe text
 * @returns {Object[]} - Array of sections
 */
function detectSectionsFromText(text) {
  if (!text) return [];

  const sections = [];
  const lines = text.split('\n');

  const sectionPatterns = [
    /^#+\s*(.+)$/,  // Markdown headers
    /^For the (.+):$/i,
    /^To make the (.+):$/i,
    /^To (.+):$/i,
    /^Meanwhile[,:]?\s*(.+)?$/i,
    /^While (.+)[,:]?$/i,
    /^(?:At the same time|Simultaneously)[,:]?\s*(.+)?$/i,
    /^(?:To assemble|To serve|To finish)[,:]?\s*(.+)?$/i
  ];

  let currentSection = null;
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Check if this is a section header
    for (const pattern of sectionPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          name: match[1] || trimmed,
          startLine: lineNumber,
          lines: []
        };
        break;
      }
    }

    // Add line to current section
    if (currentSection && !trimmed.match(/^#+/) && !trimmed.match(/:/)) {
      currentSection.lines.push(trimmed);
    } else if (!currentSection) {
      // Create default section for lines before first header
      currentSection = {
        name: 'Preparation',
        startLine: lineNumber,
        lines: [trimmed]
      };
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Build chains from detected sections
 * @param {Object[]} tasks - All tasks
 * @param {Object[]} sections - Detected sections
 * @returns {Object[]} - Chains
 */
function buildChainsFromSections(tasks, sections) {
  const chains = [];
  let chainCounter = 1;

  for (const section of sections) {
    const chainTasks = matchTasksToSection(tasks, section);

    if (chainTasks.length === 0) continue;

    chains.push({
      id: `chain_${chainCounter++}`,
      name: formatChainName(section.name),
      purpose: `Complete ${(section.name || 'section').toLowerCase()}`,
      tasks: chainTasks.map(t => t.id),
      outputs: [],
      inputs: [],
      edges: [],
      metadata: {
        detected_by: 'explicit_header',
        confidence: 'high'
      }
    });
  }

  return chains;
}

/**
 * Match tasks to a section based on content similarity
 * @param {Object[]} tasks - All tasks
 * @param {Object} section - Section object
 * @returns {Object[]} - Matched tasks
 */
function matchTasksToSection(tasks, section) {
  // Simple implementation: match by text similarity
  // More sophisticated: use task order and keywords
  return tasks.filter(task => {
    const taskName = (task.name || '').toLowerCase();
    return section.lines.some(line => {
      const lineLower = (line || '').toLowerCase();
      return lineLower.includes(taskName) || taskName.includes(lineLower);
    });
  });
}

/**
 * Detect if a task starts a new chain
 * @param {Object} task - Current task
 * @param {Object[]} tasks - All tasks
 * @param {number} index - Current task index
 * @returns {Object|boolean} - { reason, confidence } or false
 */
function detectChainBoundary(task, tasks, index) {
  const name = (task.name || '').toLowerCase();

  // Temporal markers indicating new parallel chain
  if (/\b(?:meanwhile|while|at the same time|simultaneously)\b/i.test(name)) {
    return { reason: 'temporal_marker', confidence: 'high' };
  }

  // Convergence points (combining previous chains)
  if (/\b(?:combine|mix together|add.*to|toss|fold in)\b/i.test(name)) {
    // Check if this combines outputs from multiple chains
    if (task.inputs && task.inputs.length > 1) {
      return { reason: 'convergence_point', confidence: 'high' };
    }
  }

  // Vessel change
  if (/\b(?:in a separate|in another|transfer to)\b/i.test(name)) {
    return { reason: 'vessel_change', confidence: 'medium' };
  }

  // Equipment change suggests new chain
  if (index > 0) {
    const prevTask = tasks[index - 1];
    const prevEquip = prevTask.equipment || [];
    const currEquip = task.equipment || [];

    if (currEquip.length > 0 && prevEquip.length > 0) {
      const sharedEquip = currEquip.some(e => prevEquip.includes(e));
      if (!sharedEquip) {
        return { reason: 'vessel_change', confidence: 'medium' };
      }
    }
  }

  return false;
}

/**
 * Infer chain name from first task
 * @param {Object} task - First task in chain
 * @param {Object[]} remainingTasks - Tasks in this chain
 * @returns {string}
 */
function inferChainName(task, remainingTasks) {
  const verb = task.canonical_verb || '';

  // Try to infer from verb patterns
  if (verb === 'bring_to_boil' || verb === 'boil') {
    return 'Cook the Pasta';
  }
  if (verb === 'melt' || verb === 'whisk' || verb === 'simmer') {
    return 'Make the Sauce';
  }
  if (verb === 'combine' || verb === 'mix' || verb === 'toss') {
    return 'Combine and Finish';
  }
  if (verb === 'preheat' || verb === 'bake' || verb === 'roast') {
    return 'Bake/Roast';
  }

  // Fallback: Use first task name
  return task.name.split(/[,\.]/)[0].trim();
}

/**
 * Infer chain purpose
 * @param {Object} task - First task in chain
 * @param {Object[]} remainingTasks - Tasks in this chain
 * @returns {string}
 */
function inferChainPurpose(task, remainingTasks) {
  // Analyze outputs to infer purpose
  const lastTask = remainingTasks[remainingTasks.length - 1] || task;
  if (lastTask.outputs && lastTask.outputs.length > 0) {
    const output = lastTask.outputs[0];
    if (typeof output === 'string') {
      return `Produce ${output}`;
    }
  }

  return `Complete ${(task.name || 'task').toLowerCase()}`;
}

/**
 * Finalize chain by calculating duration and outputs
 * @param {Object} chain - Chain to finalize
 * @param {Object[]} allTasks - All tasks
 */
function finalizeChain(chain, allTasks) {
  const chainTasks = allTasks.filter(t => chain.tasks.includes(t.id));

  // Calculate estimated duration (sum for now, should be critical path)
  chain.estimated_duration_min = chainTasks.reduce((sum, t) => {
    const duration = t.duration_min?.value || t.planned_min || t.duration_min || 0;
    return sum + duration;
  }, 0);
}

/**
 * Infer dependencies between chains
 * @param {Object[]} chains - All chains
 * @param {Object[]} tasks - All tasks
 */
function inferChainDependencies(chains, tasks) {
  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i];
    const chainTaskIds = new Set(chain.tasks);

    // Find dependencies from other chains
    for (let j = 0; j < chains.length; j++) {
      if (i === j) continue;

      const otherChain = chains[j];
      const otherTaskIds = new Set(otherChain.tasks);

      // Check if any task in this chain depends on any task in other chain
      for (const taskId of chain.tasks) {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.edges) continue;

        for (const edge of task.edges) {
          if (otherTaskIds.has(edge.from)) {
            // This chain depends on other chain
            const existingEdge = chain.edges.find(e => e.from === otherChain.id);
            if (!existingEdge) {
              chain.edges.push({
                from: otherChain.id,
                to: chain.id,
                type: edge.type,
                note: `Chain dependency inferred from task-level edge`
              });
            }
            break;
          }
        }
      }
    }
  }
}

/**
 * Generate emergent outputs for a chain
 * @param {Object} chain - Chain object
 * @param {Object[]} tasks - All tasks
 * @param {number} startId - Starting emergent ID counter
 * @returns {Object[]} - Emergent outputs
 */
function generateChainOutputs(chain, tasks, startId) {
  const chainTasks = tasks.filter(t => chain.tasks.includes(t.id));
  const lastTask = chainTasks[chainTasks.length - 1];

  if (!lastTask) return [];

  const outputs = [];

  // Use last task's outputs as chain outputs
  if (lastTask.outputs && lastTask.outputs.length > 0) {
    lastTask.outputs.forEach((output, idx) => {
      const emergentId = `e_${normalizeId(chain.id)}_${startId + idx}`;

      if (typeof output === 'string') {
        outputs.push({
          emergent_id: emergentId,
          ingredient: output,
          state: 'prepared'
        });
      } else if (output.ingredient) {
        outputs.push({
          emergent_id: emergentId,
          ingredient: output.ingredient,
          state: output.state || 'prepared',
          ...output
        });
      }
    });
  } else {
    // Infer from chain name/purpose
    const emergentId = `e_${normalizeId(chain.id)}_${startId}`;
    outputs.push({
      emergent_id: emergentId,
      ingredient: normalizeId(chain.name),
      state: 'completed'
    });
  }

  return outputs;
}

/**
 * Normalize text for use in IDs
 * @param {string} text - Text to normalize
 * @returns {string}
 */
function normalizeId(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Format section name as chain name
 * @param {string} name - Raw section name
 * @returns {string}
 */
function formatChainName(name) {
  // Capitalize first letter of each word
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
