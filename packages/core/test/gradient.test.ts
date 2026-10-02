import { describe, expect, it } from "vitest";
import { createPicker, getStops, isGradient, isSafeCssValue, parseColor, parseGradient, parseLayers, serializeLayers, stopOffsets } from "../src";

// Real values: the PR #568 crash list, Orshot importers (Canva, Abyssale, Figma, HTML import) and CSS edge cases.
const CORPUS = [
  "linear-gradient(90deg, #000 0%, #fff 100%)",
  "radial-gradient(ellipse 66% 110% at 101% -8%, rgb(67,150,232) 0%, rgba(80,136,199,1) 36%, rgba(121,175,222,0.70) 82%, rgba(205,229,248,0) 99%)",
  "radial-gradient(80% 70% at 86% 10%, rgba(0, 227, 253, 0.32) 0%, rgba(0, 227, 253, 0) 62%)",
  "linear-gradient(9.947598300641403e-14deg, rgba(0, 0, 0, 0.800000011920929) 0%, rgba(0, 0, 0, 0.10000000149011612) 100%)",
  "repeating-linear-gradient(180deg, rgba(250,248,255,0.92) 0 2px, rgba(250,248,255,0) 2px 5px)",
  "radial-gradient(circle at 8% 18%, #ffd400 0%, #ff7a00 18%, transparent 38%), radial-gradient(circle at 18% 82%, #ef321c 0%, #9b165d 27%, transparent 45%)",
  "radial-gradient(circle 302px at 905px 183px, #D95A47 99%, transparent 100%)",
  "linear-gradient(to bottom, rgba(35, 38, 45, 0.85), rgba(25, 28, 35, 0.95))",
  "radial-gradient(circle at 50% 18%, #ffffff 0%, #000000 100%)",
  "conic-gradient(from 0deg, rgb(0, 0, 0) 0.4%, rgb(16, 18, 21) 9.08%, rgb(29, 70, 114) 24.97%)",
  "linear-gradient(165deg, #083E33 0%, #0F5746 58%, #EFF5F1 58.2%, #FAF7EF 100%)",
  "linear-gradient(in oklch longer hue 90deg, oklch(0.7 0.2 30), oklch(0.7 0.2 270))",
  "linear-gradient(0.25turn, red, 30%, blue)",
  "conic-gradient(from 45deg at 30% 40% in oklab, red 0deg 90deg, blue 90deg 0.5turn, green)",
  "-webkit-linear-gradient(top, #fff, #000)",
  "linear-gradient(red 10% 20%, blue)",
  "linear-gradient(to top right, color(display-p3 1 0 0), hsl(200 80% 50% / 0.5))",
  "linear-gradient(90deg, var(--brand) 0%, color-mix(in srgb, red, blue) 100%)",
  "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)",
];

describe("gradient corpus", () => {
  it.each(CORPUS)("round trips unchanged: %s", (value) => {
    const picker = createPicker({ value });
    expect(picker.getState().value).toBe(value);
    expect(picker.getState().mode).not.toBe("solid");
  });

  it.each(CORPUS)("keeps every untouched layer and stop when one stop is recolored: %s", (value) => {
    const picker = createPicker({ value });
    const before = parseLayers(value);
    picker.setHsva({ h: 120, s: 1, v: 1 });
    const after = parseLayers(picker.getState().value);
    expect(after.length).toBe(before.length);
    after.forEach((layer, i) => {
      if (i !== before.findIndex((l) => l.kind === "gradient")) expect(layer.raw).toBe(before[i].raw);
    });
    const g0 = (before.find((l) => l.kind === "gradient") as any).gradient;
    const g1 = (after.find((l) => l.kind === "gradient") as any).gradient;
    const s0 = getStops(g0);
    const s1 = getStops(g1);
    expect(s1.length).toBe(s0.length);
    s1.slice(1).forEach((s, i) => {
      expect(s.color).toBe(s0[i + 1].color);
      expect(s.positions.map((p) => p.raw)).toEqual(s0[i + 1].positions.map((p) => p.raw));
    });
    expect(picker.getState().value).not.toMatch(/NaN|undefined/);
  });
});

describe("broken input never throws", () => {
  const bad = [
    "linear-gradient(",
    "radial-gradient(((",
    "linear-gradient(90deg)",
    "linear-gradient(90deg, )",
    "conic-gradient(from 0deg",
    'linear-gradient(90deg, red 0%, blue 100%)"></div><div x="',
    "linear-gradient(" + "a, ".repeat(5000) + ")",
    "gradient",
    "mixed",
  ];
  it.each(bad)("%s", (value) => {
    expect(() => createPicker({ value })).not.toThrow();
  });
});

