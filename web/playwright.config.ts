import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e", timeout: 30_000,
  use: { baseURL: "http://localhost:3000", screenshot: "only-on-failure" },
  webServer: { command: "pnpm exec next dev --port 3000", url: "http://localhost:3000", reuseExistingServer: true, env: { NEXT_PUBLIC_PANTHEON_API: "" } },
  projects: [{ name: "desktop", use: { viewport: { width: 1440, height: 900 } } }, { name: "phone", use: { viewport: { width: 390, height: 844 } } }],
});
