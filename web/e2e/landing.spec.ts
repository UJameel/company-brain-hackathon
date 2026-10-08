import { expect, test } from "@playwright/test";

test("hero fits and the page never scrolls sideways", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open the app" }).first()).toBeInViewport();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: `e2e/out/landing-${test.info().project.name}.png`, fullPage: false });
});

test("scrolling the pantheon lights each agent label", async ({ page }) => {
  await page.goto("/#pantheon");
  const agents: [string, string][] = [["thalamus", "Hermes"], ["amygdala", "Cerberus"], ["hippocampus", "Mnemosyne"], ["prefrontal", "Athena"], ["motor", "Hephaestus"], ["orbitofrontal", "Themis"], ["sleep", "Morpheus"]];
  for (const [region, god] of agents) {
    await page.locator(`[data-region="${region}"]`).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(page.locator(".insc").filter({ hasText: god }).first()).toBeVisible();
  }
});
