import { computed, defineComponent, ref, Teleport, useId, watchPostEffect, type ExtractPublicPropTypes, type SlotsType, type StyleValue, type VNodeChild } from "vue";
import { isGradient, parseColor, parseGradient, parseLayers, safeCssValue, toHexDigits } from "@colorshot/core";
import { ColorPicker, colorPickerProps } from "./color-picker";
import { defaultLabels, fill, type Labels } from "./labels";
import { bool, boolOr, merge, omit, prop } from "./props";

export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start";

const pickerProps = /* @__PURE__ */ omit(colorPickerProps, "modelValue", "defaultValue");
const pickerKeys = /* @__PURE__ */ Object.keys(pickerProps) as (keyof typeof pickerProps)[];

export const colorFieldProps = /* @__PURE__ */ merge(pickerProps, {
  /** the value (`v-model`) */
  modelValue: String,
  defaultValue: { type: String, default: "" },
  /** controlled open state (`v-model:open`) */
  open: { type: Boolean, default: undefined },
  defaultOpen: /* @__PURE__ */ bool(),
  /** preferred side; flips and shifts to stay on screen (default `bottom-start`) */
  placement: { type: prop<Placement>(), default: "bottom-start" },
  /** gap between the trigger and the picker in px (default 6) */
  offset: { type: Number, default: 6 },
  /** render the picker on `document.body` (default) or inside a given element; `false` renders inline */
  portal: /* @__PURE__ */ boolOr<HTMLElement | null>(Object, true),
  disabled: /* @__PURE__ */ bool(),
  /** accessible name of the trigger, e.g. "Fill" (default: the `picker` label) */
  label: String,
  /** text when the value is empty (default: the `none` label) */
  placeholder: String,
  /** class and style for the picker inside the popover */
  pickerClass: prop<unknown>(),
  pickerStyle: prop<StyleValue>(),
});

export type ColorFieldProps = ExtractPublicPropTypes<typeof colorFieldProps>;

export interface ColorFieldHandle {
  open: () => void;
  close: () => void;
  readonly trigger: HTMLButtonElement | null;
}

const MARGIN = 8;

/** Place `pop` next to `anchor`, flipping to the other side and shifting to stay inside the viewport. */
function position(anchor: DOMRect, pop: { width: number; height: number }, placement: Placement, offset: number, noFlip = false) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const [side, align] = placement.split("-") as ["bottom" | "top" | "right" | "left", "start" | "end"];
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
  let x: number;
  let y: number;
  let resolved = side;
  if (side === "bottom" || side === "top") {
    const below = vh - anchor.bottom - offset - MARGIN;
    const above = anchor.top - offset - MARGIN;
    resolved = noFlip ? side : side === "bottom" ? (pop.height <= below || below >= above ? "bottom" : "top") : pop.height <= above || above >= below ? "top" : "bottom";
    y = resolved === "bottom" ? anchor.bottom + offset : anchor.top - offset - pop.height;
    x = align === "start" ? anchor.left : anchor.right - pop.width;
  } else {
    const right = vw - anchor.right - offset - MARGIN;
    const left = anchor.left - offset - MARGIN;
    resolved = noFlip ? side : side === "right" ? (pop.width <= right || right >= left ? "right" : "left") : pop.width <= left || left >= right ? "left" : "right";
    x = resolved === "right" ? anchor.right + offset : anchor.left - offset - pop.width;
    y = anchor.top;
  }
  return {
    x: clamp(x, MARGIN, vw - pop.width - MARGIN),
    y: clamp(y, MARGIN, vh - pop.height - MARGIN),
    side: resolved,
  };
}

