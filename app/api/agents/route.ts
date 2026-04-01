import { NextRequest } from "next/server";
import { handler, ok, created, badRequest } from "@/lib/api";
import { listAgents, createAgent } from "@/lib/services/agent-service";
import { validateAgentCreate } from "@/lib/validation";

export const GET = handler(() => {
  return ok(listAgents());
});

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json();
  const v = validateAgentCreate(body);
  if (!v.ok) return badRequest(v.message);
  return created(
    createAgent({
      name: body.name,
      description: body.description ?? undefined,
      config: body.config ?? {},
    }),
  );
});
