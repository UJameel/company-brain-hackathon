import { describe, expect, it } from "vitest";
import { highlight, stripBold } from "./highlight";

describe("stripBold", () => {
  it("removes markdown bold markers and leaves the words", () => {
    expect(stripBold("Pro will cost **$59 per month** after launch.")).toBe("Pro will cost $59 per month after launch.");
    expect(stripBold("no markers")).toBe("no markers");
  });
});

describe("highlight", () => {
  it("marks terms case-insensitively without overlaps", () => {
    const parts = highlight("Pro moves to $59 on October 21. Priya owns it.", ["$59", "october 21", "Priya"]);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["$59", "October 21", "Priya"]);
    expect(parts.map((p) => p.text).join("")).toBe("Pro moves to $59 on October 21. Priya owns it.");
  });
  it("returns the whole text unmarked when there are no terms", () => {
    expect(highlight("hello", [])).toEqual([{ text: "hello", hit: false }]);
  });
});
