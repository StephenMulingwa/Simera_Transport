"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  Truck,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportRow } from "@/lib/wialon/report";

export type ReportKind =
  | "fuel"
  | "eco"
  | "engine"
  | "latest"
  | "summary";

type ReportTable = {
  /** Human-friendly name shown in the title bar of each table block */
  title: string;
  rows: ReportRow[];
};

type ReportResponse = {
  generatedAt: string;
  interval: { from: string; to: string };
  tables: ReportTable[];
};

type Props = {
  kind: ReportKind;
  title: string;
  subtitle: string;
  /** Default From date (defaults to 24h ago) */
  defaultFromHoursAgo?: number;
};

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReportBuilder({
  kind,
  title,
  subtitle,
  defaultFromHoursAgo = 24,
}: Props) {
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [from, setFrom] = useState(() =>
    toLocalInput(new Date(Date.now() - defaultFromHoursAgo * 60 * 60 * 1000)),
  );
  const [to, setTo] = useState(() => toLocalInput(new Date()));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReportResponse | null>(null);

  // Load vehicle list from the latest fleet snapshot
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/wialon/fleet");
        if (!r.ok) return;
        const d = (await r.json()) as { table: { vehicle: string }[] };
        const v = [...new Set(d.table.map((t) => t.vehicle))].sort();
        setVehicles(v);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => v.toLowerCase().includes(q));
  }, [vehicles, vehicleQuery]);

  const togglePick = (v: string) => {
    setPicked((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  };

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/wialon/reports/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
          vehicles: picked.length > 0 ? picked : undefined,
        }),
      });
      const j = (await r.json()) as ReportResponse & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Report failed");
      setPayload(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [kind, from, to, picked]);

  const downloadExcel = (table: ReportTable) => {
    const wb = XLSX.utils.book_new();
    const ws = table.rows.length
      ? XLSX.utils.json_to_sheet(table.rows)
      : XLSX.utils.aoa_to_sheet([["No data"]]);
    XLSX.utils.book_append_sheet(wb, ws, table.title.slice(0, 31));
    XLSX.writeFile(
      wb,
      `simera_${kind}_${table.title.replace(/\s+/g, "_")}_${Date.now()}.xlsx`,
    );
  };

  const downloadAllExcel = () => {
    if (!payload) return;
    const wb = XLSX.utils.book_new();
    for (const t of payload.tables) {
      const ws = t.rows.length
        ? XLSX.utils.json_to_sheet(t.rows)
        : XLSX.utils.aoa_to_sheet([["No data"]]);
      XLSX.utils.book_append_sheet(wb, ws, t.title.slice(0, 31));
    }
    XLSX.writeFile(wb, `simera_${kind}_${Date.now()}.xlsx`);
  };

  const renderTableToPdf = (
    doc: jsPDF,
    table: ReportTable,
    opts: { firstOnDoc: boolean },
  ) => {
    const margin = 36;
    let y = margin;

    if (!opts.firstOnDoc) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(196, 18, 36);
    doc.text("Simera Transport LTD", margin, y);

    y += 22;
    doc.setFontSize(13);
    doc.setTextColor(40, 40, 40);
    doc.text(table.title, margin, y);

    if (payload) {
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(
        `Period: ${new Date(payload.interval.from).toLocaleString()}  →  ${new Date(payload.interval.to).toLocaleString()}     ·     Generated: ${new Date(payload.generatedAt).toLocaleString()}     ·     Rows: ${table.rows.length}`,
        margin,
        y,
      );
    }

    y += 10;

    if (!table.rows.length) {
      y += 14;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(110, 110, 110);
      doc.text("No rows for this selection.", margin, y);
      return;
    }

    const headers = Object.keys(table.rows[0]!);
    const body = table.rows.map((r) => headers.map((h) => String(r[h] ?? "")));

    autoTable(doc, {
      head: [headers],
      body,
      startY: y,
      styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
      headStyles: {
        fillColor: [196, 18, 36],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: margin, right: margin },
    });
  };

  const downloadPdf = (table: ReportTable) => {
    if (!table.rows.length) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    renderTableToPdf(doc, table, { firstOnDoc: true });
    doc.save(
      `simera_${kind}_${table.title.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
    );
  };

  const downloadAllPdf = () => {
    if (!payload) return;
    const tables = payload.tables.filter((t) => t.rows.length > 0);
    if (tables.length === 0) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    tables.forEach((t, i) => renderTableToPdf(doc, t, { firstOnDoc: i === 0 }));
    doc.save(`simera_${kind}_all_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/reports"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-800 hover:text-red-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">
            {title}{" "}
            <span className="text-red-700">Report</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-700">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Filters */}
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900">
            <Calendar className="h-4 w-4 text-red-600" />
            Period & Vehicles
          </h2>
          {kind === "eco" && (
            <p className="mb-3 text-xs font-medium text-zinc-600">
              From / To use your computer&apos;s local timezone. Align the
              window with Wialon&apos;s report interval (check AM vs PM); if the
              interval is wrong, violations fall outside the range.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold text-zinc-800">
              From
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
              />
            </label>
            <label className="block text-sm font-semibold text-zinc-800">
              To
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
              />
            </label>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-800">
                  Vehicles{" "}
                  <span className="font-normal text-zinc-600">
                    (optional · empty = all)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPicker((s) => !s)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                >
                  <Truck className="h-3.5 w-3.5" />
                  {showPicker ? "Hide list" : "Choose vehicles"}
                </button>
              </div>

              {showPicker && (
                <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                  <input
                    type="text"
                    placeholder="Search vehicles…"
                    value={vehicleQuery}
                    onChange={(e) => setVehicleQuery(e.target.value)}
                    className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-500"
                  />
                  <div className="grid max-h-44 grid-cols-2 gap-1 overflow-auto sm:grid-cols-3 md:grid-cols-4">
                    {filteredVehicles.map((v) => {
                      const on = picked.includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => togglePick(v)}
                          className={`truncate rounded px-2 py-1 text-left text-xs font-mono transition ${
                            on
                              ? "bg-red-600 text-white"
                              : "bg-white text-zinc-700 hover:bg-red-50"
                          }`}
                        >
                          {v}
                        </button>
                      );
                    })}
                    {filteredVehicles.length === 0 && (
                      <span className="col-span-full px-2 py-2 text-xs text-zinc-500">
                        No vehicles match.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {picked.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-700">
                    Selected:
                  </span>
                  {picked.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-mono text-red-700 ring-1 ring-red-200"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() => togglePick(v)}
                        className="rounded-full p-0.5 hover:bg-red-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPicked([])}
                    className="ml-1 text-xs font-bold text-zinc-500 underline-offset-2 hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {loading ? "Running…" : "Generate report"}
            </button>
            {payload && payload.tables.some((t) => t.rows.length > 0) && (
              <>
                <button
                  type="button"
                  onClick={downloadAllExcel}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  All sheets · Excel
                </button>
                <button
                  type="button"
                  onClick={downloadAllPdf}
                  className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 hover:bg-rose-100"
                >
                  <Download className="h-4 w-4" />
                  All sheets · PDF
                </button>
              </>
            )}
          </div>
        </section>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
            {error}
          </p>
        )}

        {payload && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-zinc-700">
              Generated {new Date(payload.generatedAt).toLocaleString()}
              {" · "}
              Period {new Date(payload.interval.from).toLocaleString()} →{" "}
              {new Date(payload.interval.to).toLocaleString()}
            </p>

            {payload.tables.map((t) => (
              <ResultTable
                key={t.title}
                table={t}
                onExcel={() => downloadExcel(t)}
                onPdf={() => void downloadPdf(t)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultTable({
  table,
  onExcel,
  onPdf,
}: {
  table: ReportTable;
  onExcel: () => void;
  onPdf: () => void;
}) {
  const headers = table.rows[0] ? Object.keys(table.rows[0]) : [];

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-600" />
          <h3 className="font-bold text-zinc-900">
            {table.title}{" "}
            <span className="font-normal text-zinc-600">
              ({table.rows.length})
            </span>
          </h3>
        </div>
        {table.rows.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExcel}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              XLSX
            </button>
            <button
              type="button"
              onClick={onPdf}
              className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>
        )}
      </header>
      <div className="max-h-[min(calc(100vh-14rem),1440px)] min-h-[48rem] overflow-auto">
        {table.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm font-medium text-zinc-700">
            No rows for this selection.
          </p>
        ) : (
          <table className="min-w-full text-left text-xs">
            <thead
              className="sticky top-0 z-10 text-white"
              style={{
                background:
                  "linear-gradient(90deg, #1e3a8a 0%, #1e40af 50%, #1e3a8a 100%)",
              }}
            >
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
                  #
                </th>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {table.rows.map((r, i) => (
                <tr
                  key={i}
                  className={
                    i % 2 === 1
                      ? "bg-zinc-50/60 hover:bg-red-50/40"
                      : "bg-white hover:bg-red-50/40"
                  }
                >
                  <td className="px-3 py-1.5 font-medium text-zinc-700">
                    {i + 1}
                  </td>
                  {headers.map((h) => (
                    <td
                      key={h}
                      className="whitespace-nowrap px-3 py-1.5 font-medium text-zinc-800"
                    >
                      {String(r[h] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
