import { namedColorHex } from "./named";
import { convert, RGB_SPACES, type Color, type ColorSpace, type Coords } from "./spaces";
import { angleToDeg, num, parseDimension, parseFunction, splitTopLevel } from "./tokens";

/** Output formats. `color()` spaces use their CSS space name. */
export type ColorFormat =
  | "hex"
  | "rgb"
  | "hsl"
  | "hwb"
  | "lab"
  | "lch"
  | "oklab"
  | "oklch"
  | "srgb"
  | "srgb-linear"
  | "display-p3"
  | "a98-rgb"
  | "prophoto-rgb"
  | "rec2020"
  | "xyz-d65"
  | "xyz-d50";

/** How a color was written, so it can be written back the same way. */
export interface FormatStyle {
  /** comma syntax: `rgba(1, 2, 3, 0.5)` */
  legacy?: boolean;
  /** function name as written (`rgba`, `hsla`) */
  fn?: string;
  /** uppercase hex */
  upper?: boolean;
  /** lightness written as a percentage (lab, lch, oklab, oklch) */
  percentL?: boolean;
}

export interface ParsedColor {
  color: Color;
  format: ColorFormat;
  style: FormatStyle;
  /** set when the input was a keyword such as `red` or `transparent` */
  keyword?: string;
}

const COLOR_FUNCTIONS = new Set(["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color"]);

const COLOR_SPACES: Record<string, ColorSpace> = {
  srgb: "srgb",
  "srgb-linear": "srgb-linear",
  "display-p3": "display-p3",
  "a98-rgb": "a98-rgb",
  "prophoto-rgb": "prophoto-rgb",
  rec2020: "rec2020",
  xyz: "xyz-d65",
  "xyz-d65": "xyz-d65",
  "xyz-d50": "xyz-d50",
};

function parseHex(hex: string): Color | null {
  if (!/^[0-9a-f]+$/i.test(hex)) return null;
  let h = hex;
  if (h.length === 3 || h.length === 4) h = h.replace(/./g, (c) => c + c);
  if (h.length !== 6 && h.length !== 8) return null;
  const v = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { space: "srgb", coords: [v(0), v(2), v(4)], alpha: h.length === 8 ? v(6) : 1 };
}

/**
 * Parse one channel. `percent` is the value 100% maps to; `angle` parses hue units.
 * Returns undefined when the token is not valid for the channel.
 */
function channel(token: string, percent: number, angle = false): number | undefined {
  if (token.toLowerCase() === "none") return NaN;
  const d = parseDimension(token);
  if (!d) return undefined;
  if (angle) return angleToDeg(d, true) ?? undefined;
  if (d.unit === "%") return (d.value / 100) * percent;
  if (d.unit === "") return d.value;
  return undefined;
}

function alphaChannel(token: string | undefined): number | undefined {
  if (token === undefined) return 1;
  const v = channel(token, 1);
  if (v === undefined) return undefined;
  return Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v));
}

