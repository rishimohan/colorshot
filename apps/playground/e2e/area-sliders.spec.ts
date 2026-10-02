import { expect, test } from "@playwright/test";
import { ariaNow, at, drag, log, nextFrame, openHarness, part, picker, wheel } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

test.describe("area drag", () => {
  test("pointer drag changes the value, many onChange, one onChangeComplete, thumb follows, cursor hidden", async ({ page }) => {
    const full = picker(page, "full");
    const area = part(full, "area");
    const thumb = part(full, "area-thumb");
    const before = (await log(page, "full")).value;

    const from = await at(area, 0.2, 0.2);
    const to = await at(area, 0.8, 0.6);
    await drag(page, from, to, {
      steps: 12,
      during: async () => {
        await expect(area).toHaveAttribute("data-dragging", "");
        expect(await area.evaluate((el) => getComputedStyle(el).cursor)).toBe("none");
        // the thumb sits under the pointer while dragging (no easing)
        const tb = (await thumb.boundingBox())!;
        expect(Math.abs(tb.x + tb.width / 2 - to.x)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(tb.y + tb.height / 2 - to.y)).toBeLessThanOrEqual(1.5);
        // no onChangeComplete until the pointer is released
        expect((await log(page, "full")).completes).toHaveLength(0);
      },
    });

    const l = await log(page, "full");
    expect(l.value).not.toBe(before);
    expect(l.changes.length).toBeGreaterThan(5);
    expect(l.completes).toEqual([l.value]);
    await expect(area).not.toHaveAttribute("data-dragging");
    expect(await area.evaluate((el) => getComputedStyle(el).cursor)).not.toBe("none");
    await expect(thumb).toHaveAttribute("aria-valuetext", "Saturation 80%, brightness 40%");
  });

  test("cursor comes back when the pointer leaves the area mid-drag", async ({ page }) => {
    const area = part(picker(page, "full"), "area");
    const box = (await area.boundingBox())!;
    await drag(page, await at(area, 0.5, 0.5), { x: box.x + box.width + 40, y: box.y + box.height / 2 }, {
      steps: 6,
      during: async () => {
        await expect(area).toHaveAttribute("data-outside", "");
        expect(await area.evaluate((el) => getComputedStyle(el).cursor)).not.toBe("none");
      },
    });
    // clamped to full saturation
    await expect(part(picker(page, "full"), "area-thumb")).toHaveAttribute("aria-valuenow", "100");
  });
});

