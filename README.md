# Colorshot

A color and gradient picker for React, Vue and the web. Open source, by [Orshot](https://orshot.com).

> Status: 0.1.0, ready to publish (see [RELEASING.md](RELEASING.md)). Docs: https://colorshot.orshot.com

## Develop

```bash
pnpm install
pnpm --filter @colorshot/playground dev   # playground on http://localhost:5190
pnpm --filter @colorshot/core test        # parser, conversion and gradient corpus tests
pnpm --filter @colorshot/playground test:e2e  # browser tests
pnpm build && pnpm size                   # build everything and check gzip budgets
```

## Why

Most pickers do one of two things well. Canva has a great panel around the picker (brand colors, document colors, search) but a basic gradient editor. Figma has a great gradient editor but nothing you can drop into your own app. Open source React pickers either skip gradients or break on real-world CSS.

Colorshot aims to do both:

- Solid colors with hue, saturation, alpha, eyedropper and hex / rgb / hsl input
- Linear, radial and conic gradients with draggable stops
- Takes any valid CSS color or gradient string and returns one. Never throws on input it does not understand, and leaves untouched parts as they were
- Your own swatch sections: brand colors, document colors, saved, recent
- Headless parts you compose, or one ready-made component
- Works with React and Vue, from one framework-free core

## One package

`npm i @orshot/colorshot`, then import the entry for your framework. Apps only bundle what they import: a React app never pulls in the Vue code, and React and Vue are optional peer dependencies.

| Import | What it is |
| --- | --- |
| `@orshot/colorshot/react` | React components and hooks |
| `@orshot/colorshot/vue` | Vue components and composables |
| `@orshot/colorshot` | Framework-free helpers: color math, CSS gradient parsing, contrast, the picker store. Safe in server code |
| `@orshot/colorshot/styles.css` | The stylesheet, imported once |

In this repo the code lives in `packages/core`, `packages/react`, `packages/vue` and `packages/styles`; `packages/colorshot` assembles them into the published package.

Styled components will also be available to copy into your project through a shadcn-compatible registry at `colorshot.orshot.com/r`.

## Usage

```bash
npm i @orshot/colorshot
```

```tsx
import { ColorPicker } from "@orshot/colorshot/react";
import "@orshot/colorshot/styles.css";

<ColorPicker
  value={value} // any CSS color or gradient string
  onChange={setValue} // fires while dragging
  onChangeComplete={commit} // fires once when the change is done
  modes={["solid", "linear", "radial", "conic"]}
/>;
```

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
| `variant="inset"` | Mode tabs first and a framed area, instead of the default edge-to-edge (`"bleed"`) area |
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

Swatch groups also take `onReorder` (drag to reorder) and `onRename` (double-click or F2).

## On-canvas gradient handles

Framework-free helpers in `@orshot/colorshot` for drawing gradient handles on your own canvas:

```ts
import { gradientHandles, moveGradientHandle } from "@orshot/colorshot";

const result = gradientHandles(value, width, height); // null when value is not a gradient
if (result) {
  const { handles, line } = result; // start / end / stops / center / angle
  const next = moveGradientHandle(value, handles[0].id, x, y, width, height, { snap: shiftKey });
}
```

## ColorField

A trigger that opens the picker in a popover. Flips and shifts to stay on screen, closes on Escape, outside click or tab-away, and returns focus to the trigger. Takes every `ColorPicker` prop.

```tsx
import { ColorField } from "@orshot/colorshot/react";

<ColorField label="Fill" value={fill} onChange={setFill} gradientPresets history />;
```

## License

MIT
