# @orshot/colorshot

![Colorshot, a color and gradient picker for React and Vue](https://raw.githubusercontent.com/rishimohan/colorshot/main/.github/assets/cover.png)

Color and gradient picker for React and Vue, by [Orshot](https://orshot.com). Solid, linear, radial and conic gradients, every CSS color format including OKLCH and Display P3, swatches, eyedropper, WCAG contrast and a popover field. Accessible (keyboard, screen readers, high contrast, RTL), themeable with CSS variables, and it only reads and writes plain CSS strings.

```bash
npm i @orshot/colorshot
```

## React

```tsx
import { useState } from "react";
import { ColorPicker, ColorField } from "@orshot/colorshot/react";
import "@orshot/colorshot/styles.css";

export function Fill() {
  const [value, setValue] = useState("linear-gradient(135deg, #3E5CEB, #22C55E)");
  return (
    <>
      <ColorPicker
        value={value}
        onChange={setValue} // while dragging, once per frame
        onChangeComplete={save} // once per gesture
        swatches={[{ id: "brand", label: "Brand", colors: ["#0F172A", "#3E5CEB"] }]}
      />
      {/* or as a field that opens the picker in a popover */}
      <ColorField label="Fill" value={value} onChange={setValue} />
    </>
  );
}
```

React 18 and 19. The React entry is marked `"use client"` for the Next.js app router: use the components from client components, and import helpers from `@orshot/colorshot` in server code.

## Vue

```vue
<script setup lang="ts">
import { ref } from "vue";
import { ColorPicker, ColorField } from "@orshot/colorshot/vue";
import "@orshot/colorshot/styles.css";

const fill = ref("linear-gradient(135deg, #3E5CEB, #22C55E)");
</script>

<template>
  <ColorPicker v-model="fill" @change-complete="save" />
  <ColorField v-model="fill" label="Fill" />
</template>
```

Vue 3.5+. Same features, markup and styles as the React components.

## Helpers, any framework or server

```ts
import { parseColor, formatColor, contrastRatio, isSafeCssValue } from "@orshot/colorshot";

formatColor(parseColor("#3366ff")!.color, "oklch"); // "oklch(0.5726 0.2338 265.28)"
contrastRatio("#64748b", "#ffffff"); // 4.758...
isSafeCssValue(storedValue); // validate stored values before writing them into HTML or CSS
```

## Common setups

| Use case | Props |
| --- | --- |
| Linear gradient only | `modes={["linear"]}` |
| Radial or conic only | `modes={["radial"]}`, `modes={["conic"]}` |
| Gradients, no solid | `modes={["linear", "radial", "conic"]} gradientPresets` |
| Solid, no transparency | `modes={["solid"]} alpha={false}` |
| Text color with WCAG check | `modes={["solid"]} alpha={false} contrastWith="#FFFFFF"` |
| OKLCH editing | `space="oklch" outputFormat="oklch"` |
| Undo and before / after | `history compare` |
| Compact inspector panel | `size="sm"` |

Live examples of each: https://orshot.com/open-source/colorshot#linear

## Only what you import

- `@orshot/colorshot/react` and `@orshot/colorshot/vue` are separate entries: a React app never bundles the Vue code.
- React and Vue are optional peer dependencies.
- `sideEffects` is limited to the stylesheet, so unused parts tree-shake away.

## Using with AI

Teach your coding agent (Claude Code, Codex, Cursor, GitHub Copilot and others) how to add and configure the picker:

```sh
npx skills add rishimohan/colorshot
```

The package also ships `llms.txt`, a compact API reference for LLMs.

Docs, live examples and the full API: https://orshot.com/open-source/colorshot

---

Brought to you by [Orshot](https://orshot.com). MIT License, see `LICENSE` and `THIRD-PARTY-NOTICES.md`.
