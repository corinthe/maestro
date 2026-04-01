import { NextRequest, NextResponse } from "next/server";
import { listMessages, createMessage } from "@/lib/services/message-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const result = listMessages({ status });
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list messages" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, targetAgent, featureId } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "content is required" } },
        { status: 400 }
      );
    }

    const result = createMessage({
      content,
      targetAgent: targetAgent ?? undefined,
      featureId: featureId ?? undefined,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create message" } },
      { status: 500 }
    );
  }
}
