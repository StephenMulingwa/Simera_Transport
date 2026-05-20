import { createHash } from "node:crypto";
import { CARD_LABELS, type DriverCardId } from "@/lib/simera/driverUi";
import type { ReportRow } from "@/lib/wialon/report";
import {
  extractRegistration,
  formatDurationHuman,
  googleMapsPlaceUrl,
  parseDurationSec,
  parseMaxSpeedKmh,
  parseReportDateTime,
  parseSpeedKmh,
  rowLocationCell,
} from "./parsers";
import { mergeMatchingTables, normGrouping, pickDf } from "./tables";
import { val, violationText } from "./ecoBuilder";
import { resolveDriverDisplay } from "@/lib/driverPhones";

const MAIN_PATTERN =
  /grouping|last|message|monitor|fleet|unit|online|connection|latest/i;
const ECO_PATTERN = /eco/i;

/** Normalize report Violation column to card id */
export function violationToCardId(raw: string): DriverCardId | null {
  const v = raw.trim().toLowerCase();
  if (/over\s*speed|overspeed|speed\s*limit/.test(v)) return "overspeeding";
  if (/harsh\s*brak/.test(v)) return "harsh_braking";
  if (/harsh\s*corner|cornering/.test(v)) return "harsh_cornering";
  if (/harsh\s*accel/.test(v)) return "harsh_acceleration";
  if (/over\s*rev|overrev/.test(v)) return "overrevving";
  if (/eco\s*-?\s*roll|ecoroll/.test(v)) return "eco_roll";
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
  /** "5m 23s" — empty string if unknown */
  durationText: string;
  /** Total seconds; null if the source had no Duration cell */
  durationSec: number | null;
  locationInitial: string | null;
  locationInitialUrl: string | null;
  locationFinal: string | null;
  locationFinalUrl: string | null;
  /** Overspeeding: peak / avg speed from the eco row when available */
  speedKmh: number | null;
  speedDisplay: string | null;
};

