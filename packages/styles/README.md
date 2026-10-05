# @colorshot/styles

The default stylesheet for [Colorshot](https://orshot.com/open-source/colorshot) pickers. `@colorshot/react` and `@colorshot/vue` ship it as `<package>/styles.css`, so you only need this package to use the source files directly.

- Plain CSS that CSS resets (Tailwind preflight, global element styles) cannot restyle, in any load order. Theme variables sit in a `colorshot` cascade layer, so your own CSS sets them without `!important`.
- Themed with `--cs-*` custom properties; every part has a `[data-part]` attribute.
- Light and dark (follows the OS, or `theme="light" | "dark"`), compact `size="sm"`, larger targets on touch screens, reduced motion.

Docs: https://orshot.com/open-source/colorshot#theming · MIT · by [Orshot](https://orshot.com)
