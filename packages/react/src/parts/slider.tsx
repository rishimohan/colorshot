import { memo, type CSSProperties, type KeyboardEvent } from "react";
import { formatColor, hsvToRgb, num } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { fill } from "../labels";
import { keyStep, thumbInset, usePointerDrag } from "../use-drag";
import { OKLCH_HUE_TRACK, useOklch } from "./oklch";

interface TrackProps {
  value: number; // 0..1
  /** fresh value for wheel gestures, which can fire several times between renders */
  read: () => number;
  onValue: (t: number) => void;
  onCommit: () => void;
  background: string;
  thumbColor: string;
  label: string;
  valueText: string;
  /** the value as the slider reports it: 0..max (default 100, hue uses degrees) */
  max?: number;
  part: string;
  className?: string;
  style?: CSSProperties;
  checker?: boolean;
}

function Track({ value, read, onValue, onCommit, background, thumbColor, label, valueText, max = 100, part, className, style, checker }: TrackProps) {
  const ref = usePointerDrag<HTMLDivElement>({
    inset: thumbInset,
    onMove: (p) => onValue(p.x),
    onEnd: onCommit,
    // horizontal two-finger swipes move the thumb; vertical ones scroll the page as usual
    onWheel: ({ dx, dy, rect }) => {
      if (Math.abs(dx) <= Math.abs(dy)) return false;
      onValue(Math.min(1, Math.max(0, read() + dx / rect.width)));
      return true;
    },
    onWheelEnd: onCommit,
  });
  const onKeyDown = (e: KeyboardEvent) => {
    const step = keyStep(e, 0.01, 0.1);
    let next: number | null = step === null ? null : value + step;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = 1;
    if (next === null) return;
    e.preventDefault();
    onValue(Math.min(1, Math.max(0, next)));
  };
  return (
    <div
      ref={ref}
      data-part={part}
      data-slider=""
      data-checker={checker ? "" : undefined}
      className={className}
      style={{ "--_cs-track": background, "--_cs-x": value, "--_cs-thumb-color": thumbColor, ...style } as CSSProperties}
    >
      <div
        data-part="slider-thumb"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * max)}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
        onKeyUp={onCommit}
      />
    </div>
  );
}

export interface SliderProps {
  className?: string;
  style?: CSSProperties;
}

const HUE_TRACK =
  "linear-gradient(90deg, #f00 0%, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00 100%)";

/** Hue slider. Follows the root `space`: HSV hue, or OKLCH hue (perceptually even). */
export function Hue(props: SliderProps) {
  return usePickerContext().space === "oklch" ? <OklchHue {...props} /> : <HsvHue {...props} />;
}

const OklchHue = /* @__PURE__ */ memo(function OklchHue(props: SliderProps) {
  const { store, labels, hueMemory } = usePickerContext();
  const { l, c, h, a } = useOklch();
  return (
    <Track
      {...props}
      part="hue"
      value={h / 360}
      read={() => hueMemory.current / 360}
      onValue={(t) => {
        hueMemory.current = t * 360;
        store.setColor({ space: "oklch", coords: [l, c, t * 360], alpha: a === 0 ? 1 : a });
      }}
      onCommit={() => store.commit()}
      background={OKLCH_HUE_TRACK}
      thumbColor={`oklch(0.72 0.16 ${num(h, 1)})`}
      label={labels.hue}
      max={360}
      valueText={fill(labels.degrees, { value: Math.round(h) })}
    />
  );
});

const HsvHue = /* @__PURE__ */ memo(function HsvHue(props: SliderProps) {
  const { store, labels } = usePickerContext();
  const h = usePicker((s) => s.hsva.h);
  return (
    <Track
      {...props}
      part="hue"
      value={h / 360}
      read={() => store.getState().hsva.h / 360}
      onValue={(t) => store.setHsva({ h: t * 360 })}
      onCommit={() => store.commit()}
      background={HUE_TRACK}
      thumbColor={`hsl(${h} 100% 50%)`}
      label={labels.hue}
      max={360}
      valueText={fill(labels.degrees, { value: Math.round(h) })}
    />
  );
});

export const Alpha = /* @__PURE__ */ memo(function Alpha(props: SliderProps) {
  const { store, labels } = usePickerContext();
  const { h, s, v, a } = usePicker((st) => st.hsva);
  const [r, g, b] = hsvToRgb(h, s, v);
  const solid = formatColor({ space: "srgb", coords: [r, g, b], alpha: 1 }, "rgb", { legacy: false });
  const clear = formatColor({ space: "srgb", coords: [r, g, b], alpha: 0 }, "rgb", { legacy: false });
  const current = formatColor({ space: "srgb", coords: [r, g, b], alpha: a }, "rgb", { legacy: false });
  return (
    <Track
      {...props}
      part="alpha"
      checker
      value={a}
      read={() => store.getState().hsva.a}
      onValue={(t) => store.setHsva({ a: Math.round(t * 1000) / 1000 })}
      onCommit={() => store.commit()}
      background={`linear-gradient(90deg, ${clear}, ${solid})`}
      thumbColor={current}
      label={labels.alpha}
      valueText={`${Math.round(a * 100)}%`}
    />
  );
});
