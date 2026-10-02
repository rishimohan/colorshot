// Shared terser settings for the tsup builds (core, react, vue): about 5% smaller than esbuild's minifier.
// Keep `pure_getters` at its "strict" default: inputs.tsx reads `el.offsetWidth` on purpose to restart an
// animation, and `pure_getters: true` would drop that read.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

export const terserOptions = {
  ecma: 2020,
  // `directives: false` keeps the React "use client" banner, which terser would otherwise drop as non-standard
  compress: { passes: 3, toplevel: true, unsafe_arrows: true, directives: false },
  mangle: { toplevel: true },
  // keep /* @__PURE__ */ marks so app bundlers can drop unused components
  format: { comments: false, preserve_annotations: true },
  sourceMap: true,
};

// When tsup chains terser's map onto esbuild's, code esbuild did not map (the banner, CJS helpers) keeps
// pointing at the absolute path of the bundle itself. Drop those segments so maps only list ../src files.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const decode = (s) => {
  const out = [];
  for (let i = 0, v = 0, shift = 0; i < s.length; i++) {
    const d = B64.indexOf(s[i]);
    v += (d & 31) << shift;
    if (d & 32) shift += 5;
    else {
      out.push(v & 1 ? -(v >>> 1) : v >>> 1);
      v = shift = 0;
    }
  }
  return out;
};
const encode = (n) => {
  let v = n < 0 ? (-n << 1) | 1 : n << 1;
  let s = "";
  do {
    let d = v & 31;
    v >>>= 5;
    if (v) d |= 32;
    s += B64[d];
  } while (v);
  return s;
};

export function cleanMaps(dir = "dist") {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".map"))) {
    const path = `${dir}/${file}`;
    const map = JSON.parse(readFileSync(path, "utf8"));
    const drop = new Set(map.sources.flatMap((s, i) => (s.startsWith("/") ? [i] : [])));
    if (!drop.size) continue;
    const keep = map.sources.map((_, i) => i).filter((i) => !drop.has(i));
    const remap = new Map(keep.map((old, i) => [old, i]));
    // absolute fields, then re-encode relative to the previous kept segment
    let src = 0, line = 0, col = 0, name = 0;
    let pSrc = 0, pLine = 0, pCol = 0, pName = 0;
    map.mappings = map.mappings
      .split(";")
      .map((group) => {
        let gen = 0, pGen = 0;
        return group
          .split(",")
          .filter(Boolean)
          .map((seg) => {
            const f = decode(seg);
            gen += f[0];
            const field = [gen - pGen];
            pGen = gen;
            if (f.length >= 4) {
              src += f[1]; line += f[2]; col += f[3];
              if (f.length === 5) name += f[4];
              if (drop.has(src)) return encode(field[0]);
              const s = remap.get(src);
              field.push(s - pSrc, line - pLine, col - pCol);
              pSrc = s; pLine = line; pCol = col;
              if (f.length === 5) { field.push(name - pName); pName = name; }
            }
            return field.map(encode).join("");
          })
          .join(",");
      })
      .join(";");
    map.sources = keep.map((i) => map.sources[i]);
    if (map.sourcesContent) map.sourcesContent = keep.map((i) => map.sourcesContent[i]);
    writeFileSync(path, JSON.stringify(map));
  }
}
