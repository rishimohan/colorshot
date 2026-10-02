import { computed, defineComponent, ref, watchPostEffect } from "vue";
import { convert, fromXyz, inGamut, num, toXyz } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { fill } from "../labels";
import { keyStep, usePointerDrag } from "../use-drag";

/** Chroma at the right edge of the area. 0.4 is CSS `oklch()` 100%, wide enough for Display P3. */
export const OKLCH_MAX_CHROMA = 0.4;
const RES = 128;

/** Current color as OKLCH, keeping the last hue while the color is grey. */
export function useOklch() {
  const { hueMemory } = usePickerContext();
  return usePicker((s) => {
    const [l, c, h] = convert(s.color, "oklch").coords;
    let hue = h;
    if (Number.isNaN(h) || c < 1e-4) hue = hueMemory.current;
    else hueMemory.current = h;
    return { l: Math.min(1, Math.max(0, l)), c: Math.max(0, c), h: hue, a: s.color.alpha };
  });
}

let p3Support: boolean | null = null;
function supportsP3Canvas(): boolean {
  if (p3Support !== null) return p3Support;
  try {
    const ctx = document.createElement("canvas").getContext("2d", { colorSpace: "display-p3" } as CanvasRenderingContext2DSettings);
    p3Support = Boolean(ctx && (ctx.getContextAttributes?.() as { colorSpace?: string } | undefined)?.colorSpace === "display-p3");
  } catch {
    p3Support = false;
  }
  return p3Support;
}

/** Paint lightness (y) by chroma (x) at one hue into a `size`² canvas. Colors outside the canvas gamut are dimmed. */
function paint(canvas: HTMLCanvasElement, hue: number, size: number) {
  const p3 = supportsP3Canvas() && matchMedia("(color-gamut: p3)").matches;
  const space = p3 ? "display-p3" : "srgb";
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  const ctx = canvas.getContext("2d", { colorSpace: space } as CanvasRenderingContext2DSettings);
  if (!ctx) return;
  const img = ctx.createImageData(size, size, { colorSpace: space } as ImageDataSettings);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const l = 1 - y / (size - 1);
    for (let x = 0; x < size; x++) {
      // uncached conversion: one throwaway color per pixel, nothing kept alive
      const rgb = fromXyz(toXyz({ space: "oklch", coords: [l, (x / (size - 1)) * OKLCH_MAX_CHROMA, hue], alpha: 1 }), space);
      const inside = rgb[0] >= -0.001 && rgb[0] <= 1.001 && rgb[1] >= -0.001 && rgb[1] <= 1.001 && rgb[2] >= -0.001 && rgb[2] <= 1.001;
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) {
        const v = Math.min(1, Math.max(0, rgb[k]));
        // outside the gamut: the nearest color, darkened, so the area stays continuous
        data[i + k] = Math.round((inside ? v : v * 0.62) * 255);
      }
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const idle: (fn: () => void) => number =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (fn) => window.requestIdleCallback(fn, { timeout: 120 })
    : (fn) => window.setTimeout(fn, 16);
const cancelIdle = (id: number) =>
  typeof window !== "undefined" && "cancelIdleCallback" in window ? window.cancelIdleCallback(id) : clearTimeout(id);

/** SVG path of the sRGB edge: the largest in-gamut chroma for each lightness. */
function srgbEdge(hue: number): string {
  const rows = 48;
  const pts: string[] = [];
  for (let r = 0; r <= rows; r++) {
    const l = 1 - r / rows;
    let lo = 0;
    let hi = OKLCH_MAX_CHROMA;
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2;
      if (inGamut({ space: "oklch", coords: [l, mid, hue], alpha: 1 })) lo = mid;
      else hi = mid;
    }
    pts.push(`${num(lo / OKLCH_MAX_CHROMA, 4)},${num(r / rows, 4)}`);
  }
  return `M${pts.join(" L")}`;
}

