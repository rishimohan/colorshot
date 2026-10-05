import { defineComponent, onMounted, type ExtractPublicPropTypes } from "vue";
import { usePicker, usePickerContext } from "./context";
import { Area } from "./parts/area";
import { EyeDropper, type EyeDropperFn } from "./parts/eye-dropper";
import { GradientBar } from "./parts/gradient-bar";
import { GradientControls } from "./parts/gradient-controls";
import { Inputs, type DisplayFormat } from "./parts/inputs";
import { ModeTabs } from "./parts/mode-tabs";
import { Alpha, Hue } from "./parts/slider";
import { DEFAULT_GRADIENTS, Swatches, stableGroups, type SwatchGroupConfig } from "./parts/swatches";
import { Contrast } from "./parts/contrast";
import { CurrentSwatch } from "./parts/current-swatch";
import { Root, rootEmits, rootProps } from "./root";
import { bool, boolOr, merge, prop } from "./props";
import { defaultLabels } from "./labels";

/** Shown when the value could not be read (var(), a broken gradient, the `mixed` sentinel). */
export const Notice = /* @__PURE__ */ defineComponent({
  name: "PickerNotice",
  setup() {
    const ctx = usePickerContext();
    const parsed = usePicker((s) => s.parsed);
    return () => (parsed.value ? null : <p data-part="notice">{ctx.labels.unsupported}</p>);
  },
});

/** Gradient bar and controls, only rendered in gradient modes. */
export const GradientEditor = /* @__PURE__ */ defineComponent({
  name: "PickerGradientEditor",
  props: { interpolation: /* @__PURE__ */ bool(true) },
  setup(props) {
    const isGradient = usePicker((s) => s.mode !== "solid");
    // slides open when switching to a gradient, not when the picker opens on one
    let mounted = false;
    let reveal: boolean | undefined;
    onMounted(() => (mounted = true));
    return () => {
      if (!isGradient.value) {
        reveal = undefined;
        return null;
      }
      reveal ??= mounted;
      return (
        <div data-part="gradient-editor" data-reveal={reveal ? "" : undefined}>
          <div data-part="gradient-editor-inner">
            <GradientBar />
            <GradientControls interpolation={props.interpolation} />
          </div>
        </div>
      );
    };
  },
});

export const colorPickerProps = /* @__PURE__ */ merge(rootProps, {
  /** opacity slider and field (default true) */
  alpha: /* @__PURE__ */ bool(true),
  /** `true` uses the browser EyeDropper where it exists; pass a function to support other browsers; `false` hides it */
  eyeDropper: /* @__PURE__ */ boolOr<EyeDropperFn>(Function, true),
  /** formats in the input menu */
  formats: prop<DisplayFormat[]>(),
  defaultFormat: prop<DisplayFormat>(),
  /** hide the channel inputs */
  inputs: /* @__PURE__ */ bool(true),
  /** swatch groups under the picker */
  swatches: prop<SwatchGroupConfig[]>(),
  /** gradient color blending select (default true) */
  interpolation: /* @__PURE__ */ bool(true),
  /** search box over the swatches */
  swatchSearch: /* @__PURE__ */ bool(),
  /** gradient presets shown in gradient modes: `true` for the built-in set, or your own list */
  gradientPresets: /* @__PURE__ */ boolOr<string[]>(Array),
  /** show WCAG contrast against this background color */
  contrastWith: String,
  /** icons in the mode tabs (labels are always shown) */
  tabIcons: /* @__PURE__ */ bool(),
  /** split the header swatch into before / after once the value changes; clicking "before" restores it */
  compare: /* @__PURE__ */ bool(),
  /** swatch groups as tabs (default with 2+ groups) or stacked */
  swatchLayout: prop<"tabs" | "stack">(),
  /**
   * `"bleed"` (default): the color area runs to the panel edges at the top.
   * `"inset"`: mode tabs first, then a framed area inside the panel padding.
   */
  variant: { type: prop<"bleed" | "inset">(), default: "bleed" },
});

export type ColorPickerProps = ExtractPublicPropTypes<typeof colorPickerProps>;

const rootKeys = /* @__PURE__ */ Object.keys(rootProps) as (keyof typeof rootProps)[];

/** The ready-made picker (`v-model` for the value). For a custom layout, compose the parts under `<Picker.Root>`. */
export const ColorPicker = /* @__PURE__ */ defineComponent({
  name: "ColorPicker",
  props: colorPickerProps,
  emits: rootEmits,
  setup(props, { slots, emit }) {
    // stable while the content is the same, so the swatches do not re-render while dragging,
    // even when the parent passes a new swatches array (or labels) on every render
    const groups = stableGroups(() => [
      ...(props.gradientPresets
        ? [
            {
              id: "gradients",
              label: props.labels?.gradients ?? defaultLabels.gradients,
              colors: props.gradientPresets === true ? DEFAULT_GRADIENTS : props.gradientPresets,
              showIn: "gradient" as const,
            },
          ]
        : []),
      ...(props.swatches ?? []),
    ]);
    const on = {
      "onUpdate:modelValue": (v: string) => emit("update:modelValue", v),
      onChange: (v: string) => emit("change", v),
      onChangeComplete: (v: string) => emit("changeComplete", v),
    };

    return () => {
      const root = Object.fromEntries(rootKeys.map((k) => [k, props[k]]));
      const { alpha, eyeDropper, inputs, compare } = props;
      const multiMode = !props.modes || props.modes.length > 1;
      return (
        <Root {...root} {...on} data-variant={props.variant}>
          {{
            default: () => [
              // bleed: the area comes first, which is what makes it run to the panel edges
              props.variant === "bleed" ? <Area contrastWith={props.contrastWith} /> : null,
              multiMode || compare ? (
                <div data-part="header">
                  <CurrentSwatch compare={compare} />
                  <ModeTabs showIcons={props.tabIcons} />
                </div>
              ) : null,
              <Notice />,
              <GradientEditor interpolation={props.interpolation} />,
              props.variant === "inset" ? <Area contrastWith={props.contrastWith} /> : null,
              <div data-part="slider-row">
                {eyeDropper !== false ? <EyeDropper pick={typeof eyeDropper === "function" ? eyeDropper : undefined} /> : null}
                <div data-part="sliders">
                  <Hue />
                  {alpha ? <Alpha /> : null}
                </div>
              </div>,
              inputs ? <Inputs formats={props.formats} defaultFormat={props.defaultFormat} alpha={alpha} /> : null,
              props.contrastWith ? <Contrast background={props.contrastWith} /> : null,
              groups.value.length > 0 ? <Swatches groups={groups.value} search={props.swatchSearch} layout={props.swatchLayout} /> : null,
              // your own content: Colorshot's element styles skip this wrapper, and display: contents keeps the layout
              slots.default ? <div data-part="slot">{slots.default()}</div> : null,
            ],
          }}
        </Root>
      );
    };
  },
});
