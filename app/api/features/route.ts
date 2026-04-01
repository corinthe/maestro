import { NextRequest } from "next/server";
import { handler, ok, created, badRequest } from "@/lib/api";
import { listFeatures, createFeature } from "@/lib/services/feature-service";

export const GET = handler((request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? undefined;
  const agentId = searchParams.get("agentId") ?? undefined;
  return ok(listFeatures({ status, agentId }));
});

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json();
  if (!body.title || typeof body.title !== "string") {
    return badRequest("title is required");
  }
  return created(
    createFeature({
      title: body.title,
      description: body.description ?? undefined,
      priority: body.priority ?? undefined,
    }),
  );
});
