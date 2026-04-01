import { NextRequest, NextResponse } from "next/server";
import { listFeatures, createFeature } from "@/lib/services/feature-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const agentId = searchParams.get("agentId") ?? undefined;
    const result = listFeatures({ status, agentId });
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list features" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, priority } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "title is required" } },
        { status: 400 }
      );
    }

    const result = createFeature({
      title,
      description: description ?? undefined,
      priority: priority ?? undefined,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create feature" } },
      { status: 500 }
    );
  }
}
