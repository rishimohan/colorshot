import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ColorField,
  ColorPicker,
  Picker,
  gradientHandles,
  isGradient,
  moveGradientHandle,
  type OutputFormat,
  type Swatch,
} from "@orshot/colorshot/react";

type Theme = "system" | "light" | "dark";

const MESSY_VALUES: [string, string][] = [
  ["Hex", "#3E5CEB"],
  ["rgba", "rgba(34, 197, 94, 0.6)"],
  ["OKLCH (wide gamut)", "oklch(0.72 0.31 145)"],
  ["Display P3", "color(display-p3 1 0.2 0.4)"],
  ["Named", "rebeccapurple"],
  ["Transparent", "transparent"],
  ["Linear, to bottom, no positions", "linear-gradient(to bottom, rgba(35, 38, 45, 0.85), rgba(25, 28, 35, 0.95))"],
  ["Linear in OKLCH long hue", "linear-gradient(in oklch longer hue 90deg, oklch(0.7 0.2 30), oklch(0.7 0.2 270))"],
  ["Hard stops", "linear-gradient(165deg, #083E33 0%, #0F5746 58%, #EFF5F1 58.2%, #FAF7EF 100%)"],
  ["Radial, two-value size", "radial-gradient(ellipse 66% 110% at 101% -8%, rgb(67,150,232) 0%, rgba(80,136,199,1) 36%, rgba(121,175,222,0.70) 82%, rgba(205,229,248,0) 99%)"],
  ["Radial, px size", "radial-gradient(circle 302px at 905px 183px, #D95A47 99%, transparent 100%)"],
  ["Conic (Figma import)", "conic-gradient(from 0deg, rgb(0, 0, 0) 0.4%, rgb(16, 18, 21) 9.08%, rgb(29, 70, 114) 24.97%)"],
  ["Two layers", "radial-gradient(circle at 8% 18%, #ffd400 0%, #ff7a00 18%, transparent 38%), radial-gradient(circle at 18% 82%, #ef321c 0%, #9b165d 27%, transparent 45%)"],
  ["Repeating stripes", "repeating-linear-gradient(135deg, #111 0 10px, #333 10px 20px)"],
  ["Exponent angle", "linear-gradient(9.947598300641403e-14deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.1) 100%)"],
  ["CSS variable stop", "linear-gradient(90deg, var(--brand, #f0f) 0%, #000 100%)"],
  ["Unreadable (mixed)", "mixed"],
];

const BRAND: Swatch[] = [
  { value: "#0F172A", label: "Ink" },
  { value: "#3E5CEB", label: "Orshot blue" },
  { value: "#22C55E", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "linear-gradient(135deg, #3E5CEB 0%, #22C55E 100%)", label: "Brand gradient" },
];

function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      frames++;
      if (t - last >= 500) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="section">
      <header>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}

function Preview({ value }: { value: string }) {
  const gradient = isGradient(value);
  return (
    <div className="preview">
      <div className="preview-box checker">
        <div style={{ background: value === "mixed" ? "transparent" : value }} />
      </div>
      <div
        className="preview-text"
        style={gradient ? { backgroundImage: value, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: value }}
      >
        Automate images
      </div>
    </div>
  );
}

interface Options {
  oklch: boolean;
  history: boolean;
  search: boolean;
  presets: boolean;
  contrast: boolean;
  icons: boolean;
  compare: boolean;
  stack: boolean;
  small: boolean;
  inset: boolean;
}

const OPTION_LABELS: Record<keyof Options, string> = {
  oklch: "OKLCH area (space=\"oklch\")",
  history: "Undo / redo with ⌘Z (history)",
  search: "Swatch search (swatchSearch)",
  presets: "Gradient presets (gradientPresets)",
  contrast: "Contrast vs white (contrastWith)",
  icons: "Tab icons (tabIcons)",
  compare: "Before / after (compare)",
  stack: "Stacked swatches (swatchLayout)",
  small: "Compact (size=\"sm\")",
  inset: "Framed area (variant=\"inset\")",
};

