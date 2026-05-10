import { NextResponse } from "next/server";
import { executeReport } from "@/lib/wialon/report";
import { buildDriverIncidents } from "@/lib/simera/violations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const from1h = new Date(now.getTime() - 60 * 60 * 1000);
    const dfs = await executeReport({ from: from1h, to: now });
    const pack = buildDriverIncidents(dfs);
    return NextResponse.json({
      generatedAt: now.toISOString(),
      counts: pack.counts,
      incidents: pack.incidents,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Executing Reports failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
