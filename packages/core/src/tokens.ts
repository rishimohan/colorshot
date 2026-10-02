// Small CSS value tokenizer helpers. They only need to understand nesting and separators,
// never full CSS grammar, so unknown syntax is passed through untouched.

/** Split on a separator at nesting depth 0 (parentheses and quotes respected). `" "` splits on any whitespace run. */
export function splitTopLevel(input: string, sep: "," | "/" | " "): string[] {
  if (typeof input !== "string") return [];
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const isSep = sep === " " ? /\s/.test(ch) : ch === sep;
      if (isSep) {
        out.push(input.slice(start, i));
        start = i + 1;
      }
    }
  }
  out.push(input.slice(start));
  const trimmed = out.map((s) => s.trim());
  return sep === " " ? trimmed.filter(Boolean) : trimmed;
}

/** `name(args)` when the whole string is one function call, otherwise null. */
export function parseFunction(input: string): { name: string; args: string } | null {
  const open = input.indexOf("(");
  if (open <= 0 || !input.endsWith(")")) return null;
  const name = input.slice(0, open);
  if (!/^-?[a-z][a-z0-9-]*$/i.test(name)) return null;
  // the opening paren must close at the very end
  let depth = 0;
  for (let i = open; i < input.length; i++) {
    const ch = input[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0 && i !== input.length - 1) return null;
    }
  }
  if (depth !== 0) return null;
  return { name: name.toLowerCase(), args: input.slice(open + 1, -1).trim() };
}

// no nested quantifiers: linear time on long digit runs
const NUMBER_RE = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

export interface Dimension {
  value: number;
  /** lowercased unit, `""` for a plain number */
  unit: string;
}

export function parseDimension(token: string): Dimension | null {
  const m = NUMBER_RE.exec(token);
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: m[2].toLowerCase() };
}

const ANGLE_UNITS: Record<string, number> = { deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360 };

export function isAngleUnit(unit: string): boolean {
  return unit in ANGLE_UNITS;
}

/** Angle in degrees. A unitless number is accepted only when `allowNumber` (hue channels). */
export function angleToDeg(d: Dimension, allowNumber = false): number | null {
  if (d.unit === "") return allowNumber || d.value === 0 ? d.value : null;
  const f = ANGLE_UNITS[d.unit];
  return f === undefined ? null : d.value * f;
}

export function degToUnit(deg: number, unit: string): number {
  const f = ANGLE_UNITS[unit] ?? 1;
  return deg / f;
}

/** Round and drop trailing zeros, never print `-0`. */
export function num(v: number, digits: number): string {
  if (!Number.isFinite(v)) return "0";
  const r = Number(v.toFixed(digits));
  return Object.is(r, -0) ? "0" : String(r);
}
