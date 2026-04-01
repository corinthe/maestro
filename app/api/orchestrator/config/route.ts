import { NextRequest } from "next/server";
import { handler, ok, badRequest } from "@/lib/api";
import {
  getHeartbeatConfig,
  setHeartbeatConfig,
} from "@/lib/orchestrator";
import { restartHeartbeat } from "@/lib/orchestrator/heartbeat";
import { validateHeartbeatConfig } from "@/lib/validation";

export const GET = handler(async () => {
  return ok(getHeartbeatConfig());
});

export const PATCH = handler(async (request: NextRequest) => {
  const body = await request.json();
  const v = validateHeartbeatConfig(body);
  if (!v.ok) return badRequest(v.message);
  setHeartbeatConfig(body);
  restartHeartbeat();
  return ok(getHeartbeatConfig());
});
