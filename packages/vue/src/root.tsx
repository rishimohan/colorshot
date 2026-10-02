import { computed, defineComponent, onBeforeUnmount, onMounted, shallowRef, watch, type ExtractPublicPropTypes, type Ref } from "vue";
import { colorKey, createPicker, isSafeCssValue, type OutputFormat, type PickerMode } from "@colorshot/core";
import { CheckIcon } from "./icons";
import { providePicker, selectFrom, shallowEqual, type AreaSpace, type PickerStorage, type RecentColors } from "./context";
import { defaultLabels, type Labels } from "./labels";
import { bool, boolOr, fire, prop } from "./props";

export const rootProps = {
  /** Controlled CSS value (`v-model`): any color or gradient string */
  modelValue: String,
  /** Uncontrolled starting value */
  defaultValue: String,
  /** Allowed modes. Default: solid, linear, radial, conic */
  modes: prop<readonly PickerMode[]>(),
  /** How colors are written. Default `"preserve"`: the format each color came in */
  outputFormat: prop<OutputFormat>(),
  defaultColor: String,
  defaultGradient: String,
  /** Override any UI text */
  labels: prop<Partial<Labels>>(),
  /** `light`, `dark`, or leave unset to follow the OS */
  theme: prop<"light" | "dark">(),
  /** localStorage prefix for recent colors and the chosen input format. `null` keeps them in memory only */
  storageKey: { type: prop<string | null>(), default: "colorshot" },
  /** `"sm"`: 240px wide, 24px controls, for tight inspector panels */
  size: prop<"sm">(),
  /** keyboard shortcuts while the picker has focus: 1-4 switch modes, I picks from the screen (default true) */
  shortcuts: /* @__PURE__ */ bool(true),
  /** Area and hue slider color model: `"hsv"` (default, like most tools) or `"oklch"` (perceptual, shows wide gamut) */
  space: { type: prop<AreaSpace>(), default: "hsv" },
  /** Undo / redo with Cmd/Ctrl+Z inside the picker (off by default) */
  history: /* @__PURE__ */ boolOr<{ limit?: number }>(Object),
};

export type RootProps = ExtractPublicPropTypes<typeof rootProps>;

const ev = () => null as unknown as (value: string) => true;

/**
 * `update:modelValue` and `change` fire while the user drags or types, at most once per frame.
 * `change-complete` fires once when an interaction ends: pointer up, input commit, swatch click. Use it for undo history.
 */
export const rootEmits = { "update:modelValue": ev(), change: ev(), changeComplete: ev() };

const RECENT_MAX = 16;

function createStorage(prefix: string | null): PickerStorage {
  // reading the global itself throws in sandboxed iframes, so the check is guarded too
  const ok = () => {
    try {
      return prefix !== null && typeof localStorage !== "undefined";
    } catch {
      return false;
    }
  };
  return {
    get(name) {
      if (!ok()) return null;
      try {
        return localStorage.getItem(`${prefix}:${name}`);
      } catch {
        return null;
      }
    },
    set(name, value) {
      if (!ok()) return;
      try {
        localStorage.setItem(`${prefix}:${name}`, value);
      } catch {
        // quota or privacy mode: keep working in memory
      }
    },
  };
}

function createRecent(storage: PickerStorage): RecentColors & { load: () => void } {
  const list = shallowRef<string[]>([]);
  return {
    /** read the stored colors; called after mount, so the first client render matches the server's (which has none) */
    load() {
      try {
        const saved = JSON.parse(storage.get("recent") ?? "[]");
        if (Array.isArray(saved)) list.value = saved.filter((v) => typeof v === "string" && isSafeCssValue(v)).slice(0, RECENT_MAX);
      } catch {
        // ignore corrupt entries
      }
    },
    list: () => list.value,
    push(value) {
      // stored and shown again in later sessions: plain colors and gradients only, nothing huge
      if (!value || value.length > 512 || !isSafeCssValue(value)) return;
      // the same color written two ways (#ff0000, rgb(255 0 0)) is one recent color
      const key = colorKey(value);
      list.value = [value, ...list.value.filter((v) => colorKey(v) !== key)].slice(0, RECENT_MAX);
      storage.set("recent", JSON.stringify(list.value));
    },
  };
}

/**
 * Polite status line for "Copied", "Pasted" and similar feedback. Quiet messages are only read out, not shown.
 * Reads the ref itself so the root does not re-render.
 */
const Toast = /* @__PURE__ */ defineComponent({
  props: { toast: { type: prop<Ref<{ text: string; quiet: boolean } | null>>(), required: true } },
  setup(props) {
    return () => {
      const toast = props.toast.value;
      return (
        <span data-part="toast" role="status" aria-live="polite" data-state={toast && !toast.quiet ? "visible" : "hidden"}>
          {toast ? (toast.quiet ? toast.text : [<CheckIcon />, " ", toast.text]) : null}
        </span>
      );
    };
  },
});

/**
 * Escape hides the tooltips on screen (hovered or focused) until the pointer leaves or focus moves,
 * so they can be dismissed without moving either (WCAG 1.4.13).
 */
function hideTooltips(root: HTMLElement) {
  const shown = new Set(root.querySelectorAll<HTMLElement>("[data-tooltip]:hover"));
  const active = document.activeElement;
  if (active instanceof HTMLElement && "tooltip" in active.dataset && root.contains(active)) shown.add(active);
  for (const el of shown) {
    if ("tooltipHidden" in el.dataset) continue;
    el.dataset.tooltipHidden = "";
    const show = () => {
      delete el.dataset.tooltipHidden;
      el.removeEventListener("pointerleave", show);
      el.removeEventListener("blur", show);
    };
    el.addEventListener("pointerleave", show);
    el.addEventListener("blur", show);
  }
}

