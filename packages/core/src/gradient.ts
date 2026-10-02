import { isSafeCssValue, MAX_CSS_LENGTH } from "./safe";
import { formatColor, parseColor } from "./color";
import { convert, type Color, type ColorSpace, type Coords } from "./spaces";
import { angleToDeg, degToUnit, isAngleUnit, num, parseDimension, parseFunction, splitTopLevel } from "./tokens";

export type GradientType = "linear" | "radial" | "conic";

/** A length, percentage or angle exactly as written. `value` is NaN when it is not a plain dimension (calc(), var()). */
export interface Position {
  value: number;
  unit: string;
  raw: string;
}

export interface GradientStop {
  kind: "stop";
  id: string;
  /** the color as written */
  color: string;
  /** 0, 1 or 2 positions */
  positions: Position[];
}

export interface GradientHint {
  kind: "hint";
  position: Position;
}

export type GradientItem = GradientStop | GradientHint;

export interface Gradient {
  type: GradientType;
  repeating: boolean;
  /** vendor prefix such as `-webkit-` */
  prefix: string;
  /** linear angle, or conic `from` angle. Unit is kept so `0.25turn` stays in turns. */
  angle: { deg: number; unit: string } | null;
  /** linear `to <side>` keywords, without `to` */
  sides: string | null;
  shape: "circle" | "ellipse" | null;
  /** radial size as written (`closest-side`, `120px 80px`) */
  size: string | null;
  /** position after `at` as written */
  position: string | null;
  /** color interpolation after `in` (`oklch`, `oklch longer hue`) */
  interpolation: string | null;
  /** prelude tokens we do not understand, kept verbatim */
  extra: string | null;
  /** original prelude text; cleared when the prelude is edited so it gets rebuilt */
  preludeRaw: string | null;
  items: GradientItem[];
}

export type Layer = { kind: "gradient"; gradient: Gradient; raw: string } | { kind: "raw"; raw: string };

const GRADIENT_FN = /^(-(?:webkit|moz|o|ms)-)?(repeating-)?(linear|radial|conic)-gradient$/;
const SIDES = new Set(["left", "right", "top", "bottom"]);
const SHAPES = new Set(["circle", "ellipse"]);
const EXTENTS = new Set(["closest-side", "closest-corner", "farthest-side", "farthest-corner"]);
const HUE_METHODS = new Set(["shorter", "longer", "increasing", "decreasing"]);

// Stop ids are numbered per gradient (s1, s2, ...), never from a global counter: a picker rendered on the server
// and hydrated in the browser must give every stop the same id on both sides.
function nextStopId(g: Gradient): string {
  const used = new Set(getStops(g).map((s) => s.id));
  let n = used.size + 1;
  while (used.has(`s${n}`)) n++;
  return `s${n}`;
}

