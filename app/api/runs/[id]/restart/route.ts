import { NextRequest } from "next/server";
import { resourceHandler, ok, notFound, badRequest } from "@/lib/api";
import { getRun } from "@/lib/services/run-service";
import { getAgent } from "@/lib/services/agent-service";
import { executeRun } from "@/lib/claude/agent-runner";

export const POST = resourceHandler(async (_req: NextRequest, id: string) => {
  const run = getRun(id);
  if (!run) return notFound("Run");

  if (run.status === "running") {
    return badRequest("Run is still running");
  }

  if (!run.agentId) {
    return badRequest("Run has no agent");
  }

  const agent = getAgent(run.agentId);
  if (!agent) return notFound("Agent");

  const config = JSON.parse(agent.config);

  const runId = await executeRun({
    agentId: run.agentId,
    featureId: run.featureId ?? undefined,
    prompt: run.prompt ?? "Continue the previous task.",
    config: {
      model: config.model,
      effort: config.effort,
      maxTurnsPerRun: config.maxTurnsPerRun,
      skipPermissions: config.skipPermissions,
    },
    cwd: process.cwd(),
    sessionId: run.sessionId ?? undefined,
    timeoutSec: config.timeoutSec,
    graceSec: config.graceSec,
  });

  return ok({ runId });
});
