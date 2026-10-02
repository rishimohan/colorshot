import { defineComponent } from "vue";
import { gradientAngle, gradientCenter, safeCssValue, serializeGradient } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { MoreIcon, PlusIcon, SwapIcon, TargetIcon, TrashIcon } from "../icons";
import { fill, type Labels } from "../labels";
import { isRtl, keyStep, usePointerDrag } from "../use-drag";
import { bool } from "../props";
import { insertStop } from "./gradient-bar";
import { NumberField } from "./number-field";
import { Menu, type MenuItem } from "./menu";

/** Drag around the dial to set an angle. Shift snaps to 15°. Arrow keys step, Home / End go to the ends. */
export const AngleDial = /* @__PURE__ */ defineComponent({
  name: "PickerAngleDial",
  setup() {
    const ctx = usePickerContext();
    const { store } = ctx;
    const angle = usePicker((s) => (s.gradient && s.gradient.type !== "radial" ? gradientAngle(s.gradient) : null));
    const dialRef = usePointerDrag<HTMLDivElement>({
      onMove: (p) => {
        const cx = p.rect.left + p.rect.width / 2;
        const cy = p.rect.top + p.rect.height / 2;
        let deg = (Math.atan2(p.clientX - cx, cy - p.clientY) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        deg = p.event.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
        store.setAngle(deg % 360);
      },
      onEnd: () => store.commit(),
      onWheel: ({ dx, dy }) => {
        const st = store.getState();
        if (!st.gradient || st.gradient.type === "radial") return false;
        store.setAngle(gradientAngle(st.gradient) + (dx - dy) * 0.5);
        return true;
      },
      onWheelEnd: () => store.commit(),
    });
    const onKeyDown = (e: KeyboardEvent) => {
      const step = keyStep(e, 1, 15);
      if (angle.value === null) return;
      // 360 is 0 again, so End stops one degree short
      const next = e.key === "Home" ? 0 : e.key === "End" ? 359 : step === null ? null : angle.value + step;
      if (next === null) return;
      e.preventDefault();
      store.setAngle(next);
    };
    return () => {
      const a = angle.value;
      if (a === null) return null;
      return (
        <div ref={dialRef} data-part="angle-dial" style={{ "--_cs-angle": `${a}deg` }}>
          <div
            data-part="angle-handle"
            role="slider"
            tabindex={0}
            aria-label={ctx.labels.angle}
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(a)}
            aria-valuetext={fill(ctx.labels.degrees, { value: Math.round(a) })}
            onKeydown={onKeyDown}
            onKeyup={() => store.commit()}
          />
        </div>
      );
    };
  },
});

/** Drag the dot to move a radial or conic center. The pad shows the live gradient. */
export const CenterPad = /* @__PURE__ */ defineComponent({
  name: "PickerCenterPad",
  setup() {
    const ctx = usePickerContext();
    const { store } = ctx;
    const pad = usePicker(
      (s) => ({
        center: s.gradient && s.gradient.type !== "linear" ? gradientCenter(s.gradient) : null,
        preview: s.gradient && s.gradient.type !== "linear" ? serializeGradient(s.gradient) : null,
      }),
      (a, b) => a.preview === b.preview,
    );
    const padRef = usePointerDrag<HTMLDivElement>({
      onStart: () => (pad.value.center ? undefined : false),
      onMove: (p) => {
        let x = p.x * 100;
        let y = p.y * 100;
        if (p.event.shiftKey) {
          x = Math.round(x / 25) * 25;
          y = Math.round(y / 25) * 25;
        }
        store.setCenter(x, y);
      },
      onEnd: () => store.commit(),
    });
    const onKeyDown = (e: KeyboardEvent) => {
      const { center } = pad.value;
      if (!center) return;
      const step = keyStep(e, 1, 10);
      if (step === null) return;
      e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") store.setCenter(center.x + step, center.y);
      else store.setCenter(center.x, center.y - step);
    };
    return () => {
      const { center, preview } = pad.value;
      if (!preview) return null;
      return (
        <div
          ref={padRef}
          data-part="center-pad"
          data-checker=""
          data-disabled={center ? undefined : ""}
          style={{ "--_cs-preview": safeCssValue(preview), "--_cs-x": (center?.x ?? 50) / 100, "--_cs-y": (center?.y ?? 50) / 100 }}
        >
          {center ? (
            <div
              data-part="center-handle"
              role="slider"
              tabindex={0}
              aria-label={ctx.labels.center}
              aria-valuetext={fill(ctx.labels.centerValue, { x: Math.round(center.x), y: Math.round(center.y) })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(center.x)}
              onKeydown={onKeyDown}
              onKeyup={() => store.commit()}
            />
          ) : null}
        </div>
      );
    };
  },
});

