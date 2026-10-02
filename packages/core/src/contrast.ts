import { parseColor, toGamut } from "./color";
import { getStops, isGradient, parseLayers } from "./gradient";
import type { Color } from "./spaces";

const channel = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** WCAG 2 relative luminance (sRGB, gamut mapped). */
export function luminance(color: Color): number {
  const [r, g, b] = toGamut(color, "srgb").coords;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Blend a translucent color over an opaque background. */
function over(fg: Color, bg: Color): Color {
  const f = toGamut(fg, "srgb").coords;
  const b = toGamut(bg, "srgb").coords;
  const a = fg.alpha;
  return { space: "srgb", coords: [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a)], alpha: 1 };
}

function ratio(fg: Color, bg: Color): number {
  const l1 = luminance(over(fg, bg));
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * WCAG 2 contrast ratio (1 to 21) of a color or gradient against a background color.
 * For gradients this is the lowest ratio across the stops. Returns null when either value can't be read.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const bg = parseColor(background);
  if (!bg) return null;
  const base = { ...bg.color, alpha: 1 };
  if (isGradient(foreground)) {
    const layer = parseLayers(foreground).find((l) => l.kind === "gradient");
    if (!layer || layer.kind !== "gradient") return null;
    const ratios = getStops(layer.gradient)
      .map((s) => parseColor(s.color))
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ratio(p.color, base));
    return ratios.length ? Math.min(...ratios) : null;
  }
  const fg = parseColor(foreground);
  return fg ? ratio(fg.color, base) : null;
}

/** WCAG level for normal text: AAA (7), AA (4.5), AA large text (3), or fail. */
export function contrastLevel(ratio: number): "AAA" | "AA" | "AA Large" | "Fail" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}
