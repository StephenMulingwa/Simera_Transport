"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "simera.resolvedIncidents.v1";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.map(String));
    return new Set();
  } catch {
    return new Set();
  }
}

function writeSet(s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useResolvedIncidents() {
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setResolved(readSet());
  }, []);

  const markResolved = useCallback((id: string) => {
    setResolved((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeSet(next);
      return next;
    });
  }, []);

  const isResolved = useCallback(
    (id: string) => resolved.has(id),
    [resolved],
  );

  return { isResolved, markResolved, resolved };
}
