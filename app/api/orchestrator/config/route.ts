import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import {
  getHeartbeatConfig,
  setHeartbeatConfig,
} from "@/lib/orchestrator";
import { restartHeartbeat } from "@/lib/orchestrator/heartbeat";

export const GET = handler(async () => {
  return ok(getHeartbeatConfig());
});

export const PATCH = handler(async (request: NextRequest) => {
  const body = await request.json();
  setHeartbeatConfig(body);
  restartHeartbeat();
  return ok(getHeartbeatConfig());
});
