export interface NavItem {
  slug: string;
  title: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { title: "Start", items: [{ slug: "getting-started", title: "Getting started" }] },
  {
    title: "Components",
    items: [
      { slug: "color-picker", title: "ColorPicker" },
      { slug: "color-field", title: "ColorField" },
      { slug: "parts", title: "Parts and custom layouts" },
    ],
  },
  {
    title: "Features",
    items: [
      { slug: "swatches", title: "Swatches" },
      { slug: "gradients", title: "Gradients" },
      { slug: "formats", title: "Color formats and output" },
    ],
  },
  {
    title: "Styling and access",
    items: [
      { slug: "theming", title: "Theming" },
      { slug: "accessibility", title: "Accessibility and keyboard" },
    ],
  },
  {
    title: "More",
    items: [
      { slug: "core", title: "Core API" },
      { slug: "vue", title: "Vue" },
    ],
  },
];

export const FLAT_NAV: NavItem[] = NAV.flatMap((g) => g.items);

export const GITHUB_URL = "https://github.com/rishimohan/colorshot";
export const ORSHOT_URL = "https://orshot.com";
