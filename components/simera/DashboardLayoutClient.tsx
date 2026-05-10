"use client";

import { DashboardShell } from "./DashboardShell";

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-dvh w-full">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
