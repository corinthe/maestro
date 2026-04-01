import { NextRequest } from "next/server";
import { handler, ok, created, badRequest } from "@/lib/api";
import { listMessages, createMessage } from "@/lib/services/message-service";

export const GET = handler((request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? undefined;
  return ok(listMessages({ status }));
});

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json();
  if (!body.content || typeof body.content !== "string") {
    return badRequest("content is required");
  }
  return created(
    createMessage({
      content: body.content,
      targetAgent: body.targetAgent ?? undefined,
      featureId: body.featureId ?? undefined,
    }),
  );
});
