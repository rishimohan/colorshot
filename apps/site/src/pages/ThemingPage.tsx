import { useState, type CSSProperties, type ReactNode } from "react";
import { ColorField, ColorPicker } from "@orshot/colorshot/react";
import { C, Code } from "../components/Code";
import { Example, H2, H3, Note, PageHeader, Table } from "../components/Docs";
import { useTheme } from "../lib/theme";

type VarRow = [name: string, value: string, note: ReactNode];

const LAYOUT_VARS: VarRow[] = [
  ["--cs-width", "280px", "Picker width. It also has max-width: 100%."],
  ["--cs-padding", "12px", "Space inside the picker."],
  ["--cs-gap", "10px", "Space between rows."],
  ["--cs-gap-row", "6px", "Space inside groups: swatch grid, gradient controls, stop labels."],
  ["--cs-gap-inline", "4px", "Space between controls in one row, such as the input fields."],
  ["--cs-radius", "12px", "Picker corners."],
  ["--cs-radius-sm", "8px", "The area, the preview, the save swatch button."],
  ["--cs-radius-control", "6px", "Buttons, inputs, selects and swatches."],
  ["--cs-radius-inner", "4px", "Small inner parts: tab indicator, labels, the ColorField swatch."],
  ["--cs-area-height", "168px", "Height of the color area in solid mode."],
  ["--cs-area-height-gradient", "var(--cs-area-height)", "Height of the area in gradient modes. The same by default, so the tabs stay put when switching modes; set it lower for a shorter picker."],
  ["--cs-thumb", "18px", "Size of slider and area thumbs."],
  ["--cs-track-height", "12px", "Height of the hue and opacity tracks."],
  ["--cs-control", "28px", "Height of buttons, inputs and tabs."],
  ["--cs-font-size", "12px", "Base text size."],
  ["--cs-font-size-sm", "11px", "Small text: labels, menus, tooltips."],
  ["--cs-font-size-xs", "10px", "Tiny text: stop labels, the gamut badge."],
  ["--cs-swatch-columns", "8", "Columns in the swatch grid."],
  ["--cs-swatch-rows", "3", "Rows a tabbed swatch group shows before it scrolls."],
  ["--cs-field-font-size", "13px", "ColorField trigger text. Not set by default; 13px is the fallback."],
];

type ColorRow = [name: string, light: string, dark: string, note: string];

const COLOR_VARS: ColorRow[] = [
  ["--cs-bg", "#ffffff", "#18181b", "Picker and trigger background."],
  ["--cs-fg", "#18181b", "#f4f4f5", "Text and icons."],
  ["--cs-muted", "#5f5f68", "#a1a1aa", "Secondary text, labels, inactive tabs."],
  ["--cs-border", "rgb(0 0 0 / 0.08)", "rgb(255 255 255 / 0.09)", "Borders."],
  ["--cs-surface", "#f4f4f5", "#27272a", "Tab tracks and hovered buttons."],
  ["--cs-hairline", "rgb(0 0 0 / 0.1)", "rgb(255 255 255 / 0.12)", "Outline of fields, selects and the angle dial."],
  ["--cs-surface-hover", "#e9e9ec", "#323236", "Hovered buttons and selects."],
  ["--cs-raised", "#ffffff", "#3a3a3f", "The active tab indicator."],
  ["--cs-divider", "rgb(0 0 0 / 0.06)", "rgb(255 255 255 / 0.07)", "Thin lines between sections."],
  ["--cs-accent", "#2563eb", "#60a5fa", "Focus rings, the selected stop and other selected states."],
  ["--cs-edge", "rgb(0 0 0 / 0.1)", "rgb(255 255 255 / 0.14)", "Thin edge inside color samples, so white shows on light panels and black on dark ones."],
  ["--cs-danger", "#dc2626", "#f87171", "Invalid input ring and the remove action."],
  ["--cs-ease", "cubic-bezier(0.2, 0, 0, 1)", "same", "The one easing curve every transition uses."],
  ["--cs-motion", "200ms", "same", "Duration for anything that moves or resizes: tabs, thumbs, swatches, menus."],
  ["--cs-motion-fast", "120ms", "same", "Duration for color, fill, outline and fade changes."],
  [
    "--cs-shadow",
    "0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -8px rgb(0 0 0 / 0.16)",
    "0 1px 2px rgb(0 0 0 / 0.3), 0 16px 40px -8px rgb(0 0 0 / 0.6)",
    "Picker shadow.",
  ],
  ["--cs-checker-a", "#e4e4e7", "#3f3f46", "Checkerboard squares behind transparent colors."],
  ["--cs-checker-b", "#ffffff", "#27272a", "The other checkerboard square."],
  ["--cs-checker", "repeating-conic-gradient(...) 0 0 / 8px 8px", "same", "The full checkerboard background, built from the two above."],
];