function describe(value: string, placeholder: string, labels: Labels): { text: string; alpha: number | null } {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return { text: placeholder, alpha: null };
  if (isGradient(v)) {
    const g = parseGradient(parseLayers(v).find((l) => l.kind === "gradient")?.raw ?? "");
    return { text: fill(labels.gradientValue, { type: g ? labels[g.type] : "" }).trim(), alpha: null };
  }
  const p = parseColor(v);
  if (!p) return { text: v, alpha: null };
  const alpha = p.color.alpha < 1 ? Math.round(p.color.alpha * 100) : null;
  if (p.keyword && p.keyword !== "transparent") return { text: p.keyword, alpha };
  // sRGB formats read best as hex; wide-gamut values are shown as written
  if (["hex", "rgb", "hsl", "hwb"].includes(p.format)) return { text: `#${toHexDigits(p.color)}`, alpha };
  return { text: v, alpha };
}

const ev = <A extends unknown[]>() => null as unknown as (...args: A) => true;

/** Elements Tab stops on inside `root`, in order. */
function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]")).filter(
    (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0,
  );
}

/**
 * A swatch button that opens the picker in a popover: positions itself on screen, closes on Escape,
 * outside click or tab-away, and returns focus to the trigger. The popover is not modal: tabbing past its
 * last control (or before its first) closes it and puts focus back on the trigger, so Tab continues from there. `class` and `style` go on the trigger;
 * other attributes and listeners go to the picker. The `trigger` slot (`{ value, open }`) replaces the trigger's contents.
 */
