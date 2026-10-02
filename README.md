![Colorshot, a color and gradient picker for React and Vue](.github/assets/cover.png)

<div align="center"><strong>Colorshot</strong></div>
<div align="center">Color and gradient picker for React and Vue.<br />Solid colors, linear, radial and conic gradients, swatch groups, one package.</div>
<br />
<div align="center">
<a href="https://orshot.com/open-source/colorshot">Docs and live demos</a>
<span> · </span>
<a href="https://www.npmjs.com/package/@orshot/colorshot">npm</a>
<span> · </span>
<a href="llms.txt">llms.txt</a>
</div>

## Introduction

Colorshot is the color picker inside [Orshot Studio](https://orshot.com), open sourced. It takes any CSS color or gradient string and gives one back, so it fits whatever your app already stores. It never throws on input it cannot read, and the parts of a value you did not edit come back exactly as written.

- Solid colors with hue, saturation, alpha, eyedropper and hex / rgb / hsl / oklch input
- Linear, radial, conic and repeating gradients with draggable stops, an angle dial and a center pad
- Paste any CSS color or gradient with Cmd/Ctrl+V, copy with Cmd/Ctrl+C
- Your own swatch groups: brand, saved, recent, with search, add, remove, reorder and rename
- A ready-made `ColorPicker`, a `ColorField` that opens it in a popover, or headless parts to build your own layout
- Keyboard, screen reader, touch and two-finger trackpad support
- React and Vue from one framework-free core, themed with CSS variables

## Install

```sh
npm i @orshot/colorshot
```

## Getting started

```tsx
"use client";

import { useState } from "react";
import { ColorPicker } from "@orshot/colorshot/react";
import "@orshot/colorshot/styles.css";

export function FillPicker() {
  const [fill, setFill] = useState("linear-gradient(135deg, #3E5CEB 0%, #22C55E 100%)");

  return (
    <ColorPicker
      value={fill}
      onChange={setFill} // every frame while dragging
      onChangeComplete={(value) => save(value)} // once, when the change is done
    />
  );
}
```

Vue:

```vue
<script setup>
import { ref } from "vue";
import { ColorPicker } from "@orshot/colorshot/vue";
import "@orshot/colorshot/styles.css";

const fill = ref("#3E5CEB");
</script>

<template>
  <ColorPicker v-model="fill" @change-complete="save" />
</template>
```

## Examples

Live versions of every example: https://orshot.com/open-source/colorshot#linear

### Linear, radial or conic gradient only

One mode hides the tabs. `value` is any CSS gradient, and the picker writes one back.

```tsx
<ColorPicker value={value} onChange={setValue} modes={["linear"]} />
// value: "linear-gradient(90deg, #22C55E 0%, #3E5CEB 100%)"

<ColorPicker value={value} onChange={setValue} modes={["radial"]} />
// value: "radial-gradient(circle at 30% 30%, #FDE68A 0%, #F97316 45%, #BE123C 100%)"

<ColorPicker value={value} onChange={setValue} modes={["conic"]} />
// value: "conic-gradient(from 0deg at 50% 50%, #EF4444, #F59E0B, #22C55E, #3B82F6, #A855F7, #EF4444)"
```

Repeating gradients (`repeating-linear-gradient(...)` and the rest) work the same way; toggle Repeating in the `...` menu.

### Gradients only

For backgrounds that must be a gradient. `defaultGradient` is what a solid value turns into.

```tsx
<ColorPicker
  value={value}
  onChange={setValue}
  modes={["linear", "radial", "conic"]}
  defaultGradient="linear-gradient(90deg, #3E5CEB 0%, #22C55E 100%)"
  gradientPresets
/>
```

### Solid colors, no transparency

```tsx
<ColorPicker value={value} onChange={setValue} modes={["solid"]} alpha={false} formats={["hex", "rgb", "hsl"]} />
```

### Text color with a contrast check

Shows the WCAG ratio and draws the AA line on the color area.

```tsx
<ColorPicker value={value} onChange={setValue} modes={["solid"]} alpha={false} contrastWith="#FFFFFF" />
```

### OKLCH and wide gamut

```tsx
<ColorPicker
  value={value} // "oklch(0.62 0.2 265)"
  onChange={setValue}
  modes={["solid"]}
  space="oklch"
  formats={["oklch", "hex", "rgb"]}
  outputFormat="oklch"
/>
```

### Undo and before / after

```tsx
<ColorPicker value={value} onChange={setValue} history compare />
```

### Saving changes

`onChange` fires on every frame of a drag. Update the preview there, and save in `onChangeComplete`, which fires once.

```tsx
<ColorPicker
  value={layer.fill}
  onChange={(fill) => updateLayerPreview(layer.id, { fill })}
  onChangeComplete={(fill) => saveLayer(layer.id, { fill })}
/>
```

### In a form

`ColorField` takes a value and an onChange like an input, so it works with any form library:

```tsx
import { Controller, useForm } from "react-hook-form";
import { ColorField } from "@orshot/colorshot/react";

const { control, handleSubmit } = useForm({ defaultValues: { accent: "#3E5CEB" } });

<Controller
  name="accent"
  control={control}
  render={({ field }) => (
    <ColorField label="Accent" value={field.value} onChange={field.onChange} modes={["solid"]} alpha={false} />
  )}
/>;
```

### Match a stored format

Keep whatever format your app already stores. Here: uppercase hex when opaque, comma `rgba()` otherwise.

```tsx
import { formatColor } from "@orshot/colorshot";

const outputFormat = (color) =>
  color.alpha >= 1
    ? formatColor({ ...color, alpha: 1 }, "hex", { upper: true })
    : formatColor(color, "rgb", { legacy: true, fn: "rgba" });

<ColorPicker value={value} onChange={setValue} outputFormat={outputFormat} />;
```

### shadcn/ui theme

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

## Using with AI

Install the Colorshot skill to teach your coding agent (Claude Code, Codex, Cursor, GitHub Copilot and others) how to add and configure the picker:

```sh
npx skills add rishimohan/colorshot
```

The API reference is also available for LLMs in [llms.txt](llms.txt), and the docs page has a setup prompt you can copy into any agent.

## One package

| Import | What it is |
| --- | --- |
| `@orshot/colorshot/react` | React components and composable parts |
| `@orshot/colorshot/vue` | Vue components and composable parts |
| `@orshot/colorshot` | Framework-free helpers: color math, CSS gradient parsing, contrast, gradient handles, the picker store. Safe in server code |
| `@orshot/colorshot/styles.css` | The stylesheet, imported once |

Apps only bundle what they import: a React app never pulls in the Vue code, and React and Vue are optional peer dependencies.

## Optional features

All off unless you turn them on.

| Prop | What it does |
| --- | --- |
| `space="oklch"` | OKLCH area (lightness × chroma at one hue, drawn in Display P3 where supported, dashed line marks the sRGB edge) and a perceptual hue slider |
| `history` | Undo / redo committed changes with Cmd/Ctrl+Z inside the picker |
| `swatchSearch` | Search box that filters every swatch group by name, value or hex |
| `gradientPresets` | Gradient swatches shown in gradient modes (`true` or your own list) |
| `contrastWith="#fff"` | WCAG contrast badge against a background; gradients use their weakest stop |
| `tabIcons` | Icons next to the Solid / Linear / Radial / Conic labels |
| `compare` | Before / after swatch beside the sliders; click "before" to restore |
| `swatchLayout="stack"` | List every swatch group instead of one tab per group |
| `size="sm"` | Compact: 240px wide, 24px controls |
| `variant="inset"` | Mode tabs first and a framed area, instead of the default edge-to-edge area |
| `shortcuts={false}` | Turn off 1-4 (modes) and I (eyedropper) |
| `storageKey={null}` | Keep recent colors, the chosen format and swatch tab in memory only |
| `swatches=[...]` | Swatch groups with `onAdd` / `onRemove`, `limit`, `recent: true`, `showIn` |
| `eyeDropper={fn}` | Your own screen picker for browsers without the native EyeDropper |

Always on, no props needed:

- Cmd/Ctrl+C copies the value and Cmd/Ctrl+V applies a pasted color or gradient while the picker has focus
- Two-finger trackpad swipes move the area, sliders, stops and angle dial (the page still scrolls when the swipe started elsewhere)
- Alt-drag a stop to duplicate it, drag a stop off the bar or press Delete to remove it, drag a solid swatch onto the bar to add it
- Switching between solid and gradient keeps the color you are editing on the active stop
- Touch screens get larger thumbs and targets

## ColorField

A trigger that opens the picker in a popover. Flips and shifts to stay on screen, closes on Escape, outside click or tab-away, and returns focus to the trigger. Takes every `ColorPicker` prop.

```tsx
import { ColorField } from "@orshot/colorshot/react";

<ColorField label="Fill" value={fill} onChange={setFill} gradientPresets history />;
```

## On-canvas gradient handles

Framework-free helpers for drawing gradient handles on your own canvas:

```ts
import { gradientHandles, moveGradientHandle } from "@orshot/colorshot";

const result = gradientHandles(value, width, height); // null when value is not a gradient
if (result) {
  const { handles, line } = result; // start / end / stops / center / angle
  const next = moveGradientHandle(value, handles[0].id, x, y, width, height, { snap: shiftKey });
}
```

## Development

```sh
pnpm install
pnpm --filter @colorshot/playground dev       # playground on http://localhost:5190
pnpm --filter @colorshot/core test            # parser, conversion and gradient corpus tests
pnpm --filter @colorshot/playground test:e2e  # browser tests on Chromium, Firefox and WebKit
pnpm build && pnpm size                       # build everything and check gzip budgets
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout and the rules, and [RELEASING.md](RELEASING.md) for publishing.

## License

MIT. Free for personal and commercial use: keep the copyright line and license text, which link to https://orshot.com/open-source/colorshot. The color conversion matrices come from CSS Color Module Level 4, see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

---

Brought to you by [Orshot](https://orshot.com), the API for automated image, PDF and video generation from templates. MIT License.
