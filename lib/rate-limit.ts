/**
 * Simple in-memory rate limiter.
 *
 * - API rate limiting: sliding window per IP
 * - Concurrent agent spawn limiting: max concurrent running agents
 */
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("rate-limit");

// --- Sliding window rate limiter ---

type WindowEntry = { count: number; resetAt: number };

const windows = new Map<string, WindowEntry>();

/**
 * Check if a request should be rate-limited.
 * Returns null if allowed, or a 429 NextResponse if blocked.
 */
export function checkRateLimit(
  key: string,
  opts: { maxRequests: number; windowSec: number }
): NextResponse | null {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + opts.windowSec * 1000 });
    return null;
  }

  entry.count++;
  if (entry.count > opts.maxRequests) {
    log.warn("rate limit exceeded", { key, count: entry.count, maxRequests: opts.maxRequests });
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429 }
    );
  }

  return null;
}

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now >= entry.resetAt) {
      windows.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
