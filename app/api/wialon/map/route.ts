import { NextResponse } from "next/server";
import { fetchUnitPositions } from "@/lib/wialon/units";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const units = await fetchUnitPositions();
    return NextResponse.json({ generatedAt: new Date().toISOString(), units });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Executing Reports failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
