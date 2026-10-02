import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from "vue";
import type { PickerState, PickerStore } from "@colorshot/core";
import type { Labels } from "./labels";

/** localStorage access that never throws (blocked storage, private mode, SSR). */
export interface PickerStorage {
  get: (name: string) => string | null;
  set: (name: string, value: string) => void;
}

export interface RecentColors {
  /** reactive: reading it in a render or computed tracks the list */
  list: () => string[];
  push: (value: string) => void;
}

export type AreaSpace = "hsv" | "oklch";

export interface PickerContextValue {
  store: PickerStore;
  /** reactive getter: merged default and custom labels */
  readonly labels: Labels;
  recent: RecentColors;
  /** color model of the area and hue slider (reactive getter) */
  readonly space: AreaSpace;
  /** last chromatic OKLCH hue, so dragging through greys keeps it */
  hueMemory: { current: number };
  storage: PickerStorage;
  /** show a short status message ("Copied"); `quiet` only announces it to screen readers */
  notify: (text: string, quiet?: boolean) => void;
  /** bumped on every store change; slices recompute from it */
  version: Ref<number>;
}

export const PickerKey: InjectionKey<PickerContextValue> = /* @__PURE__ */ Symbol("colorshot");

/** Provide a picker context to the parts below. `<Picker.Root>` does this for you. */
export function providePicker(ctx: PickerContextValue): PickerContextValue {
  provide(PickerKey, ctx);
  return ctx;
}

export function usePickerContext(): PickerContextValue {
  const ctx = inject(PickerKey, null);
  if (!ctx) throw new Error("Colorshot parts must be rendered inside <Picker.Root> or <ColorPicker>.");
  return ctx;
}

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is((a as any)[k], (b as any)[k]));
}

/** A slice of picker state for one context. The previous value is kept while equal, so dependents do not update. */
export function selectFrom<T>(ctx: PickerContextValue, selector: (state: PickerState) => T, isEqual: (a: T, b: T) => boolean = shallowEqual): ComputedRef<T> {
  return computed<T>((prev) => {
    void ctx.version.value;
    const next = selector(ctx.store.getState());
    return prev !== undefined && isEqual(prev, next) ? prev : next;
  });
}

/**
 * Subscribe to a slice of picker state. Parts only re-render when their slice changes,
 * so dragging the hue does not re-render the swatches or the inputs that do not show hue.
 * The selector may also read reactive props; the slice follows them.
 */
export function usePicker<T>(selector: (state: PickerState) => T, isEqual?: (a: T, b: T) => boolean): ComputedRef<T> {
  return selectFrom(usePickerContext(), selector, isEqual);
}

/** The store, for calling actions (`setHsva`, `addStop`, `commit`...). */
export function usePickerStore(): PickerStore {
  return usePickerContext().store;
}
