/**
 * Parse idling duration strings from reports into seconds for sorting.
 * Handles common patterns: "2h 30m", "01:30:00", "90 min", plain numbers.
 */
export function parseIdlingToSeconds(s: string | null): number {
  if (!s?.trim()) return 0;
  const raw = s.trim().toLowerCase();

  const triple = raw.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (triple) {
    return (
      parseInt(triple[1], 10) * 3600 +
      parseInt(triple[2], 10) * 60 +
      parseInt(triple[3], 10)
    );
  }

  const double = raw.match(/^(\d+):(\d{2})$/);
  if (double) {
    return parseInt(double[1], 10) * 60 + parseInt(double[2], 10);
  }

  let sec = 0;
  const h = raw.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?/);
  const m = raw.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?/);
  const sc = raw.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?/);
  if (h) sec += parseFloat(h[1]) * 3600;
  if (m) sec += parseFloat(m[1]) * 60;
  if (sc) sec += parseFloat(sc[1]);

  if (sec > 0) return Math.round(sec);

  const digits = raw.replace(/[^\d.]/g, "");
  const n = parseFloat(digits);
  return Number.isFinite(n) ? n * 60 : 0;
}
