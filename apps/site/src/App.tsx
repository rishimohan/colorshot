import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { ThemeProvider } from "./lib/theme";
import { DocsLayout, SiteLayout } from "./components/Layout";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { GettingStarted } from "./pages/GettingStarted";
import { ColorPickerPage } from "./pages/ColorPickerPage";
import { ColorFieldPage } from "./pages/ColorFieldPage";
import { PartsPage } from "./pages/PartsPage";
import { SwatchesPage } from "./pages/SwatchesPage";
import { GradientsPage } from "./pages/GradientsPage";
import { FormatsPage } from "./pages/FormatsPage";
import { ThemingPage } from "./pages/ThemingPage";
import { AccessibilityPage } from "./pages/AccessibilityPage";
import { CorePage } from "./pages/CorePage";
import { VuePage } from "./pages/VuePage";
import type { ComponentType } from "react";

const PAGES: Record<string, ComponentType> = {
  "getting-started": GettingStarted,
  "color-picker": ColorPickerPage,
  "color-field": ColorFieldPage,
  parts: PartsPage,
  swatches: SwatchesPage,
  gradients: GradientsPage,
  formats: FormatsPage,
  theming: ThemingPage,
  accessibility: AccessibilityPage,
  core: CorePage,
  vue: VuePage,
};

function DocPage() {
  const { slug = "" } = useParams();
  const Page = PAGES[slug];
  // key: a fresh page (and fresh pickers) on every route
  return Page ? <Page key={slug} /> : <NotFound inline />;
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="docs" element={<DocsLayout />}>
            <Route index element={<Navigate to="/docs/getting-started" replace />} />
            <Route path=":slug" element={<DocPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
