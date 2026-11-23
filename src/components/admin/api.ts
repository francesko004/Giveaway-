"use client";

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number, public details?: unknown) {
    super(message);
  }
}

/** JSON request to an admin API route. Throws ApiError with a user-safe message. */
export async function api<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE" | "GET" = "POST", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Network error — check your connection", "NETWORK", 0);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new ApiError("Session expired", "UNAUTHENTICATED", 401);
  }
  if (!res.ok || !data?.ok) {
    const details = data?.error?.details;
    const first = Array.isArray(details) && details[0] ? ` (${details[0].path}: ${details[0].message})` : "";
    throw new ApiError((data?.error?.message ?? "Request failed") + first, data?.error?.code ?? "ERROR", res.status, details);
  }
  return data.data as T;
}
