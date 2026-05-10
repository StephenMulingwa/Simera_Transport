import { notFound } from "next/navigation";
import { ReportBuilder } from "@/components/simera/reports/ReportBuilder";

const META = {
  fuel: {
    title: "Fuel",
    subtitle: "Fillings & drains over the chosen period",
  },
  eco: {
    title: "Eco Driving",
    subtitle: "Detailized driver behaviour incidents (violations)",
  },
  engine: {
    title: "Engine Hours",
    subtitle: "Engine running, idling and uptime per vehicle",
  },
  latest: {
    title: "Unit Latest Data",
    subtitle: "Latest known position, speed and message of every unit",
  },
  summary: {
    title: "Summary",
    subtitle: "Trip summary statistics aggregated per vehicle",
  },
} as const;

const ALLOWED = Object.keys(META) as (keyof typeof META)[];

// Pre-render all five report-kind shells at build time so Link prefetch can
// hand the user a fully cached page instantly when they click a card.
export function generateStaticParams() {
  return ALLOWED.map((kind) => ({ kind }));
}

export const dynamicParams = false;

export default async function ReportKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!ALLOWED.includes(kind as keyof typeof META)) {
    notFound();
  }
  const k = kind as keyof typeof META;
  const meta = META[k];

  return (
    <ReportBuilder
      kind={k}
      title={meta.title}
      subtitle={meta.subtitle}
      defaultFromHoursAgo={24}
    />
  );
}
