/**
 * Output safety. Hosts store picker values and often write them into HTML or CSS (inline styles, server-side
 * rendering, image renderers), so everything the picker emits must be a plain color or gradient: no quotes,
 * semicolons, braces or angle brackets, and no functions that load resources (url, image-set) or run code.
 */

/** Longest CSS value the picker reads; longer input is treated as unreadable (also bounds parser work). */
export const MAX_CSS_LENGTH = 4096;

const SAFE_CHARS = /^[a-z0-9#%.,+\-_/()\s]*$/i;
const ALLOWED_FUNCTIONS =
  /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var|calc|min|max|clamp|(?:-(?:webkit|moz|o|ms)-)?(?:repeating-)?(?:linear|radial|conic)-gradient)$/i;
const NAME_CHAR = /[a-z-]/i;

/**
 * True when `value` is a plain CSS color or gradient value: only safe characters and only color, math and
 * gradient functions. The picker checks every value it emits; hosts that write values into HTML or CSS should
 * check them again on their own side, since input may not come from the picker.
 */
export function isSafeCssValue(value: string): boolean {
  if (typeof value !== "string" || value.length > MAX_CSS_LENGTH || !SAFE_CHARS.test(value)) return false;
  // every "name(" must be an allowed function (scan back from each "(", linear time)
  for (let i = value.indexOf("("); i !== -1; i = value.indexOf("(", i + 1)) {
    let start = i;
    while (start > 0 && NAME_CHAR.test(value[start - 1])) start--;
    const name = value.slice(start, i);
    if (name && !ALLOWED_FUNCTIONS.test(name)) return false;
  }
  return true;
}

/** `value` when it is safe (see isSafeCssValue), otherwise `fallback`. For writing values into styles. */
export function safeCssValue(value: string | null | undefined, fallback = "transparent"): string {
  return value && isSafeCssValue(value) ? value : fallback;
}
