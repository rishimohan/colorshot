import { defineComponent, ref, type ExtractPublicPropTypes } from "vue";
import { num } from "@colorshot/core";
import { usePointerDrag } from "../use-drag";
import { bool, prop } from "../props";

const numberFieldProps = {
  value: { type: Number, required: true as const },
  min: { type: Number, required: true as const },
  max: { type: Number, required: true as const },
  /** wrap around instead of clamping (angles, hue) */
  wrap: /* @__PURE__ */ bool(),
  /** decimals shown and stored */
  digits: { type: Number, default: 0 },
  /** arrow key step (default 1, or 1% of the range for small ranges); shift multiplies by 10 */
  step: Number,
  /** short label; dragging it left or right scrubs the value */
  label: String,
  labelPosition: { type: prop<"start" | "end">(), default: "start" },
  /** sets `data-field` on the wrapper for styling */
  field: String,
  /** accessible name of the input */
  ariaLabel: String,
  /** tooltip */
  title: String,
};

export type NumberFieldProps = ExtractPublicPropTypes<typeof numberFieldProps>;

/**
 * Text input for numbers (a spinbutton): arrow keys step, Enter or blur commits, Escape drops what was typed,
 * drag the label to scrub.
 * Emits `value` with each new number and `commit` when an edit ends. `class` and `style` go on the wrapper.
 */
export const NumberField = /* @__PURE__ */ defineComponent({
  name: "PickerNumberField",
  props: numberFieldProps,
  emits: { value: null as unknown as (value: number) => true, commit: null as unknown as () => true },
  setup(props, { emit }) {
    const draft = ref<string | null>(null);

    const fit = (v: number) => {
      const { min, max } = props;
      if (props.wrap) {
        const span = max - min;
        return ((((v - min) % span) + span) % span) + min;
      }
      return Math.min(max, Math.max(min, v));
    };

    const commitDraft = () => {
      if (draft.value === null) return;
      const v = parseFloat(draft.value);
      draft.value = null;
      if (!Number.isNaN(v)) emit("value", fit(v));
      emit("commit");
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // handled here: no host shortcut or form submit should also act on this Enter
        e.preventDefault();
        commitDraft();
        const input = e.currentTarget as HTMLInputElement;
        // after the committed value renders (Safari resets the selection on a value change)
        requestAnimationFrame(() => input === document.activeElement && input.select());
        return;
      }
      if (e.key === "Escape") {
        // only undoes the typing; with nothing typed, Escape goes on to close a popover
        if (draft.value !== null) {
          e.preventDefault();
          draft.value = null;
        }
        return;
      }
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const { min, max, digits } = props;
      const step = props.step ?? (max - min >= 10 ? 1 : (max - min) / 100);
      const typed = draft.value !== null ? parseFloat(draft.value) : NaN;
      const base = Number.isNaN(typed) ? props.value : typed;
      const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
      draft.value = null;
      emit("value", fit(Number((base + delta).toFixed(digits + 1))));
    };

    let scrub = { x: 0, value: 0 };
    const labelRef = usePointerDrag<HTMLSpanElement>({
      onStart: (p) => {
        scrub = { x: p.clientX, value: props.value };
      },
      onMove: (p) => {
        const dx = p.clientX - scrub.x;
        if (dx === 0) return;
        const range = props.max - props.min;
        // about 200px of travel covers the full range; shift for fine control
        const perPx = (range / 200) * (p.event.shiftKey ? 0.1 : 1);
        emit("value", fit(Number((scrub.value + dx * perPx).toFixed(props.digits))));
      },
      onEnd: () => emit("commit"),
    });

    return () => {
      const labelEl = props.label ? (
        <span ref={labelRef} data-part="field-label" aria-hidden="true">
          {props.label}
        </span>
      ) : null;
      const shown = draft.value ?? num(props.value, props.digits);
      // the widest text this field can show; a hidden copy of it sizes the input in the page's own font
      const widest = [props.min.toFixed(props.digits), props.max.toFixed(props.digits)].reduce((a, b) => (b.length > a.length ? b : a));
      return (
        <label data-part="field" data-field={props.field} title={props.title}>
          {props.labelPosition === "start" ? labelEl : null}
          <span data-part="field-sizer">
          <span data-part="field-ghost" aria-hidden="true">{widest}</span>
          <span data-part="field-ghost" aria-hidden="true">{shown}</span>
          <input
            data-part="field-input"
            size={1}
            role="spinbutton"
            inputmode="decimal"
            spellcheck={false}
            autocomplete="off"
            aria-label={props.ariaLabel}
            aria-valuenow={Number(props.value.toFixed(props.digits))}
            aria-valuemin={props.min}
            aria-valuemax={props.max}
            aria-valuetext={`${num(props.value, props.digits)}${props.labelPosition === "end" && props.label ? props.label : ""}`}
            value={shown}
            onInput={(e) => (draft.value = (e.target as HTMLInputElement).value)}
            onFocus={(e) => {
              // a frame later: Safari clears a selection made on focus when the click's mouseup lands
              const input = e.currentTarget as HTMLInputElement;
              requestAnimationFrame(() => input === document.activeElement && input.select());
            }}
            onBlur={commitDraft}
            onKeydown={onKeyDown}
            onKeyup={(e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && emit("commit")}
          />
          </span>
          {props.labelPosition === "end" ? labelEl : null}
        </label>
      );
    };
  },
});