test.describe("slider keyboard", () => {
  test("hue: arrows step 1%, shift+arrows step 10%, Home / End; reported in degrees", async ({ page }) => {
    const hue = part(picker(page, "full"), "hue").getByRole("slider");
    await hue.focus();
    await expect(hue).toHaveAttribute("aria-valuemax", "360");
    const start = await ariaNow(hue); // #3366cc -> 220deg
    expect(start).toBe(220);
    await expect(hue).toHaveAttribute("aria-valuetext", "220 degrees");
    await page.keyboard.press("ArrowRight"); // 1% of the circle: 3.6deg
    expect(await ariaNow(hue)).toBe(224);
    await page.keyboard.press("Shift+ArrowRight");
    expect(await ariaNow(hue)).toBe(260);
    await page.keyboard.press("ArrowLeft");
    expect(await ariaNow(hue)).toBe(256);
    await page.keyboard.press("Home");
    expect(await ariaNow(hue)).toBe(0);
    await page.keyboard.press("End");
    expect(await ariaNow(hue)).toBe(360);
    // every key release that changed the value is one completed change; End (360deg) is the same red as Home (0deg)
    const l = await log(page, "full");
    expect(l.completes.length).toBe(4);
    expect(l.value).toBe("#cc3333"); // hue 0, same saturation and brightness
  });

  test("alpha: arrows step 1, shift+arrows step 10, Home / End", async ({ page }) => {
    const alpha = part(picker(page, "full"), "alpha").getByRole("slider");
    await alpha.focus();
    expect(await ariaNow(alpha)).toBe(100);
    await page.keyboard.press("ArrowLeft");
    expect(await ariaNow(alpha)).toBe(99);
    await page.keyboard.press("Shift+ArrowLeft");
    expect(await ariaNow(alpha)).toBe(89);
    await page.keyboard.press("Home");
    expect(await ariaNow(alpha)).toBe(0);
    await page.keyboard.press("End");
    expect(await ariaNow(alpha)).toBe(100);
    await page.keyboard.press("ArrowDown");
    expect(await ariaNow(alpha)).toBe(99);
    expect((await log(page, "full")).value).toMatch(/^#3366cc[0-9a-f]{2}$/i);
  });
});

test.describe("two-finger wheel", () => {
  test("horizontal swipe on hue moves it and prevents scrolling; vertical does not", async ({ page }) => {
    const hueTrack = part(picker(page, "full"), "hue");
    const hue = hueTrack.getByRole("slider");
    const start = await ariaNow(hue);

    // vertical: left to the page
    expect(await wheel(hueTrack, { deltaY: 40 })).toBe(false);
    await nextFrame(page);
    expect(await ariaNow(hue)).toBe(start);
    await expect(hueTrack).not.toHaveAttribute("data-wheeling");

    // horizontal: fingers move right (deltaX is negative with natural scrolling)
    const width = (await hueTrack.boundingBox())!.width;
    expect(await wheel(hueTrack, { deltaX: -width * 0.1 })).toBe(true);
    // checked right away: the marker clears 220ms after the last wheel event, and slower engines can get there first
    expect(await hueTrack.evaluate((el) => el.hasAttribute("data-wheeling"))).toBe(true);
    await nextFrame(page);
    // 10% of the track (36deg); allow 1% (3.6deg) for sub-pixel track widths and rounding
    expect(Math.abs((await ariaNow(hue)) - (start + 36))).toBeLessThanOrEqual(4);
  });

  test("the cursor is hidden on the area, sliders and their thumbs while swiping", async ({ page }) => {
    const root = picker(page, "full");
    for (const name of ["area", "hue", "alpha"]) {
      const el = part(root, name);
      const cursors = await el.evaluate((el) => {
        el.dispatchEvent(new WheelEvent("wheel", { deltaX: -4, deltaY: -1, bubbles: true, cancelable: true }));
        return [el, ...el.querySelectorAll("*")].map((n) => getComputedStyle(n).cursor);
      });
      expect([name, ...new Set(cursors)]).toEqual([name, "none"]);
    }
  });

  test("a real trackpad-style wheel over hue moves it without scrolling the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 }); // make the page scrollable
    const hueTrack = part(picker(page, "full"), "hue");
    const hue = hueTrack.getByRole("slider");
    const start = await ariaNow(hue);
    await hueTrack.hover();
    await page.mouse.wheel(-20, 0);
    await expect.poll(() => ariaNow(hue)).toBeGreaterThan(start);
    expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  });

  test("wheel on the area moves both axes; data-wheeling clears and one onChangeComplete fires after idle", async ({ page }) => {
    const area = part(picker(page, "full"), "area");
    const thumb = part(picker(page, "full"), "area-thumb");
    const text0 = await thumb.getAttribute("aria-valuetext");
    expect(text0).toBe("Saturation 75%, brightness 80%");
    const box = (await area.boundingBox())!;

    // five events 16ms apart, dispatched in the page so a busy test runner cannot stretch the gaps
    // past the 220ms gesture end. Fingers right and down: more saturation, less brightness
    const marked = await area.evaluate(async (el, { dx, dy }) => {
      const seen: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        el.dispatchEvent(new WheelEvent("wheel", { deltaX: dx, deltaY: dy, bubbles: true, cancelable: true }));
        seen.push(el.hasAttribute("data-wheeling"));
        await new Promise((r) => setTimeout(r, 16));
      }
      return seen.every(Boolean);
    }, { dx: -box.width * 0.02, dy: -box.height * 0.02 });
    expect(marked).toBe(true);
    expect((await log(page, "full")).completes).toHaveLength(0);
    await expect(thumb).toHaveAttribute("aria-valuetext", "Saturation 85%, brightness 70%");

    await expect(area).not.toHaveAttribute("data-wheeling", { timeout: 2000 });
    await expect.poll(async () => (await log(page, "full")).completes.length).toBe(1);
    const l = await log(page, "full");
    // one change per animation frame: events that land in the same frame are applied together, so five
    // events give at most five changes. How many frames they span depends on the machine (a busy CI
    // runner can fit them into two), so only the upper bound is a rule
    expect(l.changes.length).toBeGreaterThanOrEqual(1);
    expect(l.changes.length).toBeLessThanOrEqual(5);
    expect(l.completes[0]).toBe(l.value);
  });

  test("a scroll that started outside a control keeps scrolling the page", async ({ page }) => {
    const hueTrack = part(picker(page, "full"), "hue");
    const start = await ariaNow(hueTrack.getByRole("slider"));
    // both events in one page task, so runner load cannot push them past the 250ms "same scroll" window
    const handled = await hueTrack.evaluate((el) => {
      document.body.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: -30 }));
      const e = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: -30 });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(handled).toBe(false);
    expect(await ariaNow(hueTrack.getByRole("slider"))).toBe(start);
  });
});

test.describe("other pickers", () => {
  test('space="oklch": dragging the area keeps writing oklch()', async ({ page }) => {
    const oklch = picker(page, "oklch");
    const area = part(oklch, "area");
    await drag(page, await at(area, 0.3, 0.4), await at(area, 0.4, 0.5), { steps: 5 });
    const l = await log(page, "oklch");
    expect(l.changes.length).toBeGreaterThan(1);
    expect(l.completes).toHaveLength(1);
    expect(l.value).toMatch(/^oklch\(/);
    expect(l.value).not.toBe("oklch(0.7 0.15 200)");
  });

  test("solid-only picker: no mode tabs, and a pasted gradient is ignored", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only in Playwright");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const solid = picker(page, "solid");
    await expect(solid.getByRole("radiogroup", { name: "Fill type" })).toHaveCount(0);
    await page.evaluate(() => navigator.clipboard.writeText("linear-gradient(90deg, #ff0000, #0000ff)"));
    await part(solid, "area-thumb").focus();
    await page.keyboard.press("ControlOrMeta+V");
    await page.waitForTimeout(100);
    expect((await log(page, "solid")).changes).toHaveLength(0);
    await expect(solid).toHaveAttribute("data-mode", "solid");
  });
});
