/** Where the brain's API lives. The env var wins; on a localhost page the local API is assumed
 *  (the session's health probe still decides live vs recorded); hosted without the env, there is none. */
export function apiBase(loc: { hostname: string } | null = typeof window !== "undefined" ? window.location : null): string | null {
  const v = process.env.NEXT_PUBLIC_PANTHEON_API?.trim();
  if (v) return v.replace(/\/+$/, "");
  if (loc && (loc.hostname === "localhost" || loc.hostname === "127.0.0.1")) return "http://localhost:8080";
  return null;
}
export const DEMO_KEY = process.env.NEXT_PUBLIC_DEMO_KEY || "dev";
