import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useIsoLayoutEffect } from "../context";
import { CheckIcon, ChevronIcon } from "../icons";

export interface SelectOption<V extends string> {
  value: V;
  label: ReactNode;
  /** muted text on the right, e.g. the value in that format */
  hint?: ReactNode;
  /** text used for typeahead when `label` is not a string */
  text?: string;
}

export interface SelectProps<V extends string> {
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  "aria-label": string;
  /** small heading above the options */
  heading?: ReactNode;
  /** muted text per option, computed only while the menu is open */
  getHint?: (value: V) => ReactNode;
  /** replace the trigger's contents (e.g. an icon for a "more" menu) */
  trigger?: ReactNode;
  /** tooltip on the trigger */
  tooltip?: string;
  /** extra rows under the options (actions such as "Copy") */
  footer?: (close: () => void) => ReactNode;
  /** menu width; defaults to the trigger width */
  menuWidth?: number | string;
  /** grow to fill the row */
  grow?: boolean;
  /** sets `data-kind` on the wrapper for styling */
  kind?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Listbox select (WAI-ARIA select-only combobox pattern): Enter / Space / arrows open it, arrows move,
 * Enter picks, Escape closes, typing jumps to a match, Home / End go to the ends.
 */
export function Select<V extends string>({ value, options, onChange, heading, getHint, trigger, tooltip, footer, menuWidth, grow, kind, className, style, ...aria }: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // the active option gets a focus ring only while the keyboard moves it (the pointer only highlights)
  const [keyboard, setKeyboard] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const id = useId();
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIndex];
  // the longest option label; a hidden copy keeps the trigger as wide as it, in the page's font
  const labelText = (o: SelectOption<V>) => o.text ?? (typeof o.label === "string" ? o.label : String(o.value));
  const widest = options.map(labelText).reduce((a, b) => (b.length > a.length ? b : a), "");

  const close = (focus = true) => {
    setOpen(false);
    if (focus) triggerRef.current?.focus();
  };

  const openMenu = (index = selectedIndex, byKeyboard = false) => {
    setActive(index);
    setKeyboard(byKeyboard);
    setOpen(true);
    // Safari does not focus a button on click; the keyboard needs the trigger focused
    triggerRef.current?.focus({ preventScroll: true });
  };

  // flip above the trigger when there is no room below
  useIsoLayoutEffect(() => {
    if (!open || !rootRef.current || !listRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const h = listRef.current.offsetHeight;
    setPlacement(r.bottom + h + 8 > window.innerHeight && r.top > h + 8 ? "top" : "bottom");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const pick = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    close();
  };

  const typeahead = (key: string) => {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + key.toLowerCase(), at: now };
    const start = open ? active : selectedIndex;
    const match = (o: SelectOption<V>) => (o.text ?? (typeof o.label === "string" ? o.label : String(o.value))).toLowerCase();
    for (let k = 1; k <= options.length; k++) {
      const i = (start + k) % options.length;
      if (match(options[i]).startsWith(typed.current.text)) return i;
    }
    return -1;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu(e.key === "ArrowUp" ? Math.max(0, selectedIndex - 1) : selectedIndex, true);
      } else if (e.key.length === 1 && /\S/.test(e.key)) {
        const i = typeahead(e.key);
        if (i !== -1) {
          // a matched key picks an option, so it is not also a picker shortcut
          e.preventDefault();
          onChange(options[i].value);
        }
      }
      return;
    }
    if (e.key !== "Tab") setKeyboard(true);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
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
          // typing belongs to the open list: the picker's shortcuts (1-4, I) must not fire behind it
          e.preventDefault();
          const i = typeahead(e.key);
          if (i !== -1) setActive(i);
        }
    }
  };

  return (
    <div ref={rootRef} data-part="select" data-kind={kind} data-grow={grow ? "" : undefined} data-state={open ? "open" : "closed"} className={className} style={style}>
      <button
        ref={triggerRef}
        type="button"
        data-part="select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        data-kind={trigger ? "icon" : undefined}
        data-tooltip={open ? undefined : tooltip}
        // a click from the keyboard (Enter / Space) has no pointer position
        onClick={(e) => (open ? close() : openMenu(selectedIndex, e.detail === 0))}
        onKeyDown={onKeyDown}
        {...aria}
      >
        {trigger ?? (
          <>
            <span data-part="select-value" data-widest={widest}>
              {current?.label}
            </span>
            <ChevronIcon data-part="select-chevron" />
          </>
        )}
      </button>
      {open && (
        <div
          ref={listRef}
          data-part="select-menu"
          data-placement={placement}
          data-nav={keyboard ? "keyboard" : undefined}
          style={menuWidth !== undefined ? { width: menuWidth } : undefined}
        >
          {heading && (
            <div data-part="select-heading" id={`${id}-heading`}>
              {heading}
            </div>
          )}
          <div id={`${id}-list`} role="listbox" aria-label={aria["aria-label"]} data-part="select-list">
            {options.map((o, i) => (
              <div
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                data-index={i}
                data-part="select-option"
                aria-selected={o.value === value}
                data-active={i === active ? "" : undefined}
                onPointerMove={() => {
                  setKeyboard(false);
                  if (i !== active) setActive(i);
                }}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
              >
                <span data-part="select-check" aria-hidden>
                  {o.value === value && <CheckIcon />}
                </span>
                <span data-part="select-label">{o.label}</span>
                {(o.hint ?? getHint?.(o.value)) !== undefined && <span data-part="select-hint">{o.hint ?? getHint?.(o.value)}</span>}
              </div>
            ))}
          </div>
          {footer && <div data-part="select-footer">{footer(() => close())}</div>}
        </div>
      )}
    </div>
  );
}
