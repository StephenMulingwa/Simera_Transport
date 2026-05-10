import {
  apiError,
  reportStatusCode,
  wialonCall,
} from "./client";
import { getWialonReportConfig, getWialonToken } from "./config";

export type ReportRow = Record<string, string | number | null>;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cellToText(cell: unknown): string | number | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell !== "object") return cell as string | number;
  const o = cell as Record<string, unknown>;
  if ("t" in o && o.t != null) return String(o.t);
  if ("v" in o && o.v != null) return typeof o.v === "number" ? o.v : String(o.v);
  return JSON.stringify(cell);
}

function rowsJsonToDataframe(
  headers: string[],
  rowObjects: unknown[],
): ReportRow[] {
  const n = headers.length;
  const rows: ReportRow[] = [];
  for (const row of rowObjects) {
    const rec: ReportRow = {};
    const cells =
      typeof row === "object" && row !== null && "c" in row
        ? (row as { c?: unknown[] }).c
        : [];
    for (let i = 0; i < n; i++) {
      const key = headers[i] ?? `col_${i}`;
      rec[key] =
        cells && i < cells.length
          ? (cellToText(cells[i]) as string | number | null)
          : null;
    }
    rows.push(rec);
  }
  return rows;
}

function* iterLeafRows(nodes: unknown[]): Generator<unknown> {
  if (!nodes?.length) return;
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const subs = (node as { r?: unknown[] }).r;
    if (subs?.length) {
      yield* iterLeafRows(subs);
    } else {
      yield node;
    }
  }
}

async function reportTableToDataframe(
  sid: string,
  tableMeta: Record<string, unknown>,
  tableIndex: number,
): Promise<ReportRow[]> {
  const headers = (tableMeta.header as string[]) || [];
  const nrows = Number(tableMeta.rows ?? 0);
  const level = Number(tableMeta.level ?? 1);
  if (nrows <= 0) return [];

  // Strategy: always try to expand to leaves so detail rows (e.g. each
  // individual eco-driving violation) are returned. We request `level - 1`
  // expansion (matches the python notebook); for flat tables (level=1) we
  // fall back to the simpler get_result_rows call.
  if (level <= 1) {
    const raw = await wialonCall<unknown[]>(
      "report/get_result_rows",
      { tableIndex, indexFrom: 0, indexTo: nrows - 1 },
      sid,
    );
    if (apiError(raw)) throw new Error(String(raw));
    if (!Array.isArray(raw)) throw new Error("Unexpected get_result_rows");
    // Some flat tables still arrive with `r` children — flatten just in case.
    const leaves = raw.some(
      (n) =>
        typeof n === "object" &&
        n !== null &&
        Array.isArray((n as { r?: unknown[] }).r) &&
        ((n as { r?: unknown[] }).r as unknown[]).length > 0,
    )
      ? [...iterLeafRows(raw)]
      : raw;
    return rowsJsonToDataframe(headers, leaves);
  }

  const selLevel = Math.max(level - 1, 0);
  const raw = await wialonCall<unknown[]>(
    "report/select_result_rows",
    {
      tableIndex,
      config: {
        type: "range",
        data: { from: 0, to: nrows - 1, level: selLevel },
      },
    },
    sid,
  );
  if (apiError(raw)) throw new Error(String(raw));
  if (!Array.isArray(raw)) throw new Error("Unexpected select_result_rows");
  const leafRows = [...iterLeafRows(raw)];
  return rowsJsonToDataframe(headers, leafRows);
}

const POLL_SEC = 180;
const SLEEP_SEC = 0.5;

export async function executeReport(params: {
  from: Date;
  to: Date;
  /** Optional name predicate – when provided, only matching tables are fetched. */
  tableFilter?: (name: string) => boolean;
}): Promise<Record<string, ReportRow[]>> {
  const { resourceId, templateId, unitGroupId } = getWialonReportConfig();
  const timeFrom = Math.floor(params.from.getTime() / 1000);
  const timeTo = Math.floor(params.to.getTime() / 1000);

  return withWialonSession(async (sid) => {
    await wialonCall("report/cleanup_result", {}, sid);

    const execParams = {
      reportResourceId: resourceId,
      reportTemplateId: templateId,
      reportObjectId: unitGroupId,
      reportObjectSecId: 0,
      interval: { flags: 0, from: timeFrom, to: timeTo },
      remoteExec: 1,
    };

    const ex = await wialonCall("report/exec_report", execParams, sid);
    if (apiError(ex)) throw new Error(`exec_report: ${JSON.stringify(ex)}`);

    const t0 = Date.now();
    while (true) {
      const st = await wialonCall("report/get_report_status", {}, sid);
      const code = reportStatusCode(st);
      if (code === 4) break;
      if (Date.now() - t0 > POLL_SEC * 1000) {
        throw new Error(`Report timeout: ${JSON.stringify(st)}`);
      }
      await sleep(SLEEP_SEC * 1000);
    }

    const applied = await wialonCall<{
      reportResult?: { tables?: Record<string, unknown>[] };
    }>("report/apply_report_result", {}, sid);
    if (apiError(applied)) {
      throw new Error(`apply_report_result: ${JSON.stringify(applied)}`);
    }

    const tablesMeta = applied.reportResult?.tables ?? [];
    // Fetch all wanted tables in parallel for speed
    const dfs: Record<string, ReportRow[]> = {};
    const fetches = tablesMeta.map(async (tblRaw, idx) => {
      const tbl = tblRaw as Record<string, unknown>;
      const name =
        (tbl.label as string) || (tbl.name as string) || `table_${idx}`;
      if (params.tableFilter && !params.tableFilter(name)) return;
      const rows = await reportTableToDataframe(sid, tbl, idx);
      dfs[name] = rows;
    });
    await Promise.all(fetches);
    return dfs;
  });
}

export async function withWialonSession<T>(
  fn: (sid: string) => Promise<T>,
): Promise<T> {
  const token = getWialonToken();
  const login = await wialonCall<{ eid?: string }>("token/login", {
    token,
  });
  if (apiError(login) || !login.eid) {
    throw new Error(`Wialon login failed: ${JSON.stringify(login)}`);
  }
  const sid = login.eid;
  try {
    return await fn(sid);
  } finally {
    await wialonCall("core/logout", {}, sid).catch(() => undefined);
  }
}
