import { handler, ok } from "@/lib/api";
import { stopOrchestrator } from "@/lib/orchestrator";

export const POST = handler(async () => {
  const stopped = stopOrchestrator();
  return ok({ stopped });
});
