import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { runAdminQuery } from "@/lib/db/admin";
import { ensureIncidentCommentsColumns } from "@/lib/db/ensureSchema";

export const dynamic = "force-dynamic";

const schema = z.object({
  sql: z.string().min(1),
  readOnly: z.boolean().default(true),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const json = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    await ensureIncidentCommentsColumns().catch(() => undefined);
    const result = await runAdminQuery(parsed.data.sql, {
      readOnly: parsed.data.readOnly,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
