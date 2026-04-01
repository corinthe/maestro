/**
 * Purge scheduler — deletes run_events older than 24 hours.
 * Runs are kept indefinitely; only their stream events are purged.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { runEvents } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("purge");

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RETENTION_HOURS = 24;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Delete run_events older than RETENTION_HOURS.
 * Returns the number of deleted rows.
 */
export function purgeOldRunEvents(): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  const result = db
    .delete(runEvents)
    .where(sql`${runEvents.createdAt} < ${cutoff}`)
    .run();

  const count = result.changes;
  if (count > 0) {
    log.info("purged old run_events", { deleted: count, cutoff });
  }
  return count;
}

export function startPurgeScheduler(): void {
  if (intervalHandle) return;

  log.info("purge scheduler started", { intervalMs: PURGE_INTERVAL_MS, retentionHours: RETENTION_HOURS });

  // Run once immediately on startup
  try {
    purgeOldRunEvents();
  } catch (err) {
    log.error("purge failed on startup", { error: String(err) });
  }

  intervalHandle = setInterval(() => {
    try {
      purgeOldRunEvents();
    } catch (err) {
      log.error("purge failed", { error: String(err) });
    }
  }, PURGE_INTERVAL_MS);
}

export function stopPurgeScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    log.info("purge scheduler stopped");
  }
}