export function isGradient(value: string): boolean {
  return typeof value === "string" && /(?:^|[\s,(])(?:-(?:webkit|moz|o|ms)-)?(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(value);
}

function toPosition(token: string): Position {
  const d = parseDimension(token);
  return d ? { value: d.value, unit: d.unit, raw: token } : { value: NaN, unit: "", raw: token };
}

export function makePosition(value: number, unit: string): Position {
  return { value, unit, raw: `${num(value, 2)}${unit}` };
}

/**
 * A stop color: any color the picker reads, `currentcolor`, or a plain `var()`, `color-mix()` or `light-dark()`
 * (kept as written). Anything else makes the gradient unreadable, so foreign text is never passed through.
 */
function looksLikeColor(token: string): boolean {
  if (parseColor(token) !== null || /^currentcolor$/i.test(token)) return true;
  return /^(?:var|color-mix|light-dark)\(/i.test(token) && isSafeCssValue(token);
}

/** A stop or hint position: a number with a unit, or a plain calc() / min() / max() / clamp(). */
function isPositionToken(token: string): boolean {
  return parseDimension(token) !== null || (/^(?:calc|min|max|clamp)\(/i.test(token) && isSafeCssValue(token));
}

const POSITION_KEYWORDS = new Set(["left", "right", "top", "bottom", "center"]);

function takeInterpolation(tokens: string[], i: number): [string, number] {
  // `in <space> [<hue-method> hue]`
  const out = [tokens[i + 1] ?? ""];
  let j = i + 2;
  if (HUE_METHODS.has(tokens[j]?.toLowerCase()) && tokens[j + 1]?.toLowerCase() === "hue") {
    out.push(tokens[j], tokens[j + 1]);
    j += 2;
  }
  return [out.join(" ").trim(), j];
}

/** Read the part before the first stop. False when it holds anything a gradient prelude cannot. */
function parsePrelude(g: Gradient, text: string): boolean {
  const tokens = splitTopLevel(text, " ");
  const extra: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const lower = t.toLowerCase();
    if (lower === "in") {
      const [interp, next] = takeInterpolation(tokens, i);
      if (!INTERPOLATION_SPACES[interp.split(" ")[0]?.toLowerCase()]) return false;
      g.interpolation = interp;
      i = next;
      continue;
    }
    if (lower === "at" && g.type !== "linear") {
      const pos: string[] = [];
      i++;
      while (i < tokens.length && tokens[i].toLowerCase() !== "in") {
        const p = tokens[i++];
        if (!POSITION_KEYWORDS.has(p.toLowerCase()) && !isPositionToken(p)) return false;
        pos.push(p);
      }
      if (!pos.length) return false;
      g.position = pos.join(" ");
      continue;
    }
    if (g.type === "linear") {
      // legacy prefixed syntax names the starting side without "to" (-webkit-linear-gradient(top, ...))
      if (g.prefix && SIDES.has(lower)) {
        const OPPOSITE: Record<string, string> = { top: "bottom", bottom: "top", left: "right", right: "left" };
        const sides: string[] = [];
        while (i < tokens.length && SIDES.has(tokens[i].toLowerCase())) sides.push(OPPOSITE[tokens[i++].toLowerCase()]);
        g.sides = sides.join(" ");
        continue;
      }
      if (lower === "to") {
        const sides: string[] = [];
        i++;
        while (i < tokens.length && SIDES.has(tokens[i].toLowerCase())) sides.push(tokens[i++].toLowerCase());
        g.sides = sides.join(" ");
        continue;
      }
      const d = parseDimension(t);
      const deg = d ? angleToDeg(d) : null;
      if (d && deg !== null) {
        g.angle = { deg, unit: d.unit || "deg" };
        i++;
        continue;
      }
    } else if (g.type === "conic") {
      if (lower === "from") {
        const d = parseDimension(tokens[i + 1] ?? "");
        const deg = d ? angleToDeg(d) : null;
        if (d && deg !== null) {
          g.angle = { deg, unit: d.unit || "deg" };
          i += 2;
          continue;
        }
      }
    } else {
      if (SHAPES.has(lower)) {
        g.shape = lower as "circle" | "ellipse";
        i++;
        continue;
      }
      if (EXTENTS.has(lower) || parseDimension(t)) {
        const size: string[] = [];
        while (i < tokens.length && (EXTENTS.has(tokens[i].toLowerCase()) || parseDimension(tokens[i]))) size.push(tokens[i++]);
        g.size = size.join(" ");
        continue;
      }
    }
    extra.push(t);
    i++;
  }
  // unknown text before the first stop would otherwise be passed through as-is
  if (extra.length) return false;
  g.extra = null;
  return true;
}

function parseItem(arg: string, id: string): GradientItem | null {
  const tokens = splitTopLevel(arg, " ");
  if (tokens.length === 0) return null;
  if (tokens.length === 1 && !looksLikeColor(tokens[0]) && isPositionToken(tokens[0])) {
    return { kind: "hint", position: toPosition(tokens[0]) };
  }
  // CSS allows the position before the color too (`50% red`)
  let color = tokens[0];
  let rest = tokens.slice(1);
  if (!looksLikeColor(color) && tokens.length > 1 && looksLikeColor(tokens[tokens.length - 1])) {
    color = tokens[tokens.length - 1];
    rest = tokens.slice(0, -1);
  }
  if (rest.length > 2 || !looksLikeColor(color) || !rest.every(isPositionToken)) return null;
  return { kind: "stop", id, color, positions: rest.map(toPosition) };
}

/** Parse one gradient function. Never throws; returns null if the text is not a gradient we can edit. */
export function parseGradient(input: string): Gradient | null {
  if (typeof input !== "string" || input.length > MAX_CSS_LENGTH) return null;
  const fn = parseFunction(input.trim());
  if (!fn) return null;
  const m = GRADIENT_FN.exec(fn.name);
  if (!m) return null;
  const g: Gradient = {
    type: m[3] as GradientType,
    repeating: Boolean(m[2]),
    prefix: m[1] ?? "",
    angle: null,
    sides: null,
    shape: null,
    size: null,
    position: null,
    interpolation: null,
    extra: null,
    preludeRaw: null,
    items: [],
  };
  const args = splitTopLevel(fn.args, ",");
  if (args.length === 0 || args.some((a) => a === "")) return null;
  const firstTokens = splitTopLevel(args[0], " ");
  const first = firstTokens[0] ?? "";
  const isStop = looksLikeColor(first) || (firstTokens.length > 1 && looksLikeColor(firstTokens[firstTokens.length - 1]));
  if (!isStop) {
    if (!parsePrelude(g, args[0])) return null;
    g.preludeRaw = args[0];
    args.shift();
  }
  let stopCount = 0;
  for (const arg of args) {
    const item = parseItem(arg, `s${stopCount + 1}`);
    if (item?.kind === "stop") stopCount++;
    if (!item) return null;
    g.items.push(item);
  }
  if (getStops(g).length < 1) return null;
  return g;
}

function buildPrelude(g: Gradient): string {
  const parts: string[] = [];
  if (g.type === "linear") {
    if (g.angle) parts.push(`${num(degToUnit(g.angle.deg, g.angle.unit), 4)}${g.angle.unit}`);
    else if (g.sides) parts.push(`to ${g.sides}`);
  } else if (g.type === "radial") {
    if (g.shape) parts.push(g.shape);
    if (g.size) parts.push(g.size);
    if (g.position) parts.push(`at ${g.position}`);
  } else {
    if (g.angle) parts.push(`from ${num(degToUnit(g.angle.deg, g.angle.unit), 4)}${g.angle.unit}`);
    if (g.position) parts.push(`at ${g.position}`);
  }
  if (g.interpolation) parts.push(`in ${g.interpolation}`);
  if (g.extra) parts.push(g.extra);
  return parts.join(" ");
}

export function serializeGradient(g: Gradient): string {
  const name = `${g.prefix}${g.repeating ? "repeating-" : ""}${g.type}-gradient`;
  const prelude = g.preludeRaw ?? buildPrelude(g);
  const items = g.items.map((it) =>
    it.kind === "hint" ? it.position.raw : [it.color, ...it.positions.map((p) => p.raw)].join(" "),
  );
  return `${name}(${[prelude, ...items].filter(Boolean).join(", ")})`;
}

/** Split a background value into layers. Gradient layers are parsed, anything else is kept as raw text. */
export function parseLayers(value: string): Layer[] {
  if (typeof value !== "string" || value.length > MAX_CSS_LENGTH) return [{ kind: "raw", raw: "" }];
  // splitTopLevel respects parentheses, so each part is one layer
  return splitTopLevel(value, ",").map((raw) => {
    const gradient = isGradient(raw) ? parseGradient(raw) : null;
    return gradient ? { kind: "gradient" as const, gradient, raw } : { kind: "raw" as const, raw };
  });
}

export function serializeLayers(layers: Layer[]): string {
  return layers.map((l) => (l.kind === "gradient" ? serializeGradient(l.gradient) : l.raw)).join(", ");
}

// --- reading ---

export const getStops = (g: Gradient): GradientStop[] => g.items.filter((i): i is GradientStop => i.kind === "stop");

/** Offset of a position on the 0..1 gradient line, or null when unknown (px, calc). */
function positionOffset(p: Position | undefined, type: GradientType): number | null {
  if (!p || Number.isNaN(p.value)) return null;
  if (p.unit === "%") return p.value / 100;
  if (type === "conic" && isAngleUnit(p.unit)) return (angleToDeg({ value: p.value, unit: p.unit }) ?? 0) / 360;
  if (p.value === 0 && p.unit === "") return 0;
  return null;
}

/** Display offsets (0..1) for each stop, using the CSS color stop fixup rules for missing positions. */
export function stopOffsets(g: Gradient): number[] {
  const stops = getStops(g);
  const raw = stops.map((s) => positionOffset(s.positions[0], g.type));
  if (raw[0] === null) raw[0] = 0;
  if (raw[raw.length - 1] === null) raw[raw.length - 1] = raw.length === 1 ? 0 : 1;
  let max = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== null) {
      raw[i] = Math.max(raw[i]!, max);
      max = raw[i]!;
    }
  }
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== null) continue;
    let j = i;
    while (raw[j] === null) j++;
    const start = raw[i - 1]!;
    const end = raw[j]!;
    for (let k = i; k < j; k++) raw[k] = start + ((end - start) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  return raw as number[];
}

const SIDE_DEG: Record<string, number> = {
  top: 0,
  "top right": 45,
  right: 90,
  "bottom right": 135,
  bottom: 180,
  "bottom left": 225,
  left: 270,
  "top left": 315,
};

/** Effective angle in degrees: linear direction or conic start. */
export function gradientAngle(g: Gradient): number {
  if (g.angle) return g.angle.deg;
  if (g.type === "linear" && g.sides) {
    const key = g.sides.split(" ").sort((a, b) => (a === "top" || a === "bottom" ? -1 : b === "top" || b === "bottom" ? 1 : 0)).join(" ");
    return SIDE_DEG[key] ?? 180;
  }
  return g.type === "linear" ? 180 : 0;
}

/** `at` position as percentages, or null when it uses units the UI cannot map (px, 4-value syntax). */
export function gradientCenter(g: Gradient): { x: number; y: number } | null {
  if (!g.position) return { x: 50, y: 50 };
  const kw: Record<string, number> = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
  const tokens = g.position.toLowerCase().split(/\s+/);
  if (tokens.length > 2) return null;
  const val = (t: string) => (t in kw ? kw[t] : t.endsWith("%") ? parseFloat(t) : NaN);
  if (tokens.length === 1) {
    const t = tokens[0];
    if (t === "top" || t === "bottom") return { x: 50, y: kw[t] };
    const v = val(t);
    return Number.isNaN(v) ? null : { x: v, y: 50 };
  }
  let [a, b] = tokens;
  if (a === "top" || a === "bottom" || b === "left" || b === "right") [a, b] = [b, a];
  const x = val(a);
  const y = val(b);
  return Number.isNaN(x) || Number.isNaN(y) ? null : { x, y };
}

// --- editing (all return a new gradient) ---

const clone = (g: Gradient): Gradient => ({ ...g, items: g.items.slice() });

/** Give implicit stops explicit percentages so moving one stop does not shift the others. */
export function materializePositions(g: Gradient): Gradient {
  const offsets = stopOffsets(g);
  let i = 0;
  const items = g.items.map((it) => {
    if (it.kind !== "stop") return it;
    const off = offsets[i++];
    return it.positions.length === 0 ? { ...it, positions: [makePosition(off * 100, "%")] } : it;
  });
  return { ...g, items };
}

export function setStopColor(g: Gradient, id: string, color: string): Gradient {
  const out = clone(g);
  out.items = out.items.map((it) => (it.kind === "stop" && it.id === id ? { ...it, color } : it));
  return out;
}

/** Move a stop to t (0..1) and keep stops ordered. Hints are dropped if the order changes. */
export function setStopOffset(g: Gradient, id: string, t: number): Gradient {
  const out = materializePositions(g);
  const before = stopOffsets(out)[getStops(out).findIndex((s) => s.id === id)] ?? 0;
  const pct = Math.min(100, Math.max(0, t * 100));
  out.items = out.items.map((it) => (it.kind === "stop" && it.id === id ? { ...it, positions: [makePosition(pct, "%")] } : it));
  return sortStops(out, id, pct / 100 >= before ? 1 : -1);
}

/** Order stops by offset. A stop that lands on the same offset as others goes past them in the direction it moved. */
function sortStops(g: Gradient, movedId?: string, direction: 1 | -1 = 1): Gradient {
  const stops = getStops(g);
  // use written positions, not the clamped display offsets, so a stop dragged past another sorts after it
  const fixed = stopOffsets(g);
  const offsets = stops.map((s, i) => positionOffset(s.positions[0], g.type) ?? fixed[i]);
  const tie = (s: GradientStop, i: number) => (s.id === movedId ? i + direction * stops.length : i);
  const order = stops.map((s, i) => ({ s, o: offsets[i], i, k: tie(s, i) })).sort((a, b) => a.o - b.o || a.k - b.k);
  if (order.every((x, i) => x.i === i)) return g;
  return { ...g, items: order.map((x) => x.s) };
}

const INTERPOLATION_SPACES: Record<string, ColorSpace> = {
  srgb: "srgb",
  "srgb-linear": "srgb-linear",
  "display-p3": "display-p3",
  "a98-rgb": "a98-rgb",
  "prophoto-rgb": "prophoto-rgb",
  rec2020: "rec2020",
  lab: "lab",
  oklab: "oklab",
  xyz: "xyz-d65",
  "xyz-d65": "xyz-d65",
  "xyz-d50": "xyz-d50",
  hsl: "hsl",
  hwb: "hwb",
  lch: "lch",
  oklch: "oklch",
};
const POLAR: Partial<Record<ColorSpace, number>> = { hsl: 0, hwb: 0, lch: 2, oklch: 2 };
const LEGACY_FORMATS = new Set(["hex", "rgb", "hsl", "hwb"]);

/**
 * The space a browser blends this gradient in: the `in <space>` hint, else sRGB when every stop is a
 * legacy color (hex, rgb, hsl, names), else OKLab. This is the CSS Color 4 rule.
 */
export function interpolationSpace(g: Gradient): { space: ColorSpace; hue: string } {
  const [name, method] = (g.interpolation ?? "").toLowerCase().split(/\s+/);
  if (name && INTERPOLATION_SPACES[name]) return { space: INTERPOLATION_SPACES[name], hue: method || "shorter" };
  const legacy = getStops(g).every((s) => {
    const p = parseColor(s.color);
    return !p || LEGACY_FORMATS.has(p.format);
  });
  return { space: legacy ? "srgb" : "oklab", hue: "shorter" };
}

function mixHue(a: number, b: number, f: number, method: string): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  let d = b - a;
  if (method === "longer") {
    if (d > 0 && d < 180) d -= 360;
    else if (d > -180 && d <= 0) d += 360;
  } else if (method === "increasing") {
    if (d < 0) d += 360;
  } else if (method === "decreasing") {
    if (d > 0) d -= 360;
  } else if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return (((a + d * f) % 360) + 360) % 360;
}

