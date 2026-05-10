import { getSql } from "./client";
import type { UserRole } from "../auth/types";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  active: boolean;
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
  return (rows[0] as UserRow) ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, password_hash, full_name, role, active
    FROM users
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return (rows[0] as UserRow) ?? null;
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
  return rows as UserListRow[];
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

export async function deleteUser(id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM users WHERE id = ${id}::uuid`;
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
