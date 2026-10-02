import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { num, parseColor, safeCssValue, stopsEnds, stopsPreview, type PickerStore } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { fill } from "../labels";
import { barOffset, createHoverMarker, keyStep, stopInset, usePointerDrag } from "../use-drag";
import { SWATCH_DRAG_TYPE } from "./swatches";

const REMOVE_DISTANCE = 36;

/**
 * Add a stop halfway between a stop (default: the selected one) and the next one, or the previous one when it is
 * the last. The new stop takes the color the gradient has there. Returns its id.
 */
export function insertStop(store: PickerStore, id?: string | null): string | null {
  const st = store.getState();
  const i = st.stops.findIndex((s) => s.id === (id ?? st.selectedStopId));
  if (i === -1) return null;
  const at = st.offsets[i];
  const after = st.offsets.filter((o, k) => k !== i && o > at);
  const before = st.offsets.filter((o, k) => k !== i && o < at);
  const other = after.length ? Math.min(...after) : before.length ? Math.max(...before) : at;
  return store.addStop((at + other) / 2);
}

export interface GradientBarProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Stops on a bar. Click the bar to add a stop (it takes the color at that point), drag stops to move them,
 * drag a stop away from the bar or press Delete to remove it. Every stop is in the tab order (a multi-thumb slider):
 * arrow keys move the focused stop, Enter, + or Insert adds one next to it.
 */
