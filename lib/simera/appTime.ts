import { parseReportDateTime } from "./parsers";

/**
 * Single source of truth for operator-facing time formatting.
 *
 * - Everything renders in **East Africa Time** (`Africa/Nairobi`, UTC+3, no DST).
 * - `parseReportDateTime` already interprets naive Wialon strings as `+03:00`,
 *   so the parsed `Date` is the correct absolute instant. Formatting in
 *   `Africa/Nairobi` then yields the operator wall clock — no extra shift.
 */
export const APP_TIMEZONE = "Africa/Nairobi";

const FULL: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

const TIME_ONLY: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

function toDate(
  input: Date | string | number | null | undefined,
): Date | null {
  if (input == null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Full EAT date + time (e.g. `13/05/2026, 13:10:56`). */
export function formatAppDateTime(
  input: Date | string | number | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleString("en-GB", FULL);
}

/** EAT time-of-day only (e.g. `13:10:56`). */
export function formatAppTimeOnly(
  input: Date | string | number | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleTimeString("en-GB", TIME_ONLY);
}

// Aliases kept for clarity at call-sites (header badges labeled “EAT” etc.).
export const formatEatWallDateTime = formatAppDateTime;
export const formatEatWallTimeOnly = formatAppTimeOnly;

/** Prefer ISO from the API; otherwise parse common telemetry raw strings. */
export function formatTelemetryInstantDisplay(
  iso: string | null | undefined,
  rawFallback: string | null | undefined,
): string {
  if (iso) return formatAppDateTime(iso);
  if (rawFallback) {
    const d = parseReportDateTime(rawFallback);
    if (d) return formatAppDateTime(d);
    return rawFallback;
  }
  return "—";
}
