import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useIsoLayoutEffect } from "../context";
import { CheckIcon } from "../icons";

export type MenuItem =
  | { type: "heading"; label: ReactNode }
  | { type: "separator" }
  | {
      type: "radio" | "checkbox" | "action";
      label: ReactNode;
      /** checked state for radio / checkbox items */
      checked?: boolean;
      disabled?: boolean;
      icon?: ReactNode;
      /** muted text on the right, e.g. a shortcut */
      hint?: ReactNode;
      /** spoken name of a symbol hint ("Backspace" for ⌫) */
      hintLabel?: string;
      onSelect: () => void;
    };

export interface MenuProps {
  /** trigger contents, usually an icon */
  trigger: ReactNode;
  label: string;
  items: MenuItem[];
  /** "end" aligns the menu's right edge with the trigger (default) */
  align?: "start" | "end";
  width?: number;
}

/** Item indexes split into sections: a heading starts a group, a separator ends it. */
function sections(items: MenuItem[]): { heading: number | null; rows: number[] }[] {
  const out: { heading: number | null; rows: number[] }[] = [{ heading: null, rows: [] }];
  items.forEach((it, i) => {
    if (it.type === "heading") out.push({ heading: i, rows: [i] });
    else if (it.type === "separator") out.push({ heading: null, rows: [i] });
    else out[out.length - 1].rows.push(i);
  });
  return out.filter((s) => s.rows.length > 0);
}

/**
 * Menu button (WAI-ARIA menu pattern): Enter / Space / ArrowDown open it, arrows move between items,
 * Home / End jump, Enter / Space activate, Escape closes and returns focus, typing jumps to a match.
 * Items under a heading form a group named by it, up to the next separator.
 */
export function Menu({ trigger, label, items, align = "end", width = 200 }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // the active item gets a focus ring only while the keyboard moves it (the pointer only highlights)
  const [keyboard, setKeyboard] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const actionable = items.map((it, i) => (it.type !== "heading" && it.type !== "separator" && !it.disabled ? i : -1)).filter((i) => i !== -1);

  const close = (focus = true) => {
    setOpen(false);
    if (focus) triggerRef.current?.focus();
  };
  const openMenu = (first: "first" | "last" = "first", byKeyboard = false) => {
    setActive(first === "first" ? actionable[0] ?? -1 : actionable[actionable.length - 1] ?? -1);
    setKeyboard(byKeyboard);
    setOpen(true);
  };

  useIsoLayoutEffect(() => {
    if (!open || !rootRef.current || !menuRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const h = menuRef.current.offsetHeight;
    setPlacement(r.bottom + h + 8 > window.innerHeight && r.top > h + 8 ? "top" : "bottom");
    menuRef.current.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const activate = (i: number) => {
    const it = items[i];
    if (!it || it.type === "heading" || it.type === "separator" || it.disabled) return;
    it.onSelect();
    close();
  };

  const move = (dir: 1 | -1) => {
    const pos = actionable.indexOf(active);
    const next = actionable[(pos + dir + actionable.length) % actionable.length];
    if (next !== undefined) setActive(next);
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") setKeyboard(true);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(actionable[0]);
        break;
      case "End":
        e.preventDefault();
        setActive(actionable[actionable.length - 1]);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        activate(active);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          // typing belongs to the menu: the picker's shortcuts (1-4, I) must not fire behind it
          e.preventDefault();
          const match = actionable.find((i) => {
            const it = items[i];
            return it.type !== "heading" && it.type !== "separator" && typeof it.label === "string" && it.label.toLowerCase().startsWith(e.key.toLowerCase());
          });
          if (match !== undefined) setActive(match);
        }
    }
  };

  const renderRow = (i: number) => {
    const it = items[i];
    if (it.type === "heading")
      return (
        <div key={i} id={`${id}-${i}`} data-part="select-heading">
          {it.label}
        </div>
      );
    if (it.type === "separator") return <div key={i} data-part="menu-separator" role="separator" />;
    const role = it.type === "radio" ? "menuitemradio" : it.type === "checkbox" ? "menuitemcheckbox" : "menuitem";
    return (
      <div
        key={i}
        id={`${id}-${i}`}
        role={role}
        aria-checked={it.type === "action" ? undefined : Boolean(it.checked)}
        aria-disabled={it.disabled || undefined}
        data-part="select-option"
        data-active={i === active ? "" : undefined}
        onPointerMove={() => {
          setKeyboard(false);
          if (!it.disabled && i !== active) setActive(i);
        }}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => activate(i)}
      >
        <span data-part="select-check" aria-hidden>
          {it.type === "action" ? it.icon : it.checked && <CheckIcon />}
        </span>
        <span data-part="select-label">{it.label}</span>
        {it.hint !== undefined && (
          <span data-part="select-hint" role={it.hintLabel ? "img" : undefined} aria-label={it.hintLabel}>
            {it.hint}
          </span>
        )}
      </div>
    );
  };

  return (
    <div ref={rootRef} data-part="menu" data-state={open ? "open" : "closed"} data-align={align}>
      <button
        ref={triggerRef}
        type="button"
        data-part="icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        data-tooltip={open ? undefined : label}
        data-state={open ? "open" : undefined}
        // a click from the keyboard (Enter / Space) has no pointer position
        onClick={(e) => (open ? close() : openMenu("first", e.detail === 0))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu(e.key === "ArrowUp" ? "last" : "first", true);
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          data-part="select-menu"
          data-placement={placement}
          data-nav={keyboard ? "keyboard" : undefined}
          aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
          style={{ width }}
          onKeyDown={onMenuKeyDown}
        >
          {sections(items).map((section, k) =>
            section.heading === null ? (
              <Fragment key={k}>{section.rows.map(renderRow)}</Fragment>
            ) : (
              <div key={k} data-part="menu-group" role="group" aria-labelledby={`${id}-${section.heading}`}>
                {section.rows.map(renderRow)}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
