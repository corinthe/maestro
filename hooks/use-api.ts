"use client";

import { useEffect, useState, useCallback } from "react";

type UseApiResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useApi<T>(url: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        return;
      }
      const json = await res.json();
      setData(json.data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

async function apiMutate<T>(method: string, url: string, body?: unknown): Promise<{ data?: T; error?: string }> {
  try {
    const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const json = await res.json();
    if (!res.ok) return { error: json.error?.message ?? "Request failed" };
    return { data: json.data };
  } catch {
    return { error: "Network error" };
  }
}

export function apiPost<T>(url: string, body: unknown) {
  return apiMutate<T>("POST", url, body);
}

export function apiPatch<T>(url: string, body: unknown) {
  return apiMutate<T>("PATCH", url, body);
}

export function apiDelete<T>(url: string) {
  return apiMutate<T>("DELETE", url);
}