const SIZE_ROWS: [string, string, string][] = [
  ["--cs-width", "240px", "-"],
  ["--cs-padding", "10px", "-"],
  ["--cs-gap", "8px", "12px"],
  ["--cs-control", "24px", "34px"],
  ["--cs-thumb", "16px", "24px"],
  ["--cs-track-height", "10px", "16px"],
  ["--cs-area-height", "140px", "-"],
  ["--cs-font-size", "11px", "-"],
  ["--cs-font-size-sm", "10.5px", "-"],
  ["--cs-font-size-xs", "9.5px", "-"],
  ["--cs-radius", "10px", "-"],
  ["--cs-radius-control", "5px", "-"],
];

const OVERRIDE = `
/* your CSS: no !important needed */
[data-colorshot],
[data-colorshot-field] {
  --cs-accent: #e11d48;
  --cs-radius: 16px;
  --cs-radius-control: 8px;
}

/* or scope it with a class */
.inspector [data-colorshot] {
  --cs-width: 100%;
  --cs-shadow: none;
}
`;

const SHADCN = `
/* match a shadcn/ui theme */
[data-colorshot],
[data-colorshot-field] {
  --cs-bg: var(--popover);
  --cs-fg: var(--popover-foreground);
  --cs-muted: var(--muted-foreground);
  --cs-border: var(--border);
  --cs-surface: var(--muted);
  --cs-surface-hover: var(--accent);
  --cs-accent: var(--ring);
  --cs-radius: var(--radius);
}
`;

const LAYERS = `
/* app.css: list colorshot first, so every other layer can set the --cs-* variables */
@layer colorshot, theme, base, components, utilities;
@import "tailwindcss";
`;

const DARK = `
// follow your app's theme instead of the OS
<ColorPicker theme={isDark ? "dark" : "light"} value={value} onChange={setValue} />
<ColorField theme={isDark ? "dark" : "light"} value={value} onChange={setValue} />
`;

const PARTS_CSS = `
/* square swatches with an accent outline on the selected one */
[data-colorshot] [data-part="swatch"] {
  border-radius: 2px;
}
[data-colorshot] [data-part="swatch"][data-state="selected"] {
  outline: 2px solid var(--cs-accent);
  outline-offset: 2px;
}

/* hide the hex label inside the area */
[data-colorshot] [data-part="area-label"] {
  display: none;
}

/* a different gradient bar height */
[data-colorshot] [data-part="gradient-bar"] {
  height: 20px;
}
`;

const PART_GROUPS: [string, string[]][] = [
  ["Root", ["root", "slot", "header", "current", "current-value", "current-original", "current-morph", "notice", "toast", "preview", "preview-swatch", "contrast", "contrast-sample", "contrast-label", "contrast-ratio", "contrast-level"]],
  ["Mode tabs", ["mode-tabs", "mode-indicator", "mode-label"]],
  ["Area and sliders", ["area", "area-thumb", "area-label", "area-canvas", "area-edge", "area-contrast", "gamut-badge", "slider-row", "eye-dropper", "sliders", "hue", "alpha", "slider-thumb"]],
  [
    "Gradient",
    ["gradient-editor", "gradient-bar", "stop", "stop-label", "gradient-controls", "angle-dial", "angle-handle", "center-pad", "center-handle", "segmented", "segmented-indicator", "shape-icon", "icon-button"],
  ],
  ["Inputs", ["inputs", "fields", "field", "field-label", "field-input"]],
  [
    "Menus",
    ["select", "select-trigger", "select-value", "select-chevron", "select-menu", "select-heading", "select-list", "select-option", "select-check", "select-label", "select-hint", "select-footer", "select-action", "menu", "menu-group", "menu-separator"],
  ],
  [
    "Swatches",
    ["swatches", "swatch-header", "swatch-search", "swatch-search-input", "swatch-tabs", "swatch-group", "swatch-group-header", "swatch-group-label", "swatch-grid", "swatch-cell", "swatch", "swatch-add", "swatch-remove", "swatch-rename", "swatch-empty", "swatch-empty-hint"],
  ],
  ["ColorField", ["field-swatch", "field-text", "field-alpha", "popover"]],
];

