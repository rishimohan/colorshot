import { defineComponent, watch, type ExtractPublicPropTypes, type VNodeChild } from "vue";
import { CheckIcon, ChevronIcon } from "../icons";
import { bool, prop } from "../props";
import { usePopup } from "./popup";

export interface SelectOption {
  value: string;
  label: VNodeChild;
  /** muted text on the right, e.g. the value in that format */
  hint?: VNodeChild;
  /** text used for typeahead when `label` is not a string */
  text?: string;
}

const selectProps = {
  value: { type: String, required: true as const },
  options: { type: prop<SelectOption[]>(), required: true as const },
  ariaLabel: { type: String, required: true as const },
  /** small heading above the options */
  heading: prop<VNodeChild>(),
  /** muted text per option, computed only while the menu is open */
  getHint: prop<(value: string) => VNodeChild>(),
  /** replace the trigger's contents (e.g. an icon for a "more" menu) */
  trigger: prop<VNodeChild>(),
  /** tooltip on the trigger */
  tooltip: String,
  /** extra rows under the options (actions such as "Copy") */
  footer: prop<(close: () => void) => VNodeChild>(),
  /** menu width; defaults to the trigger width */
  menuWidth: prop<number | string>(),
  /** grow to fill the row */
  grow: /* @__PURE__ */ bool(),
  /** sets `data-kind` on the wrapper for styling */
  kind: String,
};

export type SelectProps = ExtractPublicPropTypes<typeof selectProps>;

/**
 * Listbox select (WAI-ARIA select-only combobox pattern): Enter / Space / arrows open it, arrows move,
 * Enter picks, Escape closes, typing jumps to a match, Home / End go to the ends. Emits `change`.
 */
export const Select = /* @__PURE__ */ defineComponent({
  name: "PickerSelect",
  props: selectProps,
  emits: { change: null as unknown as (value: string) => true },
  setup(props, { emit }) {
    const { open, active, keyboard, placement, rootRef, triggerRef, menuRef: listRef, id, close } = usePopup();
    let typed = { text: "", at: 0 };
    const selectedIndex = () => Math.max(0, props.options.findIndex((o) => o.value === props.value));

    const openMenu = (index = selectedIndex(), byKeyboard = false) => {
      active.value = index;
      keyboard.value = byKeyboard;
      open.value = true;
      // Safari does not focus a button on click; the keyboard needs the trigger focused
      triggerRef.value?.focus({ preventScroll: true });
    };

    watch(
      [open, active],
      ([isOpen, i]) => {
        if (isOpen) listRef.value?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
      },
      { flush: "post" },
    );

    const pick = (i: number) => {
      const o = props.options[i];
      if (o) emit("change", o.value);
      close();
    };

    const typeahead = (key: string) => {
      const now = Date.now();
      typed = { text: (now - typed.at < 600 ? typed.text : "") + key.toLowerCase(), at: now };
      const { options } = props;
      const start = open.value ? active.value : selectedIndex();
      const match = (o: SelectOption) => (o.text ?? (typeof o.label === "string" ? o.label : String(o.value))).toLowerCase();
      for (let k = 1; k <= options.length; k++) {
        const i = (start + k) % options.length;
        if (match(options[i]).startsWith(typed.text)) return i;
      }
      return -1;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const last = props.options.length - 1;
      if (!open.value) {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          openMenu(e.key === "ArrowUp" ? Math.max(0, selectedIndex() - 1) : selectedIndex(), true);
        } else if (e.key.length === 1 && /\S/.test(e.key)) {
          const i = typeahead(e.key);
          if (i !== -1) {
            // a matched key picks an option, so it is not also a picker shortcut
            e.preventDefault();
            emit("change", props.options[i].value);
          }
        }
        return;
      }
      if (e.key !== "Tab") keyboard.value = true;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          active.value = Math.min(last, active.value + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          active.value = Math.max(0, active.value - 1);
          break;
        case "Home":
          e.preventDefault();
          active.value = 0;
          break;
        case "End":
          e.preventDefault();
          active.value = last;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          pick(active.value);
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
            if (i !== -1) active.value = i;
          }
      }
    };

    return () => {
      const { value, options, heading, getHint, trigger, footer, menuWidth } = props;
      const isOpen = open.value;
      const current = options[selectedIndex()];
      // the longest option label; a hidden copy keeps the trigger as wide as it, in the page's font
      const widest = options
        .map((o) => o.text ?? (typeof o.label === "string" ? o.label : String(o.value)))
        .reduce((a, b) => (b.length > a.length ? b : a), "");
      return (
        <div ref={rootRef} data-part="select" data-kind={props.kind} data-grow={props.grow ? "" : undefined} data-state={isOpen ? "open" : "closed"}>
          <button
            ref={triggerRef}
            type="button"
            data-part="select-trigger"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={isOpen ? `${id}-list` : undefined}
            aria-activedescendant={isOpen ? `${id}-${active.value}` : undefined}
            data-kind={trigger ? "icon" : undefined}
            data-tooltip={isOpen ? undefined : props.tooltip}
            aria-label={props.ariaLabel}
            // a click from the keyboard (Enter / Space) has no pointer position
            onClick={(e: MouseEvent) => (isOpen ? close() : openMenu(selectedIndex(), e.detail === 0))}
            onKeydown={onKeyDown}
          >
            {trigger ?? [<span data-part="select-value" data-widest={widest}>{current?.label}</span>, <ChevronIcon data-part="select-chevron" />]}
          </button>
          {isOpen ? (
            <div ref={listRef} data-part="select-menu" data-placement={placement.value} data-nav={keyboard.value ? "keyboard" : undefined} style={menuWidth !== undefined ? { width: typeof menuWidth === "number" ? `${menuWidth}px` : menuWidth } : undefined}>
              {heading ? (
                <div data-part="select-heading" id={`${id}-heading`}>
                  {heading}
                </div>
              ) : null}
              <div id={`${id}-list`} role="listbox" aria-label={props.ariaLabel} data-part="select-list">
                {options.map((o, i) => {
                  const hint = o.hint ?? getHint?.(o.value);
                  return (
                    <div
                      key={o.value}
                      id={`${id}-${i}`}
                      role="option"
                      data-index={i}
                      data-part="select-option"
                      aria-selected={o.value === value}
                      data-active={i === active.value ? "" : undefined}
                      onPointermove={() => {
                        keyboard.value = false;
                        if (i !== active.value) active.value = i;
                      }}
                      onPointerdown={(e) => e.preventDefault()}
                      onClick={() => pick(i)}
                    >
                      <span data-part="select-check" aria-hidden="true">
                        {o.value === value ? <CheckIcon /> : null}
                      </span>
                      <span data-part="select-label">{o.label}</span>
                      {hint !== undefined ? <span data-part="select-hint">{hint}</span> : null}
                    </div>
                  );
                })}
              </div>
              {footer ? <div data-part="select-footer">{footer(() => close())}</div> : null}
            </div>
          ) : null}
        </div>
      );
    };
  },
});
