import { NextRequest } from "next/server";
import { handler, ok, badRequest, notFound } from "@/lib/api";
import { getAgent } from "@/lib/services/agent-service";
import { executeRun } from "@/lib/claude/agent-runner";

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json();
  const { agentId, featureId, prompt } = body;

  if (!agentId) return badRequest("agentId is required");
  if (!prompt) return badRequest("prompt is required");

  const agent = getAgent(agentId);
  if (!agent) return notFound("Agent");

  const config = JSON.parse(agent.config);

  const cwd = process.cwd();

  const runId = await executeRun({
    agentId,
    featureId,
    prompt,
    config: {
      model: config.model,
      effort: config.effort,
      maxTurnsPerRun: config.maxTurnsPerRun,
      skipPermissions: config.skipPermissions,
    },
    cwd,
    sessionId: body.sessionId,
    timeoutSec: config.timeoutSec,
    graceSec: config.graceSec,
  });

  return ok({ runId });
});
