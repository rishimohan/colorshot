import { defineConfig } from "tsup";
import { LEGAL, cleanMaps, terserOptions } from "../../scripts/terser.mjs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: "terser",
  // PickerStore's private members are named `_x` (nothing outside this package reads them) and get short names
  terserOptions: { ...terserOptions, mangle: { ...terserOptions.mangle, properties: { regex: /^_/ } } },
  onSuccess: async () => cleanMaps(),
  sourcemap: true,
  banner: { js: LEGAL },
});
