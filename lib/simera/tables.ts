import type { ReportRow } from "@/lib/wialon/report";

/** Concatenate every table whose name matches `pattern`, largest first.
 *  Templates often expose more than one “Eco …” sheet (summary vs detail);
 *  taking only the first match drops the detailization rows. */
export function mergeMatchingTables(
  dfs: Record<string, ReportRow[]>,
  pattern: RegExp,
): ReportRow[] {
  const hits = Object.entries(dfs).filter(([k]) => pattern.test(k));
  if (!hits.length) return [];
  hits.sort((a, b) => (b[1]?.length ?? 0) - (a[1]?.length ?? 0));
  const out: ReportRow[] = [];
  for (const [, rows] of hits) {
    for (const r of rows) out.push({ ...r });
  }
  return out;
}

export function pickDf(
  dfs: Record<string, ReportRow[]>,
  pattern: RegExp,
  label: string,
): { key: string; rows: ReportRow[] } {
  const hits = Object.entries(dfs).filter(([k]) => pattern.test(k));
  if (!hits.length) {
    throw new Error(
      `No table for ${label} matching ${pattern}. Keys: ${Object.keys(dfs).join(", ")}`,
    );
  }
  const [key, rows] = hits[0]!;
  return { key, rows: rows.map((r) => ({ ...r })) };
}

export function normGrouping(g: unknown): string {
  return String(g ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

type RenameSpec = Record<string, string[]>;

export function matchRename<T extends ReportRow>(df: T[], targets: RenameSpec): T[] {
  const cols = Object.keys(df[0] ?? {});
  const lower = new Map(cols.map((c) => [c.toLowerCase(), c]));
  const rename: Record<string, string> = {};
  for (const [canon, aliases] of Object.entries(targets)) {
    for (const a of aliases) {
      const k = a.trim().toLowerCase();
      const orig = lower.get(k);
      if (orig) {
        rename[orig] = canon;
        break;
      }
    }
  }
  return df.map((row) => {
    const out = { ...row } as Record<string, string | number | null>;
    for (const [from, to] of Object.entries(rename)) {
      if (from in out && !(to in out)) {
        out[to] = out[from]!;
        delete out[from];
      }
      const fromCoords = `${from}_coords`;
      const toCoords = `${to}_coords`;
      if (fromCoords in out && !(toCoords in out)) {
        out[toCoords] = out[fromCoords]!;
        delete out[fromCoords];
      }
    }
    return out as T;
  });
}
