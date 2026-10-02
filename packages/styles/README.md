# @colorshot/styles

The default stylesheet for [Colorshot](https://colorshot.orshot.com) pickers. `@colorshot/react` and `@colorshot/vue` ship it as `<package>/styles.css`, so you only need this package to use the source files directly.

- Plain CSS in a `colorshot` cascade layer: your own styles win without `!important`.
- Themed with `--cs-*` custom properties; every part has a `[data-part]` attribute.
- Light and dark (follows the OS, or `theme="light" | "dark"`), compact `size="sm"`, larger targets on touch screens, reduced motion.

Docs: https://colorshot.orshot.com/docs/theming · MIT · by [Orshot](https://orshot.com)
