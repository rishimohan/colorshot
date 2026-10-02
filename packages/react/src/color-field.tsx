import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isGradient, parseColor, parseGradient, parseLayers, safeCssValue, toHexDigits } from "@colorshot/core";
import { ColorPicker, type ColorPickerProps } from "./color-picker";
import { useIsoLayoutEffect } from "./context";
import { defaultLabels, fill, type Labels } from "./labels";

export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start";

export interface ColorFieldProps extends Omit<ColorPickerProps, "value" | "defaultValue" | "onChange" | "className" | "style"> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** controlled open state */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** preferred side; flips and shifts to stay on screen (default `bottom-start`) */
  placement?: Placement;
  /** gap between the trigger and the picker in px (default 6) */
  offset?: number;
  /** render the picker in a portal on `document.body` (default) or inside a given element; `false` renders inline */
  portal?: boolean | HTMLElement | null;
  disabled?: boolean;
  /** accessible name of the trigger, e.g. "Fill" (default: the `picker` label) */
  label?: string;
  /** text when the value is empty (default: the `none` label) */
  placeholder?: string;
  /** replace the trigger's contents */
  renderTrigger?: (state: { value: string; open: boolean }) => ReactNode;
  className?: string;
  style?: CSSProperties;
  /** class and style for the picker inside the popover */
  pickerClassName?: string;
  pickerStyle?: CSSProperties;
}

export interface ColorFieldHandle {
  open: () => void;
  close: () => void;
  trigger: HTMLButtonElement | null;
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

/** Elements Tab stops on inside `root`, in order. */
function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]")).filter(
    (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0,
  );
}

/**
 * A swatch button that opens the picker in a popover: positions itself on screen, closes on Escape,
 * outside click or tab-away, and returns focus to the trigger. The popover is not modal: tabbing past its
 * last control (or before its first) closes it and puts focus back on the trigger, so Tab continues from there.
 */
export const ColorField = /* @__PURE__ */ forwardRef<ColorFieldHandle, ColorFieldProps>(function ColorField(
  {
    value: valueProp,
    defaultValue = "",
    onChange,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    placement = "bottom-start",
    offset = 6,
    portal = true,
    disabled,
    label,
    placeholder,
    renderTrigger,
    className,
    style,
    pickerClassName,
    pickerStyle,
    theme,
    ...pickerProps
  },
  ref,
) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  const value = valueProp ?? innerValue;
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = openProp ?? innerOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // a press inside the popover can move focus to the page (blank space is not focusable); that is not leaving it
  const pressing = useRef(false);
  const id = useId();
  const labels = { ...defaultLabels, ...pickerProps.labels };
  const name = label ?? labels.picker;

  const setOpen = useCallback(
    (next: boolean, focusTrigger = false) => {
      if (openProp === undefined) setInnerOpen(next);
      onOpenChange?.(next);
      if (!next && focusTrigger) triggerRef.current?.focus();
    },
    [openProp, onOpenChange],
  );

  useImperativeHandle(ref, () => ({ open: () => setOpen(true), close: () => setOpen(false), trigger: triggerRef.current }), [setOpen]);

  const handleChange = (v: string) => {
    if (valueProp === undefined) setInnerValue(v);
    onChange?.(v);
  };

  // position: on open, on scroll / resize, and when the picker changes size (switching to a gradient)
  useIsoLayoutEffect(() => {
    if (!open || !popRef.current || !triggerRef.current) return;
    const pop = popRef.current;
    let frame = 0;
    // the side is chosen once when opening; after that the picker only shifts, so it does not jump
    // to the other side when it grows (switching to a gradient) or while scrolling
    let locked: Placement | null = null;
    const update = () => {
      frame = 0;
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const { x, y, side } = position(r, { width: pop.offsetWidth, height: pop.offsetHeight }, locked ?? placement, offset, Boolean(locked));
      if (!locked) locked = `${side}-${placement.split("-")[1]}` as Placement;
      pop.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      pop.dataset.side = side;
      pop.style.visibility = "visible";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    ro?.observe(pop);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [open, placement, offset]);

  // focus the first control when opened, close on outside press
  useEffect(() => {
    if (!open) return;
    const pop = popRef.current;
    pop?.querySelector<HTMLElement>("[data-part='mode-tabs'] [tabindex='0'], [data-part='area-thumb'], button, input")?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (pop?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, setOpen]);

  const { text, alpha } = describe(value, placeholder ?? labels.none, labels);
  const target = portal === true ? (typeof document !== "undefined" ? document.body : null) : portal || null;

  const popover = open ? (
    <div
      ref={popRef}
      id={`${id}-popover`}
      role="dialog"
      aria-label={name}
      data-part="popover"
      data-colorshot-popover=""
      data-inline={target ? undefined : ""}
      style={{ visibility: "hidden" }}
      onKeyDown={(e) => {
        if (e.defaultPrevented) return;
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false, true);
        } else if (e.key === "Tab") {
          // Tab past the last control or Shift+Tab before the first: close, and Tab goes on from the trigger
          const list = tabbables(e.currentTarget);
          if (document.activeElement === (e.shiftKey ? list[0] : list[list.length - 1])) {
            e.preventDefault();
            setOpen(false, true);
          }
        }
      }}
      onPointerDown={() => {
        pressing.current = true;
        document.addEventListener("pointerup", () => (pressing.current = false), { once: true, capture: true });
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        // focus moved outside (a click on another control): close
        if (next) {
          if (!popRef.current?.contains(next) && !triggerRef.current?.contains(next)) setOpen(false);
          return;
        }
        if (pressing.current) return;
        // focus went nowhere: the focused control was removed, or the window lost focus. Parts that move focus to a
        // neighbour do it in the next frame; if focus is still lost after that, close and go back to the trigger
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (!document.hasFocus() || (active && active !== document.body)) return;
          setOpen(false, true);
        });
      }}
    >
      <ColorPicker {...pickerProps} theme={theme} value={value} onChange={handleChange} className={pickerClassName} style={pickerStyle} />
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-colorshot-field=""
        data-theme={theme}
        data-state={open ? "open" : "closed"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-popover` : undefined}
        aria-label={`${name}: ${text}`}
        disabled={disabled}
        className={className}
        style={style}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {renderTrigger ? (
          renderTrigger({ value, open })
        ) : (
          <>
            <span data-part="field-swatch" style={{ "--_cs-swatch": safeCssValue(value) } as CSSProperties} aria-hidden />
            <span data-part="field-text">{text}</span>
            {alpha !== null && <span data-part="field-alpha">{alpha}%</span>}
          </>
        )}
      </button>
      {popover && (target ? createPortal(popover, target) : popover)}
    </>
  );
});
