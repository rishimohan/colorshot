import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ColorPicker, createPicker, type OutputFormat } from "@orshot/colorshot/react";
import { C, Code } from "../components/Code";
import { Example, H2, H3, Note, PageHeader, Table, ValueReadout } from "../components/Docs";
import { useTheme } from "../lib/theme";

const INPUTS = [
  "#3b82f6",
  "#3B82F680",
  "rgb(59 130 246 / 0.5)",
  "rgba(59, 130, 246, 0.5)",
  "hsl(217 91% 60%)",
  "hwb(217 23% 4%)",
  "oklch(0.62 0.19 260)",
  "oklab(0.62 -0.03 -0.19)",
  "lab(54 9 -66)",
  "color(display-p3 0.3 0.5 0.95)",
  "royalblue",
];

/** What the picker writes after the user drags the hue to 140. Computed live from the core. */
function afterHueDrag(input: string, outputFormat?: OutputFormat): string {
  const store = createPicker({ value: input, outputFormat });
  store.setHsva({ h: 140 });
  return store.getState().value;
}

const OUTPUTS: { label: string; value: OutputFormat }[] = [
  { label: "preserve", value: "preserve" },
  { label: "hex", value: "hex" },
  { label: "rgb", value: "rgb" },
  { label: "hsl", value: "hsl" },
  { label: "oklch", value: "oklch" },
  { label: "display-p3", value: "display-p3" },
];

const FORCE = `
// your renderer only reads hex? Force it.
<ColorPicker value={value} onChange={setValue} outputFormat="hex" />
`;

const FN = `
import { ColorPicker, formatColor } from "@orshot/colorshot/react";

// hex for opaque colors, rgba() when there is transparency
<ColorPicker
  value={value}
  onChange={setValue}
  outputFormat={(color) => (color.alpha < 1 ? formatColor(color, "rgb") : formatColor(color, "hex"))}
/>
`;

const OKLCH = `
<ColorPicker
  value={value}
  onChange={setValue}
  space="oklch"
  formats={["oklch", "p3", "hex"]}
  outputFormat="oklch"
/>
`;

const HELPERS = `
import { parseColor, formatColor, inGamut, toGamut } from "@orshot/colorshot/react";

const parsed = parseColor("color(display-p3 1 0 0)"); // null if it is not a color
if (parsed) {
  inGamut(parsed.color, "srgb"); // false
  formatColor(parsed.color, "oklch"); // "oklch(0.6486 0.2995 28.96)"
  formatColor(toGamut(parsed.color, "srgb"), "hex"); // fitted to sRGB
}
`;

