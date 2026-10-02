import { defineConfig, transformWithOxc, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// @colorshot/vue is written in TSX for Vue's JSX runtime; compile it before the React plugin sees it
const VUE_TSX = /packages\/vue\/src\/.*\.tsx$/;
const vueTsx = (): Plugin => ({
  name: "colorshot-vue-tsx",
  enforce: "pre",
  transform(code, id) {
    if (!VUE_TSX.test(id)) return;
    return transformWithOxc(code, id, { lang: "tsx", jsx: { runtime: "automatic", importSource: "vue" } });
  },
});

// Point at package sources so edits hot-reload without a build step
export default defineConfig({
  plugins: [vueTsx(), react({ exclude: [/node_modules/, /packages\/vue\//] }), vue()],
  resolve: {
    alias: {
      "@orshot/colorshot/styles.css": src("styles/src/index.css"),
      "@orshot/colorshot/react": src("react/src/index.ts"),
      "@orshot/colorshot/vue": src("vue/src/index.ts"),
      "@orshot/colorshot": src("core/src/index.ts"),
    },
  },
});
