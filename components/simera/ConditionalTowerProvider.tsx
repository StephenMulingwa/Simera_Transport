"use client";

import { usePathname } from "next/navigation";
import { SimeraDataProvider } from "@/lib/contexts/SimeraDataContext";

/** Skip global fleet/driver/map prefetch on auth pages only */
const NO_PROVIDER_PREFIXES = ["/login"];

export function ConditionalTowerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const skip =
    pathname &&
    NO_PROVIDER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (skip) return <>{children}</>;
  return <SimeraDataProvider>{children}</SimeraDataProvider>;
}
