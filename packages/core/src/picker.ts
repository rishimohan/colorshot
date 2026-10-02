import { isSafeCssValue, MAX_CSS_LENGTH } from "./safe";
import { formatColor, parseColor, toGamut, type ColorFormat, type FormatStyle } from "./color";
import {
  addStop,
  getStops,
  isGradient,
  parseGradient,
  parseLayers,
  removeStop,
  reverseStops,
  serializeLayers,
  setGradientAngle,
  setGradientCenter,
  setGradientInterpolation,
  setGradientRepeating,
  setGradientShape,
  setGradientSize,
  setGradientType,
  setStopColor,
  setStopOffset,
  stopOffsets,
  type Gradient,
  type GradientStop,
  type GradientType,
  type Layer,
} from "./gradient";
import { hsvToRgb, rgbToHsv, type Hsva } from "./hsv";
import type { Color } from "./spaces";

export type PickerMode = "solid" | GradientType;

export const ALL_MODES: readonly PickerMode[] = ["solid", "linear", "radial", "conic"];

/**
 * - `"preserve"` (default): write each color in the format it came in (oklch stays oklch, hex stays hex)
 * - a format name: always write that format
 * - a function: full control, receives the color and the format it came in
 */
export type OutputFormat =
  | "preserve"
  | ColorFormat
  | ((color: Color, source: { format: ColorFormat; style: FormatStyle }) => string);

export interface PickerOptions {
  value?: string;
  modes?: readonly PickerMode[];
  outputFormat?: OutputFormat;
  /** used when the value is empty or unreadable, and when switching to solid with no previous solid color */
  defaultColor?: string;
  /** used when switching to a gradient with no previous gradient */
  defaultGradient?: string;
  onChange?: (value: string) => void;
  onChangeComplete?: (value: string) => void;
  /** keep an undo / redo stack of committed values (off by default). `true` keeps 100 steps */
  history?: boolean | { limit?: number };
}

export interface PickerState {
  /** the current CSS value */
  value: string;
  mode: PickerMode;
  /** the color being edited (the solid color, or the selected stop), as HSV for the area and sliders */
  hsva: Hsva;
  /** the same color in its own space, so wide-gamut colors are not clipped by the UI */
  color: Color;
  /** how the edited color is written */
  format: { format: ColorFormat; style: FormatStyle };
  /** false when the incoming value could not be read; the first edit replaces it */
  parsed: boolean;
  /** the gradient being edited, null in solid mode */
  gradient: Gradient | null;
  stops: GradientStop[];
  /** display offsets 0..1, same order as `stops` */
  offsets: number[];
  selectedStopId: string | null;
}

type Listener = (state: PickerState) => void;

const DEFAULT_COLOR = "#000000";
const BLACK: Color = { space: "srgb", coords: [0, 0, 0], alpha: 1 };

function hsvaFromColor(color: Color, prev?: Hsva): Hsva {
  const rgb = toGamut(color, "srgb").coords;
  const [h, s, v] = rgbToHsv(rgb);
  return {
    // keep hue (and saturation at black) from the previous color so dragging through greys does not reset them
    h: Number.isNaN(h) || s === 0 ? prev?.h ?? 0 : h,
    s: v === 0 && prev ? prev.s : s,
    v,
    a: color.alpha,
  };
}

export class PickerStore {
  private _state: PickerState;
  private _listeners = new Set<Listener>();
  private _options: PickerOptions;
  private _layers: Layer[] = [];
  private _layerIndex = -1;
  private _lastGradient: string | null = null;
  /** which stop was being edited when the user left the gradient */
  private _lastStopIndex = 0;
  private _committed: string;
  private _past: string[] = [];
  private _future: string[] = [];

  constructor(options: PickerOptions = {}) {
    this._options = options;
    this._state = this._read(options.value ?? "", null);
    this._committed = this._state.value;
  }

  // --- subscription ---

  getState = (): PickerState => this._state;

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  setOptions(options: PickerOptions): void {
    this._options = options;
  }

  get modes(): readonly PickerMode[] {
    return this._options.modes?.length ? this._options.modes : ALL_MODES;
  }

  /** Sync from a controlled `value`. Does not call onChange. */
  setValue(value: string): void {
    if (value === this._state.value) return;
    this._state = this._read(value, this._state);
    this._committed = this._state.value;
    this._notify();
  }

  // --- reading values ---

