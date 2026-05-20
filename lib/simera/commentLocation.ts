import { parseReportDateTime } from "./parsers";
import { formatAppDateTime } from "./appTime";

/**
 * Location strings from telemetry often embed `dd.mm.yyyy hh:mm:ss` using the same
 * convention as report "Beginning" — treat as East Africa wall clock, then rewrite
 * as a single EAT display string so DB exports match the operator clock.
 */
export function normalizeLocationTextForStorage(raw: string): string {
  return raw.replace(
    /\b(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\b/g,
    (chunk) => {
      const d = parseReportDateTime(chunk);
      return d ? formatAppDateTime(d) : chunk;
    },
  );
}
