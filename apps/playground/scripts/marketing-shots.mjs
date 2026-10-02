// Clean picker images for the README and marketing: one picker, transparent background, shadow kept, 3x.
// Needs the playground running (pnpm dev). Usage: node scripts/marketing-shots.mjs <outDir>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "marketing-shots";
mkdirSync(out, { recursive: true });

const LINEAR = "linear-gradient(135deg, #3E5CEB 0%, #A855F7 52%, #F97316 100%)";
const RADIAL = "radial-gradient(circle at 30% 30%, #FDE68A 0%, #F97316 45%, #BE123C 100%)";
const CONIC = "conic-gradient(from 0deg at 50% 50%, #EF4444, #F59E0B, #22C55E, #3B82F6, #A855F7, #EF4444)";

const SHOTS = [
  { name: "solid-light", value: "#3E5CEB" },
  { name: "solid-dark", value: "#3E5CEB", theme: "dark" },
  { name: "linear-light", value: LINEAR },
  { name: "linear-dark", value: LINEAR, theme: "dark" },
  { name: "radial-light", value: RADIAL },
  { name: "conic-light", value: CONIC },
  { name: "conic-dark", value: CONIC, theme: "dark" },
  { name: "compact-light", value: LINEAR, size: "sm" },
  { name: "inset-light", value: "#A855F7", variant: "inset" },
];

const browser = await chromium.launch();
for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 520, height: 900 }, deviceScaleFactor: 3, colorScheme: s.theme ?? "light" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const q = new URLSearchParams({ capture: "", value: s.value, theme: s.theme ?? "light" });
  if (s.size) q.set("size", s.size);
  if (s.variant) q.set("variant", s.variant);
  await page.goto(`http://localhost:5190/?${q}`);
  await page.addStyleTag({ content: "html,body{background:transparent!important}" });
  const box = page.locator("[data-capture]");
  await box.waitFor();
  await page.waitForTimeout(500); // settle: no open transitions in the shot
  await box.screenshot({ path: `${out}/${s.name}.png`, omitBackground: true });
  if (errors.length) console.log(s.name, "ERRORS", errors);
  console.log("saved", s.name);
  await page.close();
}
await browser.close();
