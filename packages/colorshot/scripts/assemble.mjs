// Assemble the published package from the built source packages (run `pnpm build` at the repo root first):
//   dist/index.*  <- @colorshot/core   (the "." entry)
//   dist/react.*  <- @colorshot/react  ("./react")
//   dist/vue.*    <- @colorshot/vue    ("./vue")
//   styles.css    <- @colorshot/styles ("./styles.css")
// The React and Vue builds import core as "@colorshot/core"; here that becomes "@orshot/colorshot", the
// package importing its own main entry, so an app always gets exactly one copy of core.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const from = (pkg, file) => new URL(`../../${pkg}/${file}`, import.meta.url);
const to = (file) => new URL(`../${file}`, import.meta.url);

rmSync(to("dist"), { recursive: true, force: true });
mkdirSync(to("dist"));

const OUTPUTS = [
  ["index.js", "js"],
  ["index.cjs", "js"],
  ["index.d.ts", "dts"],
  ["index.d.cts", "dts"],
  ["index.js.map", "map"],
  ["index.cjs.map", "map"],
];

for (const [pkg, name] of [["core", "index"], ["react", "react"], ["vue", "vue"]]) {
  for (const [file, kind] of OUTPUTS) {
    const src = from(pkg, `dist/${file}`);
    if (!existsSync(src)) throw new Error(`missing packages/${pkg}/dist/${file}: run pnpm build at the repo root first`);
    const target = file.replace(/^index/, name);
    let text = readFileSync(src, "utf8");
    if (kind !== "map") text = text.replace(/(["'])@colorshot\/core\1/g, "$1@orshot/colorshot$1");
    if (kind === "js") text = text.replace(/\/\/# sourceMappingURL=index\./, `//# sourceMappingURL=${name}.`);
    if (kind === "map") {
      // sources are embedded (sourcesContent); keep their paths readable from the new location
      const map = JSON.parse(text);
      map.file = map.file?.replace(/^index/, name);
      map.sources = map.sources.map((s) => s.replace(/^\.\.\/src\//, `../src/${pkg}/`));
      text = JSON.stringify(map);
    }
    if (kind !== "map" && text.includes("@colorshot/")) throw new Error(`${target} still references an internal @colorshot/* package`);
    writeFileSync(to(`dist/${target}`), text);
  }
}

copyFileSync(from("styles", "dist/styles.css"), to("styles.css"));
// lets `import "@orshot/colorshot/styles.css"` type-check without the app declaring *.css modules
writeFileSync(to("styles.css.d.cts"), "export {};\n");
console.log("@orshot/colorshot: dist/{index,react,vue}.{js,cjs,d.ts,d.cts} and styles.css");
