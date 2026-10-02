import { memo, useRef, useState, type CSSProperties } from "react";
import { convert, num, parseColor, toGamut, toHexDigits, type Color, type ColorSpace, type Hsva } from "@colorshot/core";
import { useIsoLayoutEffect, usePicker, usePickerContext } from "../context";
import { CheckIcon, CopyIcon } from "../icons";
import { NumberField } from "./number-field";
import { Select } from "./select";

export type DisplayFormat = "hex" | "rgb" | "hsl" | "hsb" | "oklch" | "oklab" | "lch" | "lab" | "p3" | "cmyk";

export const DISPLAY_FORMAT_LABELS: Record<DisplayFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  hsb: "HSB",
  oklch: "OKLCH",
  oklab: "OKLab",
  lch: "LCH",
  lab: "Lab",
  p3: "P3",
  cmyk: "CMYK",
};

/** label keys of the channel names, read out instead of the one-letter field labels */
type ChannelName =
  | "red"
  | "green"
  | "blue"
  | "hue"
  | "saturation"
  | "lightness"
  | "brightness"
  | "chroma"
  | "greenRed"
  | "blueYellow"
  | "cyan"
  | "magenta"
  | "yellow"
  | "black";

interface Channel {
  label: string;
  name: ChannelName;
  min: number;
  max: number;
  digits: number;
  wrap?: boolean;
}

interface FormatSpec {
  channels: Channel[];
  read: (color: Color, hsva: Hsva) => number[];
  /** returns a Color, or an Hsva patch for HSB */
  write: (values: number[], color: Color) => Color | Partial<Hsva>;
}

const hueOf = (h: number, fallback: number) => (Number.isNaN(h) ? fallback : h);
// whole numbers where decimals add nothing visible; typed decimals are still accepted
const H: Channel = { label: "H", name: "hue", min: 0, max: 360, digits: 0, wrap: true };
const PCT = (label: string, name: ChannelName): Channel => ({ label, name, min: 0, max: 100, digits: 0 });
const BYTE = (label: string, name: ChannelName): Channel => ({ label, name, min: 0, max: 255, digits: 0 });

function cylinder(space: ColorSpace, lMax: number, cMax: number, cDigits: number, lScale = 1): FormatSpec {
  return {
    channels: [
      { label: "L", name: "lightness", min: 0, max: lMax, digits: 0 },
      { label: "C", name: "chroma", min: 0, max: cMax, digits: cDigits },
      H,
    ],
    read: (c, hsva) => {
      const [l, ch, h] = convert(c, space).coords;
      return [l * lScale, ch, hueOf(h, hsva.h)];
    },
    write: ([l, ch, h], c) => ({ space, coords: [l / lScale, ch, h], alpha: c.alpha }),
  };
}

function rectangular(space: ColorSpace, lMax: number, abMax: number, abDigits: number, lScale = 1): FormatSpec {
  return {
    channels: [
      { label: "L", name: "lightness", min: 0, max: lMax, digits: 0 },
      { label: "a", name: "greenRed", min: -abMax, max: abMax, digits: abDigits },
      { label: "b", name: "blueYellow", min: -abMax, max: abMax, digits: abDigits },
    ],
    read: (c) => {
      const [l, a, b] = convert(c, space).coords;
      return [l * lScale, a, b];
    },
    write: ([l, a, b], c) => ({ space, coords: [l / lScale, a, b], alpha: c.alpha }),
  };
}

