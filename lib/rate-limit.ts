/**
 * Concurrent agent spawn limiter.
 *
 * Caps the number of simultaneously running agents to MAX_CONCURRENT_AGENTS (default 5).
 */

// --- Concurrent agent spawn limiter ---

const DEFAULT_MAX_CONCURRENT_AGENTS = 5;

let maxConcurrentAgents = parseInt(
  process.env.MAX_CONCURRENT_AGENTS ?? String(DEFAULT_MAX_CONCURRENT_AGENTS),
  10
);

if (isNaN(maxConcurrentAgents) || maxConcurrentAgents < 1) {
  maxConcurrentAgents = DEFAULT_MAX_CONCURRENT_AGENTS;
}

/**
 * Check if a new agent run can be spawned given the current number of active runs.
 */
export function canSpawnAgent(activeRunCount: number): boolean {
  return activeRunCount < maxConcurrentAgents;
}

export function getMaxConcurrentAgents(): number {
  return maxConcurrentAgents;
}
