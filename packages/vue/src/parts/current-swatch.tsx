import { defineComponent, ref, watch } from "vue";
import { usePicker, usePickerContext } from "../context";
import { bool } from "../props";
import { safeCssValue } from "@colorshot/core";

/** The current value. Clicking copies it as CSS. */
export const CurrentSwatch = /* @__PURE__ */ defineComponent({
  name: "PickerCurrentSwatch",
  props: {
    /** split the swatch: the value the picker opened with on the left (click it to restore), the current one on the right */
    compare: /* @__PURE__ */ bool(),
  },
  setup(props) {
    const ctx = usePickerContext();
    const { store, notify } = ctx;
    const value = usePicker((s) => s.value);
    const mode = usePicker((s) => s.mode);
    const original = value.value;
    // switching modes morphs the swatch: the new value grows out of the old one
    const morph = ref<{ from: string; run: number } | null>(null);
    let last = value.value;
    watch(
      [mode, value],
      ([m, v], [prevMode]) => {
        if (m !== prevMode) morph.value = { from: last, run: (morph.value?.run ?? 0) + 1 };
        last = v;
      },
      { flush: "sync" },
    );
    const copy = () =>
      navigator.clipboard?.writeText(store.getState().value).then(
        () => notify(ctx.labels.copied),
        () => {},
      );
    return () => {
      const labels = ctx.labels;
      const v = value.value;
      const split = props.compare && original !== v;
      return (
        <div data-part="current" data-compare={split ? "" : undefined}>
          {split ? (
            <button
              type="button"
              data-part="current-original"
              aria-label={labels.original}
              data-tooltip={labels.original}
              style={{ "--_cs-swatch": safeCssValue(original) }}
              onClick={() => {
                store.setCss(original);
                store.commit();
              }}
            />
          ) : null}
          <button
            type="button"
            data-part="current-value"
            aria-label={`${labels.copy}: ${v}`}
            data-tooltip={labels.copy}
            style={{ "--_cs-swatch": safeCssValue(morph.value ? morph.value.from : v) }}
            onClick={copy}
          >
            {morph.value ? (
              <span
                key={morph.value.run}
                data-part="current-morph"
                style={{ "--_cs-swatch": safeCssValue(v) }}
                onAnimationend={() => (morph.value = null)}
                aria-hidden="true"
              />
            ) : null}
          </button>
        </div>
      );
    };
  },
});
