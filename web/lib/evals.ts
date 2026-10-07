import type { Results } from "./types";

export type PairedRow = { id: string; as_user: string; question: string; before: number | null; after: number | null; missing: string[]; leaks: string[] };

export function pairRows(before: Results | null, after: Results | null): PairedRow[] {
  const ids = [...new Set([...(before?.rows ?? []).map((r) => r.id), ...(after?.rows ?? []).map((r) => r.id)])];
  const b = new Map((before?.rows ?? []).map((r) => [r.id, r])); const a = new Map((after?.rows ?? []).map((r) => [r.id, r]));
  return ids.map((id) => {
    const br = b.get(id), ar = a.get(id); const src = (ar ?? br)!;
    return { id, as_user: src.as_user, question: src.question, before: br?.score.final ?? null, after: ar?.score.final ?? null,
      missing: ar?.score.missing ?? br?.score.missing ?? [], leaks: ar?.score.leaks ?? br?.score.leaks ?? [] };
  });
}
