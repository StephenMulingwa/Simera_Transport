import { WIALON_BASE } from "./config";

export type WialonJson = Record<string, unknown> | unknown[] | string | number | null;

export async function wialonCall<T = WialonJson>(
  svc: string,
  params: Record<string, unknown>,
  sid?: string,
): Promise<T> {
  const body: Record<string, string> = {
    svc,
    params: JSON.stringify(params),
  };
  if (sid) body.sid = sid;
  const r = await fetch(WIALON_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    next: { revalidate: 0 },
  });
  if (!r.ok) {
    throw new Error(`Telemetry API HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export function apiError(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    (payload as { error?: unknown }).error != null &&
    (payload as { error?: unknown }).error !== 0
  );
}

export function reportStatusCode(st: unknown): number | null {
  if (typeof st !== "object" || st === null || !("status" in st)) return null;
  const raw = (st as { status?: unknown }).status;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
