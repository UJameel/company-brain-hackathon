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
  it("local grants count as granted in recorded mode and revoke clears them", async () => {
    (api.health as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("down"));
    function Toggle() { const s = useSession(); return <><div>{String(s.granted("bob"))}</div><button onClick={() => s.grantLocal("alice", "bob")}>g</button><button onClick={() => s.revokeLocal("alice", "bob")}>r</button></>; }
    await act(async () => { render(<SessionProvider><Toggle /></SessionProvider>); });
    expect(screen.getByText("false")).toBeTruthy();
    await act(async () => { screen.getByText("g").click(); });
    expect(screen.getByText("true")).toBeTruthy();
    await act(async () => { screen.getByText("r").click(); });
    expect(screen.getByText("false")).toBeTruthy();
  });
  it("falls back to recorded when health fails", async () => {
    (api.health as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("down"));
    await act(async () => { render(<SessionProvider><Probe /></SessionProvider>); });
    expect(screen.getByText("recorded:false")).toBeTruthy();
  });
});
