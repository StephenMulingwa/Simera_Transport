"use client";

import dynamic from "next/dynamic";

const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500">
      Loading map…
    </div>
  ),
});

export function MapView() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-red-800 md:text-2xl">
          Map View
        </h1>
        <p className="mt-1 text-sm font-medium text-zinc-700">
          Vehicle positions as dots on the map; tap a dot for registration and
          speed. Pan and zoom as needed.
        </p>
      </div>
      <MapInner />
    </div>
  );
}
