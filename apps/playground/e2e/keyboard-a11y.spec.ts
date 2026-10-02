import { expect, test, type Page } from "@playwright/test";
import { log, nextFrame, noTransitions, openHarness, part, picker } from "./helpers";

// Keyboard, screen reader and forced-colors behavior from the accessibility audit.

const RGB = "linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)";
const full = (page: Page) => picker(page, "full");
const stops = (page: Page) => part(full(page), "stop");
const focusedStopNow = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.closest("[data-part='stop']")?.getAttribute("aria-valuenow") ?? null);

test.describe("gradient stops from the keyboard", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page, { value: RGB });
    await noTransitions(page);
    await expect(stops(page)).toHaveCount(3);
  });

  test("every stop is in the tab order and named by its place", async ({ page }) => {
    await expect(full(page).locator('[data-part="stop"][tabindex="0"]')).toHaveCount(3);
    await expect(stops(page).nth(1)).toHaveAccessibleName("Color stop 2 of 3");
    await stops(page).first().focus();
    await page.keyboard.press("Tab");
    await expect(stops(page).nth(1)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(stops(page).nth(2)).toBeFocused();
    // focusing a stop selects it, so the color controls edit that stop
    await expect(stops(page).nth(2)).toHaveAttribute("data-state", "selected");
  });

  test("Enter adds a stop halfway to the next one and focuses it; + and the menu add one too", async ({ page }) => {
    await stops(page).first().focus();
    await page.keyboard.press("Enter");
    await expect(stops(page)).toHaveCount(4);
    await expect.poll(() => focusedStopNow(page)).toBe("25");
    expect((await log(page, "full")).completes).toHaveLength(1);
    await expect(part(full(page), "toast")).toHaveText("Stop added");
    // the toast stays hidden: the message is for screen readers
    await expect(part(full(page), "toast")).toHaveAttribute("data-state", "hidden");

    // from the last stop, + goes halfway back to the previous one
    await full(page).locator('[data-part="stop"][aria-valuenow="100"]').focus();
    await page.keyboard.press("+");
    await expect(stops(page)).toHaveCount(5);
    await expect.poll(() => focusedStopNow(page)).toBe("75");

    await full(page).getByRole("button", { name: "More gradient options" }).click();
    await full(page).getByRole("menuitem", { name: "Add stop" }).click();
    await expect(stops(page)).toHaveCount(6);
  });

  test("Delete moves focus to the newly selected stop", async ({ page }) => {
    await stops(page).nth(1).focus();
    await page.keyboard.press("Delete");
    await expect(stops(page)).toHaveCount(2);
    await expect(stops(page).first()).toBeFocused();
    await expect(stops(page).first()).toHaveAttribute("data-state", "selected");
  });

  test("the selected stop's position is a field in the controls row", async ({ page }) => {
    await stops(page).nth(1).focus();
    const field = full(page).getByRole("spinbutton", { name: "Stop position" });
    await expect(field).toHaveValue("50");
    await field.fill("30");
    await field.press("Enter");
    await expect(stops(page).nth(1)).toHaveAttribute("aria-valuenow", "30");
    expect((await log(page, "full")).value).toBe("linear-gradient(90deg, #ff0000 0%, #00ff00 30%, #0000ff 100%)");
  });

  test("menu sections are groups named by their heading", async ({ page }) => {
    await full(page).getByRole("button", { name: "More gradient options" }).click();
    const group = full(page).getByRole("group", { name: "Blend colors in" });
    await expect(group.getByRole("menuitemradio")).toHaveCount(9);
    await expect(full(page).getByRole("menuitem", { name: "Remove stop Backspace" })).toBeVisible();
  });
});

