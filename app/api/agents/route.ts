import { NextRequest } from "next/server";
import { handler, ok, created, badRequest } from "@/lib/api";
import { listAgents, createAgent } from "@/lib/services/agent-service";

export const GET = handler(() => {
  return ok(listAgents());
});

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json();
  if (!body.name || typeof body.name !== "string") {
    return badRequest("name is required");
  }
  return created(
    createAgent({
      name: body.name,
      description: body.description ?? undefined,
      config: body.config ?? {},
    }),
  );
});
