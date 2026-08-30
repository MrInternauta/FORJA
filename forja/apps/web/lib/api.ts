import { getAccessToken } from "./supabase/client";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fetch tipado hacia la API NestJS con Bearer del token de Supabase. */
export async function api<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${res.status} en ${path}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
