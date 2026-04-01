import { NextRequest } from "next/server";
import { resourceHandler, ok } from "@/lib/api";
import { getRunEvents } from "@/lib/services/run-service";

export const GET = resourceHandler((request: NextRequest, id: string) => {
  const { searchParams } = request.nextUrl;
  const limit = searchParams.get("limit")
    ? Number(searchParams.get("limit"))
    : undefined;
  const offset = searchParams.get("offset")
    ? Number(searchParams.get("offset"))
    : undefined;
  return ok(getRunEvents(id, { limit, offset }));
});
