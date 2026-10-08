import type { Turn } from "./chat";
import type { User } from "./types";

/* The conversation survives a page refresh: finished turns are kept per user in sessionStorage
   (per tab, like the sign-in). Unfinished turns are dropped; a refresh mid-stream simply loses that answer. */
const key = (user: User) => `pantheon.thread.${user}`;

export function saveThread(user: User, turns: Turn[]): void {
  try { window.sessionStorage.setItem(key(user), JSON.stringify(turns.filter((t) => t.done))); } catch { /* storage blocked */ }
}

export function loadThread(user: User): Turn[] {
  try {
    const raw = window.sessionStorage.getItem(key(user));
    const turns = raw ? (JSON.parse(raw) as Turn[]) : [];
    return Array.isArray(turns) ? turns.filter((t) => t && t.done) : [];
  } catch { return []; }
}
