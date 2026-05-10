import type { ReportRow } from "@/lib/wialon/report";
import { mergeMatchingTables, pickDf } from "./tables";

const FUEL_FILL = /fuel\s*fill|fillings|battery\s*charg/i;
const FUEL_DRAIN = /fuel\s*drain|drains/i;
const ENGINE = /engine|hour|idl|idle/i;
const LATEST = /unit\s*latest|latest\s*data/i;
const ECO = /eco/i;

function tableByExactName(
  dfs: Record<string, ReportRow[]>,
  name: string,
): ReportRow[] {
  const k = Object.keys(dfs).find(
    (x) => x.trim().toLowerCase() === name.toLowerCase(),
  );
  return k ? (dfs[k] ?? []).map((r) => ({ ...r })) : [];
}

export type ReportBundle = {
  fuelFillings: ReportRow[];
  fuelDrains: ReportRow[];
  engineHours: ReportRow[];
  unitLatest: ReportRow[];
  summary: ReportRow[];
  eco: ReportRow[];
  rawKeys: string[];
};

export function buildReportBundle(dfs: Record<string, ReportRow[]>): ReportBundle {
  const rawKeys = Object.keys(dfs);

  function safePick(pattern: RegExp, label: string): ReportRow[] {
    try {
      return pickDf(dfs, pattern, label).rows;
    } catch {
      return [];
    }
  }

  const ecoMerged = mergeMatchingTables(dfs, ECO);

  return {
    fuelFillings: safePick(FUEL_FILL, "fuel_fill"),
    fuelDrains: safePick(FUEL_DRAIN, "fuel_drain"),
    engineHours: safePick(ENGINE, "engine"),
    unitLatest: safePick(LATEST, "latest"),
    summary: tableByExactName(dfs, "Summary"),
    eco: ecoMerged.length ? ecoMerged : safePick(ECO, "eco"),
    rawKeys,
  };
}
