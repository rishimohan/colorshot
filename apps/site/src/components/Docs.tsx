import { useEffect, type ReactNode } from "react";
import { Code } from "./Code";
import type { Lang } from "../lib/highlight";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Colorshot` : "Colorshot · Color and gradient picker for React and Vue";
  }, [title]);
}

export function PageHeader({ title, lead, eyebrow }: { title: string; lead: ReactNode; eyebrow?: string }) {
  useTitle(title);
  return (
    <header className="page-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
    </header>
  );
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function H2({ children, id }: { children: string; id?: string }) {
  const anchor = id ?? slugify(children);
  return (
    <h2 id={anchor}>
      <a href={`#${anchor}`} className="anchor">
        {children}
      </a>
    </h2>
  );
}

export function H3({ children, id }: { children: string; id?: string }) {
  const anchor = id ?? slugify(children);
  return (
    <h3 id={anchor}>
      <a href={`#${anchor}`} className="anchor">
        {children}
      </a>
    </h3>
  );
}

/** A live demo with its source below. */
export function Example({
  children,
  code,
  lang = "tsx",
  caption,
  align = "center",
}: {
  children: ReactNode;
  code?: string;
  lang?: Lang;
  caption?: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <figure className="example">
      <div className="example-preview" data-align={align}>
        {children}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
      {code && <Code code={code} lang={lang} />}
    </figure>
  );
}

export interface PropRow {
  name: string;
  type: string;
  default?: string;
  description: ReactNode;
}

export function PropTable({ rows, label = "Prop" }: { rows: PropRow[]; label?: string }) {
  return (
    <div className="table-wrap">
      <table className="props">
        <thead>
          <tr>
            <th scope="col">{label}</th>
            <th scope="col">Type</th>
            <th scope="col">Default</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td data-label={label}>
                <code className="prop-name">{r.name}</code>
              </td>
              <td data-label="Type">
                <code className="prop-type">{r.type}</code>
              </td>
              <td data-label="Default" data-empty={r.default ? undefined : ""}>{r.default ? <code className="prop-default">{r.default}</code> : <span className="muted">-</span>}</td>
              <td data-label="Description">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Simple two or three column table. */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table className="simple">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} data-label={head[j]}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className="note" data-tone={tone}>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

/** Shows a live CSS value under a demo. */
export function ValueReadout({ value, label = "value" }: { value: string; label?: string }) {
  return (
    <div className="readout">
      <span className="readout-label">{label}</span>
      <code>{value || '""'}</code>
    </div>
  );
}
