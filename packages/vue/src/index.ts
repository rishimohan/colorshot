import { Root } from "./root";
import { Area } from "./parts/area";
import { Alpha, Hue } from "./parts/slider";
import { ModeTabs } from "./parts/mode-tabs";
import { GradientBar } from "./parts/gradient-bar";
import { AngleDial, CenterPad, GradientControls } from "./parts/gradient-controls";
import { Inputs } from "./parts/inputs";
import { EyeDropper } from "./parts/eye-dropper";
import { Swatches } from "./parts/swatches";
import { GradientEditor, Notice } from "./color-picker";
import { Preview } from "./parts/preview";
import { Contrast } from "./parts/contrast";
import { CurrentSwatch } from "./parts/current-swatch";

/** Compound parts for custom layouts: `<Picker.Root v-model="value"><Picker.Area /><Picker.Hue /></Picker.Root>`. */
export const Picker = {
  Root,
  Area,
  Hue,
  Alpha,
  ModeTabs,
  GradientEditor,
  GradientBar,
  GradientControls,
  AngleDial,
  CenterPad,
  Inputs,
  EyeDropper,
  Swatches,
  Notice,
  Preview,
  Contrast,
  CurrentSwatch,
};

export { ColorPicker, type ColorPickerProps } from "./color-picker";
export { ColorField, type ColorFieldProps, type ColorFieldHandle, type Placement } from "./color-field";
export type { RootProps } from "./root";
export type { SwatchGroupConfig, Swatch } from "./parts/swatches";
export { DEFAULT_PALETTE, DEFAULT_GRADIENTS } from "./parts/swatches";
export type { DisplayFormat } from "./parts/inputs";
export type { EyeDropperFn } from "./parts/eye-dropper";
export { hasNativeEyeDropper } from "./parts/eye-dropper";
export { usePicker, usePickerStore, type AreaSpace } from "./context";
export { defaultLabels, type Labels } from "./labels";
// The core helpers most apps need. Everything else (and server code) imports from "@colorshot/core" directly.
export {
  parseColor,
  formatColor,
  convert,
  toGamut,
  inGamut,
  colorKey,
  isGradient,
  parseGradient,
  serializeGradient,
  parseLayers,
  serializeLayers,
  getStops,
  contrastRatio,
  contrastLevel,
  gradientHandles,
  moveGradientHandle,
  createPicker,
  isSafeCssValue,
  safeCssValue,
} from "@colorshot/core";
export type {
  Color,
  ColorSpace,
  ColorFormat,
  Gradient,
  GradientStop,
  GradientType,
  Layer,
  OutputFormat,
  PickerMode,
  PickerOptions,
  PickerState,
  PickerStore,
  GradientHandle,
  GradientHandles,
} from "@colorshot/core";
