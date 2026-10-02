import { expect, test, type Page } from "@playwright/test";
import { log, openHarness, part, picker } from "./helpers";

interface SavedSwatch {
  value: string;
  id?: string;
  label?: string;
}

const full = (page: Page) => picker(page, "full");
const tabs = (page: Page) => part(full(page), "swatch-tabs");
const tab = (page: Page, name: string) => tabs(page).getByRole("tab", { name });
const grid = (page: Page) => part(full(page), "swatch-grid");
const swatch = (page: Page, name: string) => grid(page).getByRole("button", { name, exact: true });
const saved = (page: Page) => page.evaluate(() => (window as unknown as { __saved: SavedSwatch[] }).__saved);

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

test("tabs switch with click and arrow keys", async ({ page }) => {
  // Recent is hidden until something was committed; Gradients only shows in gradient modes
  await expect(tabs(page).getByRole("tab")).toHaveText(["Brand", "Saved", "Presets"]);
  await expect(tab(page, "Brand")).toHaveAttribute("aria-selected", "true");
  await tab(page, "Saved").click();
  await expect(tab(page, "Saved")).toHaveAttribute("aria-selected", "true");
  await expect(swatch(page, "Rose")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "Presets")).toHaveAttribute("aria-selected", "true");
  await expect(tab(page, "Presets")).toBeFocused();
  await page.keyboard.press("ArrowRight"); // wraps
  await expect(tab(page, "Brand")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tab(page, "Presets")).toHaveAttribute("aria-selected", "true");
  // roving tabindex: only the active tab is in the tab order
  await expect(tabs(page).locator('[tabindex="0"]')).toHaveCount(1);
});

test("arrow keys move between swatches in the grid", async ({ page }) => {
  await swatch(page, "Ink").focus();
  await page.keyboard.press("ArrowRight");
  await expect(swatch(page, "Blue")).toBeFocused();
  await page.keyboard.press("End");
  await expect(swatch(page, "Amber")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(swatch(page, "Ink")).toBeFocused();
});

test("search filters across groups by hex prefix", async ({ page }) => {
  const search = full(page).getByRole("searchbox", { name: "Search colors" });
  // the search box is either always shown or behind a search button
  if (!(await search.isVisible())) await full(page).getByRole("button", { name: "Search colors" }).click();
  await search.fill("#f59");
  // search lists every matching group, without tabs
  await expect(tabs(page)).toHaveCount(0);
  const brand = full(page).locator('[data-part="swatch-group"][data-group="brand"] [data-part="swatch"]');
  const presets = full(page).locator('[data-part="swatch-group"][data-group="presets"] [data-part="swatch"]');
  await expect(brand).toHaveCount(1);
  await expect(brand).toHaveAttribute("aria-label", "Amber");
  await expect(presets).toHaveCount(1);
  await expect(presets).toHaveAttribute("aria-label", "#f59e0b");
  await expect(full(page).locator('[data-group="saved"]')).toHaveCount(0);

  await search.fill("e11");
  await expect(part(full(page), "swatch")).toHaveCount(1);
  await expect(part(full(page), "swatch")).toHaveAttribute("aria-label", "Rose");

  await search.fill("nothing-matches");
  await expect(part(full(page), "swatch")).toHaveCount(0);
  await expect(part(full(page), "swatch-empty")).toBeVisible();

  // Escape clears the query and brings the tabs back
  await search.press("Escape");
  await expect(tabs(page)).toBeVisible();
  await expect(tab(page, "Brand")).toHaveAttribute("aria-selected", "true");
  await expect(part(grid(page), "swatch")).toHaveCount(4);
});

test("clicking a swatch applies it", async ({ page }) => {
  await swatch(page, "Green").click();
  const l = await log(page, "full");
  expect(l.value).toBe("#22c55e");
  expect(l.completes).toEqual(["#22c55e"]);
  await expect(swatch(page, "Green")).toHaveAttribute("aria-pressed", "true");
  await expect(full(page).getByLabel("Hex color")).toHaveValue("22C55E");
  // the committed color shows up in Recent
  await expect(tab(page, "Recent")).toBeVisible();
});

test("saved group: + adds the current value, remove button and Delete remove", async ({ page }) => {
  await tab(page, "Saved").click();
  await part(grid(page), "swatch-add").click();
  await expect.poll(async () => (await saved(page)).map((s) => s.value)).toEqual(["#e11d48", "#0ea5e9", "#a3e635", "#3366cc"]);
  await expect(part(grid(page), "swatch")).toHaveCount(4);

  const sky = part(grid(page), "swatch-cell").filter({ has: page.getByRole("button", { name: "Sky", exact: true }) });
  await sky.hover();
  await sky.getByRole("button", { name: "Remove Sky" }).click();
  await expect.poll(async () => (await saved(page)).map((s) => s.id)).not.toContain("s2");

  await swatch(page, "Lime").focus();
  await page.keyboard.press("Delete");
  await expect.poll(async () => (await saved(page)).map((s) => s.label)).toEqual(["Rose", undefined]);
  await expect(part(grid(page), "swatch")).toHaveCount(2);
});

test("double-click renames a saved swatch", async ({ page }) => {
  await tab(page, "Saved").click();
  await swatch(page, "Rose").dblclick();
  const input = part(full(page), "swatch-rename-input");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Rose");
  await input.fill("Coral");
  await input.press("Enter");
  await expect(input).toHaveCount(0);
  await expect(swatch(page, "Coral")).toBeVisible();
  expect((await saved(page))[0]).toMatchObject({ id: "s1", label: "Coral", value: "#e11d48" });

  // F2 also renames; Escape cancels
  await swatch(page, "Sky").focus();
  await page.keyboard.press("F2");
  await expect(input).toBeFocused();
  await input.fill("Ocean");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  expect((await saved(page))[1].label).toBe("Sky");
});

test("drag reorders saved swatches", async ({ page }) => {
  await tab(page, "Saved").click();
  const target = part(grid(page), "swatch-cell").filter({ has: page.getByRole("button", { name: "Lime", exact: true }) });
  await page.dragAndDrop(`[data-testid="picker-full"] [data-part="swatch"][aria-label="Rose"]`, `[data-testid="picker-full"] [data-part="swatch"][aria-label="Lime"]`);
  await expect.poll(async () => (await saved(page)).map((s) => s.label)).toEqual(["Sky", "Rose", "Lime"]);
  await expect(target).not.toHaveAttribute("data-drop");
  await expect(part(grid(page), "swatch")).toHaveCount(3);
});

test("a controlled host's inline callbacks are always the latest ones", async ({ page }) => {
  const root = picker(page, "controlled");
  const brand = part(root, "swatch-grid").first();
  const savedGrid = root.locator('[data-group="saved"] [data-part="swatch-grid"]');
  // the host's onAdd closes over its list as it was on that render: an old copy would drop the first color
  await brand.getByRole("button", { name: "Blue", exact: true }).click();
  await part(savedGrid, "swatch-add").click();
  await brand.getByRole("button", { name: "Green", exact: true }).click();
  await part(savedGrid, "swatch-add").click();
  await expect(part(savedGrid, "swatch")).toHaveCount(2);
  const values = await part(savedGrid, "swatch").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  expect(values.map((v) => v?.toLowerCase())).toEqual(["#3e5ceb", "#22c55e"]);
});
