import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ apiBase: () => "http://api", DEMO_KEY: "k" }));
vi.mock("./api", () => ({ api: { health: vi.fn() } }));

import { api } from "./api";
import { SessionProvider, useSession } from "./session";

function Probe() { const s = useSession(); return <div>{s.mode}:{String(s.granted("bob"))}</div>; }

describe("session", () => {
  it("is live when health answers and reads grants", async () => {
    (api.health as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mode: "live", users: ["alice", "bob"], grants: [{ owner: "alice", grantee: "bob", dataset: "alice-brain", permission: "read" }] });
    await act(async () => { render(<SessionProvider><Probe /></SessionProvider>); });
    expect(screen.getByText("live:true")).toBeTruthy();
  });
  it("falls back to recorded when health fails", async () => {
    (api.health as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("down"));
    await act(async () => { render(<SessionProvider><Probe /></SessionProvider>); });
    expect(screen.getByText("recorded:false")).toBeTruthy();
  });
});
