"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, LogOut } from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logins, setLogins] = useState<
    {
      id: string;
      email: string;
      full_name: string;
      logged_in_at: string;
      ip: string | null;
    }[]
  >([]);
  const [comments, setComments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"observer" | "admin">("observer");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, l, c] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/logins"),
        fetch("/api/admin/comments"),
      ]);
      if (u.ok) {
        const d = (await u.json()) as { users: UserRow[] };
        setUsers(d.users);
      }
      if (l.ok) {
        const d = (await l.json()) as { events: typeof logins };
        setLogins(d.events);
      }
      if (c.ok) {
        const d = (await c.json()) as { comments: unknown[] };
        setComments(d.comments);
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
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, role }),
    });
    const j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setMsg(j.error ?? "Failed");
      return;
    }
    setEmail("");
    setPassword("");
    setFullName("");
    setMsg("User created.");
    void load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    void load();
  };

  const removeUser = async (id: string) => {
    if (!confirm("Delete this user permanently?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    void load();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const exportCommentsCsv = () => {
    const rows = comments as Record<string, string>[];
    if (!rows.length) return;
    const headers = Object.keys(rows[0]!);
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => esc(String(r[h] ?? ""))).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `simera_comments_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="border-b border-red-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/SimeraLogo.png"
              alt="Simera"
              width={120}
              height={36}
              className="h-8 w-auto"
            />
            <span className="font-semibold text-red-900">Administration</span>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              prefetch
              className="rounded-lg border-2 border-red-700 bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-red-700 hover:shadow-lg"
            >
              Control Tower
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Add user</h2>
          <form
            onSubmit={(e) => void createUser(e)}
            className="mt-4 grid gap-4 md:grid-cols-2"
          >
            <label className="text-sm font-semibold text-zinc-800">
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
              />
            </label>
            <label className="text-sm font-semibold text-zinc-800">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
              />
            </label>
            <label className="text-sm font-semibold text-zinc-800">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
              />
            </label>
            <label className="text-sm font-semibold text-zinc-800">
              Role
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "admin" | "observer")
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
              >
                <option value="observer">Observer</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Create user
              </button>
              {msg && (
                <p className="mt-2 text-sm font-medium text-zinc-800">{msg}</p>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Users</h2>
          {loading ? (
            <Loader2 className="mt-4 h-6 w-6 animate-spin text-red-600" />
          ) : (
            <div className="mt-4 max-h-96 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-semibold text-zinc-900">
                      Name
                    </th>
                    <th className="py-2 pr-4 font-semibold text-zinc-900">
                      Email
                    </th>
                    <th className="py-2 pr-4 font-semibold text-zinc-900">
                      Role
                    </th>
                    <th className="py-2 pr-4 font-semibold text-zinc-900">
                      Active
                    </th>
                    <th className="py-2 font-semibold text-zinc-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 font-medium text-zinc-900">
                        {u.full_name}
                      </td>
                      <td className="py-2 pr-4 font-medium text-zinc-800">
                        {u.email}
                      </td>
                      <td className="py-2 pr-4 font-medium text-zinc-800">
                        {u.role}
                      </td>
                      <td className="py-2 pr-4 font-medium text-zinc-800">
                        {u.active ? "Yes" : "No"}
                      </td>
                      <td className="flex flex-wrap gap-2 py-2">
                        <button
                          type="button"
                          className="text-xs text-red-700 underline"
                          onClick={() => void toggleActive(u.id, u.active)}
                        >
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-700 underline"
                          onClick={() => void removeUser(u.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Login history</h2>
          <div className="mt-4 max-h-80 overflow-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 font-semibold text-zinc-900">Time</th>
                  <th className="py-2 font-semibold text-zinc-900">User</th>
                  <th className="py-2 font-semibold text-zinc-900">IP</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-50">
                    <td className="py-1.5 whitespace-nowrap font-medium text-zinc-800">
                      {new Date(e.logged_in_at).toLocaleString()}
                    </td>
                    <td className="py-1.5 font-medium text-zinc-800">
                      {e.full_name} ({e.email})
                    </td>
                    <td className="py-1.5 font-medium text-zinc-800">
                      {e.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Incident comments ({comments.length})
            </h2>
            <button
              type="button"
              onClick={exportCommentsCsv}
              disabled={comments.length === 0}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download CSV
            </button>
          </div>
          <p className="mt-2 text-xs font-medium text-zinc-700">
            Full export includes author, driver, violation, vehicle, location,
            text, and timestamps.
          </p>
        </section>
      </main>
    </div>
  );
}
