"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Gauge,
  Leaf,
  MessageSquare,
  Phone,
  PhoneOff,
  Radio,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  useSimeraData,
  whatsappHref,
  type Incident,
} from "@/lib/contexts/SimeraDataContext";
import { CARD_LABELS, type DriverCardId } from "@/lib/simera/driverUi";
import {
  formatAppTimeOnly,
  formatTelemetryInstantDisplay,
} from "@/lib/simera/appTime";
import { parseReportDateTime } from "@/lib/simera/parsers";
import { useResolvedIncidents } from "@/hooks/useResolvedIncidents";

type FilterId = DriverCardId | "all";

type CardSpec = {
  id: DriverCardId;
  icon: React.ComponentType<{ className?: string }>;
  /** background gradient */
  gradient: string;
  /** ring color when active */
  ring: string;
};

const CARDS: CardSpec[] = [
  {
    id: "overspeeding",
    icon: TrendingUp,
    gradient: "from-purple-500 to-purple-700",
    ring: "ring-purple-300",
  },
  {
    id: "harsh_braking",
    icon: TrendingDown,
    gradient: "from-orange-500 to-red-600",
    ring: "ring-orange-300",
  },
  {
    id: "harsh_cornering",
    icon: AlertTriangle,
    gradient: "from-amber-500 to-orange-600",
    ring: "ring-amber-300",
  },
  {
    id: "harsh_acceleration",
    icon: Zap,
    gradient: "from-yellow-500 to-amber-600",
    ring: "ring-yellow-300",
  },
  {
    id: "overrevving",
    icon: Gauge,
    gradient: "from-violet-500 to-fuchsia-600",
    ring: "ring-violet-300",
  },
  {
    id: "eco_roll",
    icon: Leaf,
    gradient: "from-emerald-500 to-green-700",
    ring: "ring-emerald-300",
  },
  {
    id: "idling",
    icon: Clock,
    gradient: "from-sky-500 to-blue-600",
    ring: "ring-blue-300",
  },
  {
    id: "offline",
    icon: PhoneOff,
    gradient: "from-zinc-600 to-zinc-800",
    ring: "ring-zinc-400",
  },
];

