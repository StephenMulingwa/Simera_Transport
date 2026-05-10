"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatCountdown, useSimeraData } from "@/lib/contexts/SimeraDataContext";

function FitBounds({ units }: { units: { lat: number; lon: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (!units.length) return;
    const b = L.latLngBounds(units.map((u) => [u.lat, u.lon]));
    map.fitBounds(b.pad(0.15));
  }, [map, units]);
  return null;
}

export default function MapInner() {
  const { mapUnits: units, mapError, remainingSec, loading, refresh } =
    useSimeraData();

  const center = useMemo(() => {
    if (!units.length) return [-1.286389, 36.817223] as [number, number];
    const lat = units.reduce((s, u) => s + u.lat, 0) / units.length;
    const lon = units.reduce((s, u) => s + u.lon, 0) / units.length;
    return [lat, lon] as [number, number];
  }, [units]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-800">
          Live asset positions (refreshes with the Control Tower schedule).
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-red-200 bg-white px-3 py-1 font-mono text-sm font-semibold text-red-800">
            {formatCountdown(remainingSec)}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>
      {mapError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
          {mapError}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm">
        <MapContainer
          center={center}
          zoom={units.length ? 8 : 6}
          className="z-0 h-[600px] w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds units={units} />
          {units.map((u) => (
            <CircleMarker
              key={u.id}
              center={[u.lat, u.lon]}
              radius={9}
              pathOptions={{
                color: "#991b1b",
                weight: 2,
                fillColor: "#dc2626",
                fillOpacity: 0.92,
              }}
            >
              <Popup>
                <strong className="text-zinc-900">{u.registration}</strong>
                <br />
                <span className="text-zinc-800">
                  {u.speedKmh != null ? `${u.speedKmh} km/h` : "—"}
                </span>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