const SPECS: Record<Exclude<DisplayFormat, "hex">, FormatSpec> = {
  rgb: {
    channels: [BYTE("R", "red"), BYTE("G", "green"), BYTE("B", "blue")],
    read: (c) => toGamut(c, "srgb").coords.map((v) => v * 255),
    write: (v, c) => ({ space: "srgb", coords: [v[0] / 255, v[1] / 255, v[2] / 255], alpha: c.alpha }),
  },
  hsl: {
    channels: [H, PCT("S", "saturation"), PCT("L", "lightness")],
    read: (c, hsva) => {
      const [h, s, l] = convert(toGamut(c, "srgb"), "hsl").coords;
      return [hueOf(h, hsva.h), s, l];
    },
    write: (v, c) => ({ space: "hsl", coords: [v[0], v[1], v[2]], alpha: c.alpha }),
  },
  hsb: {
    channels: [H, PCT("S", "saturation"), PCT("B", "brightness")],
    read: (_c, hsva) => [hsva.h, hsva.s * 100, hsva.v * 100],
    write: (v) => ({ h: v[0], s: v[1] / 100, v: v[2] / 100 }),
  },
  oklch: cylinder("oklch", 100, 0.4, 3, 100),
  lch: cylinder("lch", 100, 150, 0),
  oklab: rectangular("oklab", 100, 0.4, 3, 100),
  lab: rectangular("lab", 100, 125, 0),
  p3: {
    channels: [
      { label: "R", name: "red", min: 0, max: 1, digits: 3 },
      { label: "G", name: "green", min: 0, max: 1, digits: 3 },
      { label: "B", name: "blue", min: 0, max: 1, digits: 3 },
    ],
    read: (c) => toGamut(c, "display-p3").coords,
    write: (v, c) => ({ space: "display-p3", coords: [v[0], v[1], v[2]], alpha: c.alpha }),
  },
  cmyk: {
    // four fields share the row, so whole percentages
    channels: [PCT("C", "cyan"), PCT("M", "magenta"), PCT("Y", "yellow"), PCT("K", "black")],
    read: (c) => {
      const [r, g, b] = toGamut(c, "srgb").coords;
      const k = 1 - Math.max(r, g, b);
      if (k >= 1) return [0, 0, 0, 100];
      return [((1 - r - k) / (1 - k)) * 100, ((1 - g - k) / (1 - k)) * 100, ((1 - b - k) / (1 - k)) * 100, k * 100];
    },
    write: ([cy, m, y, k], c) => {
      const kk = k / 100;
      return {
        space: "srgb",
        coords: [(1 - cy / 100) * (1 - kk), (1 - m / 100) * (1 - kk), (1 - y / 100) * (1 - kk)],
        alpha: c.alpha,
      };
    },
  },
};

const FORMAT_FOR_VALUE: Partial<Record<string, DisplayFormat>> = {
  hex: "hex",
  rgb: "rgb",
  hsl: "hsl",
  hwb: "hsl",
  oklch: "oklch",
  oklab: "oklab",
  lch: "lch",
  lab: "lab",
  "display-p3": "p3",
};

/** The color in a format, shown next to each option in the format menu. Rounded for reading, with units. */
const HINT_UNITS: Partial<Record<DisplayFormat, string[]>> = {
  hsl: ["°", "%", "%"],
  hsb: ["°", "%", "%"],
  oklch: ["%", "", "°"],
  lch: ["%", "", "°"],
  oklab: ["%", "", ""],
  lab: ["%", "", ""],
  cmyk: ["%", "%", "%", "%"],
};

function hintFor(format: DisplayFormat, color: Color, hsva: Hsva): string {
  if (format === "hex") return `#${toHexDigits(color)}`;
  const values = SPECS[format].read(color, hsva);
  const units = HINT_UNITS[format] ?? [];
  const digits = (i: number) => (format === "p3" || (format === "oklch" && i === 1) || (format === "oklab" && i > 0) ? 2 : 0);
  return values.map((v, i) => `${num(v, digits(i))}${units[i] ?? ""}`).join(" ");
}

function HexField({ color }: { color: Color }) {
  const { store, labels, notify } = usePickerContext();
  const [draft, setDraft] = useState<string | null>(null);
  const labelRef = useRef<HTMLLabelElement>(null);
  const shown = draft ?? toHexDigits(color);
  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    const digits = text.replace(/^#/, "");
    let ok = true;
    if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(digits)) {
      // plain hex keeps the current opacity and output format
      const parsed = parseColor(`#${digits}`);
      if (parsed) store.setColor(parsed.color, { keepAlpha: true });
    } else {
      // anything else (hex with alpha, rgb(), oklch(), a name, a gradient) is taken as written
      ok = store.setCss(/^[0-9a-f]{4}$|^[0-9a-f]{8}$/i.test(digits) ? `#${digits}` : text);
    }
    if (!ok && text) {
      // not a color: shake and fall back to the current value. A timer clears the flag, so it also
      // clears when animations are off (reduced motion). Screen readers hear why the value did not change.
      const el = labelRef.current;
      const input = el?.querySelector("input");
      if (el) {
        el.removeAttribute("data-invalid");
        void el.offsetWidth;
        el.setAttribute("data-invalid", "");
        input?.setAttribute("aria-invalid", "true");
        setTimeout(() => {
          el.removeAttribute("data-invalid");
          input?.removeAttribute("aria-invalid");
        }, 450);
      }
      notify(labels.invalidColor, true);
    }
    store.commit();
  };
  return (
    <label ref={labelRef} data-part="field" data-field="hex">
      <span data-part="field-label" aria-hidden>
        #
      </span>
      <input
        data-part="field-input"
        aria-label={labels.hexColor}
        spellCheck={false}
        autoComplete="off"
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          // a frame later: Safari clears a selection made on focus when the click's mouseup lands
          const input = e.currentTarget;
          requestAnimationFrame(() => input === document.activeElement && input.select());
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // handled here: no host shortcut or form submit should also act on this Enter
            e.preventDefault();
            commit();
            const input = e.currentTarget;
            // after the committed value renders (Safari resets the selection on a value change)
            requestAnimationFrame(() => input === document.activeElement && input.select());
          } else if (e.key === "Escape" && draft !== null) {
            // only undoes the typing; with nothing typed, Escape goes on to close a popover
            e.preventDefault();
            setDraft(null);
          }
        }}
        onPaste={(e) => {
          // pasting a full CSS color applies it right away
          const text = e.clipboardData.getData("text").trim();
          if (/[(#]/.test(text) && store.setCss(text)) {
            e.preventDefault();
            setDraft(null);
            store.commit();
          }
        }}
      />
    </label>
  );
}

