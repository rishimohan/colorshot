import { defineComponent } from "vue";
import { usePicker, usePickerContext } from "../context";
import { bool } from "../props";
import { safeCssValue } from "@colorshot/core";

/** The current value on a checkerboard. With `compare`, a before / after pair. */
export const Preview = /* @__PURE__ */ defineComponent({
  name: "PickerPreview",
  props: {
    /** also show the value the picker opened with; clicking it restores that value */
    compare: /* @__PURE__ */ bool(),
  },
  setup(props) {
    const ctx = usePickerContext();
    const { store } = ctx;
    const value = usePicker((s) => s.value);
    const original = value.value;
    return () => (
      <div data-part="preview">
        {props.compare ? (
          <button
            type="button"
            data-part="preview-swatch"
            data-checker=""
            data-original=""
            title={ctx.labels.original}
            aria-label={ctx.labels.original}
            style={{ "--_cs-swatch": safeCssValue(original) }}
            onClick={() => {
              store.setCss(original);
              store.commit();
            }}
          />
        ) : null}
        <div data-part="preview-swatch" data-checker="" style={{ "--_cs-swatch": safeCssValue(value.value) }} />
      </div>
    );
  },
});
