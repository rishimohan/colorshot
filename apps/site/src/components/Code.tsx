import { useMemo, useRef, useState, type ReactNode } from "react";
import { highlight, type Lang } from "../lib/highlight";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers or blocked clipboard: fall back to a hidden textarea
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

export function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <button
      type="button"
      className="copy-btn"
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <rect x="5" y="5" width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 3.2A1.8 1.8 0 0 0 9 2.5H4.3A1.8 1.8 0 0 0 2.5 4.3V9a1.8 1.8 0 0 0 .7 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      <span className="sr-only" aria-live="polite">
        {done ? "Copied" : ""}
      </span>
    </button>
  );
}

interface CodeProps {
  code: string;
  lang?: Lang;
  /** file name or caption shown above the code */
  title?: ReactNode;
}

export function Code({ code, lang = "tsx", title }: CodeProps) {
  const text = code.replace(/^\n+|\s+$/g, "");
  const tokens = useMemo(() => highlight(text, lang), [text, lang]);
  return (
    <div className="code" data-lang={lang}>
      {title && <div className="code-title">{title}</div>}
      <pre tabIndex={0}>
        <code>{tokens}</code>
      </pre>
      <CopyButton text={text} />
    </div>
  );
}

const MANAGERS = [
  ["npm", "npm i"],
  ["pnpm", "pnpm add"],
  ["yarn", "yarn add"],
  ["bun", "bun add"],
] as const;

/** Install command with a tab per package manager. */
export function Install({ pkg }: { pkg: string }) {
  const [pm, setPm] = useState(0);
  const text = `${MANAGERS[pm][1]} ${pkg}`;
  return (
    <div className="code install">
      <div className="install-tabs" role="tablist" aria-label="Package manager">
        {MANAGERS.map(([name], i) => (
          <button key={name} type="button" role="tab" aria-selected={i === pm} onClick={() => setPm(i)}>
            {name}
          </button>
        ))}
      </div>
      <pre tabIndex={0}>
        <code>{highlight(text, "bash")}</code>
      </pre>
      <CopyButton text={text} label="Copy command" />
    </div>
  );
}

/** Inline code */
export function C({ children }: { children: ReactNode }) {
  return <code className="inline">{children}</code>;
}
