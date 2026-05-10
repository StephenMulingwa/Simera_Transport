"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DriverCardId } from "@/lib/simera/driverUi";

export type FleetRow = {
  vehicle: string;
  lastMessageTime: string | null;
  location: string | null;
  locationUrl: string | null;
  speed: string | null;
  driver: string | null;
  violationsCount: number;
  idling: string | null;
  maxSpeed: number | null;
};

export type FleetPayload = {
  generatedAt: string;
  kpis: {
    totalFleet: number;
    activeFleet: number;
    stationary: number;
    notUpdating: number;
  };
  table: FleetRow[];
};

export type Incident = {
  id: string;
  vehicle: string;
  violationLabel: string;
  violationRaw: string;
  filterCard: DriverCardId | "other";
  driverDisplayName: string;
  phone: string;
  violationTime: string | null;
  violationTimeIso: string | null;
  locationInitial: string | null;
  locationInitialUrl: string | null;
  locationFinal: string | null;
  locationFinalUrl: string | null;
};

export type DriverPayload = {
  generatedAt: string;
  counts: Record<string, number>;
  incidents: Incident[];
};

export type MapUnit = {
  id: number;
  name: string;
  registration: string;
  lat: number;
  lon: number;
  speedKmh: number | null;
};

export const REFRESH_PERIOD_SEC = 300;

/** Hydrate from sessionStorage cache written during login. Anything older
 *  than 5 minutes is discarded so we never show stale numbers as "live". */
const SESSION_TTL_MS = 5 * 60 * 1000;

