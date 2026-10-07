import { expect, test } from "@playwright/test";

test("recorded mode streams a turn with the step rail", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByText("recorded")).toBeVisible();
  await page.getByRole("button", { name: "Pro plan price" }).click();
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator("article").getByText("Hermes")).toBeVisible();
  await expect(page.locator("article").getByText(/\d+\.\d s/)).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `e2e/out/app-${test.info().project.name}.png` });
});

test("compare renders two answers side by side", async ({ page }) => {
  await page.goto("/app");
  await page.getByLabel("Compare both").check();
  await page.getByRole("button", { name: "Pro plan price" }).click();
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator("article")).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByText(/dataset.* you can't see/)).toBeVisible();
});

test("unknown question in recorded mode explains itself", async ({ page }) => {
  await page.goto("/app");
  await page.getByLabel("Ask the brain").fill("Who is on call tonight?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText(/No recorded answer/)).toBeVisible();
});
