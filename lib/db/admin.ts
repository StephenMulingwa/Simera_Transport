import { getSql } from "./client";

export type DbTable = {
  schema: string;
  name: string;
  approx_rows: number;
};

/** Public-schema tables with approximate row counts from pg_class. */
export async function listDbTables(): Promise<DbTable[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      n.nspname             AS schema,
      c.relname             AS name,
      COALESCE(c.reltuples, 0)::bigint AS approx_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY n.nspname, c.relname
  `) as unknown as Array<{
    schema: string;
    name: string;
    approx_rows: number | string;
  }>;
  return rows.map((r) => ({
    schema: r.schema,
    name: r.name,
    approx_rows: Number(r.approx_rows) || 0,
  }));
}

/** Strip SQL comments before classifying a statement. */
function stripComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim();
}

const READ_ONLY_LEADERS = new Set([
  "select",
  "with",
  "show",
  "explain",
  "values",
  "table",
]);

/**
 * Tells whether the supplied statement is safe under "read-only" mode.
 * We look at the *first* non-comment keyword. A multi-statement payload
 * containing `;` followed by another statement is rejected so an
 * adversarial `SELECT 1; DROP TABLE …` cannot sneak through.
 */
export function classifyStatement(input: string): {
  ok: boolean;
  reason?: string;
  leader: string;
} {
  const cleaned = stripComments(input);
  if (!cleaned) return { ok: false, reason: "Empty query", leader: "" };

  // Reject obvious multi-statement payloads. Trailing single semicolon is ok.
  const trimmed = cleaned.replace(/;\s*$/u, "");
  if (trimmed.includes(";")) {
    return {
      ok: false,
      reason: "Only a single statement is allowed per run",
      leader: "",
    };
  }
  const leader = (trimmed.match(/^[A-Za-z]+/)?.[0] ?? "").toLowerCase();
  if (!leader) {
    return { ok: false, reason: "Could not parse statement", leader: "" };
  }
  return { ok: true, leader };
}

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  leader: string;
};

export async function runAdminQuery(
  text: string,
  opts: { readOnly: boolean },
): Promise<QueryResult> {
  const cls = classifyStatement(text);
  if (!cls.ok) throw new Error(cls.reason ?? "Invalid statement");
  if (opts.readOnly && !READ_ONLY_LEADERS.has(cls.leader)) {
    throw new Error(
      `Statement "${cls.leader.toUpperCase()}" is blocked in read-only mode. Toggle "Allow writes" to run it.`,
    );
  }

  const sql = getSql();
  const started = Date.now();
  // `sql.query(text, params?)` is Neon's escape hatch for raw query strings.
  const raw = (await sql.query(text)) as unknown;
  const durationMs = Date.now() - started;

  const rows = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return {
    columns,
    rows,
    rowCount: rows.length,
    durationMs,
    leader: cls.leader,
  };
}