/** Color at t (0..1) exactly as the browser draws it: same space, hue method and premultiplied alpha. */
export function colorAt(g: Gradient, t: number): Color | null {
  const stops = getStops(g);
  const offsets = stopOffsets(g);
  let i = offsets.findIndex((o) => o >= t);
  if (i === -1) i = stops.length - 1;
  const right = parseColor(stops[i].color);
  const left = i > 0 ? parseColor(stops[i - 1].color) : right;
  if (!left || !right) return (left ?? right)?.color ?? null;
  const span = i > 0 ? offsets[i] - offsets[i - 1] : 0;
  const f = span > 0 ? Math.min(1, Math.max(0, (t - offsets[i - 1]) / span)) : 0;
  const { space, hue } = interpolationSpace(g);
  const a = convert(left.color, space);
  const b = convert(right.color, space);
  const hueIndex = POLAR[space];
  const alpha = a.alpha + (b.alpha - a.alpha) * f;
  const coords = [0, 1, 2].map((k) => {
    if (k === hueIndex) return mixHue(a.coords[k], b.coords[k], f, hue);
    // premultiplied, like CSS, so a fade to transparent does not pass through grey
    const av = (Number.isNaN(a.coords[k]) ? b.coords[k] : a.coords[k]) * a.alpha;
    const bv = (Number.isNaN(b.coords[k]) ? a.coords[k] : b.coords[k]) * b.alpha;
    const v = av + (bv - av) * f;
    return alpha > 0 ? v / alpha : v;
  }) as Coords;
  return { space, coords, alpha };
}

