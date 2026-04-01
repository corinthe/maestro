import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { wakeOrchestrator } from "@/lib/orchestrator";

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}));
  const reason = body.reason ?? "manual";
  const result = await wakeOrchestrator(reason);
  return ok(result);
});
