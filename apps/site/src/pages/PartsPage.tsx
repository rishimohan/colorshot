import { useState } from "react";
import { Link } from "react-router-dom";
import { Picker, convert, formatColor, usePicker, usePickerStore, type Color } from "@orshot/colorshot/react";
import { C, Code } from "../components/Code";
import { Example, H2, H3, Note, PageHeader, PropTable, Table, ValueReadout, type PropRow } from "../components/Docs";
import { useTheme } from "../lib/theme";

const CS = [
  { name: "className", type: "string", description: "Class on the part's root element." },
  { name: "style", type: "CSSProperties", description: "Style on the part's root element." },
] satisfies PropRow[];

interface PartDoc {
  name: string;
  what: string;
  props: PropRow[];
}

const PARTS: PartDoc[] = [
  {
    name: "Picker.Root",
    what: "Holds the picker state and renders the root element. Every other part must be inside it. Takes the shared props listed on the ColorPicker page.",
    props: [],
  },
  {
    name: "Picker.ModeTabs",
    what: "Solid, Linear, Radial, Conic tabs with a sliding indicator. Renders nothing when only one mode is allowed.",
    props: [
      { name: "showLabels", type: "boolean", default: "true", description: "Show the mode names. With false, tabs are icons with tooltips." },
      { name: "showIcons", type: "boolean", default: "false", description: "Show icons next to the names." },
      ...CS,
    ],
  },
  {
    name: "Picker.Notice",
    what: "A short message shown when the value cannot be read (a var(), a broken gradient). Picking a color replaces the value.",
    props: [...CS],
  },
  {
    name: "Picker.GradientEditor",
    what: "GradientBar plus GradientControls, rendered only in gradient modes.",
    props: [{ name: "interpolation", type: "boolean", default: "true", description: 'Show the "Blend colors in" choice.' }],
  },
  {
    name: "Picker.GradientBar",
    what: "The stops on a bar. Click to add, drag to move, drag off to remove. Renders nothing in solid mode.",
    props: [...CS],
  },
  {
    name: "Picker.GradientControls",
    what: "Angle dial and field, radial shape, center pad, reverse, and the options menu: blend colors, radial size, repeat, center it, remove stop.",
    props: [{ name: "interpolation", type: "boolean", default: "true", description: 'Show the "Blend colors in" choice.' }, ...CS],
  },
  { name: "Picker.AngleDial", what: "Drag around the dial to set the angle of a linear gradient or the start of a conic one.", props: [...CS] },
  { name: "Picker.CenterPad", what: "Drag the dot to move the center of a radial or conic gradient. The pad shows the live gradient.", props: [...CS] },
  {
    name: "Picker.Area",
    what: 'The 2D color area. Saturation and brightness by default, lightness and chroma with space="oklch" on the root.',
    props: [
      {
        name: "contrastWith",
        type: "string",
        description: "Draw the WCAG AA (4.5:1) boundary against this background, like Chrome DevTools. HSV area only.",
      },
      ...CS,
    ],
  },
  { name: "Picker.Hue", what: "Hue slider. Follows the root space: HSV hue or OKLCH hue.", props: [...CS] },
  { name: "Picker.Alpha", what: "Opacity slider on a checkerboard.", props: [...CS] },
  {
    name: "Picker.Inputs",
    what: "Format menu, channel fields and the opacity field. The format menu also has a copy action.",
    props: [
      { name: "formats", type: "DisplayFormat[]", default: '["hex", "rgb", "hsl", "oklch"]', description: "Formats in the menu." },
      { name: "defaultFormat", type: "DisplayFormat", description: "Starting format." },
      { name: "alpha", type: "boolean", default: "true", description: "Show the opacity field." },
      ...CS,
    ],
  },
  {
    name: "Picker.EyeDropper",
    what: "Picks a color from the screen. Renders nothing when there is no native EyeDropper and no pick function.",
    props: [
      { name: "pick", type: "EyeDropperFn", description: "Your own picker for browsers without the native API." },
      { name: "keepAlpha", type: "boolean", default: "true", description: "Keep the current opacity instead of the picked pixel's." },
      ...CS,
    ],
  },
  {
    name: "Picker.Swatches",
    what: "Swatch groups. See the Swatches page for the group config.",
    props: [
      { name: "groups", type: "SwatchGroupConfig[]", description: "Required. The groups to show." },
      { name: "search", type: "boolean", default: "false", description: "A search box over every group." },
      { name: "layout", type: '"tabs" | "stack"', default: "tabs with 2+ groups", description: "Tabs over one grid, or stacked groups." },
      ...CS,
    ],
  },
  {
    name: "Picker.Preview",
    what: "The current value on a checkerboard.",
    props: [
      {
        name: "compare",
        type: "boolean",
        default: "false",
        description: "Also show the value the picker opened with. Clicking it restores that value.",
      },
      ...CS,
    ],
  },
  {
    name: "Picker.CurrentSwatch",
    what: "The current value as a swatch. Clicking it copies the CSS value. ColorPicker shows it in the header.",
    props: [
      {
        name: "compare",
        type: "boolean",
        default: "false",
        description: "Once the value changes, split into the opening value (click to restore) and the current one.",
      },
      ...CS,
    ],
  },
  {
    name: "Picker.Contrast",
    what: "WCAG 2 contrast of the current value against a background, with the AA / AAA level.",
    props: [{ name: "background", type: "string", description: "Required. The background color, any CSS color." }, ...CS],
  },
];

