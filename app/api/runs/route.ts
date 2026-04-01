import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { listRuns } from "@/lib/services/run-service";

export const GET = handler((request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId") ?? undefined;
  const featureId = searchParams.get("featureId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  return ok(listRuns({ agentId, featureId, status }));
});