function Playground() {
  const { theme } = useTheme();
  const [accent, setAccent] = useState("#e11d48");
  const [radius, setRadius] = useState(16);
  const [width, setWidth] = useState(280);
  const [value, setValue] = useState("#e11d48");
  const vars = {
    "--cs-accent": accent,
    "--cs-radius": `${radius}px`,
    "--cs-radius-sm": `${Math.max(0, radius - 4)}px`,
    "--cs-radius-control": `${Math.max(0, Math.round(radius / 2))}px`,
    "--cs-width": `${width}px`,
  } as CSSProperties;
  return (
    <Example align="start">
      <div className="theme-play">
        <div className="theme-controls">
          <label>
            <span>--cs-accent</span>
            <ColorField theme={theme} label="Accent" value={accent} onChange={setAccent} modes={["solid"]} />
          </label>
          <label>
            <span>--cs-radius: {radius}px</span>
            <input type="range" min={0} max={24} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </label>
          <label>
            <span>--cs-width: {width}px</span>
            <input type="range" min={240} max={340} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </label>
        </div>
        <ColorPicker
          theme={theme}
          value={value}
          onChange={setValue}
          style={vars}
          swatches={[{ id: "presets", label: "Presets", colors: "default" }]}
        />
      </div>
    </Example>
  );
}

