#!/usr/bin/env node
/**
 * Maestro MCP server — exposes project management tools to the orchestrator Claude.
 * Runs as a standalone stdio process, spawned by Claude CLI via --mcp-config.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getDb } from "../db/index.js";
import { features, agents, runs, messages } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";

const MAESTRO_PORT = process.env.MAESTRO_PORT ?? "4200";
const API_BASE = `http://localhost:${MAESTRO_PORT}`;

const TOOLS = [
  {
    name: "list_features",
    description:
      "List all features with status, priority, and assigned agent. Use to survey the backlog and find work to assign.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["backlog", "in_progress", "done", "cancelled"],
          description: "Filter by status",
        },
      },
    },
  },
  {
    name: "get_feature",
    description: "Get full details of a specific feature by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Feature ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_feature",
    description:
      "Update a feature: change status, assign to agent, set priority, or set branch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Feature ID" },
        status: {
          type: "string",
          enum: ["backlog", "in_progress", "done", "cancelled"],
        },
        agentId: { type: "string", description: "Agent ID to assign" },
        priority: { type: "number" },
        branch: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_agents",
    description:
      "List all agents with their status (idle/running/stopped) and config.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_agent",
    description: "Get full details of a specific agent by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Agent ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "start_agent_run",
    description:
      "Start a Claude CLI run for an agent. The agent will execute the given prompt. Returns the run ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agentId: { type: "string", description: "Agent ID" },
        featureId: {
          type: "string",
          description: "Feature ID to associate with the run",
        },
        prompt: {
          type: "string",
          description: "The prompt/instructions for the agent",
        },
      },
      required: ["agentId", "prompt"],
    },
  },
  {
    name: "stop_agent_run",
    description: "Stop a currently running agent run.",
    inputSchema: {
      type: "object" as const,
      properties: {
        runId: { type: "string", description: "Run ID to stop" },
      },
      required: ["runId"],
    },
  },
  {
    name: "list_runs",
    description: "List recent runs, optionally filtered by agent, feature, or status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agentId: { type: "string" },
        featureId: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "get_run",
    description: "Get details of a specific run by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Run ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_messages",
    description:
      "List user messages. Filter by status to see pending messages that need attention.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["pending", "read"],
          description: "Filter by status",
        },
      },
    },
  },
  {
    name: "mark_message_read",
    description: "Mark a user message as read after processing it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Message ID" },
      },
      required: ["id"],
    },
  },
];

// --- Tool handlers ---

function handleListFeatures(args: Record<string, unknown>) {
  const db = getDb();
  const conditions = [];
  if (args.status) conditions.push(eq(features.status, args.status as string));
  const query = db.select().from(features).orderBy(desc(features.createdAt));
  const rows = conditions.length > 0
    ? query.where(and(...conditions)).all()
    : query.all();
  return rows;
}

function handleGetFeature(args: Record<string, unknown>) {
  const db = getDb();
  return db.select().from(features).where(eq(features.id, args.id as string)).get();
}

function handleUpdateFeature(args: Record<string, unknown>) {
  const db = getDb();
  const id = args.id as string;
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (args.status !== undefined) updates.status = args.status;
  if (args.agentId !== undefined) updates.agentId = args.agentId;
  if (args.priority !== undefined) updates.priority = args.priority;
  if (args.branch !== undefined) updates.branch = args.branch;
  db.update(features).set(updates).where(eq(features.id, id)).run();
  return db.select().from(features).where(eq(features.id, id)).get();
}

function handleListAgents() {
  const db = getDb();
  return db.select().from(agents).orderBy(desc(agents.createdAt)).all();
}

function handleGetAgent(args: Record<string, unknown>) {
  const db = getDb();
  return db.select().from(agents).where(eq(agents.id, args.id as string)).get();
}

async function handleStartAgentRun(args: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/runs/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: args.agentId,
      featureId: args.featureId,
      prompt: args.prompt,
    }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error };
  return json.data;
}

async function handleStopAgentRun(args: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/runs/${args.runId}/stop`, {
    method: "POST",
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error };
  return json.data;
}

function handleListRuns(args: Record<string, unknown>) {
  const db = getDb();
  const conditions = [];
  if (args.agentId) conditions.push(eq(runs.agentId, args.agentId as string));
  if (args.featureId) conditions.push(eq(runs.featureId, args.featureId as string));
  if (args.status) conditions.push(eq(runs.status, args.status as string));
  const query = db.select().from(runs).orderBy(desc(runs.createdAt)).limit(50);
  return conditions.length > 0
    ? query.where(and(...conditions)).all()
    : query.all();
}

function handleGetRun(args: Record<string, unknown>) {
  const db = getDb();
  return db.select().from(runs).where(eq(runs.id, args.id as string)).get();
}

function handleListMessages(args: Record<string, unknown>) {
  const db = getDb();
  const query = db.select().from(messages).orderBy(desc(messages.createdAt));
  if (args.status) {
    return query.where(eq(messages.status, args.status as string)).all();
  }
  return query.all();
}

function handleMarkMessageRead(args: Record<string, unknown>) {
  const db = getDb();
  const id = args.id as string;
  const now = new Date().toISOString();
  db.update(messages).set({ status: "read", readAt: now }).where(eq(messages.id, id)).run();
  return db.select().from(messages).where(eq(messages.id, id)).get();
}

// --- Server setup ---

const server = new Server(
  { name: "maestro", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "list_features":
        result = handleListFeatures(args);
        break;
      case "get_feature":
        result = handleGetFeature(args);
        break;
      case "update_feature":
        result = handleUpdateFeature(args);
        break;
      case "list_agents":
        result = handleListAgents();
        break;
      case "get_agent":
        result = handleGetAgent(args);
        break;
      case "start_agent_run":
        result = await handleStartAgentRun(args);
        break;
      case "stop_agent_run":
        result = await handleStopAgentRun(args);
        break;
      case "list_runs":
        result = handleListRuns(args);
        break;
      case "get_run":
        result = handleGetRun(args);
        break;
      case "list_messages":
        result = handleListMessages(args);
        break;
      case "mark_message_read":
        result = handleMarkMessageRead(args);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
