import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { insertComment } from "@/lib/db/comments";
import { parseReportDateTime } from "@/lib/simera/parsers";

const schema = z.object({
  driverName: z.string().min(1),
  violationType: z.string().min(1),
  violationTime: z.string().min(1),
  locationText: z.string(),
  vehicleRegistration: z.string().min(1),
  commentText: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const v = parsed.data;
    const vt = parseReportDateTime(v.violationTime) ?? new Date(v.violationTime);
    if (Number.isNaN(vt.getTime())) {
      return NextResponse.json({ error: "Invalid violation time" }, { status: 400 });
    }

    const row = await insertComment({
      user_id: session.sub,
      author_name: session.name,
      driver_name: v.driverName,
      violation_type: v.violationType,
      violation_time: vt,
      location_text: v.locationText,
      vehicle_registration: v.vehicleRegistration,
      comment_text: v.commentText,
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save comment" }, { status: 500 });
  }
}
