import { describe, expect, it } from "vitest";
import { PEOPLE, displayText, toBackend } from "./names";

describe("names", () => {
  it("shows David and Goliath for the alice and bob keys", () => {
    expect(PEOPLE.alice.name).toBe("David");
    expect(PEOPLE.bob.name).toBe("Goliath");
  });
  it("rewrites names and dataset names in text the brain produced", () => {
    expect(displayText("Alice told you to keep $49. There is information in alice-brain you do not have access to; ask alice for access.")).toBe(
      "David told you to keep $49. There is information in David's brain you do not have access to; ask David for access.");
    expect(displayText("Hi Bob, could you update the page? bob-brain")).toBe("Hi Goliath, could you update the page? Goliath's brain");
    expect(displayText("bob@northwind.dev")).toBe("bob@northwind.dev");
    expect(displayText("Bobby and Alicia stay")).toBe("Bobby and Alicia stay");
  });
  it("translates what the person types back to the brain's names", () => {
    expect(toBackend("Open an issue asking Goliath; David owns it")).toBe("Open an issue asking Bob; Alice owns it");
  });
});
