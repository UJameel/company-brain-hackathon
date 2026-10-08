export type Part = { text: string; hit: boolean };

/** Athena sometimes answers with markdown bold; the UI shows plain text and highlights facts itself. */
export function stripBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
}

export function highlight(text: string, terms: string[]): Part[] {
  const clean = terms.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!clean.length || !text) return [{ text, hit: false }];
  const re = new RegExp(clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}