function readCache<T>(key: string): { payload: T; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`simera:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; payload?: T };
    if (
      typeof parsed.at !== "number" ||
      Date.now() - parsed.at > SESSION_TTL_MS ||
      parsed.payload == null
    ) {
      window.sessionStorage.removeItem(`simera:${key}`);
      return null;
    }
    return { payload: parsed.payload, at: parsed.at };
  } catch {
    return null;
  }
}

type SimeraData = {
  fleet: FleetPayload | null;
  driver: DriverPayload | null;
  mapUnits: MapUnit[];
  fleetError: string | null;
  driverError: string | null;
  mapError: string | null;
  loading: boolean;
  firstLoadDone: boolean;
  lastUpdatedAt: number | null;
  remainingSec: number;
  refresh: () => Promise<void>;
};

const Ctx = createContext<SimeraData | null>(null);

export function SimeraDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cachedFleet = readCache<FleetPayload>("fleet");
  const cachedDriver = readCache<DriverPayload>("driver");
  const cachedMap = readCache<{ units: MapUnit[] }>("map");

  const [fleet, setFleet] = useState<FleetPayload | null>(
    cachedFleet?.payload ?? null,
  );
  const [driver, setDriver] = useState<DriverPayload | null>(
    cachedDriver?.payload ?? null,
  );
  const [mapUnits, setMapUnits] = useState<MapUnit[]>(
    cachedMap?.payload?.units ?? [],
  );
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasAnyCache = Boolean(cachedFleet || cachedDriver || cachedMap);
  const [firstLoadDone, setFirstLoadDone] = useState(hasAnyCache);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(
    hasAnyCache
      ? Math.max(
          cachedFleet?.at ?? 0,
          cachedDriver?.at ?? 0,
          cachedMap?.at ?? 0,
        )
      : null,
  );
  const initialRemaining = hasAnyCache
    ? Math.max(
        REFRESH_PERIOD_SEC -
          Math.floor(
            (Date.now() -
              Math.max(
                cachedFleet?.at ?? 0,
                cachedDriver?.at ?? 0,
                cachedMap?.at ?? 0,
              )) /
              1000,
          ),
        0,
      )
    : REFRESH_PERIOD_SEC;
  const [remainingSec, setRemainingSec] = useState(initialRemaining);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);

    const writeCache = (key: string, payload: unknown) => {
      try {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem(
          `simera:${key}`,
          JSON.stringify({ at: Date.now(), payload }),
        );
      } catch {
        /* ignore quota / privacy errors */
      }
    };

    const fleetTask = (async () => {
      try {
        const r = await fetch("/api/wialon/fleet", { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as FleetPayload;
          setFleet(j);
          setFleetError(null);
          writeCache("fleet", j);
        } else {
          const j = await r.json().catch(() => ({}) as Record<string, unknown>);
          setFleetError(
            typeof j === "object" && j && "error" in j
              ? String((j as { error: unknown }).error)
              : "Fleet data unavailable",
          );
        }
      } catch (e) {
        setFleetError(e instanceof Error ? e.message : "Fleet data unavailable");
      }
    })();

    const driverTask = (async () => {
      try {
        const r = await fetch("/api/wialon/driver", { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as DriverPayload;
          setDriver(j);
          setDriverError(null);
          writeCache("driver", j);
        } else {
          const j = await r.json().catch(() => ({}) as Record<string, unknown>);
          setDriverError(
            typeof j === "object" && j && "error" in j
              ? String((j as { error: unknown }).error)
              : "Driver data unavailable",
          );
        }
      } catch (e) {
        setDriverError(
          e instanceof Error ? e.message : "Driver data unavailable",
        );
      }
    })();

    const mapTask = (async () => {
      try {
        const r = await fetch("/api/wialon/map", { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { units: MapUnit[] };
          setMapUnits(j.units ?? []);
          setMapError(null);
          writeCache("map", j);
        } else {
          const j = await r.json().catch(() => ({}) as Record<string, unknown>);
          setMapUnits([]);
          setMapError(
            typeof j === "object" && j && "error" in j
              ? String((j as { error: unknown }).error)
              : "Map data unavailable",
          );
        }
      } catch (e) {
        setMapUnits([]);
        setMapError(e instanceof Error ? e.message : "Map data unavailable");
      }
    })();

    // Mark firstLoadDone as soon as ANY task finishes so the slowest
    // section (often Wialon reports) doesn't gate the others.
    void Promise.race([fleetTask, driverTask, mapTask]).then(() => {
      setFirstLoadDone(true);
      setLastUpdatedAt(Date.now());
    });

    try {
      await Promise.allSettled([fleetTask, driverTask, mapTask]);
    } finally {
      inflight.current = false;
      setLoading(false);
      setFirstLoadDone(true);
      setLastUpdatedAt(Date.now());
      setRemainingSec(REFRESH_PERIOD_SEC);
    }
  }, []);

  useEffect(() => {
    // Skip the initial fetch when sessionStorage already has fresh data
    // (e.g. just hydrated after login warmup). The 5-min interval below
    // will still trigger periodic refreshes.
    if (
      hasAnyCache &&
      lastUpdatedAt &&
      Date.now() - lastUpdatedAt < SESSION_TTL_MS
    ) {
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingSec((r) => {
        if (r <= 1) {
          void refresh();
          return REFRESH_PERIOD_SEC;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const value = useMemo<SimeraData>(
    () => ({
      fleet,
      driver,
      mapUnits,
      fleetError,
      driverError,
      mapError,
      loading,
      firstLoadDone,
      lastUpdatedAt,
      remainingSec,
      refresh,
    }),
    [
      fleet,
      driver,
      mapUnits,
      fleetError,
      driverError,
      mapError,
      loading,
      firstLoadDone,
      lastUpdatedAt,
      remainingSec,
      refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimeraData(): SimeraData {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useSimeraData must be used inside SimeraDataProvider");
  }
  return v;
}

export function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PHONE_DIGITS_RE = /\D+/g;

/** WhatsApp click-to-chat link from any E.164 phone */
export function whatsappHref(phone: string): string {
  const digits = phone.replace(PHONE_DIGITS_RE, "");
  return `https://api.whatsapp.com/send/?phone=${digits}&text&type=phone_number&app_absent=0`;
}