  private _read(input: string, prev: PickerState | null): PickerState {
    // hosts pass whatever their data holds (a number, an object, null): anything that is not text reads as empty
    const value = typeof input === "string" ? input : "";
    const trimmed = value.trim();
    if (trimmed && isGradient(trimmed)) {
      const layers = parseLayers(trimmed);
      const index = layers.findIndex((l) => l.kind === "gradient");
      // every layer must be a gradient we read: other layers (url(), images) are never passed through
      if (index !== -1 && layers.every((l) => l.kind === "gradient")) {
        this._layers = layers;
        this._layerIndex = index;
        let gradient = (layers[index] as Extract<Layer, { kind: "gradient" }>).gradient;
        // keep stop ids stable across re-reads (undo, controlled updates), so focus and selection stay put
        if (prev?.stops.length) {
          let k = 0;
          gradient = {
            ...gradient,
            items: gradient.items.map((it) => (it.kind === "stop" && k < prev.stops.length ? { ...it, id: prev.stops[k++].id } : it)),
          };
          layers[index] = { kind: "gradient", gradient, raw: layers[index].raw };
        }
        const stops = getStops(gradient);
        // keep the same stop selected across external updates when possible
        const prevIndex = prev?.stops.findIndex((s) => s.id === prev.selectedStopId) ?? 0;
        const selected = stops[Math.min(Math.max(prevIndex, 0), stops.length - 1)];
        return this._gradientState(value, gradient, selected.id, prev?.hsva);
      }
    }
    this._layers = [];
    this._layerIndex = -1;
    const parsed = parseColor(trimmed);
    if (parsed) {
      return {
        value,
        mode: "solid",
        hsva: hsvaFromColor(parsed.color, prev?.hsva),
        color: parsed.color,
        format: { format: parsed.keyword && parsed.keyword !== "transparent" ? "hex" : parsed.format, style: parsed.style },
        parsed: true,
        gradient: null,
        stops: [],
        offsets: [],
        selectedStopId: null,
      };
    }
    const fallback = parseColor(this._options.defaultColor ?? DEFAULT_COLOR);
    const color = fallback?.color ?? BLACK;
    return {
      value,
      mode: "solid",
      hsva: hsvaFromColor(color, prev?.hsva),
      color,
      format: { format: fallback?.format ?? "hex", style: fallback?.style ?? {} },
      parsed: trimmed === "",
      gradient: null,
      stops: [],
      offsets: [],
      selectedStopId: null,
    };
  }

  private _gradientState(value: string, gradient: Gradient, selectedId: string, prevHsva?: Hsva): PickerState {
    const stops = getStops(gradient);
    const stop = stops.find((s) => s.id === selectedId) ?? stops[0];
    const parsed = parseColor(stop.color);
    const color = parsed?.color ?? BLACK;
    return {
      value,
      mode: gradient.type,
      hsva: hsvaFromColor(color, prevHsva),
      color,
      format: {
        format: parsed && !(parsed.keyword && parsed.keyword !== "transparent") ? parsed.format : "hex",
        style: parsed?.style ?? {},
      },
      parsed: true,
      gradient,
      stops,
      offsets: stopOffsets(gradient),
      selectedStopId: stop.id,
    };
  }

  // --- writing ---

  private _notify(): void {
    for (const l of this._listeners) l(this._state);
  }

  private _emit(next: PickerState): void {
    // last line of defense: nothing that is not a plain color or gradient leaves the picker
    if (!isSafeCssValue(next.value)) return;
    this._state = next;
    this._notify();
    this._options.onChange?.(next.value);
  }

  private _write(color: Color): string {
    const out = this._options.outputFormat ?? "preserve";
    const { format, style } = this._state.format;
    if (typeof out === "function") return out(color, { format, style });
    if (out === "preserve") return formatColor(color, format, style);
    return formatColor(color, out, out === format ? style : {});
  }

  private _commitGradient(gradient: Gradient, selectedId: string | null, hsva?: Hsva, color?: Color): void {
    this._layers = this._layers.slice();
    const prevRaw = this._layers[this._layerIndex]?.raw ?? "";
    this._layers[this._layerIndex] = { kind: "gradient", gradient, raw: prevRaw };
    const value = serializeLayers(this._layers);
    const next = this._gradientState(value, gradient, selectedId ?? getStops(gradient)[0].id, this._state.hsva);
    // keep the exact HSV the user is dragging instead of the round-tripped one
    if (hsva) next.hsva = hsva;
    if (color) next.color = color;
    this._emit(next);
  }

  /** Apply a new edited color (solid value or selected stop). */
  private _applyColor(color: Color, hsva: Hsva): void {
    const css = this._write(color);
    const s = this._state;
    if (s.gradient && s.selectedStopId) {
      this._commitGradient(setStopColor(s.gradient, s.selectedStopId, css), s.selectedStopId, hsva, color);
      return;
    }
    this._emit({ ...s, value: css, hsva, color, parsed: true });
  }

