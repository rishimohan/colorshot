import { useEffect, useRef } from "react";
import { createPicker, type PickerState } from "@orshot/colorshot";
import { C, Code, Install } from "../components/Code";
import { Example, H2, H3, Note, PageHeader, PropTable, type PropRow } from "../components/Docs";

const VANILLA = `
import { createPicker, type PickerState } from "@orshot/colorshot";

const swatch = document.querySelector<HTMLDivElement>("#swatch")!;
const hue = document.querySelector<HTMLInputElement>("#hue")!;
const alpha = document.querySelector<HTMLInputElement>("#alpha")!;
const output = document.querySelector<HTMLOutputElement>("#output")!;

const picker = createPicker({
  value: "oklch(0.7 0.15 250)",
  modes: ["solid", "linear", "conic"],
  onChangeComplete: (value) => console.log("save", value),
});

function render(state: PickerState) {
  swatch.style.background = state.value;
  output.textContent = state.value;
  hue.value = String(Math.round(state.hsva.h));
  alpha.value = String(Math.round(state.hsva.a * 100));
}
render(picker.getState());
picker.subscribe(render);

hue.addEventListener("input", () => picker.setHsva({ h: Number(hue.value) }));
alpha.addEventListener("input", () => picker.setHsva({ a: Number(alpha.value) / 100 }));
// "change" fires when the user lets go: commit once
hue.addEventListener("change", () => picker.commit());
alpha.addEventListener("change", () => picker.commit());

document.querySelector("#linear")!.addEventListener("click", () => {
  picker.setMode("linear");
  picker.commit();
});
`;

/** The sample above, running for real on plain DOM nodes. */
function VanillaDemo() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current!;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s)!;
    const swatch = $<HTMLDivElement>(".v-swatch-fill");
    const hue = $<HTMLInputElement>(".v-hue");
    const alpha = $<HTMLInputElement>(".v-alpha");
    const output = $<HTMLOutputElement>(".v-output");
    const log = $<HTMLSpanElement>(".v-log");
    const picker = createPicker({
      value: "oklch(0.7 0.15 250)",
      modes: ["solid", "linear", "conic"],
      onChangeComplete: (value) => (log.textContent = `onChangeComplete: ${value}`),
    });
    const render = (state: PickerState) => {
      swatch.style.background = state.value;
      output.textContent = state.value;
      hue.value = String(Math.round(state.hsva.h));
      alpha.value = String(Math.round(state.hsva.a * 100));
      el.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
    };
    render(picker.getState());
    const off = picker.subscribe(render);
    const onHue = () => picker.setHsva({ h: Number(hue.value) });
    const onAlpha = () => picker.setHsva({ a: Number(alpha.value) / 100 });
    const commit = () => picker.commit();
    const onMode = (e: Event) => {
      const mode = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-mode]")?.dataset.mode;
      if (mode === "solid" || mode === "linear" || mode === "conic") {
        picker.setMode(mode);
        picker.commit();
      }
    };
    hue.addEventListener("input", onHue);
    alpha.addEventListener("input", onAlpha);
    hue.addEventListener("change", commit);
    alpha.addEventListener("change", commit);
    el.addEventListener("click", onMode);
    return () => {
      off();
      hue.removeEventListener("input", onHue);
      alpha.removeEventListener("input", onAlpha);
      hue.removeEventListener("change", commit);
      alpha.removeEventListener("change", commit);
      el.removeEventListener("click", onMode);
    };
  }, []);
  return (
    <div className="vanilla" ref={root}>
      <div className="v-swatch checker">
        <div className="v-swatch-fill" />
      </div>
      <div className="v-controls">
        <label>
          <span>Hue</span>
          <input className="v-hue" type="range" min={0} max={360} defaultValue={0} />
        </label>
        <label>
          <span>Opacity</span>
          <input className="v-alpha" type="range" min={0} max={100} defaultValue={100} />
        </label>
        <div className="v-modes" role="group" aria-label="Mode">
          {["solid", "linear", "conic"].map((m) => (
            <button key={m} type="button" className="chip" data-mode={m}>
              {m}
            </button>
          ))}
        </div>
        <output className="v-output" />
        <span className="v-log muted">Move a slider, then let go.</span>
      </div>
    </div>
  );
}

