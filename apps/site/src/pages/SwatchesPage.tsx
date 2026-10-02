import { useState } from "react";
import { Link } from "react-router-dom";
import { ColorPicker, DEFAULT_GRADIENTS, DEFAULT_PALETTE, type Swatch } from "@orshot/colorshot/react";
import { C, Code } from "../components/Code";
import { Example, H2, H3, Note, PageHeader, PropTable, type PropRow } from "../components/Docs";
import { useTheme } from "../lib/theme";

const GROUP_ROWS: PropRow[] = [
  { name: "id", type: "string", description: "Required. Unique within the picker. Also used as the tab name when there is no label." },
  { name: "label", type: "ReactNode", description: "Tab text, or the heading in the stack layout." },
  {
    name: "colors",
    type: '(string | Swatch)[] | "default"',
    description: (
      <>
        Colors or gradients. A <C>Swatch</C> is <C>{"{ value: string; label?: string; id?: string }"}</C>. <C>"default"</C> uses the
        built-in palette.
      </>
    ),
  },
  {
    name: "recent",
    type: "boolean",
    description: "Let Colorshot fill this group with recent colors. Stored under the root storageKey.",
  },
  { name: "onAdd", type: "(value: string) => void", description: "Shows a + button that saves the current value." },
  {
    name: "onRemove",
    type: "(swatch: Swatch) => void",
    description: "Shows a remove button on hover, and Delete removes a focused swatch.",
  },
  { name: "onReorder", type: "(swatches: Swatch[]) => void", description: "Drag swatches to reorder. Called with the new order." },
  { name: "onRename", type: "(swatch: Swatch, label: string) => void", description: "Double-click or F2 renames a swatch." },
  { name: "limit", type: "number", description: 'Show at most this many, with a "Show all" toggle. Stack layout only.' },
  { name: "showIn", type: '"solid" | "gradient"', description: "Only show the group in solid mode, or only in gradient modes." },
  {
    name: "renderSwatch",
    type: "(swatch: Swatch, state: { selected: boolean }) => ReactNode",
    description: "Custom content inside each swatch button, such as a lock icon or a name.",
  },
  { name: "emptyText", type: "ReactNode", description: "Text when the group is empty. Defaults to a hint about the + button." },
];

const FULL = `
const [saved, setSaved] = useState<Swatch[]>([
  { id: "1", value: "#3E5CEB", label: "Primary" },
  { id: "2", value: "#F97316", label: "Accent" },
]);

<ColorPicker
  value={value}
  onChange={setValue}
  swatchSearch
  swatches={[
    {
      id: "brand",
      label: "Brand",
      colors: [
        { value: "#0f172a", label: "Ink" },
        { value: "#3E5CEB", label: "Blue" },
        { value: "#F97316", label: "Orange" },
        { value: "#FDE68A", label: "Sand" },
      ],
    },
    {
      id: "saved",
      label: "Saved",
      colors: saved,
      onAdd: (value) => setSaved((s) => [...s, { id: crypto.randomUUID(), value }]),
      onRemove: (swatch) => setSaved((s) => s.filter((x) => x.id !== swatch.id)),
      onReorder: setSaved,
      onRename: (swatch, label) =>
        setSaved((s) => s.map((x) => (x.id === swatch.id ? { ...x, label } : x))),
    },
    { id: "recent", label: "Recent", recent: true },
    { id: "presets", label: "Presets", colors: "default" },
  ]}
/>
`;

const STACK = `
<ColorPicker
  value={value}
  onChange={setValue}
  swatchLayout="stack"
  gradientPresets
  swatches={[
    { id: "document", label: "In this design", colors: documentColors },
    { id: "presets", label: "Presets", colors: "default", limit: 8 },
  ]}
/>
`;

const RENDER = `
<ColorPicker
  value={value}
  onChange={setValue}
  swatches={[
    {
      id: "brand",
      label: "Brand",
      colors: brandColors,
      renderSwatch: (swatch, { selected }) => (selected ? <span aria-hidden>✓</span> : null),
    },
  ]}
/>
`;

const PRESETS = `
import { DEFAULT_GRADIENTS, DEFAULT_PALETTE } from "@orshot/colorshot/react";

// gradient presets: true for the built-in set, or your own
<ColorPicker gradientPresets={[...DEFAULT_GRADIENTS, "linear-gradient(90deg, #000, #fff)"]} />

// same as colors: "default"
{ id: "presets", label: "Presets", colors: DEFAULT_PALETTE }
`;

const BRAND = [
  { value: "#0f172a", label: "Ink" },
  { value: "#3E5CEB", label: "Blue" },
  { value: "#F97316", label: "Orange" },
  { value: "#FDE68A", label: "Sand" },
];

let nextId = 3;

