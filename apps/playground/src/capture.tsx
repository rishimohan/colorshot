// Clean picker shots for the README and marketing images: one picker, real-looking swatch groups, nothing else.
// /?capture&value=<css>&theme=light|dark&size=sm&variant=inset&field
// scripts/marketing-shots.mjs drives it.
import { useState } from "react";
import { ColorField, ColorPicker } from "@orshot/colorshot/react";

const params = new URLSearchParams(location.search);
const theme: "light" | "dark" = params.get("theme") === "dark" ? "dark" : "light";

const SWATCHES = [
  {
    id: "brand",
    label: "Brand",
    colors: [
      { value: "#3E5CEB", label: "Tide" },
      { value: "#0A0A0A", label: "Ink" },
      { value: "#F5F5F4", label: "Paper" },
      { value: "#22C55E", label: "Mint" },
      { value: "#F97316", label: "Orange" },
      { value: "#A855F7", label: "Violet" },
      { value: "#EF4444", label: "Red" },
      { value: "#FACC15", label: "Sun" },
    ],
    onAdd: () => {},
  },
  { id: "recent", label: "Recent", colors: ["#14B8A6", "#6366F1", "#F43F5E", "#0EA5E9"] },
  { id: "presets", label: "Presets", colors: ["#000000", "#FFFFFF", "#737373", "#D4D4D4", "#1E293B", "#7C3AED", "#DB2777", "#059669"] },
];

export function Capture() {
  const [value, setValue] = useState(params.get("value") ?? "#3E5CEB");
  const common = {
    value,
    onChange: setValue,
    theme,
    swatches: SWATCHES,
    gradientPresets: true,
    swatchSearch: true,
    storageKey: null,
    size: params.get("size") === "sm" ? ("sm" as const) : undefined,
    variant: params.get("variant") === "inset" ? ("inset" as const) : undefined,
    style: { "--cs-accent": "#3e5ceb" } as React.CSSProperties,
  };
  document.body.style.background = "transparent";
  return (
    <div data-capture style={{ display: "inline-block", padding: 48 }}>
      {params.has("field") ? (
        <div style={{ width: 280 }}>
          <ColorField label="Fill" defaultOpen {...common} />
        </div>
      ) : (
        <ColorPicker {...common} />
      )}
    </div>
  );
}
