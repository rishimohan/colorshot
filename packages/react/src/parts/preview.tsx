import { memo, useRef, type CSSProperties, type HTMLAttributes } from "react";
import { usePicker, usePickerContext } from "../context";
import { safeCssValue } from "@colorshot/core";

export interface PreviewProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  className?: string;
  style?: CSSProperties;
  /** also show the value the picker opened with; clicking it restores that value */
  compare?: boolean;
}

/** The current value on a checkerboard. With `compare`, a before / after pair. */
export const Preview = /* @__PURE__ */ memo(function Preview({ className, style, compare, ...rest }: PreviewProps) {
  const { store, labels } = usePickerContext();
  const value = usePicker((s) => s.value);
  const original = useRef(value);
  return (
    <div data-part="preview" className={className} style={style} {...rest}>
      {compare && (
        <button
          type="button"
          data-part="preview-swatch"
          data-checker=""
          data-original=""
          title={labels.original}
          aria-label={labels.original}
          style={{ "--_cs-swatch": safeCssValue(original.current) } as CSSProperties}
          onClick={() => {
            store.setCss(original.current);
            store.commit();
          }}
        />
      )}
      <div data-part="preview-swatch" data-checker="" style={{ "--_cs-swatch": safeCssValue(value) } as CSSProperties} />
    </div>
  );
});
