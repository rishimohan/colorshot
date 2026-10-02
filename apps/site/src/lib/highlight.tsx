import type { ReactNode } from "react";

export type Lang = "tsx" | "ts" | "css" | "bash" | "vue" | "text";

type Rule = [kind: string, re: RegExp, check?: (code: string, start: number) => boolean];

const prevChar = (code: string, start: number) => {
  for (let i = start - 1; i >= 0; i--) if (!/[ \t]/.test(code[i])) return code[i];
  return "\n";
};

// a `<` opens a JSX tag only after an operator, a bracket or a line start (not `useState<string>`)
const tagContext = (code: string, start: number) => /[\n(=>{?:,&|]/.test(prevChar(code, start)) || /return\s*$/.test(code.slice(0, start));

const KEYWORDS =
  /(?:import|from|export|default|const|let|var|function|return|type|interface|extends|new|await|async|if|else|for|of|in|as|typeof|keyof|readonly)\b/y;

const SCRIPT: Rule[] = [
  ["comment", /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
  ["string", /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y],
  ["tag", /<\/?[A-Za-z][\w.-]*/y, tagContext],
  ["tag", /\/?>/y],
  ["keyword", KEYWORDS],
  ["literal", /(?:true|false|null|undefined)\b/y],
  ["number", /\d+(?:\.\d+)?/y],
  ["attr", /[:@]?[A-Za-z_][\w-]*(?==)/y],
  ["fn", /[A-Za-z_$][\w$]*(?=\()/y],
  ["type", /[A-Z][\w$]*/y],
  ["plain", /[A-Za-z_$][\w$]*/y],
];

const VUE: Rule[] = [["comment", /<!--[\s\S]*?-->/y], ...SCRIPT];

const CSS: Rule[] = [
  ["comment", /\/\*[\s\S]*?\*\//y],
  ["string", /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y],
  ["keyword", /@[\w-]+/y],
  ["attr", /--?[A-Za-z][\w-]*(?=\s*:)/y],
  ["attr", /\[[^\]\n]*\]/y],
  ["literal", /--[\w-]+/y],
  ["number", /#[0-9a-fA-F]{3,8}\b/y],
  ["number", /-?(?:\d*\.)?\d+(?:px|%|deg|rem|em|ms|s|turn)?/y],
  ["fn", /[A-Za-z-]+(?=\()/y],
  ["plain", /[A-Za-z_][\w-]*/y],
];

const BASH: Rule[] = [
  ["comment", /#[^\n]*/y],
  ["string", /"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/y],
  ["keyword", /(?:npm|pnpm|yarn|bun|npx)\b/y],
  ["attr", /--?[A-Za-z][\w-]*/y],
  ["plain", /[^\s#"']+/y],
];

const RULES: Record<Lang, Rule[]> = { tsx: SCRIPT, ts: SCRIPT, vue: VUE, css: CSS, bash: BASH, text: [] };

/** Tiny regex tokenizer: good enough for short docs samples, no dependencies. */
export function highlight(code: string, lang: Lang): ReactNode[] {
  const rules = RULES[lang];
  const out: ReactNode[] = [];
  let plain = "";
  let i = 0;
  let key = 0;
  const flush = () => {
    if (plain) out.push(plain);
    plain = "";
  };
  outer: while (i < code.length) {
    for (const [kind, re, check] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (!m || m[0].length === 0) continue;
      // keywords and names only count at a word start
      if (/^[\w@$-]/.test(m[0]) && i > 0 && /[\w$]/.test(code[i - 1]) && kind !== "plain") continue;
      if (check && !check(code, i)) continue;
      if (kind === "plain") plain += m[0];
      else {
        flush();
        out.push(
          <span key={key++} className={`tk-${kind}`}>
            {m[0]}
          </span>,
        );
      }
      i += m[0].length;
      continue outer;
    }
    plain += code[i];
    i++;
  }
  flush();
  return out;
}