const COMPOSED = `
import { Picker } from "@orshot/colorshot/react";

<Picker.Root value={value} onChange={setValue} modes={["solid"]} space="oklch" history>
  <Picker.Area />
  <div className="row">
    <Picker.Preview compare />
    <div className="sliders">
      <Picker.Hue />
      <Picker.Alpha />
    </div>
  </div>
  <div className="row">
    <Picker.EyeDropper />
    <Picker.Inputs formats={["oklch", "hex", "p3"]} />
  </div>
</Picker.Root>
`;

const CUSTOM_PART = `
import { Picker, convert, formatColor, usePicker, usePickerStore, type Color } from "@orshot/colorshot/react";

// A row of lighter and darker versions of the current color
function Shades() {
  const store = usePickerStore();
  const color = usePicker((s) => s.color);
  const [, chroma, hue] = convert(color, "oklch").coords;
  return (
    <div className="shades">
      {[0.3, 0.45, 0.6, 0.75, 0.9].map((l) => {
        const shade: Color = { space: "oklch", coords: [l, chroma, hue || 0], alpha: 1 };
        return (
          <button
            key={l}
            aria-label={\`Lightness \${l * 100}%\`}
            style={{ background: formatColor(shade, "oklch") }}
            onClick={() => {
              store.setColor(shade);
              store.commit(); // fires onChangeComplete
            }}
          />
        );
      })}
    </div>
  );
}

<Picker.Root value={value} onChange={setValue} modes={["solid"]}>
  <Picker.Area />
  <Picker.Hue />
  <Shades />
  <Picker.Inputs />
</Picker.Root>
`;

const GRADIENT_ONLY = `
<Picker.Root value={value} onChange={setValue} modes={["linear", "radial", "conic"]}>
  <Picker.ModeTabs showLabels={false} />
  <Picker.GradientEditor interpolation={false} />
  <Picker.Area />
  <Picker.Hue />
  <Picker.Inputs formats={["hex"]} />
</Picker.Root>
`;

function Shades() {
  const store = usePickerStore();
  const color = usePicker((s) => s.color);
  const [, chroma, hue] = convert(color, "oklch").coords;
  return (
    <div className="shades">
      {[0.3, 0.45, 0.6, 0.75, 0.9].map((l) => {
        const shade: Color = { space: "oklch", coords: [l, chroma, hue || 0], alpha: 1 };
        return (
          <button
            key={l}
            type="button"
            aria-label={`Lightness ${l * 100}%`}
            style={{ background: formatColor(shade, "oklch") }}
            onClick={() => {
              store.setColor(shade);
              store.commit();
            }}
          />
        );
      })}
    </div>
  );
}

