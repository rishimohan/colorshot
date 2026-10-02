import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { parseColor } from "@colorshot/core";
import { usePickerContext } from "../context";
import { EyeDropperIcon } from "../icons";

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

export interface EyeDropperProps {
  className?: string;
  style?: CSSProperties;
  /** Custom picker for browsers without the native EyeDropper API (Firefox, Safari). */
  pick?: EyeDropperFn;
  /** Keep the current opacity instead of taking the picked pixel's (default true) */
  keepAlpha?: boolean;
}

/** Picks a color from the screen. Renders nothing when neither the native API nor `pick` is available. */
export const EyeDropper = /* @__PURE__ */ memo(function EyeDropper({ className, style, pick, keepAlpha = true }: EyeDropperProps) {
  const { store, labels } = usePickerContext();
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setSupported(Boolean(pick) || hasNativeEyeDropper());
    return () => abort.current?.abort();
  }, [pick]);

  if (!supported) return null;

  const run = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setActive(true);
    const css = await (pick ?? nativeEyeDropper)(controller.signal);
    setActive(false);
    if (!css || controller.signal.aborted) return;
    const parsed = parseColor(css);
    if (!parsed) return;
    store.setColor(parsed.color, { keepAlpha: keepAlpha && store.getState().hsva.a > 0 });
    store.commit();
  };

  return (
    <button
      type="button"
      data-part="eye-dropper"
      data-state={active ? "active" : undefined}
      className={className}
      style={style}
      data-tooltip={labels.eyeDropper}
      aria-label={labels.eyeDropper}
      onClick={run}
    >
      <EyeDropperIcon />
    </button>
  );
});
