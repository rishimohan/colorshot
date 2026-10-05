import { useState } from "react";
import { Link } from "react-router-dom";
import { ColorPicker, defaultLabels } from "@orshot/colorshot/react";
import { C, Code } from "../components/Code";
import { Example, H2, H3, Note, PageHeader, PropTable, Table, ValueReadout, type PropRow } from "../components/Docs";
import { useTheme } from "../lib/theme";

export const ROOT_PROPS: PropRow[] = [
  { name: "value", type: "string", description: "Controlled value. Any CSS color or gradient string." },
  { name: "defaultValue", type: "string", description: "Starting value when uncontrolled." },
  {
    name: "onChange",
    type: "(value: string) => void",
    description: "Fires while the user drags or types, at most once per animation frame.",
  },
  {
    name: "onChangeComplete",
    type: "(value: string) => void",
    description: "Fires once when an interaction ends: pointer up, a committed input, a swatch click. Use it for saving and undo.",
  },
  {
    name: "modes",
    type: "readonly PickerMode[]",
    default: '["solid", "linear", "radial", "conic"]',
    description: (
      <>
        Allowed modes. <C>PickerMode</C> is <C>"solid" | "linear" | "radial" | "conic"</C>. The tabs hide when only one is left.
      </>
    ),
  },
  {
    name: "outputFormat",
    type: "OutputFormat",
    default: '"preserve"',
    description: (
      <>
        How colors are written. <C>"preserve"</C> keeps the format each color came in. Pass a format such as <C>"hex"</C> to
        force it, or a function. See <Link to="/docs/formats">Color formats</Link>.
      </>
    ),
  },
  {
    name: "defaultColor",
    type: "string",
    default: '"#000000"',
    description: "Used when the value is empty or cannot be read, and when switching to solid with no earlier solid color.",
  },
  {
    name: "defaultGradient",
    type: "string",
    description:
      "Used when switching to a gradient with no earlier gradient. Without it, the picker builds a 90deg linear gradient from the current color to white (or to black when the color is light).",
  },
  {
    name: "labels",
    type: "Partial<Labels>",
    default: "defaultLabels",
    description: (
      <>
        Replace any UI text, for translation. See <a href="#labels">labels</a>.
      </>
    ),
  },
  { name: "theme", type: '"light" | "dark"', default: "follows the OS", description: "Force a theme. Leave unset to follow prefers-color-scheme." },
  {
    name: "storageKey",
    type: "string | null",
    default: '"colorshot"',
    description:
      "localStorage prefix for recent colors, the last input format and the active swatch tab. null keeps them in memory only.",
  },
  { name: "size", type: '"sm"', description: "Compact size: 240px wide, 24px controls. For tight inspector panels." },
  {
    name: "shortcuts",
    type: "boolean",
    default: "true",
    description: (
      <>
        Keyboard shortcuts while the picker has focus: <kbd>1</kbd> to <kbd>4</kbd> switch modes, <kbd>I</kbd> picks from the screen.
      </>
    ),
  },
  {
    name: "space",
    type: '"hsv" | "oklch"',
    default: '"hsv"',
    description: "Color model of the area and hue slider. oklch is perceptual and shows wide gamut colors.",
  },
  {
    name: "history",
    type: "boolean | { limit?: number }",
    default: "false",
    description: (
      <>
        Undo and redo with <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd> inside the picker. <C>true</C> keeps 100 steps.
      </>
    ),
  },
  { name: "children", type: "ReactNode", description: "Rendered at the end of the picker, after the swatches, inside [data-part=\"slot\"]. A plain <button> looks like Colorshot's controls; with a class it is styled by your CSS alone." },
  {
    name: "...div props",
    type: "HTMLAttributes<HTMLDivElement>",
    description: (
      <>
        <C>className</C>, <C>style</C>, <C>id</C>, <C>aria-*</C> and event handlers go to the root element. The ref points at it
        too.
      </>
    ),
  },
];

