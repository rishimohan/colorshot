# @orshot/colorshot

## 0.2.0

### Minor Changes

- CSS resets can no longer restyle the picker. Tailwind v4's preflight, loaded after Colorshot's stylesheet, used to flatten the panel (no padding, square stops, no borders), and Tailwind v3's preflight removed the stop borders in any order. Only the `--cs-*` theme variables stay in `@layer colorshot` now, so app CSS still sets them without `!important`; every other rule is unlayered and scoped to `[data-colorshot]`. Part overrides need a selector at least as specific as Colorshot's (`[data-colorshot] [data-part="swatch"]`) and must load after Colorshot's CSS. The ColorField trigger sets its own line-height, and icons are block-level, so the app's line-height and svg resets no longer shift them (the format menu check and the menu icons now sit centered on their labels).
  
  Content passed to `ColorPicker` (React children, the Vue default slot) now renders inside `<div data-part="slot">` (`display: contents`, so the layout is unchanged), and Colorshot's element rules (the button and input reset, box-sizing, focus outline, transition locks) skip it. A plain `<button>` there gets Colorshot's control look (hairline outline, control height and radius); give it any class and it is styled by the app alone, including Tailwind utilities. In a headless `Picker.Root`, wrap your own controls in an element with `data-part="slot"` for the same.

## 0.1.0

First release.
