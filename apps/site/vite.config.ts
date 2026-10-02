import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// Point at package sources so the site always documents the code in this repo
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@orshot/colorshot/styles.css": src("styles/src/index.css"),
      "@orshot/colorshot/react": src("react/src/index.ts"),
      "@orshot/colorshot/vue": src("vue/src/index.ts"),
      "@orshot/colorshot": src("core/src/index.ts"),
    },
  },
  server: { port: 5191 },
  preview: { port: 5191 },
});
