import type { ReportRow } from "@/lib/wialon/report";
import {
  extractRegistration,
  parseMaxSpeedKmh,
  parseReportDateTime,
  parseSpeedKmh,
} from "./parsers";
import { matchRename, normGrouping, pickDf } from "./tables";

const MAIN_PATTERN =
  /grouping|last|message|monitor|fleet|unit|online|connection|latest/i;
const EH_PATTERN = /engine|hour|idl|idle/i;
const ECO_PATTERN = /eco/i;

export type FleetSummaryRow = {
  vehicle: string;
  lastMessageTime: string | null;
  location: string | null;
  locationUrl: string | null;
  speed: string | null;
  driver: string | null;
  violationsCount: number;
  idling: string | null;
  maxSpeed: number | null;
};

function firstCol<T extends ReportRow>(
  row: T,
  names: string[],
): string | number | null {
  for (const n of names) {
    if (n in row && row[n] != null && row[n] !== "") {
      return row[n]!;
    }
  }
  return null;
}

export function buildSummaryFleet(dfs: Record<string, ReportRow[]>): FleetSummaryRow[] {
  const mainPick = pickDf(dfs, MAIN_PATTERN, "main");
  let mainRows = mainPick.rows;
  mainRows = matchRename(mainRows, {
    Grouping: ["grouping", "unit", "name", "object", "vehicle"],
    "Last message time": [
      "last message time",
      "last msg",
      "last message",
      "msg time",
      "time",
    ],
    Location: ["location", "last location", "position", "place"],
    Speed: ["speed", "last speed", "current speed"],
    Driver: ["driver", "driver name"],
  });

  if (mainRows.length && !("Grouping" in (mainRows[0] as object))) {
    const firstKey = Object.keys(mainRows[0] ?? {})[0];
    if (firstKey) {
      mainRows = mainRows.map((r) => ({ ...r, Grouping: r[firstKey] }));
    }
  }

  const ehPick = pickDf(dfs, EH_PATTERN, "engine_hours");
  let ehRows = ehPick.rows;

  let idlingCol: string | null = null;
  for (const cand of ["Idling", "Engine idling", "Idling time", "Idle"]) {
    if (ehRows[0] && cand in ehRows[0]!) {
      idlingCol = cand;
      break;
    }
  }
  if (!idlingCol && ehRows[0]) {
    for (const c of Object.keys(ehRows[0])) {
      if (/idl|idle|engine/i.test(c)) {
        idlingCol = c;
        break;
      }
    }
  }
  if (!idlingCol) idlingCol = "Idling";

  ehRows = matchRename(ehRows, {
    Grouping: ["grouping", "unit", "name", "object", "vehicle"],
  });
  if (ehRows.length && !("Grouping" in (ehRows[0] as object))) {
    const fk = Object.keys(ehRows[0] ?? {})[0];
    if (fk) ehRows = ehRows.map((r) => ({ ...r, Grouping: r[fk] }));
  }

  const idlingByGroup = new Map<string, string | null>();
  for (const r of ehRows) {
    const g = normGrouping(r.Grouping);
    const idling = r[idlingCol] != null ? String(r[idlingCol]) : null;
    if (!idlingByGroup.has(g)) idlingByGroup.set(g, idling);
  }

  let ecoRows: ReportRow[] = [];
  try {
    ecoRows = pickDf(dfs, ECO_PATTERN, "eco").rows;
  } catch {
    ecoRows = [];
  }

  const violSumByGroup = new Map<string, number>();
  const maxSpeedByGroup = new Map<string, number>();

  for (const r of ecoRows) {
    const g = normGrouping(
      firstCol(r, ["Grouping", "grouping"]) as string | null,
    );
    if (!g) continue;
    const cntRaw = firstCol(r, ["Count", "count"]);
    const cnt =
      cntRaw != null && cntRaw !== ""
        ? Number(cntRaw)
        : 1;
    violSumByGroup.set(g, (violSumByGroup.get(g) ?? 0) + (Number.isFinite(cnt) ? cnt : 1));

    const mxRaw = firstCol(r, ["Max. speed", "Max speed", "max. speed"]);
    const mx = parseMaxSpeedKmh(mxRaw != null ? String(mxRaw) : null);
    if (mx != null) {
      const prev = maxSpeedByGroup.get(g);
      if (prev == null || mx > prev) maxSpeedByGroup.set(g, mx);
    }
  }

  const out: FleetSummaryRow[] = [];
  for (const r of mainRows) {
    const grouping = normGrouping(r.Grouping);
    if (!grouping) continue;
    const vehicle = extractRegistration(grouping) || grouping;
    const locRaw = firstCol(r, ["Location", "location"]);
    const location = locRaw != null ? String(locRaw).trim() : null;
    const locationUrl =
      location && location.length > 0
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
        : null;

    const spdRaw = firstCol(r, ["Speed", "speed"]);
    const driverRaw = firstCol(r, ["Driver", "driver"]);

    out.push({
      vehicle,
      lastMessageTime:
        firstCol(r, ["Last message time", "last message time"]) != null
          ? String(firstCol(r, ["Last message time", "last message time"]))
          : null,
      location,
      locationUrl,
      speed: spdRaw != null ? String(spdRaw) : null,
      driver: driverRaw != null ? String(driverRaw) : null,
      violationsCount: violSumByGroup.get(grouping) ?? 0,
      idling: idlingByGroup.get(grouping) ?? null,
      maxSpeed: maxSpeedByGroup.get(grouping) ?? null,
    });
  }

  out.sort((a, b) => {
    const vc = b.violationsCount - a.violationsCount;
    if (vc !== 0) return vc;
    const ma = a.maxSpeed ?? -1;
    const mb = b.maxSpeed ?? -1;
    return mb - ma;
  });

  return out;
}

export type FleetKpis = {
  totalFleet: number;
  activeFleet: number;
  stationary: number;
  notUpdating: number;
};

export function computeFleetKpis(
  rows: FleetSummaryRow[],
  now: Date,
): FleetKpis {
  const h24 = 24 * 60 * 60 * 1000;
  const boundary = new Date(now.getTime() - h24);

  let activeFleet = 0;
  let stationary = 0;
  let notUpdating = 0;

  for (const r of rows) {
    const t = r.lastMessageTime
      ? parseReportDateTime(r.lastMessageTime)
      : null;
    const speed = parseSpeedKmh(r.speed);

    if (!t || t < boundary) {
      notUpdating++;
      continue;
    }
    activeFleet++;
    if (speed !== null && speed <= 0.5) stationary++;
  }

  return {
    totalFleet: rows.length,
    activeFleet,
    stationary,
    notUpdating,
  };
}
