import { describe, expect, it, vi } from "vitest";
import { hasWebGL } from "./webgl";

describe("hasWebGL", () => {
  it("is false when getContext throws or returns null (jsdom)", () => {
    expect(hasWebGL()).toBe(false);
  });
  it("is true when a webgl context is available", () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    expect(hasWebGL()).toBe(true);
    spy.mockRestore();
  });
});
