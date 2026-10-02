import type { PropType } from "vue";

// Calls to these helpers in top-level prop objects carry /* @__PURE__ */, so bundlers can drop the
// components an app does not use.

/** A prop of any runtime type, typed as T for TypeScript. */
export const prop = <T>() => null as unknown as PropType<T>;

/** Boolean prop with a default; `<ColorPicker compare />` in templates casts to true. */
export const bool = (d = false) => ({ type: Boolean, default: d });

/** Boolean-or-something prop, so the bare attribute still reads as true. */
export const boolOr = <T>(type: unknown, d?: boolean | T) => ({ type: [Boolean, type] as unknown as PropType<boolean | T>, default: d });

/** `{ ...a, ...b }` for objects without shared keys. */
export const merge = <A extends object, B extends object>(a: A, b: B): A & B => ({ ...a, ...b });

/** `a` without `keys`. */
export const omit = <A extends object, K extends keyof A>(a: A, ...keys: K[]): Omit<A, K> => {
  const out = { ...a };
  for (const k of keys) delete out[k];
  return out;
};

/** Call a listener from `attrs`, which may be a function or an array of them. */
export const fire = (handler: unknown, e: Event) => {
  for (const fn of ([] as unknown[]).concat(handler)) if (typeof fn === "function") fn(e);
};
