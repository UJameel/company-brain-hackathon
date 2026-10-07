import { describe, expect, it, vi } from "vitest";

describe("env", () => {
  it("returns null API_BASE when unset and strips a trailing slash when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_PANTHEON_API", "");
    let mod = await import("./env");
    expect(mod.apiBase()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_PANTHEON_API", "https://pantheon-api.fly.dev/");
    mod = await import("./env");
    expect(mod.apiBase()).toBe("https://pantheon-api.fly.dev");
  });
});
