import { Rail } from "@/components/app/Rail";
import { TopBar } from "@/components/app/TopBar";
import { BrainPanel } from "@/components/app/BrainPanel";
import { SessionProvider } from "@/lib/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
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
    </SessionProvider>
  );
}