  /** Update from the area / sliders. */
  setHsva(patch: Partial<Hsva>): void {
    const prev = this._state.hsva;
    const hsva: Hsva = { ...prev, ...patch };
    // picking a color on a fully transparent value would stay invisible, so make it opaque
    if (prev.a === 0 && patch.a === undefined) hsva.a = 1;
    let color: Color;
    if (patch.a !== undefined && patch.h === undefined && patch.s === undefined && patch.v === undefined) {
      // alpha only: keep the color in its own space so wide-gamut values are not clipped
      color = { ...this._state.color, alpha: hsva.a };
    } else {
      color = { space: "srgb", coords: hsvToRgb(hsva.h, hsva.s, hsva.v), alpha: hsva.a };
    }
    this._applyColor(color, hsva);
  }

  /** Set the edited color from a Color in any space (number inputs, eyedropper). */
  setColor(color: Color, options: { keepAlpha?: boolean } = {}): void {
    const c = options.keepAlpha ? { ...color, alpha: this._state.hsva.a } : color;
    this._applyColor(c, hsvaFromColor(c, this._state.hsva));
  }

  /**
   * Set from CSS text (hex field, paste, swatch). A gradient replaces the whole value when gradients are allowed;
   * a color replaces the edited color and adopts the pasted format. Returns false when the text is not usable.
   */
  setCss(css: string): boolean {
    if (typeof css !== "string") return false;
    const text = css.trim();
    if (text.length > MAX_CSS_LENGTH) return false;
    if (isGradient(text)) {
      const layers = parseLayers(text);
      if (!layers.every((l) => l.kind === "gradient")) return false;
      const g = (layers[0] as Extract<Layer, { kind: "gradient" }>).gradient;
      if (!this.modes.includes(g.type)) return false;
      this._rememberCurrent();
      this._state = this._read(text, this._state);
      this._emit(this._state);
      return true;
    }
    const parsed = parseColor(text);
    if (!parsed) return false;
    const fmt = parsed.keyword && parsed.keyword !== "transparent" ? "hex" : parsed.format;
    const s = this._state;
    if (s.gradient && s.selectedStopId) {
      this._state = { ...s, format: { format: fmt, style: parsed.style } };
      const out = this._options.outputFormat ?? "preserve";
      const color = parsed.color;
      // keep keywords verbatim when the output format is preserved
      const value = parsed.keyword && out === "preserve" ? text : this._write(color);
      this._commitGradient(setStopColor(s.gradient, s.selectedStopId, value), s.selectedStopId, hsvaFromColor(color, s.hsva), color);
      return true;
    }
    this._state = { ...s, format: { format: fmt, style: parsed.style } };
    const out = this._options.outputFormat ?? "preserve";
    const value = parsed.keyword && out === "preserve" ? text : this._write(parsed.color);
    this._emit({ ...this._state, value, color: parsed.color, hsva: hsvaFromColor(parsed.color, s.hsva), parsed: true });
    return true;
  }

  /** Swatch click: gradients replace the value, colors recolor the solid value or the selected stop. */
  applySwatch(css: string): boolean {
    const ok = this.setCss(css);
    if (ok) this.commit();
    return ok;
  }

  // --- modes ---

  private _rememberCurrent(): void {
    const s = this._state;
    if (!s.parsed || s.mode === "solid") return;
    this._lastGradient = s.value;
    this._lastStopIndex = Math.max(0, s.stops.findIndex((st) => st.id === s.selectedStopId));
  }

  /**
   * Switch between solid and gradient types. The color being edited carries across:
   * solid -> gradient puts the solid color on the active stop (of the previous gradient if there was one,
   * so its other stops and angle come back), and gradient -> solid takes the active stop's color.
   */
  setMode(mode: PickerMode): void {
    const s = this._state;
    if (mode === s.mode || !this.modes.includes(mode)) return;
    if (mode === "solid") {
      this._rememberCurrent();
      const selected = s.stops.find((st) => st.id === s.selectedStopId);
      const usable = selected && parseColor(selected.color) ? selected.color : null;
      const next = usable ?? this._options.defaultColor ?? DEFAULT_COLOR;
      this._state = this._read(next, s);
      this._emit(this._state);
      return;
    }
    if (s.gradient) {
      this._commitGradient(setGradientType(s.gradient, mode), s.selectedStopId);
      return;
    }
    const solid = s.parsed && s.value.trim() ? s.value.trim() : null;
    let source = this._lastGradient ?? this._options.defaultGradient ?? null;
    let stopIndex = this._lastGradient ? this._lastStopIndex : 0;
    if (!source) {
      // build one from the current color: to white, or to black when the color is already light
      const from = solid ?? formatColor(s.color, "hex");
      const light = s.hsva.v > 0.85 && s.hsva.s < 0.15;
      const to = this._write({ space: "srgb", coords: light ? [0, 0, 0] : [1, 1, 1], alpha: 1 });
      source = `linear-gradient(90deg, ${from} 0%, ${to} 100%)`;
      stopIndex = 0;
    }
    const layers = parseLayers(source);
    const index = layers.findIndex((l) => l.kind === "gradient");
    if (index === -1) return;
    this._layers = layers;
    this._layerIndex = index;
    let gradient = setGradientType((layers[index] as Extract<Layer, { kind: "gradient" }>).gradient, mode);
    const stops = getStops(gradient);
    const target = stops[Math.min(stopIndex, stops.length - 1)];
    // the solid color becomes the active stop
    if (solid && target.color !== solid) gradient = setStopColor(gradient, target.id, solid);
    this._commitGradient(gradient, target.id);
  }

