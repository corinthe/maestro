import { NextRequest, NextResponse } from "next/server";
import { handler, ok, badRequest, notFound } from "@/lib/api";
import { getAgent } from "@/lib/services/agent-service";
import { executeRun, listActiveRunIds } from "@/lib/claude/agent-runner";
import { validateRunStart } from "@/lib/validation";
import { canSpawnAgent, getMaxConcurrentAgents } from "@/lib/rate-limit";

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json();
  const v = validateRunStart(body);
  if (!v.ok) return badRequest(v.message);

  const { agentId, featureId, prompt } = body;

  const agent = getAgent(agentId);
  if (!agent) return notFound("Agent");

  // Check concurrent agent limit
  if (!canSpawnAgent(listActiveRunIds().length)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: `Maximum concurrent agents (${getMaxConcurrentAgents()}) reached` } },
      { status: 429 },
    );
  }

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
