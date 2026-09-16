"use client";

export class ApiError extends Error {}

export async function apiPost<T = unknown>(
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json.error ?? "Erreur serveur");
  }
  return json as T;
}
