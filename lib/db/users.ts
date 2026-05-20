import { getSql } from "./client";
import type { UserRole } from "../auth/types";
import {
  isProtectedSuperAdminAccount,
  SUPER_ADMIN_EMAIL,
} from "../auth/superAdmin";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  is_super_admin: boolean;
};

export async function countUsers(): Promise<number> {
  const sql = getSql();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM users`;
  const r = rows[0] as { n: number };
  return r?.n ?? 0;
}

export async function findUserByEmail(
  email: string,
): Promise<UserRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, password_hash, full_name, role, active
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `;
  const raw = rows[0] as Omit<UserRow, "is_super_admin"> | undefined;
  if (!raw) return null;
  return {
    ...raw,
    is_super_admin: isProtectedSuperAdminAccount(raw.email),
  };
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, password_hash, full_name, role, active
    FROM users
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  const raw = rows[0] as Omit<UserRow, "is_super_admin"> | undefined;
  if (!raw) return null;
  return {
    ...raw,
    is_super_admin: isProtectedSuperAdminAccount(raw.email),
  };
}

export async function insertUser(
  email: string,
  passwordHash: string,
  fullName: string,
  role: UserRole,
): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO users (email, password_hash, full_name, role)
    VALUES (${email}, ${passwordHash}, ${fullName}, ${role})
    RETURNING id::text
  `;
  return (rows[0] as { id: string }).id;
}

export type UserListRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
};

export async function listUsers(): Promise<UserListRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id::text, email, full_name, role, active, created_at, updated_at
    FROM users
    ORDER BY created_at ASC
  `;
  return (rows as Omit<UserListRow, "is_super_admin">[]).map((r) => ({
    ...r,
    is_super_admin: isProtectedSuperAdminAccount(r.email),
  }));
}

export async function setUserActive(
  id: string,
  active: boolean,
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE users SET active = ${active}, updated_at = NOW() WHERE id = ${id}::uuid
  `;
}

/** Refuses to remove the Super Admin row (DB flag or canonical email). */
export async function deleteUser(id: string): Promise<{ deleted: boolean }> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM users
    WHERE id = ${id}::uuid
      AND LOWER(TRIM(email)) <> LOWER(TRIM(${SUPER_ADMIN_EMAIL}))
    RETURNING id
  `;
  return { deleted: rows.length > 0 };
}

export async function recordLogin(
  userId: string,
  ip: string | null,
  userAgent: string | null,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO login_events (user_id, ip, user_agent)
    VALUES (${userId}::uuid, ${ip}, ${userAgent})
  `;
}

export async function listLoginEvents(limit = 500) {
  const sql = getSql();
  return sql`
    SELECT le.id, le.user_id, u.email, u.full_name, le.logged_in_at, le.ip, le.user_agent
    FROM login_events le
    JOIN users u ON u.id = le.user_id
    ORDER BY le.logged_in_at DESC
    LIMIT ${limit}
  `;
}

export async function countLoginEvents(search?: string | null): Promise<number> {
  const sql = getSql();
  const q = search?.trim();
  if (q) {
    const needle = q.toLowerCase();
    const rows = await sql`
      SELECT COUNT(*)::int AS c
      FROM login_events le
      JOIN users u ON u.id = le.user_id
      WHERE strpos(lower(u.email), ${needle}) > 0
         OR strpos(lower(coalesce(u.full_name, '')), ${needle}) > 0
         OR strpos(lower(coalesce(le.ip::text, '')), ${needle}) > 0
         OR strpos(lower(coalesce(le.user_agent, '')), ${needle}) > 0
    `;
    return Number((rows[0] as { c: number } | undefined)?.c ?? 0);
  }
  const rows = await sql`
    SELECT COUNT(*)::int AS c FROM login_events le
  `;
  return Number((rows[0] as { c: number } | undefined)?.c ?? 0);
}

export async function listLoginEventsPage(opts: {
  offset: number;
  limit: number;
  search?: string | null;
}) {
  const sql = getSql();
  const offset = Math.max(0, Math.floor(opts.offset));
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit)));
  const q = opts.search?.trim();

  if (q) {
    const needle = q.toLowerCase();
    return sql`
      SELECT le.id, le.user_id, u.email, u.full_name, le.logged_in_at, le.ip, le.user_agent
      FROM login_events le
      JOIN users u ON u.id = le.user_id
      WHERE strpos(lower(u.email), ${needle}) > 0
         OR strpos(lower(coalesce(u.full_name, '')), ${needle}) > 0
         OR strpos(lower(coalesce(le.ip::text, '')), ${needle}) > 0
         OR strpos(lower(coalesce(le.user_agent, '')), ${needle}) > 0
      ORDER BY le.logged_in_at DESC
      OFFSET ${offset} LIMIT ${limit}
    `;
  }

  return sql`
    SELECT le.id, le.user_id, u.email, u.full_name, le.logged_in_at, le.ip, le.user_agent
    FROM login_events le
    JOIN users u ON u.id = le.user_id
    ORDER BY le.logged_in_at DESC
    OFFSET ${offset} LIMIT ${limit}
  `;
}
