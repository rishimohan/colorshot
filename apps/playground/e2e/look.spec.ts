import { expect, test } from "@playwright/test";
import { openHarness, part, picker } from "./helpers";

test.beforeEach(async ({ page }) => openHarness(page));

test("switching modes morphs the header swatch, then the morph layer goes away", async ({ page }) => {
  const root = picker(page, "full");
  await root.getByRole("radio", { name: "Linear" }).click();
  await expect(part(root, "current-morph")).toHaveCount(1);
  await expect(part(root, "current-morph")).toHaveCount(0, { timeout: 2000 });
  // the swatch ends on the new value
  const swatch = await part(root, "current-value").evaluate((el) => el.style.getPropertyValue("--_cs-swatch"));
  expect(swatch).toMatch(/^linear-gradient/);
});

test("variant: bleed puts the area first and edge to edge; inset puts the tabs first and frames it", async ({ page }) => {
  const root = picker(page, "full");
  await expect(root).toHaveAttribute("data-variant", "bleed");
  const first = await root.evaluate((el) => (el.firstElementChild as HTMLElement).dataset.part);
  expect(first).toBe("area");
  const [rootBox, areaBox] = await Promise.all([root.boundingBox(), part(root, "area").boundingBox()]);
  expect(Math.round(areaBox!.x - rootBox!.x)).toBe(0); // over the 1px border, flush with the panel edge
  const inset = page.getByTestId("picker-inset");
  await expect(inset).toHaveAttribute("data-variant", "inset");
  expect(await inset.evaluate((el) => (el.firstElementChild as HTMLElement).dataset.part)).toBe("header");
  const [iBox, iArea] = await Promise.all([inset.boundingBox(), part(inset, "area").boundingBox()]);
  expect(Math.round(iArea!.x - iBox!.x)).toBe(13); // 1px border + 12px padding
});