test.describe("menus and fields", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
    await noTransitions(page);
  });

  test("channel fields are spinbuttons with full names and their range", async ({ page }) => {
    const opacity = full(page).getByRole("spinbutton", { name: "Opacity" });
    await expect(opacity).toHaveAttribute("aria-valuenow", "100");
    await expect(opacity).toHaveAttribute("aria-valuemin", "0");
    await expect(opacity).toHaveAttribute("aria-valuemax", "100");
    await expect(opacity).toHaveAttribute("aria-valuetext", "100%");

    await full(page).getByRole("combobox", { name: "Color format" }).click();
    await page.getByRole("option", { name: /^RGB/ }).click();
    const red = full(page).getByRole("spinbutton", { name: "RGB Red" });
    await expect(red).toHaveAttribute("aria-valuenow", "51");
    await expect(red).toHaveAttribute("aria-valuemax", "255");
    await expect(full(page).getByRole("spinbutton", { name: /^RGB (Red|Green|Blue)$/ })).toHaveCount(3);
  });

  test("typing in an open menu does not reach the picker shortcuts", async ({ page }) => {
    const trigger = full(page).getByRole("combobox", { name: "Color format" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("2"); // would switch to Linear
    await expect(full(page)).toHaveAttribute("data-mode", "solid");
    await page.keyboard.press("Escape");
  });

  test("the active option shows a ring only after keyboard moves", async ({ page }) => {
    const trigger = full(page).getByRole("combobox", { name: "Color format" });
    await trigger.click();
    await expect(part(full(page), "select-menu")).not.toHaveAttribute("data-nav", "keyboard");
    await page.keyboard.press("ArrowDown");
    await expect(part(full(page), "select-menu")).toHaveAttribute("data-nav", "keyboard");
    const shadow = await full(page)
      .locator('[data-part="select-option"][data-active]')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).toContain("inset");
  });

  test("a mode shortcut is read out; invalid hex is flagged and read out", async ({ page }) => {
    await part(full(page), "area-thumb").focus();
    await page.keyboard.press("2");
    await expect(part(full(page), "toast")).toHaveText("Linear");
    await page.keyboard.press("1");

    const hex = full(page).getByLabel("Hex color");
    await hex.fill("zzz");
    await hex.press("Enter");
    await expect(hex).toHaveAttribute("aria-invalid", "true");
    await expect(part(full(page), "toast")).toHaveText(/Not a color/);
    await expect(hex).not.toHaveAttribute("aria-invalid", { timeout: 2000 });
  });

  test("Escape hides a tooltip without moving focus", async ({ page }) => {
    await full(page).getByRole("radio", { name: "Linear" }).click();
    const reverse = full(page).getByRole("button", { name: "Reverse stops" });
    await reverse.focus();
    await page.keyboard.press("Escape");
    await expect(reverse).toHaveAttribute("data-tooltip-hidden", "");
    await expect(reverse).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(reverse).not.toHaveAttribute("data-tooltip-hidden");
  });
});

test.describe("swatches from the keyboard", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
    await noTransitions(page);
  });

  const tabs = (page: Page) => part(full(page), "swatch-tabs");
  const grid = (page: Page) => part(full(page), "swatch-grid");
  const swatch = (page: Page, name: string) => grid(page).getByRole("button", { name, exact: true });
  const saved = (page: Page) => page.evaluate(() => (window as unknown as { __saved: { label?: string }[] }).__saved.map((s) => s.label));

  test("the grid is the tab panel of the active tab; Home / End jump", async ({ page }) => {
    const brand = tabs(page).getByRole("tab", { name: "Brand" });
    await expect(full(page).getByRole("tabpanel", { name: "Brand" })).toBeVisible();
    await expect(brand).toHaveAttribute("aria-controls", (await grid(page).getAttribute("id"))!);
    await brand.focus();
    await page.keyboard.press("End");
    await expect(tabs(page).getByRole("tab", { name: "Presets" })).toBeFocused();
    await expect(full(page).getByRole("tabpanel", { name: "Presets" })).toBeVisible();
    await page.keyboard.press("Home");
    await expect(brand).toBeFocused();
  });

  test("Delete focuses the next swatch; Alt+arrows reorder; rename gives focus back", async ({ page }) => {
    await tabs(page).getByRole("tab", { name: "Saved" }).click();
    await expect(swatch(page, "Rose")).toHaveAttribute("aria-keyshortcuts", "Delete F2 Alt+ArrowLeft Alt+ArrowRight");

    await swatch(page, "Rose").focus();
    await page.keyboard.press("Alt+ArrowRight");
    await expect.poll(() => saved(page)).toEqual(["Sky", "Rose", "Lime"]);
    await expect(swatch(page, "Rose")).toBeFocused();

    await page.keyboard.press("F2");
    const input = part(full(page), "swatch-rename-input");
    await input.fill("Coral");
    await input.press("Enter");
    await expect(swatch(page, "Coral")).toBeFocused();

    await page.keyboard.press("Delete");
    await expect.poll(() => saved(page)).toEqual(["Sky", "Lime"]);
    await expect(swatch(page, "Lime")).toBeFocused();
  });

  test("closing the search returns focus to the search button", async ({ page }) => {
    const toggle = full(page).getByRole("button", { name: "Search colors" });
    await toggle.click();
    const search = full(page).getByRole("searchbox", { name: "Search colors" });
    await expect(search).toBeFocused();
    await search.press("Escape");
    await expect(toggle).toBeFocused();

    await toggle.click();
    await full(page).getByRole("button", { name: "Close search" }).click();
    await expect(toggle).toBeFocused();
  });
});

