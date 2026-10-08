import { defineConfig } from "@playwright/test";
// E2E_BASE_URL lets the suite run against a recorded-mode server on another port while
// the main dev server stays in live mode for the demo.
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const port = new URL(base).port || "3000";
export default defineConfig({
  testDir: "e2e", timeout: 30_000, retries: 1,  // the dev server compiles routes on first hit; one retry absorbs that
  use: { baseURL: base, screenshot: "only-on-failure" },
  webServer: { command: `pnpm exec next dev --port ${port}`, url: base, reuseExistingServer: true, env: { NEXT_PUBLIC_PANTHEON_API: "" } },
  projects: [{ name: "desktop", use: { viewport: { width: 1440, height: 900 } } }, { name: "phone", use: { viewport: { width: 390, height: 844 } } }],
});