export interface InputsProps {
  className?: string;
  style?: CSSProperties;
  /** formats offered in the menu. Default: hex, rgb, hsl, oklch */
  formats?: DisplayFormat[];
  /** starting format. Default: matches the value, else the first in `formats` */
  defaultFormat?: DisplayFormat;
  /** show the opacity field (default true) */
  alpha?: boolean;
}

/** Format menu, channel fields, opacity and an out-of-gamut marker. */
export const Inputs = /* @__PURE__ */ memo(function Inputs({ className, style, formats = ["hex", "rgb", "hsl", "oklch"], defaultFormat, alpha = true }: InputsProps) {
  const { store, labels, storage, notify } = usePickerContext();
  const { color, hsva, valueFormat } = usePicker((s) => ({ color: s.color, hsva: s.hsva, valueFormat: s.format.format }));
  const [format, setFormatState] = useState<DisplayFormat>(() => {
    if (defaultFormat) return defaultFormat;
    const match = FORMAT_FOR_VALUE[valueFormat];
    return match && formats.includes(match) ? match : formats[0];
  });
  // the last format the user picked, if this picker offers it. Applied after mount but before paint,
  // so the first client render matches the server's (which has no storage)
  useIsoLayoutEffect(() => {
    if (defaultFormat) return;
    const saved = storage.get("format") as DisplayFormat | null;
    if (saved && formats.includes(saved)) setFormatState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage]);
  const done = () => store.commit();
  const setFormat = (f: DisplayFormat) => {
    setFormatState(f);
    storage.set("format", f);
  };
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => notify(labels.copied),
      () => {},
    );
  };
  const spec = format === "hex" ? null : SPECS[format];
  const values = spec?.read(color, hsva);

  const setChannel = (i: number, v: number) => {
    if (!spec || !values) return;
    const next = values.slice();
    next[i] = v;
    const out = spec.write(next, color);
    if ("space" in out) store.setColor(out as Color);
    else store.setHsva(out);
  };

  return (
    <div data-part="inputs" className={className} style={style}>
      {formats.length > 1 && (
        <Select
          aria-label={labels.format}
          kind="format"
          heading={labels.format}
          value={format}
          onChange={setFormat}
          menuWidth={220}
          options={formats.map((f) => ({ value: f, label: DISPLAY_FORMAT_LABELS[f] }))}
          // previews are only built while the menu is open, not on every drag frame
          getHint={(f) => hintFor(f, store.getState().color, store.getState().hsva)}
          footer={(close) => (
            <button
              type="button"
              data-part="select-action"
              onClick={() => {
                copy(store.getState().value);
                close();
              }}
            >
              <CopyIcon />
              <span>{labels.copy}</span>
            </button>
          )}
        />
      )}
      <div data-part="fields" data-count={spec ? spec.channels.length : 1}>
        {spec && values ? (
          spec.channels.map((ch, i) => (
            <NumberField
              key={`${format}-${ch.label}`}
              field="channel"
              title={labels[ch.name]}
              aria-label={`${DISPLAY_FORMAT_LABELS[format]} ${labels[ch.name]}`}
              value={values[i]}
              min={ch.min}
              max={ch.max}
              wrap={ch.wrap}
              digits={ch.digits}
              onValue={(v) => setChannel(i, v)}
              onCommit={done}
            />
          ))
        ) : (
          <HexField color={color} />
        )}
        {alpha && (
          <NumberField
            field="alpha"
            label="%"
            labelPosition="end"
            aria-label={labels.alpha}
            value={hsva.a * 100}
            min={0}
            max={100}
            digits={0}
            onValue={(v) => store.setHsva({ a: v / 100 })}
            onCommit={done}
          />
        )}
      </div>
    </div>
  );
});