/** The selected stop's position in %. Its own part, so moving a stop does not re-render the whole row. */
const StopPosition = /* @__PURE__ */ defineComponent({
  name: "PickerStopPosition",
  setup() {
    const ctx = usePickerContext();
    const { store } = ctx;
    const stop = usePicker((s) => {
      const i = s.stops.findIndex((st) => st.id === s.selectedStopId);
      return i === -1 ? null : { id: s.stops[i].id, at: s.offsets[i] };
    });
    return () => {
      const st = stop.value;
      if (!st) return null;
      return (
        <NumberField
          field="stop"
          label="%"
          labelPosition="end"
          ariaLabel={ctx.labels.stopPosition}
          value={st.at * 100}
          min={0}
          max={100}
          onValue={(v: number) => store.moveStop(st.id, v / 100)}
          onCommit={() => store.commit()}
        />
      );
    };
  },
});

/** Blending spaces as [CSS value, menu text]. Space names are not translated; the words around them are labels. */
const interpolations = (labels: Labels): [string, string][] => [
  ["", "sRGB"],
  ["oklab", "OKLab"],
  ["oklch", "OKLCH"],
  ["oklch longer hue", fill(labels.longHue, { space: "OKLCH" })],
  ["srgb-linear", labels.linearRgb],
  ["lab", "Lab"],
  ["lch", "LCH"],
  ["hsl", "HSL"],
  ["hsl longer hue", fill(labels.longHue, { space: "HSL" })],
];
const SIZES = ["farthest-corner", "farthest-side", "closest-corner", "closest-side"] as const;
const SIZE_LABELS: Record<(typeof SIZES)[number], keyof Labels> = {
  "farthest-corner": "farthestCorner",
  "farthest-side": "farthestSide",
  "closest-corner": "closestCorner",
  "closest-side": "closestSide",
};
const SHAPES = ["circle", "ellipse"] as const;

/**
 * One row of gradient settings: center (radial / conic), shape or angle, the selected stop's position (linear / conic), reverse,
 * and a menu with blending, size, repeat, add stop and remove stop.
 */
