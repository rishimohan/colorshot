import { expect, test, type Page } from "@playwright/test";
import { at, center, drag, hexRgb, log, nextFrame, noTransitions, onTrack, openHarness, part, picker, pixel } from "./helpers";

const RGB = "linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)";

const full = (page: Page) => picker(page, "full");
const stops = (page: Page) => part(full(page), "stop");
const bar = (page: Page) => part(full(page), "gradient-bar");
const selected = (page: Page) => full(page).locator('[data-part="stop"][data-state="selected"]');
const stopColor = (loc: ReturnType<typeof stops>) => loc.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--_cs-stop-color"));

test.describe("gradients", () => {
  test("switching to a gradient leaves the mode tabs where they were; the editor opens below them", async ({ page }) => {
    await openHarness(page);
    await noTransitions(page);
    const tabs = part(full(page), "mode-tabs");
    const before = (await tabs.boundingBox())!.y;
    await full(page).getByRole("radio", { name: "Linear" }).click();
    await expect(full(page)).toHaveAttribute("data-mode", "linear");
    await nextFrame(page);
    expect((await tabs.boundingBox())!.y).toBe(before);
  });

  test("solid -> linear puts the solid color on the active stop; clicking the bar adds a stop", async ({ page }) => {
    await openHarness(page);
    await noTransitions(page);
    await full(page).getByRole("radio", { name: "Linear" }).click();
    await expect(full(page)).toHaveAttribute("data-mode", "linear");
    expect((await log(page, "full")).value).toBe("linear-gradient(90deg, #3366cc 0%, #ffffff 100%)");
    await expect(stops(page)).toHaveCount(2);
    expect(await stopColor(selected(page))).toBe("#3366cc");

    await page.mouse.click(...Object.values(await at(bar(page), 0.5, 0.5)) as [number, number]);
    await nextFrame(page);
    await expect(stops(page)).toHaveCount(3);
    // the new stop is selected, sits where the bar was clicked, and has a color between its neighbours
    const added = selected(page);
    expect(Math.abs(Number(await added.getAttribute("aria-valuenow")) - 50)).toBeLessThanOrEqual(1);
    const [r, g, b] = hexRgb(await stopColor(added));
    expect(r).toBeGreaterThan(0x33);
    expect(r).toBeLessThan(0xff);
    expect(g).toBeGreaterThan(0x66);
    expect(g).toBeLessThan(0xff);
    expect(b).toBeGreaterThan(0xcc);
    expect(b).toBeLessThan(0xff);
    const l = await log(page, "full");
    expect(l.completes).toHaveLength(2); // mode switch, add stop
    expect(l.value).toMatch(/^linear-gradient\(90deg, #3366cc 0%, #[0-9a-f]{6} 50(\.\d+)?%, #ffffff 100%\)$/);
  });

  // BUG: addStop picks the new stop's color with colorAt(), which interpolates in OKLab, but the bar (and the CSS
  // value itself) has no `in <space>`, so browsers interpolate legacy hex stops in sRGB. Clicking the bar therefore
  // inserts a color that differs from what was shown at that point and visibly changes the gradient
  // (red -> blue at 50%: the bar shows rgb(126 0 128), the new stop is rgb(140 83 162), the OKLab midpoint).
  test("a stop added by clicking the bar takes the color the bar showed at that point", async ({ page }) => {
    await openHarness(page, { value: "linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" });
    await noTransitions(page);
    await page.mouse.move(0, 0);
    const point = await at(bar(page), 0.5, 0.5);
    const shown = await pixel(page, point.x, point.y);
    await page.mouse.click(point.x, point.y);
    await expect(stops(page)).toHaveCount(3);
    const added = hexRgb(await stopColor(selected(page)));
    console.log("bar pixel", shown, "new stop", added);
    for (let i = 0; i < 3; i++) expect(Math.abs(added[i] - shown[i])).toBeLessThanOrEqual(8);
  });

  test.describe("stops", () => {
    test.beforeEach(async ({ page }) => {
      await openHarness(page, { value: RGB });
      await noTransitions(page);
      await expect(stops(page)).toHaveCount(3);
    });

    test("dragging a stop moves it", async ({ page }) => {
      const mid = stops(page).nth(1);
      await drag(page, await center(mid), await onTrack(bar(page), 0.75), { steps: 8 });
      expect(Math.abs(Number(await mid.getAttribute("aria-valuenow")) - 75)).toBeLessThanOrEqual(1);
      const l = await log(page, "full");
      expect(l.completes).toHaveLength(1);
      expect(l.value).toMatch(/^linear-gradient\(90deg, #ff0000 0%, #00ff00 7[45](\.\d+)?%, #0000ff 100%\)$/);
    });

    test("while a stop is dragged the cursor is grabbing, not the bar's add cursor", async ({ page }) => {
      const c = await center(stops(page).nth(1));
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      await page.mouse.move(c.x + 20, c.y, { steps: 3 });
      await nextFrame(page);
      expect(await bar(page).evaluate((el) => getComputedStyle(el).cursor)).toBe("grabbing");
      await page.mouse.up();
      expect(await bar(page).evaluate((el) => getComputedStyle(el).cursor)).toBe("copy");
    });

    test("a two-finger swipe keeps moving the stop after it slides out from under the cursor", async ({ page }) => {
      const mid = stops(page).nth(1);
      // first event lands on the stop, the rest on the bar where the cursor stays (the stop has moved on);
      // dispatched in the page, 16ms apart, so the gesture does not time out between events
      const after = await page.evaluate(async () => {
        const root = document.querySelector('[data-testid="picker-full"]')!;
        const stop = root.querySelectorAll<HTMLElement>('[data-part="stop"]')[1];
        const barEl = root.querySelector<HTMLElement>('[data-part="gradient-bar"]')!;
        const before = Number(stop.getAttribute("aria-valuenow"));
        for (let i = 0; i < 6; i++) {
          (i === 0 ? stop : barEl).dispatchEvent(new WheelEvent("wheel", { deltaX: -8, deltaY: 1, bubbles: true, cancelable: true }));
          await new Promise((r) => setTimeout(r, 16));
        }
        // swipe events are applied once per animation frame: let the last one land
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return Number(stop.getAttribute("aria-valuenow")) - before;
      });
      expect(after).toBeGreaterThan(10);
      await expect(mid).toHaveAttribute("data-state", "selected");
    });

    test("dragging a stop far off the bar removes it, but never below two stops", async ({ page }) => {
      const mid = stops(page).nth(1);
      const c = await center(mid);
      await drag(page, c, { x: c.x, y: c.y + 80 }, {
        steps: 6,
        during: async () => {
          await expect(mid).toHaveAttribute("data-removing", "");
        },
      });
      await expect(stops(page)).toHaveCount(2);
      expect((await log(page, "full")).value).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");

      const first = stops(page).first();
      const c2 = await center(first);
      await drag(page, c2, { x: c2.x, y: c2.y + 80 }, {
        steps: 6,
        during: async () => {
          await expect(first).not.toHaveAttribute("data-removing");
        },
      });
      await expect(stops(page)).toHaveCount(2);
    });

    test("Alt-drag duplicates a stop", async ({ page }) => {
      const c = await center(stops(page).nth(1));
      await page.keyboard.down("Alt");
      await drag(page, c, await onTrack(bar(page), 0.25), { steps: 6 });
      await page.keyboard.up("Alt");
      await expect(stops(page)).toHaveCount(4);
      const v = (await log(page, "full")).value;
      expect(v).toMatch(/^linear-gradient\(90deg, #ff0000 0%, #00ff00 2[45](\.\d+)?%, #00ff00 50%, #0000ff 100%\)$/);
      expect((await log(page, "full")).completes).toHaveLength(1);
    });

    test("Delete removes the focused stop", async ({ page }) => {
      await stops(page).nth(1).click();
      await expect(stops(page).nth(1)).toBeFocused();
      await page.keyboard.press("Delete");
      await expect(stops(page)).toHaveCount(2);
      expect((await log(page, "full")).value).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
      // two stops left: Delete is ignored
      await stops(page).first().focus();
      await page.keyboard.press("Delete");
      await expect(stops(page)).toHaveCount(2);
    });

    test("arrow keys move the focused stop", async ({ page }) => {
      const mid = stops(page).nth(1);
      await mid.click();
      await expect(mid).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Shift+ArrowRight");
      await expect(mid).toHaveAttribute("aria-valuenow", "61");
    });

    test("gradient -> solid takes the active stop's color; solid -> gradient puts it back on that stop", async ({ page }) => {
      await stops(page).nth(2).click();
      await expect(stops(page).nth(2)).toHaveAttribute("data-state", "selected");
      await full(page).getByRole("radio", { name: "Solid" }).click();
      await expect(full(page)).toHaveAttribute("data-mode", "solid");
      expect((await log(page, "full")).value).toBe("#0000ff");

      const hex = full(page).getByLabel("Hex color");
      await hex.fill("00ffff");
      await hex.press("Enter");
      expect((await log(page, "full")).value).toBe("#00ffff");

      await full(page).getByRole("radio", { name: "Linear" }).click();
      expect((await log(page, "full")).value).toBe("linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #00ffff 100%)");
      await expect(selected(page)).toHaveAttribute("aria-valuenow", "100");
    });
  });
});
