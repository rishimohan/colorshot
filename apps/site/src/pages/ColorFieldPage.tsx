import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ColorField, type ColorFieldHandle } from "@orshot/colorshot/react";
import { C, Code } from "../components/Code";
import { Example, H2, H3, Note, PageHeader, PropTable, type PropRow } from "../components/Docs";
import { useTheme } from "../lib/theme";

const FIELD_PROPS: PropRow[] = [
  { name: "value", type: "string", description: "Controlled value. Any CSS color or gradient." },
  { name: "defaultValue", type: "string", default: '""', description: "Starting value when uncontrolled." },
  { name: "onChange", type: "(value: string) => void", description: "Fires while the user drags or types." },
  { name: "open", type: "boolean", description: "Controlled open state." },
  { name: "defaultOpen", type: "boolean", default: "false", description: "Starting open state when uncontrolled." },
  { name: "onOpenChange", type: "(open: boolean) => void", description: "Fires when the popover opens or closes." },
  {
    name: "placement",
    type: "Placement",
    default: '"bottom-start"',
    description: (
      <>
        Preferred side: <C>"bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "left-start"</C>. The popover flips and
        shifts to stay on screen.
      </>
    ),
  },
  { name: "offset", type: "number", default: "6", description: "Gap between the trigger and the popover, in px." },
  {
    name: "portal",
    type: "boolean | HTMLElement | null",
    default: "true",
    description: (
      <>
        <C>true</C> renders the popover on <C>document.body</C>. Pass an element to render into it. <C>false</C> renders it inline,
        next to the trigger.
      </>
    ),
  },
  { name: "disabled", type: "boolean", default: "false", description: "Disables the trigger." },
  {
    name: "label",
    type: "string",
    description: 'Accessible name, such as "Fill". Screen readers hear "Fill: #3E5CEB". Also names the popover dialog.',
  },
  { name: "placeholder", type: "string", default: 'labels.none ("None")', description: "Trigger text when the value is empty." },
  {
    name: "renderTrigger",
    type: "(state: { value: string; open: boolean }) => ReactNode",
    description: "Replace what is inside the trigger button. The button itself, its focus handling and ARIA stay.",
  },
  { name: "className", type: "string", description: "Class on the trigger button." },
  { name: "style", type: "CSSProperties", description: "Style on the trigger button." },
  { name: "pickerClassName", type: "string", description: "Class on the picker inside the popover." },
  { name: "pickerStyle", type: "CSSProperties", description: "Style on the picker inside the popover." },
  {
    name: "...picker props",
    type: "ColorPickerProps",
    description: (
      <>
        Every other <Link to="/docs/color-picker">ColorPicker</Link> prop is passed to the picker: <C>modes</C>, <C>swatches</C>,{" "}
        <C>outputFormat</C>, <C>onChangeComplete</C>, <C>history</C>, <C>theme</C> and the rest.
      </>
    ),
  },
];

const HANDLE_ROWS: PropRow[] = [
  { name: "open", type: "() => void", description: "Open the popover." },
  { name: "close", type: "() => void", description: "Close the popover." },
  { name: "trigger", type: "HTMLButtonElement | null", description: "The trigger button element." },
];

const BASIC = `
import { ColorField } from "@orshot/colorshot/react";

<ColorField label="Fill" value={fill} onChange={setFill} gradientPresets history />
<ColorField label="Border" value={border} onChange={setBorder} modes={["solid"]} />
<ColorField label="Shadow" value={shadow} onChange={setShadow} modes={["solid"]} placeholder="No shadow" />
`;

const TRIGGER = `
<ColorField
  label="Text color"
  value={text}
  onChange={setText}
  modes={["solid"]}
  className="text-color-button"
  renderTrigger={({ value }) => (
    <span style={{ color: value, fontWeight: 700 }}>A</span>
  )}
/>
`;

const HANDLE = `
import { useRef } from "react";
import { ColorField, type ColorFieldHandle } from "@orshot/colorshot/react";

const field = useRef<ColorFieldHandle>(null);

<ColorField ref={field} label="Accent" value={accent} onChange={setAccent} />
<button onClick={() => field.current?.open()}>Pick accent</button>
`;

const CONTROLLED = `
const [open, setOpen] = useState(false);

<ColorField
  label="Background"
  value={bg}
  onChange={setBg}
  open={open}
  onOpenChange={setOpen}
  placement="right-start"
/>
`;

