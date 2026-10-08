export function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
