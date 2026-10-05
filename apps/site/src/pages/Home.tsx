import { useState } from "react";
import { Link } from "react-router-dom";
import { ColorField, ColorPicker, isGradient } from "@orshot/colorshot/react";
import { Code, CopyButton, Install } from "../components/Code";
import { useTitle } from "../components/Docs";
import { useTheme } from "../lib/theme";
import { GITHUB_URL, ORSHOT_URL } from "../nav";

const START = "linear-gradient(120deg, #3E5CEB 0%, #F97316 60%, #FDE68A 100%)";

function Hero() {
  const { theme } = useTheme();
  const [value, setValue] = useState(START);
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">
          Open source · MIT ·{" "}
          <a href={ORSHOT_URL} target="_blank" rel="noreferrer">
            by Orshot
          </a>
        </p>
        <h1>
          Color and gradient picker for <span className="grad-text">React and Vue</span>
        </h1>
        <p className="hero-lead">Every CSS color format, every gradient type. Give it any CSS string and get one back.</p>
        <Install pkg="@orshot/colorshot" />
        <div className="hero-actions">
          <Link to="/docs/getting-started" className="btn primary">
            Get started
          </Link>
          <a href={GITHUB_URL} className="btn" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
      <div className="hero-demo">
        <div className="stage checker">
          <div className="stage-fill" style={{ background: value }} />
          <div className="stage-value">
            <code title={value}>{value}</code>
            <CopyButton text={value} label="Copy CSS value" />
          </div>
        </div>
        <ColorPicker
          className="hero-picker"
          theme={theme}
          value={value}
          onChange={setValue}
          gradientPresets
          swatches={[{ id: "presets", label: "Presets", colors: "default" }]}
          history
        />
      </div>
    </section>
  );
}

const SPECTRUM = [25, 70, 145, 200, 265, 330];

function FeatureVisual({ kind }: { kind: string }) {
  const { theme } = useTheme();
  const [fill, setFill] = useState("oklch(0.68 0.21 265)");
  switch (kind) {
    case "oklch":
      return (
        <div className="fv fv-oklch" aria-hidden>
          {SPECTRUM.map((h) => (
            <span key={h} style={{ background: `oklch(0.72 0.2 ${h})` }} />
          ))}
          <b>P3</b>
        </div>
      );
    case "gradients":
      return (
        <div className="fv fv-grads" aria-hidden>
          <span style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }} />
          <span style={{ background: "radial-gradient(circle at 30% 30%, #fde68a, #f97316)" }} />
          <span style={{ background: "conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)" }} />
        </div>
      );
    case "swatches":
      return (
        <div className="fv fv-swatches" aria-hidden>
          {["#0f172a", "#3E5CEB", "#F97316", "#FDE68A", "#22c55e", "#ec4899", "#14b8a6", "#a855f7", "#f43f5e", "#e4e4e7"].map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </div>
      );
    case "field":
      return (
        <div className="fv fv-field">
          <ColorField theme={theme} label="Fill" value={fill} onChange={setFill} placement="bottom-start" />
        </div>
      );
    case "keyboard":
      return (
        <div className="fv fv-keys" aria-hidden>
          {["←", "→", "⇧", "1-4", "I", "⌘Z"].map((k) => (
            <kbd key={k}>{k}</kbd>
          ))}
        </div>
      );
    default:
      return (
        <div className="fv fv-tokens" aria-hidden>
          <code>--cs-accent</code>
          <code>--cs-radius</code>
          <code>[data-part]</code>
        </div>
      );
  }
}

const FEATURES = [
  {
    kind: "oklch",
    title: "OKLCH and wide gamut",
    text: "Pick in OKLCH on an area drawn in Display P3. Colors outside sRGB get a badge that fits them back in one click.",
  },
  {
    kind: "gradients",
    title: "Gradients that round-trip",
    text: "Linear, radial and conic, repeating too. Paste any CSS gradient. Parts you do not edit come back exactly as written.",
  },
  {
    kind: "swatches",
    title: "Swatches",
    text: "Brand, saved and recent groups. Show them as tabs or a stack, search them, drag to reorder, rename with F2.",
  },
  {
    kind: "field",
    title: "ColorField popover",
    text: "A swatch button that opens the picker. It flips to stay on screen and gives focus back when it closes. Try it.",
  },
  {
    kind: "keyboard",
    title: "Keyboard, screen reader, trackpad",
    text: "Every control is a labelled slider, tab or button. Arrow keys, shortcuts, and two-finger swipes on a trackpad.",
  },
  {
    kind: "tokens",
    title: "Tiny and themeable",
    text: "No dependencies. One plain CSS file that resets cannot break, themed with --cs-* variables. Light and dark built in.",
  },
];

const PICKER_SAMPLE = `
import { useState } from "react";
import { ColorPicker } from "@orshot/colorshot/react";
import "@orshot/colorshot/styles.css";

export function Fill() {
  const [value, setValue] = useState("#3E5CEB");
  return <ColorPicker value={value} onChange={setValue} />;
}
`;

const FIELD_SAMPLE = `
import { ColorField } from "@orshot/colorshot/react";

<ColorField label="Fill" value={fill} onChange={setFill} gradientPresets />
<ColorField label="Border" value={border} onChange={setBorder} modes={["solid"]} />
`;

function UsageSection() {
  const { theme } = useTheme();
  const [fill, setFill] = useState("linear-gradient(135deg, #667eea 0%, #764ba2 100%)");
  const [border, setBorder] = useState("#0f172a");
  return (
    <section className="home-section">
      <div className="section-head">
        <h2>Two ways to use it</h2>
        <p>Drop the picker inline, or put it behind a field. Both take the same props.</p>
      </div>
      <div className="usage-grid">
        <div className="usage-card">
          <h3>ColorPicker</h3>
          <p>The full picker, always open. Good for panels and sidebars.</p>
          <Code code={PICKER_SAMPLE} />
        </div>
        <div className="usage-card">
          <h3>ColorField</h3>
          <p>A compact trigger for inspectors and forms. Opens the picker in a popover.</p>
          <Code code={FIELD_SAMPLE} />
          <div className="usage-live">
            <div className="usage-fields">
              <label>
                <span>Fill</span>
                <ColorField theme={theme} label="Fill" value={fill} onChange={setFill} gradientPresets />
              </label>
              <label>
                <span>Border</span>
                <ColorField theme={theme} label="Border" value={border} onChange={setBorder} modes={["solid"]} />
              </label>
            </div>
            <div
              className="usage-preview checker"
              style={{ background: fill, borderColor: isGradient(border) ? undefined : border }}
              aria-label="Preview of the fill and border"
              role="img"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Home() {
  useTitle("");
  return (
    <main className="home">
      <Hero />
      <section className="home-section">
        <div className="section-head">
          <h2>What you get</h2>
          <p>One picker for solid colors and gradients, with the panel around it that real editors need.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.kind} className="feature">
              <FeatureVisual kind={f.kind} />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <UsageSection />
      <section className="home-section cta">
        <h2>Start with one component</h2>
        <p>Install the package, import the CSS, render a picker. The docs cover the rest.</p>
        <div className="hero-actions center">
          <Link to="/docs/getting-started" className="btn primary">
            Read the docs
          </Link>
          <a href={ORSHOT_URL} className="btn" target="_blank" rel="noreferrer">
            Made by Orshot
          </a>
        </div>
      </section>
    </main>
  );
}
