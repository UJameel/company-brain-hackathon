import { describe, expect, it } from "vitest";
import { AGENTS } from "./agents";

describe("agents copy", () => {
  it("has seven agents in brain order with no dashes and the generic connector line", () => {
    expect(AGENTS.map((a) => a.god)).toEqual(["Hermes", "Cerberus", "Mnemosyne", "Athena", "Hephaestus", "Themis", "Morpheus"]);
    for (const a of AGENTS) for (const s of [a.inYou, a.inPantheon, a.layer]) expect(s).not.toMatch(/[–—]/);
    expect(AGENTS[2].inPantheon).toContain("400+ Scalekit connectors");
  });
});
