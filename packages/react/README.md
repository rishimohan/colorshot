# @colorshot/react

Color and gradient picker for React. Solid, linear, radial and conic gradients, every CSS color format including OKLCH and Display P3, swatches, eyedropper, and a popover field. Accessible, keyboard and trackpad friendly, themeable with CSS variables.

```bash
npm i @colorshot/react
```

```tsx
import { useState } from "react";
import { ColorPicker, ColorField } from "@colorshot/react";
import "@colorshot/react/styles.css";

export function Fill() {
  const [value, setValue] = useState("linear-gradient(135deg, #3E5CEB, #22C55E)");
  return (
    <ColorPicker
      value={value}
      onChange={setValue} // while dragging, once per frame
      onChangeComplete={saveToHistory} // once per gesture
      swatches={[{ id: "brand", label: "Brand", colors: ["#0F172A", "#3E5CEB"] }]}
    />
  );
}

// or as a field with a popover
<ColorField label="Fill" value={value} onChange={setValue} />;
```

- Takes any CSS color or gradient string and gives one back, in the format it came in (or `outputFormat`).
- Build your own layout from parts: `Picker.Root`, `Picker.Area`, `Picker.Hue`, `Picker.Alpha`, `Picker.GradientEditor`, `Picker.Inputs`, `Picker.Swatches`...
- Optional: `space="oklch"`, `history`, `swatchSearch`, `gradientPresets`, `contrastWith`, `compare`, `size="sm"`, `variant="inset"`.
- React 18 and 19. The bundle is marked `"use client"` for the Next.js app router: use the components from client components, and import helpers such as `parseColor` from `@colorshot/core` in server code.

Docs and live examples: https://colorshot.orshot.com · MIT · by [Orshot](https://orshot.com)
