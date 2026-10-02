// Fails when a built file grows past its gzip budget. Run after `pnpm build`.
// Budgets track what an app actually downloads: the framework package plus core.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const gz = (file) => {
  try {
    return gzipSync(readFileSync(file)).length;
  } catch {
    return null;
  }
};

const files = {
  core: "packages/colorshot/dist/index.js",
  react: "packages/colorshot/dist/react.js",
  vue: "packages/colorshot/dist/vue.js",
  styles: "packages/colorshot/styles.css",
};

const budgets = [
  ["@orshot/colorshot", [files.core], 13_700],
  ["@orshot/colorshot/react", [files.react], 24_300],
  ["@orshot/colorshot/vue", [files.vue], 24_700],
  ["@orshot/colorshot/styles.css", [files.styles], 7_925],
  ["React app total (react + core + styles)", [files.react, files.core, files.styles], 45_900],
  ["Vue app total (vue + core + styles)", [files.vue, files.core, files.styles], 46_300],
];

let failed = false;
for (const [name, parts, budget] of budgets) {
  const sizes = parts.map(gz);
  if (sizes.some((s) => s === null)) {
    console.log(`skip  ${name} (not built)`);
    continue;
  }
  const size = sizes.reduce((a, b) => a + b, 0);
  const ok = size <= budget;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}  ${(size / 1024).toFixed(1)} KB gzip (budget ${(budget / 1024).toFixed(1)} KB)`);
}
process.exit(failed ? 1 : 0);
