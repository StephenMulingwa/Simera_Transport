import { NextResponse } from "next/server";
import { z } from "zod";
import { executeReport } from "@/lib/wialon/report";
import { buildReportBundle } from "@/lib/simera/reportBundle";
import type { ReportRow } from "@/lib/wialon/report";
import { extractRegistration } from "@/lib/simera/parsers";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  vehicles: z.array(z.string()).optional(),
});

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

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    const vehicles = parsed.data.vehicles ?? [];

    const dfs = await executeReport({ from, to });
    const bundle = buildReportBundle(dfs);

    const apply = (rows: ReportRow[]) => filterByVehicles(rows, vehicles);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      interval: { from: from.toISOString(), to: to.toISOString() },
      fuelFillings: apply(bundle.fuelFillings),
      fuelDrains: apply(bundle.fuelDrains),
      engineHours: apply(bundle.engineHours),
      unitLatest: apply(bundle.unitLatest),
      summary: apply(bundle.summary),
      eco: apply(bundle.eco),
      tableKeys: bundle.rawKeys,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Executing Reports failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
