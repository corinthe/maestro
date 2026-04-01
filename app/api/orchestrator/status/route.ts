import { handler, ok } from "@/lib/api";
import {
  getOrchestratorStatus,
  getHeartbeatConfig,
} from "@/lib/orchestrator";

export const GET = handler(async () => {
  const status = getOrchestratorStatus();
  const heartbeat = getHeartbeatConfig();
  return ok({ ...status, heartbeat });
});