const STATE_ROWS: PropRow[] = [
  { name: "value", type: "string", description: "The current CSS value." },
  { name: "mode", type: "PickerMode", description: "solid, linear, radial or conic." },
  { name: "hsva", type: "Hsva", description: "The edited color (solid color or selected stop) as HSV: h 0-360, s, v and a 0-1." },
  { name: "color", type: "Color", description: "The same color in its own space, so wide gamut colors are not clipped." },
  { name: "format", type: "{ format: ColorFormat; style: FormatStyle }", description: "How the edited color is written." },
  { name: "parsed", type: "boolean", description: "False when the incoming value could not be read." },
  { name: "gradient", type: "Gradient | null", description: "The gradient being edited. null in solid mode." },
  { name: "stops", type: "GradientStop[]", description: "Gradient stops." },
  { name: "offsets", type: "number[]", description: "Stop positions 0-1, in the same order as stops." },
  { name: "selectedStopId", type: "string | null", description: "The selected stop." },
];

export function PartsPage() {
  const { theme } = useTheme();
  const [a, setA] = useState("oklch(0.72 0.17 40)");
  const [b, setB] = useState("#0ea5e9");
  const [c, setC] = useState("radial-gradient(circle at 30% 30%, #fde68a 0%, #f97316 100%)");
  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="Parts and custom layouts"
        lead="ColorPicker is built from parts you can use on your own. Put them under Picker.Root in any order, leave some out, or add your own."
      />

      <H2>A composed picker</H2>
      <p>
        <C>Picker.Root</C> lays its children out in a column with <C>--cs-gap</C> between them. Wrap parts in your own elements for
        rows. Colorshot's button and input styles apply to everything under the root; put your own controls inside an element
        with <C>data-part="slot"</C> to keep their styles.
      </p>
      <Example code={COMPOSED}>
        <div className="demo-col">
          <Picker.Root theme={theme} value={a} onChange={setA} modes={["solid"]} space="oklch" history>
            <Picker.Area />
            <div className="composed-row">
              <Picker.Preview compare className="composed-preview" />
              <div className="composed-sliders">
                <Picker.Hue />
                <Picker.Alpha />
              </div>
            </div>
            <div className="composed-row">
              <Picker.EyeDropper />
              <Picker.Inputs formats={["oklch", "hex", "p3"]} />
            </div>
          </Picker.Root>
          <ValueReadout value={a} />
        </div>
      </Example>

      <H2>Your own parts</H2>
      <p>
        Any component inside <C>Picker.Root</C> can read state with <C>usePicker(selector)</C> and change it with{" "}
        <C>usePickerStore()</C>. A part re-renders only when its slice of state changes.
      </p>
      <Example code={CUSTOM_PART}>
        <Picker.Root theme={theme} value={b} onChange={setB} modes={["solid"]}>
          <Picker.Area />
          <Picker.Hue />
          <Shades />
          <Picker.Inputs />
        </Picker.Root>
      </Example>
      <Note>
        Call <C>store.commit()</C> when your interaction is done. That is what fires <C>onChangeComplete</C> and adds an undo step.
        The full list of store actions is on the <Link to="/docs/core#store-actions">Core API</Link> page.
      </Note>

      <H3>Gradient editor only</H3>
      <Example code={GRADIENT_ONLY}>
        <Picker.Root theme={theme} value={c} onChange={setC} modes={["linear", "radial", "conic"]}>
          <Picker.ModeTabs showLabels={false} />
          <Picker.GradientEditor interpolation={false} />
          <Picker.Area />
          <Picker.Hue />
          <Picker.Inputs formats={["hex"]} />
        </Picker.Root>
      </Example>

      <H2>Hooks</H2>
      <Table
        head={["Hook", "Returns"]}
        rows={[
          [
            <C key="a">{"usePicker<T>(selector: (state: PickerState) => T, isEqual?: (a: T, b: T) => boolean): T"}</C>,
            "A slice of picker state. Compared shallowly by default.",
          ],
          [<C key="b">{"usePickerStore(): PickerStore"}</C>, "The store, for calling actions such as setHsva, addStop and commit."],
        ]}
      />
      <H3>PickerState</H3>
      <PropTable rows={STATE_ROWS} label="Field" />

      <H2>All parts</H2>
      {PARTS.map((p) => (
        <section key={p.name} className="part-doc">
          <H3 id={p.name.replace("Picker.", "").toLowerCase()}>{p.name}</H3>
          <p>{p.what}</p>
          {p.props.length > 0 && <PropTable rows={p.props} />}
        </section>
      ))}
    </>
  );
}