function overspeedSpeedFields(
  r: ReportRow,
  card: DriverCardId | null,
): { speedKmh: number | null; speedDisplay: string | null } {
  if (card !== "overspeeding") {
    return { speedKmh: null, speedDisplay: null };
  }
  const maxRaw = val(r, "Max. speed", "Maximum speed", "Peak speed");
  const avgRaw = val(r, "Avg. speed", "Average speed");
  const speedRaw = val(r, "Speed");
  const maxK = parseMaxSpeedKmh(maxRaw);
  const avgK = parseSpeedKmh(avgRaw);
  const spK = parseSpeedKmh(speedRaw);
  const kmh = maxK ?? avgK ?? spK ?? null;
  const text =
    maxRaw.trim() ||
    avgRaw.trim() ||
    speedRaw.trim() ||
    (kmh != null ? `${kmh} km/h` : "");
  return {
    speedKmh: kmh,
    speedDisplay: text || null,
  };
}

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
    mainRows = pickDf(dfs, MAIN_PATTERN, "main").rows.map((r) => ({ ...r }));
  } catch {
    mainRows = [];
  }
  if (!mainRows.length) {
    mainRows = mergeMatchingTables(dfs, MAIN_PATTERN);
  }
  if (!mainRows.length) {
    mainRows = mergeMatchingTables(
      dfs,
      /fleet|monitor|unit|online|connection|tracing|sensor|objects|listing/i,
    );
  }

  const counts: Record<DriverCardId, number> = {
    overspeeding: 0,
    harsh_braking: 0,
    harsh_cornering: 0,
    harsh_acceleration: 0,
    overrevving: 0,
    eco_roll: 0,
    idling: 0,
    offline: 0,
  };

  const incidents: DriverIncidentRow[] = [];

  for (const r of ecoRows) {
    const violRaw = violationText(r);
    if (!violRaw || /^-+$/.test(violRaw)) continue;
    const card = violationToCardId(violRaw);
    const grouping = normGrouping(firstCol(r, ["Grouping", "grouping"]));
    if (!grouping) continue;

    const durationRaw = val(r, "Duration");
    const durationSec = parseDurationSec(durationRaw);

    const beginning = String(firstCol(r, ["Beginning", "beginning"]) ?? "");
    const bt = parseReportDateTime(beginning);

    const vehicle = extractRegistration(grouping) || grouping;
    const driverRaw = String(firstCol(r, ["Driver", "driver"]) ?? "");

    const { text: locInit, coords: locInitCoords } = rowLocationCell(r, [
      "Initial location",
      "initial location",
    ]);
    const { text: locFin, coords: locFinCoords } = rowLocationCell(r, [
      "Final location",
      "final location",
      "End",
      "end",
    ]);

    const disp = resolveDriverDisplay({
      registration: vehicle,
      driverNameRaw: driverRaw,
    });

    const idBase = `${vehicle}|${violRaw}|${beginning}|${locInit}`;
    const id = createHash("sha256").update(idBase).digest("hex").slice(0, 32);

    const filterCard: DriverCardId | "other" = card ?? "other";
    if (card) counts[card]++;

    const { speedKmh, speedDisplay } = overspeedSpeedFields(r, card);

    incidents.push({
      id,
      vehicle,
      violationLabel: card ? CARD_LABELS[card] : violRaw,
      violationRaw: violRaw,
      filterCard,
      driverDisplayName: disp.displayName,
      phone: disp.phone,
      violationTime: beginning || null,
      violationTimeIso: bt ? bt.toISOString() : null,
      durationText: durationSec != null ? formatDurationHuman(durationSec) : "",
      durationSec,
      locationInitial: locInit || null,
      locationInitialUrl: locInit
        ? googleMapsPlaceUrl(locInit, locInitCoords)
        : null,
      locationFinal: locFin || null,
      locationFinalUrl: locFin ? googleMapsPlaceUrl(locFin, locFinCoords) : null,
      speedKmh,
      speedDisplay,
    });
  }

  // Offline = no fresh message in the last hour. The report interval already
  // scopes to the rolling hour, so we just need the most recent main row per
  // vehicle.
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const latestByVehicle = new Map<
    string,
    { row: ReportRow; lm: string; t: Date | null }
  >();
  for (const r of mainRows) {
    const grouping = normGrouping(firstCol(r, ["Grouping", "grouping"]));
    if (!grouping) continue;
    const lm = String(
      firstCol(r, ["Last message time", "last message time"]) ?? "",
    );
    const t = parseReportDateTime(lm);
    const prev = latestByVehicle.get(grouping);
    const prevT = prev?.t?.getTime() ?? -Infinity;
    const curT = t?.getTime() ?? -Infinity;
    if (!prev || curT > prevT) latestByVehicle.set(grouping, { row: r, lm, t });
  }

  for (const [grouping, { row, lm, t }] of latestByVehicle) {
    if (t && t.getTime() >= hourAgo) continue;

    const vehicle = extractRegistration(grouping) || grouping;
    const driverRaw = String(firstCol(row, ["Driver", "driver"]) ?? "");
    const { text: locRaw, coords: locCoords } = rowLocationCell(row, [
      "Location",
      "location",
    ]);
    const disp = resolveDriverDisplay({
      registration: vehicle,
      driverNameRaw: driverRaw,
    });
    const idBase = `${vehicle}|offline|${lm}|${locRaw}`;
    const id = createHash("sha256").update(idBase).digest("hex").slice(0, 32);

    const offlineSec = t ? Math.max(0, Math.floor((Date.now() - t.getTime()) / 1000)) : null;

    counts.offline++;
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
      durationText: offlineSec != null ? formatDurationHuman(offlineSec) : "",
      durationSec: offlineSec,
      locationInitial: locRaw || null,
      locationInitialUrl: locRaw ? googleMapsPlaceUrl(locRaw, locCoords) : null,
      locationFinal: null,
      locationFinalUrl: null,
      speedKmh: null,
      speedDisplay: null,
    });
  }

  return { counts, incidents, offlineCount: counts.offline };
}
