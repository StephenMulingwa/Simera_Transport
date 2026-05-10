"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  redirectTo: string;
};

type WarmKey = "fleet" | "driver" | "map";

const WARM_LABELS: Record<WarmKey, string> = {
  fleet: "Loading fleet snapshot",
  driver: "Loading driver incidents",
  map: "Loading live map positions",
};

const PREFETCH_ROUTES = [
  "/",
  "/driver",
  "/map",
  "/reports",
  "/reports/eco",
  "/reports/fuel",
  "/reports/engine",
  "/reports/latest",
  "/reports/summary",
];

export function LoginForm({ redirectTo }: Props) {
  const router = useRouter();
  const from =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [warming, setWarming] = useState<Record<WarmKey, "wait" | "ok" | "err">>({
    fleet: "wait",
    driver: "wait",
    map: "wait",
  });

  /** Hit the data endpoints in parallel and stash payloads in sessionStorage so
   *  the dashboard provider can hydrate instantly. Each task resolves on its
   *  own; we redirect after all three settle. */
  const warmupAndCache = async (): Promise<void> => {
    const tasks: Promise<unknown>[] = [];
    const cacheAt = Date.now();

    const make = (key: WarmKey, url: string) =>
      tasks.push(
        (async () => {
          try {
            const r = await fetch(url, { cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const payload = await r.json();
            try {
              sessionStorage.setItem(
                `simera:${key}`,
                JSON.stringify({ at: cacheAt, payload }),
              );
            } catch {
              /* sessionStorage may be disabled - ignore */
            }
            setWarming((s) => ({ ...s, [key]: "ok" }));
          } catch {
            setWarming((s) => ({ ...s, [key]: "err" }));
          }
        })(),
      );

    make("fleet", "/api/wialon/fleet");
    make("driver", "/api/wialon/driver");
    make("map", "/api/wialon/map");
    for (const href of PREFETCH_ROUTES) router.prefetch(href);
    await Promise.allSettled(tasks);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWarming({ fleet: "wait", driver: "wait", map: "wait" });
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Login failed");
      await warmupAndCache();
      router.replace(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.35fr_minmax(360px,520px)]">
      <HeroPanel />
      <FormPanel
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        error={error}
        loading={loading}
        warming={warming}
        onSubmit={submit}
      />
    </div>
  );
}

function HeroPanel() {
  return (
    <aside className="relative hidden overflow-hidden lg:block">
      <Image
        src="/Simera_Login.png"
        alt="Simera Transport fleet"
        fill
        priority
        className="simera-hero-img object-cover"
        sizes="(max-width: 1024px) 0vw, 60vw"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(122,13,24,0.78) 0%, rgba(181,15,31,0.62) 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <div className="simera-hero-overlay absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_55%)]" />
      <div className="simera-hero-sheen pointer-events-none absolute -inset-y-1/4 left-0 right-0 w-1/3 -skew-x-12 bg-gradient-to-r from-white/0 via-white/35 to-white/0" />

      <div className="relative z-10 flex h-full flex-col justify-end p-10 text-white">
        <div className="space-y-4 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Live operations
          </span>
          <h1 className="text-4xl font-extrabold leading-tight drop-shadow-lg sm:text-5xl">
            Monitor every vehicle with{" "}
            <span className="text-yellow-300">precision</span>.
          </h1>
          <p className="max-w-md text-base font-medium text-white/90">
            Real-time fleet visibility, driver-incident alerts, fuel
            intelligence and executive reporting all in one secure tower.
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {[
              "Fleet Monitor",
              "Driver Incidents",
              "Live Map",
              "Executive Reports",
            ].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/40 bg-white/10 px-3 py-1 backdrop-blur"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

      </div>
    </aside>
  );
}

function BrandBadge() {
  return (
    <div className="simera-hero-float mx-auto flex w-fit items-center gap-3 rounded-2xl border border-red-200 bg-white px-4 py-2.5 shadow-lg ring-1 ring-red-100">
      <Image
        src="/SimeraLogo.png"
        alt="Simera"
        width={72}
        height={72}
        className="h-12 w-auto object-contain"
        priority
      />
      <div className="min-w-0">
        <p className="text-lg font-extrabold leading-tight text-red-700 sm:text-xl">
          Simera Transport
        </p>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-700 sm:text-xs">
          Control Tower
        </p>
      </div>
    </div>
  );
}

function PoweredByControlTech() {
  return (
    <a
      href="https://www.controltech-ea.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="ControlTech East Africa"
      className="group mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-red-300 hover:text-red-700 hover:shadow-md"
    >
      <Image
        src="/controltech_logo.png"
        alt="ControlTech"
        width={28}
        height={28}
        className="h-6 w-auto rounded"
      />
      <span>
        Powered by{" "}
        <span className="font-bold text-red-700 group-hover:underline">
          ControlTech
        </span>
      </span>
    </a>
  );
}

function FormPanel({
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  warming,
  onSubmit,
}: {
  email: string;
  setEmail: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  error: string | null;
  loading: boolean;
  warming: Record<WarmKey, "wait" | "ok" | "err">;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandBadge />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-xl">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure sign-in
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-zinc-900">
              Welcome back
            </h2>
            <p className="mt-1 text-sm font-medium text-zinc-600">
              Sign in to access the Simera Transport Control Tower.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm font-semibold text-zinc-800">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-900 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:bg-zinc-50"
              />
            </label>
            <label className="block text-sm font-semibold text-zinc-800">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-900 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:bg-zinc-50"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-red-700 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {loading && (
              <ul className="mt-2 space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs font-semibold text-zinc-700">
                {(Object.keys(WARM_LABELS) as WarmKey[]).map((k) => {
                  const status = warming[k];
                  return (
                    <li key={k} className="flex items-center gap-2">
                      {status === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : status === "err" ? (
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-red-500" />
                      )}
                      <span className={status === "err" ? "text-red-700" : ""}>
                        {WARM_LABELS[k]}
                        {status === "err" ? " (skipped)" : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </form>
        </div>

        <PoweredByControlTech />

        <p className="mt-3 text-center text-[11px] font-medium text-zinc-500">
          © {new Date().getFullYear()} Simera Transport Ltd
        </p>
      </div>
    </section>
  );
}
