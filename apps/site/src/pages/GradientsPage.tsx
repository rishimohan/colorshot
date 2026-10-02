import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ColorPicker, gradientHandles, moveGradientHandle, parseGradient, parseLayers, serializeLayers, getStops } from "@orshot/colorshot/react";
import { C, Code } from "../components/Code";
import { Example, H2, H3, Note, PageHeader, Table, ValueReadout } from "../components/Docs";
import { useTheme } from "../lib/theme";

const MODES = `
<ColorPicker
  value={value}
  onChange={setValue}
  modes={["solid", "linear", "radial", "conic"]} // the default
  defaultGradient="linear-gradient(90deg, #3E5CEB 0%, #F97316 100%)"
/>
`;

const HANDLES = `
import { gradientHandles, moveGradientHandle } from "@orshot/colorshot";

interface Props {
  value: string;
  onChange: (value: string) => void;
  width: number;
  height: number;
}

function GradientBox({ value, onChange, width, height }: Props) {
  const h = gradientHandles(value, width, height); // null for solid colors

  const drag = (id: string) => (e: React.PointerEvent) => {
    const box = e.currentTarget.parentElement!.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      onChange(moveGradientHandle(value, id, ev.clientX - box.left, ev.clientY - box.top, width, height, { snap: ev.shiftKey }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div style={{ position: "relative", width, height, background: value }}>
      {h?.line && (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <line x1={h.line.x1} y1={h.line.y1} x2={h.line.x2} y2={h.line.y2} stroke="white" />
        </svg>
      )}
      {h?.handles.map((handle) => (
        <span
          key={handle.id}
          className="handle"
          data-kind={handle.kind}
          style={{ left: handle.x, top: handle.y, background: handle.color }}
          onPointerDown={drag(handle.id)}
        />
      ))}
    </div>
  );
}
`;

const ROUND_TRIP_SAMPLES = [
  "linear-gradient(to right, #ff0000, oklch(0.7 0.15 250) 80%)",
  "repeating-radial-gradient(ellipse 120px 80px at 20% 30%, #fde68a 0 10px, #f97316 10px 20px)",
  "conic-gradient(from 0.25turn at 40% 60%, red, 30%, blue, red)",
  "linear-gradient(in oklch longer hue, #f00 0%, #00f 100%), url(texture.png)",
  "-webkit-linear-gradient(top, rgba(0,0,0,.6), transparent)",
];