export function DriverMonitoring() {
  const { driver, driverError, firstLoadDone, lastUpdatedAt } = useSimeraData();
  const { isResolved, markResolved } = useResolvedIncidents();
  const [filter, setFilter] = useState<FilterId>("all");

  const incidents = driver?.incidents ?? [];

  /** Unresolved incidents only — matches what operators clear in the list */
  const activeCountByCard = useMemo(() => {
    const next: Record<DriverCardId, number> = {
      overspeeding: 0,
      harsh_braking: 0,
      harsh_cornering: 0,
      harsh_acceleration: 0,
      overrevving: 0,
      eco_roll: 0,
      idling: 0,
      offline: 0,
    };
    for (const i of incidents) {
      if (isResolved(i.id)) continue;
      if (i.filterCard === "other") continue;
      next[i.filterCard]++;
    }
    return next;
  }, [incidents, isResolved]);

  const pickFilter = (next: FilterId) => {
    setFilter((cur) => (cur === next ? "all" : next));
  };

  // Sort: active first by time desc, then resolved by time desc
  const ordered = useMemo(() => {
    const activeFirst = [...incidents].sort((a, b) => {
      const aRes = isResolved(a.id) ? 1 : 0;
      const bRes = isResolved(b.id) ? 1 : 0;
      if (aRes !== bRes) return aRes - bRes;
      const at = a.violationTimeIso ? new Date(a.violationTimeIso).getTime() : 0;
      const bt = b.violationTimeIso ? new Date(b.violationTimeIso).getTime() : 0;
      return bt - at;
    });
    return activeFirst;
  }, [incidents, isResolved]);

  /** Single source of truth for both the count and the rendered list. */
  const filtered = useMemo(() => {
    if (filter === "all") return ordered;
    return ordered.filter((i) => i.filterCard === filter);
  }, [ordered, filter]);

  const filteredActive = useMemo(
    () => filtered.filter((i) => !isResolved(i.id)),
    [filtered, isResolved],
  );

  const activeCount = useMemo(
    () => ordered.filter((i) => !isResolved(i.id)).length,
    [ordered, isResolved],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
            <Radio className="h-6 w-6 text-red-600" />
            Driver-Incidents
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-700">
            Monitor and clear driver-related alerts and incidents.
          </p>
        </div>
        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
            activeCount > 0
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {activeCount} active alerts · Live
        </span>
      </div>

      {/* Active filter banner */}
      {filter !== "all" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
          <span className="flex items-center gap-2 font-semibold text-amber-900">
            <AlertCircle className="h-4 w-4" />
            {CARD_LABELS[filter as DriverCardId]} —{" "}
            {filteredActive.length} active alerts
          </span>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <X className="h-3.5 w-3.5" /> Clear Filter
          </button>
        </div>
      )}

      {driverError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {driverError}
        </div>
      )}

      {/* All-types card + violation cards (compact, bold, gradient) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-9">
        <button
          type="button"
          onClick={() => setFilter("all")}
          aria-pressed={filter === "all"}
          className={`group rounded-lg bg-gradient-to-br from-rose-500 to-red-700 p-3 text-left text-white shadow-sm ring-offset-2 transition hover:brightness-110 ${
            filter === "all" ? "ring-2 ring-yellow-400" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider">
              All Active
            </p>
            <Radio className="h-3.5 w-3.5 opacity-80" />
          </div>
          <p className="mt-1.5 text-2xl font-extrabold tabular-nums">
            {activeCount}
          </p>
        </button>

        {CARDS.map(({ id, icon: Icon, gradient, ring }) => (
          <button
            key={id}
            type="button"
            onClick={() => pickFilter(id)}
            aria-pressed={filter === id}
            className={`group rounded-lg bg-gradient-to-br ${gradient} p-3 text-left text-white shadow-sm ring-offset-2 transition hover:brightness-110 ${
              filter === id ? `ring-2 ${ring}` : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider">
                {CARD_LABELS[id]}
              </p>
              <Icon className="h-3.5 w-3.5 opacity-80" />
            </div>
            <p className="mt-1.5 text-2xl font-extrabold tabular-nums">
              {activeCountByCard[id] ?? 0}
            </p>
          </button>
        ))}
      </div>

      {/* Active list */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
            <Clock className="h-4 w-4 text-red-600" />
            {filter === "all"
              ? `Active Alerts (${filteredActive.length})`
              : `${CARD_LABELS[filter as DriverCardId]} (${filteredActive.length})`}
          </h2>
          {lastUpdatedAt && (
            <span className="text-[11px] font-medium text-zinc-600">
              Updated {formatAppTimeOnly(lastUpdatedAt)}
            </span>
          )}
        </header>
        {/* `key={filter}` forces a clean re-mount so any stale child state
            (open comment box, scroll position) is dropped when the operator
            switches the card filter. */}
        <div
          key={filter}
          className="max-h-[min(calc(100vh-14rem),1560px)] divide-y divide-zinc-100 overflow-y-auto"
        >
          {!firstLoadDone && filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Loading recent incidents…
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No incidents in the last 24 hours for this filter.
            </p>
          ) : (
            filtered.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                resolved={isResolved(inc.id)}
                onResolve={() => markResolved(inc.id)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function shortVehicle(v: string): { plate: string; jn: string } {
  // Split a label like "FG - Menengai - KCA 456U"; show last token as plate, middle as JN-style id
  const parts = v.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { plate: parts[parts.length - 1] ?? v, jn: parts[parts.length - 2] ?? "" };
  }
  return { plate: v, jn: "" };
}

function IncidentCard({
  incident,
  resolved,
  onResolve,
}: {
  incident: Incident;
  resolved: boolean;
  onResolve: () => void;
}) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!comment.trim()) return;
    setSending(true);
    setMsg(null);
    try {
      const r = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverName: incident.driverDisplayName,
          violationType: incident.violationRaw,
          violationTime:
            incident.violationTimeIso ??
            incident.violationTime ??
            new Date().toISOString(),
          locationText:
            [incident.locationInitial, incident.locationFinal]
              .filter(Boolean)
              .join(" → ") || "",
          vehicleRegistration: incident.vehicle,
          commentText: comment.trim(),
          durationText: incident.durationText,
          durationSec: incident.durationSec,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Save failed");
      setComment("");
      setMsg("Saved");
      onResolve();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  };

  const { plate, jn } = shortVehicle(incident.vehicle);

  const relativeSourceIso =
    incident.violationTimeIso ??
    (() => {
      const d = parseReportDateTime(incident.violationTime);
      return d ? d.toISOString() : null;
    })();

  return (
    <article
      className={`grid gap-2 px-4 py-3 transition ${
        resolved ? "bg-zinc-50/60 opacity-70" : "bg-white hover:bg-red-50/30"
      }`}
    >
      {/* Top line: meta tags */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-red-50 px-2 py-0.5 font-mono font-bold text-red-700">
          {plate}
        </span>
        {jn && (
          <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-zinc-700">
            JN: {jn.slice(-6)}
          </span>
        )}
        <span className="font-bold uppercase tracking-wide text-zinc-900">
          {incident.driverDisplayName}
        </span>
        <a
          href={whatsappHref(incident.phone)}
          target="_blank"
          rel="noreferrer"
          title="Open WhatsApp"
          className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white hover:bg-green-700"
        >
          <Phone className="h-3 w-3" />
          {incident.phone}
        </a>
        <span className="ml-auto flex items-center gap-2 font-medium text-zinc-700">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono text-[11px] tabular-nums">
            {formatTelemetryInstantDisplay(
              incident.violationTimeIso,
              incident.violationTime,
            )}
          </span>
          {relativeSourceIso && (
            <span className="text-[11px] tabular-nums text-zinc-500">
              ({relativeTime(relativeSourceIso)})
            </span>
          )}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
            resolved
              ? "bg-zinc-200 text-zinc-700"
              : "bg-red-600 text-white"
          }`}
        >
          {resolved ? "Resolved" : "Active"}
        </span>
      </div>

      {/* Violation summary */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-zinc-800">
        <span>
          {plate}: {incident.violationLabel}
        </span>
        {incident.filterCard === "overspeeding" &&
          (incident.speedDisplay ||
            (incident.speedKmh != null && Number.isFinite(incident.speedKmh))) && (
            <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-900 ring-1 ring-purple-200">
              <Gauge className="h-3 w-3 shrink-0" />
              Speed:{" "}
              {incident.speedDisplay?.trim() ||
                `${Math.round(incident.speedKmh!)} km/h`}
            </span>
          )}
        {incident.durationText && (
          <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700">
            <Clock className="h-3 w-3 text-red-600" />
            Duration: {incident.durationText}
          </span>
        )}
      </p>

      {/* Location — initial only (no → / End timestamp); show final only if initial is empty */}
      {(incident.locationInitial || incident.locationFinal) && (
        <p className="flex flex-wrap items-start gap-1 text-xs font-medium text-zinc-800">
          <span className="font-bold text-red-600">📍</span>
          {incident.locationInitial ? (
            incident.locationInitialUrl ? (
              <a
                href={incident.locationInitialUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-800 underline-offset-2 hover:text-blue-950 hover:underline"
              >
                {incident.locationInitial}
              </a>
            ) : (
              <span>{incident.locationInitial}</span>
            )
          ) : incident.locationFinalUrl ? (
            <a
              href={incident.locationFinalUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-800 underline-offset-2 hover:text-blue-950 hover:underline"
            >
              {incident.locationFinal}
            </a>
          ) : (
            <span>{incident.locationFinal}</span>
          )}
        </p>
      )}

      {/* Comment + actions */}
      {!resolved && (
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add comment… type @ to mention"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-500 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={sending || !comment.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {sending ? "Saving…" : "Comment"}
            </button>
            <button
              type="button"
              onClick={onResolve}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              ✓ Resolve
            </button>
          </div>
        </div>
      )}
      {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
    </article>
  );
}