export const PICKER_PROPS: PropRow[] = [
  {
    name: "variant",
    type: '"bleed" | "inset"',
    default: '"bleed"',
    description:
      "bleed: the color area runs to the panel edges at the top, controls below. inset: mode tabs first, then a framed area inside the panel padding.",
  },
  { name: "alpha", type: "boolean", default: "true", description: "Show the opacity slider and the opacity field." },
  {
    name: "eyeDropper",
    type: "boolean | EyeDropperFn",
    default: "true",
    description: (
      <>
        <C>true</C> uses the browser EyeDropper API where it exists. Pass a function to support other browsers. <C>false</C> hides
        it.
      </>
    ),
  },
  {
    name: "formats",
    type: "DisplayFormat[]",
    default: '["hex", "rgb", "hsl", "oklch"]',
    description: (
      <>
        Formats in the input menu. <C>DisplayFormat</C> is <C>"hex" | "rgb" | "hsl" | "hsb" | "oklch" | "oklab" | "lch" | "lab" | "p3" | "cmyk"</C>.
      </>
    ),
  },
  {
    name: "defaultFormat",
    type: "DisplayFormat",
    description: "Starting input format. Without it: the format the user picked last, else the one matching the value, else the first in formats.",
  },
  { name: "inputs", type: "boolean", default: "true", description: "Show the format menu and channel fields." },
  {
    name: "swatches",
    type: "SwatchGroupConfig[]",
    description: (
      <>
        Swatch groups under the picker. See <Link to="/docs/swatches">Swatches</Link>.
      </>
    ),
  },
  {
    name: "swatchLayout",
    type: '"tabs" | "stack"',
    default: "tabs with 2+ groups",
    description: "Show groups as tabs over one grid, or stacked with a heading each.",
  },
  { name: "swatchSearch", type: "boolean", default: "false", description: "A search box that filters every group by name, value or hex." },
  {
    name: "gradientPresets",
    type: "boolean | string[]",
    default: "false",
    description: (
      <>
        A Gradients swatch group shown in gradient modes. <C>true</C> uses the built-in set (<C>DEFAULT_GRADIENTS</C>), or pass your own list.
      </>
    ),
  },
  { name: "interpolation", type: "boolean", default: "true", description: 'Show the "Blend colors in" choice in the gradient options menu.' },
  {
    name: "contrastWith",
    type: "string",
    description:
      "Show the WCAG contrast ratio against this background color. Gradients use their weakest stop. The color area also draws a line where contrast crosses 4.5:1.",
  },
  { name: "tabIcons", type: "boolean", default: "false", description: "Icons next to the Solid, Linear, Radial and Conic labels." },
  {
    name: "compare",
    type: "boolean",
    default: "false",
    description:
      "Once the value changes, the swatch in the header splits into before and after. Clicking before restores the value the picker opened with.",
  },
];

const MODES = `<ColorPicker value={value} onChange={setValue} modes={["solid", "linear"]} />`;
const SMALL = `<ColorPicker value={value} onChange={setValue} size="sm" />`;
const OKLCH = `
<ColorPicker
  value={value}
  onChange={setValue}
  space="oklch"
  formats={["oklch", "p3", "hex"]}
/>
`;
const COMPARE = `
<ColorPicker
  value={value}
  onChange={setValue}
  compare
  contrastWith="#ffffff"
  tabIcons
/>
`;
const MINIMAL = `
<ColorPicker
  value={value}
  onChange={setValue}
  modes={["solid"]}
  alpha={false}
  eyeDropper={false}
  inputs={false}
  swatches={[{ id: "presets", colors: "default" }]}
/>
`;
const EYEDROPPER = `
import { ColorPicker, hasNativeEyeDropper, type EyeDropperFn } from "@orshot/colorshot/react";

// Return a CSS color, or null when the user cancels.
// The signal aborts when the picker unmounts.
// This fallback opens the system color dialog, which has its own screen picker.
const systemPicker: EyeDropperFn = (signal) =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "color";
    input.addEventListener("change", () => resolve(input.value), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    signal.addEventListener("abort", () => resolve(null), { once: true });
    input.click();
  });

<ColorPicker
  value={value}
  onChange={setValue}
  eyeDropper={hasNativeEyeDropper() ? true : systemPicker}
/>
`;
const LABELS = `
<ColorPicker
  value={value}
  onChange={setValue}
  labels={{
    solid: "Einfarbig",
    linear: "Linear",
    radial: "Radial",
    conic: "Konisch",
    hue: "Farbton",
    alpha: "Deckkraft",
  }}
/>
`;
const CHILDREN = `
<ColorPicker value={value} onChange={setValue}>
  <button onClick={() => setValue("")}>Clear</button>
</ColorPicker>
`;

