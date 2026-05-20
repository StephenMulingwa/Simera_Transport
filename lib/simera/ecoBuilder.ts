import type { ReportRow } from "@/lib/wialon/report";
import { extractRegistration, parseDurationSec } from "./parsers";

/** Columns we try to surface for each violation row */
const WANT_COLS = [
  "Grouping",
  "Violation",
  "Beginning",
  "Initial location",
  "End",
  "Final location",
  "Speed",
  "Avg. speed",
  "Max. speed",
  "Duration",
  "Mileage",
  "Count",
  "Driver",
] as const;

/** "0.00 km" → number */
function parseKm(s: string): number | null {
  const m = s.match(/(-?\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]!) : null;
}

function lc(s: string): string {
  return s.toLowerCase();
}

/** Returns the original column name in `row` that case-insensitively
 *  equals `target`, or null. */
export function colKey(row: ReportRow, target: string): string | null {
  const t = lc(target);
  for (const k of Object.keys(row)) if (lc(k) === t) return k;
  return null;
}

export function val(row: ReportRow, ...names: string[]): string {
  for (const n of names) {
    const k = colKey(row, n);
    if (k && row[k] != null) return String(row[k]);
  }
  return "";
}

/** Violation text: canonical column or any column whose header contains "violation". */
export function violationText(row: ReportRow): string {
  const direct = val(row, "Violation").trim();
  if (direct && !/^-+$/.test(direct)) return direct;
  for (const k of Object.keys(row)) {
    if (!/violation/i.test(k)) continue;
    const s = String(row[k] ?? "").trim();
    if (s && !/^-+$/.test(s)) return s;
  }
  return "";
}

/** Filter eco leaf rows to only those that actually represent a violation
 *  event (Violation column is filled and not the placeholder "-----"). */
export function ecoOnlyDetail(eco: ReportRow[]): ReportRow[] {
  const out: ReportRow[] = [];
  for (const r of eco) {
    const v = violationText(r);
    if (!v) continue;
    out.push(r);
  }
  return out;
}

/** Apply junk filter from notebook: drop "harsh braking" entries shorter
 *  than `minDurationSec` AND zero-mileage. */
export function ecoCleanDetail(
  detail: ReportRow[],
  opts: { minDurationSec?: number } = {},
): ReportRow[] {
  const minDur = opts.minDurationSec ?? 3;
  const out: ReportRow[] = [];
  for (const r of detail) {
    const v = violationText(r).toLowerCase();
    const ds = parseDurationSec(val(r, "Duration"));
    const km = parseKm(val(r, "Mileage"));
    const isHarshBrake = /brak/.test(v);
    const shortDur = ds == null ? false : ds <= minDur;
    const zeroKm = km == null ? false : km <= 1e-6;
    if (isHarshBrake && shortDur && zeroKm) continue;
    out.push(r);
  }
  return out;
}

/** Per-vehicle pivot: counts of each Violation type, plus total. */
export function ecoSummary(detail: ReportRow[]): ReportRow[] {
  const byVehicle = new Map<
    string,
    {
      reg: string;
      grouping: string;
      driver: string;
      counts: Record<string, number>;
    }
  >();

  for (const r of detail) {
    const grouping = val(r, "Grouping").trim();
    const violation = violationText(r);
    const driver = val(r, "Driver").trim();
    if (!grouping || !violation) continue;
    const reg = extractRegistration(grouping) || grouping;
    const cur =
      byVehicle.get(reg) ??
      { reg, grouping, driver, counts: {} as Record<string, number> };
    cur.counts[violation] = (cur.counts[violation] ?? 0) + 1;
    if (!cur.driver && driver) cur.driver = driver;
    byVehicle.set(reg, cur);
  }

  const violationTypes = new Set<string>();
  for (const v of byVehicle.values()) {
    for (const k of Object.keys(v.counts)) violationTypes.add(k);
  }
  const types = [...violationTypes].sort();

  const rows: ReportRow[] = [];
  for (const v of byVehicle.values()) {
    const row: ReportRow = {
      Vehicle: v.reg,
      Grouping: v.grouping,
      Driver: v.driver || "—",
    };
    let total = 0;
    for (const t of types) {
      const c = v.counts[t] ?? 0;
      row[t] = c;
      total += c;
    }
    row["Total Violations"] = total;
    rows.push(row);
  }

  rows.sort(
    (a, b) =>
      Number(b["Total Violations"] ?? 0) - Number(a["Total Violations"] ?? 0),
  );
  return rows;
}

/** Convenience: keep only the canonical columns we care about, in order. */
export function projectEcoDetailColumns(rows: ReportRow[]): ReportRow[] {
  if (!rows.length) return rows;
  const present = WANT_COLS.filter((w) =>
    rows.some((r) => colKey(r, w) != null),
  );
  return rows.map((r) => {
    const o: ReportRow = {};
    for (const w of present) {
      const k = colKey(r, w);
      o[w] = k ? r[k] ?? null : null;
    }
    return o;
  });
}
