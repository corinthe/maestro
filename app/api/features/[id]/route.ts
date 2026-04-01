import { NextRequest, NextResponse } from "next/server";
import {
  getFeature,
  updateFeature,
  deleteFeature,
} from "@/lib/services/feature-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = getFeature(id);
    if (!result) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Feature not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get feature" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validFields: Record<string, unknown> = {};
    const allowedKeys = ["title", "description", "status", "priority", "agentId", "branch"];
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        validFields[key] = body[key];
      }
    }

    const result = updateFeature(id, validFields);
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update feature" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    deleteFeature(id);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete feature" } },
      { status: 500 }
    );
  }
}
