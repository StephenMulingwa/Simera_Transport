"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Clock,
  Droplets,
  Gauge,
  MapPin,
} from "lucide-react";

type ReportKind = "fuel" | "eco" | "engine" | "latest" | "summary";

const KINDS: {
  id: ReportKind;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
}[] = [
  {
    id: "fuel",
    label: "Fuel",
    desc: "Fuel fillings and drains over a chosen period",
    icon: Droplets,
    gradient: "from-blue-50 to-blue-100",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    id: "eco",
    label: "Eco Driving",
    desc: "Detailized driver behavior incidents (violations)",
    icon: Gauge,
    gradient: "from-purple-50 to-purple-100",
    iconBg: "bg-purple-100 text-purple-700",
  },
  {
    id: "engine",
    label: "Engine Hours",
    desc: "Engine hours, idling time and per-vehicle uptime",
    icon: Clock,
    gradient: "from-amber-50 to-amber-100",
    iconBg: "bg-amber-100 text-amber-700",
  },
  {
    id: "latest",
    label: "Unit Latest Data",
    desc: "Latest known position, speed and message of every unit",
    icon: MapPin,
    gradient: "from-emerald-50 to-emerald-100",
    iconBg: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "summary",
    label: "Summary",
    desc: "Trip summary statistics aggregated per vehicle",
    icon: ClipboardList,
    gradient: "from-rose-50 to-rose-100",
    iconBg: "bg-rose-100 text-rose-700",
  },
];

export function ReportsPanel() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900">
          <Activity className="h-6 w-6 text-red-600" />
          Reports
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Pick a report below to open its dedicated builder. You can choose a
          time window, filter by vehicles, and download as Excel or PDF.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KINDS.map(({ id, label, desc, icon: Icon, gradient, iconBg }) => (
          <Link
            key={id}
            href={`/reports/${id}`}
            prefetch
            className={`group relative overflow-hidden rounded-xl border border-zinc-200 bg-gradient-to-br ${gradient} p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-lg font-bold text-zinc-900">{label}</h3>
                <p className="mt-1 text-sm text-zinc-600">{desc}</p>
              </div>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-red-700 group-hover:gap-2">
              Open report
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
