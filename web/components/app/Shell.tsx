"use client";
import { useSession } from "@/lib/session";
import { BrainPanel } from "./BrainPanel";
import { Rail } from "./Rail";
import { SignIn } from "./SignIn";
import { TopBar } from "./TopBar";

/* Signed-out visitors see the sign-in screen; everything under /app assumes a user. */
export function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  if (!user) return <SignIn />;
  return (
    <div className="flex h-dvh overflow-hidden">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
          <aside className="hidden w-[40%] max-w-[640px] border-l border-line lg:block"><BrainPanel /></aside>
        </div>
      </div>
    </div>
  );
}
