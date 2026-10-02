// Concatenate src/parts/*.css in the order src/index.css imports them into dist/styles.css, as one
// `@layer colorshot` block.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const entry = readFileSync("src/index.css", "utf8");
const files = [...entry.matchAll(/@import "\.\/(parts\/[^"]+)";/g)].map((m) => m[1]);
// every part file is a single `@layer colorshot { ... }`; join their bodies in import order
const bodies = files.map((f) => {
  const m = readFileSync(`src/${f}`, "utf8").match(/^\s*@layer colorshot \{([\s\S]*)\}\s*$/);
  if (!m) throw new Error(`${f} must be a single @layer colorshot { ... } block`);
  return m[1];
});
const css = `@layer colorshot {\n${bodies.join("\n")}\n}`;
mkdirSync("dist", { recursive: true });
// light minification: comments and whitespace only, the rules stay exactly as written. (A full CSS minifier
// such as lightningcss rewrites values: it turns rgb(0 0 0 / 0.14) into #00000024, which rounds the alpha.)
const min = css
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{};,>])\s*/g, "$1")
  // a colon is never followed by meaningful whitespace: `prop: value`, `(prefers-color-scheme: dark)`
  .replace(/: /g, ":")
  .replace(/;}/g, "}")
  .trim();
writeFileSync("dist/styles.css", `/* Colorshot styles. Source: https://github.com/rishimohan/colorshot/tree/main/packages/styles/src */\n${min}\n`);
console.log(`dist/styles.css: ${files.length} files, ${min.length} bytes`);