export const ColorField = /* @__PURE__ */ defineComponent({
  name: "ColorField",
  inheritAttrs: false,
  props: colorFieldProps,
  emits: { "update:modelValue": ev<[string]>(), change: ev<[string]>(), changeComplete: ev<[string]>(), "update:open": ev<[boolean]>() },
  slots: Object as SlotsType<{ trigger?: (state: { value: string; open: boolean }) => VNodeChild }>,
  setup(props, { attrs, slots, emit, expose }) {
    const innerValue = ref(props.defaultValue);
    const value = computed(() => props.modelValue ?? innerValue.value);
    const innerOpen = ref(props.defaultOpen);
    const isOpen = computed(() => props.open ?? innerOpen.value);
    const triggerRef = ref<HTMLButtonElement | null>(null);
    const popRef = ref<HTMLDivElement | null>(null);
    // a press inside the popover can move focus to the page (blank space is not focusable); that is not leaving it
    let pressing = false;
    const id = useId();
    const labels = computed<Labels>(() => ({ ...defaultLabels, ...props.labels }));

    const setOpen = (next: boolean, focusTrigger = false) => {
      if (props.open === undefined) innerOpen.value = next;
      emit("update:open", next);
      if (!next && focusTrigger) triggerRef.value?.focus();
    };

    expose({
      open: () => setOpen(true),
      close: () => setOpen(false),
      get trigger() {
        return triggerRef.value;
      },
    } satisfies ColorFieldHandle);

    const handleChange = (v: string) => {
      if (props.modelValue === undefined) innerValue.value = v;
      emit("update:modelValue", v);
      emit("change", v);
    };

    // position: on open, on scroll / resize, and when the picker changes size (switching to a gradient).
    // Registered before the focus effect below, so the popover is visible (focusable) when that runs.
    watchPostEffect((onCleanup) => {
      const pop = popRef.value;
      const { placement, offset } = props;
      if (!isOpen.value || !pop || !triggerRef.value) return;
      let frame = 0;
      // the side is chosen once when opening; after that the picker only shifts, so it does not jump
      // to the other side when it grows (switching to a gradient) or while scrolling
      let locked: Placement | null = null;
      const update = () => {
        frame = 0;
        const trigger = triggerRef.value;
        if (!trigger) return;
        const r = trigger.getBoundingClientRect();
        const { x, y, side } = position(r, { width: pop.offsetWidth, height: pop.offsetHeight }, locked ?? placement, offset, Boolean(locked));
        if (!locked) locked = `${side}-${placement.split("-")[1]}` as Placement;
        pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        pop.dataset.side = side;
        pop.style.visibility = "visible";
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      // hidden until placed; set here rather than in the render, which would hide it again on every update
      pop.style.visibility = "hidden";
      update();
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
      ro?.observe(pop);
      window.addEventListener("scroll", schedule, true);
      window.addEventListener("resize", schedule);
      onCleanup(() => {
        if (frame) cancelAnimationFrame(frame);
        ro?.disconnect();
        window.removeEventListener("scroll", schedule, true);
        window.removeEventListener("resize", schedule);
      });
    });

    // focus the first control when opened, close on outside press
    watchPostEffect((onCleanup) => {
      const pop = popRef.value;
      if (!isOpen.value || !pop) return;
      pop.querySelector<HTMLElement>("[data-part='mode-tabs'] [tabindex='0'], [data-part='area-thumb'], button, input")?.focus({ preventScroll: true });
      const onDown = (e: PointerEvent) => {
        const t = e.target as Node;
        if (pop.contains(t) || triggerRef.value?.contains(t)) return;
        setOpen(false);
      };
      document.addEventListener("pointerdown", onDown, true);
      onCleanup(() => document.removeEventListener("pointerdown", onDown, true));
    });

    const onPickerComplete = (v: string) => emit("changeComplete", v);

    return () => {
      const open = isOpen.value;
      const v = value.value;
      const { class: cls, style, ...rest } = attrs;
      const name = props.label ?? labels.value.picker;
      const { text, alpha } = describe(v, props.placeholder ?? labels.value.none, labels.value);
      const portal = props.portal;
      const target = portal === true ? (typeof document !== "undefined" ? document.body : null) : portal || null;
      const picker = Object.fromEntries(pickerKeys.map((k) => [k, props[k]]));

      const popover = open ? (
        <div
          ref={popRef}
          id={`${id}-popover`}
          role="dialog"
          aria-label={name}
          data-part="popover"
          data-colorshot-popover=""
          data-inline={target ? undefined : ""}
          onKeydown={(e) => {
            if (e.defaultPrevented) return;
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false, true);
            } else if (e.key === "Tab") {
              // Tab past the last control or Shift+Tab before the first: close, and Tab goes on from the trigger
              const list = tabbables(e.currentTarget as HTMLElement);
              if (document.activeElement === (e.shiftKey ? list[0] : list[list.length - 1])) {
                e.preventDefault();
                setOpen(false, true);
              }
            }
          }}
          onPointerdown={() => {
            pressing = true;
            document.addEventListener("pointerup", () => (pressing = false), { once: true, capture: true });
          }}
          onFocusout={(e) => {
            const next = e.relatedTarget as Node | null;
            // focus moved outside (a click on another control): close
            if (next) {
              if (!popRef.value?.contains(next) && !triggerRef.value?.contains(next)) setOpen(false);
              return;
            }
            if (pressing) return;
            // focus went nowhere: the focused control was removed, or the window lost focus. Parts that move focus to a
            // neighbour do it in the next frame; if focus is still lost after that, close and go back to the trigger
            requestAnimationFrame(() => {
              const active = document.activeElement;
              if (!document.hasFocus() || (active && active !== document.body)) return;
              setOpen(false, true);
            });
          }}
        >
          <ColorPicker
            {...rest}
            {...picker}
            modelValue={v}
            onChange={handleChange}
            onChangeComplete={onPickerComplete}
            class={props.pickerClass}
            style={props.pickerStyle}
          />
        </div>
      ) : null;

      return [
        <button
          ref={triggerRef}
          type="button"
          data-colorshot-field=""
          data-theme={props.theme}
          data-state={open ? "open" : "closed"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-popover` : undefined}
          aria-label={`${name}: ${text}`}
          disabled={props.disabled}
          class={cls}
          style={style as StyleValue}
          onClick={() => setOpen(!open)}
          onKeydown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          {slots.trigger
            ? slots.trigger({ value: v, open })
            : [
                <span data-part="field-swatch" style={{ "--_cs-swatch": safeCssValue(v) }} aria-hidden="true" />,
                <span data-part="field-text">{text}</span>,
                alpha !== null ? <span data-part="field-alpha">{alpha}%</span> : null,
              ]}
        </button>,
        popover && target ? <Teleport to={target}>{popover}</Teleport> : popover,
      ];
    };
  },
});
