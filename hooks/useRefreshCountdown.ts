"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TICK_MS = 1000;

export function useRefreshCountdown(
  periodSec: number,
  onTick: () => void | Promise<void>,
) {
  const [remaining, setRemaining] = useState(periodSec);
  const [loading, setLoading] = useState(false);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const run = useCallback(async () => {
    setLoading(true);
    try {
      await onTickRef.current();
    } finally {
      setLoading(false);
      setRemaining(periodSec);
    }
  }, [periodSec]);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          void run();
          return periodSec;
        }
        return r - 1;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [periodSec, run]);

  return { remaining, loading, refresh: run };
}

export function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