function MainDemo({ theme, outputFormat }: { theme?: "light" | "dark"; outputFormat: OutputFormat }) {
  const [value, setValue] = useState("linear-gradient(135deg, #3E5CEB 0%, #22C55E 100%)");
  const [opts, setOpts] = useState<Options>({
    oklch: false,
    history: true,
    search: true,
    presets: true,
    contrast: false,
    icons: false,
    compare: false,
    stack: false,
    small: false,
    inset: false,
  });
  const [changes, setChanges] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [saved, setSaved] = useState<Swatch[]>([
    { value: "#E11D48", id: "1" },
    { value: "oklch(0.75 0.15 200)", id: "2" },
    { value: "radial-gradient(circle at 30% 30%, #FDE68A 0%, #F97316 100%)", id: "3" },
  ]);

  return (
    <Section
      title="Everything on"
      description="Toggle the optional features on the right. Try: ⌘C / ⌘V with the picker focused, keys 1-4 and I, two-finger swipes, Alt-drag a stop to duplicate it, drag a solid swatch onto the gradient bar, drag Saved swatches to reorder, double-click one to rename."
    >
      <div className="row">
        <ColorPicker
          theme={theme}
          value={value}
          outputFormat={outputFormat}
          space={opts.oklch ? "oklch" : "hsv"}
          history={opts.history}
          swatchSearch={opts.search}
          gradientPresets={opts.presets}
          contrastWith={opts.contrast ? "#ffffff" : undefined}
          tabIcons={opts.icons}
          compare={opts.compare}
          swatchLayout={opts.stack ? "stack" : "tabs"}
          size={opts.small ? "sm" : undefined}
          variant={opts.inset ? "inset" : "bleed"}
          onChange={(v) => {
            setValue(v);
            setChanges((n) => n + 1);
          }}
          onChangeComplete={(v) => setLog((l) => [v, ...l].slice(0, 6))}
          formats={["hex", "rgb", "hsl", "hsb", "oklch", "lch", "lab", "p3", "cmyk"]}
          swatches={[
            { id: "brand", label: "Brand", colors: BRAND },
            {
              id: "saved",
              label: "Saved",
              colors: saved,
              onAdd: (v) => setSaved((s) => [...s, { value: v, id: String(Date.now()) }]),
              onRemove: (sw) => setSaved((s) => s.filter((x) => x.id !== sw.id)),
              onReorder: (list) => setSaved(list),
              onRename: (sw, label) => setSaved((s) => s.map((x) => (x.id === sw.id ? { ...x, label } : x))),
            },
            { id: "recent", label: "Recent", recent: true, limit: 8 },
            { id: "presets", label: "Presets", colors: "default", limit: 8 },
          ]}
        />
        <div className="inspector">
          <fieldset className="options">
            <legend>Optional features</legend>
            {(Object.keys(OPTION_LABELS) as (keyof Options)[]).map((k) => (
              <label key={k}>
                <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} />
                {OPTION_LABELS[k]}
              </label>
            ))}
          </fieldset>
          <Preview value={value} />
          <dl>
            <dt>value</dt>
            <dd>
              <code>{value}</code>
            </dd>
            <dt>onChange calls</dt>
            <dd>{changes}</dd>
            <dt>onChangeComplete (undo entries)</dt>
            <dd>
              {log.length === 0 ? <span className="muted">none yet</span> : log.map((l, i) => <code key={i}>{l}</code>)}
            </dd>
          </dl>
          <div className="samples">
            {MESSY_VALUES.map(([label, v]) => (
              <button key={label} type="button" onClick={() => setValue(v)} title={v}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function SolidDemo({ theme, outputFormat }: { theme?: "light" | "dark"; outputFormat: OutputFormat }) {
  const [value, setValue] = useState("rgba(15, 23, 42, 0.4)");
  return (
    <Section title="Solid only" description="A border or shadow field: no gradient tabs, gradient swatches hidden automatically.">
      <div className="row">
        <ColorPicker
          theme={theme}
          value={value}
          outputFormat={outputFormat}
          onChange={setValue}
          modes={["solid"]}
          swatches={[{ id: "brand", label: "Brand", colors: BRAND }]}
        />
        <div className="inspector">
          <Preview value={value} />
          <code>{value}</code>
        </div>
      </div>
    </Section>
  );
}

function ComposedDemo({ theme }: { theme?: "light" | "dark" }) {
  const [value, setValue] = useState("oklch(0.68 0.19 25)");
  return (
    <Section title="Custom layout" description="Built from parts, OKLCH area: lightness × chroma at one hue, the dashed line is the sRGB edge. Before / after preview (click the left half to restore).">
      <div className="row">
        <Picker.Root theme={theme} value={value} onChange={setValue} modes={["solid"]} space="oklch" history className="composed">
          <div className="composed-grid">
            <Picker.Area />
            <div className="composed-side">
              <Picker.Preview compare className="composed-preview" />
              <Picker.Hue />
              <Picker.Alpha />
            </div>
          </div>
          <div className="composed-bottom">
            <Picker.EyeDropper />
            <Picker.Inputs formats={["oklch", "hex", "p3"]} />
          </div>
        </Picker.Root>
        <div className="inspector">
          <Preview value={value} />
          <code>{value}</code>
        </div>
      </div>
    </Section>
  );
}

function FieldDemo({ theme, outputFormat }: { theme?: "light" | "dark"; outputFormat: OutputFormat }) {
  const [fill, setFill] = useState("linear-gradient(135deg, #3E5CEB 0%, #22C55E 100%)");
  const [border, setBorder] = useState("rgba(15, 23, 42, 0.4)");
  const [text, setText] = useState("#0F172A");
  return (
    <Section
      title="ColorField"
      description="Trigger + popover. Flips and shifts to stay on screen, Escape or click outside closes, Tab away closes, focus returns to the trigger."
    >
      <div className="row">
        <div className="fields">
          <label className="field-row">
            <span>Fill</span>
            <ColorField theme={theme} label="Fill" value={fill} onChange={setFill} outputFormat={outputFormat} gradientPresets swatchSearch history />
          </label>
          <label className="field-row">
            <span>Border</span>
            <ColorField theme={theme} label="Border" value={border} onChange={setBorder} modes={["solid"]} outputFormat={outputFormat} />
          </label>
          <label className="field-row">
            <span>Text</span>
            <ColorField
              theme={theme}
              label="Text color"
              value={text}
              onChange={setText}
              modes={["solid", "linear"]}
              contrastWith="#ffffff"
              placement="right-start"
              outputFormat={outputFormat}
            />
          </label>
        </div>
        <div className="inspector">
          <div className="field-preview" style={{ background: fill, border: `3px solid ${border}` }}>
            <span style={isGradient(text) ? { backgroundImage: text, WebkitBackgroundClip: "text", color: "transparent" } : { color: text }}>Aa</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function HandlesDemo({ theme }: { theme?: "light" | "dark" }) {
  const [value, setValue] = useState("linear-gradient(120deg, #3E5CEB 0%, #F97316 60%, #FDE68A 100%)");
  const box = { w: 360, h: 220 };
  const h = gradientHandles(value, box.w, box.h);
  const drag = (id: string) => (e: React.PointerEvent) => {
    const el = e.currentTarget.parentElement!;
    const rect = el.getBoundingClientRect();
    (e.target as Element).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      setValue((v) => moveGradientHandle(v, id, ev.clientX - rect.left, ev.clientY - rect.top, box.w, box.h, { snap: ev.shiftKey }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <Section
      title="On-canvas handles"
      description="gradientHandles() and moveGradientHandle() from core: drag the ends to rotate, the dots to move stops, the center of radial / conic gradients. Shift snaps."
    >
      <div className="row">
        <div className="handles-box" style={{ width: box.w, height: box.h, background: value }}>
          {h?.line && (
            <svg className="handles-line" width={box.w} height={box.h}>
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
            />
          ))}
        </div>
        <ColorPicker theme={theme} value={value} onChange={setValue} modes={["linear", "radial", "conic"]} />
      </div>
    </Section>
  );
}

function CompactDemo({ theme }: { theme?: "light" | "dark" }) {
  const [value, setValue] = useState("#22C55E");
  return (
    <Section title="Compact" description='size="sm": 240px wide, 24px controls, for tight inspector panels.'>
      <ColorPicker theme={theme} value={value} onChange={setValue} size="sm" swatches={[{ id: "presets", label: "Presets", colors: "default" }]} />
    </Section>
  );
}

export function App() {
  const [theme, setTheme] = useState<Theme>("system");
  const [output, setOutput] = useState<string>("preserve");
  const fps = useFps();
  const pickerTheme = theme === "system" ? undefined : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>Colorshot</h1>
          <p>Color and gradient picker playground</p>
        </div>
        <div className="controls">
          <label>
            Theme
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            Output
            <select value={output} onChange={(e) => setOutput(e.target.value)}>
              <option value="preserve">Preserve input format</option>
              <option value="hex">HEX</option>
              <option value="rgb">RGB</option>
              <option value="hsl">HSL</option>
              <option value="oklch">OKLCH</option>
            </select>
          </label>
          <span className="fps" title="Frames per second while you interact">
            {fps} fps
          </span>
        </div>
      </header>
      <MainDemo theme={pickerTheme} outputFormat={output as OutputFormat} />
      <SolidDemo theme={pickerTheme} outputFormat={output as OutputFormat} />
      <FieldDemo theme={pickerTheme} outputFormat={output as OutputFormat} />
      <ComposedDemo theme={pickerTheme} />
      <HandlesDemo theme={pickerTheme} />
      <CompactDemo theme={pickerTheme} />
    </div>
  );
}
