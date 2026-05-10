import { neon } from "@neondatabase/serverless";

/** Neon serverless — use in Route Handlers / Server Actions only */
export function getSql() {
  const url =
    process.env.simera_neon_token ??
    process.env.SIMERA_NEON_TOKEN ??
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing database URL: set simera_neon_token (or SIMERA_NEON_TOKEN / DATABASE_URL)",
    );
  }
  return neon(url);
}
