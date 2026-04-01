import { NextRequest, NextResponse } from "next/server";
import { listRuns } from "@/lib/services/run-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const agentId = searchParams.get("agentId") ?? undefined;
    const featureId = searchParams.get("featureId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const result = listRuns({ agentId, featureId, status });
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list runs" } },
      { status: 500 }
    );
  }
}
