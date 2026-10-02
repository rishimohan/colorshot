import { expect, test, type Page } from "@playwright/test";
import { nextFrame, noTransitions, openHarness, picker } from "./helpers";

const AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";

interface AxeViolation {
  id: string;
  impact: string;
  help: string;
  nodes: { target: string[]; failureSummary: string }[];
}

/** Run axe on the pickers only (the harness page itself is not under test). */
async function axe(page: Page, skipRules: string[] = []): Promise<AxeViolation[]> {
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ url: AXE });
  return page.evaluate(async (skipRules) => {
    const include = [
      // the every-format pickers are a layout fixture whose extreme color parks thumbs on the area edge
      ["[data-testid^='picker-']:not([data-testid^='picker-formats'])"],
      ["[data-colorshot-field]"],
      ...(document.querySelector("[data-colorshot-popover]") ? [["[data-colorshot-popover]"]] : []),
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (window as any).axe.run(
      { include },
      {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
        resultTypes: ["violations"],
        rules: Object.fromEntries(skipRules.map((r: string) => [r, { enabled: false }])),
      },
    );
    return result.violations.map((v: AxeViolation) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target, failureSummary: n.failureSummary })),
    }));
  }, skipRules);
}

function report(label: string, violations: AxeViolation[]) {
  for (const v of violations) {
    console.log(`[axe ${label}] ${v.id} (${v.impact}): ${v.help}`);
    for (const n of v.nodes.slice(0, 5)) console.log(`    ${n.target.join(" ")} :: ${n.failureSummary.replace(/\n/g, " | ")}`);
  }
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe (${scheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await openHarness(page);
      await noTransitions(page);
    });

    test("pickers at rest", async ({ page }) => {
      const v = await axe(page);
      report(`${scheme} rest`, v);
      expect(v).toEqual([]);
    });

    test("gradient mode", async ({ page }) => {
      await picker(page, "full").getByRole("radio", { name: "Linear" }).click();
      await nextFrame(page);
      const v = await axe(page);
      report(`${scheme} gradient`, v);
      expect(v).toEqual([]);
    });

    test("open ColorField", async ({ page }) => {
      await page.getByRole("button", { name: /^Fill:/ }).click();
      await expect(page.getByRole("dialog", { name: "Fill" })).toBeVisible();
      await nextFrame(page);
      const v = await axe(page);
      report(`${scheme} field`, v);
      expect(v).toEqual([]);
    });

    test("open format menu", async ({ page }) => {
      await picker(page, "full").getByRole("combobox", { name: "Color format" }).click();
      await expect(picker(page, "full").getByRole("listbox")).toBeVisible();
      // the open menu covers part of the next harness cell; target-size would flag that cell, not the menu
      const v = await axe(page, ["target-size"]);
      report(`${scheme} menu`, v);
      expect(v).toEqual([]);
    });
  });
}
