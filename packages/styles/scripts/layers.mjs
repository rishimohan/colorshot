// Split `@layer colorshot { ... }` into two tiers, so the picker survives CSS resets in any load order.
//
// - Theme tokens (--cs-* custom properties) stay in `@layer colorshot`. Resets never set them, and keeping them
//   layered means any unlayered rule of yours that sets a token wins without !important.
// - Every other declaration (layout, borders, radius, padding, fonts) is unlayered. A cascade layer that is
//   declared first has the lowest priority, so when the app's CSS loads after Colorshot's, a reset in an
//   earlier-loaded layer would beat it (Tailwind v4 preflight in `@layer base` flattened the panel and stops),
//   and an unlayered reset always beats every layer (Tailwind v3 preflight removed the stop borders). Unlayered,
//   the [data-colorshot] / [data-part] selectors outrank element and universal resets.
//
// Used by scripts/build.mjs for dist/styles.css and by the playground's Vite config, so dev and tests see the
// same cascade as the published file.
import postcss from "postcss";

const LAYER = "colorshot";
const isToken = (node) => node.type === "decl" && node.prop.startsWith("--cs-");

// Distribute `container`'s children into `layered` and `unlayered`, cloning wrappers (rules, @media, @supports)
// on each side and dropping any wrapper that ends up empty.
function split(container, layered, unlayered) {
  for (const node of container.nodes ?? []) {
    if (node.type === "comment") continue;
    if (node.type === "decl") {
      (isToken(node) ? layered : unlayered).append(node.clone());
      continue;
    }
    // @keyframes and at-rules without children are not split
    if (node.type === "atrule" && (!node.nodes || /keyframes$/i.test(node.name))) {
      unlayered.append(node.clone());
      continue;
    }
    const a = node.clone({ nodes: [] });
    const b = node.clone({ nodes: [] });
    split(node, a, b);
    if (a.nodes.length) layered.append(a);
    if (b.nodes.length) unlayered.append(b);
  }
}

export function colorshotLayers() {
  return {
    postcssPlugin: "colorshot-layers",
    Once(root) {
      // collect first: the replacement contains a new @layer colorshot that must not be split again
      const blocks = [];
      root.walkAtRules("layer", (at) => {
        if (at.params.trim() === LAYER && at.nodes) blocks.push(at);
      });
      blocks.forEach((at) => {
        const layered = postcss.atRule({ name: "layer", params: LAYER, nodes: [] });
        const unlayered = postcss.root();
        split(at, layered, unlayered);
        const out = [];
        if (layered.nodes.length) out.push(layered);
        out.push(...unlayered.nodes.map((n) => n.clone()));
        at.replaceWith(out);
      });
    },
  };
}
colorshotLayers.postcss = true;

export function splitLayers(css) {
  return postcss([colorshotLayers()]).process(css, { from: undefined }).css;
}
