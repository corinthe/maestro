import { NextRequest, NextResponse } from "next/server";
import { getRunEvents } from "@/lib/services/run-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : undefined;
    const offset = searchParams.get("offset")
      ? Number(searchParams.get("offset"))
      : undefined;

    const result = getRunEvents(id, { limit, offset });
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get run events" } },
      { status: 500 }
    );
  }
}
