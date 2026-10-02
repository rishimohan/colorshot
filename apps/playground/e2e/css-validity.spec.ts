import { expect, test } from "@playwright/test";

// Random edits through the core store, checked by the browser's own CSS parser.
test("every value the picker writes is valid CSS in the browser", async ({ page }) => {
  await page.goto("/?harness");
  await page.waitForFunction(() => "__core" in window);
  const failures = await page.evaluate(() => {
    const core = (window as any).__core;
    const starts = [
      "#3366ff",
      "transparent",
      "oklch(0.7 0.3 140)",
      "color(display-p3 1 0 0)",
      "linear-gradient(red, blue)",
      "linear-gradient(to right, #000, 30%, #fff)",
      "radial-gradient(ellipse 66% 110% at 101% -8%, rgb(67,150,232) 0%, rgba(205,229,248,0) 99%)",
      "conic-gradient(from 45deg at 30% 40% in oklab, red 0deg 90deg, blue 90deg 0.5turn, green)",
      "repeating-linear-gradient(135deg, #111 0 10px, #333 10px 20px)",
      "radial-gradient(circle at 8% 18%, #ffd400 0%, transparent 38%), linear-gradient(red, blue)",
    ];
    const formats = ["preserve", "hex", "rgb", "hsl", "hwb", "lab", "lch", "oklab", "oklch", "display-p3"];
    let seed = 7;
    const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const pick = (xs: any[]) => xs[Math.floor(r() * xs.length)];
    const bad: string[] = [];
    for (let run = 0; run < 60; run++) {
      const picker = core.createPicker({ value: pick(starts), outputFormat: pick(formats) });
      for (let step = 0; step < 60; step++) {
        const s = picker.getState();
        const stop = s.stops.length ? pick(s.stops).id : null;
        const op = Math.floor(r() * 11);
        if (op === 0) picker.setHsva({ h: r() * 360, s: r(), v: r(), a: r() });
        else if (op === 1) picker.setMode(pick(["solid", "linear", "radial", "conic"]));
        else if (op === 2) picker.addStop(r());
        else if (op === 3 && stop) picker.moveStop(stop, r());
        else if (op === 4 && stop) picker.removeStop(stop);
        else if (op === 5) picker.setAngle(r() * 400);
        else if (op === 6) picker.setCenter(r() * 100, r() * 100);
        else if (op === 7) picker.setShape(r() < 0.5 ? "circle" : "ellipse");
        else if (op === 8) picker.setInterpolation(pick([null, "oklch", "oklch longer hue", "hsl", "lab"]));
        else if (op === 9) picker.setColor({ space: "oklch", coords: [r(), r() * 0.4, r() * 360], alpha: r() });
        else picker.reverse();
        const v = picker.getState().value;
        const ok = core.isGradient(v) ? CSS.supports("background-image", v) : CSS.supports("color", v);
        if (!ok) bad.push(v);
      }
    }
    return [...new Set(bad)].slice(0, 10);
  });
  expect(failures).toEqual([]);
});
