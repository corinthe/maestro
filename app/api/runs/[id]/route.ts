import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/lib/services/run-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const result = getRun(id);
    if (!result) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Run not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get run" } },
      { status: 500 }
    );
  }
}
