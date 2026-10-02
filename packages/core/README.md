# @colorshot/core

Framework-free logic behind [Colorshot](https://colorshot.orshot.com): CSS Color 4 parsing and formatting, color space conversion, gamut mapping, a lossless CSS gradient parser, WCAG contrast, on-canvas gradient handles, and the picker state store that the React and Vue packages are built on.

```bash
npm i @colorshot/core
```

```ts
import { parseColor, formatColor, createPicker, contrastRatio } from "@colorshot/core";

parseColor("oklch(0.7 0.15 200)"); // { color, format: "oklch", style }
formatColor(parseColor("#3366ff")!.color, "oklch"); // "oklch(0.5726 0.2338 265.28)"
contrastRatio("#64748b", "#ffffff"); // 4.758...

const picker = createPicker({ value: "linear-gradient(90deg, red, blue)", onChange: console.log });
picker.addStop(0.5); // adds the color the browser draws at 50%
picker.setAngle(45);
picker.getState().value; // "linear-gradient(45deg, red 0%, #800080 50%, blue 100%)"
```

Zero dependencies. Every gradient part you do not edit is kept exactly as written (radial sizes, `at` positions, px and `calc()` stops, `var()` stops, repeating gradients, several gradient layers, `in oklch`).

Only plain colors and gradients go in and out: anything else (markup, `url()`, `image-set()`, semicolons, text over 4 KB) is treated as unreadable and never emitted. `isSafeCssValue(value)` is the same check, for validating stored values on your server.

Docs: https://colorshot.orshot.com/docs/core · MIT · by [Orshot](https://orshot.com)
