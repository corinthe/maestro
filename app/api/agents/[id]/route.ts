import { NextRequest } from "next/server";
import { resourceHandler, ok, notFound, pickFields } from "@/lib/api";
import {
  getAgent,
  updateAgent,
  deleteAgent,
} from "@/lib/services/agent-service";

export const GET = resourceHandler((_req: NextRequest, id: string) => {
  const agent = getAgent(id);
  return agent ? ok(agent) : notFound("Agent");
});

export const PATCH = resourceHandler(async (request: NextRequest, id: string) => {
  const body = await request.json();
  const fields = pickFields(body, ["name", "description", "config", "status"]);
  return ok(updateAgent(id, fields));
});

export const DELETE = resourceHandler((_req: NextRequest, id: string) => {
  deleteAgent(id);
  return ok({ success: true });
});
