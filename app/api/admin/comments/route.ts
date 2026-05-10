import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listAllComments } from "@/lib/db/comments";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const comments = await listAllComments(10000);
    return NextResponse.json({ comments });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
