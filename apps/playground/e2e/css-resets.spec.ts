import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { nextFrame } from "./helpers";

// An app's CSS reset must not restyle the picker, whichever order the stylesheets load in. Tailwind v4 keeps its
// preflight in `@layer base`: loaded after Colorshot, that layer used to outrank `@layer colorshot` and flatten the
// panel (padding, round stops, borders). Tailwind v3's preflight is unlayered and used to strip the stop borders.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const TW4 = `@layer theme, base, components, utilities;\n@layer base {\n${fixture("tailwind-v4-preflight.css")}\n}`;
const TW3 = fixture("tailwind-v3-preflight.css");
// plain app CSS that styles form controls globally
const GLOBAL = `
button, input, select { padding: 9px 17px; margin: 3px; border: 3px solid red; border-radius: 999px; background: yellow;
  font: 700 19px/2 serif; color: green; box-shadow: none; appearance: auto; }
`;

const RESETS: [string, string][] = [
  ["Tailwind v4 preflight", TW4],
  ["Tailwind v3 preflight", TW3],
  ["global form control styles", GLOBAL],
];

const LINEAR = `?capture&value=${encodeURIComponent("linear-gradient(90deg, #3E5CEB 0%, #22C55E 100%)")}`;

// picker states, each opened by its query and an optional interaction
const STATES: { name: string; query: string; prepare?: (page: Page) => Promise<unknown> }[] = [
  { name: "solid", query: "?capture&value=%233E5CEB" },
  { name: "linear", query: LINEAR },
  { name: "conic", query: `?capture&value=${encodeURIComponent("conic-gradient(from 90deg, #F97316, #EC4899, #8B5CF6, #F97316)")}` },
  { name: "dark radial", query: `?capture&theme=dark&value=${encodeURIComponent("radial-gradient(circle, #F97316 0%, #8B5CF6 100%)")}` },
  { name: "field", query: "?capture&field&value=%233E5CEB" },
  { name: "small inset", query: "?capture&size=sm&variant=inset&value=%233E5CEB" },
  {
    name: "swatch search open",
    query: "?capture&value=%233E5CEB",
    prepare: async (page) => {
      await page.locator('[data-part="swatch-header"] [data-part="icon-button"]').last().click();
      await page.locator('[data-part="swatch-search-input"]').waitFor();
    },
  },
  {
    name: "format menu open",
    query: LINEAR,
    prepare: async (page) => {
      await page.locator('[data-part="select-trigger"]').click();
      await page.locator('[data-part="select-option"]').first().waitFor();
    },
  },
  {
    name: "keyboard focus ring",
    query: LINEAR,
    prepare: async (page) => {
      await page.locator('[data-part="field-input"]').first().click();
      await page.keyboard.press("Shift+Tab");
    },
  },
];

// what an element looks like; geometry comes from its box, so layout props are not listed
const PROPS = [
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-top-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "background-color", "background-image", "color", "font-family", "font-size", "font-weight", "letter-spacing",
  "box-shadow", "opacity", "outline-style",
];

type Snapshot = Record<string, Record<string, string>>;

/**
 * Every Colorshot element and its drawn ::before / ::after: its box, and the listed styles that can be seen.
 * Border style and color only count when a border is drawn, and corner radius only when the element paints a
 * background, border or shadow.
 */
