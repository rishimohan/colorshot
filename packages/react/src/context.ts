import { createContext, useContext, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { PickerState, PickerStore } from "@colorshot/core";
import type { Labels } from "./labels";
import type { PickerStorage } from "./root";

export interface RecentColors {
  list: () => string[];
  push: (value: string) => void;
  subscribe: (fn: () => void) => () => void;
}

export type AreaSpace = "hsv" | "oklch";

export interface PickerContextValue {
  store: PickerStore;
  labels: Labels;
  recent: RecentColors;
  /** color model of the area and hue slider */
  space: AreaSpace;
  /** last chromatic OKLCH hue, so dragging through greys keeps it */
  hueMemory: { current: number };
  storage: PickerStorage;
  /** show a short status message ("Copied"); `quiet` only announces it to screen readers */
  notify: (text: string, quiet?: boolean) => void;
}

export const PickerContext = /* @__PURE__ */ createContext<PickerContextValue | null>(null);

export function usePickerContext(): PickerContextValue {
  const ctx = useContext(PickerContext);
  if (!ctx) throw new Error("Colorshot parts must be rendered inside <Picker.Root> or <ColorPicker>.");
  return ctx;
}

export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is((a as any)[k], (b as any)[k]));
}

/**
 * Subscribe to a slice of picker state. Parts only re-render when their slice changes,
 * so dragging the hue does not re-render the swatches or the inputs that do not show hue.
 */
export function usePicker<T>(selector: (state: PickerState) => T, isEqual: (a: T, b: T) => boolean = shallowEqual): T {
  const { store } = usePickerContext();
  const cache = useRef<{ value: T } | null>(null);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const getSnapshot = () => {
    const next = selectorRef.current(store.getState());
    if (cache.current && isEqual(cache.current.value, next)) return cache.current.value;
    cache.current = { value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** The store, for calling actions (`setHsva`, `addStop`, `commit`...). */
export function usePickerStore(): PickerStore {
  return usePickerContext().store;
}
