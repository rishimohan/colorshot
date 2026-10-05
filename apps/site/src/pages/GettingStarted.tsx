import { useState } from "react";
import { Link } from "react-router-dom";
import { ColorPicker } from "@orshot/colorshot/react";
import { C, Code, Install } from "../components/Code";
import { Example, H2, Note, PageHeader, ValueReadout } from "../components/Docs";
import { useTheme } from "../lib/theme";

const BASIC = `
import { useState } from "react";
import { ColorPicker } from "@orshot/colorshot/react";
import "@orshot/colorshot/styles.css";

export function FillPicker() {
  const [value, setValue] = useState("#3E5CEB");
  return <ColorPicker value={value} onChange={setValue} />;
}
`;

const COMMIT = `
<ColorPicker
  value={value}
  onChange={setValue} // live preview while dragging
  onChangeComplete={(v) => saveToHistory(v)} // once per drag, click or typed value
/>
`;

const SOLID = `<ColorPicker value={border} onChange={setBorder} modes={["solid"]} />`;

const UNCONTROLLED = `<ColorPicker defaultValue="#22c55e" onChangeComplete={save} />`;

export function GettingStarted() {
  const { theme } = useTheme();
  const [value, setValue] = useState("#3E5CEB");
  const [done, setDone] = useState("#3E5CEB");
  const [log, setLog] = useState<string[]>([]);
  return (
    <>
      <PageHeader
        eyebrow="Start"
        title="Getting started"
        lead="Install the React package, import the stylesheet once, and render a picker. The value is always a CSS string."
      />

      <H2>Install</H2>
      <Install pkg="@orshot/colorshot" />
      <p>
        One package for React and Vue: import components from <C>@orshot/colorshot/react</C>, and your app only bundles that
        entry. React 18 or 19 is an optional peer dependency. The React entry also re-exports the common helpers (
        <C>parseColor</C>, <C>formatColor</C>, <C>isSafeCssValue</C>...). It is marked <C>"use client"</C>: in Next.js server
        components, import helpers from <C>@orshot/colorshot</C> itself instead, and use{" "}
        <C>ColorPicker</C>, <C>ColorField</C> and <C>Picker.*</C> parts from client components.
      </p>

      <H2>Import the styles</H2>
      <p>Import the CSS once, near the root of your app. It is plain CSS with no build step and no Tailwind needed.</p>
      <Code code={`import "@orshot/colorshot/styles.css";`} />
      <p>
        CSS resets such as Tailwind's preflight cannot restyle the picker, whichever stylesheet loads first, and your own CSS
        sets the <C>--cs-*</C> variables without <C>!important</C>. See{" "}
        <Link to="/docs/theming">Theming</Link>.
      </p>

      <H2>Render a picker</H2>
      <Example code={BASIC}>
        <div className="demo-col">
          <ColorPicker theme={theme} value={value} onChange={setValue} />
          <ValueReadout value={value} />
        </div>
      </Example>
      <p>
        The value goes in as any CSS color or gradient and comes out as a CSS string. Paste <C>oklch(0.7 0.15 250)</C>,{" "}
        <C>rgba(0, 0, 0, 0.5)</C> or <C>conic-gradient(...)</C> into the hex field and it is applied as written.
      </p>

      <H2>Live changes and committed changes</H2>
      <p>
        <C>onChange</C> fires while the user drags or types, at most once per frame. <C>onChangeComplete</C> fires once when the
        interaction ends: pointer up, a committed input, a swatch click. Use it for saving and undo history.
      </p>
      <Example code={COMMIT}>
        <div className="demo-col">
          <ColorPicker
            theme={theme}
            value={done}
            onChange={setDone}
            onChangeComplete={(v) => setLog((l) => [v, ...l].slice(0, 4))}
            eyeDropper={false}
          />
          <div className="event-log" aria-live="polite">
            <span className="readout-label">onChangeComplete</span>
            {log.length === 0 ? <span className="muted">Drag the area, then let go.</span> : log.map((v, i) => <code key={i}>{v}</code>)}
          </div>
        </div>
      </Example>

      <H2>Solid colors only</H2>
      <p>
        Fields that can only hold a solid color, like a border or a shadow, pass <C>modes</C>. The mode tabs hide when only one
        mode is left, and gradient swatches are filtered out.
      </p>
      <Code code={SOLID} />

      <H2>Uncontrolled</H2>
      <p>
        Leave out <C>value</C> and pass <C>defaultValue</C> if you only need to read the result.
      </p>
      <Code code={UNCONTROLLED} />

      <Note>
        The components use hooks and browser APIs. In the Next.js App Router, render them from a file that starts with{" "}
        <C>"use client"</C>.
      </Note>

      <H2>Next steps</H2>
      <ul className="link-list">
        <li>
          <Link to="/docs/color-picker">ColorPicker</Link>: every prop, with live examples.
        </li>
        <li>
          <Link to="/docs/color-field">ColorField</Link>: the picker in a popover behind a swatch button.
        </li>
        <li>
          <Link to="/docs/swatches">Swatches</Link>: brand, saved and recent colors.
        </li>
        <li>
          <Link to="/docs/gradients">Gradients</Link>: stops, angles, centers and on-canvas handles.
        </li>
      </ul>
    </>
  );
}