function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate((props) => {
    const out: Record<string, Record<string, string>> = {};
    const read = (cs: CSSStyleDeclaration, box: string) => {
      const s: Record<string, string> = { box };
      for (const p of props) s[p] = cs.getPropertyValue(p);
      const bordered = ["top", "right", "bottom", "left"].some((side) => parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0);
      if (!bordered) {
        delete s["border-top-style"];
        delete s["border-top-color"];
      }
      const paints = bordered || cs.backgroundImage !== "none" || cs.boxShadow !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)";
      if (!paints) for (const p of Object.keys(s)) if (p.endsWith("-radius")) delete s[p];
      return s;
    };
    // Colorshot's own elements only
    const scope = "[data-colorshot], [data-colorshot] *, [data-colorshot-field], [data-colorshot-field] *";
    document.querySelectorAll(scope).forEach((el, i) => {
      // boxes relative to the component they belong to: where the app places the picker or trigger is its own call
      const host = el.parentElement?.closest("[data-colorshot], [data-colorshot-field]");
      const o = host ? host.getBoundingClientRect() : el.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const part = (el as HTMLElement).dataset?.part;
      const key = `${i}:${el.tagName.toLowerCase()}${part ? `[${part}]` : ""}`;
      const box = [r.x - o.x, r.y - o.y, r.width, r.height].map((n) => Math.round(n * 4) / 4).join(" ");
      out[key] = read(getComputedStyle(el), box);
      // drawn pseudo-elements: their size comes from width / height / inset, so record those as the box
      for (const pseudo of ["::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.content === "none") continue;
        const box = ["width", "height", "top", "left", "right", "bottom", "inset-inline-start"].map((p) => cs.getPropertyValue(p)).join(" ");
        out[key + pseudo] = read(cs, box);
      }
    });
    return out;
  }, PROPS);
}

/** Every changed value, as "element: prop before -> after". */
function diff(before: Snapshot, after: Snapshot) {
  const out: string[] = [];
  for (const [key, props] of Object.entries(before)) {
    for (const prop of new Set([...Object.keys(props), ...Object.keys(after[key] ?? {})])) {
      if (after[key]?.[prop] !== props[prop]) out.push(`${key}: ${prop} ${props[prop]} -> ${after[key]?.[prop]}`);
    }
  }
  return out;
}

async function open(page: Page, query: string) {
  await page.goto(`/${query}`);
  await page.locator("[data-colorshot]").first().waitFor();
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await nextFrame(page);
}

/** Add the stylesheet before every other stylesheet, or after all of them. */
async function addCss(page: Page, css: string, where: "first" | "last") {
  await page.evaluate(
    ([css, where]) => {
      const style = document.createElement("style");
      style.textContent = css;
      if (where === "first") document.head.prepend(style);
      else document.head.append(style);
    },
    [css, where] as const,
  );
  await nextFrame(page);
}

for (const [reset, css] of RESETS) {
  for (const where of ["first", "last"] as const) {
    test(`${reset} loaded ${where === "first" ? "before" : "after"} Colorshot leaves the picker unchanged`, async ({ page }) => {
      for (const { name, query, prepare } of STATES) {
        await open(page, query);
        await prepare?.(page);
        await nextFrame(page);
        const before = await snapshot(page);
        await addCss(page, css, where);
        const after = await snapshot(page);
        expect.soft(Object.keys(after), name).toEqual(Object.keys(before));
        expect.soft(diff(before, after), name).toEqual([]);
      }
    });
  }
}

test("theme tokens set by app CSS still win, in any load order", async ({ page }) => {
  for (const where of ["first", "last"] as const) {
    await open(page, STATES[0].query);
    // the same selector as Colorshot's own token rule: its layer loses to unlayered app CSS either way
    await addCss(page, "[data-colorshot] { --cs-radius: 3px; --cs-bg: rgb(1, 2, 3); }", where);
    const root = page.locator("[data-colorshot]");
    await expect(root).toHaveCSS("border-top-left-radius", "3px");
    await expect(root).toHaveCSS("background-color", "rgb(1, 2, 3)");
  }
});

test("part rules from the docs override Colorshot when they load after it", async ({ page }) => {
  await open(page, STATES[0].query);
  await addCss(page, '[data-colorshot] [data-part="swatch"] { border-radius: 2px; }', "last");
  await expect(page.locator('[data-part="swatch"]').first()).toHaveCSS("border-top-left-radius", "2px");
});

test("layout utilities on the picker and the ColorField trigger still apply", async ({ page }) => {
  for (const query of [STATES[0].query, "?capture&field&value=%233E5CEB"]) {
    await open(page, query);
    await addCss(page, "@layer theme, base, components, utilities;\n@layer utilities { .app-mt { margin-top: 8px; } }", "first");
    const el = page.locator(query.includes("field") ? "[data-colorshot-field]" : "[data-colorshot]").first();
    await el.evaluate((node) => node.classList.add("app-mt"));
    await expect(el).toHaveCSS("margin-top", "8px");
  }
});
