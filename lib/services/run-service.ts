import { v4 as uuidv4 } from "uuid";
import { eq, desc, sql, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { runs, runEvents } from "@/lib/db/schema";

export function listRuns(filters?: {
  agentId?: string;
  featureId?: string;
  status?: string;
}) {
  const db = getDb();
  const conditions = [];
  if (filters?.agentId) {
    conditions.push(eq(runs.agentId, filters.agentId));
  }
  if (filters?.featureId) {
    conditions.push(eq(runs.featureId, filters.featureId));
  }
  if (filters?.status) {
    conditions.push(eq(runs.status, filters.status));
  }
  const query = db.select().from(runs).orderBy(desc(runs.createdAt));
  if (conditions.length > 0) {
    return query.where(and(...conditions)).all();
  }
  return query.all();
}

export function getRun(id: string) {
  const db = getDb();
  return db.select().from(runs).where(eq(runs.id, id)).get();
}

export function createRun(data: {
  agentId?: string;
  featureId?: string;
  runType: string;
  prompt?: string;
  model?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();
  const row = {
    id,
    agentId: data.agentId ?? null,
    featureId: data.featureId ?? null,
    runType: data.runType,
    status: "queued",
    sessionId: null,
    prompt: data.prompt ?? null,
    summary: null,
    model: data.model ?? null,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    costUsd: 0,
    exitCode: null,
    pid: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
  };
  db.insert(runs).values(row).run();
  return row;
}

export function updateRun(
  id: string,
  data: Partial<{
    status: string;
    sessionId: string;
    summary: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    costUsd: number;
    exitCode: number;
    pid: number;
    startedAt: string;
    finishedAt: string;
  }>
) {
  const db = getDb();
  db.update(runs)
    .set(data)
    .where(eq(runs.id, id))
    .run();
  return getRun(id);
}

export function getRunEvents(
  runId: string,
  opts?: { limit?: number; offset?: number }
) {
  const db = getDb();
  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;
  return db
    .select()
    .from(runEvents)
    .where(eq(runEvents.runId, runId))
    .orderBy(runEvents.seq)
    .limit(limit)
    .offset(offset)
    .all();
}

export function addRunEvent(data: {
  runId: string;
  seq: number;
  type: string;
  subtype?: string;
  data: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    runId: data.runId,
    seq: data.seq,
    type: data.type,
    subtype: data.subtype ?? null,
    data: data.data,
    createdAt: now,
  };
  db.insert(runEvents).values(row).run();
  return row;
}
