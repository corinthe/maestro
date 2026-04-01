import { NextRequest } from "next/server";
import { resourceHandler, ok, notFound, badRequest } from "@/lib/api";
import { getMessage, markAsRead, deleteMessage } from "@/lib/services/message-service";
import { broadcast } from "@/lib/ws/server";

export const GET = resourceHandler((_req: NextRequest, id: string) => {
  const message = getMessage(id);
  if (!message) return notFound("Message");
  return ok(message);
});

export const PATCH = resourceHandler(async (request: NextRequest, id: string) => {
  const message = getMessage(id);
  if (!message) return notFound("Message");

  const body = await request.json();
  if (body.status === "read") {
    const updated = markAsRead(id);
    broadcast({ type: "message.read", messageId: id });
    return ok(updated);
  }

  return badRequest("Only status: \"read\" is supported");
});

export const DELETE = resourceHandler((_req: NextRequest, id: string) => {
  const message = getMessage(id);
  if (!message) return notFound("Message");
  deleteMessage(id);
  broadcast({ type: "message.deleted", messageId: id });
  return ok({ success: true });
});
