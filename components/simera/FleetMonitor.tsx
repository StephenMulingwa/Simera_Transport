"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bus,
  Loader2,
  MapPin,
  Power,
  Square,
  X,
} from "lucide-react";
import { useSimeraData } from "@/lib/contexts/SimeraDataContext";
import type { FleetRow } from "@/lib/contexts/SimeraDataContext";
import { formatAppTimeOnly, formatTelemetryInstantDisplay } from "@/lib/simera/appTime";
import { parseIdlingToSeconds } from "@/lib/simera/idlingSort";
import { parseReportDateTime, parseSpeedKmh } from "@/lib/simera/parsers";

type FleetFilter = "all" | "active" | "stationary" | "notUpdating";

const FILTER_LABEL: Record<FleetFilter, string> = {
  all: "Total Fleet",
  active: "Active Fleet",
  stationary: "Stationary",
  notUpdating: "Not Updating",
};

function rowMatchesFilter(
  row: FleetRow,
  filter: FleetFilter,
  now: Date,
): boolean {
  if (filter === "all") return true;
  const h24 = 24 * 60 * 60 * 1000;
  const boundary = new Date(now.getTime() - h24);
  const t = row.lastMessageTime ? parseReportDateTime(row.lastMessageTime) : null;
  const speed = parseSpeedKmh(row.speed);
  const isActive = t != null && t >= boundary;
  switch (filter) {
    case "active":
      return isActive;
    case "stationary":
      return isActive && speed !== null && speed <= 0.5;
    case "notUpdating":
      return !isActive;
    default:
      return true;
  }
}

type SortKey =
  | "vehicle"
  | "lastMessageTime"
  | "location"
  | "speed"
  | "driver"
  | "violationsCount"
  | "idling"
  | "maxSpeed";

type Dir = "asc" | "desc";

const SORT_COLS: {
  key: SortKey;
  label: string;
  align?: "right";
}[] = [
  { key: "vehicle", label: "Vehicle" },
  { key: "lastMessageTime", label: "Last message time" },
  { key: "location", label: "Location" },
  { key: "speed", label: "Speed" },
  { key: "driver", label: "Driver" },
  { key: "violationsCount", label: "Violations Count", align: "right" },
  { key: "idling", label: "Idling" },
  { key: "maxSpeed", label: "Max. speed (km/h)", align: "right" },
];

function parseSpeedNum(s: string | null): number {
  if (!s?.trim()) return -1;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function compareRows(a: FleetRow, b: FleetRow, key: SortKey, dir: Dir): number {
  const mul = dir === "asc" ? 1 : -1;
  switch (key) {
    case "vehicle":
      return mul * a.vehicle.localeCompare(b.vehicle);
    case "lastMessageTime": {
      const ta = a.lastMessageTime
        ? parseReportDateTime(a.lastMessageTime)?.getTime() ?? 0
        : 0;
      const tb = b.lastMessageTime
        ? parseReportDateTime(b.lastMessageTime)?.getTime() ?? 0
        : 0;
      return mul * (ta - tb);
    }
    case "location": {
      const la = (a.location ?? "").toLowerCase();
      const lb = (b.location ?? "").toLowerCase();
      return mul * la.localeCompare(lb);
    }
    case "speed":
      return mul * (parseSpeedNum(a.speed) - parseSpeedNum(b.speed));
    case "driver":
      return mul * (a.driver ?? "").localeCompare(b.driver ?? "");
    case "violationsCount":
      return mul * (a.violationsCount - b.violationsCount);
    case "idling":
      return mul * (
        parseIdlingToSeconds(a.idling) - parseIdlingToSeconds(b.idling)
      );
    case "maxSpeed": {
      const ma = a.maxSpeed ?? -1;
      const mb = b.maxSpeed ?? -1;
      return mul * (ma - mb);
    }
    default:
      return 0;
  }
}

export function FleetMonitor() {
  const { fleet, fleetError, firstLoadDone, lastUpdatedAt } = useSimeraData();
  const [filter, setFilter] = useState<FleetFilter>("all");

  const showSkeleton = !firstLoadDone && !fleet;

  const pick = (next: FleetFilter) => {
    setFilter((cur) => (cur === next ? "all" : next));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Fleet <span className="text-red-700">Monitor</span>
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-700">
            KPIs use the last 24 hours. Click a card to filter the summary
            below; click again to clear.
          </p>
        </div>
        {lastUpdatedAt && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
            Last update {formatAppTimeOnly(lastUpdatedAt)}
          </span>
        )}
      </div>

      {fleetError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fleetError}
        </div>
      )}

      {showSkeleton ? (
        <SkeletonGrid />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Total Fleet"
            value={fleet?.kpis.totalFleet ?? 0}
            icon={Bus}
            tone="white"
            selected={filter === "all"}
            onSelect={() => pick("all")}
          />
          <KpiCard
            title="Active Fleet"
            subtitle="Reporting in last 24h"
            value={fleet?.kpis.activeFleet ?? 0}
            icon={Power}
            tone="red"
            selected={filter === "active"}
            onSelect={() => pick("active")}
          />
          <KpiCard
            title="Stationary"
            subtitle="Speed ~0 · last 24h"
            value={fleet?.kpis.stationary ?? 0}
            icon={Square}
            tone="amber"
            selected={filter === "stationary"}
            onSelect={() => pick("stationary")}
          />
          <KpiCard
            title="Not Updating"
            subtitle="No message in 24h"
            value={fleet?.kpis.notUpdating ?? 0}
            icon={MapPin}
            tone="dark"
            selected={filter === "notUpdating"}
            onSelect={() => pick("notUpdating")}
          />
        </div>
      )}

      <FleetTable
        rows={fleet?.table ?? []}
        loading={showSkeleton}
        filter={filter}
        onClearFilter={() => setFilter("all")}
      />
    </div>
  );
}