export function ColorPickerPage() {
  const { theme } = useTheme();
  const [a, setA] = useState("#3E5CEB");
  const [b, setB] = useState("#F97316");
  const [c, setC] = useState("oklch(0.7 0.25 150)");
  const [d, setD] = useState("#6366f1");
  const [e, setE] = useState("#22c55e");
  const [f, setF] = useState("#ec4899");
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="ColorPicker"
        lead="The ready-made picker: mode tabs, gradient editor, color area, sliders, inputs and swatches. Turn parts on and off with props, or compose your own layout from the parts."
      />
      <Code code={`import { ColorPicker } from "@orshot/colorshot/react";`} />

      <H2>Props</H2>
      <p>Props for the picker itself:</p>
      <PropTable rows={PICKER_PROPS} />
      <p>
        Props shared with <C>Picker.Root</C> and <C>ColorField</C>:
      </p>
      <PropTable rows={ROOT_PROPS} />

      <H2>Examples</H2>

      <H3>Limit the modes</H3>
      <Example code={MODES}>
        <div className="demo-col">
          <ColorPicker theme={theme} value={a} onChange={setA} modes={["solid", "linear"]} />
          <ValueReadout value={a} />
        </div>
      </Example>

      <H3>Compact size</H3>
      <p>
        <C>size="sm"</C> makes the picker 240px wide with 24px controls. Everything else stays the same.
      </p>
      <Example code={SMALL}>
        <ColorPicker theme={theme} value={b} onChange={setB} size="sm" />
      </Example>

      <H3>OKLCH area</H3>
      <p>
        With <C>space="oklch"</C> the area shows lightness and chroma at one hue. It is drawn in Display P3 on screens that support
        it. The dashed line marks the sRGB edge. A <C>P3</C> or <C>Wide</C> badge appears when the color is outside sRGB. Click it to fit the color into sRGB.
      </p>
      <Example code={OKLCH}>
        <div className="demo-col">
          <ColorPicker theme={theme} value={c} onChange={setC} space="oklch" formats={["oklch", "p3", "hex"]} />
          <ValueReadout value={c} />
        </div>
      </Example>

      <H3>Before and after, contrast, tab icons</H3>
      <Example code={COMPARE}>
        <ColorPicker theme={theme} value={d} onChange={setD} compare contrastWith="#ffffff" tabIcons />
      </Example>

      <H3>Minimal</H3>
      <Example code={MINIMAL}>
        <ColorPicker
          theme={theme}
          value={e}
          onChange={setE}
          modes={["solid"]}
          alpha={false}
          eyeDropper={false}
          inputs={false}
          swatches={[{ id: "presets", colors: "default" }]}
        />
      </Example>

      <H3>Extra content</H3>
      <p>Children render at the bottom of the picker, inside <C>[data-part="slot"]</C>. A plain <C>&lt;button&gt;</C> gets Colorshot's control look; give it a class and your CSS styles it alone.</p>
      <Example code={CHILDREN}>
        <ColorPicker theme={theme} value={f} onChange={setF}>
          <button type="button" onClick={() => setF("")}>
            Clear
          </button>
        </ColorPicker>
      </Example>

      <H3>Eyedropper in every browser</H3>
      <p>
        The native EyeDropper API exists in Chromium browsers only. In Firefox and Safari the button is hidden, unless you pass your
        own function. It keeps the current opacity by default.
      </p>
      <Code code={EYEDROPPER} />

      <H2 id="labels">Labels</H2>
      <p>
        Every string in the UI can be replaced through <C>labels</C>. Pass only the keys you want to change. The full set is exported as{" "}
        <C>defaultLabels</C>.
      </p>
      <Code code={LABELS} />
      <details className="details">
        <summary>All label keys and their defaults</summary>
        <Table
          head={["Key", "Default"]}
          rows={Object.entries(defaultLabels).map(([k, v]) => [<C key={k}>{k}</C>, v])}
        />
      </details>

      <Note>
        Need a different layout? Every piece of the picker is exported as a part. See{" "}
        <Link to="/docs/parts">Parts and custom layouts</Link>.
      </Note>
    </>
  );
}