function edgeChroma(l: number, h: number): number {
  let lo = 0;
  let hi = OKLCH_MAX_CHROMA;
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ space: "oklch", coords: [l, mid, h], alpha: 1 })) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** OKLCH area: lightness top to bottom, chroma left to right, at the current hue. The dashed line is the sRGB edge. */
export const OklchArea = /* @__PURE__ */ defineComponent({
  name: "PickerOklchArea",
  setup() {
    const ctx = usePickerContext();
    const { store, hueMemory } = ctx;
    const oklch = useOklch();
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const pathRef = ref<SVGPathElement | null>(null);
    let painted: number | null = null;
    // a computed keeps the same value while only lightness or chroma change, so the effect below does not re-run
    const paintHue = computed(() => Math.round(oklch.value.h * 2) / 2);

    // repaint only when the hue changes: a coarse pass in the next frame (never stalls a drag),
    // then the sharp one when the browser is idle
    watchPostEffect((onCleanup) => {
      const hue = paintHue.value;
      if (painted === hue || !canvasRef.value) return;
      let idleId = 0;
      const frame = requestAnimationFrame(() => {
        if (!canvasRef.value) return;
        paint(canvasRef.value, hue, 24);
        pathRef.value?.setAttribute("d", srgbEdge(hue));
        idleId = idle(() => {
          if (canvasRef.value) paint(canvasRef.value, hue, RES);
          painted = hue;
        });
      });
      onCleanup(() => {
        cancelAnimationFrame(frame);
        if (idleId) cancelIdle(idleId);
      });
    });

    const set = (ll: number, cc: number) => {
      const { h, a } = oklch.value;
      hueMemory.current = h;
      store.setColor({ space: "oklch", coords: [ll, cc, h], alpha: a === 0 ? 1 : a });
    };

    const dragRef = usePointerDrag<HTMLDivElement>({
      onStart: (p) => ((p.event.target as HTMLElement).closest("[data-part='gamut-badge']") ? false : undefined),
      onMove: (p) => set(1 - p.y, p.x * OKLCH_MAX_CHROMA),
      onEnd: () => store.commit(),
      onWheel: ({ dx, dy, rect }) => {
        const [cl, cc] = convert(store.getState().color, "oklch").coords;
        set(
          Math.min(1, Math.max(0, cl + dy / rect.height)),
          Math.min(OKLCH_MAX_CHROMA, Math.max(0, (Number.isNaN(cc) ? 0 : cc) + (dx / rect.width) * OKLCH_MAX_CHROMA)),
        );
        return true;
      },
      onWheelEnd: () => store.commit(),
    });

    const onKeyDown = (e: KeyboardEvent) => {
      const step = keyStep(e, 0.01, 0.1);
      if (step === null) return;
      e.preventDefault();
      const { l, c } = oklch.value;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") set(l, Math.min(OKLCH_MAX_CHROMA, Math.max(0, c + step * OKLCH_MAX_CHROMA)));
      else set(Math.min(1, Math.max(0, l + step)), c);
    };

    return () => {
      const { l, c, h, a } = oklch.value;
      const labels = ctx.labels;
      const thumb = `oklch(${num(l, 4)} ${num(c, 4)} ${num(h, 2)})`;
      const color = { space: "oklch" as const, coords: [l, c, h] as [number, number, number], alpha: 1 };
      const gamut = inGamut(color, "srgb") ? null : inGamut(color, "display-p3") ? "P3" : "Wide";
      return (
        <div
          ref={dragRef}
          data-part="area"
          data-space="oklch"
          data-label-below={l > 0.82 ? "" : undefined}
          style={{ "--_cs-x": Math.min(1, c / OKLCH_MAX_CHROMA), "--_cs-y": 1 - l, "--_cs-thumb-color": thumb }}
        >
          <canvas ref={canvasRef} data-part="area-canvas" width={RES} height={RES} aria-hidden="true" />
          <svg data-part="area-edge" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            <path ref={pathRef} vector-effect="non-scaling-stroke" />
          </svg>
          <div
            data-part="area-thumb"
            role="slider"
            tabindex={0}
            aria-label={labels.areaOklch}
            aria-valuetext={fill(labels.areaOklchValue, { lightness: Math.round(l * 100), chroma: num(c, 3) })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(l * 100)}
            onKeydown={onKeyDown}
            onKeyup={() => store.commit()}
          />
          <span data-part="area-label" aria-hidden="true">
            {`${Math.round(l * 100)}% ${num(c, 3)} ${Math.round(h)}°`}
          </span>
          {gamut ? (
            <button
              type="button"
              data-part="gamut-badge"
              title={labels.outOfGamut}
              aria-label={`${gamut}: ${labels.outOfGamut}`}
              onClick={() => {
                store.setColor({ space: "oklch", coords: [l, Math.min(c, edgeChroma(l, h)), h], alpha: a });
                store.commit();
              }}
            >
              {gamut}
            </button>
          ) : null}
        </div>
      );
    };
  },
});

export const OKLCH_HUE_TRACK = `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, i) => `oklch(0.72 0.16 ${i * 30}) ${num((i / 12) * 100, 2)}%`).join(", ")})`;