function KpiCard({
  title,
  subtitle,
  value,
  icon: Icon,
  tone,
  selected = false,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "white" | "red" | "amber" | "dark";
  selected?: boolean;
  onSelect?: () => void;
}) {
  const tones: Record<typeof tone, string> = {
    white:
      "border-zinc-200 bg-white text-zinc-900 [&_.kpi-icon]:bg-red-50 [&_.kpi-icon]:text-red-600",
    red:
      "border-red-700 bg-gradient-to-br from-red-600 to-red-800 text-white [&_.kpi-icon]:bg-white/20 [&_.kpi-icon]:text-white",
    amber:
      "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100 text-zinc-900 [&_.kpi-icon]:bg-amber-200 [&_.kpi-icon]:text-amber-700",
    dark:
      "border-zinc-800 bg-gradient-to-br from-zinc-800 to-zinc-900 text-white [&_.kpi-icon]:bg-white/15 [&_.kpi-icon]:text-white",
  };

  const ringClass = selected
    ? "ring-2 ring-offset-2 ring-red-500 shadow-md scale-[1.01]"
    : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative w-full overflow-hidden rounded-xl border p-4 text-left shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${tones[tone]} ${ringClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-xs font-bold uppercase tracking-wider ${
              tone === "red" || tone === "dark"
                ? "text-white/90"
                : "text-zinc-700"
            }`}
          >
            {title}
          </p>
          {subtitle && (
            <p
              className={`mt-0.5 text-[11px] ${
                tone === "red" || tone === "dark"
                  ? "text-white/75"
                  : "text-zinc-600"
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
        <span className="kpi-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tabular-nums">{value}</p>
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[110px] animate-pulse rounded-xl border border-zinc-200 bg-white"
        />
      ))}
    </div>
  );
}

function FleetTable({
  rows,
  loading,
  filter,
  onClearFilter,
}: {
  rows: FleetRow[];
  loading: boolean;
  filter: FleetFilter;
  onClearFilter: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("idling");
  const [sortDir, setSortDir] = useState<Dir>("desc");

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    const now = new Date();
    return rows.filter((r) => rowMatchesFilter(r, filter, now));
  }, [rows, filter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return copy;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "violationsCount" || key === "maxSpeed" || key === "idling"
          ? "desc"
          : "asc",
      );
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) {
      return <ArrowUpDown className="inline h-3.5 w-3.5 opacity-70" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="inline h-3.5 w-3.5" />
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Bus className="h-4 w-4 text-red-600" />
          <h2 className="font-bold text-zinc-900">
            Fleet Summary{" "}
            <span className="font-normal text-zinc-600">
              ({sorted.length}
              {filter !== "all" ? ` of ${rows.length}` : ""})
            </span>
          </h2>
          {filter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">
              {FILTER_LABEL[filter]}
              <button
                type="button"
                onClick={onClearFilter}
                aria-label="Clear filter"
                className="rounded-full p-0.5 hover:bg-red-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-zinc-700">
          Default: idling (highest first)
        </span>
      </div>
      <div className="max-h-[min(calc(100vh-14rem),1560px)] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead
            className="sticky top-0 z-10 text-white"
            style={{
              background:
                "linear-gradient(90deg, #1e3a8a 0%, #1e40af 50%, #1e3a8a 100%)",
            }}
          >
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                #
              </th>
              {SORT_COLS.map(({ key, label, align }) => (
                <th
                  key={key}
                  className={`whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider ${
                    align === "right" ? "text-right" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className={`inline-flex items-center gap-1 rounded px-1 py-0.5 font-bold hover:bg-white/10 ${
                      align === "right"
                        ? "ml-auto w-full min-w-[7rem] justify-end"
                        : ""
                    }`}
                  >
                    {label}
                    <SortIcon col={key} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-500" />
                  <p className="mt-2 text-xs font-medium text-zinc-700">
                    Executing Reports…
                  </p>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center font-medium text-zinc-700"
                >
                  {filter === "all"
                    ? "No rows in this window."
                    : `No vehicles match "${FILTER_LABEL[filter]}".`}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={`${row.vehicle}-${i}`}
                  className={
                    i % 2 === 1
                      ? "bg-zinc-50/60 hover:bg-red-50/50"
                      : "bg-white hover:bg-red-50/50"
                  }
                >
                  <td className="px-4 py-2.5 font-medium text-zinc-700">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-zinc-900">
                    {row.vehicle}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-medium text-zinc-800">
                    {formatTelemetryInstantDisplay(null, row.lastMessageTime)}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.location && row.locationUrl ? (
                      <a
                        href={row.locationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-700 underline-offset-2 hover:text-blue-900 hover:underline"
                      >
                        {row.location}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium tabular-nums text-zinc-800">
                    {row.speed ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-900">
                    {row.driver?.trim() || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {row.violationsCount > 0 ? (
                      <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                        {row.violationsCount}
                      </span>
                    ) : (
                      <span className="text-zinc-600">0</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-medium text-zinc-800">
                    {row.idling ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-zinc-800">
                    {row.maxSpeed != null ? row.maxSpeed : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
