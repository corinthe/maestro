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

export async function apiPost<T>(url: string, body: unknown): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error?.message ?? "Request failed" };
    return { data: json.data };
  } catch {
    return { error: "Network error" };
  }
}

export async function apiPatch<T>(url: string, body: unknown): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error?.message ?? "Request failed" };
    return { data: json.data };
  } catch {
    return { error: "Network error" };
  }
}
