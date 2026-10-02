import { createApp, type App } from "vue";
import VueDemo from "./VueDemo.vue";

let app: App | null = null;

/** Mounts the @orshot/colorshot/vue demo below the React playground, sharing its stylesheet and theme. */
export function mountVueDemo() {
  app?.unmount();
  document.getElementById("vue-demo")?.remove();
  const host = document.createElement("div");
  host.id = "vue-demo";
  host.className = "page";
  document.body.appendChild(host);
  app = createApp(VueDemo);
  app.mount(host);
}
