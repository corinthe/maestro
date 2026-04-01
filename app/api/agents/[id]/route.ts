import { NextRequest, NextResponse } from "next/server";
import {
  getAgent,
  updateAgent,
  deleteAgent,
} from "@/lib/services/agent-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = getAgent(id);
    if (!result) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Agent not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get agent" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validFields: Record<string, unknown> = {};
    const allowedKeys = ["name", "description", "config", "status"];
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        validFields[key] = body[key];
      }
    }

    const result = updateAgent(id, validFields);
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update agent" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    deleteAgent(id);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete agent" } },
      { status: 500 }
    );
  }
}
