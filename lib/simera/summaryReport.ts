import type { ReportRow } from "@/lib/wialon/report";
import { extractRegistration } from "./parsers";

/** Pick cell value using case-insensitive exact column names (first match wins). */
function val(row: ReportRow, ...names: string[]): string {
  const lower = new Map(
    Object.keys(row).map((k) => [k.trim().toLowerCase(), k] as const),
  );
  for (const n of names) {
    const k = lower.get(n.trim().toLowerCase());
    if (k != null && row[k] != null) return String(row[k]);
  }
  return "";
}

/** Find first column whose header matches every regex part (for fuzzy headers). */
function valByPatterns(row: ReportRow, patterns: RegExp[]): string {
  outer: for (const key of Object.keys(row)) {
    const nk = key.trim().toLowerCase();
    for (const p of patterns) {
      if (!p.test(nk)) continue outer;
    }
    if (row[key] != null) return String(row[key]);
  }
  return "";
}

/** "269 km" / "2.53 km" → kilometers */
function parseKm(raw: string): number | null {
  const m = raw.match(/(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const v = parseFloat(m[1]!.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

/** "45.2 l" / "12,5 l" → liters */
function parseLiters(raw: string): number | null {
  const m = raw.match(/(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const v = parseFloat(m[1]!.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function formatExpectedConsumption(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "";
  // 1 liter for every 2.5 km
  const liters = km / 2.5;
  return `${liters.toFixed(2)} l`;
}

function formatKmPerLiter(km: number | null, liters: number | null): string {
  if (
    km == null ||
    liters == null ||
    !Number.isFinite(km) ||
    !Number.isFinite(liters) ||
    liters <= 0
  ) {
    return "";
  }
  return (km / liters).toFixed(2);
}

function formatLitersPer100Km(km: number | null, liters: number | null): string {
  if (
    km == null ||
    liters == null ||
    !Number.isFinite(km) ||
    !Number.isFinite(liters) ||
    km <= 0
  ) {
    return "";
  }
  return ((liters / km) * 100).toFixed(2);
}

/**
 * Summary sheet from telemetry → compact columns for the Summary report only.
 * Column order and labels match Simera Transport requirements.
 */
export function projectSummaryRows(rows: ReportRow[]): ReportRow[] {
  const out: ReportRow[] = [];
  for (const r of rows) {
    const grouping = val(r, "Grouping", "grouping");
    const vehicle =
      extractRegistration(grouping).trim() || grouping.trim();

    const mileageRaw =
      val(r, "Mileage in trips", "Mileage in Trips") ||
      valByPatterns(r, [/mileage/, /in/, /trip/]);
    const km = parseKm(mileageRaw);

    const engine = val(r, "Engine hours", "engine hours");
    const maxSpeed = val(r, "Max. speed", "Max speed") || valByPatterns(r, [/^max/, /speed$/]);
    const fuel = val(r, "Fuel consumed", "fuel consumed");
    const liters = parseLiters(fuel);

    const fillings = val(r, "Total fillings", "total fillings");
    const drains = val(r, "Total drains", "total drains");
    const filled = val(r, "Filled", "filled");
    const drained = val(r, "Drained", "drained");

    out.push({
      Vehicle: vehicle,
      "Engine hours": engine,
      "Mileage in Trips": mileageRaw,
      "Max. speed": maxSpeed,
      "Fuel consumed": fuel,
      "Expected Consumption": formatExpectedConsumption(km),
      "KM/L": formatKmPerLiter(km, liters),
      "L/100KM": formatLitersPer100Km(km, liters),
      "# Fillings": fillings,
      "#Drains": drains,
      "Total Filled": filled,
      "Total Drained": drained,
    });
  }
  return out;
}
