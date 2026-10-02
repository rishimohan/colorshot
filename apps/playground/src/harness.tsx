// Test harness for the Playwright suite (apps/playground/e2e). Open with `/?harness`.
// Each picker is isolated (no shared localStorage) and reports its state on `window.__cs`.
import { memo, Profiler, useState, type CSSProperties, type ProfilerOnRenderCallback, type ReactNode } from "react";
import * as core from "@orshot/colorshot";
import { ColorField, ColorPicker, Picker, usePicker, type Swatch } from "@orshot/colorshot/react";

interface PickerLog {
  value: string;
  changes: string[];
  completes: string[];
}

interface HarnessState {
  pickers: Record<string, PickerLog>;
  /** React commits per <Profiler id> */
  renders: Record<string, number>;
  /** summed / worst React render time (ms) per <Profiler id>, from the Profiler's actualDuration */
  durations: Record<string, { total: number; max: number }>;
  /** ColorField open/close events */
  fieldOpen: boolean[];
  reset: () => void;
}

declare global {
  interface Window {
    __cs: HarnessState;
  }
}

const params = new URLSearchParams(location.search);
const INITIAL = params.get("value") ?? "#3366cc";
// `field=bottom` pins the ColorField trigger to the bottom edge; `fieldTop=<px>` pins it at that distance from the top
const FIELD_STYLE: CSSProperties | undefined =
  params.get("field") === "bottom"
    ? { position: "fixed", left: 16, bottom: 12, zIndex: 1 }
    : params.has("fieldTop")
      ? { position: "fixed", left: 16, top: Number(params.get("fieldTop")), zIndex: 1 }
      : undefined;

const cs: HarnessState = {
  pickers: {},
  renders: {},
  durations: {},
  fieldOpen: [],
  reset() {
    for (const p of Object.values(cs.pickers)) {
      p.changes = [];
      p.completes = [];
    }
    for (const k of Object.keys(cs.renders)) cs.renders[k] = 0;
    cs.durations = {};
    cs.fieldOpen = [];
  },
};
window.__cs = cs;
// the core, for browser-side checks such as CSS.supports() on generated values
(window as unknown as { __core: typeof core }).__core = core;

function log(id: string, initial: string): PickerLog {
  return (cs.pickers[id] ??= { value: initial, changes: [], completes: [] });
}

/** Callbacks that record into `window.__cs` without re-rendering the harness. */
function track(id: string, initial = INITIAL) {
  const l = log(id, initial);
  return {
    onChange: (v: string) => {
      l.value = v;
      l.changes.push(v);
    },
    onChangeComplete: (v: string) => {
      l.value = v;
      l.completes.push(v);
    },
  };
}

const onRender: ProfilerOnRenderCallback = (id, _phase, actualDuration) => {
  cs.renders[id] = (cs.renders[id] ?? 0) + 1;
  const d = (cs.durations[id] ??= { total: 0, max: 0 });
  d.total += actualDuration;
  d.max = Math.max(d.max, actualDuration);
};

