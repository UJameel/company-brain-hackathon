import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ useSession: () => ({ mode: "live", refresh: async () => {}, granted: () => false }) }));
vi.mock("@/lib/api", () => ({ api: { grant: vi.fn() } }));

import { HiddenCard } from "./HiddenCard";

describe("HiddenCard", () => {
  it("lists every hidden dataset and falls back to sources when extra is missing", () => {
    render(<HiddenCard user="bob" onGranted={() => {}} hidden={{
      "alice-brain": { owner: "alice", extra: ["channel:leadership", "source:github"] },
      "carol-brain": { owner: "carol", sources: ["source:notion"] },
    }} />);
    expect(screen.getByText("2 datasets you can't see")).toBeTruthy();
    expect(screen.getByText(/channel:leadership, source:github/)).toBeTruthy();
    expect(screen.getByText(/source:notion/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /grant as alice/i })).toBeTruthy();
  });
});
