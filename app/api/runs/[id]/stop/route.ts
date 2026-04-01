import { NextRequest } from "next/server";
import { resourceHandler, ok, notFound, badRequest } from "@/lib/api";
import { getRun } from "@/lib/services/run-service";
import { stopRun } from "@/lib/claude/agent-runner";

export const POST = resourceHandler((_req: NextRequest, id: string) => {
  const run = getRun(id);
  if (!run) return notFound("Run");

  if (run.status !== "running") {
    return badRequest("Run is not running");
  }

  const stopped = stopRun(id);
  if (!stopped) {
    return badRequest("No active process found for this run");
  }

  return ok({ message: "Stop signal sent" });
});
