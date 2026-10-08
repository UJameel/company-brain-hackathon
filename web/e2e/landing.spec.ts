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

test("the three layers are drawn as one figure with four steps", async ({ page }) => {
  await page.goto("/#layers");
  const steps = page.locator("#layers ol li");
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(3)).toContainText("Respan");
  const figure = page.getByRole("img", { name: /how the three layers connect/i });
  if (test.info().project.name === "desktop") await expect(figure).toBeVisible();
  else await expect(figure).toBeHidden();
});
