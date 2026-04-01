import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function notFound(entity: string) {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: `${entity} not found` } },
    { status: 404 },
  );
}

export function badRequest(message: string) {
  return NextResponse.json(
    { error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

export function serverError() {
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    { status: 500 },
  );
}

// Handler for collection routes (no params)
export function handler(fn: (request: NextRequest) => Promise<NextResponse> | NextResponse) {
  return async (request: NextRequest) => {
    try {
      return await fn(request);
    } catch {
      return serverError();
    }
  };
}

// Handler for resource routes (with [id] param)
export function resourceHandler(fn: (request: NextRequest, id: string) => Promise<NextResponse> | NextResponse) {
  return async (request: NextRequest, ctx: RouteContext) => {
    try {
      const { id } = await ctx.params;
      return await fn(request, id);
    } catch {
      return serverError();
    }
  };
}

export function pickFields<T extends Record<string, unknown>>(
  body: T,
  allowed: string[],
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      result[key] = body[key];
    }
  }
  return result as Partial<T>;
}
