import { describe, expect, it } from "vitest";
import { colorKey, convert, formatColor, inGamut, parseColor, toGamut } from "../src";

const close = (a: number[], b: number[], eps = 1e-3) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe("parseColor", () => {
  const valid: [string, string][] = [
    ["#f00", "hex"],
    ["#FF000080", "hex"],
    ["rgb(255, 0, 0)", "rgb"],
    ["rgba(255,0,0,0.5)", "rgb"],
    ["rgb(255 0 0 / 50%)", "rgb"],
    ["rgb(100% 0% 0%)", "rgb"],
    ["hsl(0, 100%, 50%)", "hsl"],
    ["hsla(0, 100%, 50%, .5)", "hsl"],
    ["hsl(0deg 100% 50% / 0.5)", "hsl"],
    ["hsl(0.5turn 100 50)", "hsl"],
    ["hwb(0 0% 0%)", "hwb"],
    ["lab(54.29% 80.8 69.89)", "lab"],
    ["lch(54.29 106.84 40.85)", "lch"],
    ["oklab(0.628 0.225 0.126)", "oklab"],
    ["oklch(0.628 0.2577 29.23)", "oklch"],
    ["oklch(62.8% 0.2577 29.23deg / 0.5)", "oklch"],
    ["oklch(0.7 none 120)", "oklch"],
    ["color(display-p3 1 0 0)", "display-p3"],
    ["color(srgb 1 0 0 / 0.5)", "srgb"],
    ["color(xyz 0.4124 0.2126 0.0193)", "xyz-d65"],
    ["color(rec2020 1 0 0)", "rec2020"],
    ["color(a98-rgb 1 0 0)", "a98-rgb"],
    ["color(prophoto-rgb 1 0 0)", "prophoto-rgb"],
    ["red", "hex"],
    ["RebeccaPurple", "hex"],
    ["transparent", "hex"],
  ];
  it.each(valid)("reads %s", (input, format) => {
    const p = parseColor(input);
    expect(p).not.toBeNull();
    expect(p!.format).toBe(format);
  });

  const invalid = [
    "",
    "#12",
    "#ggg",
    "rgb(1, 2)",
    "rgb(1 2 3 4)",
    "foo",
    "var(--brand)",
    "rgb(from red r g b)",
    "rgb(calc(10 + 2) 0 0)",
    "color(unknown 1 0 0)",
    "oklch(1, 2, 3)",
    "rgb(255, 0, 0",
    "mixed",
  ];
  it.each(invalid)("rejects %s without throwing", (input) => {
    expect(parseColor(input)).toBeNull();
  });
});

describe("conversions", () => {
  it("matches published OKLCH for sRGB red", () => {
    const red = parseColor("#ff0000")!.color;
    const ok = convert(red, "oklch").coords;
    expect(close(ok, [0.62796, 0.25768, 29.2339], 1e-3)).toBe(true);
  });

  it("matches published Lab for sRGB red", () => {
    const lab = convert(parseColor("red")!.color, "lab").coords;
    expect(close(lab, [54.29, 80.8, 69.89], 0.05)).toBe(true);
  });

  it("round trips every space", () => {
    const base = parseColor("rgb(30, 144, 255)")!.color;
    for (const space of ["srgb-linear", "display-p3", "a98-rgb", "prophoto-rgb", "rec2020", "xyz-d65", "xyz-d50", "hsl", "hwb", "lab", "lch", "oklab", "oklch"] as const) {
      const back = convert(convert(base, space), "srgb").coords;
      expect(close(back, base.coords, 1e-4), space).toBe(true);
    }
  });

  it("detects and maps out-of-gamut colors", () => {
    const p3 = parseColor("color(display-p3 1 0 0)")!.color;
    expect(inGamut(p3)).toBe(false);
    expect(inGamut(p3, "display-p3")).toBe(true);
    const mapped = toGamut(p3, "srgb").coords;
    expect(mapped.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe("formatColor", () => {
  const red = parseColor("#ff0000")!.color;
  const half = { ...red, alpha: 0.5 };
  it("writes every format", () => {
    expect(formatColor(red, "hex")).toBe("#ff0000");
    expect(formatColor(half, "hex", { upper: true })).toBe("#FF000080");
    expect(formatColor(red, "rgb")).toBe("rgb(255, 0, 0)");
    expect(formatColor(half, "rgb")).toBe("rgba(255, 0, 0, 0.5)");
    expect(formatColor(half, "rgb", { legacy: false })).toBe("rgb(255 0 0 / 0.5)");
    expect(formatColor(red, "hsl")).toBe("hsl(0, 100%, 50%)");
    expect(formatColor(red, "hwb")).toBe("hwb(0 0% 0%)");
    expect(formatColor(red, "oklch")).toBe("oklch(0.628 0.2577 29.23)");
    expect(formatColor(red, "oklch", { percentL: true })).toBe("oklch(62.8% 0.2577 29.23)");
    expect(formatColor(red, "display-p3")).toMatch(/^color\(display-p3 0\.9\d+ 0\.2\d+ 0\.1\d+\)$/);
  });

  it("keeps rgba when it was written as rgba", () => {
    expect(formatColor(red, "rgb", { legacy: true, fn: "rgba" })).toBe("rgba(255, 0, 0, 1)");
  });

  it("gamut maps when writing sRGB formats", () => {
    const wide = parseColor("oklch(0.7 0.4 150)")!.color;
    expect(formatColor(wide, "hex")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("colorKey", () => {
  it("treats the same color written differently as equal", () => {
    expect(colorKey("#ff0000")).toBe(colorKey("rgb(255, 0, 0)"));
    expect(colorKey("red")).toBe(colorKey("hsl(0 100% 50%)"));
    expect(colorKey("#ff0000")).not.toBe(colorKey("#ff000080"));
  });
});

import { contrastLevel, contrastRatio } from "../src";

describe("contrast", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777", "#fff")).toBeCloseTo(4.48, 1);
    expect(contrastLevel(4.6)).toBe("AA");
  });
  it("uses the weakest stop of a gradient", () => {
    expect(contrastRatio("linear-gradient(#000, #fff)", "#fff")).toBeCloseTo(1, 1);
  });
});

describe("hardened helpers", () => {
  it("formatColor falls back to hex for an unknown format", () => {
    expect(formatColor(parseColor("#3e5ceb")!.color, "nope" as never)).toBe("#3e5ceb");
  });
});