function P({ id, children }: { id: string; children: ReactNode }) {
  cs.renders[id] ??= 0;
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

function Cell({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-testid={id} className="harness-cell">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const BRAND: Swatch[] = [
  { value: "#0f172a", label: "Ink" },
  { value: "#3e5ceb", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
];

const fullTrack = track("full");
const solidTrack = track("solid");
const oklchTrack = track("oklch", "oklch(0.7 0.15 200)");
const perfTrack = track("perf");
const fieldLog = log("field", INITIAL);

function FullPicker() {
  const [saved, setSaved] = useState<Swatch[]>([
    { value: "#e11d48", id: "s1", label: "Rose" },
    { value: "#0ea5e9", id: "s2", label: "Sky" },
    { value: "#a3e635", id: "s3", label: "Lime" },
  ]);
  // exposed so tests can read the saved group without parsing the DOM
  (window as unknown as { __saved: Swatch[] }).__saved = saved;
  return (
    <P id="full">
      <ColorPicker
        data-testid="picker-full"
        defaultValue={INITIAL}
        storageKey={null}
        history
        swatchSearch
        gradientPresets
        formats={["hex", "rgb", "hsl", "oklch"]}
        {...fullTrack}
        swatches={[
          { id: "brand", label: "Brand", colors: BRAND },
          {
            id: "saved",
            label: "Saved",
            colors: saved,
            onAdd: (v) => setSaved((s) => [...s, { value: v, id: `s${Date.now()}` }]),
            onRemove: (sw) => setSaved((s) => s.filter((x) => x.id !== sw.id)),
            onReorder: (list) => setSaved(list),
            onRename: (sw, label) => setSaved((s) => s.map((x) => (x.id === sw.id ? { ...x, label } : x))),
          },
          { id: "recent", label: "Recent", recent: true },
          { id: "presets", label: "Presets", colors: "default" },
        ]}
      />
    </P>
  );
}

/** The same parts as ColorPicker, each under its own Profiler, to count re-renders per part. */
function PerfPicker() {
  return (
    <P id="perf">
      <Picker.Root data-testid="picker-perf" defaultValue={INITIAL} storageKey={null} {...perfTrack}>
        <P id="perf:mode-tabs">
          <Picker.ModeTabs />
        </P>
        <P id="perf:gradient-editor">
          <Picker.GradientEditor />
        </P>
        <P id="perf:area">
          <Picker.Area />
        </P>
        <div data-part="slider-row">
          <div data-part="sliders">
            <P id="perf:hue">
              <Picker.Hue />
            </P>
            <P id="perf:alpha">
              <Picker.Alpha />
            </P>
          </div>
        </div>
        <P id="perf:inputs">
          <Picker.Inputs />
        </P>
        <P id="perf:swatches">
          <Picker.Swatches
            groups={[
              { id: "brand", label: "Brand", colors: BRAND },
              { id: "presets", label: "Presets", colors: "default" },
            ]}
          />
        </P>
      </Picker.Root>
    </P>
  );
}

const controlledLog = log("controlled", INITIAL);

/** Counts its own renders under `id` (React Profilers also count when a parent re-creates them, so they cannot be used here). */
function bump(id: string) {
  cs.renders[id] = (cs.renders[id] ?? 0) + 1;
}

// re-renders only when the picker context changes (it reads a slice that a color drag never changes)
const ContextProbe = memo(function ContextProbe() {
  usePicker((s) => s.mode);
  bump("controlled:context");
  return null;
});

const countSwatch = () => {
  bump("controlled:swatch");
  return null;
};

/**
 * Controlled like most hosts: the value lives in state, so the whole picker re-renders on every change, and the
 * swatch groups and labels are new objects each time. Swatch renders and context changes are counted.
 */
function ControlledPicker() {
  const [value, setValue] = useState(INITIAL);
  const [saved, setSaved] = useState<string[]>([]);
  cs.renders["controlled:swatch"] ??= 0;
  cs.renders["controlled:context"] ??= 0;
  return (
    <ColorPicker
      data-testid="picker-controlled"
      value={value}
      storageKey={null}
      eyeDropper={false}
      swatchLayout="stack"
      labels={{ swatchGroup: "Colors" }}
      onChange={(v) => {
        controlledLog.value = v;
        controlledLog.changes.push(v);
        setValue(v);
      }}
      onChangeComplete={(v) => controlledLog.completes.push(v)}
      swatches={[
        { id: "brand", label: "Brand", colors: BRAND.map((s) => ({ ...s })), renderSwatch: countSwatch },
        // a closure over this render's list, not a functional update: calling an old callback would drop colors
        { id: "saved", label: "Saved", colors: saved, onAdd: (v) => setSaved([...saved, v]), renderSwatch: countSwatch },
      ]}
    >
      <ContextProbe />
    </ColorPicker>
  );
}

function Field() {
  const [value, setValue] = useState(INITIAL);
  return (
    <div data-testid="field-wrap" style={FIELD_STYLE}>
      <ColorField
        label="Fill"
        value={value}
        storageKey={null}
        eyeDropper={false}
        onChange={(v) => {
          fieldLog.value = v;
          fieldLog.changes.push(v);
          setValue(v);
        }}
        onChangeComplete={(v) => fieldLog.completes.push(v)}
        onOpenChange={(o) => cs.fieldOpen.push(o)}
      />
    </div>
  );
}

const STYLE = `
  .harness { display: flex; flex-wrap: wrap; gap: 24px; padding: 16px; align-items: flex-start; }
  .harness-cell { display: flex; flex-direction: column; gap: 8px; }
  .harness-cell h2 { font-size: 12px; font-weight: 600; margin: 0; color: var(--fg); }
`;

export function Harness() {
  return (
    <main className="harness">
      <style>{STYLE}</style>
      <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Colorshot test harness</h1>
      <Cell id="full" title="Full">
        <FullPicker />
      </Cell>
      <Cell id="field" title="ColorField">
        <Field />
      </Cell>
      <Cell id="solid" title="Solid only">
        <P id="solid">
          <ColorPicker data-testid="picker-solid" defaultValue={INITIAL} storageKey={null} modes={["solid"]} eyeDropper={false} {...solidTrack} />
        </P>
      </Cell>
      <Cell id="oklch" title="OKLCH space">
        <P id="oklch">
          <ColorPicker data-testid="picker-oklch" defaultValue="oklch(0.7 0.15 200)" storageKey={null} space="oklch" eyeDropper={false} {...oklchTrack} />
        </P>
      </Cell>
      <Cell id="compact" title="Compact">
        <ColorPicker
          data-testid="picker-compact"
          defaultValue="#22C55E"
          storageKey={null}
          size="sm"
          swatches={[{ id: "presets", label: "Presets", colors: "default" }]}
        />
      </Cell>
      <Cell id="formats" title="Every format, both sizes">
        {(["md", "sm"] as const).map((size) => (
          <ColorPicker
            key={size}
            data-testid={`picker-formats-${size}`}
            defaultValue="color(display-p3 0.123 0.456 0.789 / 0.5)"
            storageKey={null}
            size={size === "sm" ? "sm" : undefined}
            modes={["solid", "linear", "radial", "conic"]}
            formats={["hex", "rgb", "hsl", "hsb", "oklch", "oklab", "lch", "lab", "p3", "cmyk"]}
          />
        ))}
      </Cell>
      <Cell id="contrast" title="Contrast + compare">
        <ColorPicker data-testid="picker-contrast" defaultValue="#64748B" storageKey={null} modes={["solid"]} contrastWith="#ffffff" compare />
      </Cell>
      <Cell id="perf" title="Per-part profiler">
        <PerfPicker />
      </Cell>
      <Cell id="controlled" title="Controlled, inline swatches and labels">
        <P id="controlled">
          <ControlledPicker />
        </P>
      </Cell>
      <Cell id="inset" title="variant=inset">
        <ColorPicker data-testid="picker-inset" defaultValue="#22C55E" storageKey={null} variant="inset" />
      </Cell>
    </main>
  );
}
