import { memo, useMemo, type CSSProperties, type KeyboardEvent } from "react";
import { hsvToRgb, inGamut, luminance, num, parseColor, toGamut, toHexDigits } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { fill } from "../labels";
import { keyStep, usePointerDrag } from "../use-drag";
import { OklchArea } from "./oklch";

const rgbCss = (h: number, s: number, v: number) => {
  const [r, g, b] = hsvToRgb(h, s, v);
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
};

export interface AreaProps {
  className?: string;
  style?: CSSProperties;
  /** draw the WCAG AA (4.5:1) boundary against this background, like Chrome DevTools */
  contrastWith?: string;
}

/** The 2D color area: HSV saturation × brightness by default, OKLCH chroma × lightness with `space="oklch"` on the root. */
export function Area(props: AreaProps) {
  const { contrastWith, ...rest } = props;
  return usePickerContext().space === "oklch" ? <OklchArea {...rest} /> : <HsvArea {...props} />;
}

/** Saturation (x) and brightness (y) for the current hue. */
/** sRGB channel to linear light, for WCAG relative luminance. */
const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** For each saturation, the brightness where contrast with `bg` crosses 4.5:1. Returns an SVG path in 0..1 units. */
function contrastPath(h: number, bg: string): string | null {
  const parsed = parseColor(bg);
  if (!parsed) return null;
  // the background is read once; each sample is plain arithmetic on the HSV to RGB result, no color strings
  const lb = luminance({ ...parsed.color, alpha: 1 }) + 0.05;
  const ratioAt = (s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v);
    const l = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) + 0.05;
    return l > lb ? l / lb : lb / l;
  };
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    const lo0 = ratioAt(s, 0) >= 4.5;
    const hi0 = ratioAt(s, 1) >= 4.5;
    if (lo0 === hi0) continue; // the whole column passes or fails
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2;
      if ((ratioAt(s, mid) >= 4.5) === lo0) lo = mid;
      else hi = mid;
    }
    pts.push(`${num(s, 4)},${num(1 - (lo + hi) / 2, 4)}`);
  }
  return pts.length > 1 ? `M${pts.join(" L")}` : null;
}

const HsvArea = /* @__PURE__ */ memo(function HsvArea({ className, style, contrastWith }: AreaProps) {
  const { store, labels } = usePickerContext();
  const { h, s, v } = usePicker((st) => ({ h: st.hsva.h, s: st.hsva.s, v: st.hsva.v }));
  const gamut = usePicker((st) => (inGamut(st.color, "srgb") ? null : inGamut(st.color, "display-p3") ? "P3" : "Wide"));
  const hex = usePicker((st) => toHexDigits(st.color));
  // the AA line only depends on hue, so it is recomputed when the hue moves, not on every drag frame
  const hueKey = Math.round(h);
  const aaPath = useMemo(() => (contrastWith ? contrastPath(hueKey, contrastWith) : null), [hueKey, contrastWith]);

  const ref = usePointerDrag<HTMLDivElement>({
    // the gamut badge is a button inside the area, not a drag start
    onStart: (p) => ((p.event.target as HTMLElement).closest("[data-part='gamut-badge']") ? false : undefined),
    onMove: (p) => store.setHsva({ s: p.x, v: 1 - p.y }),
    onEnd: () => store.commit(),
    // two-finger swipe moves the thumb with the fingers
    onWheel: ({ dx, dy, rect }) => {
      const cur = store.getState().hsva;
      store.setHsva({
        s: Math.min(1, Math.max(0, cur.s + dx / rect.width)),
        v: Math.min(1, Math.max(0, cur.v + dy / rect.height)),
      });
      return true;
    },
    onWheelEnd: () => store.commit(),
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const step = keyStep(e, 0.01, 0.1);
    if (step === null) return;
    e.preventDefault();
    const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
    if (horizontal) store.setHsva({ s: Math.min(1, Math.max(0, s + step)) });
    else store.setHsva({ v: Math.min(1, Math.max(0, v + step)) });
  };

  const vars = {
    "--_cs-area-hue": `hsl(${h} 100% 50%)`,
    "--_cs-x": s,
    "--_cs-y": 1 - v,
    "--_cs-thumb-color": rgbCss(h, s, v),
    ...style,
  } as CSSProperties;

  return (
    <div ref={ref} data-part="area" data-label-below={v > 0.82 ? "" : undefined} className={className} style={vars}>
      <div
        data-part="area-thumb"
        role="slider"
        tabIndex={0}
        aria-label={labels.area}
        aria-valuetext={fill(labels.areaValue, { saturation: Math.round(s * 100), brightness: Math.round(v * 100) })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(s * 100)}
        onKeyDown={onKeyDown}
        onKeyUp={() => store.commit()}
      />
      {aaPath && (
        <svg data-part="area-contrast" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
          <path d={aaPath} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <span data-part="area-label" aria-hidden>
        #{hex}
      </span>
      {gamut && (
        <button
          type="button"
          data-part="gamut-badge"
          title={labels.outOfGamut}
          aria-label={`${gamut}: ${labels.outOfGamut}`}
          onClick={() => {
            store.setColor(toGamut(store.getState().color, "srgb"));
            store.commit();
          }}
        >
          {gamut}
        </button>
      )}
    </div>
  );
});
