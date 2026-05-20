import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listDbTables } from "@/lib/db/admin";
import { ensureIncidentCommentsColumns } from "@/lib/db/ensureSchema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await ensureIncidentCommentsColumns().catch(() => undefined);
    const tables = await listDbTables();
    return NextResponse.json({ tables });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Failed to list tables";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