function parseColorFunction(name: string, args: string): ParsedColor | null {
  if (!COLOR_FUNCTIONS.has(name) || args === "") return null;
  // relative colors, var() and calc() are valid CSS but not something a picker can edit
  if (/^from\s/i.test(args) || /\b(var|calc|env|attr)\(/i.test(args)) return null;

  let parts: string[];
  let alphaToken: string | undefined;
  let legacy = false;
  if (args.includes(",")) {
    legacy = true;
    parts = splitTopLevel(args, ",");
    if (parts.length === 4) alphaToken = parts.pop();
  } else {
    const slash = splitTopLevel(args, "/");
    if (slash.length > 2) return null;
    alphaToken = slash[1];
    parts = splitTopLevel(slash[0], " ");
  }

  let space: ColorSpace;
  let coords: (number | undefined)[];
  const style: FormatStyle = { legacy, fn: name };
  let format: ColorFormat;

  switch (name) {
    case "rgb":
    case "rgba": {
      if (parts.length !== 3) return null;
      space = "srgb";
      format = "rgb";
      coords = parts.map((p) => {
        const v = channel(p, 255);
        return v === undefined ? undefined : v / 255;
      });
      break;
    }
    case "hsl":
    case "hsla":
    case "hwb": {
      if (parts.length !== 3) return null;
      space = name === "hwb" ? "hwb" : "hsl";
      format = space;
      coords = [channel(parts[0], 0, true), channel(parts[1], 100), channel(parts[2], 100)];
      break;
    }
    case "lab":
    case "oklab": {
      if (parts.length !== 3 || legacy) return null;
      const ok = name === "oklab";
      space = name;
      format = name;
      style.percentL = parts[0].endsWith("%");
      coords = [channel(parts[0], ok ? 1 : 100), channel(parts[1], ok ? 0.4 : 125), channel(parts[2], ok ? 0.4 : 125)];
      break;
    }
    case "lch":
    case "oklch": {
      if (parts.length !== 3 || legacy) return null;
      const ok = name === "oklch";
      space = name;
      format = name;
      style.percentL = parts[0].endsWith("%");
      coords = [channel(parts[0], ok ? 1 : 100), channel(parts[1], ok ? 0.4 : 150), channel(parts[2], 0, true)];
      break;
    }
    case "color": {
      if (legacy || parts.length !== 4) return null;
      const s = COLOR_SPACES[parts[0].toLowerCase()];
      if (!s) return null;
      space = s;
      format = s;
      coords = parts.slice(1).map((p) => channel(p, 1));
      break;
    }
    default:
      return null;
  }

  if (coords.some((c) => c === undefined)) return null;
  const alpha = alphaChannel(alphaToken);
  if (alpha === undefined) return null;
  return { color: { space, coords: coords as Coords, alpha }, format, style };
}

// Parsing the same strings over and over is the main per-frame cost (swatches, stops, contrast), so results
// are cached. Results are shared: treat them as read-only.
const parseCache = new Map<string, ParsedColor | null>();
const PARSE_CACHE_MAX = 1000;

/** Parse any CSS color. Returns null for values a picker cannot represent (var(), relative colors, garbage). */
export function parseColor(input: string): ParsedColor | null {
  if (typeof input !== "string" || input.length > MAX_COLOR_LENGTH) return null;
  const hit = parseCache.get(input);
  if (hit !== undefined) {
    // least recently used: move hits to the end, so hot values (stops, swatches) outlive one-off drag frames
    parseCache.delete(input);
    parseCache.set(input, hit);
    return hit;
  }
  const result = parseColorUncached(input);
  // long strings are rare and would only bloat the cache
  if (input.length <= 256) {
    if (parseCache.size >= PARSE_CACHE_MAX) parseCache.delete(parseCache.keys().next().value!);
    parseCache.set(input, result);
  }
  return result;
}

/** No real color is longer than this (`color(display-p3 ...)` with full precision is under 100). */
const MAX_COLOR_LENGTH = 512;

function parseColorUncached(input: string): ParsedColor | null {
  const value = input.trim();
  if (!value) return null;
  if (value[0] === "#") {
    const color = parseHex(value.slice(1));
    if (!color) return null;
    return { color, format: "hex", style: { upper: /[A-F]/.test(value) && !/[a-f]/.test(value) } };
  }
  const lower = value.toLowerCase();
  if (lower === "transparent") {
    return { color: { space: "srgb", coords: [0, 0, 0], alpha: 0 }, format: "hex", style: {}, keyword: lower };
  }
  const named = namedColorHex(lower);
  if (named) return { color: parseHex(named)!, format: "hex", style: {}, keyword: lower };
  const fn = parseFunction(value);
  return fn ? parseColorFunction(fn.name, fn.args) : null;
}

// --- gamut ---

const JND = 0.02;

function inUnitCube(c: Coords, eps = 1e-5): boolean {
  return c.every((v) => v >= -eps && v <= 1 + eps);
}

/** True when the color fits in an RGB space (sRGB by default). */
export function inGamut(color: Color, space: ColorSpace = "srgb"): boolean {
  return inUnitCube(convert(color, space).coords);
}

const clip = (c: Color): Color => ({
  ...c,
  coords: c.coords.map((v) => Math.min(1, Math.max(0, Number.isNaN(v) ? 0 : v))) as Coords,
});

function deltaEOK(a: Color, b: Color): number {
  const x = convert(a, "oklab").coords;
  const y = convert(b, "oklab").coords;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const gamutCache = new WeakMap<Color, Map<ColorSpace, Color>>();

/** CSS Color 4 gamut mapping: lower OKLCH chroma until the color fits, then clip. Returns the color in `space`. */
export function toGamut(color: Color, space: ColorSpace = "srgb"): Color {
  // several parts map the same color object in one frame (area label, badge, inputs); map it once
  let bySpace = gamutCache.get(color);
  const hit = bySpace?.get(space);
  if (hit) return hit;
  const mapped = toGamutUncached(color, space);
  if (!bySpace) gamutCache.set(color, (bySpace = new Map()));
  bySpace.set(space, mapped);
  return mapped;
}

function toGamutUncached(color: Color, space: ColorSpace): Color {
  const direct = convert(color, space);
  if (inUnitCube(direct.coords)) return clip(direct);
  const origin = convert(color, "oklch");
  const [l, c, h] = origin.coords;
  if (l >= 1) return { space, coords: [1, 1, 1], alpha: color.alpha };
  if (l <= 0) return { space, coords: [0, 0, 0], alpha: color.alpha };
  let min = 0;
  let max = c;
  let minInGamut = true;
  let current: Color = { ...origin, coords: [l, c, h] };
  let clipped = clip(convert(current, space));
  if (deltaEOK(clipped, current) < JND) return clipped;
  while (max - min > 1e-4) {
    const chroma = (min + max) / 2;
    current = { ...origin, coords: [l, chroma, h] };
    if (minInGamut && inGamut(current, space)) {
      min = chroma;
      continue;
    }
    clipped = clip(convert(current, space));
    const e = deltaEOK(clipped, current);
    if (e < JND) {
      if (JND - e < 1e-4) return clipped;
      minInGamut = false;
      min = chroma;
    } else {
      max = chroma;
    }
  }
  return clipped;
}

// --- formatting ---

const hex2 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");

function alphaPart(alpha: number, legacy: boolean): string {
  if (alpha >= 1) return "";
  return legacy ? `, ${num(alpha, 3)}` : ` / ${num(alpha, 3)}`;
}

/** Write a color in a format. sRGB formats (hex, rgb, hsl, hwb) are gamut mapped first. */
export function formatColor(color: Color, format: ColorFormat, style: FormatStyle = {}): string {
  const a = Math.min(1, Math.max(0, color.alpha));
  switch (format) {
    case "hex": {
      const [r, g, b] = toGamut(color, "srgb").coords;
      const out = `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(a) : ""}`;
      return style.upper ? out.toUpperCase() : out;
    }
    case "rgb": {
      const [r, g, b] = toGamut(color, "srgb").coords.map((v) => Math.round(v * 255));
      const legacy = style.legacy ?? true;
      if (legacy) {
        const fn = a < 1 ? "rgba" : style.fn === "rgba" ? "rgba" : "rgb";
        return `${fn}(${r}, ${g}, ${b}${fn === "rgba" ? `, ${num(a, 3)}` : ""})`;
      }
      return `rgb(${r} ${g} ${b}${alphaPart(a, false)})`;
    }
    case "hsl":
    case "hwb": {
      const srgb = toGamut(color, "srgb");
      const [h, x, y] = convert(srgb, format).coords;
      const legacy = format === "hsl" && (style.legacy ?? true);
      const hue = num(Number.isNaN(h) ? 0 : h, 1);
      if (legacy) {
        const fn = a < 1 ? "hsla" : style.fn === "hsla" ? "hsla" : "hsl";
        return `${fn}(${hue}, ${num(x, 1)}%, ${num(y, 1)}%${fn === "hsla" ? `, ${num(a, 3)}` : ""})`;
      }
      return `${format}(${hue} ${num(x, 1)}% ${num(y, 1)}%${alphaPart(a, false)})`;
    }
    case "lab":
    case "oklab": {
      const [l, x, y] = convert(color, format).coords;
      const ok = format === "oklab";
      const L = style.percentL ? `${num(ok ? l * 100 : l, 2)}%` : num(l, ok ? 4 : 2);
      return `${format}(${L} ${num(x, ok ? 4 : 2)} ${num(y, ok ? 4 : 2)}${alphaPart(a, false)})`;
    }
    case "lch":
    case "oklch": {
      const [l, c, h] = convert(color, format).coords;
      const ok = format === "oklch";
      const L = style.percentL ? `${num(ok ? l * 100 : l, 2)}%` : num(l, ok ? 4 : 2);
      return `${format}(${L} ${num(c, ok ? 4 : 2)} ${num(Number.isNaN(h) ? 0 : h, 2)}${alphaPart(a, false)})`;
    }
    default: {
      const target = format as ColorSpace;
      const coords = convert(color, target).coords.map((v) => num(v, 5));
      const name = target === "xyz-d65" ? "xyz-d65" : target;
      return `color(${name} ${coords.join(" ")}${alphaPart(a, false)})`;
    }
  }
}

/** Short hex for UI fields (no `#`, uppercase, alpha dropped). */
export function toHexDigits(color: Color): string {
  const [r, g, b] = toGamut(color, "srgb").coords;
  return `${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();
}

/** sRGB coords clamped to 0..1 (gamut mapped). */
export function toSrgb(color: Color): Coords {
  return toGamut(color, "srgb").coords;
}

export const isRgbSpace = (space: ColorSpace) => RGB_SPACES.has(space);

/** Canonical key for comparing colors regardless of how they are written. */
export function colorKey(input: string): string {
  const p = parseColor(input);
  if (!p) return typeof input === "string" ? input.trim().toLowerCase() : "";
  const [r, g, b] = convert(p.color, "srgb").coords;
  return `${num(r, 4)},${num(g, 4)},${num(b, 4)},${num(p.color.alpha, 3)}`;
}
