import { createHash } from "node:crypto";
import { CARD_LABELS, type DriverCardId } from "@/lib/simera/driverUi";
import type { ReportRow } from "@/lib/wialon/report";
import {
  extractRegistration,
  googleMapsSearchUrl,
  parseReportDateTime,
} from "./parsers";
import { mergeMatchingTables, normGrouping, pickDf } from "./tables";
import { violationText } from "./ecoBuilder";
import { resolveDriverDisplay } from "@/lib/driverPhones";

const MAIN_PATTERN =
  /grouping|last|message|monitor|fleet|unit|online|connection|latest/i;
const ECO_PATTERN = /eco/i;

/** Normalize report Violation column to card id */
export function violationToCardId(raw: string): DriverCardId | null {
  const v = raw.trim().toLowerCase();
  if (/over\s*speed|overspeed/.test(v)) return "overspeeding";
  if (/harsh\s*brak/.test(v)) return "harsh_braking";
  if (/harsh\s*corner|cornering/.test(v)) return "harsh_cornering";
  if (/harsh\s*accel/.test(v)) return "harsh_acceleration";
  if (/over\s*rev|overrev/.test(v)) return "overrevving";
  if (/idl/.test(v)) return "idling";
  return null;
}

export type DriverIncidentRow = {
  id: string;
  vehicle: string;
  violationLabel: string;
  violationRaw: string;
  /** Used by UI filter chips */
  filterCard: DriverCardId | "other";
  driverDisplayName: string;
  phone: string;
  violationTime: string | null;
  violationTimeIso: string | null;
  locationInitial: string | null;
  locationInitialUrl: string | null;
  locationFinal: string | null;
  locationFinalUrl: string | null;
};

function firstCol(row: ReportRow, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] != null && row[k] !== "") return row[k];
  }
  return null;
}

export function buildDriverIncidents(dfs: Record<string, ReportRow[]>): {
  counts: Record<DriverCardId, number>;
  incidents: DriverIncidentRow[];
  offlineCount: number;
} {
  let ecoRows: ReportRow[] = mergeMatchingTables(dfs, ECO_PATTERN);
  if (!ecoRows.length) {
    try {
      ecoRows = pickDf(dfs, ECO_PATTERN, "eco").rows;
    } catch {
      ecoRows = [];
    }
  }

  let mainRows: ReportRow[] = [];
  try {
    mainRows = pickDf(dfs, MAIN_PATTERN, "main").rows;
  } catch {
    mainRows = [];
  }

  const counts: Record<DriverCardId, number> = {
    overspeeding: 0,
    harsh_braking: 0,
    harsh_cornering: 0,
    harsh_acceleration: 0,
    overrevving: 0,
    idling: 0,
    offline: 0,
  };

  const incidents: DriverIncidentRow[] = [];
  const hourAgo = Date.now() - 60 * 60 * 1000;

  for (const r of ecoRows) {
    const violRaw = violationText(r);
    // Skip parent / placeholder rows: empty Violation, or "-----" filler.
    if (!violRaw || /^-+$/.test(violRaw)) continue;
    const card = violationToCardId(violRaw);
    const grouping = normGrouping(firstCol(r, ["Grouping", "grouping"]));
    if (!grouping) continue;

    const beginning = String(firstCol(r, ["Beginning", "beginning"]) ?? "");
    const bt = parseReportDateTime(beginning);
    if (bt && bt.getTime() < hourAgo) continue;

    const vehicle = extractRegistration(grouping) || grouping;
    const driverRaw = String(firstCol(r, ["Driver", "driver"]) ?? "");

    const locInit = String(
      firstCol(r, ["Initial location", "initial location"]) ?? "",
    ).trim();
    const locFin = String(
      firstCol(r, ["Final location", "final location", "End", "end"]) ?? "",
    ).trim();

    const disp = resolveDriverDisplay({
      registration: vehicle,
      driverNameRaw: driverRaw,
    });

    const idBase = `${vehicle}|${violRaw}|${beginning}|${locInit}`;
    const id = createHash("sha256").update(idBase).digest("hex").slice(0, 32);

    if (card) counts[card]++;

    incidents.push({
      id,
      vehicle,
      violationLabel: card ? CARD_LABELS[card] : violRaw,
      violationRaw: violRaw,
      filterCard: card ?? "other",
      driverDisplayName: disp.displayName,
      phone: disp.phone,
      violationTime: beginning || null,
      violationTimeIso: bt ? bt.toISOString() : null,
      locationInitial: locInit || null,
      locationInitialUrl: locInit ? googleMapsSearchUrl(locInit) : null,
      locationFinal: locFin || null,
      locationFinalUrl: locFin ? googleMapsSearchUrl(locFin) : null,
    });
  }

  const mainPick = mainRows.length ? mainRows : [];
  const offlineVehicles = new Set<string>();
  for (const r of mainPick) {
    const grouping = normGrouping(firstCol(r, ["Grouping", "grouping"]));
    if (!grouping) continue;
    const lm = String(
      firstCol(r, ["Last message time", "last message time"]) ?? "",
    );
    const t = parseReportDateTime(lm);
    if (!t || t.getTime() < hourAgo) offlineVehicles.add(grouping);
  }
  counts.offline = offlineVehicles.size;

  for (const r of mainPick) {
    const grouping = normGrouping(firstCol(r, ["Grouping", "grouping"]));
    if (!grouping) continue;
    const lm = String(
      firstCol(r, ["Last message time", "last message time"]) ?? "",
    );
    const t = parseReportDateTime(lm);
    if (t && t.getTime() >= hourAgo) continue;

    const vehicle = extractRegistration(grouping) || grouping;
    const driverRaw = String(firstCol(r, ["Driver", "driver"]) ?? "");
    const locRaw = String(firstCol(r, ["Location", "location"]) ?? "").trim();
    const disp = resolveDriverDisplay({
      registration: vehicle,
      driverNameRaw: driverRaw,
    });
    const idBase = `${vehicle}|offline|${lm}|${locRaw}`;
    const id = createHash("sha256").update(idBase).digest("hex").slice(0, 32);

    incidents.push({
      id,
      vehicle,
      violationLabel: CARD_LABELS.offline,
      violationRaw: "Offline",
      filterCard: "offline",
      driverDisplayName: disp.displayName,
      phone: disp.phone,
      violationTime: lm || null,
      violationTimeIso: t ? t.toISOString() : null,
      locationInitial: locRaw || null,
      locationInitialUrl: locRaw ? googleMapsSearchUrl(locRaw) : null,
      locationFinal: null,
      locationFinalUrl: null,
    });
  }

  return { counts, incidents, offlineCount: counts.offline };
}
