import { NextRequest } from "next/server";
import { handler, ok, created, badRequest } from "@/lib/api";
import { listMessages, createMessage } from "@/lib/services/message-service";
import { validateMessageCreate } from "@/lib/validation";

export const GET = handler((request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? undefined;
  return ok(listMessages({ status }));
});

export const POST = handler(async (request: NextRequest) => {
  const body = await request.json();
  const v = validateMessageCreate(body);
  if (!v.ok) return badRequest(v.message);
  return created(
    createMessage({
      content: body.content,
      targetAgent: body.targetAgent ?? undefined,
      featureId: body.featureId ?? undefined,
    }),
  );
});