  // --- stops ---

  selectStop(id: string): void {
    const s = this._state;
    if (!s.gradient || s.selectedStopId === id) return;
    this._state = this._gradientState(s.value, s.gradient, id, s.hsva);
    this._notify();
  }

  addStop(t: number, color?: string): string | null {
    const s = this._state;
    if (!s.gradient) return null;
    // a set output format applies to new stops too; "preserve" keeps the neighbours' format
    const write = (this._options.outputFormat ?? "preserve") === "preserve" ? undefined : (c: Color) => this._write(c);
    const { gradient, id } = addStop(s.gradient, Math.min(1, Math.max(0, t)), color, write);
    this._commitGradient(gradient, id);
    return id;
  }

  moveStop(id: string, t: number): void {
    const s = this._state;
    if (!s.gradient) return;
    this._commitGradient(setStopOffset(s.gradient, id, t), id, s.hsva, s.color);
  }

  removeStop(id?: string): void {
    const s = this._state;
    const target = id ?? s.selectedStopId;
    if (!s.gradient || !target || s.stops.length <= 2) return;
    const index = s.stops.findIndex((st) => st.id === target);
    const gradient = removeStop(s.gradient, target);
    const stops = getStops(gradient);
    const nextSelected = target === s.selectedStopId ? stops[Math.max(0, index - 1)].id : s.selectedStopId;
    this._commitGradient(gradient, nextSelected);
  }

  reverse(): void {
    const s = this._state;
    if (s.gradient) this._commitGradient(reverseStops(s.gradient), s.selectedStopId, s.hsva, s.color);
  }

  // --- gradient shape ---

  setAngle(deg: number): void {
    const s = this._state;
    if (s.gradient && s.gradient.type !== "radial") this._commitGradient(setGradientAngle(s.gradient, deg), s.selectedStopId, s.hsva, s.color);
  }

  setShape(shape: "circle" | "ellipse"): void {
    const s = this._state;
    if (s.gradient?.type === "radial") this._commitGradient(setGradientShape(s.gradient, shape), s.selectedStopId, s.hsva, s.color);
  }

  setSize(size: string | null): void {
    const s = this._state;
    if (s.gradient?.type === "radial") this._commitGradient(setGradientSize(s.gradient, size), s.selectedStopId, s.hsva, s.color);
  }

  setCenter(x: number, y: number): void {
    const s = this._state;
    if (s.gradient && s.gradient.type !== "linear") this._commitGradient(setGradientCenter(s.gradient, x, y), s.selectedStopId, s.hsva, s.color);
  }

  setRepeating(repeating: boolean): void {
    const s = this._state;
    if (s.gradient) this._commitGradient(setGradientRepeating(s.gradient, repeating), s.selectedStopId, s.hsva, s.color);
  }

  setInterpolation(interpolation: string | null): void {
    const s = this._state;
    if (s.gradient) this._commitGradient(setGradientInterpolation(s.gradient, interpolation), s.selectedStopId, s.hsva, s.color);
  }

  // --- commit ---

  /** Call when an interaction ends (pointer up, input commit, swatch click). Fires onChangeComplete once per change. */
  commit(): void {
    if (this._state.value === this._committed || !isSafeCssValue(this._state.value)) return;
    const h = this._options.history;
    if (h) {
      const limit = typeof h === "object" && h.limit ? h.limit : 100;
      this._past.push(this._committed);
      if (this._past.length > limit) this._past.shift();
      this._future = [];
    }
    this._committed = this._state.value;
    this._options.onChangeComplete?.(this._state.value);
  }

  get canUndo(): boolean {
    return Boolean(this._options.history) && this._past.length > 0;
  }

  get canRedo(): boolean {
    return Boolean(this._options.history) && this._future.length > 0;
  }

  private _jump(value: string): void {
    this._state = this._read(value, this._state);
    this._committed = value;
    this._emit(this._state);
    this._options.onChangeComplete?.(value);
  }

  /** Step back to the previous committed value. Needs the `history` option. */
  undo(): boolean {
    if (!this.canUndo) return false;
    this._future.push(this._committed);
    this._jump(this._past.pop()!);
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    this._past.push(this._committed);
    this._jump(this._future.pop()!);
    return true;
  }
}

export function createPicker(options?: PickerOptions): PickerStore {
  return new PickerStore(options);
}