const OPTION_ROWS: PropRow[] = [
  { name: "value", type: "string", description: "Starting CSS value." },
  { name: "modes", type: "readonly PickerMode[]", default: "ALL_MODES", description: "Allowed modes." },
  { name: "outputFormat", type: "OutputFormat", default: '"preserve"', description: "How colors are written." },
  { name: "defaultColor", type: "string", default: '"#000000"', description: "Used for empty or unreadable values, and when switching to solid with no earlier color." },
  { name: "defaultGradient", type: "string", description: "Used when switching to a gradient with no earlier gradient." },
  { name: "onChange", type: "(value: string) => void", description: "Fires on every change." },
  { name: "onChangeComplete", type: "(value: string) => void", description: "Fires on commit(), undo() and redo(), once per change." },
  { name: "history", type: "boolean | { limit?: number }", default: "false", description: "Keep an undo stack of committed values. true keeps 100." },
];

const STORE_ROWS: PropRow[] = [
  { name: "getState()", type: "PickerState", description: "The current state: value, mode, hsva, color, gradient, stops and more." },
  { name: "subscribe(listener)", type: "() => void", description: "Calls listener(state) after every change. Returns an unsubscribe function." },
  { name: "setOptions(options)", type: "void", description: "Replace all options. Use it to update callbacks." },
  { name: "modes", type: "readonly PickerMode[]", description: "The allowed modes (getter)." },
  { name: "setValue(value)", type: "void", description: "Sync from outside, like a controlled prop. Does not call onChange." },
  { name: "setHsva(patch)", type: "void", description: "Set hue, saturation, value or alpha of the edited color." },
  { name: "setColor(color, { keepAlpha? })", type: "void", description: "Set the edited color from a Color in any space." },
  { name: "setCss(css)", type: "boolean", description: "Apply CSS text. A gradient replaces the value; a color sets the edited color. False if unusable." },
  { name: "applySwatch(css)", type: "boolean", description: "setCss, then commit." },
  { name: "setMode(mode)", type: "void", description: "Switch between solid and gradient types. The edited color carries over." },
  { name: "selectStop(id)", type: "void", description: "Select a gradient stop to edit." },
  { name: "addStop(t, color?)", type: "string | null", description: "Add a stop at t (0-1). Takes the color at that point unless given. Returns its id." },
  { name: "moveStop(id, t)", type: "void", description: "Move a stop to t (0-1)." },
  { name: "removeStop(id?)", type: "void", description: "Remove a stop, the selected one by default. Keeps at least two." },
  { name: "reverse()", type: "void", description: "Reverse the stops." },
  { name: "setAngle(deg)", type: "void", description: "Linear angle or conic start angle." },
  { name: "setShape(shape)", type: "void", description: 'Radial "circle" or "ellipse".' },
  { name: "setSize(size)", type: "void", description: "Radial size such as farthest-corner. null removes it." },
  { name: "setCenter(x, y)", type: "void", description: "Radial or conic center, in percent." },
  { name: "setRepeating(repeating)", type: "void", description: "Toggle repeating-*-gradient." },
  { name: "setInterpolation(value)", type: "void", description: 'Set the "in oklch" part, or null to remove it.' },
  { name: "commit()", type: "void", description: "End of an interaction. Fires onChangeComplete if the value changed, and records an undo step." },
  { name: "undo() / redo()", type: "boolean", description: "Step through committed values. Needs history. False when there is nothing to do." },
  { name: "canUndo / canRedo", type: "boolean", description: "Getters." },
];

const COLOR_FNS: PropRow[] = [
  { name: "parseColor(input)", type: "ParsedColor | null", description: "Parse any CSS color. Returns the Color, its format and style, or null." },
  { name: "formatColor(color, format, style?)", type: "string", description: "Write a Color in a format. sRGB formats are gamut mapped." },
  { name: "convert(color, space)", type: "Color", description: "Convert between color spaces." },
  { name: "inGamut(color, space?)", type: "boolean", description: "True when the color fits the space (sRGB by default)." },
  { name: "toGamut(color, space?)", type: "Color", description: "CSS Color 4 gamut mapping into the space." },
  { name: "toHexDigits(color)", type: "string", description: 'Six uppercase hex digits, no "#", alpha dropped.' },
  { name: "toSrgb(color)", type: "[number, number, number]", description: "sRGB channels 0-1, gamut mapped." },
  { name: "colorKey(input)", type: "string", description: "A key for comparing colors however they are written." },
  { name: "hsvToRgb(h, s, v) / rgbToHsv(rgb)", type: "[number, number, number]", description: "HSV conversion. RGB 0-1." },
  { name: "contrastRatio(fg, bg)", type: "number | null", description: "WCAG 2 ratio, 1 to 21. Gradients use their weakest stop." },
  { name: "contrastLevel(ratio)", type: '"AAA" | "AA" | "AA Large" | "Fail"', description: "WCAG level for normal text." },
  { name: "luminance(color)", type: "number", description: "WCAG relative luminance." },
];

