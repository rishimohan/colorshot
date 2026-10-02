import { defineComponent, onBeforeUnmount, ref } from "vue";
import { num, parseColor, safeCssValue, stopsEnds, stopsPreview, type PickerStore } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { fill } from "../labels";
import { barOffset, createHoverMarker, keyStep, stopInset, usePointerDrag } from "../use-drag";
import { SWATCH_DRAG_TYPE } from "./swatches";

const REMOVE_DISTANCE = 36;

const hoverX = (e: MouseEvent) => barOffset(e.currentTarget as HTMLElement, e.clientX);

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

/**
 * Stops on a bar. Click the bar to add a stop (it takes the color at that point), drag stops to move them,
 * drag a stop away from the bar or press Delete to remove it. Every stop is in the tab order (a multi-thumb slider):
 * arrow keys move the focused stop, Enter, + or Insert adds one next to it.
 */
export const GradientBar = /* @__PURE__ */ defineComponent({
  name: "PickerGradientBar",
  setup() {
    const ctx = usePickerContext();
    const { store, notify } = ctx;
    const st = usePicker((s) => ({
      gradient: s.gradient,
      stops: s.stops,
      offsets: s.offsets,
      selectedStopId: s.selectedStopId,
    }));
    // stops already there when the bar appears stay put; only stops added later pop in
    const initialStops = new Set(st.value.stops.map((s) => s.id));
    const removing = ref<string | null>(null);
    const dragging = ref<string | null>(null);
    let drag: { id: string; startX: number; startY: number; grab: number; moved: boolean; removing: boolean } | null = null;

    let wheelStop: string | null = null;
    const hover = createHoverMarker();
    onBeforeUnmount(hover.leave);
    const barRef = usePointerDrag<HTMLDivElement>({
      inset: stopInset,
      onStart: (p) => {
        const target = (p.event.target as HTMLElement).closest<HTMLElement>("[data-stop-id]");
        let id = target?.dataset.stopId ?? null;
        let grab = 0;
        let moved = false;
        if (id && p.event.altKey) {
          // Alt / Option + drag duplicates the stop, like Figma
          const s = store.getState();
          const i = s.stops.findIndex((x) => x.id === id);
          grab = s.offsets[i] - p.x;
          id = store.addStop(s.offsets[i], s.stops[i].color);
          moved = true;
          if (id) notify(ctx.labels.stopAdded, true);
        } else if (id) {
          const s = store.getState();
          store.selectStop(id);
          // keep the point where the stop was grabbed under the pointer, so it does not jump
          grab = s.offsets[s.stops.findIndex((x) => x.id === id)] - p.x;
        } else {
          id = store.addStop(p.x);
          moved = true;
          if (id) notify(ctx.labels.stopAdded, true);
        }
        if (!id) return false;
        drag = { id, startX: p.clientX, startY: p.clientY, grab, moved, removing: false };
        const stopId = id;
        requestAnimationFrame(() => barRef.current?.querySelector<HTMLElement>(`[data-stop-id="${stopId}"]`)?.focus());
      },
      onMove: (p) => {
        const d = drag;
        if (!d) return;
        // a plain click selects without touching the value
        if (!d.moved && Math.abs(p.clientX - d.startX) < 3 && Math.abs(p.clientY - d.startY) < 3) return;
        dragging.value = d.id;
        d.moved = true;
        const away = Math.abs(p.clientY - d.startY) > REMOVE_DISTANCE && store.getState().stops.length > 2;
        if (away !== d.removing) {
          d.removing = away;
          removing.value = away ? d.id : null;
        }
        if (!away) store.moveStop(d.id, Math.min(1, Math.max(0, p.x + d.grab)));
      },
      // A horizontal two-finger swipe over a stop moves that stop. The stop is locked when the gesture starts:
      // it slides out from under the resting cursor, and later events must keep moving it, not scroll the page.
      onWheel: ({ dx, dy, rect, event }) => {
        let id = wheelStop;
        if (!id) {
          if (Math.abs(dx) <= Math.abs(dy)) return false;
          id = (event.target as HTMLElement).closest<HTMLElement>("[data-stop-id]")?.dataset.stopId ?? null;
          if (!id) return false;
          wheelStop = id;
          store.selectStop(id);
          dragging.value = id;
        }
        const s = store.getState();
        const i = s.stops.findIndex((x) => x.id === id);
        if (i === -1) return true;
        store.moveStop(id, Math.min(1, Math.max(0, s.offsets[i] + dx / rect.width)));
        return true;
      },
      onWheelEnd: () => {
        wheelStop = null;
        dragging.value = null;
        store.commit();
      },
      // a cancelled pointer (null) keeps the stop, even one that was being dragged away
      onEnd: (p) => {
        const d = drag;
        drag = null;
        if (d?.removing && p) {
          store.removeStop(d.id);
          notify(ctx.labels.stopRemoved, true);
        }
        removing.value = null;
        dragging.value = null;
        store.commit();
      },
    });

    // after the stops re-render: the focused stop may be gone, or a new one may need focus
    const focusStop = (id: string | null) =>
      requestAnimationFrame(() => id && barRef.current?.querySelector<HTMLElement>(`[data-stop-id="${id}"]`)?.focus());

    const onKeyDown = (e: KeyboardEvent, id: string, offset: number) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (store.getState().stops.length <= 2) return;
        store.removeStop(id);
        store.commit();
        notify(ctx.labels.stopRemoved, true);
        // focus follows the selection to the neighbouring stop
        focusStop(store.getState().selectedStopId);
        return;
      }
      if (e.key === "Enter" || e.key === "+" || e.key === "Insert") {
        e.preventDefault();
        const added = insertStop(store, id);
        if (!added) return;
        store.commit();
        notify(ctx.labels.stopAdded, true);
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

    return () => {
      const { gradient, stops, offsets, selectedStopId } = st.value;
      if (!gradient) return null;
      const labels = ctx.labels;
      const ends = stopsEnds(gradient);
      return (
        <div
          ref={barRef}
          data-part="gradient-bar"
          data-checker=""
          data-manual-focus=""
          role="group"
          aria-label={labels.stops}
          style={{ "--_cs-track": safeCssValue(stopsPreview(gradient)), "--_cs-track-start": safeCssValue(ends[0]), "--_cs-track-end": safeCssValue(ends[1]) }}
          // hover marker showing where a click adds a stop; set directly on the element, no re-render
          onPointermove={(e) => hover.move(e.currentTarget as HTMLElement, e.clientX)}
          onPointerleave={hover.leave}
          // drop a swatch on the bar to add it as a stop
          onDragover={(e) => {
            if (!e.dataTransfer?.types.includes(SWATCH_DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            const el = e.currentTarget as HTMLElement;
            el.style.setProperty("--_cs-hover-x", String(hoverX(e)));
            el.dataset.dropping = "";
          }}
          onDragleave={(e) => delete (e.currentTarget as HTMLElement).dataset.dropping}
          onDrop={(e) => {
            const color = e.dataTransfer?.getData(SWATCH_DRAG_TYPE);
            delete (e.currentTarget as HTMLElement).dataset.dropping;
            // drag data can come from any page: only a real color becomes a stop
            if (!color || !parseColor(color)) return;
            e.preventDefault();
            store.addStop(hoverX(e), color);
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
                data-removing={removing.value === stop.id ? "" : undefined}
                data-active={dragging.value === stop.id ? "" : undefined}
                role="slider"
                aria-label={fill(labels.stopName, { index: i + 1, count: stops.length })}
                aria-valuetext={`${stop.color}, ${num(offsets[i] * 100, 1)}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(offsets[i] * 100)}
                tabindex={0}
                style={{ "--_cs-x": offsets[i], "--_cs-stop-color": safeCssValue(stop.color) }}
                onFocus={() => store.selectStop(stop.id)}
                onKeydown={(e) => onKeyDown(e, stop.id, offsets[i])}
                onKeyup={() => store.commit()}
              >
                <span data-part="stop-label" aria-hidden="true">
                  {num(offsets[i] * 100, 0)}%
                </span>
              </button>
            );
          })}
        </div>
      );
    };
  },
});
