"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus, Users as UsersIcon } from "lucide-react";
import { userIsNonDeletableSuperAdmin } from "@/lib/auth/superAdmin";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "observer";
  active: boolean;
  is_super_admin?: boolean;
};

export function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"observer" | "admin">("observer");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [tableMsg, setTableMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setTableMsg(null);
    try {
      const r = await fetch("/api/admin/users");
      if (r.ok) {
        const d = (await r.json()) as { users: UserRow[] };
        setUsers(d.users);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setMsg({ kind: "err", text: j.error ?? "Failed to create user" });
        return;
      }
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("observer");
      setMsg({ kind: "ok", text: "User created." });
      void load();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    if (u.active && userIsNonDeletableSuperAdmin(u)) return;
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      setTableMsg({
        kind: "err",
        text: j.error ?? "Could not update user status",
      });
      return;
    }
    setTableMsg(null);
    void load();
  };

  const removeUser = async (u: UserRow) => {
    if (userIsNonDeletableSuperAdmin(u)) return;
    if (!confirm(`Delete ${u.email} permanently?`)) return;
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      setTableMsg({
        kind: "err",
        text: j.error ?? "Could not delete user",
      });
      return;
    }
    setTableMsg(null);
    void load();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <UserPlus className="h-5 w-5 text-red-600" />
            Add user
          </h2>
        </header>
        <form
          onSubmit={(e) => void createUser(e)}
          className="grid gap-3 md:grid-cols-2"
        >
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Password (≥ 8 characters)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Role
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "admin" | "observer")
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-zinc-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              <option value="observer">Observer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="flex items-center gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create user
            </button>
            {msg && (
              <p
                className={`text-xs font-semibold ${
                  msg.kind === "ok" ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {msg.text}
              </p>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <header className="flex flex-col gap-2 border-b border-zinc-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <UsersIcon className="h-5 w-5 text-red-600" />
            Users ({users.length})
          </h2>
          {tableMsg && (
            <p
              className={`text-xs font-semibold sm:text-right ${
                tableMsg.kind === "ok" ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {tableMsg.text}
            </p>
          )}
        </header>
        {loading ? (
          <div className="flex items-center justify-center px-5 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-red-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Role
                  </th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-zinc-100 hover:bg-red-50/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-zinc-900">
                      {u.full_name || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-zinc-800">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            u.role === "admin"
                              ? "bg-red-100 text-red-800"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {u.role}
                        </span>
                        {userIsNonDeletableSuperAdmin(u) ? (
                          <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                            Super admin
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          u.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        {userIsNonDeletableSuperAdmin(u) ? (
                          <span className="text-[11px] font-medium text-zinc-500">
                            Protected
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => void toggleActive(u)}
                              className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-bold text-zinc-800 hover:bg-zinc-50"
                            >
                              {u.active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeUser(u)}
                              className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-zinc-500"
                    >
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
