import { NextRequest } from "next/server";
import { resourceHandler, ok, notFound, badRequest } from "@/lib/api";
import { getAgent, setAgentStatus } from "@/lib/services/agent-service";
import { listRuns } from "@/lib/services/run-service";
import { stopRun } from "@/lib/claude/agent-runner";
import { broadcast } from "@/lib/ws/server";

export const POST = resourceHandler((_req: NextRequest, id: string) => {
  const agent = getAgent(id);
  if (!agent) return notFound("Agent");

  if (agent.status !== "running") {
    return badRequest("Agent is not running");
  }

  // Stop all running runs for this agent
  const activeRuns = listRuns({ agentId: id, status: "running" });
  let stoppedCount = 0;
  for (const run of activeRuns) {
    if (stopRun(run.id)) {
      stoppedCount++;
    }
  }

  // Force agent status to stopped
  setAgentStatus(id, "stopped");
  broadcast({ type: "agent.status", agentId: id, status: "stopped" });

  return ok({ message: `Agent stopped, ${stoppedCount} run(s) terminated` });
});
