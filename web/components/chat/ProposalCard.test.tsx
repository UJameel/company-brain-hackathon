import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = { mode: "recorded" };
vi.mock("@/lib/session", () => ({ useSession: () => session }));
vi.mock("@/lib/api", () => ({ api: { decide: vi.fn() } }));

import { ProposalCard } from "./ProposalCard";

const proposal = { id: "a1", user: "bob" as const, as_user: "bob@northwind.dev", tool: "slack_send_message", input: { channel: "#general", text: "hi" }, rationale: "r", origin: "suggested" as const, status: "proposed", parent: null, created_at: "" };

describe("ProposalCard", () => {
  afterEach(() => { cleanup(); session.mode = "recorded"; });
  it("shows the three decision boxes even without the live brain, disabled, with a reason", () => {
    render(<ProposalCard proposal={proposal} onChange={() => {}} />);
    const approve = screen.getByRole("button", { name: /approve and send it/i });
    expect(approve).toBeTruthy();
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /decline/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /revise/i })).toBeTruthy();
    expect(screen.getByText(/needs the live brain/i)).toBeTruthy();
  });
  it("enables the boxes when the brain is live", () => {
    session.mode = "live";
    render(<ProposalCard proposal={proposal} onChange={() => {}} />);
    expect((screen.getByRole("button", { name: /approve and send it/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
