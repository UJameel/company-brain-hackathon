export function apiBase(): string | null {
  const v = process.env.NEXT_PUBLIC_PANTHEON_API?.trim();
  return v ? v.replace(/\/+$/, "") : null;
}
export const DEMO_KEY = process.env.NEXT_PUBLIC_DEMO_KEY ?? "";