describe("stop ids", () => {
  it("are the same every time a value is read, so server and browser render the same markup", () => {
    const value = "linear-gradient(90deg, #000 0%, #888 50%, #fff 100%)";
    const ids = () => getStops(parseGradient(value)!).map((s) => s.id);
    expect(ids()).toEqual(["s1", "s2", "s3"]);
    expect(ids()).toEqual(ids());
    expect(createPicker({ value }).getState().stops.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("stay unique when stops are added", () => {
    const picker = createPicker({ value: "linear-gradient(90deg, #000 0%, #fff 100%)" });
    picker.addStop(0.25);
    picker.addStop(0.75);
    const ids = picker.getState().stops.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("values that are not text never throw", () => {
  // hosts pass whatever their data holds: a number from a bad import, an object, null
  const notText = [123, null, undefined, {}, [], true, NaN] as unknown as string[];
  it.each(notText)("%s", (value) => {
    const picker = createPicker({ value });
    // read exactly like an empty value
    expect(picker.getState().value).toBe(createPicker({ value: "" }).getState().value);
    expect(() => {
      picker.setValue(value);
      picker.setCss(value);
      picker.applySwatch(value);
      picker.setHsva({ h: 120 });
      picker.commit();
    }).not.toThrow();
    expect(isGradient(value)).toBe(false);
    expect(parseColor(value)).toBeNull();
    expect(() => parseLayers(value)).not.toThrow();
  });
});

describe("stop offsets", () => {
  it("fills missing positions like CSS", () => {
    const g = parseGradient("linear-gradient(red, green, blue 80%, white)")!;
    expect(stopOffsets(g)).toEqual([0, 0.4, 0.8, 1]);
  });
  it("clamps out-of-order positions", () => {
    const g = parseGradient("linear-gradient(red 50%, blue 20%)")!;
    expect(stopOffsets(g)).toEqual([0.5, 0.5]);
  });
});

describe("picker editing", () => {
  it("adds a stop with the interpolated color and keeps others in place", () => {
    const picker = createPicker({ value: "linear-gradient(90deg, #000000, #ffffff)" });
    const id = picker.addStop(0.5);
    const s = picker.getState();
    expect(s.stops.length).toBe(3);
    expect(s.selectedStopId).toBe(id);
    // the midpoint the browser draws: legacy colors blend in sRGB
    expect(s.value).toBe("linear-gradient(90deg, #000000 0%, #808080 50%, #ffffff 100%)");
  });

  it("a new stop follows the output format, whether sampled or dropped", () => {
    // a stand-in format that is easy to spot: opaque and translucent colors get fixed values
    const picker = createPicker({
      value: "linear-gradient(90deg, rgba(0, 0, 0, 0.5) 0%, #ffffff 100%)",
      outputFormat: (c) => (c.alpha >= 1 ? "#123456" : "rgba(1, 2, 3, 0.5)"),
    });
    picker.addStop(0.5);
    expect(getStops(picker.getState().gradient!).map((s) => s.color)).toContain("rgba(1, 2, 3, 0.5)");
    picker.addStop(0.25, "#ff0000");
    expect(getStops(picker.getState().gradient!).map((s) => s.color)).toContain("#123456");
  });

  it("moves, reorders and removes stops", () => {
    const picker = createPicker({ value: "linear-gradient(90deg, red 0%, blue 100%)" });
    const [a] = picker.getState().stops;
    picker.moveStop(a.id, 1);
    expect(picker.getState().stops[1].id).toBe(a.id);
    picker.removeStop(a.id);
    expect(picker.getState().stops.length).toBe(2);
  });

  it("switches type and keeps stops", () => {
    const picker = createPicker({ value: "linear-gradient(45deg, red 0%, blue 100%)" });
    picker.setMode("conic");
    expect(picker.getState().value).toBe("conic-gradient(from 45deg, red 0%, blue 100%)");
    picker.setMode("radial");
    expect(picker.getState().value).toBe("radial-gradient(circle, red 0%, blue 100%)");
    picker.setCenter(30, 70);
    expect(picker.getState().value).toBe("radial-gradient(circle at 30% 70%, red 0%, blue 100%)");
  });

  it("keeps the angle unit", () => {
    const picker = createPicker({ value: "linear-gradient(0.25turn, red, blue)" });
    picker.setAngle(180);
    expect(picker.getState().value).toBe("linear-gradient(0.5turn, red, blue)");
  });

  it("remembers the solid color when toggling modes", () => {
    const picker = createPicker({ value: "#3366ff" });
    picker.setMode("linear");
    expect(picker.getState().value).toBe("linear-gradient(90deg, #3366ff 0%, #ffffff 100%)");
    picker.setMode("solid");
    expect(picker.getState().value).toBe("#3366ff");
  });

  it("preserves the input format and wide gamut on alpha changes", () => {
    const picker = createPicker({ value: "oklch(0.7 0.35 150)" });
    picker.setHsva({ a: 0.5 });
    expect(picker.getState().value).toBe("oklch(0.7 0.35 150 / 0.5)");
  });

  it("writes in a forced output format", () => {
    const picker = createPicker({ value: "oklch(0.7 0.1 150)", outputFormat: "hex" });
    picker.setHsva({ h: 0, s: 1, v: 1 });
    expect(picker.getState().value).toBe("#ff0000");
  });

  it("makes a transparent value opaque when a color is picked", () => {
    const picker = createPicker({ value: "transparent" });
    picker.setHsva({ s: 1, v: 1 });
    expect(picker.getState().hsva.a).toBe(1);
  });

  it("fires onChangeComplete once per committed change", () => {
    const calls: string[] = [];
    const picker = createPicker({ value: "#000000", onChangeComplete: (v) => calls.push(v) });
    picker.setHsva({ v: 0.5 });
    picker.setHsva({ v: 0.6 });
    picker.commit();
    picker.commit();
    expect(calls.length).toBe(1);
  });

  it("keeps multi-layer values intact", () => {
    const value = "radial-gradient(circle at 8% 18%, #ffd400 0%, transparent 38%), linear-gradient(red, blue)";
    const picker = createPicker({ value });
    picker.setAngle(10);
    expect(serializeLayers(parseLayers(picker.getState().value))[1]).toBeDefined();
    expect(picker.getState().value.endsWith(", linear-gradient(red, blue)")).toBe(true);
  });
});

describe("history", () => {
  it("undoes and redoes committed values only", () => {
    const seen: string[] = [];
    const picker = createPicker({ value: "#000000", history: true, onChangeComplete: (v) => seen.push(v) });
    picker.setHsva({ v: 0.5 });
    picker.setHsva({ v: 0.6 });
    picker.commit();
    picker.setCss("#ff0000");
    picker.commit();
    expect(picker.undo()).toBe(true);
    expect(picker.getState().value).toBe("#999999");
    expect(picker.undo()).toBe(true);
    expect(picker.getState().value).toBe("#000000");
    expect(picker.undo()).toBe(false);
    expect(picker.redo()).toBe(true);
    expect(picker.getState().value).toBe("#999999");
    expect(seen.at(-1)).toBe("#999999");
  });

  it("is off unless asked for", () => {
    const picker = createPicker({ value: "#000000" });
    picker.setCss("#ff0000");
    picker.commit();
    expect(picker.undo()).toBe(false);
  });
});

describe("switching modes keeps the color being edited", () => {
  it("solid -> gradient -> solid round trips", () => {
    const picker = createPicker({ value: "#3366ff" });
    picker.setMode("linear");
    expect(picker.getState().value).toBe("linear-gradient(90deg, #3366ff 0%, #ffffff 100%)");
    picker.setMode("solid");
    expect(picker.getState().value).toBe("#3366ff");
  });

  it("brings the previous gradient back with the new solid color on the active stop", () => {
    const picker = createPicker({ value: "linear-gradient(45deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)" });
    picker.selectStop(picker.getState().stops[1].id);
    picker.setMode("solid");
    expect(picker.getState().value).toBe("#00ff00");
    picker.setCss("#ffcc00");
    picker.setMode("radial");
    expect(picker.getState().value).toBe("radial-gradient(circle, #ff0000 0%, #ffcc00 50%, #0000ff 100%)");
    expect(picker.getState().selectedStopId).toBe(picker.getState().stops[1].id);
  });

  it("keeps everything when switching between gradient types", () => {
    const picker = createPicker({ value: "linear-gradient(30deg, red 0%, blue 100%)" });
    picker.setMode("conic");
    picker.setMode("linear");
    expect(picker.getState().value).toBe("linear-gradient(30deg, red 0%, blue 100%)");
  });
});

describe("added stops match what the browser draws", () => {
  it("blends legacy colors in sRGB", () => {
    const picker = createPicker({ value: "linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" });
    picker.addStop(0.5);
    expect(picker.getState().stops[1].color).toBe("#800080");
  });
  it("uses the in <space> hint", () => {
    const picker = createPicker({ value: "linear-gradient(in oklch longer hue 90deg, oklch(0.7 0.2 0) 0%, oklch(0.7 0.2 90) 100%)" });
    picker.addStop(0.5);
    // longer hue from 0 to 90 goes the other way round: halfway is 225
    expect(picker.getState().stops[1].color).toMatch(/^oklch\(0\.7 0\.2 225/);
  });
  it("fades to transparent without passing through grey", () => {
    const picker = createPicker({ value: "linear-gradient(90deg, #ff0000 0%, rgba(0, 0, 255, 0) 100%)" });
    picker.addStop(0.5);
    expect(picker.getState().stops[1].color).toBe("#ff000080");
  });
});

describe("stable stop ids", () => {
  it("keeps ids across undo and controlled updates", () => {
    const picker = createPicker({ value: "linear-gradient(red 0%, blue 100%)", history: true });
    const ids = picker.getState().stops.map((s) => s.id);
    picker.moveStop(ids[1], 0.8);
    picker.commit();
    picker.undo();
    expect(picker.getState().stops.map((s) => s.id)).toEqual(ids);
    picker.setValue("linear-gradient(green 0%, yellow 50%, blue 100%)");
    expect(picker.getState().stops.slice(0, 2).map((s) => s.id)).toEqual(ids);
  });
});

describe("only plain colors and gradients pass through", () => {
  const HOSTILE = [
    "url(texture.png), linear-gradient(90deg, red, blue)",
    'linear-gradient(90deg"><img src=x onerror=alert(1)>", red, blue)',
    "radial-gradient(circle at x;}</style><script>alert(1)</script>, red, blue)",
    'linear-gradient(red, blue), x"><img src=x onerror=alert(1)>',
    "linear-gradient(url(https://evil/x), red, blue)",
    'linear-gradient(90deg, image-set("https://evil/x.png" 1x) 0%, red, blue)',
    "linear-gradient(90deg, red;x, blue)",
    "linear-gradient(in x;background:url(//evil), red, blue)",
    "linear-gradient(90deg, red, blue calc(100% - expression(alert(1))))",
    "linear-gradient(90deg, var(x);position:fixed, blue)",
  ];

  it.each(HOSTILE)("is not read, set or emitted: %s", (value) => {
    const changes: string[] = [];
    const picker = createPicker({ value, onChange: (v) => changes.push(v) });
    expect(picker.getState().parsed).toBe(false);
    expect(picker.setCss(value)).toBe(false);
    picker.setHsva({ h: 120, s: 1, v: 1 });
    for (const v of changes) expect(isSafeCssValue(v)).toBe(true);
  });

  it("a dropped stop color that is not a color takes the color at that point instead", () => {
    const picker = createPicker({ value: "linear-gradient(90deg, red 0%, blue 100%)" });
    picker.addStop(0.5, 'red 0%), url(https://evil.example/x), x"><img src=x>');
    expect(isSafeCssValue(picker.getState().value)).toBe(true);
    expect(picker.getState().stops).toHaveLength(3);
  });

  it("keeps plain var(), color-mix() and calc() positions", () => {
    const value = "linear-gradient(90deg, var(--brand) 0%, color-mix(in oklab, red 40%, blue) calc(50% + 10px), blue 100%)";
    const picker = createPicker({ value });
    expect(picker.getState().parsed).toBe(true);
    expect(picker.getState().value).toBe(value);
  });

  it("parses long digit runs in linear time", () => {
    const t = performance.now();
    parseColor("rgb(" + "1".repeat(30000) + "! 0 0)");
    createPicker({ value: "linear-gradient(red " + "1".repeat(60000) + "!, blue)" });
    expect(performance.now() - t).toBeLessThan(200);
  });

  it("isSafeCssValue accepts colors and gradients, rejects markup, urls and declarations", () => {
    expect(isSafeCssValue("oklch(0.7 0.15 200 / 50%)")).toBe(true);
    expect(isSafeCssValue("repeating-conic-gradient(from 45deg at 50% 50%, #fff 0deg 10deg, #000 10deg 20deg)")).toBe(true);
    expect(isSafeCssValue("url(x)")).toBe(false);
    expect(isSafeCssValue("red; color: blue")).toBe(false);
    expect(isSafeCssValue('red"><b>')).toBe(false);
    expect(isSafeCssValue("image-set(x 1x)")).toBe(false);
  });
});