/**
 * `write` formats the new stop's color (the picker passes its output format); without it a given color is kept
 * as written and a sampled one copies a neighbouring stop's format.
 */
export function addStop(
  g: Gradient,
  t: number,
  color?: string,
  write?: (color: Color) => string,
): { gradient: Gradient; id: string } {
  const base = materializePositions(g);
  // only real colors become stops (drops can carry any text); otherwise take the color at that point
  const given = color ? parseColor(color) : null;
  let css = given ? (write ? write(given.color) : color) : undefined;
  if (!css) {
    const c = colorAt(base, t);
    if (!c) css = "#000000";
    else if (write) css = write(c);
    else {
      const neighbour = getStops(base).find((s) => parseColor(s.color));
      const fmt = neighbour ? parseColor(neighbour.color)! : null;
      css = formatColor(c, fmt?.keyword ? "hex" : fmt?.format ?? "hex", fmt?.style);
    }
  }
  const id = nextStopId(base);
  const stop: GradientStop = { kind: "stop", id, color: css, positions: [makePosition(t * 100, "%")] };
  const offsets = stopOffsets(base);
  const stops = getStops(base);
  const before = offsets.findIndex((o) => o > t);
  const anchor = before === -1 ? null : stops[before];
  const items = base.items.slice();
  const index = anchor ? items.indexOf(anchor) : items.length;
  // a hint directly before the anchor belongs to the gap we are splitting, drop it
  if (anchor && items[index - 1]?.kind === "hint") items.splice(index - 1, 1, stop);
  else items.splice(index, 0, stop);
  return { gradient: { ...base, items }, id };
}

