import { NextRequest } from "next/server";
import { resourceHandler, ok, notFound } from "@/lib/api";
import { getRun } from "@/lib/services/run-service";

export const GET = resourceHandler((_req: NextRequest, id: string) => {
  const run = getRun(id);
  return run ? ok(run) : notFound("Run");
});
