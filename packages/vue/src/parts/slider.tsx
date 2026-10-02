import { defineComponent } from "vue";
import { formatColor, hsvToRgb, num } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { fill } from "../labels";
import { keyStep, thumbInset, usePointerDrag } from "../use-drag";
import { prop } from "../props";
import { OKLCH_HUE_TRACK, useOklch } from "./oklch";

const req = <T,>() => ({ type: prop<T>(), required: true as const });

const Track = /* @__PURE__ */ defineComponent({
  name: "PickerTrack",
  props: {
    value: /* @__PURE__ */ req<number>(), // 0..1
    /** fresh value for wheel gestures, which can fire several times between renders */
    read: /* @__PURE__ */ req<() => number>(),
    onValue: /* @__PURE__ */ req<(t: number) => void>(),
    onCommit: /* @__PURE__ */ req<() => void>(),
    background: /* @__PURE__ */ req<string>(),
    thumbColor: /* @__PURE__ */ req<string>(),
    label: /* @__PURE__ */ req<string>(),
    valueText: /* @__PURE__ */ req<string>(),
    /** the value as the slider reports it: 0..max (default 100, hue uses degrees) */
    max: { type: Number, default: 100 },
    part: /* @__PURE__ */ req<string>(),
    checker: Boolean,
  },
  setup(props) {
    const dragRef = usePointerDrag<HTMLDivElement>({
      inset: thumbInset,
      onMove: (p) => props.onValue(p.x),
      onEnd: () => props.onCommit(),
      // horizontal two-finger swipes move the thumb; vertical ones scroll the page as usual
      onWheel: ({ dx, dy, rect }) => {
        if (Math.abs(dx) <= Math.abs(dy)) return false;
        props.onValue(Math.min(1, Math.max(0, props.read() + dx / rect.width)));
        return true;
      },
      onWheelEnd: () => props.onCommit(),
    });
    const onKeyDown = (e: KeyboardEvent) => {
      const step = keyStep(e, 0.01, 0.1);
      let next: number | null = step === null ? null : props.value + step;
      if (e.key === "Home") next = 0;
      if (e.key === "End") next = 1;
      if (next === null) return;
      e.preventDefault();
      props.onValue(Math.min(1, Math.max(0, next)));
    };
    return () => (
      <div
        ref={dragRef}
        data-part={props.part}
        data-slider=""
        data-checker={props.checker ? "" : undefined}
        style={{ "--_cs-track": props.background, "--_cs-x": props.value, "--_cs-thumb-color": props.thumbColor }}
      >
        <div
          data-part="slider-thumb"
          role="slider"
          tabindex={0}
          aria-label={props.label}
          aria-valuemin={0}
          aria-valuemax={props.max}
          aria-valuenow={Math.round(props.value * props.max)}
          aria-valuetext={props.valueText}
          onKeydown={onKeyDown}
          onKeyup={() => props.onCommit()}
        />
      </div>
    );
  },
});

const HUE_TRACK =
  "linear-gradient(90deg, #f00 0%, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00 100%)";

const OklchHue = /* @__PURE__ */ defineComponent({
  name: "PickerOklchHue",
  setup() {
    const ctx = usePickerContext();
    const { store, hueMemory } = ctx;
    const oklch = useOklch();
    const read = () => hueMemory.current / 360;
    const onValue = (t: number) => {
      const { l, c, a } = oklch.value;
      hueMemory.current = t * 360;
      store.setColor({ space: "oklch", coords: [l, c, t * 360], alpha: a === 0 ? 1 : a });
    };
    const onCommit = () => store.commit();
    return () => {
      const { h } = oklch.value;
      return (
        <Track
          part="hue"
          value={h / 360}
          read={read}
          onValue={onValue}
          onCommit={onCommit}
          background={OKLCH_HUE_TRACK}
          thumbColor={`oklch(0.72 0.16 ${num(h, 1)})`}
          label={ctx.labels.hue}
          max={360}
          valueText={fill(ctx.labels.degrees, { value: Math.round(h) })}
        />
      );
    };
  },
});

const HsvHue = /* @__PURE__ */ defineComponent({
  name: "PickerHsvHue",
  setup() {
    const ctx = usePickerContext();
    const { store } = ctx;
    const h = usePicker((s) => s.hsva.h);
    const read = () => store.getState().hsva.h / 360;
    const onValue = (t: number) => store.setHsva({ h: t * 360 });
    const onCommit = () => store.commit();
    return () => (
      <Track
        part="hue"
        value={h.value / 360}
        read={read}
        onValue={onValue}
        onCommit={onCommit}
        background={HUE_TRACK}
        thumbColor={`hsl(${h.value} 100% 50%)`}
        label={ctx.labels.hue}
        max={360}
        valueText={fill(ctx.labels.degrees, { value: Math.round(h.value) })}
      />
    );
  },
});

/** Hue slider. Follows the root `space`: HSV hue, or OKLCH hue (perceptually even). */
export const Hue = /* @__PURE__ */ defineComponent({
  name: "PickerHue",
  setup() {
    const ctx = usePickerContext();
    return () => (ctx.space === "oklch" ? <OklchHue /> : <HsvHue />);
  },
});

/** Opacity slider over a checkerboard. */
export const Alpha = /* @__PURE__ */ defineComponent({
  name: "PickerAlpha",
  setup() {
    const ctx = usePickerContext();
    const { store } = ctx;
    const hsva = usePicker((st) => st.hsva);
    const read = () => store.getState().hsva.a;
    const onValue = (t: number) => store.setHsva({ a: Math.round(t * 1000) / 1000 });
    const onCommit = () => store.commit();
    return () => {
      const { h, s, v, a } = hsva.value;
      const [r, g, b] = hsvToRgb(h, s, v);
      const solid = formatColor({ space: "srgb", coords: [r, g, b], alpha: 1 }, "rgb", { legacy: false });
      const clear = formatColor({ space: "srgb", coords: [r, g, b], alpha: 0 }, "rgb", { legacy: false });
      const current = formatColor({ space: "srgb", coords: [r, g, b], alpha: a }, "rgb", { legacy: false });
      return (
        <Track
          part="alpha"
          checker
          value={a}
          read={read}
          onValue={onValue}
          onCommit={onCommit}
          background={`linear-gradient(90deg, ${clear}, ${solid})`}
          thumbColor={current}
          label={ctx.labels.alpha}
          valueText={`${Math.round(a * 100)}%`}
        />
      );
    };
  },
});
