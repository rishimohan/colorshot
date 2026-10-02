import { memo, type CSSProperties } from "react";
import { contrastLevel, contrastRatio, num, safeCssValue } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";

export interface ContrastProps {
  /** the background the color sits on, any CSS color */
  background: string;
  className?: string;
  style?: CSSProperties;
}

/** WCAG 2 contrast of the current value against a background. Gradients use their weakest stop. */
export const Contrast = /* @__PURE__ */ memo(function Contrast({ background, className, style }: ContrastProps) {
  const { labels } = usePickerContext();
  const ratio = usePicker((s) => contrastRatio(s.value, background));
  if (ratio === null) return null;
  const level = contrastLevel(ratio);
  return (
    <div data-part="contrast" data-level={level === "Fail" ? "fail" : level === "AA Large" ? "large" : "pass"} className={className} style={style}>
      <span data-part="contrast-sample" style={{ "--_cs-swatch": safeCssValue(background) } as CSSProperties} aria-hidden />
      <span data-part="contrast-label">{labels.contrast}</span>
      <span data-part="contrast-ratio">{num(ratio, 2)}:1</span>
      <span data-part="contrast-level">{level}</span>
    </div>
  );
});
