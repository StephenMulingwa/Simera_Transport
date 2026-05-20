"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Table as TableIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import { formatAppDateTime } from "@/lib/simera/appTime";

type DbTable = {
  schema: string;
  name: string;
  approx_rows: number;
};

type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  leader: string;
};

const EXAMPLES = [
  {
    label: "Recent comments",
    sql: "SELECT created_at, vehicle_registration, violation_type, duration_text, comment_text\nFROM incident_comments\nORDER BY created_at DESC\nLIMIT 50",
  },
  {
    label: "Logins last 24h",
    sql: "SELECT le.logged_in_at, u.full_name, u.email, le.ip\nFROM login_events le\nJOIN users u ON u.id = le.user_id\nWHERE le.logged_in_at > NOW() - INTERVAL '24 hours'\nORDER BY le.logged_in_at DESC",
  },
  {
    label: "Active users",
    sql: "SELECT email, full_name, role, active, created_at\nFROM users\nWHERE active = TRUE\nORDER BY created_at",
  },
];

function isTimestampishColumn(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.endsWith("_at") ||
    n.endsWith("_time") ||
    n.includes("timestamp") ||
    n === "server_time"
  );
}

/** Show timestamptz / ISO strings in East Africa Time in the grid and exports. */
function formatCellForDisplay(column: string, v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && !(v instanceof Date)) {
    return JSON.stringify(v);
  }
  const asEat = (input: string | Date): string | null => {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    return formatAppDateTime(d);
  };
  if (v instanceof Date) {
    return asEat(v) ?? v.toISOString();
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "";
    const isoLike =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ||
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s);
    if (isTimestampishColumn(column) || isoLike) {
      const f = asEat(s);
      if (f) return f;
    }
    return s;
  }
  return String(v);
}

