// Review screenshots of the harness pickers: node scripts/shots.mjs <outDir>
// Each shot isolates one picker on a plain background at 2x.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

async function shot(name, { theme = "light", value, picker = "picker-full", act, size = { width: 360, height: 760 } } = {}) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2, colorScheme: theme });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`http://localhost:5190/?harness${value ? `&value=${encodeURIComponent(value)}` : ""}`);
  const root = page.locator(`[data-testid="${picker}"]`).first();
  await root.waitFor();
  await page.evaluate(
    ({ picker, theme }) => {
      const p = document.querySelector(`[data-testid="${picker}"]`);
      p.dataset.theme = theme;
      const st = document.createElement("style");
      st.textContent = `body{background:${theme === "dark" ? "#0c0c0e" : "#f2f2f4"}!important} body *{visibility:hidden} [data-iso], [data-iso] *, [data-colorshot-popover], [data-colorshot-popover] *{visibility:visible} [data-iso]{position:fixed!important;top:24px;left:24px;z-index:9999}`;
      document.head.appendChild(st);
      p.setAttribute("data-iso", "");
      scrollTo(0, 0);
    },
    { picker, theme },
  );
  if (act) await act(page, root);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${name}.png` });
  if (errors.length) console.log(name, "ERRORS:", errors);
  await page.close();
}

const tab = (mode) => async (_page, root) => root.locator(`[data-mode="${mode}"]`).click();
const only = process.argv[3]?.split(",");
const want = (name) => !only || only.includes(name);
if (want("linear")) await shot("linear", { act: tab("linear") });
if (want("solid")) await shot("solid", { act: tab("solid") });
if (want("radial")) await shot("radial", { act: tab("radial") });
if (want("conic-dark")) await shot("conic-dark", { theme: "dark", act: tab("conic") });
if (want("menu-open")) await shot("menu-open", {
  act: async (page, root) => {
    await root.locator(`[data-mode="linear"]`).click();
    await root.locator('[aria-haspopup="menu"]').click();
  },
});
if (want("format-open-dark")) await shot("format-open-dark", {
  theme: "dark",
  act: async (_page, root) => root.locator('[data-kind="format"] [data-part="select-trigger"]').click(),
});
if (want("search-open")) await shot("search-open", {
  act: async (_page, root) => {
    await root.locator(`[aria-label="Search colors"]`).first().click();
  },
});
if (want("oklch")) await shot("oklch", { picker: "picker-oklch" });
if (want("compact")) await shot("compact", { picker: "picker-compact" });
if (want("contrast")) await shot("contrast", { picker: "picker-contrast" });
if (want("field-open")) {
  await shot("field-open", {
    picker: "picker-full",
    act: async (page) => {
      await page.evaluate(() => {
        document.querySelectorAll("[data-iso]").forEach((e) => e.removeAttribute("data-iso"));
        const f = document.querySelector("[data-colorshot-field]");
        f.setAttribute("data-iso", "");
      });
      await page.locator("[data-colorshot-field]").first().click();
    },
  });
}
await browser.close();
console.log("done");
