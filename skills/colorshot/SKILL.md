---
name: colorshot
description: Use when adding a color picker, gradient picker or color input to a React, Next.js, Vue or shadcn/ui app, or when replacing an existing picker (react-colorful, react-color, a native <input type="color">) with Colorshot (@orshot/colorshot). Covers solid colors, linear, radial and conic gradients, swatch groups, popover fields, output formats, theming and on-canvas gradient handles.
license: MIT
metadata:
  author: Orshot
  version: "0.1.0"
  homepage: https://orshot.com/open-source/colorshot
  source: https://github.com/rishimohan/colorshot
---

# Colorshot

Colorshot (`@orshot/colorshot`) is a color and gradient picker for React and Vue with a framework-free core. Values in and out are plain CSS strings: any CSS color, or a linear, radial, conic or repeating gradient. It never throws on input it cannot read; it shows it as unsupported and leaves it unchanged.

Full reference with live examples: https://orshot.com/open-source/colorshot. Compact reference for agents: https://github.com/rishimohan/colorshot/blob/main/llms.txt

## Workflow

1. Detect the framework (React, Next.js app router, Vue 3) and the package manager from the lockfile.
2. Install: `npm i @orshot/colorshot` (or the pnpm / yarn / bun equivalent).
3. Import the stylesheet once in the root layout or entry file: `import "@orshot/colorshot/styles.css";`
4. Find existing color inputs and pickers. List them for the user and replace only the ones they confirm.
5. Keep the stored value format the app already uses (see "Output format"). Do not migrate stored data.
6. Run the project's typecheck and tests.

## React

```tsx
"use client"; // required in the Next.js app router

import { useState } from "react";
import { ColorPicker } from "@orshot/colorshot/react";

export function FillPicker({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [fill, setFill] = useState(initial);
  return (
    <ColorPicker
      value={fill}
      onChange={setFill} // every frame while dragging: update UI only
      onChangeComplete={onSave} // once per change: save, record undo, send requests here
    />
  );
}
```

A field that opens the picker in a popover. It takes every `ColorPicker` prop:

```tsx
import { ColorField } from "@orshot/colorshot/react";

<ColorField label="Fill" value={fill} onChange={setFill} onChangeComplete={onSave} />;
```

## Vue

```vue
<script setup lang="ts">
import { ref } from "vue";
import { ColorPicker, ColorField } from "@orshot/colorshot/vue";

const fill = ref("#3E5CEB");
</script>

<template>
  <ColorPicker v-model="fill" @change-complete="save" />
  <ColorField v-model="fill" label="Fill" />
</template>
```

## Match the field's constraints

- Solid colors only: `modes={["solid"]}`
- No transparency: `alpha={false}`
- Limit the format menu: `formats={["hex", "rgb", "hsl"]}`
- Compact panels: `size="sm"`
- Dark UI: `theme="dark"` (default follows the OS)
- Server-rendered pages, tests or privacy-sensitive apps: `storageKey={null}` keeps recent colors in memory instead of localStorage

## Output format

By default a picked color is written in the format of the incoming value. To force one, pass `outputFormat` a format name or a function:

```tsx
import { formatColor } from "@orshot/colorshot";

// uppercase hex when opaque, comma rgba() otherwise
const outputFormat = (color) =>
  color.alpha >= 1
    ? formatColor({ ...color, alpha: 1 }, "hex", { upper: true })
    : formatColor(color, "rgb", { legacy: true, fn: "rgba" });

<ColorPicker value={value} onChange={setValue} outputFormat={outputFormat} />;
```

Gradients keep their shape; only edited stops are rewritten.

## Swatches

```tsx
<ColorPicker
  value={value}
  onChange={setValue}
  swatchSearch
  gradientPresets
  swatches={[
    {
      id: "brand",
      label: "Brand",
      colors: [{ value: "#3E5CEB", label: "Tide" }, "#0A0A0A"],
      onAdd: (value) => saveBrandColor(value), // shows a + button
      onRemove: (swatch) => deleteBrandColor(swatch),
    },
    { id: "recent", label: "Recent", recent: true },
  ]}
/>
```

Groups also take `limit`, `showIn: "solid" | "gradient"`, `onReorder` and `onRename`.

## shadcn/ui

Put `ColorField` where a color `Input` was, or render `ColorPicker` inside the project's own `Popover`. Match the theme with CSS variables instead of overriding classes:

```css
/* globals.css. On shadcn/ui v3 (HSL channel tokens) wrap them: hsl(var(--primary)) */
[data-colorshot],
[data-colorshot-field] {
  --cs-accent: var(--primary);
  --cs-bg: var(--popover);
  --cs-fg: var(--popover-foreground);
  --cs-border: var(--border);
  --cs-radius: var(--radius);
}
```

Styles live in `@layer colorshot`, so unlayered app CSS (including Tailwind utilities) wins without `!important`.

## Custom layouts

```tsx
import { Picker } from "@orshot/colorshot/react";

<Picker.Root value={value} onChange={setValue} modes={["solid"]}>
  <Picker.Area />
  <Picker.Hue />
  <Picker.Inputs formats={["hex"]} alpha={false} />
</Picker.Root>;
```

Parts: `Area`, `Hue`, `Alpha`, `ModeTabs`, `GradientEditor`, `GradientBar`, `GradientControls`, `AngleDial`, `CenterPad`, `Inputs`, `EyeDropper`, `Swatches`, `Preview`, `Contrast`, `CurrentSwatch`, `Notice`.

## Helpers without a UI

Import from `@orshot/colorshot` (safe in server code):

- `parseColor(text)` returns `{ color }` or `null`; `formatColor(color, "hex" | "rgb" | "hsl" | "oklch" | ...)`
- `isGradient`, `parseGradient`, `serializeGradient`
- `contrastRatio(a, b)`, `contrastLevel`, `luminance`
- `isSafeCssValue(value)` / `safeCssValue(value)` before writing stored values into HTML or CSS
- `gradientHandles(value, width, height)` and `moveGradientHandle(value, id, x, y, width, height, { snap })` to drag gradient handles on your own canvas

## Do not

- Do not save in `onChange`; it fires every frame while dragging.
- Do not render the picker from a React Server Component.
- Do not import the stylesheet in every component; once at the root is enough.
- Do not convert the app's stored colors to a new format unless the user asks.
