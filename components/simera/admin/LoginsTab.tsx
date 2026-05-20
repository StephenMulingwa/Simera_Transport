"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ScrollText,
} from "lucide-react";
import { formatAppDateTime } from "@/lib/simera/appTime";

type LoginEvent = {
  id: string;
  email: string;
  full_name: string;
  logged_in_at: string;
  ip: string | null;
  user_agent: string | null;
};

const PAGE_SIZE = 10;

export function LoginsTab() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(qInput.trim()), 400);
    return () => window.clearTimeout(id);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set("q", search);
      const r = await fetch(`/api/admin/logins?${params}`, {
        cache: "no-store",
      });
      if (r.ok) {
        const d = (await r.json()) as {
          events: LoginEvent[];
          total: number;
          page: number;
          totalPages: number;
        };
        setEvents(d.events);
        setTotal(d.total);
        setTotalPages(Math.max(1, d.totalPages));
        if (d.page !== page) setPage(d.page);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const range = useMemo(() => {
    if (total === 0) return { from: 0, to: 0 };
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    return { from, to };
  }, [page, total]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-5 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
          <ScrollText className="h-5 w-5 text-red-600" />
          Login history
          {!loading && total > 0 && (
            <span className="font-mono text-sm font-semibold text-zinc-500">
              ({total.toLocaleString()} total)
            </span>
          )}
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search name, email, IP…"
              className="w-64 rounded-md border border-zinc-300 bg-white pl-7 pr-2 py-1.5 text-xs font-medium text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center px-5 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-red-600" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  <th className="w-10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    #
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Time (EAT)
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    User
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    IP
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Device
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr
                    key={e.id}
                    className="border-t border-zinc-100 hover:bg-red-50/30"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-center font-mono text-xs font-bold text-zinc-600">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-medium text-zinc-800">
                      {formatAppDateTime(e.logged_in_at)}
                    </td>
                    <td className="px-4 py-2 font-semibold text-zinc-900">
                      {e.full_name || "—"}
                    </td>
                    <td className="px-4 py-2 font-medium text-zinc-800">
                      {e.email}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-700">
                      {e.ip ?? "—"}
                    </td>
                    <td
                      className="max-w-[420px] truncate px-4 py-2 text-xs text-zinc-600"
                      title={e.user_agent ?? ""}
                    >
                      {e.user_agent ?? "—"}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-zinc-500"
                    >
                      {total === 0 && !search
                        ? "No login events recorded yet."
                        : "No events match this search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
            <p className="text-xs font-medium text-zinc-600">
              {total === 0
                ? "—"
                : `Showing ${range.from.toLocaleString()}–${range.to.toLocaleString()} of ${total.toLocaleString()}`}
              {total > 0 && (
                <span className="ml-2 text-zinc-500">
                  Page {page} of {totalPages}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canPrev || loading}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!canNext || loading}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
