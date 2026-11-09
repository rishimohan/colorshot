import { defineComponent } from "vue";
import { contrastLevel, contrastRatio, num, safeCssValue, type ContrastTarget } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { prop } from "../props";

/** WCAG 2 contrast of the current value against a background. Gradients use their weakest stop. */
export const Contrast = /* @__PURE__ */ defineComponent({
  name: "PickerContrast",
  props: {
    /** the background the color sits on, any CSS color */
    background: { type: String, required: true },
    /** what the color is for: `"text"` (default) shows AAA / AA / AA Large / Fail, `"ui"` (borders, icons, focus rings) Pass / Fail at 3:1 */
    contrastFor: prop<ContrastTarget>(),
  },
  setup(props) {
    const ctx = usePickerContext();
    const ratio = usePicker((s) => contrastRatio(s.value, props.background));
    return () => {
      const r = ratio.value;
      if (r === null) return null;
      const level = contrastLevel(r, props.contrastFor);
      return (
        <div data-part="contrast" data-level={level === "Fail" ? "fail" : level === "AA Large" ? "large" : "pass"}>
          <span data-part="contrast-sample" style={{ "--_cs-swatch": safeCssValue(props.background) }} aria-hidden="true" />
          <span data-part="contrast-label">{ctx.labels.contrast}</span>
          <span data-part="contrast-ratio">{num(r, 2)}:1</span>
          <span data-part="contrast-level">{level}</span>
        </div>
      );
    };
  },
});