export function ThemingPage() {
  const { theme } = useTheme();
  const [small, setSmall] = useState("#14b8a6");
  return (
    <>
      <PageHeader
        eyebrow="Styling"
        title="Theming"
        lead="One plain CSS file, themed with --cs-* variables and data-part selectors. No Tailwind and no CSS-in-JS needed."
      />

      <H2>How the CSS is built</H2>
      <ul>
        <li>
          The <C>--cs-*</C> variables live in a cascade layer called <C>colorshot</C>. Any CSS you write outside a layer that
          sets them wins, without <C>!important</C>.
        </li>
        <li>
          Every other rule is unlayered and scoped to <C>[data-colorshot]</C>, so CSS resets (Tailwind's preflight, global{" "}
          <C>button</C> or <C>input</C> styles) cannot restyle the picker, whichever stylesheet loads first. To restyle a part,
          match Colorshot's selector and load your CSS after Colorshot's.
        </li>
        <li>
          Values come from <C>--cs-*</C> variables on <C>[data-colorshot]</C> (the picker) and <C>[data-colorshot-field]</C> (the
          ColorField trigger). Set them there, with <C>style</C>, <C>className</C> or a rule: they are not read from parent
          elements.
        </li>
        <li>
          Every element has a <C>data-part</C> attribute. States use <C>data-state</C>. These names are public API and follow semver.
        </li>
      </ul>
      <Code lang="css" code={OVERRIDE} />

      <H3>Try it</H3>
      <Playground />

      <H2>Variables</H2>
      <H3>Size and spacing</H3>
      <Table head={["Variable", "Default", "What it sets"]} rows={LAYOUT_VARS.map(([n, v, note]) => [<C key="n">{n}</C>, <C key="v">{v}</C>, note])} />
      <H3>Colors</H3>
      <Table
        head={["Variable", "Light", "Dark", "What it sets"]}
        rows={COLOR_VARS.map(([n, l, d, note]) => [
          <C key="n">{n}</C>,
          <span key="l" className="var-value">
            {l.startsWith("#") && <i style={{ background: l }} />}
            <C>{l}</C>
          </span>,
          <span key="d" className="var-value">
            {d.startsWith("#") && <i style={{ background: d }} />}
            <C>{d}</C>
          </span>,
          note,
        ])}
      />
      <p>
        Some variables are set by the components while they run, such as <C>--_cs-x</C>, <C>--_cs-y</C>, <C>--_cs-swatch</C> and{" "}
        <C>--_cs-stop-color</C>. Read them in your CSS if you like, but do not set them.
      </p>

      <H2>Dark mode</H2>
      <p>
        Without a <C>theme</C> prop, the picker follows the OS through <C>prefers-color-scheme</C>. Pass <C>theme="light"</C> or{" "}
        <C>theme="dark"</C> to follow your app's own toggle. It sets <C>data-theme</C> on the root, which you can also target in CSS.
        This site passes its theme to every picker, so the toggle in the header switches them all.
      </p>
      <Code code={DARK} />
      <Code
        lang="css"
        code={`
/* your own dark palette */
[data-colorshot][data-theme="dark"],
[data-colorshot-field][data-theme="dark"] {
  --cs-bg: #0b1120;
  --cs-surface: #172036;
}
`}
      />

      <H2>Compact size</H2>
      <p>
        <C>size="sm"</C> sets <C>data-size="sm"</C> on the root, which changes these variables. Override them the same way.
      </p>
      <Example code={`<ColorPicker size="sm" value={value} onChange={setValue} />`}>
        <ColorPicker theme={theme} size="sm" value={small} onChange={setSmall} />
      </Example>

      <H2>Touch</H2>
      <p>
        On touch screens (<C>@media (pointer: coarse)</C>) thumbs, tracks and controls grow, and the hit areas of the sliders and the
        gradient bar extend past their edges. Nothing to set up.
      </p>
      <Table head={["Variable", 'size="sm"', "Touch"]} rows={SIZE_ROWS.map(([n, sm, t]) => [<C key="n">{n}</C>, sm, t])} />

      <H2>Parts and states</H2>
      <p>
        Target any element with <C>[data-colorshot] [data-part="..."]</C>. Every part component also takes <C>className</C> and{" "}
        <C>style</C>.
      </p>
      <p>
        What is stable across releases: the parts listed below, the <C>--cs-*</C> variables on this page, and the{" "}
        <C>data-state</C>, <C>data-mode</C>, <C>data-theme</C>, <C>data-size</C> and <C>data-variant</C> attributes. Other
        attributes and any <C>--_cs-*</C> variables are internal and can change in any release.
      </p>
      <Code lang="css" code={PARTS_CSS} />
      <div className="part-groups">
        {PART_GROUPS.map(([title, parts]) => (
          <div key={title}>
            <p className="part-group-title">{title}</p>
            <p className="part-list">
              {parts.map((p) => (
                <C key={p}>{p}</C>
              ))}
            </p>
          </div>
        ))}
      </div>
      <Table
        head={["Attribute", "Where", "Values"]}
        rows={[
          [<C key="a">data-theme</C>, "root, trigger", "light, dark, or unset"],
          [<C key="b">data-size</C>, "root", "sm, or unset"],
          [<C key="c">data-mode</C>, "root", "solid, linear, radial, conic"],
          [<C key="d">data-state</C>, "tabs, stops, swatches", "active / inactive, selected"],
          [<C key="e">data-state</C>, "ColorField trigger", "open, closed"],
          [<C key="f">data-dragging</C>, "area, sliders, bar, dial", "present while a drag is active"],
          [<C key="g">data-layout</C>, "swatches", "tabs, stack"],
          [<C key="h">data-type</C>, "gradient-controls", "linear, radial, conic"],
          [<C key="i">data-space</C>, "area", "oklch when the OKLCH area is shown"],
        ]}
      />

      <H2>Cascade layers</H2>
      <p>
        If your own CSS is also in layers, as with Tailwind v4, layer order decides who sets the <C>--cs-*</C> variables.
        Layers named first lose. To set them with Tailwind classes, name <C>colorshot</C> first, once, at the top of your main
        CSS file:
      </p>
      <Code lang="css" code={LAYERS} />
      <H3>shadcn/ui</H3>
      <p>Map the variables to your shadcn tokens and the picker matches your theme, light and dark.</p>
      <Code lang="css" code={SHADCN} />
      <Note>
        Reduced motion is respected: with <C>prefers-reduced-motion: reduce</C> the picker turns off its transitions.
      </Note>
    </>
  );
}
