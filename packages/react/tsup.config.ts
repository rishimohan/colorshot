import { defineConfig } from "tsup";
import { cleanMaps, terserOptions } from "../../scripts/terser.mjs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: "terser",
  terserOptions,
  onSuccess: async () => cleanMaps(),
  sourcemap: true,
  external: ["react", "react-dom", "@colorshot/core"],
  // components use hooks: mark the bundle as client code for React Server Components (Next.js app router)
  banner: { js: '"use client";' },
  esbuildOptions(options) {
    // no /* @__PURE__ */ on every JSX call: terser keeps annotations (for the top-level ones that matter
    // to tree-shaking), and hundreds of them inside components only add bytes
    options.jsxSideEffects = true;
  },
});
