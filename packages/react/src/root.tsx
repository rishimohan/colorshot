import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { colorKey, createPicker, isSafeCssValue, type OutputFormat, type PickerMode, type PickerStore } from "@colorshot/core";
import { CheckIcon } from "./icons";
import { PickerContext, shallowEqual, useIsoLayoutEffect, type AreaSpace, type PickerContextValue, type RecentColors } from "./context";
import { defaultLabels, type Labels } from "./labels";

export interface RootProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Controlled CSS value: any color or gradient string */
  value?: string;
  /** Uncontrolled starting value */
  defaultValue?: string;
  /** Fires while the user drags or types, at most once per frame */
  onChange?: (value: string) => void;
  /** Fires once when an interaction ends: pointer up, input commit, swatch click. Use it for undo history. */
  onChangeComplete?: (value: string) => void;
  /** Allowed modes. Default: solid, linear, radial, conic */
  modes?: readonly PickerMode[];
  /** How colors are written. Default `"preserve"`: the format each color came in */
  outputFormat?: OutputFormat;
  defaultColor?: string;
  defaultGradient?: string;
  /** Override any UI text */
  labels?: Partial<Labels>;
  /** `light`, `dark`, or leave unset to follow the OS */
  theme?: "light" | "dark";
  /** localStorage prefix for recent colors and the chosen input format. `null` keeps them in memory only */
  storageKey?: string | null;
  /** `"sm"`: 240px wide, 24px controls, for tight inspector panels */
  size?: "sm";
  /** keyboard shortcuts while the picker has focus: 1-4 switch modes, I picks from the screen (default true) */
  shortcuts?: boolean;
  /** Area and hue slider color model: `"hsv"` (default, like most tools) or `"oklch"` (perceptual, shows wide gamut) */
  space?: AreaSpace;
  /** Undo / redo with Cmd/Ctrl+Z inside the picker (off by default) */
  history?: boolean | { limit?: number };
  children?: ReactNode;
}

const RECENT_MAX = 16;

/** localStorage access that never throws (blocked storage, private mode, SSR). */
export interface PickerStorage {
  get: (name: string) => string | null;
  set: (name: string, value: string) => void;
}

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

