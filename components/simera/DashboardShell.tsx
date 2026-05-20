"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bus,
  ClipboardCheck,
  FileBarChart2,
  LogOut,
  Map as MapIcon,
  Radio,
  RefreshCw,
  Shield,
} from "lucide-react";
import {
  formatCountdown,
  useSimeraData,
} from "@/lib/contexts/SimeraDataContext";
import { formatEatWallDateTime, formatAppTimeOnly } from "@/lib/simera/appTime";

type TabId = "fleet" | "driver" | "evaluation" | "map" | "reports" | "admin";

type TabSpec = {
  id: TabId;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When true the tab only renders for admin users. */
  adminOnly?: boolean;
};

const TABS: TabSpec[] = [
  { id: "fleet", href: "/", label: "Fleet Monitor", icon: Bus },
  { id: "driver", href: "/driver", label: "Driver Monitoring", icon: Radio },
  {
    id: "evaluation",
    href: "/evaluation",
    label: "Vehicle Evaluation",
    icon: ClipboardCheck,
  },
  { id: "map", href: "/map", label: "Map View", icon: MapIcon },
  { id: "reports", href: "/reports", label: "Reports", icon: FileBarChart2 },
  { id: "admin", href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

type Me = { id: string; email: string; name: string; role: string };

function tabFromPath(pathname: string | null): TabId {
  if (!pathname) return "fleet";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname === "/driver") return "driver";
  if (pathname.startsWith("/evaluation")) return "evaluation";
  if (pathname === "/map") return "map";
  return "fleet";
}

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = tabFromPath(pathname);
  const [hover, setHover] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [clock, setClock] = useState("");

  const { remainingSec, loading, refresh, lastUpdatedAt, firstLoadDone } =
    useSimeraData();

  const loadMe = useCallback(async () => {
    const r = await fetch("/api/auth/me");
    if (r.ok) {
      const d = (await r.json()) as { user: Me | null };
      setMe(d.user);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    const tick = () => {
      setClock(formatEatWallDateTime(Date.now()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      sessionStorage.removeItem("simera:fleet");
      sessionStorage.removeItem("simera:driver");
      sessionStorage.removeItem("simera:map");
      sessionStorage.removeItem("simera2:fleet");
      sessionStorage.removeItem("simera2:driver");
      sessionStorage.removeItem("simera2:map");
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  };

  const sidebarWidth = hover ? "220px" : "76px";

  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-zinc-50 text-zinc-900">
      <header
        className="shrink-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-white shadow-md md:px-6"
        style={{
          background:
            "linear-gradient(90deg, #7a0d18 0%, #b50f1f 45%, #d51925 100%)",
          borderColor: "rgba(255,255,255,0.18)",
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-md bg-white/95 p-1.5 shadow-sm">
            <Image
              src="/SimeraLogo.png"
              alt="Simera Transport"
              width={120}
              height={36}
              className="h-9 w-auto object-contain"
              priority
            />
          </div>
          <div className="hidden h-9 w-px bg-white/30 sm:block" />
          <div className="hidden min-w-0 sm:block">
            <p className="text-base font-bold leading-tight tracking-tight">
              Simera <span className="text-yellow-300">Transport</span>
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/90">
              Control Tower · Live Operations
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="rounded-md border border-white/30 bg-white/15 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-white">
            EAT <span className="text-yellow-300">{clock}</span>
          </span>

          <span
            className="flex items-center gap-2 rounded-full border border-white/40 bg-emerald-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm"
            title={
              lastUpdatedAt
                ? `Updated ${formatAppTimeOnly(lastUpdatedAt)}`
                : "Live"
            }
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Live
          </span>

          <span className="hidden items-center gap-2 rounded-md border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white sm:inline-flex">
            <span className="text-white/90">Refresh in</span>
            <span className="font-mono text-yellow-300">
              {formatCountdown(remainingSec)}
            </span>
          </span>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || !firstLoadDone}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
            title="Refresh now"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">
              {loading ? "Updating…" : "Refresh"}
            </span>
          </button>

          {me && (
            <span className="hidden max-w-[140px] truncate rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs font-semibold text-white lg:inline">
              {me.name}
            </span>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1 rounded-md border border-white/40 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-yellow-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Body: sidebar fills remaining viewport height — does not scroll with main */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav
          aria-label="Main navigation"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="relative hidden h-full min-h-0 shrink-0 flex-col border-r border-red-900/30 py-3 text-white shadow-lg transition-all duration-300 md:flex"
          style={{
            width: sidebarWidth,
            background:
              "linear-gradient(180deg, #b50f1f 0%, #951421 50%, #7a0d18 100%)",
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-0 pb-2">
            {TABS.filter((t) => !t.adminOnly || me?.role === "admin").map(
              ({ id, href, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <Link
                    key={id}
                    href={href}
                    prefetch
                    className="mx-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition"
                    style={{
                      background: isActive
                        ? "rgba(255,255,255,0.18)"
                        : "transparent",
                      border: isActive
                        ? "1px solid rgba(253, 224, 71, 0.95)"
                        : "1px solid transparent",
                    }}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        isActive ? "text-yellow-300" : "text-white/95"
                      }`}
                    />
                    <span
                      className={`whitespace-nowrap text-sm font-bold transition-all duration-200 ${
                        isActive ? "text-yellow-300" : "text-white/95"
                      }`}
                      style={{
                        opacity: hover ? 1 : 0,
                        width: hover ? "auto" : 0,
                        overflow: "hidden",
                      }}
                    >
                      {label}
                    </span>
                  </Link>
                );
              },
            )}
          </div>

          <div className="mt-auto shrink-0 border-t border-white/30 px-3 pb-2 pt-3">
            <div className="flex items-center gap-2">
              <a
                href="https://www.controltech-ea.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-[11px] font-bold leading-tight text-white/95 hover:text-white"
                style={{
                  opacity: hover ? 1 : 0,
                  maxHeight: hover ? 40 : 0,
                  overflow: "hidden",
                }}
              >
                Powered by ControlTech
              </a>
              <Image
                src="/controltech_logo.png"
                alt="ControlTech"
                width={26}
                height={26}
                className="shrink-0 rounded"
              />
            </div>
          </div>
        </nav>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5 md:hidden">
            {TABS.filter((t) => !t.adminOnly || me?.role === "admin").map(
              ({ id, href, label, icon: Icon }) => (
                <Link
                  key={id}
                  href={href}
                  prefetch
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition ${
                    activeTab === id
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-zinc-800 hover:bg-red-50 hover:text-red-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ),
            )}
          </nav>

          <main className="simera-main-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-auto overscroll-y-contain px-3 py-4 md:px-6 md:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
