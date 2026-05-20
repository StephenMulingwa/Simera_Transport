import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { countLoginEvents, listLoginEventsPage } from "@/lib/db/users";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const limitRaw = Number.parseInt(
      searchParams.get("limit") ?? String(DEFAULT_LIMIT),
      10,
    );
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
    );
    const q = (searchParams.get("q") ?? "").trim() || null;

    const total = await countLoginEvents(q);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;

    const events = await listLoginEventsPage({
      offset,
      limit,
      search: q,
    });

    return NextResponse.json({
      events,
      total,
      page: safePage,
      limit,
      totalPages,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
