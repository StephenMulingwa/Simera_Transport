"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";

/** First admin creation when database has zero users */
export default function BootstrapPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("Administrator");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Bootstrap failed");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image
            src="/SimeraLogo.png"
            alt="Simera Transport"
            width={180}
            height={52}
            className="h-12 w-auto object-contain"
            priority
          />
          <p className="text-center text-sm font-medium text-zinc-800">
            Create first administrator
          </p>
          <p className="text-center text-xs text-zinc-500">
            Requires matching{" "}
            <code className="rounded bg-zinc-100 px-1">SIMERA_BOOTSTRAP_EMAIL</code>{" "}
            and{" "}
            <code className="rounded bg-zinc-100 px-1">
              SIMERA_BOOTSTRAP_PASSWORD
            </code>{" "}
            in your server environment.
          </p>
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-700">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create admin & sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-red-700 underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
