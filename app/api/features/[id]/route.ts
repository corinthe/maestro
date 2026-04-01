import { NextRequest } from "next/server";
import { resourceHandler, ok, notFound, pickFields } from "@/lib/api";
import {
  getFeature,
  updateFeature,
  deleteFeature,
} from "@/lib/services/feature-service";

export const GET = resourceHandler((_req: NextRequest, id: string) => {
  const feature = getFeature(id);
  return feature ? ok(feature) : notFound("Feature");
});

export const PATCH = resourceHandler(async (request: NextRequest, id: string) => {
  const body = await request.json();
  const fields = pickFields(body, [
    "title",
    "description",
    "status",
    "priority",
    "agentId",
    "branch",
  ]);
  return ok(updateFeature(id, fields));
});

export const DELETE = resourceHandler((_req: NextRequest, id: string) => {
  deleteFeature(id);
  return ok({ success: true });
});
