import { expect, test } from "@playwright/test";
import { openHarness, part } from "./helpers";

// Every number and label must fit its box: no clipped digits in any format, at either size.
const FORMATS = ["HEX", "RGB", "HSL", "HSB", "OKLCH", "OKLAB", "LCH", "LAB", "P3", "CMYK"];
// values that produce the widest text per format (negative a/b, 3-decimal chroma, wide-gamut p3)
const VALUES = ["color(display-p3 0.123 0.456 0.789 / 0.5)", "oklch(0.627 0.257 29.2)", "lab(54 -86 -120)", "#0a0a0a"];

for (const size of ["md", "sm"] as const) {
  test(`no clipped text in any format (${size})`, async ({ page }) => {
    await openHarness(page);
    const root = page.getByTestId(`picker-formats-${size}`);
    await root.scrollIntoViewIfNeeded();
    const overflow: string[] = [];
    // inputs: text wider than the box. Other controls: any in-flow text line that runs past the control's edges
    // (floating labels such as the stop position chip sit outside on purpose and are skipped)
    const clipped = (scope = root) =>
      scope.evaluate((el) => {
        const out: string[] = [];
        for (const n of el.querySelectorAll<HTMLElement>("input, button, [data-part='select-value'], [data-part='field-label']")) {
          if (!n.offsetParent) continue;
          const name = n.getAttribute("aria-label") ?? n.dataset.part;
          if (n instanceof HTMLInputElement) {
            if (n.scrollWidth > n.clientWidth + 1) out.push(`${name}: "${n.value}" ${n.scrollWidth}>${n.clientWidth}`);
            continue;
          }
          const box = n.getBoundingClientRect();
          const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
          for (let t = walker.nextNode(); t; t = walker.nextNode()) {
            if (!t.textContent!.trim()) continue;
            let floating = false;
            for (let p = t.parentElement; p && p !== n; p = p.parentElement) {
              const pos = getComputedStyle(p).position;
              if (pos === "absolute" || pos === "fixed") floating = true;
            }
            if (floating) continue;
            const r = document.createRange();
            r.selectNodeContents(t);
            const tr = r.getBoundingClientRect();
            // the visible region: the control, narrowed by any clipping ancestor inside it
            let left = box.left, right = box.right;
            for (let p = t.parentElement; p && p !== n.parentElement; p = p.parentElement) {
              if (getComputedStyle(p).overflowX !== "visible") {
                const pr = p.getBoundingClientRect();
                left = Math.max(left, pr.left);
                right = Math.min(right, pr.right);
              }
            }
            if (tr.left < left - 1 || tr.right > right + 1) out.push(`${name}: "${t.textContent}" text ${Math.round(tr.width)} in ${Math.round(right - left)}`);
          }
        }
        // nothing in normal flow may stick out of the picker, and only the swatch grid (down) and the swatch
        // tabs (sideways) may scroll
        const frame = el.getBoundingClientRect();
        for (const n of el.querySelectorAll<HTMLElement>("*")) {
          if (!n.offsetParent && getComputedStyle(n).position !== "fixed") continue;
          let floating = false;
          for (let p: HTMLElement | null = n; p && p !== el; p = p.parentElement) {
            const pos = getComputedStyle(p).position;
            if (pos === "absolute" || pos === "fixed") floating = true;
          }
          if (floating) continue;
          const r = n.getBoundingClientRect();
          const name = n.getAttribute("aria-label") ?? n.dataset.part ?? n.tagName.toLowerCase();
          if (r.width && (r.left < frame.left - 0.5 || r.right > frame.right + 0.5)) out.push(`${name} sticks out ${Math.round(r.left - frame.left)}..${Math.round(r.right - frame.right)}`);
          const st = getComputedStyle(n);
          if (["auto", "scroll"].includes(st.overflowY) && n.dataset.part !== "swatch-grid" && n.scrollHeight > n.clientHeight + 1)
            out.push(`${name} scrolls vertically ${n.scrollHeight}>${n.clientHeight}`);
          if (["auto", "scroll"].includes(st.overflowX) && n.dataset.part !== "swatch-tabs" && n.scrollWidth > n.clientWidth + 1)
            out.push(`${name} scrolls sideways ${n.scrollWidth}>${n.clientWidth}`);
        }
        return out;
      });
    for (const value of VALUES) {
      // paste the value into the hex box, which accepts any CSS color as written
      for (const format of FORMATS) {
        await part(part(root, "inputs"), "select-trigger").click();
        await page.getByRole("option", { name: new RegExp(`^${format}\\b`, "i") }).click();
        if (format === "HEX") {
          const hex = part(root, "inputs").locator('[data-field="hex"] input');
          await hex.fill(value);
          await hex.press("Enter");
        }
        overflow.push(...(await clipped()).map((b) => `${value} ${format} ${b}`));
      }
    }
    // gradient modes add the stop position, angle and center fields
    for (const mode of ["Linear", "Radial", "Conic"]) {
      await root.getByRole("radio", { name: mode }).click();
      overflow.push(...(await clipped()).map((b) => `${mode} ${b}`));
    }
    // the other harness pickers (swatch tabs, compact presets), in every mode
    for (const id of ["picker-full", "picker-compact"]) {
      const other = page.getByTestId(id);
      for (const mode of ["Solid", "Linear", "Radial", "Conic"]) {
        await other.getByRole("radio", { name: mode }).click();
        overflow.push(...(await clipped(other)).map((b) => `${id} ${mode} ${b}`));
      }
    }
    expect([...new Set(overflow)]).toEqual([]);
  });
}
