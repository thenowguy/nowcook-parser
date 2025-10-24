/**
 * Critical Path Calculator
 * Calculates earliest/latest start times for tasks based on serve time and dependencies
 * Determines meal feasibility and identifies critical path tasks
 */

/**
 * Calculate critical path timing for all tasks
 * @param {Object[]} tasks - Array of task objects with edges
 * @param {number} serveTimeMs - Target serve time in milliseconds from epoch
 * @param {number} nowMs - Current time in milliseconds from epoch (default: Date.now())
 * @returns {Object} - { tasks: enhanced tasks, feasible: boolean, criticalPathDuration: number }
 */
export function calculateCriticalPath(tasks, serveTimeMs, nowMs = Date.now()) {
  if (!tasks || tasks.length === 0) {
    return { tasks: [], feasible: true, criticalPathDuration: 0 };
  }

  // Build dependency graph
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // Phase 1: Calculate Latest Finish Time (work backwards from serve time)
  const latestFinish = new Map();
  const latestStart = new Map();

  // Initialize leaf tasks (no tasks depend on them)
  const hasDependents = new Set();
  tasks.forEach(task => {
    if (task.edges) {
      task.edges.forEach(edge => hasDependents.add(edge.from));
    }
  });

  // Set latest finish for leaf tasks = serve time
  tasks.forEach(task => {
    if (!hasDependents.has(task.id)) {
      latestFinish.set(task.id, serveTimeMs);
    }
  });

  // Backward pass: propagate latest times through dependency graph
  let changed = true;
  let iterations = 0;
  const maxIterations = tasks.length * 2; // Prevent infinite loops

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const task of tasks) {
      const duration = getTaskDurationMs(task);

      // Find dependent tasks (tasks that have this task as a dependency)
      const dependents = tasks.filter(t =>
        t.edges?.some(e => e.from === task.id)
      );

      if (dependents.length === 0) {
        // Leaf task - already set to serve time
        if (!latestFinish.has(task.id)) {
          latestFinish.set(task.id, serveTimeMs);
          changed = true;
        }
      } else {
        // Calculate latest finish based on dependents
        let minLatestFinish = Infinity;

        for (const dependent of dependents) {
          const edge = dependent.edges.find(e => e.from === task.id);
          const depLatestStart = latestStart.get(dependent.id);

          if (depLatestStart !== undefined) {
            // Different edge types have different timing implications
            if (edge.type === 'FS') {
              // Finish-to-Start: this must finish before dependent starts
              minLatestFinish = Math.min(minLatestFinish, depLatestStart);
            } else if (edge.type === 'SS') {
              // Start-to-Start: this must start before dependent starts
              const depDuration = getTaskDurationMs(taskMap.get(dependent.id));
              minLatestFinish = Math.min(minLatestFinish, depLatestStart + depDuration);
            } else if (edge.type === 'FF') {
              // Finish-to-Finish: this must finish before dependent finishes
              const depLatestFinish = latestFinish.get(dependent.id);
              if (depLatestFinish !== undefined) {
                minLatestFinish = Math.min(minLatestFinish, depLatestFinish);
              }
            }
          }
        }

        if (minLatestFinish !== Infinity) {
          const currentLatestFinish = latestFinish.get(task.id);
          if (currentLatestFinish === undefined || minLatestFinish < currentLatestFinish) {
            latestFinish.set(task.id, minLatestFinish);
            changed = true;
          }
        }
      }

      // Calculate latest start from latest finish
      const lf = latestFinish.get(task.id);
      if (lf !== undefined) {
        const ls = lf - duration;
        const currentLatestStart = latestStart.get(task.id);
        if (currentLatestStart === undefined || ls < currentLatestStart) {
          latestStart.set(task.id, ls);
          changed = true;
        }
      }
    }
  }

  // Phase 2: Calculate Earliest Start Time (work forward from dependencies)
  const earliestStart = new Map();
  const earliestFinish = new Map();

  // Initialize tasks with no dependencies
  tasks.forEach(task => {
    if (!task.edges || task.edges.length === 0) {
      earliestStart.set(task.id, nowMs);
      earliestFinish.set(task.id, nowMs + getTaskDurationMs(task));
    }
  });

  // Forward pass: propagate earliest times
  changed = true;
  iterations = 0;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const task of tasks) {
      if (!task.edges || task.edges.length === 0) {
        // Already initialized
        continue;
      }

      // Calculate earliest start based on dependencies
      let maxEarliestStart = nowMs;
      let allDependenciesSatisfied = true;

      for (const edge of task.edges) {
        const predecessor = taskMap.get(edge.from);
        if (!predecessor) continue;

        const predEarliestFinish = earliestFinish.get(edge.from);
        const predEarliestStart = earliestStart.get(edge.from);

        if (predEarliestFinish === undefined || predEarliestStart === undefined) {
          allDependenciesSatisfied = false;
          continue;
        }

        if (edge.type === 'FS') {
          // Finish-to-Start: can't start until predecessor finishes
          maxEarliestStart = Math.max(maxEarliestStart, predEarliestFinish);
        } else if (edge.type === 'SS') {
          // Start-to-Start: can't start until predecessor starts
          maxEarliestStart = Math.max(maxEarliestStart, predEarliestStart);
        } else if (edge.type === 'FF') {
          // Finish-to-Finish: must finish at same time as predecessor
          const duration = getTaskDurationMs(task);
          maxEarliestStart = Math.max(maxEarliestStart, predEarliestFinish - duration);
        }
      }

      if (allDependenciesSatisfied) {
        const currentEarliestStart = earliestStart.get(task.id);
        if (currentEarliestStart === undefined || maxEarliestStart > currentEarliestStart) {
          earliestStart.set(task.id, maxEarliestStart);
          earliestFinish.set(task.id, maxEarliestStart + getTaskDurationMs(task));
          changed = true;
        }
      }
    }
  }

  // Phase 3: Calculate slack and identify critical path
  const enhancedTasks = tasks.map(task => {
    const es = earliestStart.get(task.id) || nowMs;
    const ls = latestStart.get(task.id) || serveTimeMs;
    const slack = ls - es;
    const isCritical = slack <= 0;

    return {
      ...task,
      timing: {
        earliest_start_ms: es,
        latest_start_ms: ls,
        earliest_finish_ms: earliestFinish.get(task.id) || (es + getTaskDurationMs(task)),
        latest_finish_ms: latestFinish.get(task.id) || serveTimeMs,
        slack_ms: slack,
        is_critical: isCritical,
        urgency: getUrgency(slack, nowMs, ls)
      }
    };
  });

  // Determine overall feasibility
  const earliestPossibleFinish = Math.max(...Array.from(earliestFinish.values()));
  const feasible = earliestPossibleFinish <= serveTimeMs;

  // Calculate critical path duration (longest chain from now to serve)
  const criticalPathDuration = earliestPossibleFinish - nowMs;

  return {
    tasks: enhancedTasks,
    feasible,
    criticalPathDuration,
    serveTimeMs,
    nowMs,
    timeAvailable: serveTimeMs - nowMs,
    metadata: {
      earliestPossibleFinish,
      timeShortfall: feasible ? 0 : (earliestPossibleFinish - serveTimeMs)
    }
  };
}

