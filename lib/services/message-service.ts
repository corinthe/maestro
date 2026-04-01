import { v4 as uuidv4 } from "uuid";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { messages } from "@/lib/db/schema";

export function listMessages(filters?: { status?: string }) {
  const db = getDb();
  const query = db.select().from(messages).orderBy(desc(messages.createdAt));
  if (filters?.status) {
    return query.where(eq(messages.status, filters.status)).all();
  }
  return query.all();
}

export function createMessage(data: {
  content: string;
  targetAgent?: string;
  featureId?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();
  const row = {
    id,
    content: data.content,
    targetAgent: data.targetAgent ?? null,
    featureId: data.featureId ?? null,
    status: "pending",
    createdAt: now,
    readAt: null,
  };
  db.insert(messages).values(row).run();
  return row;
}

export function markAsRead(id: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.update(messages)
    .set({ status: "read", readAt: now })
    .where(eq(messages.id, id))
    .run();
  return db.select().from(messages).where(eq(messages.id, id)).get();
}
