import { v4 as uuidv4 } from "uuid";
import { eq, desc, sql, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { features } from "@/lib/db/schema";

function getNextKey(): string {
  const db = getDb();
  const result = db
    .select({ maxKey: sql<string>`max(cast(substr(${features.key}, 5) as integer))` })
    .from(features)
    .get();
  const next = (result?.maxKey ? Number(result.maxKey) : 0) + 1;
  return `MAE-${next}`;
}

export function listFeatures(filters?: { status?: string; agentId?: string }) {
  const db = getDb();
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(features.status, filters.status));
  }
  if (filters?.agentId) {
    conditions.push(eq(features.agentId, filters.agentId));
  }
  const query = db.select().from(features).orderBy(desc(features.createdAt));
  if (conditions.length > 0) {
    return query.where(and(...conditions)).all();
  }
  return query.all();
}

export function getFeature(id: string) {
  const db = getDb();
  return db.select().from(features).where(eq(features.id, id)).get();
}

export function createFeature(data: {
  title: string;
  description?: string;
  priority?: number;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();
  const key = getNextKey();
  const row = {
    id,
    key,
    title: data.title,
    description: data.description ?? null,
    priority: data.priority ?? 0,
    status: "backlog",
    agentId: null,
    branch: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(features).values(row).run();
  return row;
}

export function updateFeature(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    priority: number;
    agentId: string;
    branch: string;
  }>
) {
  const db = getDb();
  const now = new Date().toISOString();
  db.update(features)
    .set({ ...data, updatedAt: now })
    .where(eq(features.id, id))
    .run();
  return getFeature(id);
}

export function deleteFeature(id: string) {
  const db = getDb();
  db.delete(features).where(eq(features.id, id)).run();
}