/**
 * Get task duration in milliseconds
 * @param {Object} task - Task object
 * @returns {number} - Duration in ms
 */
function getTaskDurationMs(task) {
  const minutes = task.duration_min?.value || task.planned_min || task.duration_min || 0;
  return minutes * 60 * 1000;
}

/**
 * Determine urgency level based on slack time
 * @param {number} slackMs - Slack time in ms
 * @param {number} nowMs - Current time
 * @param {number} latestStartMs - Latest possible start time
 * @returns {string} - Urgency level: "must_do_now", "should_start_soon", "flexible", "could_do_now"
 */
function getUrgency(slackMs, nowMs, latestStartMs) {
  const timeUntilLatestStart = latestStartMs - nowMs;
  const minutesUntilLatestStart = timeUntilLatestStart / (60 * 1000);

  if (slackMs <= 0 || timeUntilLatestStart <= 0) {
    return "must_do_now"; // Critical - no slack or past deadline
  } else if (minutesUntilLatestStart <= 5) {
    return "must_do_now"; // Within 5 minutes of latest start
  } else if (minutesUntilLatestStart <= 15) {
    return "should_start_soon"; // Within 15 minutes
  } else if (slackMs < 30 * 60 * 1000) {
    return "flexible"; // Less than 30min slack
  } else {
    return "could_do_now"; // Plenty of time
  }
}

/**
 * Filter tasks by urgency
 * @param {Object[]} enhancedTasks - Tasks with timing info
 * @param {string} urgency - Urgency level to filter by
 * @returns {Object[]} - Filtered tasks
 */
export function filterByUrgency(enhancedTasks, urgency) {
  return enhancedTasks.filter(t => t.timing?.urgency === urgency);
}

/**
 * Get critical path tasks in execution order
 * @param {Object[]} enhancedTasks - Tasks with timing info
 * @returns {Object[]} - Critical path tasks sorted by earliest start
 */
export function getCriticalPath(enhancedTasks) {
  return enhancedTasks
    .filter(t => t.timing?.is_critical)
    .sort((a, b) => a.timing.earliest_start_ms - b.timing.earliest_start_ms);
}

/**
 * Format time remaining until deadline
 * @param {number} ms - Milliseconds
 * @returns {string} - Human-readable format
 */
export function formatTimeRemaining(ms) {
  if (ms <= 0) return "OVERDUE";

  const minutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  } else {
    return `${mins}m`;
  }
}