export function SwatchesPage() {
  const { theme } = useTheme();
  const [value, setValue] = useState("#3E5CEB");
  const [saved, setSaved] = useState<Swatch[]>([
    { id: "1", value: "#3E5CEB", label: "Primary" },
    { id: "2", value: "#F97316", label: "Accent" },
  ]);
  const [stack, setStack] = useState("linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)");

  return (
    <>
      <PageHeader
        eyebrow="Features"
        title="Swatches"
        lead="Swatch groups you fill: brand colors, saved colors, colors from the document, recent colors and presets. There is no cap on how many."
      />

      <H2>Groups</H2>
      <p>
        Pass groups to <C>swatches</C>. With two or more groups they show as tabs. The active tab is remembered. Try the + button in
        Saved, drag swatches to reorder them, double-click one to rename it, and use the search button to find a color by name or hex.
      </p>
      <Example code={FULL}>
        <ColorPicker
          theme={theme}
          value={value}
          onChange={setValue}
          swatchSearch
          swatches={[
            { id: "brand", label: "Brand", colors: BRAND },
            {
              id: "saved",
              label: "Saved",
              colors: saved,
              onAdd: (v) => setSaved((s) => [...s, { id: String(nextId++), value: v }]),
              onRemove: (sw) => setSaved((s) => s.filter((x) => x.id !== sw.id)),
              onReorder: setSaved,
              onRename: (sw, label) => setSaved((s) => s.map((x) => (x.id === sw.id ? { ...x, label } : x))),
            },
            { id: "recent", label: "Recent", recent: true },
            { id: "presets", label: "Presets", colors: "default" },
          ]}
        />
      </Example>

      <H2>Group options</H2>
      <PropTable rows={GROUP_ROWS} label="Field" />

      <H2>How swatches behave</H2>
      <ul>
        <li>Clicking a solid swatch sets the color. In a gradient mode it recolors the selected stop.</li>
        <li>Clicking a gradient swatch replaces the whole value.</li>
        <li>
          Gradient swatches are hidden when the picker does not allow that gradient type. A <C>modes={'{["solid"]}'}</C> field never
          shows gradients.
        </li>
        <li>Drag a solid swatch onto the gradient bar to add it as a stop.</li>
        <li>The selected swatch is matched by color, not by text, so #ff0000 and rgb(255 0 0) are the same swatch.</li>
        <li>Empty groups are hidden, unless they have an onAdd button.</li>
      </ul>

      <H3>Recent colors</H3>
      <p>
        A group with <C>recent: true</C> fills itself. Every committed value (the same moment <C>onChangeComplete</C> fires) goes to
        the front. It keeps 16 colors and drops duplicates written in other formats. They are saved in localStorage under{" "}
        <C>storageKey</C>, so pickers with the same key share them. Pass <C>storageKey={"{null}"}</C> to keep them in memory.
      </p>

      <H3>Search</H3>
      <p>
        <C>swatchSearch</C> adds a search button next to the group tabs. It opens a search box that matches the label, the CSS value,
        or the start of the hex code, across every group. <kbd>Esc</kbd> or the close button clears and closes it.
      </p>

      <H2>Stack layout, limits and gradient presets</H2>
      <p>
        <C>swatchLayout="stack"</C> lists every group with its heading. <C>limit</C> shows the first few with a "Show all" toggle.{" "}
        <C>gradientPresets</C> adds a Gradients group that only shows in gradient modes.
      </p>
      <Example code={STACK}>
        <ColorPicker
          theme={theme}
          value={stack}
          onChange={setStack}
          swatchLayout="stack"
          gradientPresets
          swatches={[
            { id: "document", label: "In this design", colors: ["#111827", "#f9fafb", "#10b981", "#f59e0b"] },
            { id: "presets", label: "Presets", colors: "default", limit: 8 },
          ]}
        />
      </Example>

      <H3>Built-in presets</H3>
      <p>
        <C>DEFAULT_PALETTE</C> has {DEFAULT_PALETTE.length} colors. <C>DEFAULT_GRADIENTS</C> has {DEFAULT_GRADIENTS.length} gradients:
        linear, radial and conic.
      </p>
      <div className="preset-strip" aria-hidden>
        {DEFAULT_PALETTE.map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </div>
      <div className="preset-strip grads" aria-hidden>
        {DEFAULT_GRADIENTS.map((g) => (
          <span key={g} style={{ background: g }} />
        ))}
      </div>
      <Code code={PRESETS} />

      <H3>Custom swatch content</H3>
      <Code code={RENDER} />

      <H2>Keyboard</H2>
      <ul>
        <li>
          Each group is one tab stop. <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> move between swatches, <kbd>Home</kbd> and{" "}
          <kbd>End</kbd> jump to the ends.
        </li>
        <li>
          <kbd>Enter</kbd> or <kbd>Space</kbd> applies the focused swatch.
        </li>
        <li>
          <kbd>Delete</kbd> or <kbd>Backspace</kbd> removes it, when the group has <C>onRemove</C>.
        </li>
        <li>
          <kbd>F2</kbd> renames it, when the group has <C>onRename</C>. <kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels.
        </li>
        <li>
          In the tab list, <kbd>←</kbd> and <kbd>→</kbd> switch groups.
        </li>
      </ul>
      <Note>
        Swatch styles use <C>--cs-swatch-columns</C> (default 8) for the grid. See <Link to="/docs/theming">Theming</Link>.
      </Note>
    </>
  );
}