export function FormatsPage() {
  const { theme } = useTheme();
  const [out, setOut] = useState<OutputFormat>("preserve");
  const [value, setValue] = useState("oklch(0.7 0.18 30)");
  const [wide, setWide] = useState("oklch(0.75 0.3 145)");
  const rows = useMemo(() => INPUTS.map((input) => [<C key="i">{input}</C>, <C key="o">{afterHueDrag(input)}</C>]), []);
  const p3red = useMemo(() => afterHueDrag("color(display-p3 1 0 0)", "hex"), []);

  return (
    <>
      <PageHeader
        eyebrow="Features"
        title="Color formats and output"
        lead="Colorshot reads every CSS Color 4 syntax. By default it writes each color back in the format it came in."
      />

      <H2>What it reads</H2>
      <ul>
        <li>
          Hex with 3, 4, 6 or 8 digits. <C>rgb()</C> and <C>rgba()</C>, comma or space syntax, with <C>/ alpha</C>.
        </li>
        <li>
          <C>hsl()</C>, <C>hsla()</C>, <C>hwb()</C>, <C>lab()</C>, <C>lch()</C>, <C>oklab()</C>, <C>oklch()</C>.
        </li>
        <li>
          <C>color()</C> with <C>srgb</C>, <C>srgb-linear</C>, <C>display-p3</C>, <C>a98-rgb</C>, <C>prophoto-rgb</C>, <C>rec2020</C>,{" "}
          <C>xyz</C>, <C>xyz-d50</C> and <C>xyz-d65</C>.
        </li>
        <li>
          Named colors, <C>transparent</C>, and <C>none</C> channels.
        </li>
      </ul>
      <p>
        Values it cannot represent, such as <C>var(--brand)</C> or relative colors, are kept as they are. The picker shows a notice and
        the first edit replaces the value.
      </p>

      <H2>Preserve by default</H2>
      <p>
        With <C>outputFormat="preserve"</C> (the default), a color keeps its format and its style: comma or space syntax, <C>rgba</C>{" "}
        or <C>rgb</C>, uppercase hex. The table below is computed live: each input goes into the picker, then the hue is moved to 140.
      </p>
      <Table head={["Value in", "Value out"]} rows={rows} />
      <p>
        The format menu next to the fields only changes how the numbers are shown. Switching it to HSL does not turn your hex value
        into <C>hsl()</C>. Plain hex digits typed into the hex field keep the current format too. A full CSS color typed or pasted
        there, like <C>oklch(...)</C>, is taken as written, and its format is used from then on.
      </p>

      <H2>Force a format</H2>
      <p>
        Pass a format name when the code that reads the value only understands some formats. Any of <C>hex</C>, <C>rgb</C>,{" "}
        <C>hsl</C>, <C>hwb</C>, <C>lab</C>, <C>lch</C>, <C>oklab</C>, <C>oklch</C>, <C>srgb</C>, <C>srgb-linear</C>,{" "}
        <C>display-p3</C>, <C>a98-rgb</C>, <C>prophoto-rgb</C>, <C>rec2020</C>, <C>xyz-d65</C> or <C>xyz-d50</C>.
      </p>
      <Code code={FORCE} />
      <Example>
        <div className="demo-col">
          <div className="segmented-control" role="radiogroup" aria-label="outputFormat">
            {OUTPUTS.map((o) => (
              <button key={o.label} type="button" role="radio" aria-checked={out === o.value} onClick={() => setOut(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <ColorPicker theme={theme} value={value} onChange={setValue} outputFormat={out} modes={["solid", "linear"]} />
          <ValueReadout value={value} label={`outputFormat="${String(out)}"`} />
        </div>
      </Example>
      <p>
        The forced format applies to colors the user edits. A value that is passed in is not rewritten until the user changes it.
      </p>

      <H3>Custom output</H3>
      <p>
        For full control, pass a function. It gets the <C>Color</C> and the format it came in, and returns a CSS string.
      </p>
      <Code code={FN} />
      <Table
        head={["Argument", "Type"]}
        rows={[
          [<C key="a">color</C>, <C key="b">{"{ space: ColorSpace; coords: [number, number, number]; alpha: number }"}</C>],
          [<C key="c">source</C>, <C key="d">{"{ format: ColorFormat; style: FormatStyle }"}</C>],
        ]}
      />

      <H2>Wide gamut</H2>
      <p>
        OKLCH, Lab and <C>color(display-p3 ...)</C> values can hold colors outside sRGB. Colorshot keeps them as they are. Nothing is
        clipped just because it passed through the picker.
      </p>
      <ul>
        <li>
          When the color is outside sRGB, the area shows a <C>P3</C> badge (inside Display P3) or <C>Wide</C> (beyond P3). Click it to
          fit the color into sRGB.
        </li>
        <li>
          sRGB formats (<C>hex</C>, <C>rgb</C>, <C>hsl</C>, <C>hwb</C>) are gamut mapped when written, with the CSS Color 4 method:
          chroma is lowered in OKLCH until the color fits, so hue and lightness hold. For example, <C>color(display-p3 1 0 0)</C> with{" "}
          <C>outputFormat="hex"</C> becomes <C>{p3red}</C> after a hue change.
        </li>
      </ul>

      <H2>OKLCH area</H2>
      <p>
        <C>space="oklch"</C> switches the area to lightness (top to bottom) by chroma (left to right) at one hue, and the hue slider to
        OKLCH hue. Equal steps look equal, which helps when building palettes. On wide gamut screens the area is drawn in Display P3. The
        dashed line is the sRGB edge: everything to its right is P3 only.
      </p>
      <Example code={OKLCH}>
        <div className="demo-col">
          <ColorPicker theme={theme} value={wide} onChange={setWide} space="oklch" formats={["oklch", "p3", "hex"]} outputFormat="oklch" />
          <ValueReadout value={wide} />
        </div>
      </Example>

      <H2>Helpers</H2>
      <p>
        The same parser and writer are exported. See <Link to="/docs/core">Core API</Link> for the full list.
      </p>
      <Code code={HELPERS} />
      <Note>
        Display formats in the menu: HEX, RGB, HSL, HSB, OKLCH, OKLab, LCH, Lab, P3 and CMYK. CMYK is a plain conversion for reading
        numbers, not a print profile.
      </Note>
    </>
  );
}
