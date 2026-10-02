import { getCurrentScope, onScopeDispose } from "vue";

export interface DragPoint {
  /** 0..1 within the element, clamped */
  x: number;
  y: number;
  /** raw pointer position, for gestures such as dragging a stop off the bar */
  clientX: number;
  clientY: number;
  rect: DOMRect;
  event: PointerEvent;
}

export interface DragHandlers {
  /** return false to ignore this pointer down */
  onStart?: (p: DragPoint) => boolean | void;
  onMove?: (p: DragPoint) => void;
  onEnd?: (p: DragPoint | null) => void;
  /**
   * Two-finger trackpad swipe (wheel) while hovering. Deltas are in px and follow the fingers
   * (positive x = right, positive y = up). Return true when handled; the page then does not scroll.
   */
  onWheel?: (w: WheelMove) => boolean | void;
  /** called once a wheel gesture has been idle for a moment, like a pointer up */
  onWheelEnd?: () => void;
  /**
   * Horizontal inset in px at each end, so a thumb of that half-width travels inside the track
   * instead of overhanging it. A function is measured once per drag.
   */
  inset?: number | ((el: HTMLElement) => number);
}

export interface WheelMove {
  dx: number;
  dy: number;
  rect: DOMRect;
  event: WheelEvent;
}

// The page's own scrolling wins: a wheel gesture that started outside a control keeps scrolling
// even when the pointer passes over the control.
let lastOutsideWheel = 0;
let wheelTrackerInstalled = false;
function trackOutsideWheel() {
  if (wheelTrackerInstalled || typeof window === "undefined") return;
  wheelTrackerInstalled = true;
  window.addEventListener(
    "wheel",
    (e) => {
      if (!(e.target as Element | null)?.closest?.("[data-wheel]")) lastOutsideWheel = e.timeStamp;
    },
    { capture: true, passive: true },
  );
}

/** A function ref for `ref={...}` that also exposes the element it is attached to. */
export type DragRef<T extends HTMLElement> = ((el: unknown) => void) & { readonly current: T | null };

/**
 * Pointer drag with capture (keeps tracking outside the element and the popover), touch support,
 * one layout read per drag, and moves coalesced to one per animation frame.
 * Handlers are read when they fire, so they can use the latest props and state.
 */
export function usePointerDrag<T extends HTMLElement>(handlers: DragHandlers): DragRef<T> {
  let current: T | null = null;
  let cleanup: (() => void) | null = null;

  // function ref: Vue calls it on every patch, so only (re)attach when the element itself changes,
  // which also covers parts that rendered nothing at first
  const ref = ((el: unknown) => {
    const next = (el as T | null) ?? null;
    if (next === current) return;
    cleanup?.();
    cleanup = null;
    current = next;
    if (next) cleanup = attach(next, handlers);
  }) as DragRef<T>;
  Object.defineProperty(ref, "current", { get: () => current, configurable: true });
  if (getCurrentScope()) onScopeDispose(() => ref(null));
  return ref;
}