export function removeStop(g: Gradient, id: string): Gradient {
  if (getStops(g).length <= 2) return g;
  const out = materializePositions(g);
  const items = out.items.filter((it) => !(it.kind === "stop" && it.id === id));
  // no hint may sit at either end or next to another hint
  const cleaned = items.filter((it, i) => {
    if (it.kind !== "hint") return true;
    return i > 0 && i < items.length - 1 && items[i - 1].kind === "stop" && items[i + 1]?.kind === "stop";
  });
  return { ...out, items: cleaned };
}

export function reverseStops(g: Gradient): Gradient {
  const out = materializePositions(g);
  const items = out.items
    .slice()
    .reverse()
    .map((it) => {
      const flip = (p: Position): Position =>
        p.unit === "%" ? makePosition(100 - p.value, "%") : p;
      return it.kind === "hint" ? { ...it, position: flip(it.position) } : { ...it, positions: it.positions.map(flip).reverse() };
    });
  return { ...out, items };
}

export function setGradientType(g: Gradient, type: GradientType): Gradient {
  if (g.type === type) return g;
  const angle = gradientAngle(g);
  const out: Gradient = { ...clone(g), type, preludeRaw: null, extra: null, sides: null, size: null, shape: null };
  if (type === "linear") {
    out.position = null;
    out.angle = { deg: g.type === "conic" ? angle : g.angle?.deg ?? 90, unit: "deg" };
    if (g.type === "radial") out.angle = { deg: 90, unit: "deg" };
  } else if (type === "radial") {
    out.angle = null;
    out.shape = "circle";
  } else {
    out.angle = { deg: g.type === "linear" ? angle : 0, unit: "deg" };
  }
  // conic positions are angles or percentages, linear/radial use lengths: keep only percentages
  out.items = out.items
    .map((it) => {
      if (it.kind === "hint") return it.position.unit === "%" ? it : null;
      return { ...it, positions: it.positions.filter((p) => p.unit === "%") };
    })
    .filter(Boolean) as GradientItem[];
  return out;
}

