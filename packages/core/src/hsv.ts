import type { Coords } from "./spaces";

/** h 0..360 (NaN when achromatic), s, v and a 0..1 */
export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

export function rgbToHsv([r, g, b]: Coords): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = NaN;
  if (d > 1e-9) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

export function hsvToRgb(h: number, s: number, v: number): Coords {
  const hh = ((((Number.isNaN(h) ? 0 : h) % 360) + 360) % 360) / 60;
  const f = (k: number) => {
    const t = (k + hh) % 6;
    return v - v * s * Math.max(0, Math.min(t, 4 - t, 1));
  };
  return [f(5), f(3), f(1)];
}
