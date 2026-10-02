import { describe, expect, it } from "vitest";
import { gradientHandles, moveGradientHandle } from "../src";

describe("gradient handles", () => {
  it("places linear start / end on the CSS gradient line", () => {
    const h = gradientHandles("linear-gradient(90deg, red, blue)", 200, 100)!;
    const start = h.handles.find((x) => x.id === "start")!;
    const end = h.handles.find((x) => x.id === "end")!;
    expect([Math.round(start.x), Math.round(start.y)]).toEqual([0, 50]);
    expect([Math.round(end.x), Math.round(end.y)]).toEqual([200, 50]);
    expect(h.handles.filter((x) => x.kind === "stop").length).toBe(2);
  });

  it("rotates when the end handle moves", () => {
    expect(moveGradientHandle("linear-gradient(90deg, red, blue)", "end", 100, 100, 200, 100)).toBe("linear-gradient(180deg, red, blue)");
    expect(moveGradientHandle("linear-gradient(90deg, red, blue)", "start", 100, 100, 200, 100)).toBe("linear-gradient(0deg, red, blue)");
  });

  it("moves a stop along the line", () => {
    const v = moveGradientHandle("linear-gradient(90deg, red 0%, blue 100%)", "stop:1", 150, 20, 200, 100);
    expect(v).toBe("linear-gradient(90deg, red 0%, blue 75%)");
  });

  it("moves radial and conic centers, keeps other layers", () => {
    const v = moveGradientHandle("radial-gradient(circle, red, blue), url(x.png)", "center", 50, 25, 200, 100, { snap: true });
    expect(v).toBe("radial-gradient(circle at 25% 25%, red, blue), url(x.png)");
    const c = gradientHandles("conic-gradient(from 90deg at 50% 50%, red, blue)", 100, 100)!;
    expect(c.handles.map((h) => h.id)).toEqual(["center", "angle"]);
  });

  it("never throws on bad ids or coordinates", () => {
    const value = "linear-gradient(90deg, #000 0%, #fff 100%)";
    for (const id of [null, undefined, 1, {}, "nope"] as unknown as string[]) {
      expect(moveGradientHandle(value, id, 10, 10, 100, 100)).toBe(value);
    }
    expect(moveGradientHandle(value, "end", NaN, 10, 100, 100)).toBe(value);
    expect(gradientHandles(value, NaN, 100)).toBeNull();
  });
});
