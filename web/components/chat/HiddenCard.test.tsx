import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = { mode: "live", refresh: async () => {}, granted: () => false, grantLocal: vi.fn() };
vi.mock("@/lib/session", () => ({ useSession: () => session }));
vi.mock("@/lib/api", () => ({ api: { grant: vi.fn() } }));

import { fireEvent } from "@testing-library/react";
import { HiddenCard } from "./HiddenCard";

describe("HiddenCard", () => {
  afterEach(() => { session.mode = "live"; cleanup(); });
  it("in recorded mode, Grant records a local grant and re-asks", () => {
    session.mode = "recorded";
    const onGranted = vi.fn();
    render(<HiddenCard user="bob" onGranted={onGranted} hidden={{ "alice-brain": { owner: "alice", extra: ["channel:leadership"] } }} />);
    fireEvent.click(screen.getByRole("button", { name: /grant as david/i }));
    expect(session.grantLocal).toHaveBeenCalledWith("alice", "bob");
    expect(onGranted).toHaveBeenCalled();
    session.mode = "live";
  });
  it("lists every hidden dataset and falls back to sources when extra is missing", () => {
    render(<HiddenCard user="bob" onGranted={() => {}} hidden={{
      "alice-brain": { owner: "alice", extra: ["channel:leadership", "source:github"] },
      "carol-brain": { owner: "carol", sources: ["source:notion"] },
    }} />);
    expect(screen.getByText("2 datasets you can't see")).toBeTruthy();
    expect(screen.getByText(/channel:leadership, source:github/)).toBeTruthy();
    expect(screen.getByText(/source:notion/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /grant as david/i })).toBeTruthy();
  });
});
