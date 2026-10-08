import { describe, expect, it, vi } from "vitest";

describe("env", () => {
  it("defaults to the local API when unset and the page is served from localhost", async () => {
    vi.stubEnv("NEXT_PUBLIC_PANTHEON_API", "");
    const mod = await import("./env");
    expect(mod.apiBase({ hostname: "localhost" })).toBe("http://localhost:8080");
    expect(mod.apiBase({ hostname: "company-brain-hackathon.vercel.app" })).toBeNull();
  });
  it("returns null API_BASE when unset and strips a trailing slash when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_PANTHEON_API", "");
    let mod = await import("./env");
    expect(mod.apiBase({ hostname: "example.com" })).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_PANTHEON_API", "https://pantheon-api.fly.dev/");
    mod = await import("./env");
    expect(mod.apiBase()).toBe("https://pantheon-api.fly.dev");
  });
});