const isTextTarget = (t: EventTarget | null) => Boolean((t as HTMLElement | null)?.closest?.("input, textarea, [contenteditable='true']"));

export const Root = /* @__PURE__ */ defineComponent({
  name: "PickerRoot",
  inheritAttrs: false,
  props: rootProps,
  emits: rootEmits,
  setup(props, { attrs, slots, emit }) {
    const storage = createStorage(props.storageKey);
    const recent = createRecent(storage);
    onMounted(recent.load);
    const toast = shallowRef<{ text: string; quiet: boolean } | null>(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const notify = (text: string, quiet = false) => {
      // the same text twice in a row: a trailing no-break space changes the content, so it is read again
      toast.value = { text: toast.value?.text === text ? `${text}\u00a0` : text, quiet };
      clearTimeout(timer);
      timer = setTimeout(() => (toast.value = null), 1400);
    };

    // getters: the store always reads the latest props, and reading them in a render tracks them.
    // Passed to createPicker (not set afterwards) so the first read already knows defaultColor and friends.
    const store = createPicker({
      value: props.modelValue ?? props.defaultValue ?? "",
      get modes() {
        return props.modes;
      },
      get outputFormat() {
        return props.outputFormat;
      },
      get defaultColor() {
        return props.defaultColor;
      },
      get defaultGradient() {
        return props.defaultGradient;
      },
      get history() {
        return props.history;
      },
      onChange: (v) => {
        emit("update:modelValue", v);
        emit("change", v);
      },
      onChangeComplete: (v) => {
        recent.push(v);
        emit("changeComplete", v);
      },
    });

    watch(
      () => props.modelValue,
      (v) => v !== undefined && store.setValue(v),
    );

    const version = shallowRef(0);
    store.subscribe(() => version.value++);

    // an inline labels object is new on every parent render: merge again only when its content changes,
    // otherwise every part that shows text would re-render
    let labelsSource: Partial<Labels> | undefined;
    const labels = computed<Labels>((prev) => {
      const next = props.labels;
      if (prev && shallowEqual(labelsSource, next)) return prev;
      labelsSource = next;
      return { ...defaultLabels, ...next };
    });
    const ctx = providePicker({
      store,
      get labels() {
        return labels.value;
      },
      recent,
      get space() {
        return props.space;
      },
      hueMemory: { current: 0 },
      storage,
      notify,
      version,
    });

    // the root re-renders only when the mode changes (for layout), never while dragging
    const mode = selectFrom(ctx, (s) => s.mode);

    // set a couple of frames after opening, once late layout (eyedropper support, a remembered swatch tab) has
    // landed: until then nothing transitions, so the picker opens already in place instead of gliding into it
    const settled = shallowRef(false);
    let frame = 0;
    onMounted(() => {
      frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => (settled.value = true))));
    });
    onBeforeUnmount(() => cancelAnimationFrame(frame));

    const onKeyDown = (e: KeyboardEvent) => {
      fire(attrs.onKeydown, e);
      // also after a menu handled it: the trigger it refocuses would show its tooltip again
      if (e.key === "Escape") hideTooltips(e.currentTarget as HTMLElement);
      if (e.defaultPrevented || isTextTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (props.history && mod && e.key.toLowerCase() === "z") {
        if (e.shiftKey ? store.redo() : store.undo()) e.preventDefault();
        return;
      }
      if (!props.shortcuts || mod || e.altKey) return;
      // 1-4 switch modes, I picks from the screen
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < store.modes.length) {
        e.preventDefault();
        store.setMode(store.modes[index]);
        store.commit();
        // focus stays where it was, so say which mode is on
        notify(labels.value[store.modes[index]], true);
      } else if (e.key.toLowerCase() === "i") {
        const dropper = (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>("[data-part='eye-dropper']");
        if (dropper) {
          e.preventDefault();
          dropper.click();
        }
      }
    };

    // Cmd/Ctrl+C copies the value, Cmd/Ctrl+V applies any pasted color or gradient (text fields keep their own)
    const onCopy = (e: ClipboardEvent) => {
      fire(attrs.onCopy, e);
      if (e.defaultPrevented || isTextTarget(e.target) || window.getSelection()?.toString()) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", store.getState().value);
      notify(labels.value.copied);
    };
    const onPaste = (e: ClipboardEvent) => {
      fire(attrs.onPaste, e);
      if (e.defaultPrevented || isTextTarget(e.target)) return;
      const text = e.clipboardData?.getData("text/plain").trim();
      if (text && store.setCss(text)) {
        e.preventDefault();
        store.commit();
        notify(labels.value.pasted);
      }
    };

    return () => (
      <div
        // a named group, so screen readers announce "Color picker" on the way in (an aria-label attr wins)
        role="group"
        aria-label={labels.value.picker}
        {...attrs}
        data-colorshot=""
        data-part="root"
        data-theme={props.theme}
        data-size={props.size}
        data-mode={mode.value}
        data-settled={settled.value ? "" : undefined}
        onKeydown={onKeyDown}
        onCopy={onCopy}
        onPaste={onPaste}
        onPointerdown={(e: PointerEvent) => {
          fire(attrs.onPointerdown, e);
          // Safari does not focus buttons on click; focus them so keyboard use can continue from there
          const button = (e.target as HTMLElement).closest("button");
          // focusVisible: false keeps the keyboard focus ring off for a mouse click
          if (button && !button.disabled && document.activeElement !== button)
            button.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
        }}
      >
        {slots.default?.()}
        <Toast toast={toast} />
      </div>
    );
  },
});