export function ColorFieldPage() {
  const { theme } = useTheme();
  const [fill, setFill] = useState("linear-gradient(135deg, #667eea 0%, #764ba2 100%)");
  const [border, setBorder] = useState("rgba(15, 23, 42, 0.6)");
  const [shadow, setShadow] = useState("");
  const [text, setText] = useState("#e11d48");
  const [accent, setAccent] = useState("oklch(0.65 0.2 265)");
  const [bg, setBg] = useState("#fde68a");
  const [open, setOpen] = useState(false);
  const field = useRef<ColorFieldHandle>(null);

  return (
    <>
      <PageHeader
        eyebrow="Components"
        title="ColorField"
        lead="A swatch button that opens the picker in a popover. Built for inspectors and forms, where a full picker takes too much room."
      />
      <Code code={`import { ColorField } from "@orshot/colorshot/react";`} />

      <Example code={BASIC}>
        <div className="field-stack">
          <label>
            <span>Fill</span>
            <ColorField theme={theme} label="Fill" value={fill} onChange={setFill} gradientPresets history />
          </label>
          <label>
            <span>Border</span>
            <ColorField theme={theme} label="Border" value={border} onChange={setBorder} modes={["solid"]} />
          </label>
          <label>
            <span>Shadow</span>
            <ColorField theme={theme} label="Shadow" value={shadow} onChange={setShadow} modes={["solid"]} placeholder="No shadow" />
          </label>
        </div>
      </Example>

      <H2>How it behaves</H2>
      <ul>
        <li>
          Click the trigger or press <kbd>↓</kbd> on it to open.
        </li>
        <li>
          <kbd>Esc</kbd> closes the popover and puts focus back on the trigger. A click outside or tabbing out also closes it.
        </li>
        <li>On open, focus moves to the first control in the picker.</li>
        <li>
          The popover picks a side once when it opens, flipping if there is no room. After that it only shifts, so it does not jump
          when it grows (switching to a gradient) or while the page scrolls.
        </li>
        <li>Drags keep tracking when the pointer leaves the popover, and a drag never closes it.</li>
        <li>
          The trigger shows hex for sRGB colors, the name for named colors, the value as written for wide gamut colors, and
          "Linear gradient" (or radial, conic) for gradients. Opacity below 100% shows as a percent.
        </li>
      </ul>

      <H2>Props</H2>
      <PropTable rows={FIELD_PROPS} />

      <H3>Ref</H3>
      <p>
        The ref gives you a <C>ColorFieldHandle</C>:
      </p>
      <PropTable rows={HANDLE_ROWS} label="Member" />

      <H2>Examples</H2>

      <H3>Custom trigger</H3>
      <p>
        Use <C>renderTrigger</C> for a toolbar button or any custom look. Style the button with <C>className</C>.
      </p>
      <Example code={TRIGGER}>
        <ColorField
          theme={theme}
          label="Text color"
          value={text}
          onChange={setText}
          modes={["solid"]}
          className="text-color-button"
          renderTrigger={({ value }) => <span style={{ color: value, fontWeight: 700, fontSize: 18 }}>A</span>}
        />
      </Example>

      <H3>Open from code</H3>
      <Example code={HANDLE}>
        <div className="demo-inline">
          <ColorField ref={field} theme={theme} label="Accent" value={accent} onChange={setAccent} />
          <button type="button" className="btn small" onClick={() => field.current?.open()}>
            Pick accent
          </button>
        </div>
      </Example>

      <H3>Controlled open state</H3>
      <Example code={CONTROLLED}>
        <div className="demo-inline">
          <ColorField theme={theme} label="Background" value={bg} onChange={setBg} open={open} onOpenChange={setOpen} placement="right-start" />
          <span className="muted">open: {String(open)}</span>
        </div>
      </Example>

      <H2>Styling the trigger</H2>
      <p>
        The trigger is a <C>button</C> with <C>data-colorshot-field</C> and <C>data-state="open" | "closed"</C>. Inside it are{" "}
        <C>[data-part="field-swatch"]</C>, <C>[data-part="field-text"]</C> and <C>[data-part="field-alpha"]</C>. It uses the same{" "}
        <C>--cs-*</C> variables as the picker, plus <C>--cs-field-font-size</C> (default <C>13px</C>). The popover is{" "}
        <C>[data-colorshot-popover]</C>.
      </p>
      <Code
        lang="css"
        code={`
[data-colorshot-field] {
  --cs-field-font-size: 12px;
  height: 28px;
  width: 100%;
}
`}
      />
      <Note>
        Using a ColorField inside a modal dialog? Pass the dialog element as <C>portal</C>. The popover then lives inside the
        dialog, so the dialog does not treat clicks in the picker as outside clicks.
      </Note>
    </>
  );
}
