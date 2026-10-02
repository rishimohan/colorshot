import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { num } from "@colorshot/core";
import { usePointerDrag } from "../use-drag";

export interface NumberFieldProps {
  value: number;
  onValue: (value: number) => void;
  onCommit?: () => void;
  min: number;
  max: number;
  /** wrap around instead of clamping (angles, hue) */
  wrap?: boolean;
  /** decimals shown and stored */
  digits?: number;
  /** arrow key step (default 1, or 1% of the range for small ranges); shift multiplies by 10 */
  step?: number;
  /** short label; dragging it left or right scrubs the value */
  label?: string;
  labelPosition?: "start" | "end";
  /** sets `data-field` on the wrapper for styling */
  field?: string;
  /** tooltip */
  title?: string;
  "aria-label"?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Text input for numbers (a spinbutton): arrow keys step, Enter or blur commits, Escape drops what was typed,
 * drag the label to scrub.
 */
export function NumberField({
  value,
  onValue,
  onCommit,
  min,
  max,
  wrap,
  digits = 0,
  step = max - min >= 10 ? 1 : (max - min) / 100,
  label,
  labelPosition = "start",
  field,
  title,
  className,
  style,
  ...aria
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? num(value, digits);
  // the widest text this field can show; a hidden copy of it sizes the input in the page's own font
  const widest = [min.toFixed(digits), max.toFixed(digits)].reduce((a, b) => (b.length > a.length ? b : a));

  const fit = (v: number) => {
    if (wrap) {
      const span = max - min;
      return ((((v - min) % span) + span) % span) + min;
    }
    return Math.min(max, Math.max(min, v));
  };

  const commitDraft = () => {
    if (draft === null) return;
    const v = parseFloat(draft);
    setDraft(null);
    if (!Number.isNaN(v)) onValue(fit(v));
    onCommit?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // handled here: no host shortcut or form submit should also act on this Enter
      e.preventDefault();
      commitDraft();
      const input = e.currentTarget;
      // after the committed value renders (Safari resets the selection on a value change)
      requestAnimationFrame(() => input === document.activeElement && input.select());
      return;
    }
    if (e.key === "Escape") {
      // only undoes the typing; with nothing typed, Escape goes on to close a popover
      if (draft !== null) {
        e.preventDefault();
        setDraft(null);
      }
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const base = draft !== null && !Number.isNaN(parseFloat(draft)) ? parseFloat(draft) : value;
    const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
    setDraft(null);
    onValue(fit(Number((base + delta).toFixed(digits + 1))));
  };

  const scrub = useRef({ x: 0, value: 0 });
  const labelRef = usePointerDrag<HTMLSpanElement>({
    onStart: (p) => {
      scrub.current = { x: p.clientX, value };
    },
    onMove: (p) => {
      const dx = p.clientX - scrub.current.x;
      if (dx === 0) return;
      const range = max - min;
      // about 200px of travel covers the full range; shift for fine control
      const perPx = (range / 200) * (p.event.shiftKey ? 0.1 : 1);
      onValue(fit(Number((scrub.current.value + dx * perPx).toFixed(digits))));
    },
    onEnd: () => onCommit?.(),
  });

  const labelEl = label ? (
    <span ref={labelRef} data-part="field-label" aria-hidden>
      {label}
    </span>
  ) : null;

  return (
    <label data-part="field" data-field={field} title={title} className={className} style={style}>
      {labelPosition === "start" && labelEl}
      <span data-part="field-sizer">
      <span data-part="field-ghost" aria-hidden>{widest}</span>
      <span data-part="field-ghost" aria-hidden>{shown}</span>
      <input
        data-part="field-input"
        size={1}
        role="spinbutton"
        inputMode="decimal"
        spellCheck={false}
        autoComplete="off"
        aria-valuenow={Number(value.toFixed(digits))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${num(value, digits)}${labelPosition === "end" && label ? label : ""}`}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          // a frame later: Safari clears a selection made on focus when the click's mouseup lands
          const input = e.currentTarget;
          requestAnimationFrame(() => input === document.activeElement && input.select());
        }}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && onCommit?.()}
        {...aria}
      />
      </span>
      {labelPosition === "end" && labelEl}
    </label>
  );
}