export function setGradientAngle(g: Gradient, deg: number): Gradient {
  const normalized = ((deg % 360) + 360) % 360;
  return {
    ...g,
    angle: { deg: normalized, unit: g.angle?.unit ?? "deg" },
    sides: null,
    // unknown linear prelude tokens are legacy side keywords (`-webkit-linear-gradient(top, ...)`), which an angle replaces
    extra: g.type === "linear" ? null : g.extra,
    preludeRaw: null,
  };
}

export function setGradientShape(g: Gradient, shape: "circle" | "ellipse"): Gradient {
  // two-value sizes are only valid for ellipses
  const size = shape === "circle" && g.size && g.size.split(/\s+/).length > 1 ? null : g.size;
  return { ...g, shape, size, preludeRaw: null };
}

export function setGradientSize(g: Gradient, size: string | null): Gradient {
  return { ...g, size, preludeRaw: null };
}

export function setGradientCenter(g: Gradient, x: number, y: number): Gradient {
  const cx = Math.round(Math.min(100, Math.max(0, x)) * 10) / 10;
  const cy = Math.round(Math.min(100, Math.max(0, y)) * 10) / 10;
  const position = cx === 50 && cy === 50 && !g.position ? null : `${num(cx, 1)}% ${num(cy, 1)}%`;
  return { ...g, position, preludeRaw: null };
}

export function setGradientInterpolation(g: Gradient, interpolation: string | null): Gradient {
  return { ...g, interpolation, preludeRaw: null };
}

export function setGradientRepeating(g: Gradient, repeating: boolean): Gradient {
  return { ...g, repeating };
}

/** The colors before the first stop and after the last one (stop offsets never decrease, so these are the list ends). */
export function stopsEnds(g: Gradient): [string, string] {
  const stops = getStops(g);
  const css = (c: string | undefined) => (c && parseColor(c) ? c : "transparent");
  return [css(stops[0]?.color), css(stops[stops.length - 1]?.color)];
}

/** A gradient that only lists the stops as `linear-gradient(90deg, ...)`, for previews such as the stop bar. */
export function stopsPreview(g: Gradient): string {
  const stops = getStops(g);
  const offsets = stopOffsets(g);
  const parts = stops.map((s, i) => `${parseColor(s.color) ? s.color : "transparent"} ${num(offsets[i] * 100, 2)}%`);
  if (parts.length === 1) parts.push(parts[0]);
  return `linear-gradient(90deg${g.interpolation ? ` in ${g.interpolation}` : ""}, ${parts.join(", ")})`;
}
