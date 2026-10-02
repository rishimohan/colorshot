import { expect, type Locator, type Page } from "@playwright/test";

declare global {
  interface Window {
    // set by src/harness.tsx
    __cs: {
      pickers: Record<string, PickerLog>;
      renders: Record<string, number>;
      durations: Record<string, { total: number; max: number }>;
      fieldOpen: boolean[];
      reset: () => void;
    };
  }
}

export type PickerId = "full" | "solid" | "oklch" | "perf" | "field" | "controlled";

export interface PickerLog {
  value: string;
  changes: string[];
  completes: string[];
}

/** Open the harness (`/?harness`), optionally with extra query params, and clear the counters. */
export async function openHarness(page: Page, query: Record<string, string> = {}) {
  const qs = new URLSearchParams(query).toString();
  await page.goto(`/?harness${qs ? `&${qs}` : ""}`);
  await page.getByTestId("picker-full").waitFor();
  await nextFrame(page);
  await page.evaluate(() => window.__cs.reset());
}

export const picker = (page: Page, id: Exclude<PickerId, "field">): Locator => page.getByTestId(`picker-${id}`);

export const part = (scope: Locator, name: string): Locator => scope.locator(`[data-part="${name}"]`);

export function log(page: Page, id: PickerId): Promise<PickerLog> {
  return page.evaluate((id) => {
    const p = window.__cs.pickers[id];
    return { value: p.value, changes: p.changes.slice(), completes: p.completes.slice() };
  }, id);
}

export function renders(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => ({ ...window.__cs.renders }));
}

export function resetCounters(page: Page) {
  return page.evaluate(() => window.__cs.reset());
}

/** Wait two animation frames, so coalesced pointer moves have been flushed and React has committed. */
export function nextFrame(page: Page) {
  return page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

export async function noTransitions(page: Page) {
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation-duration: 0s !important; animation-delay: 0s !important; }",
  });
}

export async function center(loc: Locator) {
  const b = (await loc.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Point inside an element at fractions (0..1) of its box. */
export async function at(loc: Locator, fx: number, fy: number) {
  const b = (await loc.boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
}

/** A point on a gradient bar's stop track (inside the bar's inline padding) at offset `fx`, vertically centered. */
export async function onTrack(bar: Locator, fx: number) {
  const pad = await bar.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft) || 0);
  const b = (await bar.boundingBox())!;
  return { x: b.x + pad + (b.width - pad * 2) * fx, y: b.y + b.height / 2 };
}

/**
 * Press, move in `steps` frames, release. Waits a frame after every move so each one reaches the
 * picker (moves are coalesced per animation frame). `during` runs before the release.
 */
export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  { steps = 10, during }: { steps?: number; during?: () => Promise<void> } = {},
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await nextFrame(page);
  }
  await during?.();
  await page.mouse.up();
  await nextFrame(page);
}

export const ariaNow = async (loc: Locator) => Number(await loc.getAttribute("aria-valuenow"));

/** Dispatch a synthetic wheel event; resolves to true when the picker prevented the default (page scroll). */
export function wheel(loc: Locator, init: { deltaX?: number; deltaY?: number; deltaMode?: number; ctrlKey?: boolean }) {
  return loc.evaluate((el, init) => {
    const r = el.getBoundingClientRect();
    const e = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      ...init,
    });
    return !el.dispatchEvent(e);
  }, init);
}

export async function expectInViewport(page: Page, loc: Locator) {
  const vp = page.viewportSize()!;
  const b = (await loc.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
  return b;
}

/** Read one rendered pixel (sRGB 0..255) from a screenshot, decoded in the page. */
export async function pixel(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]] as [number, number, number];
  }, png.toString("base64"));
}

/** Parse #rgb / #rrggbb into 0..255 channels. */
export function hexRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
