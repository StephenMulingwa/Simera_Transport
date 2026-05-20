import { NextResponse } from "next/server";
import { z } from "zod";
import { executeReport } from "@/lib/wialon/report";
import { buildReportBundle } from "@/lib/simera/reportBundle";
import type { ReportRow } from "@/lib/wialon/report";
import { extractRegistration } from "@/lib/simera/parsers";
import { projectSummaryRows } from "@/lib/simera/summaryReport";
import {
  ecoCleanDetail,
  ecoOnlyDetail,
  ecoSummary,
  projectEcoDetailColumns,
} from "@/lib/simera/ecoBuilder";

export const dynamic = "force-dynamic";

const ALLOWED = ["fuel", "eco", "engine", "latest", "summary"] as const;
type Kind = (typeof ALLOWED)[number];

const bodySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  vehicles: z.array(z.string()).optional(),
});

function makeTableFilter(kind: Kind): (name: string) => boolean {
  return (raw) => {
    const n = raw.toLowerCase();
    switch (kind) {
      case "fuel":
        return /fuel|fill|drain|battery\s*charg/.test(n);
      case "eco":
        return /eco/.test(n);
      case "engine":
        return /engine|hour|idl/.test(n);
      case "latest":
        return /latest|unit\s*latest/.test(n);
      case "summary":
        return /summary/.test(n);
      default:
        return true;
    }
  };
}

function filterByVehicles(rows: ReportRow[], regs: string[]): ReportRow[] {
  if (!regs.length) return rows;
  const set = new Set(regs.map((r) => r.trim().toUpperCase()));
  return rows.filter((r) => {
    const g = String(
      r.Grouping ?? (r as Record<string, unknown>).grouping ?? "",
    );
    const reg = extractRegistration(g).toUpperCase();
    const full = g.trim().toUpperCase();
    return set.has(reg) || set.has(full);
  });
}

type Ctx = { params: Promise<{ kind: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { kind: rawKind } = await ctx.params;
  if (!ALLOWED.includes(rawKind as Kind)) {
    return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
  }
  const kind = rawKind as Kind;

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    const vehicles = parsed.data.vehicles ?? [];

    // Only fetch tables we actually need for this kind – cuts wialon round trips.
    const filter = makeTableFilter(kind);
    let dfs = await executeReport({ from, to, tableFilter: filter });
    let bundle = buildReportBundle(dfs);
    // Eco: filtered fetch can miss oddly-named sheets; one full retry if empty.
    if (kind === "eco" && !bundle.eco.length) {
      dfs = await executeReport({ from, to });
      bundle = buildReportBundle(dfs);
    }
    const apply = (rows: ReportRow[]) => filterByVehicles(rows, vehicles);

    const tables: { title: string; rows: ReportRow[] }[] = [];
    if (kind === "fuel") {
      tables.push({ title: "Fuel Fillings", rows: apply(bundle.fuelFillings) });
      tables.push({ title: "Fuel Drains", rows: apply(bundle.fuelDrains) });
    } else if (kind === "eco") {
      // Detailization: keep only leaf rows where Violation is set, then drop
      // the well-known junk (very short harsh-brakes with 0 km), then project
      // to the canonical column order. We also build a per-vehicle pivot
      // summary so the user instantly sees who has the most violations.
      const ecoRaw = apply(bundle.eco);
      const detailEvents = ecoOnlyDetail(ecoRaw);
      const detailClean = ecoCleanDetail(detailEvents);
      const summary = ecoSummary(detailClean);
      tables.push({
        title: "Eco Driving Summary (Per Vehicle)",
        rows: summary,
      });
      tables.push({
        title: "Eco Driving Detail (Cleaned)",
        rows: projectEcoDetailColumns(detailClean),
      });
      tables.push({
        title: "Eco Driving Detail (Raw)",
        rows: projectEcoDetailColumns(ecoRaw),
      });
    } else if (kind === "engine") {
      tables.push({ title: "Engine Hours", rows: apply(bundle.engineHours) });
    } else if (kind === "latest") {
      tables.push({ title: "Unit Latest Data", rows: apply(bundle.unitLatest) });
    } else if (kind === "summary") {
      tables.push({
        title: "Summary",
        rows: projectSummaryRows(apply(bundle.summary)),
      });
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      interval: { from: from.toISOString(), to: to.toISOString() },
      tables,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Executing Reports failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
