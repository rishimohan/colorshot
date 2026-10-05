import { Children, forwardRef, memo, useEffect, useRef, type CSSProperties } from "react";
import { usePicker, usePickerContext } from "./context";
import { Area } from "./parts/area";
import { EyeDropper, type EyeDropperFn } from "./parts/eye-dropper";
import { GradientBar } from "./parts/gradient-bar";
import { GradientControls } from "./parts/gradient-controls";
import { Inputs, type DisplayFormat } from "./parts/inputs";
import { ModeTabs } from "./parts/mode-tabs";
import { Alpha, Hue } from "./parts/slider";
import { DEFAULT_GRADIENTS, Swatches, useStableGroups, type SwatchGroupConfig } from "./parts/swatches";
import { Contrast } from "./parts/contrast";
import { CurrentSwatch } from "./parts/current-swatch";
import { Root, type RootProps } from "./root";
import { defaultLabels } from "./labels";

/** Shown when the value could not be read (var(), a broken gradient, the `mixed` sentinel). */
export const Notice = /* @__PURE__ */ memo(function Notice({ className, style }: { className?: string; style?: CSSProperties }) {
  const { labels } = usePickerContext();
  const parsed = usePicker((s) => s.parsed);
  if (parsed) return null;
  return (
    <p data-part="notice" className={className} style={style}>
      {labels.unsupported}
    </p>
  );
});

/** Gradient bar and controls, only rendered in gradient modes. */
export const GradientEditor = /* @__PURE__ */ memo(function GradientEditor({ interpolation = true }: { interpolation?: boolean }) {
  const isGradient = usePicker((s) => s.mode !== "solid");
  // slides open when switching to a gradient, not when the picker opens on one
  const mounted = useRef(false);
  const reveal = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
  }, []);
  if (!isGradient) {
    reveal.current = undefined;
    return null;
  }
  reveal.current ??= mounted.current;
  return (
    <div data-part="gradient-editor" data-reveal={reveal.current ? "" : undefined}>
      <div data-part="gradient-editor-inner">
        <GradientBar />
        <GradientControls interpolation={interpolation} />
      </div>
    </div>
  );
});

export interface ColorPickerProps extends RootProps {
  /** opacity slider and field (default true) */
  alpha?: boolean;
  /** `true` uses the browser EyeDropper where it exists; pass a function to support other browsers; `false` hides it */
  eyeDropper?: boolean | EyeDropperFn;
  /** formats in the input menu */
  formats?: DisplayFormat[];
  defaultFormat?: DisplayFormat;
  /** hide the channel inputs */
  inputs?: boolean;
  /** swatch groups under the picker */
  swatches?: SwatchGroupConfig[];
  /** gradient color blending select (default true) */
  interpolation?: boolean;
  /** search box over the swatches */
  swatchSearch?: boolean;
  /** gradient presets shown in gradient modes: `true` for the built-in set, or your own list */
  gradientPresets?: boolean | string[];
  /** show WCAG contrast against this background color */
  contrastWith?: string;
  /** icons in the mode tabs (labels are always shown) */
  tabIcons?: boolean;
  /** split the header swatch into before / after once the value changes; clicking "before" restores it */
  compare?: boolean;
  /** swatch groups as tabs (default with 2+ groups) or stacked */
  swatchLayout?: "tabs" | "stack";
  /**
   * `"bleed"` (default): the color area runs to the panel edges at the top.
   * `"inset"`: mode tabs first, then a framed area inside the panel padding.
   */
  variant?: "bleed" | "inset";
}

/** The ready-made picker. For a custom layout, compose the parts under `<Picker.Root>`. */
export const ColorPicker = /* @__PURE__ */ forwardRef<HTMLDivElement, ColorPickerProps>(function ColorPicker(
  {
    alpha = true,
    eyeDropper = true,
    formats,
    defaultFormat,
    inputs = true,
    swatches,
    interpolation = true,
    swatchSearch,
    gradientPresets,
    contrastWith,
    tabIcons,
    compare,
    swatchLayout,
    variant = "bleed",
    children,
    ...root
  },
  ref,
) {
  // stable while the content is the same: hosts often pass a new swatches array (and labels) on every render
  const groups = useStableGroups([
    ...(gradientPresets
      ? [
          {
            id: "gradients",
            label: root.labels?.gradients ?? defaultLabels.gradients,
            colors: gradientPresets === true ? DEFAULT_GRADIENTS : gradientPresets,
            showIn: "gradient" as const,
          },
        ]
      : []),
    ...(swatches ?? []),
  ]);
  const multiMode = !root.modes || root.modes.length > 1;
  return (
    <Root ref={ref} data-variant={variant} {...root}>
      {/* bleed: the area comes first, which is what makes it run to the panel edges */}
      {variant === "bleed" && <Area contrastWith={contrastWith} />}
      {(multiMode || compare) && (
        <div data-part="header">
          <CurrentSwatch compare={compare} />
          <ModeTabs showIcons={tabIcons} />
        </div>
      )}
      <Notice />
      <GradientEditor interpolation={interpolation} />
      {variant === "inset" && <Area contrastWith={contrastWith} />}
      <div data-part="slider-row">
        {eyeDropper !== false && <EyeDropper pick={typeof eyeDropper === "function" ? eyeDropper : undefined} />}
        <div data-part="sliders">
          <Hue />
          {alpha && <Alpha />}
        </div>
      </div>
      {inputs && <Inputs formats={formats} defaultFormat={defaultFormat} alpha={alpha} />}
      {contrastWith && <Contrast background={contrastWith} />}
      {groups.length > 0 && <Swatches groups={groups} search={swatchSearch} layout={swatchLayout} />}
      {/* your own content: Colorshot's element styles skip this wrapper, and display: contents keeps the layout */}
      {Children.toArray(children).length > 0 && <div data-part="slot">{children}</div>}
    </Root>
  );
});
