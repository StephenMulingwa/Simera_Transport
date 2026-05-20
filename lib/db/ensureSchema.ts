import { getSql } from "./client";

let incidentCommentsColsEnsured = false;

/**
 * Adds duration columns added in newer app versions. Safe to call repeatedly;
 * uses ADD COLUMN IF NOT EXISTS so existing Neon databases pick up schema without
 * running `npm run db:init` manually.
 */
export async function ensureIncidentCommentsColumns(): Promise<void> {
  if (incidentCommentsColsEnsured) return;
  const sql = getSql();
  await sql`
    ALTER TABLE incident_comments
      ADD COLUMN IF NOT EXISTS duration_text TEXT NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE incident_comments
      ADD COLUMN IF NOT EXISTS duration_sec INTEGER
  `;
  incidentCommentsColsEnsured = true;
}