function attach(el: HTMLElement, h: DragHandlers): () => void {
  let rect: DOMRect | null = null;
  let pointerId = -1;
  let frame = 0;
  let pending: PointerEvent | null = null;
  let last: DragPoint | null = null;

  let inset = 0;
  const point = (e: PointerEvent): DragPoint => {
    const r = rect!;
    const w = r.width - inset * 2;
    return {
      x: w > 0 ? Math.min(1, Math.max(0, (e.clientX - r.left - inset) / w)) : 0,
      y: r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0,
      clientX: e.clientX,
      clientY: e.clientY,
      rect: r,
      event: e,
    };
  };

  const flush = () => {
    frame = 0;
    if (!pending) return;
    // lets CSS show the cursor again when the pointer leaves the element mid-drag
    const r = rect!;
    const outside = pending.clientX < r.left || pending.clientX > r.right || pending.clientY < r.top || pending.clientY > r.bottom;
    if (outside) el.dataset.outside = "";
    else delete el.dataset.outside;
    last = point(pending);
    pending = null;
    h.onMove?.(last);
  };

  const down = (e: PointerEvent) => {
    if (e.button !== 0 || pointerId !== -1) return;
    rect = el.getBoundingClientRect();
    inset = typeof h.inset === "function" ? h.inset(el) : h.inset ?? 0;
    const p = point(e);
    if (h.onStart?.(p) === false) return;
    e.preventDefault();
    pointerId = e.pointerId;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // capture can fail if the pointer is already gone
    }
    el.dataset.dragging = "";
    // move focus to the thumb inside, like a native slider (parts that manage focus themselves opt out)
    if (!("manualFocus" in el.dataset)) el.querySelector<HTMLElement>("[role=slider][tabindex='0']")?.focus({ preventScroll: true });
    last = p;
    h.onMove?.(p);
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pending = e;
    if (!frame) frame = requestAnimationFrame(flush);
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    if (frame) cancelAnimationFrame(frame);
    if (pending) flush();
    pointerId = -1;
    delete el.dataset.dragging;
    delete el.dataset.outside;
    h.onEnd?.(e.type === "pointercancel" ? null : last);
    last = null;
    rect = null;
  };

  // A wheel gesture measures the box once, when it starts. While it moves the control, its events are
  // summed and applied once per animation frame (trackpads can send several per frame), like pointer moves.
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  let wheelRect: DOMRect | null = null;
  let wheelHandled = false;
  let wheelFrame = 0;
  let queued: WheelMove | null = null;

  const flushWheel = () => {
    wheelFrame = 0;
    const move = queued;
    queued = null;
    if (move) wheelHandled = Boolean(h.onWheel?.(move));
  };

  const endWheel = () => {
    cancelAnimationFrame(wheelFrame);
    flushWheel();
    wheelRect = null;
    wheelHandled = false;
    delete el.dataset.wheeling;
    h.onWheelEnd?.();
  };

  const wheel = (e: WheelEvent) => {
    if (!h.onWheel || e.ctrlKey) return; // ctrl+wheel is pinch zoom
    if (e.timeStamp - lastOutsideWheel < 250) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    // natural scrolling: content follows the fingers, so invert to get finger direction
    const dx = -e.deltaX * unit;
    const dy = e.deltaY * unit;
    if (!wheelRect) {
      const r = el.getBoundingClientRect();
      const i = typeof h.inset === "function" ? h.inset(el) : h.inset ?? 0;
      wheelRect = new DOMRect(r.left + i, r.top, Math.max(1, r.width - i * 2), r.height);
    }
    if (wheelHandled) {
      // the gesture is already moving the control: this event joins the next frame's move
      queued = { dx: dx + (queued?.dx ?? 0), dy: dy + (queued?.dy ?? 0), rect: wheelRect, event: e };
      if (!wheelFrame) wheelFrame = requestAnimationFrame(flushWheel);
    } else {
      // not moving the control yet: ask now, so an event it does not take still scrolls the page
      wheelHandled = Boolean(h.onWheel({ dx, dy, rect: wheelRect, event: e }));
      if (!wheelHandled) {
        // the page scrolls instead, which moves the box: measure again next time
        wheelRect = null;
        return;
      }
    }
    e.preventDefault();
    el.dataset.wheeling = "";
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(endWheel, 220);
  };
  if (h.onWheel) {
    trackOutsideWheel();
    el.dataset.wheel = "";
    el.addEventListener("wheel", wheel, { passive: false });
  }

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    if (wheelFrame) cancelAnimationFrame(wheelFrame);
    clearTimeout(wheelTimer);
    el.removeEventListener("wheel", wheel);
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
}

/** Arrow / Page / Home / End step for keyboard sliders. Returns the delta in units, or null. */
export function keyStep(e: { key: string; shiftKey: boolean }, small: number, large: number): number | null {
  const step = e.shiftKey ? large : small;
  switch (e.key) {
    case "ArrowRight":
    case "ArrowUp":
      return step;
    case "ArrowLeft":
    case "ArrowDown":
      return -step;
    case "PageUp":
      return large;
    case "PageDown":
      return -large;
    default:
      return null;
  }
}

/** True when the element's text runs right to left: Left and Right arrows in a row of items then swap. */
export const isRtl = (el: Element) => getComputedStyle(el).direction === "rtl";

/** Half the width of the thumb inside a track: thumbs then travel inside the track's edges. */
export const thumbInset = (el: HTMLElement) => (el.querySelector<HTMLElement>("[data-part$='thumb']")?.offsetWidth ?? 0) / 2;

/** The gradient bar's inset at each end: its inline padding, which the stylesheet sets to the stops' track. */
export const stopInset = (el: HTMLElement) => parseFloat(getComputedStyle(el).paddingLeft) || 0;

/** 0..1 position of a pointer along a gradient bar, inside its end insets. */
export function barOffset(el: HTMLElement, clientX: number): number {
  const r = el.getBoundingClientRect();
  const i = stopInset(el);
  const w = r.width - i * 2;
  return w > 0 ? Math.min(1, Math.max(0, (clientX - r.left - i) / w)) : 0;
}

/**
 * The hover marker on a gradient bar (where a click adds a stop). The bar's box and inset are measured once per
 * hover, and again after a scroll or resize, not on every move. `--_cs-hover-x` is written at most once per
 * animation frame, and nothing runs while a stop is being dragged.
 */
export function createHoverMarker() {
  let el: HTMLElement | null = null;
  // left edge and width of the stop track, inside the bar's insets
  let box: [number, number] | null = null;
  let clientX = 0;
  let frame = 0;
  const stale = () => (box = null);
  const listen = (on: boolean) => {
    const method = on ? "addEventListener" : "removeEventListener";
    window[method]("scroll", stale, true);
    window[method]("resize", stale);
  };
  const flush = () => {
    frame = 0;
    if (!el || "dragging" in el.dataset) return;
    if (!box) {
      const r = el.getBoundingClientRect();
      const i = stopInset(el);
      box = [r.left + i, r.width - i * 2];
    }
    el.style.setProperty("--_cs-hover-x", String(box[1] > 0 ? Math.min(1, Math.max(0, (clientX - box[0]) / box[1])) : 0));
  };
  const leave = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (el) listen(false);
    el = box = null;
  };
  return {
    move(target: HTMLElement, x: number) {
      if ("dragging" in target.dataset) return;
      if (target !== el) {
        leave();
        el = target;
        listen(true);
      }
      clientX = x;
      if (!frame) frame = requestAnimationFrame(flush);
    },
    leave,
  };
}
