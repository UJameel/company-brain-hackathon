import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// jsdom has no IntersectionObserver; motion's whileInView needs one. Observe nothing: the initial state is enough here.
class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
Object.assign(globalThis, { IntersectionObserver: IO });

import { Flow } from "./Flow";

describe("Flow", () => {
  afterEach(cleanup);
  it("draws the three layers around Pantheon as one labelled figure", () => {
    render(<Flow />);
    const fig = screen.getByRole("img", { name: /how the three layers connect/i });
    for (const name of ["Scalekit", "Cognee", "Respan", "Pantheon"]) expect(within(fig).getAllByText(name).length).toBeGreaterThan(0);
  });
  it("tells the flow in four numbered steps that mention each layer", () => {
    render(<Flow />);
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    const text = steps.map((s) => s.textContent ?? "").join(" ");
    for (const name of ["Scalekit", "Cognee", "Respan"]) expect(text).toContain(name);
  });
});
