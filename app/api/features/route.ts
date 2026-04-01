import { NextRequest } from "next/server";
import { handler, ok, created, badRequest } from "@/lib/api";
import { listFeatures, createFeature } from "@/lib/services/feature-service";
import { validateFeatureCreate } from "@/lib/validation";

export const GET = handler((request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? undefined;
  const agentId = searchParams.get("agentId") ?? undefined;
  return ok(listFeatures({ status, agentId }));
});

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json();
  const v = validateFeatureCreate(body);
  if (!v.ok) return badRequest(v.message);
  return created(
    createFeature({
      title: body.title,
      description: body.description ?? undefined,
      priority: body.priority ?? undefined,
    }),
  );
});
