import { expect, test, type Page } from "@playwright/test";
import { log, openHarness, part, picker } from "./helpers";


const full = (page: Page) => picker(page, "full");
const formatTrigger = (page: Page) => full(page).getByRole("combobox", { name: "Format" });

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

test.describe("format menu", () => {
  test("keyboard: Enter opens, arrows move, Enter picks OKLCH, fields become 3 channels", async ({ page }) => {
    const trigger = formatTrigger(page);
    await expect(trigger).toHaveText("HEX");
    await expect(part(full(page), "fields")).toHaveAttribute("data-count", "1");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const listbox = full(page).getByRole("listbox");
    await expect(listbox).toBeVisible();
    // active option follows aria-activedescendant
    const active = async () => (await page.locator(`[id="${await trigger.getAttribute("aria-activedescendant")}"]`).textContent()) ?? "";
    expect(await active()).toContain("HEX");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
    expect(await active()).toContain("OKLCH");
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveText("OKLCH");
    await expect(part(full(page), "fields")).toHaveAttribute("data-count", "3");
    await expect(full(page).getByRole("spinbutton", { name: /^OKLCH (Lightness|Chroma|Hue)$/ })).toHaveCount(3);
    // changing the display format does not change the value
    expect((await log(page, "full")).changes).toHaveLength(0);
  });

  test("Escape closes and returns focus; hints only exist while open", async ({ page }) => {
    const trigger = formatTrigger(page);
    await expect(part(full(page), "select-hint")).toHaveCount(0);
    await trigger.click();
    await expect(part(full(page), "select-option")).toHaveCount(4);
    await expect(part(full(page), "select-hint")).toHaveCount(4);
    await expect(part(full(page), "select-hint").first()).toHaveText("#3366CC");
    await page.keyboard.press("Escape");
    await expect(part(full(page), "select-menu")).toHaveCount(0);
    await expect(part(full(page), "select-hint")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("typeahead: jumps while open, picks directly while closed", async ({ page }) => {
    const trigger = formatTrigger(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("r");
    const activeId = await trigger.getAttribute("aria-activedescendant");
    await expect(page.locator(`[id="${activeId}"]`)).toContainText("RGB");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveText("HEX");
    // closed: typing selects the next match (keys within 600ms build one search string)
    await page.waitForTimeout(700);
    await page.keyboard.press("o");
    await expect(trigger).toHaveText("OKLCH");
    await page.waitForTimeout(700);
    await page.keyboard.press("h");
    await expect(trigger).toHaveText("HEX");
    await page.waitForTimeout(700);
    await page.keyboard.press("h");
    await expect(trigger).toHaveText("HSL");
  });

  test("outside press closes the menu", async ({ page }) => {
    await formatTrigger(page).click();
    await expect(part(full(page), "select-menu")).toBeVisible();
    await page.mouse.click(1200, 880);
    await expect(part(full(page), "select-menu")).toHaveCount(0);
  });
});

test.describe("hex field", () => {
  test("valid hex commits on Enter", async ({ page }) => {
    const hex = full(page).getByLabel("Hex color");
    await hex.click();
    // the whole value is selected on focus (a frame later, for Safari)
    await expect(hex).toHaveJSProperty("selectionStart", 0);
    await page.keyboard.type("ff8800");
    expect((await log(page, "full")).changes).toHaveLength(0); // typing is a draft
    await page.keyboard.press("Enter");
    const l = await log(page, "full");
    expect(l.value).toBe("#ff8800");
    expect(l.completes).toEqual(["#ff8800"]);
    await expect(hex).toHaveValue("FF8800");
  });

  test("invalid text is rejected and keeps the old value", async ({ page }) => {
    const hex = full(page).getByLabel("Hex color");
    const label = hex.locator("xpath=..");
    await hex.fill("zzz");
    await hex.press("Enter");
    await expect(label).toHaveAttribute("data-invalid", "");
    await expect(hex).toHaveValue("3366CC");
    const l = await log(page, "full");
    expect(l.value).toBe("#3366cc");
    expect(l.changes).toHaveLength(0);
    expect(l.completes).toHaveLength(0);
  });

  // BUG: HexField sets data-invalid and relies on onAnimationEnd to clear it, but @colorshot/styles has no rule
  // for [data-invalid] (no shake keyframes at all). So invalid input gets no visible feedback, and data-invalid
  // stays on the field forever (onAnimationEnd never fires). Same with prefers-reduced-motion, which sets
  // animation: none.
  test("invalid text shakes the field, then the marker clears", async ({ page }) => {
    const hex = full(page).getByLabel("Hex color");
    const label = hex.locator("xpath=..");
    await hex.fill("zzz");
    await hex.press("Enter");
    expect(await label.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
    await expect(label).not.toHaveAttribute("data-invalid", { timeout: 2000 });
  });

  test("pasting oklch() applies it and the output stays oklch", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only in Playwright");
    const hex = full(page).getByLabel("Hex color");
    await hex.click();
    await page.evaluate(() => navigator.clipboard.writeText("oklch(0.7 0.1 200)"));
    await page.keyboard.press("ControlOrMeta+V");
    await expect.poll(async () => (await log(page, "full")).value).toMatch(/^oklch\(/);
    const l = await log(page, "full");
    expect(l.value).toBe("oklch(0.7 0.1 200)");
    expect(l.completes).toEqual([l.value]);
    // editing afterwards keeps writing oklch (outputFormat "preserve")
    await part(full(page), "hue").getByRole("slider").focus();
    await page.keyboard.press("ArrowRight");
    expect((await log(page, "full")).value).toMatch(/^oklch\([\d.]+ [\d.]+ [\d.]+\)$/);
    expect((await log(page, "full")).value).not.toBe("oklch(0.7 0.1 200)");
  });
});

test.describe("clipboard on the picker", () => {
  // the tests drive navigator.clipboard, which needs permissions only Chromium grants headless
  test.skip(({ browserName }) => browserName !== "chromium", "clipboard permissions are Chromium-only in Playwright");
  test("Cmd/Ctrl+C on a focused thumb copies the value and shows a toast", async ({ page }) => {
    await page.evaluate(() => navigator.clipboard.writeText("nothing yet"));
    await part(full(page), "area-thumb").focus();
    await page.keyboard.press("ControlOrMeta+C");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("#3366cc");
    const toast = part(full(page), "toast");
    await expect(toast).toHaveAttribute("data-state", "visible");
    await expect(toast).toHaveText(/Copied/);
    await expect(toast).toHaveAttribute("data-state", "hidden", { timeout: 3000 });
  });

  test("pasting a gradient switches the mode", async ({ page }) => {
    const gradient = "linear-gradient(45deg, #ff0000 0%, #0000ff 100%)";
    await page.evaluate((g) => navigator.clipboard.writeText(g), gradient);
    await part(full(page), "area-thumb").focus();
    await page.keyboard.press("ControlOrMeta+V");
    await expect(full(page)).toHaveAttribute("data-mode", "linear");
    await expect(full(page).getByRole("radio", { name: "Linear" })).toHaveAttribute("aria-checked", "true");
    const l = await log(page, "full");
    expect(l.value).toBe(gradient);
    expect(l.completes).toEqual([gradient]);
    await expect(part(full(page), "toast")).toHaveText(/Pasted/);
  });

  test("pasting text that is not a color does nothing", async ({ page }) => {
    await page.evaluate(() => navigator.clipboard.writeText("hello world"));
    await part(full(page), "area-thumb").focus();
    await page.keyboard.press("ControlOrMeta+V");
    await page.waitForTimeout(100);
    expect((await log(page, "full")).changes).toHaveLength(0);
    await expect(part(full(page), "toast")).toHaveAttribute("data-state", "hidden");
  });
});

test.describe("history", () => {
  test("Cmd/Ctrl+Z undoes a committed change, Shift+Cmd/Ctrl+Z redoes", async ({ page }) => {
    const hex = full(page).getByLabel("Hex color");
    await hex.fill("ff0000");
    await hex.press("Enter");
    await hex.fill("00ff00");
    await hex.press("Enter");
    await expect.poll(async () => (await log(page, "full")).value).toBe("#00ff00");

    // shortcuts are ignored inside text fields (the input keeps its own undo)
    await part(full(page), "area-thumb").focus();
    await page.keyboard.press("ControlOrMeta+Z");
    await expect.poll(async () => (await log(page, "full")).value).toBe("#ff0000");
    await expect(hex).toHaveValue("FF0000");
    await page.keyboard.press("ControlOrMeta+Z");
    await expect.poll(async () => (await log(page, "full")).value).toBe("#3366cc");
    await page.keyboard.press("ControlOrMeta+Z"); // nothing left
    await expect.poll(async () => (await log(page, "full")).value).toBe("#3366cc");
    await page.keyboard.press("ControlOrMeta+Shift+Z");
    await expect.poll(async () => (await log(page, "full")).value).toBe("#ff0000");
    await page.keyboard.press("ControlOrMeta+Shift+Z");
    await expect.poll(async () => (await log(page, "full")).value).toBe("#00ff00");
    // undo / redo report through onChangeComplete so hosts can persist them
    expect((await log(page, "full")).completes).toEqual(["#ff0000", "#00ff00", "#ff0000", "#3366cc", "#ff0000", "#00ff00"]);
  });

  test("a drag is one undo step", async ({ page }) => {
    const area = part(full(page), "area");
    const b = (await area.boundingBox())!;
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(b.x + 10 + i * 20, b.y + 10 + i * 10);
    await page.mouse.up();
    expect((await log(page, "full")).value).not.toBe("#3366cc");
    await part(full(page), "area-thumb").focus();
    await page.keyboard.press("ControlOrMeta+Z");
    expect((await log(page, "full")).value).toBe("#3366cc");
  });
});
