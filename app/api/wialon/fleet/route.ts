import { NextResponse } from "next/server";
import { executeReport } from "@/lib/wialon/report";
import {
  buildSummaryFleet,
  computeFleetKpis,
} from "@/lib/simera/summaryFleet";
import { parseIdlingToSeconds } from "@/lib/simera/idlingSort";

export const dynamic = "force-dynamic";

/**
 * One report execution covers the last 24h. KPIs use the full window;
 * the fleet table is sorted by idling duration (highest first), then vehicle name.
 */
export async function GET() {
  try {
    const now = new Date();
    const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const dfs = await executeReport({
      from: from24h,
      to: now,
      tableFilter: (n) => /grouping|fleet|main|monitor|unit|online|engine|hour|idl|eco|latest/i.test(n),
    });

    const summary24 = buildSummaryFleet(dfs);
    const kpis = computeFleetKpis(summary24, now);

    const table = [...summary24].sort((a, b) => {
      const ia = parseIdlingToSeconds(a.idling);
      const ib = parseIdlingToSeconds(b.idling);
      if (ib !== ia) return ib - ia;
      return a.vehicle.localeCompare(b.vehicle);
    });

    return NextResponse.json({
      generatedAt: now.toISOString(),
      kpis,
      table,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Executing Reports failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
