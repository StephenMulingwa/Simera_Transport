import { createHash } from "crypto";
import { getSql } from "./client";
import { ensureIncidentCommentsColumns } from "./ensureSchema";
import { normalizeLocationTextForStorage } from "@/lib/simera/commentLocation";

export function buildIncidentFingerprint(input: {
  vehicle_registration: string;
  violation_type: string;
  violation_time_iso: string;
  location_text: string;
}): string {
  const raw = [
    input.vehicle_registration.trim().toUpperCase(),
    input.violation_type.trim(),
    input.violation_time_iso,
    input.location_text.trim(),
  ].join("|");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export async function insertComment(input: {
  user_id: string;
  author_name: string;
  driver_name: string;
  violation_type: string;
  violation_time: Date;
  location_text: string;
  vehicle_registration: string;
  comment_text: string;
  /** Human duration of the underlying incident, e.g. "5m 23s". */
  duration_text?: string;
  /** Numeric seconds; null when unknown. */
  duration_sec?: number | null;
}) {
  await ensureIncidentCommentsColumns();

  const locationNorm = normalizeLocationTextForStorage(input.location_text);

  const fp = buildIncidentFingerprint({
    vehicle_registration: input.vehicle_registration,
    violation_type: input.violation_type,
    violation_time_iso: input.violation_time.toISOString(),
    location_text: locationNorm,
  });
  const sql = getSql();
  const rows = await sql`
    INSERT INTO incident_comments (
      user_id, author_name, driver_name, violation_type, violation_time,
      location_text, vehicle_registration, comment_text, incident_fingerprint,
      duration_text, duration_sec
    )
    VALUES (
      ${input.user_id}::uuid,
      ${input.author_name},
      ${input.driver_name},
      ${input.violation_type},
      ${input.violation_time.toISOString()}::timestamptz,
      ${locationNorm},
      ${input.vehicle_registration},
      ${input.comment_text},
      ${fp},
      ${input.duration_text ?? ""},
      ${input.duration_sec ?? null}
    )
    ON CONFLICT (incident_fingerprint) DO UPDATE SET
      comment_text  = EXCLUDED.comment_text,
      author_name   = EXCLUDED.author_name,
      duration_text = EXCLUDED.duration_text,
      duration_sec  = EXCLUDED.duration_sec,
      created_at    = NOW()
    RETURNING id::text, incident_fingerprint
  `;
  return rows[0] as { id: string; incident_fingerprint: string };
}

export async function listAllComments(limit = 5000) {
  await ensureIncidentCommentsColumns();
  const sql = getSql();
  return sql`
    SELECT
      ic.id, ic.author_name, ic.driver_name, ic.violation_type,
      ic.violation_time, ic.location_text, ic.vehicle_registration,
      ic.comment_text, ic.duration_text, ic.duration_sec,
      ic.created_at, u.email AS user_email
    FROM incident_comments ic
    JOIN users u ON u.id = ic.user_id
    ORDER BY ic.created_at DESC
    LIMIT ${limit}
  `;
}
