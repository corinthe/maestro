import { v4 as uuidv4 } from "uuid";
import { eq, desc, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { ORCHESTRATOR_AGENT_NAME } from "@/lib/types";

export function listAgents() {
  const db = getDb();
  return db.select().from(agents).where(ne(agents.name, ORCHESTRATOR_AGENT_NAME)).orderBy(desc(agents.createdAt)).all();
}

export function getAgent(id: string) {
  const db = getDb();
  return db.select().from(agents).where(eq(agents.id, id)).get();
}

export function createAgent(data: {
  name: string;
  description?: string;
  config: object;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();
  const row = {
    id,
    name: data.name,
    description: data.description ?? null,
    config: JSON.stringify(data.config),
    status: "idle",
    createdAt: now,
    updatedAt: now,
  };
  db.insert(agents).values(row).run();
  return row;
}

export function updateAgent(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    config: object | string;
    status: string;
  }>
) {
  const db = getDb();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { ...data, updatedAt: now };
  if (data.config !== undefined && typeof data.config === "object") {
    updates.config = JSON.stringify(data.config);
  }
  db.update(agents)
    .set(updates)
    .where(eq(agents.id, id))
    .run();
  return getAgent(id);
}

export function deleteAgent(id: string) {
  const db = getDb();
  db.delete(agents).where(eq(agents.id, id)).run();
}

export function setAgentStatus(id: string, status: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.update(agents)
    .set({ status, updatedAt: now })
    .where(eq(agents.id, id))
    .run();
  return getAgent(id);
}
