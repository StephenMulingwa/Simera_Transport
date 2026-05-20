import { NextResponse } from "next/server";
import { executeReport } from "@/lib/wialon/report";
import { buildDriverIncidents } from "@/lib/simera/violations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dfs = await executeReport({ from: from24h, to: now });
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
