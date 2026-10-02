import { memo, useRef, useState, type CSSProperties } from "react";
import { useIsoLayoutEffect, usePicker, usePickerContext } from "../context";
import { safeCssValue } from "@colorshot/core";

export interface CurrentSwatchProps {
  className?: string;
  style?: CSSProperties;
  /** split the swatch: the value the picker opened with on the left (click it to restore), the current one on the right */
  compare?: boolean;
}

/** The current value. Clicking copies it as CSS. */
export const CurrentSwatch = /* @__PURE__ */ memo(function CurrentSwatch({ className, style, compare }: CurrentSwatchProps) {
  const { store, labels, notify } = usePickerContext();
  const value = usePicker((s) => s.value);
  const mode = usePicker((s) => s.mode);
  const original = useRef(value);
  // switching modes morphs the swatch: the new value grows out of the old one
  const last = useRef({ mode, value });
  const [morph, setMorph] = useState<{ from: string; run: number } | null>(null);
  useIsoLayoutEffect(() => {
    if (last.current.mode !== mode) {
      const from = last.current.value;
      setMorph((m) => ({ from, run: (m?.run ?? 0) + 1 }));
    }
    last.current = { mode, value };
  }, [mode, value]);
  const changed = original.current !== value;
  const copy = () =>
    navigator.clipboard?.writeText(store.getState().value).then(
      () => notify(labels.copied),
      () => {},
    );
  return (
    <div data-part="current" data-compare={compare && changed ? "" : undefined} className={className} style={style}>
      {compare && changed && (
        <button
          type="button"
          data-part="current-original"
          aria-label={labels.original}
          data-tooltip={labels.original}
          style={{ "--_cs-swatch": safeCssValue(original.current) } as CSSProperties}
          onClick={() => {
            store.setCss(original.current);
            store.commit();
          }}
        />
      )}
      <button
        type="button"
        data-part="current-value"
        aria-label={`${labels.copy}: ${value}`}
        data-tooltip={labels.copy}
        style={{ "--_cs-swatch": safeCssValue(morph ? morph.from : value) } as CSSProperties}
        onClick={copy}
      >
        {morph && (
          <span
            key={morph.run}
            data-part="current-morph"
            style={{ "--_cs-swatch": safeCssValue(value) } as CSSProperties}
            onAnimationEnd={() => setMorph(null)}
            aria-hidden
          />
        )}
      </button>
    </div>
  );
});
