import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  config: text("config").notNull(), // JSON
  status: text("status").notNull().default("idle"), // idle | running | stopped
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const features = sqliteTable("features", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(), // MAE-1, MAE-2...
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"), // backlog | in_progress | done | cancelled
  agentId: text("agent_id").references(() => agents.id),
  branch: text("branch"),
  priority: integer("priority").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").references(() => agents.id),
    featureId: text("feature_id").references(() => features.id),
    runType: text("run_type").notNull().default("agent"), // agent | orchestrator
    status: text("status").notNull().default("queued"), // queued | running | succeeded | failed | stopped | timed_out
    sessionId: text("session_id"),
    prompt: text("prompt"),
    summary: text("summary"),
    model: text("model"),
    inputTokens: integer("input_tokens").default(0),
    outputTokens: integer("output_tokens").default(0),
    cachedTokens: integer("cached_tokens").default(0),
    costUsd: real("cost_usd").default(0),
    exitCode: integer("exit_code"),
    pid: integer("pid"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_runs_status").on(table.status),
    index("idx_runs_agent").on(table.agentId),
    index("idx_runs_type").on(table.runType),
  ]
);

export const runEvents = sqliteTable(
  "run_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").notNull(), // system | assistant | user | result
    subtype: text("subtype"), // init, text, tool_use, tool_result, thinking...
    data: text("data").notNull(), // JSON
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_run_events_run_seq").on(table.runId, table.seq),
    index("idx_run_events_created").on(table.createdAt),
  ]
);

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  filePath: text("file_path").notNull(),
  checksum: text("checksum"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agentSkills = sqliteTable("agent_skills", {
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "cascade" }),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull(), // agent | orchestrator
    agentId: text("agent_id").references(() => agents.id),
    featureId: text("feature_id").references(() => features.id),
    claudeSessionId: text("claude_session_id").notNull(),
    lastRunId: text("last_run_id").references(() => runs.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_sessions_agent_feature").on(table.agentId, table.featureId),
    index("idx_sessions_owner").on(table.ownerType),
  ]
);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  targetAgent: text("target_agent").references(() => agents.id),
  featureId: text("feature_id").references(() => features.id),
  status: text("status").notNull().default("pending"), // pending | read
  createdAt: text("created_at").notNull(),
  readAt: text("read_at"),
});

export const proposals = sqliteTable("proposals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  model: text("model").notNull(),
  instructions: text("instructions").notNull(),
  skills: text("skills"), // JSON array
  rationale: text("rationale").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
