import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@orshot/colorshot/styles.css";
import "./app.css";
import { App } from "./app";
import { Harness } from "./harness";
import { Capture } from "./capture";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {location.search.includes("capture") ? <Capture /> : location.search.includes("harness") ? <Harness /> : <App />}
  </StrictMode>,
);

// Vue package demo, mounted in its own section below the React app (not in the e2e harness)
import { mountVueDemo } from "./vue-demo";
if (!location.search.includes("harness") && !location.search.includes("capture")) mountVueDemo();