export function DatabaseTab() {
  const [tables, setTables] = useState<DbTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tablesErr, setTablesErr] = useState<string | null>(null);

  const [sql, setSql] = useState(
    "SELECT NOW() AS server_time, current_database() AS db",
  );
  const [readOnly, setReadOnly] = useState(true);
  const [confirmWrites, setConfirmWrites] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    setTablesErr(null);
    try {
      const r = await fetch("/api/admin/db/tables", { cache: "no-store" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const d = (await r.json()) as { tables: DbTable[] };
      setTables(d.tables);
    } catch (e) {
      setTablesErr(e instanceof Error ? e.message : "Failed to list tables");
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const run = useCallback(async () => {
    if (!sql.trim()) return;
    if (!readOnly && !confirmWrites) {
      setError(
        "Writes are blocked. Tick \"I understand\" to confirm before running write queries.",
      );
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/admin/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, readOnly }),
      });
      const j = (await r.json()) as Partial<QueryResult> & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setResult(j as QueryResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setRunning(false);
    }
  }, [sql, readOnly, confirmWrites]);

  const loadPreview = (t: DbTable) => {
    const qualified = `"${t.schema}"."${t.name}"`;
    setSql(`SELECT * FROM ${qualified}\nORDER BY 1\nLIMIT 100`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void run();
    }
  };

  const exportExcel = () => {
    if (!result || result.rowCount === 0) return;
    const aoa: (string | number | null)[][] = [];
    aoa.push(result.columns);
    for (const row of result.rows) {
      aoa.push(
        result.columns.map((c) => {
          const v = row[c];
          if (v == null) return null;
          if (typeof v === "number") return v;
          return formatCellForDisplay(c, v);
        }),
      );
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "query");
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    XLSX.writeFile(wb, `simera_query_${stamp}.xlsx`);
  };

  const exportCsv = () => {
    if (!result || result.rowCount === 0) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [result.columns.map(esc).join(",")];
    for (const row of result.rows) {
      lines.push(
        result.columns
          .map((c) => esc(formatCellForDisplay(c, row[c])))
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    a.download = `simera_query_${stamp}.csv`;
    a.click();
  };

  const visibleRows = useMemo(() => {
    if (!result) return [];
    return result.rows.slice(0, 500);
  }, [result]);

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex min-w-0 w-full flex-col gap-5 lg:flex-row lg:items-stretch">
      {/* Tables list */}
      <aside className="min-w-0 shrink-0 rounded-xl border border-zinc-200 bg-white shadow-sm lg:w-[260px] lg:max-w-[260px]">
        <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
            <Database className="h-4 w-4 text-red-600" />
            Tables ({tables.length})
          </h2>
          <button
            type="button"
            onClick={() => void loadTables()}
            disabled={tablesLoading}
            className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${tablesLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </header>
        <div className="max-h-[460px] overflow-y-auto px-2 py-2">
          {tablesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-red-600" />
            </div>
          ) : tablesErr ? (
            <p className="px-2 py-3 text-xs font-medium text-red-700">
              {tablesErr}
            </p>
          ) : tables.length === 0 ? (
            <p className="px-2 py-3 text-xs text-zinc-500">No tables found.</p>
          ) : (
            <ul className="space-y-0.5">
              {tables.map((t) => (
                <li key={`${t.schema}.${t.name}`}>
                  <button
                    type="button"
                    onClick={() => loadPreview(t)}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-zinc-800 hover:bg-red-50 hover:text-red-900"
                    title={`Load SELECT * FROM "${t.schema}"."${t.name}" LIMIT 100`}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                      <TableIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      <span className="truncate">
                        {t.schema !== "public" && (
                          <span className="text-zinc-500">{t.schema}.</span>
                        )}
                        {t.name}
                      </span>
                    </span>
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-zinc-700">
                      ~{Number(t.approx_rows).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Editor + result — flex-1 uses all horizontal space to the right */}
      <div className="min-w-0 w-full flex-1 space-y-4">
        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <header className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-zinc-900">SQL Playground</h2>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => setSql(ex.sql)}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </header>

          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            rows={9}
            placeholder="SELECT ..."
            className="box-border block w-full min-w-0 max-w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-zinc-900 shadow-inner focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
          />

          <div className="mt-3 flex flex-wrap items-start gap-3">
            <button
              type="button"
              onClick={() => void run()}
              disabled={running || !sql.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run query
              <span className="ml-1 hidden rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                Ctrl+Enter
              </span>
            </button>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800">
              <input
                type="checkbox"
                checked={readOnly}
                onChange={(e) => {
                  setReadOnly(e.target.checked);
                  if (e.target.checked) setConfirmWrites(false);
                }}
                className="h-3.5 w-3.5 accent-red-600"
              />
              Read-only (SELECT / WITH / SHOW / EXPLAIN only)
            </label>
            {!readOnly && (
              <label className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={confirmWrites}
                  onChange={(e) => setConfirmWrites(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-600"
                />
                <ShieldAlert className="h-3.5 w-3.5" />
                I understand this may modify or delete data
              </label>
            )}
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {result && (
          <section className="min-w-0 rounded-xl border border-zinc-200 bg-white shadow-sm">
            <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5">
              <h3 className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-zinc-900">
                Result
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-700">
                  {result.rowCount.toLocaleString()} row
                  {result.rowCount === 1 ? "" : "s"}
                </span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-700">
                  {result.durationMs} ms
                </span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-zinc-700">
                  {result.leader}
                </span>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={exportExcel}
                  disabled={result.rowCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={result.rowCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              </div>
            </header>
            {result.rowCount === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                Query returned no rows.
              </p>
            ) : (
              <div className="max-h-[min(520px,70vh)] w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain">
                <table className="w-max min-w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-zinc-50">
                    <tr>
                      {result.columns.map((c) => (
                        <th
                          key={c}
                          className="max-w-[240px] whitespace-normal break-words border-b border-zinc-200 px-3 py-2 text-left font-bold uppercase tracking-wider text-zinc-700 sm:max-w-none sm:whitespace-nowrap"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-zinc-100 hover:bg-red-50/30"
                      >
                        {result.columns.map((c) => {
                          const v = row[c];
                          const isNull = v == null;
                          const text = isNull ? "" : formatCellForDisplay(c, v);
                          return (
                            <td
                              key={c}
                              className={`max-w-[min(90vw,360px)] whitespace-pre-wrap break-words px-3 py-1.5 align-top font-mono text-[11.5px] sm:max-w-[480px] ${
                                isNull
                                  ? "italic text-zinc-400"
                                  : "text-zinc-800"
                              }`}
                              title={text}
                            >
                              {isNull ? "NULL" : text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.rowCount > visibleRows.length && (
                  <p className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] font-medium text-zinc-600">
                    Showing first {visibleRows.length.toLocaleString()} of{" "}
                    {result.rowCount.toLocaleString()} rows. Export to Excel /
                    CSV for the full result set.
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
