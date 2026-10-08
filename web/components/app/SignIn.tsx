"use client";
import { Logo } from "@/components/Logo";
import { PEOPLE } from "@/lib/names";
import { useSession } from "@/lib/session";
import { USERS, type User } from "@/lib/types";

export { PEOPLE };

export function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full border border-line-2 bg-bg-3 font-serif font-semibold text-fg" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden>
      {PEOPLE[user].name[0]}
    </span>
  );
}

export function SignIn() {
  const s = useSession();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Logo size={30} />
        <h1 className="mt-10 text-4xl">Sign in to Northwind Labs</h1>
        <p className="mt-3 text-sm text-fg-2">Your brain only holds what your own accounts can read.</p>
        <ul className="mt-8 grid gap-2">
          {USERS.map((u) => (
            <li key={u}>
              <button id={`signin-${u}`} onClick={() => s.signIn(u)} className="flex w-full items-center gap-4 border border-line-2 bg-bg-2 px-4 py-3 text-left hover:border-accent">
                <Avatar user={u} size={40} />
                <span className="flex-1">
                  <span className="block font-serif text-xl font-semibold">{PEOPLE[u].name}</span>
                  <span className="block font-mono text-[11px] text-muted">{PEOPLE[u].role} · {PEOPLE[u].sources.join(", ")}</span>
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">Continue</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
