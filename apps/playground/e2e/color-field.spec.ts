import { expect, test, type Page } from "@playwright/test";
import { expectInViewport, log, nextFrame, noTransitions, openHarness } from "./helpers";

const trigger = (page: Page) => page.getByRole("button", { name: /^Fill:/ });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Fill" });
const focusInDialog = (page: Page) =>
  page.evaluate(() => Boolean(document.activeElement?.closest("[data-colorshot-popover]")));

async function open(page: Page) {
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
  await nextFrame(page);
}

test.describe("ColorField", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
    await noTransitions(page);
  });

  test("opens on click and moves focus inside; Escape closes and returns focus to the trigger", async ({ page }) => {
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
    await open(page);
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "true");
    await expect(trigger(page)).toHaveAttribute("aria-controls", (await dialog(page).getAttribute("id"))!);
    expect(await focusInDialog(page)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
    await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape inside the format menu closes only the menu", async ({ page }) => {
    await open(page);
    await dialog(page).getByRole("combobox", { name: "Color format" }).click();
    await expect(dialog(page).getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page).getByRole("listbox")).toHaveCount(0);
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("outside click closes; ArrowDown on the trigger opens", async ({ page }) => {
    await open(page);
    await page.mouse.click(1200, 880);
    await expect(dialog(page)).toHaveCount(0);
    await trigger(page).focus();
    await page.keyboard.press("ArrowDown");
    await expect(dialog(page)).toBeVisible();
  });

  test("tabbing out of the picker closes it", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Shift+Tab");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("edits flow to the trigger", async ({ page }) => {
    await open(page);
    const hex = dialog(page).getByLabel("Hex color");
    await hex.fill("ff8800");
    await hex.press("Enter");
    await expect(trigger(page)).toHaveAccessibleName("Fill: #FF8800");
    expect((await log(page, "field")).value).toBe("#ff8800");
    await dialog(page).getByRole("radio", { name: "Linear" }).click();
    await expect(trigger(page)).toHaveAccessibleName("Fill: Linear gradient");
  });

  test("opens below a trigger at the top and keeps that side after switching to a gradient", async ({ page }) => {
    await open(page);
    const pop = dialog(page);
    await expect(pop).toHaveAttribute("data-side", "bottom");
    const t = (await trigger(page).boundingBox())!;
    const before = await expectInViewport(page, pop);
    expect(before.y).toBeGreaterThanOrEqual(t.y + t.height);
    await pop.getByRole("radio", { name: "Linear" }).click();
    await expect.poll(async () => (await pop.boundingBox())!.height).toBeGreaterThan(before.height);
    await nextFrame(page);
    await expect(pop).toHaveAttribute("data-side", "bottom");
    await expectInViewport(page, pop);
  });
});

test.describe("ColorField near the bottom edge", () => {
  test("flips above a trigger at the bottom, stays on screen, and does not flip back as a gradient", async ({ page }) => {
    await openHarness(page, { field: "bottom" });
    await noTransitions(page);
    await open(page);
    const pop = dialog(page);
    await expect(pop).toHaveAttribute("data-side", "top");
    const before = await expectInViewport(page, pop);
    const t = (await trigger(page).boundingBox())!;
    expect(before.y + before.height).toBeLessThanOrEqual(t.y);

    await pop.getByRole("radio", { name: "Linear" }).click();
    await expect.poll(async () => (await pop.boundingBox())!.height).toBeGreaterThan(before.height);
    await nextFrame(page);
    const sideAfter = await pop.getAttribute("data-side");
    console.log(`bottom trigger: side before=top after=${sideAfter}`);
    expect(sideAfter).toBe("top");
    const after = await expectInViewport(page, pop);
    // still above the trigger: it grew upwards
    expect(after.y + after.height).toBeLessThanOrEqual(t.y);
  });

  test("when a solid picker fits below but the gradient does not, it shifts up instead of flipping", async ({ page }) => {
    // measure the solid popover first
    await openHarness(page);
    await noTransitions(page);
    await open(page);
    const solidHeight = (await dialog(page).boundingBox())!.height;
    const triggerHeight = (await trigger(page).boundingBox())!.height;
    const vh = page.viewportSize()!.height;
    // room below = vh - trigger.bottom - offset(6) - margin(8); leave 10px spare for the solid picker
    const top = Math.floor(vh - 14 - solidHeight - 10 - triggerHeight);

    await openHarness(page, { fieldTop: String(top) });
    await noTransitions(page);
    await open(page);
    const pop = dialog(page);
    await expect(pop).toHaveAttribute("data-side", "bottom");
    const before = await expectInViewport(page, pop);
    await pop.getByRole("radio", { name: "Linear" }).click();
    await expect.poll(async () => (await pop.boundingBox())!.height).toBeGreaterThan(before.height + 10);
    await nextFrame(page);
    const sideAfter = await pop.getAttribute("data-side");
    console.log(`fieldTop=${top}: solid h=${solidHeight}, gradient h=${(await pop.boundingBox())!.height}, side before=bottom after=${sideAfter}`);
    expect(sideAfter).toBe("bottom");
    await expectInViewport(page, pop);
  });
});
