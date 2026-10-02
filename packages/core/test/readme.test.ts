import { describe, expect, it } from "vitest";
import { contrastRatio, createPicker, formatColor, parseColor } from "../src";

// The examples in packages/core/README.md, so the docs cannot drift from the code
describe("README examples", () => {
  it("parse, format, contrast", () => {
    expect(parseColor("oklch(0.7 0.15 200)")?.format).toBe("oklch");
    expect(formatColor(parseColor("#3366ff")!.color, "oklch")).toBe("oklch(0.5726 0.2338 265.28)");
    expect(contrastRatio("#64748b", "#ffffff")?.toFixed(2)).toBe("4.76");
  });
  it("picker", () => {
    const picker = createPicker({ value: "linear-gradient(90deg, red, blue)" });
    picker.addStop(0.5);
    picker.setAngle(45);
    expect(picker.getState().value).toBe("linear-gradient(45deg, red 0%, #800080 50%, blue 100%)");
  });
});
