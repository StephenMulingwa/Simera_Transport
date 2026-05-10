import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listLoginEvents } from "@/lib/db/users";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const events = await listLoginEvents(500);
    return NextResponse.json({ events });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
