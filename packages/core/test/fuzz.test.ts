import { describe, expect, it } from "vitest";
import { createPicker, isGradient, parseColor, parseLayers, type PickerMode } from "../src";

// Deterministic pseudo random numbers so failures reproduce
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const START = [
  "#3366ff",
  "transparent",
  "rgba(10, 20, 30, 0.5)",
  "oklch(0.7 0.3 140)",
  "color(display-p3 1 0 0)",
  "hsl(200 50% 50% / 0.2)",
  "red",
  "",
  "mixed",
  "var(--brand)",
  "linear-gradient(red, blue)",
  "linear-gradient(to right, #000, 30%, #fff)",
  "radial-gradient(ellipse 66% 110% at 101% -8%, rgb(67,150,232) 0%, rgba(205,229,248,0) 99%)",
  "conic-gradient(from 45deg at 30% 40% in oklab, red 0deg 90deg, blue 90deg 0.5turn, green)",
  "repeating-linear-gradient(135deg, #111 0 10px, #333 10px 20px)",
  "radial-gradient(circle at 8% 18%, #ffd400 0%, transparent 38%), linear-gradient(red, blue)",
  "linear-gradient(90deg, var(--brand, #f0f) 0%, #000 100%)",
  "linear-gradient(red)",
];

const MODES: PickerMode[] = ["solid", "linear", "radial", "conic"];
const CSS = ["#abc", "#ff000080", "oklch(0.5 0.2 30)", "rgb(1 2 3 / 50%)", "linear-gradient(45deg, red, blue)", "nonsense", "hsl(0, 0%, 0%)"];

/** Every gradient layer must still parse, every solid must parse, and nothing may print NaN / undefined. */
function assertValid(value: string, context: string) {
  expect(value, context).not.toMatch(/NaN|undefined|Infinity/);
  if (!value.trim()) return;
  if (isGradient(value)) {
    const layers = parseLayers(value);
    expect(layers.some((l) => l.kind === "gradient"), `${context}: gradient layer lost`).toBe(true);
  }
}

describe("fuzz: random edits never throw and always produce valid CSS", () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`seed ${seed}`, () => {
      const r = rng(seed);
      const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
      const start = pick(START);
      const picker = createPicker({ value: start, history: true });
      const log: string[] = [`start ${start}`];
      for (let step = 0; step < 120; step++) {
        const s = picker.getState();
        const op = Math.floor(r() * 16);
        const stop = s.stops.length ? pick(s.stops).id : null;
        switch (op) {
          case 0:
            picker.setHsva({ h: r() * 360, s: r(), v: r() });
            break;
          case 1:
            picker.setHsva({ a: Math.round(r() * 100) / 100 });
            break;
          case 2:
            picker.setMode(pick(MODES));
            break;
          case 3:
            picker.addStop(r());
            break;
          case 4:
            if (stop) picker.moveStop(stop, r() * 1.2 - 0.1);
            break;
          case 5:
            if (stop) picker.removeStop(stop);
            break;
          case 6:
            if (stop) picker.selectStop(stop);
            break;
          case 7:
            picker.setAngle(r() * 720 - 180);
            break;
          case 8:
            picker.setCenter(r() * 120 - 10, r() * 120 - 10);
            break;
          case 9:
            picker.setShape(r() < 0.5 ? "circle" : "ellipse");
            break;
          case 10:
            picker.setInterpolation(pick([null, "oklch", "oklch longer hue", "hsl", "srgb-linear"]));
            break;
          case 11:
            picker.reverse();
            break;
          case 12:
            picker.setCss(pick(CSS));
            break;
          case 13:
            picker.setColor({ space: "oklch", coords: [r(), r() * 0.4, r() * 360], alpha: 1 });
            break;
          case 14:
            picker.commit();
            if (r() < 0.5) picker.undo();
            else picker.redo();
            break;
          case 15:
            picker.setRepeating(r() < 0.5);
            break;
        }
        const v = picker.getState().value;
        log.push(`${op} -> ${v}`);
        assertValid(v, log.slice(-4).join("\n"));
        // the edited color is always a real color
        const c = picker.getState().color;
        expect(c.coords.every((x) => Number.isFinite(x) || Number.isNaN(x)), log.slice(-3).join("\n")).toBe(true);
        if (!isGradient(v) && v.trim() && picker.getState().parsed) expect(parseColor(v), `unparseable solid: ${v}`).not.toBeNull();
      }
    });
  }
});