export const GradientBar = /* @__PURE__ */ memo(function GradientBar({ className, style }: GradientBarProps) {
  const { store, labels, notify } = usePickerContext();
  const { gradient, stops, offsets, selectedStopId } = usePicker((s) => ({
    gradient: s.gradient,
    stops: s.stops,
    offsets: s.offsets,
    selectedStopId: s.selectedStopId,
  }));
  // stops already there when the bar appears stay put; only stops added later pop in
  const [initialStops] = useState(() => new Set(stops.map((s) => s.id)));
  const [removing, setRemoving] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; grab: number; moved: boolean; removing: boolean } | null>(null);
  const wheelStop = useRef<string | null>(null);
  const [hover] = useState(createHoverMarker);
  useEffect(() => hover.leave, [hover]);

  const ref = usePointerDrag<HTMLDivElement>({
    inset: stopInset,
    onStart: (p) => {
      const target = (p.event.target as HTMLElement).closest<HTMLElement>("[data-stop-id]");
      let id = target?.dataset.stopId ?? null;
      let grab = 0;
      let moved = false;
      if (id && p.event.altKey) {
        // Alt / Option + drag duplicates the stop, like Figma
        const st = store.getState();
        const i = st.stops.findIndex((s) => s.id === id);
        grab = st.offsets[i] - p.x;
        id = store.addStop(st.offsets[i], st.stops[i].color);
        moved = true;
        if (id) notify(labels.stopAdded, true);
      } else if (id) {
        const st = store.getState();
        store.selectStop(id);
        // keep the point where the stop was grabbed under the pointer, so it does not jump
        grab = st.offsets[st.stops.findIndex((s) => s.id === id)] - p.x;
      } else {
        id = store.addStop(p.x);
        moved = true;
        if (id) notify(labels.stopAdded, true);
      }
      if (!id) return false;
      drag.current = { id, startX: p.clientX, startY: p.clientY, grab, moved, removing: false };
      const stopId = id;
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-stop-id="${stopId}"]`)?.focus());
    },
    onMove: (p) => {
      const d = drag.current;
      if (!d) return;
      // a plain click selects without touching the value
      if (!d.moved && Math.abs(p.clientX - d.startX) < 3 && Math.abs(p.clientY - d.startY) < 3) return;
      if (!d.moved || dragging !== d.id) setDragging(d.id);
      d.moved = true;
      const away = Math.abs(p.clientY - d.startY) > REMOVE_DISTANCE && store.getState().stops.length > 2;
      if (away !== d.removing) {
        d.removing = away;
        setRemoving(away ? d.id : null);
      }
      if (!away) store.moveStop(d.id, Math.min(1, Math.max(0, p.x + d.grab)));
    },
    // A horizontal two-finger swipe over a stop moves that stop. The stop is locked when the gesture starts:
    // it slides out from under the resting cursor, and later events must keep moving it, not scroll the page.
    onWheel: ({ dx, dy, rect, event }) => {
      let id = wheelStop.current;
      if (!id) {
        if (Math.abs(dx) <= Math.abs(dy)) return false;
        id = (event.target as HTMLElement).closest<HTMLElement>("[data-stop-id]")?.dataset.stopId ?? null;
        if (!id) return false;
        wheelStop.current = id;
        store.selectStop(id);
        setDragging(id);
      }
      const st = store.getState();
      const i = st.stops.findIndex((s) => s.id === id);
      if (i === -1) return true;
      store.moveStop(id, Math.min(1, Math.max(0, st.offsets[i] + dx / rect.width)));
      return true;
    },
    onWheelEnd: () => {
      wheelStop.current = null;
      setDragging(null);
      store.commit();
    },
    // a cancelled pointer (null) keeps the stop, even one that was being dragged away
    onEnd: (p) => {
      const d = drag.current;
      drag.current = null;
      if (d?.removing && p) {
        store.removeStop(d.id);
        notify(labels.stopRemoved, true);
      }
      setRemoving(null);
      setDragging(null);
      store.commit();
    },
  });

  if (!gradient) return null;

  // after the stops re-render: the focused stop may be gone, or a new one may need focus
  const focusStop = (id: string | null) =>
    requestAnimationFrame(() => id && ref.current?.querySelector<HTMLElement>(`[data-stop-id="${id}"]`)?.focus());

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string, offset: number) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (store.getState().stops.length <= 2) return;
      store.removeStop(id);
      store.commit();
      notify(labels.stopRemoved, true);
      // focus follows the selection to the neighbouring stop
      focusStop(store.getState().selectedStopId);
      return;
    }
    if (e.key === "Enter" || e.key === "+" || e.key === "Insert") {
      e.preventDefault();
      const added = insertStop(store, id);
      if (!added) return;
      store.commit();
      notify(labels.stopAdded, true);
      focusStop(added);
      return;
    }
    const step = keyStep(e, 0.01, 0.1);
    let next: number | null = step === null ? null : offset + step;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = 1;
    if (next === null) return;
    e.preventDefault();
    store.moveStop(id, Math.min(1, Math.max(0, next)));
  };

  const ends = stopsEnds(gradient);
  return (
    <div
      ref={ref}
      data-part="gradient-bar"
      data-checker=""
      data-manual-focus=""
      role="group"
      aria-label={labels.stops}
      className={className}
      style={{ "--_cs-track": safeCssValue(stopsPreview(gradient)), "--_cs-track-start": safeCssValue(ends[0]), "--_cs-track-end": safeCssValue(ends[1]), ...style } as CSSProperties}
      // hover marker showing where a click adds a stop; set directly on the element, no re-render
      onPointerMove={(e) => hover.move(e.currentTarget, e.clientX)}
      onPointerLeave={hover.leave}
      // drop a swatch on the bar to add it as a stop
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(SWATCH_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        e.currentTarget.style.setProperty("--_cs-hover-x", String(barOffset(e.currentTarget, e.clientX)));
        e.currentTarget.dataset.dropping = "";
      }}
      onDragLeave={(e) => delete e.currentTarget.dataset.dropping}
      onDrop={(e) => {
        const color = e.dataTransfer.getData(SWATCH_DRAG_TYPE);
        delete e.currentTarget.dataset.dropping;
        // drag data can come from any page: only a real color becomes a stop
        if (!color || !parseColor(color)) return;
        e.preventDefault();
        store.addStop(barOffset(e.currentTarget, e.clientX), color);
        store.commit();
        notify(labels.stopAdded, true);
      }}
    >
      {stops.map((stop, i) => {
        const selected = stop.id === selectedStopId;
        return (
          <button
            key={stop.id}
            type="button"
            data-part="stop"
            data-stop-id={stop.id}
            data-state={selected ? "selected" : undefined}
            data-enter={initialStops.has(stop.id) ? undefined : ""}
            data-removing={removing === stop.id ? "" : undefined}
            data-active={dragging === stop.id ? "" : undefined}
            role="slider"
            aria-label={fill(labels.stopName, { index: i + 1, count: stops.length })}
            aria-valuetext={`${stop.color}, ${num(offsets[i] * 100, 1)}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(offsets[i] * 100)}
            tabIndex={0}
            style={{ "--_cs-x": offsets[i], "--_cs-stop-color": safeCssValue(stop.color) } as CSSProperties}
            onFocus={() => store.selectStop(stop.id)}
            onKeyDown={(e) => onKeyDown(e, stop.id, offsets[i])}
            onKeyUp={() => store.commit()}
          >
            <span data-part="stop-label" aria-hidden>
              {num(offsets[i] * 100, 0)}%
            </span>
          </button>
        );
      })}
    </div>
  );
});
