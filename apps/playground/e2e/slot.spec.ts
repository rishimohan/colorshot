import { expect, test, type Locator, type Page } from "@playwright/test";
import { nextFrame } from "./helpers";

// Content passed to ColorPicker (children / the Vue default slot) belongs to the app. Colorshot's element rules
// (the button and input reset, box-sizing, focus outline) skip it. A plain <button> there gets Colorshot's control
// look; a button with any class is styled by the app alone, whether by plain CSS or utilities in a cascade layer.
const LOOK = "padding: 6px 12px; margin: 0px 0px 0px 0px; border: 1px solid rgb(10, 20, 30); border-radius: 9px; background: rgb(200, 210, 220); color: rgb(40, 50, 60); font-size: 15px;";
const HOST: Record<string, string> = {
  "plain CSS": `.host-btn { ${LOOK} }`,
  "Tailwind-style utilities in @layer utilities": `@layer theme, base, components, utilities;\n@layer utilities { .host-btn { ${LOOK} } }`,
};

async function addCss(page: Page, css: string) {
  await page.evaluate((css) => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.prepend(style);
  }, css);
  await nextFrame(page);
}

async function expectOwnLook(button: Locator) {
  await expect(button).toHaveCSS("padding", "6px 12px");
  await expect(button).toHaveCSS("border-top-width", "1px");
  await expect(button).toHaveCSS("border-top-color", "rgb(10, 20, 30)");
  await expect(button).toHaveCSS("border-top-left-radius", "9px");
  await expect(button).toHaveCSS("background-color", "rgb(200, 210, 220)");
  await expect(button).toHaveCSS("color", "rgb(40, 50, 60)");
  await expect(button).toHaveCSS("font-size", "15px");
}

for (const [name, css] of Object.entries(HOST)) {
  test(`React children keep their own styles: ${name}`, async ({ page }) => {
    await page.goto("/?capture&slot&value=%233E5CEB");
    const button = page.getByTestId("slot-button");
    await button.waitFor();
    await addCss(page, css);
    await expect(button.locator("xpath=..")).toHaveAttribute("data-part", "slot");
    await expectOwnLook(button);
    // Colorshot's own buttons still get Colorshot's reset
    await expect(page.locator('[data-part="swatch-tabs"] button').first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });
}

async function expectColorshotLook(button: Locator) {
  // the picker's own control height and radius (smaller at size="sm"), and its normal text weight
  const [control, radius, weight] = await button.evaluate((el) => {
    const root = getComputedStyle(el.closest("[data-colorshot]")!);
    return [root.getPropertyValue("--cs-control").trim(), root.getPropertyValue("--cs-radius-control").trim(), root.fontWeight];
  });
  await expect(button).toHaveCSS("height", control);
  await expect(button).toHaveCSS("border-top-left-radius", radius);
  await expect(button).toHaveCSS("font-weight", weight);
  await expect(button).toHaveCSS("border-top-width", "0px");
  await expect(button).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(button).toHaveCSS("box-shadow", /inset/);
}

test("a plain React button in the slot looks like Colorshot's controls", async ({ page }) => {
  await page.goto("/?capture&slot=plain&value=%233E5CEB");
  const button = page.getByTestId("slot-button");
  await button.waitFor();
  await expectColorshotLook(button);
  // same width as the panel content
  const [box, inputs] = await Promise.all([button.boundingBox(), page.locator('[data-part="inputs"]').boundingBox()]);
  expect(box!.width).toBeCloseTo(inputs!.width, 0);
});

test("Vue default slot: a plain button looks like Colorshot, a class hands it to the app", async ({ page }) => {
  await page.goto("/");
  const button = page.getByTestId("vue-slot-button");
  await button.waitFor();
  await expect(button.locator("xpath=..")).toHaveAttribute("data-part", "slot");
  await expectColorshotLook(button);
  await addCss(page, HOST["Tailwind-style utilities in @layer utilities"]);
  await button.evaluate((el) => el.classList.add("host-btn"));
  await expectOwnLook(button);
});

test("the slot does not change the layout: children sit in the picker column, after the swatches", async ({ page }) => {
  await page.goto("/?capture&slot&value=%233E5CEB");
  const button = page.getByTestId("slot-button");
  await button.waitFor();
  const [root, swatches, box] = await Promise.all([
    page.locator("[data-colorshot]").boundingBox(),
    page.locator('[data-colorshot] [data-part="swatches"]').boundingBox(),
    button.boundingBox(),
  ]);
  expect(box!.y).toBeGreaterThan(swatches!.y + swatches!.height);
  expect(box!.y + box!.height).toBeLessThanOrEqual(root!.y + root!.height);
  await expect(page.locator('[data-part="slot"]')).toHaveCSS("display", "contents");
});

test("keyboard focus on a child uses the app's focus style, not Colorshot's ring", async ({ page, browserName }) => {
  // Safari only tabs to buttons with Option held, unless "keyboard navigation" is on in macOS settings
  const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
  await page.goto("/?capture&slot&value=%233E5CEB");
  const button = page.getByTestId("slot-button");
  await button.waitFor();
  await addCss(page, ".host-btn:focus-visible { outline: 3px dashed rgb(1, 2, 3); }");
  await button.focus();
  await page.keyboard.press(`Shift+${tab}`);
  await page.keyboard.press(tab);
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS("outline-style", "dashed");
  await expect(button).toHaveCSS("outline-color", "rgb(1, 2, 3)");
});
