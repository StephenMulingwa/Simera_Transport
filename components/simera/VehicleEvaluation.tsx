"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bus,
  Calendar,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  Gauge,
  Leaf,
  Loader2,
  MapPin,
  PhoneOff,
  Play,
  TrendingDown,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { useSimeraData } from "@/lib/contexts/SimeraDataContext";
import type { FleetRow, Incident } from "@/lib/contexts/SimeraDataContext";
import type { ReportRow } from "@/lib/wialon/report";
import {
  exportSimeraReportPdf,
  formatDateRangeLabel,
} from "@/lib/simera/exportSimeraReportPdf";
import {
  formatAppDateTime,
  formatTelemetryInstantDisplay,
} from "@/lib/simera/appTime";
import { CARD_LABELS, type DriverCardId } from "@/lib/simera/driverUi";
import { googleMapsPlaceUrl } from "@/lib/simera/parsers";

const INCIDENT_CARD_ORDER: DriverCardId[] = [
  "overspeeding",
  "harsh_braking",
  "harsh_cornering",
  "harsh_acceleration",
  "overrevving",
  "eco_roll",
  "idling",
  "offline",
];

const SUMMARY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

type ReportTable = {
  title: string;
  rows: ReportRow[];
};

type SummaryReportResponse = {
  generatedAt: string;
  interval: { from: string; to: string };
  tables: ReportTable[];
};

type ViolationCardStyle = {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
};

const VIOLATION_CARD_STYLES: Record<DriverCardId, ViolationCardStyle> = {
  overspeeding: {
    icon: TrendingUp,
    gradient: "from-purple-500 to-purple-700",
  },
  harsh_braking: {
    icon: TrendingDown,
    gradient: "from-orange-500 to-red-600",
  },
  harsh_cornering: {
    icon: AlertTriangle,
    gradient: "from-amber-500 to-orange-600",
  },
  harsh_acceleration: {
    icon: Zap,
    gradient: "from-yellow-500 to-amber-600",
  },
  overrevving: {
    icon: Gauge,
    gradient: "from-violet-500 to-fuchsia-600",
  },
  eco_roll: {
    icon: Leaf,
    gradient: "from-emerald-500 to-green-700",
  },
  idling: {
    icon: Clock3,
    gradient: "from-sky-500 to-blue-600",
  },
  offline: {
    icon: PhoneOff,
    gradient: "from-zinc-600 to-zinc-800",
  },
};

