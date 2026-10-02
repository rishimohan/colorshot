import { expect, test, type Locator, type Page } from "@playwright/test";
import { at, log, nextFrame, openHarness, part, picker, renders, resetCounters } from "./helpers";

// bounds allow a few extra commits: engines differ by one or two (focus, the Recent update at the end);
// a regression that re-renders twice per frame would still fail
const STEPS = 30;

/** 30-frame drag across `track`, one pointer move per frame. Returns wall-clock ms per step and long frames seen. */
async function profiledDrag(page: Page, track: Locator, from: [number, number], to: [number, number]) {
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    try {
      new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__long.push(e.duration))).observe({
        type: "long-animation-frame",
        buffered: false,
      });
    } catch {
      // not supported
    }
  });
  const a = await at(track, ...from);
  const b = await at(track, ...to);
  await page.mouse.move(a.x, a.y);
  await nextFrame(page);
  await resetCounters(page);
  const t0 = Date.now();
  await page.mouse.down();
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / STEPS, a.y + ((b.y - a.y) * i) / STEPS);
    await nextFrame(page);
  }
  await page.mouse.up();
  await nextFrame(page);
  const elapsed = Date.now() - t0;
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  const durations = await page.evaluate(() => window.__cs.durations);
  return { msPerStep: elapsed / STEPS, long, durations };
}

const fmt = (d: Record<string, { total: number; max: number }>) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, `total ${v.total.toFixed(1)}ms, max ${v.max.toFixed(2)}ms`]));

test.describe("performance", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test("area drag: commits stay bounded and colour-independent parts do not re-render", async ({ page }) => {
    const area = part(picker(page, "perf"), "area");
    const { msPerStep, long, durations } = await profiledDrag(page, area, [0.1, 0.1], [0.9, 0.9]);
    const r = await renders(page);
    const l = await log(page, "perf");
    console.log(`[perf] area drag, ${STEPS} steps: onChange=${l.changes.length} onChangeComplete=${l.completes.length}`);
    console.log("[perf] commits per profiler:", JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith("perf")))));
    console.log("[perf] render time:", JSON.stringify(fmt(durations)));
    console.log(`[perf] ${msPerStep.toFixed(1)} ms per step (wall clock incl. test driver), long animation frames: ${JSON.stringify(long.map(Math.round))}`);

    expect(l.completes).toHaveLength(1);
    // one commit per pointer frame (plus the press), never more
    expect(r.perf).toBeLessThanOrEqual(STEPS + 4);
    expect(r["perf:area"]).toBeLessThanOrEqual(STEPS + 4);
    // these do not read saturation / brightness
    expect(r["perf:hue"]).toBe(0);
    expect(r["perf:mode-tabs"]).toBe(0);
    expect(r["perf:gradient-editor"]).toBe(0);
    // they do: the inputs show the color, alpha's track is tinted with it
    expect(r["perf:inputs"]).toBeLessThanOrEqual(STEPS + 4);
    expect(r["perf:alpha"]).toBeLessThanOrEqual(STEPS + 4);
    // a group only follows the value while it matches one of its swatches, and the drag never lands on one
    expect(r["perf:swatches"]).toBe(0);
  });

  test("hue drag: mode tabs and gradient editor stay idle", async ({ page }) => {
    const hue = part(picker(page, "perf"), "hue");
    const { msPerStep, durations } = await profiledDrag(page, hue, [0.05, 0.5], [0.95, 0.5]);
    const r = await renders(page);
    console.log("[perf] hue drag commits:", JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith("perf")))));
    console.log("[perf] hue drag render time:", JSON.stringify(fmt(durations)), `${msPerStep.toFixed(1)} ms per step`);
    expect(r.perf).toBeLessThanOrEqual(STEPS + 4);
    expect(r["perf:mode-tabs"]).toBe(0);
    expect(r["perf:gradient-editor"]).toBe(0);
    expect(r["perf:hue"]).toBeLessThanOrEqual(STEPS + 4);
    expect(r["perf:swatches"]).toBe(0);
  });

  test("full ColorPicker: commits per area drag stay bounded", async ({ page }) => {
    const area = part(picker(page, "full"), "area");
    const { msPerStep, long, durations } = await profiledDrag(page, area, [0.1, 0.1], [0.9, 0.9]);
    const r = await renders(page);
    const l = await log(page, "full");
    console.log(
      `[perf] full picker area drag: ${r.full} commits, onChange=${l.changes.length}, render total ${durations.full?.total.toFixed(1)}ms max ${durations.full?.max.toFixed(2)}ms, ${msPerStep.toFixed(1)} ms/step, long frames ${long.length}`,
    );
    // +1: when the drag ends, Recent gains a color and the swatch tab strip re-measures once
    expect(r.full).toBeLessThanOrEqual(STEPS + 5);
    expect(l.changes.length).toBeLessThanOrEqual(STEPS + 1);
    expect(l.completes).toHaveLength(1);
  });

  test("full ColorPicker in a gradient: commits per stop drag stay bounded", async ({ page }) => {
    await openHarness(page, { value: "linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)" });
    const bar = part(picker(page, "full"), "gradient-bar");
    const { durations } = await profiledDrag(page, bar, [0.5, 0.5], [0.8, 0.5]);
    const r = await renders(page);
    console.log(`[perf] stop drag: ${r.full} commits, render total ${durations.full?.total.toFixed(1)}ms max ${durations.full?.max.toFixed(2)}ms`);
    // the first move past the 3px threshold also flips the stop's "dragging" state
    expect(r.full).toBeLessThanOrEqual(STEPS + 6);
  });

  test("controlled ColorPicker with inline swatches and labels: no swatch re-renders, no context change", async ({ page }) => {
    const root = picker(page, "controlled");
    const area = part(root, "area");
    await area.scrollIntoViewIfNeeded();
    const { durations } = await profiledDrag(page, area, [0.1, 0.1], [0.9, 0.9]);
    const r = await renders(page);
    const l = await log(page, "controlled");
    console.log(
      `[perf] controlled area drag: ${r.controlled} commits, onChange=${l.changes.length}, swatch renders=${r["controlled:swatch"]}, context changes=${r["controlled:context"]}, render total ${durations.controlled?.total.toFixed(1)}ms max ${durations.controlled?.max.toFixed(2)}ms`,
    );
    // the host re-rendered the whole picker on every frame...
    expect(l.changes.length).toBeGreaterThanOrEqual(STEPS);
    // ...with new swatch arrays, callbacks and labels, but the content was the same each time
    expect(r["controlled:swatch"]).toBe(0);
    expect(r["controlled:context"]).toBe(0);
  });
});
