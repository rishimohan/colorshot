// Color spaces and conversions from CSS Color Module Level 4.
// Every space converts through CIE XYZ (D65). Matrices are the ones published in the spec's sample code
// (https://www.w3.org/TR/css-color-4/#color-conversion-code), under the W3C Software and Document License:
// see THIRD-PARTY-NOTICES.md.

export type ColorSpace =
  | "srgb"
  | "srgb-linear"
  | "display-p3"
  | "a98-rgb"
  | "prophoto-rgb"
  | "rec2020"
  | "xyz-d65"
  | "xyz-d50"
  | "hsl"
  | "hwb"
  | "lab"
  | "lch"
  | "oklab"
  | "oklch";

export type Coords = [number, number, number];

export interface Color {
  space: ColorSpace;
  /** Channel values in the space's CSS reference range (rgb 0..1, hsl s/l 0..100, lab L 0..100, oklab L 0..1). NaN means `none`. */
  coords: Coords;
  /** 0..1 */
  alpha: number;
}

type Matrix = readonly [Coords, Coords, Coords];

const mul = (m: Matrix, v: Coords): Coords => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

const n = (v: number) => (Number.isNaN(v) ? 0 : v);
const nn = (c: Coords): Coords => [n(c[0]), n(c[1]), n(c[2])];

// --- transfer functions ---

const srgbToLinear = (c: Coords): Coords =>
  c.map((v) => {
    const abs = Math.abs(v);
    return abs <= 0.04045 ? v / 12.92 : Math.sign(v) * ((abs + 0.055) / 1.055) ** 2.4;
  }) as Coords;

const linearToSrgb = (c: Coords): Coords =>
  c.map((v) => {
    const abs = Math.abs(v);
    return abs > 0.0031308 ? Math.sign(v) * (1.055 * abs ** (1 / 2.4) - 0.055) : 12.92 * v;
  }) as Coords;

const a98ToLinear = (c: Coords): Coords => c.map((v) => Math.sign(v) * Math.abs(v) ** (563 / 256)) as Coords;
const linearToA98 = (c: Coords): Coords => c.map((v) => Math.sign(v) * Math.abs(v) ** (256 / 563)) as Coords;

const prophotoToLinear = (c: Coords): Coords =>
  c.map((v) => {
    const abs = Math.abs(v);
    return abs <= 16 / 512 ? v / 16 : Math.sign(v) * abs ** 1.8;
  }) as Coords;
const linearToProphoto = (c: Coords): Coords =>
  c.map((v) => {
    const abs = Math.abs(v);
    return abs >= 1 / 512 ? Math.sign(v) * abs ** (1 / 1.8) : 16 * v;
  }) as Coords;

const REC_A = 1.09929682680944;
const REC_B = 0.018053968510807;
const rec2020ToLinear = (c: Coords): Coords =>
  c.map((v) => {
    const abs = Math.abs(v);
    return abs < REC_B * 4.5 ? v / 4.5 : Math.sign(v) * ((abs + REC_A - 1) / REC_A) ** (1 / 0.45);
  }) as Coords;
const linearToRec2020 = (c: Coords): Coords =>
  c.map((v) => {
    const abs = Math.abs(v);
    return abs > REC_B ? Math.sign(v) * (REC_A * abs ** 0.45 - (REC_A - 1)) : 4.5 * v;
  }) as Coords;

// --- matrices ---
// Each RGB space, D65/D50 and LMS keeps one direction as published; the other direction is its inverse,
// computed once at load (every entry within 1e-15 of the published value). The two OKLab matrices are both
// kept: the published pair is not an exact inverse (they differ by about 1e-10).

