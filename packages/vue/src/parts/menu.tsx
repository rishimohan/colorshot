import { defineComponent, Fragment, type VNodeChild } from "vue";
import { CheckIcon } from "../icons";
import { prop } from "../props";
import { usePopup } from "./popup";

export type MenuItem =
  | { type: "heading"; label: VNodeChild }
  | { type: "separator" }
  | {
      type: "radio" | "checkbox" | "action";
      label: VNodeChild;
      /** checked state for radio / checkbox items */
      checked?: boolean;
      disabled?: boolean;
      icon?: VNodeChild;
      /** muted text on the right, e.g. a shortcut */
      hint?: VNodeChild;
      /** spoken name of a symbol hint ("Backspace" for ⌫) */
      hintLabel?: string;
      onSelect: () => void;
    };

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
export const Menu = /* @__PURE__ */ defineComponent({
  name: "PickerMenu",
  props: {
    /** trigger contents, usually an icon */
    trigger: { type: prop<VNodeChild>(), required: true },
    label: { type: String, required: true },
    items: { type: prop<MenuItem[]>(), required: true },
    /** "end" aligns the menu's right edge with the trigger (default) */
    align: { type: prop<"start" | "end">(), default: "end" },
    width: { type: Number, default: 200 },
  },
  setup(props) {
    // the menu takes focus when it opens; arrows then move the active item
    const { open, active, keyboard, placement, rootRef, triggerRef, menuRef, id, close } = usePopup((menu) => menu.focus({ preventScroll: true }));
    const actionable = () =>
      props.items.map((it, i) => (it.type !== "heading" && it.type !== "separator" && !it.disabled ? i : -1)).filter((i) => i !== -1);

    const openMenu = (first: "first" | "last" = "first", byKeyboard = false) => {
      const list = actionable();
      active.value = first === "first" ? list[0] ?? -1 : list[list.length - 1] ?? -1;
      keyboard.value = byKeyboard;
      open.value = true;
    };

    const activate = (i: number) => {
      const it = props.items[i];
      if (!it || it.type === "heading" || it.type === "separator" || it.disabled) return;
      it.onSelect();
      close();
    };

    const move = (dir: 1 | -1) => {
      const list = actionable();
      const pos = list.indexOf(active.value);
      const next = list[(pos + dir + list.length) % list.length];
      if (next !== undefined) active.value = next;
    };

    const onMenuKeyDown = (e: KeyboardEvent) => {
      const list = actionable();
      if (e.key !== "Tab") keyboard.value = true;
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
          active.value = list[0];
          break;
        case "End":
          e.preventDefault();
          active.value = list[list.length - 1];
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          activate(active.value);
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
            const match = list.find((i) => {
              const it = props.items[i];
              return it.type !== "heading" && it.type !== "separator" && typeof it.label === "string" && it.label.toLowerCase().startsWith(e.key.toLowerCase());
            });
            if (match !== undefined) active.value = match;
          }
      }
    };

    const renderRow = (i: number) => {
      const it = props.items[i];
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
          data-active={i === active.value ? "" : undefined}
          onPointermove={() => {
            keyboard.value = false;
            if (!it.disabled && i !== active.value) active.value = i;
          }}
          onPointerdown={(e) => e.preventDefault()}
          onClick={() => activate(i)}
        >
          <span data-part="select-check" aria-hidden="true">
            {it.type === "action" ? it.icon : it.checked ? <CheckIcon /> : null}
          </span>
          <span data-part="select-label">{it.label}</span>
          {it.hint !== undefined ? (
            <span data-part="select-hint" role={it.hintLabel ? "img" : undefined} aria-label={it.hintLabel}>
              {it.hint}
            </span>
          ) : null}
        </div>
      );
    };

    return () => {
      const { label, items } = props;
      const isOpen = open.value;
      return (
        <div ref={rootRef} data-part="menu" data-state={isOpen ? "open" : "closed"} data-align={props.align}>
          <button
            ref={triggerRef}
            type="button"
            data-part="icon-button"
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={isOpen ? `${id}-menu` : undefined}
            data-tooltip={isOpen ? undefined : label}
            data-state={isOpen ? "open" : undefined}
            // a click from the keyboard (Enter / Space) has no pointer position
            onClick={(e: MouseEvent) => (isOpen ? close() : openMenu("first", e.detail === 0))}
            onKeydown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                openMenu(e.key === "ArrowUp" ? "last" : "first", true);
              }
            }}
          >
            {props.trigger}
          </button>
          {isOpen ? (
            <div
              ref={menuRef}
              id={`${id}-menu`}
              role="menu"
              aria-label={label}
              tabindex={-1}
              data-part="select-menu"
              data-placement={placement.value}
              data-nav={keyboard.value ? "keyboard" : undefined}
              aria-activedescendant={active.value >= 0 ? `${id}-${active.value}` : undefined}
              style={{ width: `${props.width}px` }}
              onKeydown={onMenuKeyDown}
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
          ) : null}
        </div>
      );
    };
  },
});
