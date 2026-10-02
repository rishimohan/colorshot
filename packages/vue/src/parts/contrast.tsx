import { defineComponent } from "vue";
import { contrastLevel, contrastRatio, num, safeCssValue } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";

/** WCAG 2 contrast of the current value against a background. Gradients use their weakest stop. */
export const Contrast = /* @__PURE__ */ defineComponent({
  name: "PickerContrast",
  props: {
    /** the background the color sits on, any CSS color */
    background: { type: String, required: true },
  },
  setup(props) {
    const ctx = usePickerContext();
    const ratio = usePicker((s) => contrastRatio(s.value, props.background));
    return () => {
      const r = ratio.value;
      if (r === null) return null;
      const level = contrastLevel(r);
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