function normVehicle(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function vehicleList(
  fleet: FleetRow[] | undefined,
  mapUnits: { registration: string }[],
  incidents: Incident[] | undefined,
): string[] {
  const set = new Set<string>();
  for (const r of fleet ?? []) {
    if (r.vehicle?.trim()) set.add(r.vehicle.trim());
  }
  for (const u of mapUnits) {
    if (u.registration?.trim()) set.add(u.registration.trim());
  }
  for (const inc of incidents ?? []) {
    if (inc.vehicle?.trim()) set.add(inc.vehicle.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function emptyIncidentCounts(): Record<DriverCardId, number> {
  return {
    overspeeding: 0,
    harsh_braking: 0,
    harsh_cornering: 0,
    harsh_acceleration: 0,
    overrevving: 0,
    eco_roll: 0,
    idling: 0,
    offline: 0,
  };
}

export function VehicleEvaluation() {
  const {
    fleet,
    mapUnits,
    driver,
    fleetError,
    driverError,
    mapError,
    firstLoadDone,
  } = useSimeraData();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [fromInput, setFromInput] = useState(() =>
    toLocalInput(new Date(Date.now() - SUMMARY_LOOKBACK_MS)),
  );
  const [toInput, setToInput] = useState(() => toLocalInput(new Date()));
  const [summaryReport, setSummaryReport] = useState<SummaryReportResponse | null>(
    null,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const vehicles = useMemo(
    () => vehicleList(fleet?.table, mapUnits, driver?.incidents),
    [fleet?.table, mapUnits, driver?.incidents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => v.toLowerCase().includes(q));
  }, [vehicles, query]);

  const selectOptions = useMemo(() => {
    if (!selected) return filtered;
    const present = filtered.some((v) => normVehicle(v) === normVehicle(selected));
    return present ? filtered : [selected, ...filtered];
  }, [filtered, selected]);

  useEffect(() => {
    if (!vehicles.length) {
      if (selected) setSelected("");
      return;
    }
    const selectedStillExists = vehicles.some(
      (v) => normVehicle(v) === normVehicle(selected),
    );
    if (!selected || !selectedStillExists) {
      setSelected(vehicles[0]!);
    }
  }, [vehicles, selected]);

  const fleetRow = useMemo(() => {
    if (!selected) return null;
    const n = normVehicle(selected);
    return fleet?.table.find((r) => normVehicle(r.vehicle) === n) ?? null;
  }, [fleet?.table, selected]);

  const mapUnit = useMemo(() => {
    if (!selected) return null;
    const n = normVehicle(selected);
    return mapUnits.find((u) => normVehicle(u.registration) === n) ?? null;
  }, [mapUnits, selected]);

  const vehicleIncidents = useMemo(() => {
    if (!selected || !driver?.incidents) return [];
    const n = normVehicle(selected);
    return driver.incidents.filter((i) => normVehicle(i.vehicle) === n);
  }, [driver?.incidents, selected]);

  const incidentCounts = useMemo(() => {
    const next = emptyIncidentCounts();
    for (const incident of vehicleIncidents) {
      if (incident.filterCard === "other") continue;
      next[incident.filterCard]++;
    }
    return next;
  }, [vehicleIncidents]);

  const visibleIncidentCards = useMemo(
    () =>
      INCIDENT_CARD_ORDER.filter((id) => incidentCounts[id] > 0).map((id) => ({
        id,
        label: CARD_LABELS[id],
        value: incidentCounts[id],
      })),
    [incidentCounts],
  );

  const runSummaryReport = useCallback(
    async (vehicle: string, fromValue: string, toValue: string) => {
      if (!vehicle) return;

      const fromDate = new Date(fromValue);
      const toDate = new Date(toValue);
    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      fromDate > toDate
    ) {
      setSummaryError("Choose a valid From/To time range.");
      setSummaryReport(null);
      return;
    }

      setSummaryLoading(true);
      setSummaryError(null);
      setSummaryReport(null);

      try {
        const r = await fetch("/api/wialon/reports/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            vehicles: [vehicle],
          }),
        });
        const j = (await r.json().catch(() => ({}))) as SummaryReportResponse & {
          error?: string;
        };
        if (!r.ok) {
          throw new Error(j.error ?? "Failed to load summary report");
        }
        setSummaryReport(j);
      } catch (e) {
        setSummaryError(
          e instanceof Error ? e.message : "Failed to load summary report",
        );
      } finally {
        setSummaryLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selected) return;
    void runSummaryReport(selected, fromInput, toInput);
  }, [selected, runSummaryReport]);

  const displayVehicle =
    fleetRow?.vehicle?.trim() || mapUnit?.registration?.trim() || selected;

  const coordsStr =
    mapUnit != null
      ? `${mapUnit.lat.toFixed(5)},${mapUnit.lon.toFixed(5)}`
      : null;
  const mapsHref = coordsStr
    ? googleMapsPlaceUrl(displayVehicle, coordsStr)
    : fleetRow?.locationUrl ?? null;

  const showSkeleton = !firstLoadDone && !fleet && !driver;
  const summaryTable = summaryReport?.tables[0] ?? null;
  const summaryHeaders = summaryTable?.rows[0]
    ? Object.keys(summaryTable.rows[0])
    : [];
  const summaryRows = summaryTable?.rows ?? [];
  const metrics = [
    {
      label: "Last Message",
      value: fleetRow?.lastMessageTime
        ? formatTelemetryInstantDisplay(null, fleetRow.lastMessageTime)
        : "—",
      icon: Clock3,
    },
    {
      label: "Speed",
      value: fleetRow?.speed?.trim() || "—",
      icon: Gauge,
    },
    {
      label: "Violations",
      value: fleetRow != null ? String(fleetRow.violationsCount) : "—",
      icon: AlertTriangle,
      highlight: fleetRow != null && fleetRow.violationsCount > 0,
    },
    {
      label: "Idling",
      value: fleetRow?.idling?.trim() || "—",
      icon: Clock3,
    },
  ];

  const handleDownload = async () => {
    if (!summaryReport || summaryHeaders.length === 0) return;
    const summaryBody = summaryRows.map((row) =>
      summaryHeaders.map((header) => String(row[header] ?? "—")),
    );
    const locationDriverBody = [
      ["Last location", fleetRow?.location?.trim() || "—"],
      ["Driver", fleetRow?.driver?.trim() || "—"],
      [
        "Max. speed",
        fleetRow?.maxSpeed != null ? `${fleetRow.maxSpeed} km/h` : "—",
      ],
    ];
    const liveVehicleBody = [
      ["Vehicle Reg", displayVehicle || "—"],
      [
        "Live speed",
        mapUnit?.speedKmh != null ? `${mapUnit.speedKmh} km/h` : "—",
      ],
      [
        "Coordinates",
        mapUnit != null
          ? `${mapUnit.lat.toFixed(6)}, ${mapUnit.lon.toFixed(6)}`
          : "—",
      ],
      ["Google Maps", mapsHref || "—"],
    ];
    const violationsBody = visibleIncidentCards.map((item) => [
      item.label,
      String(item.value),
    ]);

    await exportSimeraReportPdf({
      title: `Vehicle Evaluation — ${displayVehicle}`,
      subtitle: formatDateRangeLabel(
        summaryReport.interval.from,
        summaryReport.interval.to,
      ),
      summary: [
        { label: "Last Message", value: metrics[0]!.value },
        { label: "Speed", value: metrics[1]!.value },
        { label: "Violations", value: metrics[2]!.value, accent: "#b50f1f" },
        { label: "Idling", value: metrics[3]!.value },
      ],
      narrative:
        "This export includes the same data shown on the Vehicle Evaluation page for the selected vehicle and chosen period.",
      sections: [
        {
          heading: "Location & Driver",
          head: [["Field", "Value"]],
          body: locationDriverBody,
        },
        {
          heading: "Live Vehicle Status",
          head: [["Field", "Value"]],
          body: liveVehicleBody,
        },
        ...(violationsBody.length > 0
          ? [
              {
                heading: "Violation Cards",
                head: [["Violation", "Count"]],
                body: violationsBody,
              },
            ]
          : []),
        {
          heading: "Summary",
          head: [summaryHeaders],
          body: summaryBody,
        },
      ],
      fileName: `simera_vehicle_evaluation_${displayVehicle.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
          <ClipboardCheck className="h-7 w-7 text-red-600" />
          Vehicle <span className="text-red-700">Evaluation</span>
        </h1>
        <p className="mt-1 text-sm font-medium text-zinc-700">
          Review one vehicle with live status, selected-period Summary data,
          and downloadable Simera-styled reporting.
        </p>
      </div>

      {(fleetError || driverError || mapError) && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-950">
          {fleetError && <span>Fleet: {fleetError}</span>}
          {driverError && <span>Driver: {driverError}</span>}
          {mapError && <span>Map: {mapError}</span>}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900">
            <Bus className="h-4 w-4 text-red-600" />
            Select vehicle
          </h2>
          <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
            <label className="block min-w-0 text-xs font-bold uppercase tracking-wider text-zinc-700">
              Search
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by vehicle reg..."
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </label>
            <label className="block min-w-0 text-xs font-bold uppercase tracking-wider text-zinc-700">
              Vehicle
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                {selectOptions.length > 0 ? (
                  selectOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))
                ) : (
                  <option value="">No vehicles</option>
                )}
              </select>
            </label>
          </div>
          {showSkeleton && (
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              Loading vehicle directory…
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900">
            <Calendar className="h-4 w-4 text-red-600" />
            Report period
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
              From
              <input
                type="datetime-local"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
              To
              <input
                type="datetime-local"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runSummaryReport(selected, fromInput, toInput)}
              disabled={!selected || summaryLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {summaryLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {summaryLoading ? "Running..." : "Run report"}
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={!summaryReport || summaryLoading || summaryHeaders.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </section>
      </div>

      {!selected ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm font-medium text-zinc-600">
          No vehicles are available yet.
        </p>
      ) : (
        <div className="space-y-4">
          {!fleetRow && !mapUnit && visibleIncidentCards.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <AlertCircle className="h-4 w-4 shrink-0" />
              No fleet, map, or incident rows matched this vehicle yet. Try
              another registration or wait for the next refresh.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((item) => (
              <MetricCard
                key={item.label}
                label={item.label}
                value={item.value}
                icon={item.icon}
                highlight={item.highlight}
              />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={MapPin} title="Location & driver" />
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Last location
                  </dt>
                  <dd className="mt-1 font-medium leading-6 text-zinc-900">
                    {fleetRow?.location?.trim() ? (
                      mapsHref ? (
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 underline-offset-2 hover:underline"
                        >
                          {fleetRow.location}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        fleetRow.location
                      )
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Driver
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 font-medium text-zinc-900">
                    <User className="h-4 w-4 text-zinc-400" />
                    {fleetRow?.driver?.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Max. speed
                  </dt>
                  <dd className="mt-1 font-mono font-medium tabular-nums text-zinc-900">
                    {fleetRow?.maxSpeed != null ? `${fleetRow.maxSpeed} km/h` : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={Gauge} title="Live vehicle status" />
              {mapUnit ? (
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                      Vehicle Reg
                    </dt>
                    <dd className="mt-1 font-mono font-bold text-zinc-900">
                      {displayVehicle}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                      Live speed
                    </dt>
                    <dd className="mt-1 font-medium text-zinc-900">
                      {mapUnit.speedKmh != null ? `${mapUnit.speedKmh} km/h` : "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                      Coordinates
                    </dt>
                    <dd className="mt-1 space-y-1 font-medium text-zinc-900">
                      <p className="font-mono text-xs text-zinc-700">
                        {mapUnit.lat.toFixed(6)}, {mapUnit.lon.toFixed(6)}
                      </p>
                      <a
                        href={googleMapsPlaceUrl(displayVehicle, coordsStr ?? "")}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"
                      >
                        Open in Google Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm font-medium text-zinc-600">
                  No live map position for this vehicle in the current snapshot.
                </p>
              )}
            </section>
          </div>

          {visibleIncidentCards.length > 0 && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <SectionTitle icon={ClipboardCheck} title="Violation cards" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
                {visibleIncidentCards.map((item) => (
                  <ViolationCard
                    key={item.id}
                    label={item.label}
                    value={item.value}
                    id={item.id}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-red-600" />
                  <h3 className="text-base font-bold text-zinc-900">
                    Summary table
                  </h3>
                </div>
                <p className="mt-1 text-xs font-medium text-zinc-600">
                  Same Summary structure used in the Reports tab, filtered to the
                  selected vehicle and chosen period.
                </p>
              </div>
              {summaryReport && (
                <div className="text-right text-xs font-medium text-zinc-600">
                  <div>{formatDateRangeLabel(summaryReport.interval.from, summaryReport.interval.to)}</div>
                  <div>Generated {formatAppDateTime(summaryReport.generatedAt)}</div>
                </div>
              )}
            </header>
            <div className="max-h-[min(520px,calc(100vh-20rem))] overflow-auto">
              {summaryLoading ? (
                <div className="px-4 py-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600" />
                  <p className="mt-2 text-sm font-medium text-zinc-600">
                    Running Summary report for {displayVehicle}...
                  </p>
                </div>
              ) : summaryError ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {summaryError}
                </div>
              ) : summaryHeaders.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm font-medium text-zinc-600">
                  No summary rows available for this vehicle.
                </p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead
                    className="sticky top-0 z-10 text-white"
                    style={{
                      background:
                        "linear-gradient(90deg, #7a0d18 0%, #b50f1f 50%, #7a0d18 100%)",
                    }}
                  >
                    <tr>
                      {summaryHeaders.map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {summaryRows.map((row, idx) => (
                      <tr
                        key={`${displayVehicle}-${idx}`}
                        className={
                          idx % 2 === 1
                            ? "bg-zinc-50/70 hover:bg-red-50/40"
                            : "bg-white hover:bg-red-50/40"
                        }
                      >
                        {summaryHeaders.map((h) => (
                          <td
                            key={h}
                            className="whitespace-nowrap px-3 py-2.5 font-medium text-zinc-800"
                          >
                            {String(row[h] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="text-base font-bold text-zinc-900">{title}</h3>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-4 py-4 shadow-sm transition ${
        highlight
          ? "border-red-200 bg-gradient-to-br from-red-50 via-white to-rose-50 shadow-red-100/50"
          : "border-zinc-200 bg-gradient-to-br from-white to-zinc-50"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-amber-400" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            {label}
          </p>
          <p className="mt-3 text-xl font-extrabold leading-tight tabular-nums text-zinc-900">
            {value}
          </p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function ViolationCard({
  id,
  label,
  value,
}: {
  id: DriverCardId;
  label: string;
  value: number;
}) {
  const { icon: Icon, gradient } = VIOLATION_CARD_STYLES[id];
  return (
    <div
      className={`rounded-lg bg-gradient-to-br ${gradient} p-3 text-left text-white shadow-sm`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
        <Icon className="h-3.5 w-3.5 opacity-80" />
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
