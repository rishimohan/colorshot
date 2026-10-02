import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";
import type { Plugin } from "esbuild";
import { cleanMaps, terserOptions } from "../../scripts/terser.mjs";

// esbuild keeps one import statement per source module for each external package, each with its own
// aliases, which costs about 1 KB gzip here. Routing "vue", "vue/jsx-runtime" and "@colorshot/core" through
// one shim each leaves a single import per package in the bundle. Sources are unchanged.
/** Value names imported from `pkg` anywhere in src (type-only imports skipped). */
function importedNames(pkg: string): string[] {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) {
        for (const m of readFileSync(path, "utf8").matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
          if (m[2] !== pkg) continue;
          for (const part of m[1].split(",")) {
            const name = part.trim();
            if (name && !name.startsWith("type ")) names.add(name.split(/\s+as\s+/)[0]);
          }
        }
      }
    }
  };
  walk("src");
  return [...names];
}

// the same jsx() as vue/jsx-runtime
const JSX_RUNTIME = `
export function jsx(type, props, key) {
  const { children } = props;
  delete props.children;
  if (key !== undefined) props.key = key;
  return h(type, props, children);
}
export { jsx as jsxs };`;

const singleImports: Plugin = {
  name: "single-imports",
  setup(build) {
    build.onResolve({ filter: /^(vue|vue\/jsx-runtime|@colorshot\/core)$/ }, (args) => {
      if (args.namespace === "shim") return { path: args.path, external: true };
      // the entry's `export * from "@colorshot/core"` stays a plain re-export
      if (args.kind === "import-statement" && /src[/\\]index\.ts$/.test(args.importer) && args.path === "@colorshot/core") return { path: args.path, external: true };
      return { path: args.path === "vue/jsx-runtime" ? "vue" : args.path, namespace: "shim" };
    });
    build.onLoad({ filter: /.*/, namespace: "shim" }, (args) => {
      const names = importedNames(args.path);
      if (args.path !== "vue") return { loader: "js", contents: `export { ${names.join(", ")} } from "${args.path}";` };
      const imports = [...new Set(["h", "Fragment", ...names])];
      return { loader: "js", contents: `import { ${imports.join(", ")} } from "vue";\nexport { ${imports.join(", ")} };${JSX_RUNTIME}` };
    });
  },
};

// tsconfig keeps `jsx: preserve` for Vue's JSX types; the bundle compiles TSX with Vue's automatic runtime
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: "terser",
  terserOptions,
  onSuccess: async () => cleanMaps(),
  sourcemap: true,
  external: ["vue"],
  // let the plugin above see these imports; it marks them external itself
  noExternal: [/^vue(\/jsx-runtime)?$/, /^@colorshot\/core$/],
  esbuildPlugins: [singleImports],
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.jsxImportSource = "vue";
    // no /* @__PURE__ */ on every JSX call (see the React config)
    options.jsxSideEffects = true;
    // keep °, ⌫ and … as written instead of \u escapes
    options.charset = "utf8";
  },
});
