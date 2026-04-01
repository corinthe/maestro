import { NextRequest, NextResponse } from "next/server";
import { listAgents, createAgent } from "@/lib/services/agent-service";

export async function GET() {
  try {
    const result = listAgents();
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list agents" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, config } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "name is required" } },
        { status: 400 }
      );
    }

    const result = createAgent({
      name,
      description: description ?? undefined,
      config: config ?? {},
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create agent" } },
      { status: 500 }
    );
  }
}
