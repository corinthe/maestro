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
import * as featureService from "../services/feature-service.js";
import * as agentService from "../services/agent-service.js";
import * as runService from "../services/run-service.js";
import * as messageService from "../services/message-service.js";
import { pickFields } from "../api.js";

const MAESTRO_PORT = process.env.MAESTRO_PORT ?? "4200";
const API_BASE = `http://localhost:${MAESTRO_PORT}`;

// --- Tool schema helper ---

function toolDef(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required?: string[]
) {
  return {
    name,
    description,
    inputSchema: {
      type: "object" as const,
      properties,
      ...(required ? { required } : {}),
    },
  };
}

const TOOLS = [
  toolDef(
    "list_features",
    "List all features with status, priority, and assigned agent. Use to survey the backlog and find work to assign.",
    {
      status: {
        type: "string",
        enum: ["backlog", "in_progress", "done", "cancelled"],
        description: "Filter by status",
      },
    }
  ),
  toolDef(
    "get_feature",
    "Get full details of a specific feature by ID.",
    { id: { type: "string", description: "Feature ID" } },
    ["id"]
  ),
  toolDef(
    "update_feature",
    "Update a feature: change status, assign to agent, set priority, or set branch.",
    {
      id: { type: "string", description: "Feature ID" },
      status: {
        type: "string",
        enum: ["backlog", "in_progress", "done", "cancelled"],
      },
      agentId: { type: "string", description: "Agent ID to assign" },
      priority: { type: "number" },
      branch: { type: "string" },
    },
    ["id"]
  ),
  toolDef(
    "list_agents",
    "List all agents with their status (idle/running/stopped) and config.",
    {}
  ),
  toolDef(
    "get_agent",
    "Get full details of a specific agent by ID.",
    { id: { type: "string", description: "Agent ID" } },
    ["id"]
  ),
  toolDef(
    "start_agent_run",
    "Start a Claude CLI run for an agent. The agent will execute the given prompt. Returns the run ID.",
    {
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
    ["agentId", "prompt"]
  ),
  toolDef(
    "stop_agent_run",
    "Stop a currently running agent run.",
    { runId: { type: "string", description: "Run ID to stop" } },
    ["runId"]
  ),
  toolDef(
    "list_runs",
    "List recent runs, optionally filtered by agent, feature, or status.",
    {
      agentId: { type: "string" },
      featureId: { type: "string" },
      status: { type: "string" },
    }
  ),
  toolDef(
    "get_run",
    "Get details of a specific run by ID.",
    { id: { type: "string", description: "Run ID" } },
    ["id"]
  ),
  toolDef(
    "list_messages",
    "List user messages. Filter by status to see pending messages that need attention.",
    {
      status: {
        type: "string",
        enum: ["pending", "read"],
        description: "Filter by status",
      },
    }
  ),
  toolDef(
    "mark_message_read",
    "Mark a user message as read after processing it.",
    { id: { type: "string", description: "Message ID" } },
    ["id"]
  ),
];

// --- Tool handlers (reuse existing service modules) ---

type Args = Record<string, unknown>;
type ToolHandler = (args: Args) => unknown | Promise<unknown>;

const handlers: Record<string, ToolHandler> = {
  list_features: (args) =>
    featureService.listFeatures({
      status: args.status as string | undefined,
    }),

  get_feature: (args) => featureService.getFeature(args.id as string),

  update_feature: (args) => {
    const fields = pickFields(args as Record<string, unknown>, [
      "status",
      "agentId",
      "priority",
      "branch",
    ]);
    return featureService.updateFeature(args.id as string, fields);
  },

  list_agents: () => agentService.listAgents(),

  get_agent: (args) => agentService.getAgent(args.id as string),

  async start_agent_run(args) {
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
  },

  async stop_agent_run(args) {
    const res = await fetch(`${API_BASE}/api/runs/${args.runId}/stop`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    return json.data;
  },

  list_runs: (args) =>
    runService.listRuns({
      agentId: args.agentId as string | undefined,
      featureId: args.featureId as string | undefined,
      status: args.status as string | undefined,
    }),

  get_run: (args) => runService.getRun(args.id as string),

  list_messages: (args) =>
    messageService.listMessages({
      status: args.status as string | undefined,
    }),

  mark_message_read: (args) => messageService.markAsRead(args.id as string),
};

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
  const handler = handlers[name];

  if (!handler) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await handler(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
