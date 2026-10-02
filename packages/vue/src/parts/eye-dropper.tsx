import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { parseColor } from "@colorshot/core";
import { usePickerContext } from "../context";
import { EyeDropperIcon } from "../icons";
import { bool, prop } from "../props";

/** Return a CSS color, or null when the user cancels. The signal aborts when the picker unmounts. */
export type EyeDropperFn = (signal: AbortSignal) => Promise<string | null>;

// a local type, not a global one: the published types must not change the host app's Window
type NativeEyeDropper = new () => { open: (o?: { signal?: AbortSignal }) => Promise<{ sRGBHex: string }> };
const getNativeEyeDropper = () =>
  typeof window === "undefined" ? undefined : (window as Window & { EyeDropper?: NativeEyeDropper }).EyeDropper;

const nativeEyeDropper: EyeDropperFn = async (signal) => {
  try {
    const result = await new (getNativeEyeDropper()!)().open({ signal });
    return result.sRGBHex;
  } catch {
    // Escape or abort
    return null;
  }
};

export const hasNativeEyeDropper = () => typeof getNativeEyeDropper() === "function";

/** Picks a color from the screen. Renders nothing when neither the native API nor `pick` is available. */
export const EyeDropper = /* @__PURE__ */ defineComponent({
  name: "PickerEyeDropper",
  props: {
    /** Custom picker for browsers without the native EyeDropper API (Firefox, Safari). */
    pick: prop<EyeDropperFn>(),
    /** Keep the current opacity instead of taking the picked pixel's (default true) */
    keepAlpha: /* @__PURE__ */ bool(true),
  },
  setup(props) {
    const ctx = usePickerContext();
    const { store } = ctx;
    const supported = ref(false);
    const active = ref(false);
    let abort: AbortController | null = null;

    // checked after mount, so server and client render the same markup
    onMounted(() => (supported.value = Boolean(props.pick) || hasNativeEyeDropper()));
    watch(
      () => props.pick,
      (pick) => (supported.value = Boolean(pick) || hasNativeEyeDropper()),
    );
    onBeforeUnmount(() => abort?.abort());

    const run = async () => {
      abort?.abort();
      const controller = new AbortController();
      abort = controller;
      active.value = true;
      const css = await (props.pick ?? nativeEyeDropper)(controller.signal);
      active.value = false;
      if (!css || controller.signal.aborted) return;
      const parsed = parseColor(css);
      if (!parsed) return;
      store.setColor(parsed.color, { keepAlpha: props.keepAlpha && store.getState().hsva.a > 0 });
      store.commit();
    };

    return () =>
      supported.value ? (
        <button
          type="button"
          data-part="eye-dropper"
          data-state={active.value ? "active" : undefined}
          data-tooltip={ctx.labels.eyeDropper}
          aria-label={ctx.labels.eyeDropper}
          onClick={run}
        >
          <EyeDropperIcon />
        </button>
      ) : null;
  },
});