export const GradientControls = /* @__PURE__ */ defineComponent({
  name: "PickerGradientControls",
  props: {
    /** show the color blending choices in the menu (default true) */
    interpolation: /* @__PURE__ */ bool(true),
  },
  setup(props) {
    const ctx = usePickerContext();
    const { store, notify } = ctx;
    const slice = usePicker(
      (s) =>
        s.gradient && {
          type: s.gradient.type,
          angle: s.gradient.type !== "radial" ? gradientAngle(s.gradient) : 0,
          shape: s.gradient.shape ?? "ellipse",
          size: s.gradient.size,
          interp: s.gradient.interpolation ?? "",
          repeating: s.gradient.repeating,
          canRemove: s.stops.length > 2,
          centered: !s.gradient.position,
        },
    );
    const done = () => store.commit();

    // radio group: one shape in the tab order, arrow keys pick the other one
    const onShapeKeyDown = (e: KeyboardEvent) => {
      const el = e.currentTarget as HTMLElement;
      const rtl = isRtl(el);
      const i = SHAPES.indexOf(slice.value?.shape as (typeof SHAPES)[number]);
      let next: number | null = null;
      if (e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (i + 1) % SHAPES.length;
      else if (e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (i - 1 + SHAPES.length) % SHAPES.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = SHAPES.length - 1;
      if (next === null) return;
      e.preventDefault();
      store.setShape(SHAPES[next]);
      done();
      el.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus();
    };

    return () => {
      const g = slice.value;
      if (!g) return null;
      const labels = ctx.labels;

      const items: MenuItem[] = [];
      if (props.interpolation) {
        items.push({ type: "heading", label: labels.interpolation });
        const list = interpolations(labels);
        const known = list.some(([v]) => v === g.interp);
        for (const [value, label] of known ? list : [...list, [g.interp, g.interp] as [string, string]]) {
          items.push({ type: "radio", label, checked: g.interp === value, onSelect: () => (store.setInterpolation(value || null), done()) });
        }
      }
      if (g.type === "radial") {
        items.push({ type: "separator" }, { type: "heading", label: labels.size });
        const custom = g.size && !SIZES.includes(g.size as (typeof SIZES)[number]) ? g.size : null;
        for (const size of SIZES) {
          const checked = (g.size ?? "farthest-corner") === size;
          items.push({ type: "radio", label: labels[SIZE_LABELS[size]], checked, onSelect: () => (store.setSize(size === "farthest-corner" ? null : size), done()) });
        }
        if (custom) items.push({ type: "radio", label: custom, checked: true, onSelect: () => {} });
      }
      items.push({ type: "separator" });
      items.push({ type: "checkbox", label: labels.repeating, checked: g.repeating, onSelect: () => (store.setRepeating(!g.repeating), done()) });
      if (g.type !== "linear") {
        items.push({ type: "action", label: labels.resetCenter, icon: <TargetIcon />, disabled: g.centered, onSelect: () => (store.setCenter(50, 50), done()) });
      }
      items.push({
        type: "action",
        label: labels.addStop,
        icon: <PlusIcon />,
        onSelect: () => {
          if (!insertStop(store)) return;
          done();
          notify(labels.stopAdded, true);
        },
      });
      items.push({
        type: "action",
        label: labels.removeStop,
        icon: <TrashIcon />,
        hint: "⌫",
        hintLabel: labels.backspace,
        disabled: !g.canRemove,
        onSelect: () => {
          store.removeStop();
          done();
          notify(labels.stopRemoved, true);
        },
      });

      return (
        <div data-part="gradient-controls" data-type={g.type}>
          {g.type !== "linear" ? <CenterPad /> : null}
          {g.type === "radial" ? (
            <div
              data-part="segmented"
              role="radiogroup"
              aria-label={labels.shape}
              style={{ "--_cs-index": g.shape === "circle" ? 0 : 1, "--_cs-count": 2 }}
              onKeydown={onShapeKeyDown}
            >
              <span data-part="segmented-indicator" aria-hidden="true" />
              {SHAPES.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  role="radio"
                  aria-checked={g.shape === shape}
                  data-state={g.shape === shape ? "active" : "inactive"}
                  tabindex={g.shape === shape ? 0 : -1}
                  onClick={() => {
                    store.setShape(shape);
                    done();
                  }}
                >
                  <span data-part="shape-icon" data-shape={shape} aria-hidden="true" />
                  <span>{labels[shape]}</span>
                </button>
              ))}
            </div>
          ) : (
            [
              <AngleDial />,
              <NumberField
                field="angle"
                label="°"
                labelPosition="end"
                ariaLabel={labels.angle}
                value={g.angle}
                min={0}
                max={360}
                wrap
                digits={1}
                onValue={(v: number) => store.setAngle(v)}
                onCommit={done}
              />,
            ]
          )}
          <span data-part="spacer" />
          {/* the radial row (center, shape) has no room left at the default size; its stops still move with the arrow keys */}
          {g.type !== "radial" ? <StopPosition /> : null}
          <button type="button" data-part="icon-button" data-tooltip={labels.reverse} aria-label={labels.reverse} onClick={() => (store.reverse(), done())}>
            <SwapIcon />
          </button>
          <Menu trigger={<MoreIcon />} label={labels.moreOptions} items={items} />
        </div>
      );
    };
  },
});