const invert = (m: Matrix): Matrix => {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const x = e * i - f * h;
  const y = f * g - d * i;
  const z = d * h - e * g;
  const det = a * x + b * y + c * z;
  return [
    [x / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [y / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [z / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
};

const LIN_SRGB_TO_XYZ: Matrix = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];
const XYZ_TO_LIN_SRGB = /* @__PURE__ */ invert(LIN_SRGB_TO_XYZ);
const LIN_P3_TO_XYZ: Matrix = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0, 32229 / 714400, 5220557 / 5000800],
];
const XYZ_TO_LIN_P3 = /* @__PURE__ */ invert(LIN_P3_TO_XYZ);
const LIN_A98_TO_XYZ: Matrix = [
  [573536 / 994567, 263643 / 1420810, 187206 / 994567],
  [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
  [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
];
const XYZ_TO_LIN_A98 = /* @__PURE__ */ invert(LIN_A98_TO_XYZ);
const LIN_REC2020_TO_XYZ: Matrix = [
  [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
  [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
  [0, 19567812 / 697040785, 295819943 / 278816314],
];
const XYZ_TO_LIN_REC2020 = /* @__PURE__ */ invert(LIN_REC2020_TO_XYZ);
// ProPhoto is defined against D50
const LIN_PROPHOTO_TO_XYZ_D50: Matrix = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
  [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
];
const XYZ_D50_TO_LIN_PROPHOTO = /* @__PURE__ */ invert(LIN_PROPHOTO_TO_XYZ_D50);
const D65_TO_D50: Matrix = [
  [1.0479297925449969, 0.022946870601609652, -0.05019226628920524],
  [0.02962780877005599, 0.9904344267538799, -0.017073799063418826],
  [-0.009243040646204504, 0.015055191490298152, 0.7518742814281371],
];
const D50_TO_D65 = /* @__PURE__ */ invert(D65_TO_D50);
const XYZ_TO_LMS: Matrix = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_OKLAB: Matrix = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.42859224204858, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757548730575],
];
const LMS_TO_XYZ = /* @__PURE__ */ invert(XYZ_TO_LMS);
const OKLAB_TO_LMS: Matrix = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];

const D50_WHITE: Coords = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const LAB_E = 216 / 24389;
const LAB_K = 24389 / 27;

// --- polar and cylindrical helpers ---

const toPolar = ([l, a, b]: Coords): Coords => {
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  // Treat near-zero chroma as achromatic so hue does not flicker
  return [l, c, c < 1e-7 ? NaN : h];
};
const fromPolar = ([l, c, h]: Coords): Coords => {
  const hr = (n(h) * Math.PI) / 180;
  return [l, n(c) * Math.cos(hr), n(c) * Math.sin(hr)];
};

export const srgbToHsl = ([r, g, b]: Coords): Coords => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = NaN;
  let s = 0;
  if (d !== 0) {
    s = l === 0 || l === 1 ? 0 : (max - l) / Math.min(l, 1 - l);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
};

export const hslToSrgb = ([h, s, l]: Coords): Coords => {
  const hh = ((n(h) % 360) + 360) % 360;
  const ss = n(s) / 100;
  const ll = n(l) / 100;
  const f = (k: number) => {
    const t = (k + hh / 30) % 12;
    const a = ss * Math.min(ll, 1 - ll);
    return ll - a * Math.max(-1, Math.min(t - 3, 9 - t, 1));
  };
  return [f(0), f(8), f(4)];
};

const hwbToSrgb = ([h, w, b]: Coords): Coords => {
  let ww = n(w) / 100;
  let bb = n(b) / 100;
  if (ww + bb >= 1) {
    const gray = ww / (ww + bb);
    return [gray, gray, gray];
  }
  const rgb = hslToSrgb([h, 100, 50]);
  return rgb.map((v) => v * (1 - ww - bb) + ww) as Coords;
};

const srgbToHwb = (rgb: Coords): Coords => {
  const [h] = srgbToHsl(rgb);
  const w = Math.min(...rgb);
  const b = 1 - Math.max(...rgb);
  return [h, w * 100, b * 100];
};

const xyzD50ToLab = (xyz: Coords): Coords => {
  const f = xyz.map((v, i) => {
    const x = v / D50_WHITE[i];
    return x > LAB_E ? Math.cbrt(x) : (LAB_K * x + 16) / 116;
  });
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
};

const labToXyzD50 = ([l, a, b]: Coords): Coords => {
  const L = n(l);
  const f1 = (L + 16) / 116;
  const f0 = n(a) / 500 + f1;
  const f2 = f1 - n(b) / 200;
  const x = f0 ** 3 > LAB_E ? f0 ** 3 : (116 * f0 - 16) / LAB_K;
  const y = L > LAB_K * LAB_E ? ((L + 16) / 116) ** 3 : L / LAB_K;
  const z = f2 ** 3 > LAB_E ? f2 ** 3 : (116 * f2 - 16) / LAB_K;
  return [x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]];
};

const xyzToOklab = (xyz: Coords): Coords => {
  const lms = mul(XYZ_TO_LMS, xyz).map(Math.cbrt) as Coords;
  return mul(LMS_TO_OKLAB, lms);
};
const oklabToXyz = (lab: Coords): Coords => {
  const lms = mul(OKLAB_TO_LMS, nn(lab)).map((v) => v ** 3) as Coords;
  return mul(LMS_TO_XYZ, lms);
};

// --- to and from XYZ D65 ---

export function toXyz(color: Color): Coords {
  const c = color.coords;
  switch (color.space) {
    case "srgb":
      return mul(LIN_SRGB_TO_XYZ, srgbToLinear(nn(c)));
    case "srgb-linear":
      return mul(LIN_SRGB_TO_XYZ, nn(c));
    case "display-p3":
      return mul(LIN_P3_TO_XYZ, srgbToLinear(nn(c)));
    case "a98-rgb":
      return mul(LIN_A98_TO_XYZ, a98ToLinear(nn(c)));
    case "prophoto-rgb":
      return mul(D50_TO_D65, mul(LIN_PROPHOTO_TO_XYZ_D50, prophotoToLinear(nn(c))));
    case "rec2020":
      return mul(LIN_REC2020_TO_XYZ, rec2020ToLinear(nn(c)));
    case "xyz-d65":
      return nn(c);
    case "xyz-d50":
      return mul(D50_TO_D65, nn(c));
    case "hsl":
      return mul(LIN_SRGB_TO_XYZ, srgbToLinear(hslToSrgb(c)));
    case "hwb":
      return mul(LIN_SRGB_TO_XYZ, srgbToLinear(hwbToSrgb(c)));
    case "lab":
      return mul(D50_TO_D65, labToXyzD50(c));
    case "lch":
      return mul(D50_TO_D65, labToXyzD50(fromPolar(c)));
    case "oklab":
      return oklabToXyz(c);
    case "oklch":
      return oklabToXyz(fromPolar(c));
  }
}

export function fromXyz(xyz: Coords, space: ColorSpace): Coords {
  switch (space) {
    case "srgb":
      return linearToSrgb(mul(XYZ_TO_LIN_SRGB, xyz));
    case "srgb-linear":
      return mul(XYZ_TO_LIN_SRGB, xyz);
    case "display-p3":
      return linearToSrgb(mul(XYZ_TO_LIN_P3, xyz));
    case "a98-rgb":
      return linearToA98(mul(XYZ_TO_LIN_A98, xyz));
    case "prophoto-rgb":
      return linearToProphoto(mul(XYZ_D50_TO_LIN_PROPHOTO, mul(D65_TO_D50, xyz)));
    case "rec2020":
      return linearToRec2020(mul(XYZ_TO_LIN_REC2020, xyz));
    case "xyz-d65":
      return xyz;
    case "xyz-d50":
      return mul(D65_TO_D50, xyz);
    case "hsl":
      return srgbToHsl(linearToSrgb(mul(XYZ_TO_LIN_SRGB, xyz)));
    case "hwb":
      return srgbToHwb(linearToSrgb(mul(XYZ_TO_LIN_SRGB, xyz)));
    case "lab":
      return xyzD50ToLab(mul(D65_TO_D50, xyz));
    case "lch":
      return toPolar(xyzD50ToLab(mul(D65_TO_D50, xyz)));
    case "oklab":
      return xyzToOklab(xyz);
    case "oklch":
      return toPolar(xyzToOklab(xyz));
  }
}

const convertCache = new WeakMap<Color, Map<ColorSpace, Color>>();

/**
 * Convert a color to another space. Results are cached per color object, so treat colors as immutable:
 * create a new object instead of changing `coords` in place.
 */
export function convert(color: Color, space: ColorSpace): Color {
  if (color.space === space) return color;
  let bySpace = convertCache.get(color);
  const hit = bySpace?.get(space);
  if (hit) return hit;
  const out = convertUncached(color, space);
  if (!bySpace) convertCache.set(color, (bySpace = new Map()));
  bySpace.set(space, out);
  return out;
}

/** Fast paths for the conversions a picker does on every pointer move. */
function convertUncached(color: Color, space: ColorSpace): Color {
  const from = color.space;
  let coords: Coords;
  if (from === "srgb" && space === "hsl") coords = srgbToHsl(color.coords);
  else if (from === "hsl" && space === "srgb") coords = hslToSrgb(color.coords);
  else if (from === "srgb" && space === "hwb") coords = srgbToHwb(color.coords);
  else if (from === "hwb" && space === "srgb") coords = hwbToSrgb(color.coords);
  else coords = fromXyz(toXyz(color), space);
  return { space, coords, alpha: color.alpha };
}

export const RGB_SPACES: ReadonlySet<ColorSpace> = new Set([
  "srgb",
  "srgb-linear",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
]);