const GRADIENT_FNS: PropRow[] = [
  { name: "isGradient(value)", type: "boolean", description: "True when the value contains a CSS gradient." },
  { name: "parseLayers(value) / serializeLayers(layers)", type: "Layer[] / string", description: "Split a background value into layers and join it back. Untouched layers keep their text." },
  { name: "parseGradient(input) / serializeGradient(g)", type: "Gradient | null / string", description: "One gradient to a model and back." },
  { name: "getStops(g)", type: "GradientStop[]", description: "The color stops, without hints." },
  { name: "stopOffsets(g)", type: "number[]", description: "Stop positions 0-1, with missing ones filled in." },
  { name: "gradientAngle(g)", type: "number", description: "Angle in degrees, also for to-side directions." },
  { name: "gradientCenter(g)", type: "{ x, y } | null", description: "Radial or conic center in percent. null when it uses px or other units the UI cannot map." },
  { name: "colorAt(g, t)", type: "Color | null", description: "The color at position t (0-1)." },
  { name: "stopsPreview(g)", type: "string", description: "A 90deg linear gradient of the stops, for drawing a bar." },
  { name: "gradientHandles(value, w, h)", type: "GradientHandles | null", description: "On-canvas handle positions for an element of that size." },
  { name: "moveGradientHandle(value, id, x, y, w, h, { snap? })", type: "string", description: "The new value after dragging a handle." },
];

const HELPERS = `
import { parseColor, formatColor, contrastRatio, contrastLevel, colorKey } from "@orshot/colorshot";

const p = parseColor("#3b82f6")!;
formatColor(p.color, "oklch"); // "oklch(0.6231 0.188 259.81)"
formatColor(p.color, "rgb", { legacy: false }); // "rgb(59 130 246)"

const ratio = contrastRatio("#3b82f6", "#ffffff"); // 3.68
contrastLevel(ratio!); // "AA Large"

colorKey("#ff0000") === colorKey("rgb(255 0 0)"); // true
`;

export function CorePage() {
  return (
    <>
      <PageHeader
        eyebrow="More"
        title="Core API"
        lead="@orshot/colorshot is the logic behind every binding: color math, the CSS parser and the picker state. Plain TypeScript, no dependencies, no DOM required."
      />
      <Install pkg="@orshot/colorshot" />
      <p>
        You need it directly when you build a binding for another framework, drive a picker from your own UI, or only want the parser.
        In React, everything here is also exported from <C>@orshot/colorshot/react</C>.
      </p>

      <H2>createPicker</H2>
      <p>
        A picker store holds the state and does every edit. You render it however you like and call its actions. The live demo below
        is the same code, running on plain DOM elements.
      </p>
      <Example code={VANILLA} lang="ts">
        <VanillaDemo />
      </Example>
      <H3>Options</H3>
      <PropTable rows={OPTION_ROWS} label="Option" />
      <H3 id="store-actions">Store actions</H3>
      <PropTable rows={STORE_ROWS} label="Member" />
      <Note>
        Call <C>commit()</C> at the end of each interaction: pointer up, Enter in a field, a click. It is what fires{" "}
        <C>onChangeComplete</C> and what undo steps through.
      </Note>

      <H2>Color functions</H2>
      <PropTable rows={COLOR_FNS} label="Function" />
      <Code code={HELPERS} lang="ts" />

      <H2>Gradient functions</H2>
      <PropTable rows={GRADIENT_FNS} label="Function" />

      <H2>Types</H2>
      <p>
        Exported types: <C>Color</C>, <C>ColorSpace</C>, <C>Coords</C>, <C>ColorFormat</C>, <C>FormatStyle</C>, <C>ParsedColor</C>,{" "}
        <C>Hsva</C>, <C>Gradient</C>, <C>GradientItem</C>, <C>GradientStop</C>, <C>GradientHint</C>, <C>GradientType</C>,{" "}
        <C>Layer</C>, <C>Position</C>, <C>PickerMode</C>, <C>PickerOptions</C>, <C>PickerState</C>, <C>OutputFormat</C>,{" "}
        <C>GradientHandle</C>, <C>GradientHandleKind</C>, <C>GradientHandles</C>. Also <C>PickerStore</C> (the class),{" "}
        <C>ALL_MODES</C>, <C>splitTopLevel</C> and <C>num</C>.
      </p>
      <Code
        lang="ts"
        code={`
interface Color {
  space: ColorSpace; // "srgb" | "display-p3" | "oklch" | "lab" | ...
  coords: [number, number, number]; // CSS reference ranges. NaN means "none"
  alpha: number; // 0..1
}
`}
      />
    </>
  );
}