function RoundTrip() {
  const [text, setText] = useState(ROUND_TRIP_SAMPLES[0]);
  const layers = parseLayers(text);
  const first = layers.find((l) => l.kind === "gradient");
  const g = first ? parseGradient(first.raw) : null;
  const out = serializeLayers(layers);
  const same = out === text;
  return (
    <div className="roundtrip">
      <label htmlFor="rt-input" className="readout-label">
        Paste a CSS gradient
      </label>
      <textarea id="rt-input" value={text} onChange={(e) => setText(e.target.value)} rows={2} spellCheck={false} />
      <div className="sample-chips">
        {ROUND_TRIP_SAMPLES.map((s, i) => (
          <button key={s} type="button" className="chip" onClick={() => setText(s)}>
            Sample {i + 1}
          </button>
        ))}
      </div>
      <div className="roundtrip-result">
        <span className="checker roundtrip-swatch">
          <span style={{ background: text }} />
        </span>
        <div>
          <p>
            {g ? (
              <>
                <strong>{g.repeating ? "Repeating " : ""}{g.type}</strong> gradient, {getStops(g).length} stops, {layers.length}{" "}
                {layers.length === 1 ? "layer" : "layers"}
              </>
            ) : (
              <strong>Not a gradient the picker can edit</strong>
            )}
          </p>
          <p className={same ? "ok" : "warn"}>{same ? "Serialized back byte for byte." : "Output differs from the input."}</p>
        </div>
      </div>
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function HandlesDemo() {
  const { theme } = useTheme();
  const [value, setValue] = useState("linear-gradient(120deg, #3E5CEB 0%, #F97316 60%, #FDE68A 100%)");
  const [wrap, wrapWidth] = useWidth<HTMLDivElement>();
  const width = Math.max(200, Math.min(420, wrapWidth));
  const height = Math.round(width * 0.62);
  const h = gradientHandles(value, width, height);

  const drag = (id: string) => (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const box = e.currentTarget.parentElement!.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      setValue((v) => moveGradientHandle(v, id, ev.clientX - box.left, ev.clientY - box.top, width, height, { snap: ev.shiftKey }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="handles-demo">
      <div className="handles-col" ref={wrap}>
        <div className="handles-box checker" style={{ width, height }}>
          <div className="handles-fill" style={{ background: value }} />
          {h?.line && (
            <svg className="handles-line" width={width} height={height} aria-hidden>
              <line x1={h.line.x1} y1={h.line.y1} x2={h.line.x2} y2={h.line.y2} />
            </svg>
          )}
          {h?.handles.map((hd) => (
            <span
              key={hd.id}
              className="handle"
              data-kind={hd.kind}
              style={{ left: hd.x, top: hd.y, background: hd.color }}
              onPointerDown={drag(hd.id)}
              aria-hidden
            />
          ))}
        </div>
        <ValueReadout value={value} />
      </div>
      <ColorPicker theme={theme} value={value} onChange={setValue} modes={["linear", "radial", "conic"]} />
    </div>
  );
}

export function GradientsPage() {
  const { theme } = useTheme();
  const [value, setValue] = useState("linear-gradient(90deg, #3E5CEB 0%, #a855f7 50%, #F97316 100%)");
  return (
    <>
      <PageHeader
        eyebrow="Features"
        title="Gradients"
        lead="Linear, radial and conic gradients with draggable stops. The picker reads real-world CSS and writes back only what you changed."
      />

      <Example code={MODES}>
        <div className="demo-col">
          <div className="gradient-preview checker">
            <span style={{ background: value }} />
          </div>
          <ColorPicker theme={theme} value={value} onChange={setValue} gradientPresets />
          <ValueReadout value={value} />
        </div>
      </Example>

      <H2>Modes</H2>
      <ul>
        <li>
          The mode tabs switch between Solid, Linear, Radial and Conic. Limit them with <C>modes</C>.
        </li>
        <li>Switching between gradient types keeps the stops and the angle.</li>
        <li>Solid to gradient: the solid color becomes the selected stop. If there was an earlier gradient, its other stops come back.</li>
        <li>Gradient to solid: the selected stop's color becomes the solid color.</li>
        <li>
          With no earlier gradient, the picker uses <C>defaultGradient</C>, or builds a 90deg gradient from the current color to white
          (black for light colors).
        </li>
      </ul>

      <H2>Stops</H2>
      <Table
        head={["Action", "What it does"]}
        rows={[
          ["Click the bar", "Adds a stop with the color at that point."],
          ["Drag a stop", "Moves it. The point you grabbed stays under the pointer."],
          [
            <>
              <kbd>Alt</kbd> / <kbd>Option</kbd> + drag a stop
            </>,
            "Duplicates the stop and drags the copy, like Figma.",
          ],
          ["Drag a stop away from the bar", "Removes it when you let go. A gradient keeps at least two stops."],
          ["Drag a solid swatch onto the bar", "Adds the swatch color as a new stop where you drop it."],
          ["Two-finger swipe over a stop", "Moves it, on a trackpad."],
          [
            <>
              <kbd>←</kbd> <kbd>→</kbd>
            </>,
            "Moves the focused stop by 1%. Hold Shift for 10%.",
          ],
          [
            <>
              <kbd>Home</kbd> <kbd>End</kbd>
            </>,
            "Moves the focused stop to 0% or 100%.",
          ],
          [
            <>
              <kbd>Delete</kbd> <kbd>Backspace</kbd>
            </>,
            "Removes the focused stop.",
          ],
        ]}
      />
      <p>
        Only the selected stop is in the tab order. Focusing a stop selects it, and the area, sliders and inputs edit the selected stop.
      </p>

      <H2>Angle, shape and center</H2>
      <ul>
        <li>
          <strong>Linear and conic:</strong> drag around the angle dial, or type in the degree field. Hold <kbd>Shift</kbd> while
          dragging to snap to 15°. On the focused dial, arrows step 1° and Shift + arrows 15°. A two-finger swipe over the dial turns it.
        </li>
        <li>
          <strong>Radial:</strong> choose circle or ellipse. The size (far corner, far side, near corner, near side) is in the options
          menu.
        </li>
        <li>
          The ⇄ button reverses the stops.
        </li>
        <li>
          <strong>Radial and conic:</strong> drag the dot in the center pad to move the center. Shift snaps to 25% steps. Arrows move it
          1%, Shift + arrows 10%.
        </li>
      </ul>

      <H3>Options menu</H3>
      <p>The ⋯ button holds the less common settings:</p>
      <ul>
        <li>
          <strong>Blend colors in:</strong> sRGB, OKLab, OKLCH, OKLCH long hue, Linear RGB, Lab, LCH, HSL, HSL long hue. Writes the{" "}
          <C>in oklch</C> part of the gradient. Hide it with <C>interpolation={"{false}"}</C>.
        </li>
        <li>
          <strong>Size</strong> (radial only).
        </li>
        <li>
          <strong>Repeat:</strong> turns <C>linear-gradient</C> into <C>repeating-linear-gradient</C> and back.
        </li>
        <li>
          <strong>Center it</strong> (radial and conic): moves the center back to the middle.
        </li>
        <li>
          <strong>Remove stop:</strong> removes the selected stop. Disabled at two stops.
        </li>
      </ul>

      <H2>Round trip</H2>
      <p>The parser never throws. It keeps what it does not need to change, exactly as written:</p>
      <ul>
        <li>
          Directions like <C>to right</C>, and angles in <C>turn</C>, <C>rad</C> or <C>grad</C>, until you change the angle.
        </li>
        <li>px and em stops, two-position stops, color hints, and stops without a position.</li>
        <li>
          <C>in oklch</C> and other interpolation hints, vendor prefixes, and syntax it does not know.
        </li>
        <li>Multiple layers. The picker edits the first gradient and keeps the rest, including images.</li>
        <li>Each stop color in its own format, unless you set an outputFormat.</li>
      </ul>
      <RoundTrip />
      <Note>
        When a value cannot be read at all (a <C>var()</C>, a broken string), the picker shows a short notice and keeps the value. The
        first edit replaces it.
      </Note>

      <H2>On-canvas handles</H2>
      <p>
        Editors often let you drag a gradient right on the canvas. Core has two functions for that, with no framework needed:
      </p>
      <ul>
        <li>
          <C>gradientHandles(value, width, height)</C> returns where to draw the handles on an element of that size: start, end and stops
          for linear, the center for radial, center and angle for conic. Linear gradients also get the gradient line.
        </li>
        <li>
          <C>moveGradientHandle(value, id, x, y, width, height, {"{ snap }"})</C> returns the new CSS value after a handle is dragged to
          x, y. Other layers and untouched parts are kept. <C>snap</C> rounds angles to 15° and centers to 5%.
        </li>
      </ul>
      <p>Drag the handles, or edit the same value in the picker. Hold Shift to snap.</p>
      <HandlesDemo />
      <Code code={HANDLES} />
    </>
  );
}
