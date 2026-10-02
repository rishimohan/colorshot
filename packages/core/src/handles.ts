// On-canvas gradient handles: where to draw them on an element of a given size, and the new CSS value
// when one is dragged. Framework-free so any editor canvas can use it.
import {
  getStops,
  gradientAngle,
  gradientCenter,
  parseLayers,
  serializeLayers,
  setGradientAngle,
  setGradientCenter,
  setStopOffset,
  stopOffsets,
  type Gradient,
  type Layer,
} from "./gradient";

export type GradientHandleKind = "start" | "end" | "center" | "angle" | "stop";

export interface GradientHandle {
  /** stable within one value: `start`, `end`, `center`, `angle`, or `stop:<index>` */
  id: string;
  kind: GradientHandleKind;
  /** px from the element's top-left corner */
  x: number;
  y: number;
  /** the stop color, for stop handles */
  color?: string;
}

export interface GradientHandles {
  type: Gradient["type"];
  handles: GradientHandle[];
  /** the gradient line of a linear gradient, for drawing a guide */
  line?: { x1: number; y1: number; x2: number; y2: number };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

function firstGradient(value: string): { layers: Layer[]; index: number; gradient: Gradient } | null {
  const layers = parseLayers(value);
  const index = layers.findIndex((l) => l.kind === "gradient");
  if (index === -1) return null;
  return { layers, index, gradient: (layers[index] as Extract<Layer, { kind: "gradient" }>).gradient };
}

/** CSS gradient line for a linear gradient: through the center, long enough that corners get the end colors. */
function linearLine(g: Gradient, w: number, h: number) {
  const a = rad(gradientAngle(g));
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = w / 2;
  const cy = h / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

/** Handles to draw for the first gradient in `value` on an element `width` × `height` px. */
export function gradientHandles(value: string, width: number, height: number): GradientHandles | null {
  const found = firstGradient(value);
  if (!found) return null;
  const g = found.gradient;
  const stops = getStops(g);
  const offsets = stopOffsets(g);
  if (g.type === "linear") {
    const line = linearLine(g, width, height);
    const handles: GradientHandle[] = [
      { id: "start", kind: "start", x: line.x1, y: line.y1 },
      { id: "end", kind: "end", x: line.x2, y: line.y2 },
      ...stops.map((s, i) => ({
        id: `stop:${i}`,
        kind: "stop" as const,
        color: s.color,
        x: line.x1 + (line.x2 - line.x1) * offsets[i],
        y: line.y1 + (line.y2 - line.y1) * offsets[i],
      })),
    ];
    return { type: g.type, handles, line };
  }
  const c = gradientCenter(g);
  if (!c) return { type: g.type, handles: [] };
  const cx = (c.x / 100) * width;
  const cy = (c.y / 100) * height;
  const handles: GradientHandle[] = [{ id: "center", kind: "center", x: cx, y: cy }];
  if (g.type === "conic") {
    const a = rad(gradientAngle(g));
    const r = Math.min(width, height) / 4;
    handles.push({ id: "angle", kind: "angle", x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r });
  }
  return { type: g.type, handles };
}

/**
 * New CSS value after dragging handle `id` to (x, y). Other layers and untouched parts are kept.
 * `snap` rounds angles to 15° and centers to 5%.
 */
export function moveGradientHandle(
  value: string,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { snap?: boolean } = {},
): string {
  const found = firstGradient(value);
  if (!found) return value;
  let g = found.gradient;
  const angleTo = (fromX: number, fromY: number) => {
    let deg = (Math.atan2(x - fromX, fromY - y) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return options.snap ? Math.round(deg / 15) * 15 : Math.round(deg * 10) / 10;
  };
  if (g.type === "linear" && (id === "start" || id === "end")) {
    const cx = width / 2;
    const cy = height / 2;
    // the angle points from start to end, so dragging the start handle points the other way
    const deg = angleTo(cx, cy);
    g = setGradientAngle(g, id === "end" ? deg : (deg + 180) % 360);
  } else if (g.type === "linear" && id.startsWith("stop:")) {
    const i = Number(id.slice(5));
    const stop = getStops(g)[i];
    if (!stop) return value;
    const { x1, y1, x2, y2 } = linearLine(g, width, height);
    const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
    const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / len2;
    g = setStopOffset(g, stop.id, Math.min(1, Math.max(0, t)));
  } else if (id === "center" && g.type !== "linear") {
    let px = (x / width) * 100;
    let py = (y / height) * 100;
    if (options.snap) {
      px = Math.round(px / 5) * 5;
      py = Math.round(py / 5) * 5;
    }
    g = setGradientCenter(g, px, py);
  } else if (id === "angle" && g.type === "conic") {
    const c = gradientCenter(g) ?? { x: 50, y: 50 };
    g = setGradientAngle(g, angleTo((c.x / 100) * width, (c.y / 100) * height));
  } else {
    return value;
  }
  const layers = found.layers.slice();
  layers[found.index] = { kind: "gradient", gradient: g, raw: found.layers[found.index].raw };
  return serializeLayers(layers);
}
