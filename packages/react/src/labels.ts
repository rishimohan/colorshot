/**
 * Every piece of UI text. Text with `{name}` placeholders is filled in by the picker,
 * e.g. `stopName: "Color stop {index} of {count}"`.
 */
export const defaultLabels = {
  picker: "Color picker",
  fillType: "Fill type",
  solid: "Solid",
  linear: "Linear",
  radial: "Radial",
  conic: "Conic",
  area: "Saturation and brightness",
  areaOklch: "Lightness and chroma",
  /** spoken value of the color area */
  areaValue: "Saturation {saturation}%, brightness {brightness}%",
  areaOklchValue: "Lightness {lightness}%, chroma {chroma}",
  hue: "Hue",
  alpha: "Opacity",
  /** spoken value of the hue slider and the angle dial */
  degrees: "{value} degrees",
  stops: "Gradient stops",
  stop: "Color stop",
  /** accessible name of one stop on the gradient bar */
  stopName: "Color stop {index} of {count}",
  addStopHint: "Click to add a stop",
  addStop: "Add stop",
  stopAdded: "Stop added",
  stopRemoved: "Stop removed",
  angle: "Angle",
  reverse: "Reverse stops",
  repeating: "Repeat",
  moreOptions: "More gradient options",
  stopPosition: "Stop position",
  removeStop: "Remove stop",
  backspace: "Backspace",
  shape: "Shape",
  circle: "Circle",
  ellipse: "Ellipse",
  size: "Size",
  farthestCorner: "Farthest corner",
  farthestSide: "Farthest side",
  closestCorner: "Closest corner",
  closestSide: "Closest side",
  center: "Center",
  /** spoken position of the radial / conic center */
  centerValue: "{x}% from the left, {y}% from the top",
  resetCenter: "Center it",
  interpolation: "Blend colors in",
  linearRgb: "Linear RGB",
  /** a blending space that goes the long way around the hue circle, e.g. "OKLCH, long hue" */
  longHue: "{space}, long hue",
  eyeDropper: "Pick a color from the screen",
  format: "Color format",
  hexColor: "Hex color",
  invalidColor: "Not a color. The value was kept.",
  // channel fields
  red: "Red",
  green: "Green",
  blue: "Blue",
  saturation: "Saturation",
  lightness: "Lightness",
  brightness: "Brightness",
  chroma: "Chroma",
  greenRed: "Green to red",
  blueYellow: "Blue to yellow",
  cyan: "Cyan",
  magenta: "Magenta",
  yellow: "Yellow",
  black: "Black",
  outOfGamut: "Outside sRGB. Click to fit.",
  original: "Original color. Click to restore.",
  copy: "Copy CSS value",
  copied: "Copied",
  pasted: "Pasted",
  addSwatch: "Save current color",
  removeSwatch: "Remove",
  renameSwatch: "Name this color",
  swatchGroups: "Swatch groups",
  /** name of a swatch group that has no text label */
  swatchGroup: "Colors",
  emptyWithAdd: "Nothing here yet. + saves the current color.",
  emptyGroup: "No colors yet.",
  /** kept for older overrides; the button text comes from showAllCount */
  showAll: "Show all",
  showAllCount: "Show all {count}",
  showLess: "Show less",
  searchSwatches: "Search colors",
  closeSearch: "Close search",
  noMatches: "No colors match",
  gradients: "Gradients",
  contrast: "Contrast",
  unsupported: "This value can't be edited here. Picking a color replaces it.",
  // ColorField trigger
  none: "None",
  /** trigger text for a gradient value, e.g. "Linear gradient" */
  gradientValue: "{type} gradient",
};

export type Labels = typeof defaultLabels;

/** Fill the `{name}` placeholders of a label. */
export const fill = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
