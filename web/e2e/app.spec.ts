import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, who: "alice" | "bob") {
  await page.goto("/app");
  await page.locator(`#signin-${who}`).click();
  await expect(page.locator("#user-menu")).toBeVisible();
}

test("sign-in screen, then a recorded turn with plain-language steps", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByText("Sign in to Northwind Labs")).toBeVisible();
  await signIn(page, "alice");
  await page.getByRole("button", { name: "What will Pro cost after launch?" }).click();
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator("article").getByText("Understood as a question")).toBeVisible();
  await expect(page.locator("article").getByText(/Found \d+ passages? /)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("article").getByText("Details")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("article").getByText(/respan|gpt-4o|claude-sonnet/)).toHaveCount(0);
  await page.screenshot({ path: `e2e/out/app-${test.info().project.name}.png` });
});

test("sign out returns to the sign-in screen", async ({ page }) => {
  await signIn(page, "bob");
  await page.locator("#user-menu").click();
  await page.locator("#sign-out").click();
  await expect(page.getByText("Sign in to Northwind Labs")).toBeVisible();
});

test("the grant beat works in recorded mode", async ({ page }) => {
  await signIn(page, "bob");
  await page.getByRole("button", { name: "What will Pro cost after launch?" }).click();
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText(/dataset.* you can't see/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /grant as david/i }).click();
  await expect(page.locator("article")).toHaveCount(2, { timeout: 15_000 });
  await expect(page.locator("article").nth(1).getByText(/\$59/)).toBeVisible({ timeout: 15_000 });
});

test("an explicit request shows what Pantheon wants to do", async ({ page }) => {
  await signIn(page, "alice");
  await page.getByRole("button", { name: "Open an issue for the $59 price" }).click();
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText("Pantheon wants to")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Open a GitHub issue", { exact: true })).toBeVisible();
  await expect(page.getByText(/waiting for you/)).toBeVisible();
});

test("unknown question in recorded mode explains itself", async ({ page }) => {
  await signIn(page, "alice");
  await page.getByLabel("Ask the brain").fill("Who is on call tonight?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText(/No recorded answer/)).toBeVisible();
});

test("graph and connections pages work from the recording", async ({ page }) => {
  await signIn(page, "alice");
  await page.goto("/app/graph");
  await expect(page.getByText(/\d+ nodes · \d+ edges · recorded snapshot/)).toBeVisible({ timeout: 20_000 });
  await page.goto("/app/connections");
  await expect(page.locator("li").filter({ hasText: "github-connect" })).toBeVisible();
  await expect(page.getByRole("button", { name: /needs the live brain/ })).toBeDisabled();
});

test("quality page shows the three numbers and the brain status", async ({ page }) => {
  await signIn(page, "alice");
  await page.goto("/app/quality");
  await expect(page.getByText(/recorded replay/)).toBeVisible();
  await expect(page.getByText("coverage before the share")).toBeVisible();
});