test.describe("ColorField popover focus", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
    await noTransitions(page);
  });

  const trigger = (page: Page) => page.getByRole("button", { name: /^Fill:/ });
  const dialog = (page: Page) => page.getByRole("dialog", { name: "Fill" });

  test("Tab past the last control closes it and focus goes back to the trigger", async ({ page }) => {
    await trigger(page).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole("spinbutton", { name: "Opacity" }).focus();
    await page.keyboard.press("Tab");
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });

  test("Shift+Tab before the first control closes it onto the trigger", async ({ page }) => {
    await trigger(page).click();
    await nextFrame(page);
    await page.keyboard.press("Shift+Tab");
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });

  test("Escape in a field with typed text only drops the text", async ({ page }) => {
    await trigger(page).click();
    const hex = dialog(page).getByLabel("Hex color");
    await hex.fill("ff");
    await hex.press("Escape");
    await expect(dialog(page)).toBeVisible();
    await expect(hex).toHaveValue("3366CC");
    await hex.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });
});

test.describe("right to left", () => {
  test("the mode indicator sits under the chosen mode, and arrows follow the reading direction", async ({ page }) => {
    await openHarness(page);
    await noTransitions(page);
    const root = full(page);
    await root.evaluate((el) => el.setAttribute("dir", "rtl"));
    const indicatorOn = async (name: string) => {
      const [ind, btn] = await Promise.all([part(root, "mode-indicator").boundingBox(), root.getByRole("radio", { name }).boundingBox()]);
      return Math.abs(ind!.x + ind!.width / 2 - (btn!.x + btn!.width / 2));
    };
    // Solid is the first option, at the right edge
    const solid = (await root.getByRole("radio", { name: "Solid" }).boundingBox())!;
    const conic = (await root.getByRole("radio", { name: "Conic" }).boundingBox())!;
    expect(solid.x).toBeGreaterThan(conic.x);
    expect(await indicatorOn("Solid")).toBeLessThanOrEqual(1);
    await root.getByRole("radio", { name: "Solid" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(root.getByRole("radio", { name: "Linear" })).toBeFocused();
    await expect(root.getByRole("radio", { name: "Linear" })).toHaveAttribute("aria-checked", "true");
    expect(await indicatorOn("Linear")).toBeLessThanOrEqual(1);
  });
});

test.describe("forced colors", () => {
  test("focus shows a Highlight outline and color samples keep their colors", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only in Playwright");
    await page.emulateMedia({ forcedColors: "active" });
    await openHarness(page);
    const thumb = part(full(page), "area-thumb");
    await thumb.focus();
    await page.keyboard.press("ArrowRight"); // keyboard focus, so :focus-visible applies
    const ring = await thumb.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth };
    });
    expect(ring).toEqual({ style: "solid", width: "2px" });
    const adjust = await part(full(page), "area").evaluate((el) => getComputedStyle(el).getPropertyValue("forced-color-adjust"));
    expect(adjust).toBe("none");
    // the area still paints its hue, not the system background
    const bg = await part(full(page), "area").evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain("linear-gradient");
  });
});