function createRecent(storage: PickerStorage): RecentColors {
  let list: string[] = [];
  const listeners = new Set<() => void>();
  try {
    const saved = JSON.parse(storage.get("recent") ?? "[]");
    if (Array.isArray(saved)) list = saved.filter((v) => typeof v === "string" && isSafeCssValue(v)).slice(0, RECENT_MAX);
  } catch {
    // ignore corrupt entries
  }
  return {
    list: () => list,
    push(value) {
      // stored and shown again in later sessions: plain colors and gradients only, nothing huge
      if (!value || value.length > 512 || !isSafeCssValue(value)) return;
      // the same color written two ways (#ff0000, rgb(255 0 0)) is one recent color
      const key = colorKey(value);
      list = [value, ...list.filter((v) => colorKey(v) !== key)].slice(0, RECENT_MAX);
      storage.set("recent", JSON.stringify(list));
      listeners.forEach((fn) => fn());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

function createToaster() {
  let toast: { text: string; quiet: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  return {
    get: () => toast,
    show(next: string, quiet = false) {
      // the same text twice in a row: a trailing no-break space changes the content, so it is read again
      toast = { text: toast?.text === next ? `${next}\u00a0` : next, quiet };
      emit();
      clearTimeout(timer);
      timer = setTimeout(() => {
        toast = null;
        emit();
      }, 1400);
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Polite status line for "Copied", "Pasted" and similar feedback. Quiet messages are only read out, not shown. */
function Toast({ toaster }: { toaster: ReturnType<typeof createToaster> }) {
  const toast = useSyncExternalStore(toaster.subscribe, toaster.get, toaster.get);
  return (
    <span data-part="toast" role="status" aria-live="polite" data-state={toast && !toast.quiet ? "visible" : "hidden"}>
      {toast &&
        (toast.quiet ? (
          toast.text
        ) : (
          <>
            <CheckIcon /> {toast.text}
          </>
        ))}
    </span>
  );
}

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

export const Root = /* @__PURE__ */ forwardRef<HTMLDivElement, RootProps>(function Root(
  {
    value,
    defaultValue,
    onChange,
    onChangeComplete,
    modes,
    outputFormat,
    defaultColor,
    defaultGradient,
    labels,
    theme,
    storageKey = "colorshot",
    space = "hsv",
    history,
    size,
    shortcuts = true,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const storageRef = useRef<PickerStorage | null>(null);
  if (!storageRef.current) storageRef.current = createStorage(storageKey);
  const storage = storageRef.current;
  const recentRef = useRef<RecentColors | null>(null);
  if (!recentRef.current) recentRef.current = createRecent(storage);
  const recent = recentRef.current;
  const toasterRef = useRef<ReturnType<typeof createToaster> | null>(null);
  if (!toasterRef.current) toasterRef.current = createToaster();
  const toaster = toasterRef.current;

  const storeRef = useRef<PickerStore | null>(null);
  // all options up front, so the first read already knows defaultColor, modes and the output format
  if (!storeRef.current) storeRef.current = createPicker({ value: value ?? defaultValue ?? "", modes, outputFormat, defaultColor, defaultGradient, history });
  const store = storeRef.current;

  // latest callbacks without re-creating the store
  store.setOptions({
    modes,
    outputFormat,
    defaultColor,
    defaultGradient,
    onChange,
    history,
    onChangeComplete: (v) => {
      recent.push(v);
      onChangeComplete?.(v);
    },
  });

  useIsoLayoutEffect(() => {
    if (value !== undefined) store.setValue(value);
  }, [value, store]);

  // the root re-renders only when the mode changes (for layout), never while dragging
  const getMode = () => store.getState().mode;
  const mode = useSyncExternalStore(store.subscribe, getMode, getMode);

  // set a couple of frames after opening, once late layout (eyedropper support, a remembered swatch tab) has
  // landed: until then nothing transitions, so the picker opens already in place instead of gliding into it
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => setSettled(true))));
    return () => cancelAnimationFrame(frame);
  }, []);

  const hueMemory = useRef(0);
  // an inline labels object is new on every render: merge again only when its content changes,
  // otherwise the context would change and every part would re-render
  const labelsRef = useRef<{ source: Partial<Labels> | undefined; merged: Labels } | null>(null);
  if (!labelsRef.current || !shallowEqual(labelsRef.current.source, labels)) labelsRef.current = { source: labels, merged: { ...defaultLabels, ...labels } };
  const mergedLabels = labelsRef.current.merged;
  const ctx = useMemo<PickerContextValue>(
    () => ({ store, labels: mergedLabels, recent, space, hueMemory, storage, notify: toaster.show }),
    [store, mergedLabels, recent, space, storage, toaster],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    rest.onKeyDown?.(e);
    // also after a menu handled it: the trigger it refocuses would show its tooltip again
    if (e.key === "Escape") hideTooltips(e.currentTarget);
    if (e.defaultPrevented || isTextTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (history && mod && e.key.toLowerCase() === "z") {
      if (e.shiftKey ? store.redo() : store.undo()) e.preventDefault();
      return;
    }
    if (!shortcuts || mod || e.altKey) return;
    // 1-4 switch modes, I picks from the screen
    const index = Number(e.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < store.modes.length) {
      e.preventDefault();
      store.setMode(store.modes[index]);
      store.commit();
      // focus stays where it was, so say which mode is on
      toaster.show(mergedLabels[store.modes[index]], true);
    } else if (e.key.toLowerCase() === "i") {
      const dropper = e.currentTarget.querySelector<HTMLButtonElement>("[data-part='eye-dropper']");
      if (dropper) {
        e.preventDefault();
        dropper.click();
      }
    }
  };

  // Cmd/Ctrl+C copies the value, Cmd/Ctrl+V applies any pasted color or gradient (text fields keep their own)
  const onCopy = (e: ClipboardEvent<HTMLDivElement>) => {
    rest.onCopy?.(e);
    if (e.defaultPrevented || isTextTarget(e.target) || window.getSelection()?.toString()) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", store.getState().value);
    toaster.show(mergedLabels.copied);
  };
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    rest.onPaste?.(e);
    if (e.defaultPrevented || isTextTarget(e.target)) return;
    const text = e.clipboardData.getData("text/plain").trim();
    if (text && store.setCss(text)) {
      e.preventDefault();
      store.commit();
      toaster.show(mergedLabels.pasted);
    }
  };

  return (
    <PickerContext.Provider value={ctx}>
      <div
        ref={ref}
        // a named group, so screen readers announce "Color picker" on the way in (aria-label in props wins)
        role="group"
        aria-label={mergedLabels.picker}
        data-colorshot=""
        data-part="root"
        data-theme={theme}
        data-size={size}
        data-mode={mode}
        data-settled={settled ? "" : undefined}
        className={className}
        style={style as CSSProperties}
        {...rest}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onPaste={onPaste}
        onPointerDown={(e) => {
          rest.onPointerDown?.(e);
          // Safari does not focus buttons on click; focus them so keyboard use can continue from there
          const button = (e.target as HTMLElement).closest("button");
          // focusVisible: false keeps the keyboard focus ring off for a mouse click
          if (button && !button.disabled && document.activeElement !== button)
            button.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
        }}
      >
        {children}
        <Toast toaster={toaster} />
      </div>
    </PickerContext.Provider>
  );
});
