import { computed, defineComponent, nextTick, onMounted, ref, useId, watchPostEffect, type ComputedRef, type VNodeChild } from "vue";
import { colorKey, isGradient, isSafeCssValue, parseColor, parseLayers, safeCssValue, toHexDigits } from "@colorshot/core";
import { usePicker, usePickerContext, type PickerContextValue } from "../context";
import { CloseIcon, PlusIcon, SearchIcon } from "../icons";
import { fill } from "../labels";
import { bool, prop } from "../props";
import { isRtl } from "../use-drag";

export interface Swatch {
  value: string;
  /** shown as a tooltip */
  label?: string;
  /** your id, passed back to `onRemove` */
  id?: string;
}

export interface SwatchGroupConfig {
  id: string;
  label?: VNodeChild;
  /** colors or gradients; `"default"` uses the built-in palette */
  colors?: (string | Swatch)[] | "default";
  /** let Colorshot keep recent colors (stored under the root `storageKey`) */
  recent?: boolean;
  /** shows a + button that saves the current value */
  onAdd?: (value: string) => void;
  /** shows a remove button on hover (always on touch screens) and enables Delete on a focused swatch */
  onRemove?: (swatch: Swatch) => void;
  /** show at most this many, with a "Show all" toggle */
  limit?: number;
  /** custom swatch rendering */
  renderSwatch?: (swatch: Swatch, state: { selected: boolean }) => VNodeChild;
  /** only show this group for solid colors or for gradients */
  showIn?: "solid" | "gradient";
  /** drag swatches (or Alt + arrow keys) to reorder; called with the new order */
  onReorder?: (swatches: Swatch[]) => void;
  /** double-click or F2 renames a swatch */
  onRename?: (swatch: Swatch, label: string) => void;
  /** text shown when the group is empty (defaults to a hint about the + button) */
  emptyText?: VNodeChild;
}

export const DEFAULT_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(180deg, #fdfbfb 0%, #ebedee 100%)",
  "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
  "radial-gradient(circle at 30% 30%, #fde68a 0%, #f97316 100%)",
  "conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)",
];

export const DEFAULT_PALETTE = [
  "#000000",
  "#545454",
  "#a6a6a6",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
];

const normalize = (s: string | Swatch): Swatch => (s && typeof s === "object" ? s : { value: s as string });

/** Drag type for a swatch dropped onto the gradient bar. */
export const SWATCH_DRAG_TYPE = "application/x-colorshot-color";

const REORDER_TYPE = "application/x-colorshot-swatch";

type Item = Swatch & { key: string; hex: string; gradient: boolean };

const swatchText = (v: string | Swatch) =>
  v && typeof v === "object" ? `${v.value}\u0000${v.id ?? ""}\u0000${v.label ?? ""}` : String(v);

const colorsKeys = /* @__PURE__ */ new WeakMap<object, string>();
/** The content of a group's colors as one string, cached per array (stable arrays are only joined once). */
function colorsKey(colors: SwatchGroupConfig["colors"]): string {
  if (!colors || colors === "default") return colors ?? "";
  let key = colorsKeys.get(colors);
  if (key === undefined) colorsKeys.set(colors, (key = colors.map(swatchText).join("\u0001")));
  return key;
}

const CALLBACKS = ["onAdd", "onRemove", "onReorder", "onRename", "renderSwatch"] as const;

/** Same content: callbacks only count by whether they are there, since the latest ones are always called. */
function sameGroup(a: SwatchGroupConfig, b: SwatchGroupConfig): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    Object.is(a.label, b.label) &&
    Object.is(a.emptyText, b.emptyText) &&
    a.limit === b.limit &&
    a.showIn === b.showIn &&
    Boolean(a.recent) === Boolean(b.recent) &&
    CALLBACKS.every((k) => !a[k] === !b[k]) &&
    (a.colors === b.colors || colorsKey(a.colors) === colorsKey(b.colors))
  );
}

/** A copy of the group whose callbacks look up the host's latest group when they run. */
function delegate(g: SwatchGroupConfig, find: (id: string) => SwatchGroupConfig | undefined): SwatchGroupConfig {
  const out: SwatchGroupConfig = { ...g };
  for (const k of CALLBACKS) {
    if (g[k]) out[k] = ((...args: unknown[]) => (find(g.id)?.[k] as ((...a: unknown[]) => unknown) | undefined)?.(...args)) as never;
  }
  return out;
}

/**
 * Groups that keep their identity while their content stays the same, so the swatches do not re-render when a host
 * passes a new array (with new callbacks) on every render. The callbacks always call the host's latest ones.
 */
export function stableGroups(source: () => SwatchGroupConfig[]): ComputedRef<SwatchGroupConfig[]> {
  let last: SwatchGroupConfig[] = [];
  // read when a callback fires, so it is always the host's latest
  const find = (id: string) => source().find((g) => g.id === id);
  return computed<SwatchGroupConfig[]>((prev) => {
    const groups = source();
    if (prev && last.length === groups.length && groups.every((g, i) => sameGroup(last[i], g))) return prev;
    last = groups;
    return groups.map((g) => delegate(g, find));
  });
}

/** The current value's color key, worked out once per value and shared by every group. */
let keyedValue: string | null = null;
let valueKey = "";
function currentKeyOf(value: string): string {
  if (value !== keyedValue) {
    keyedValue = value;
    valueKey = colorKey(value);
  }
  return valueKey;
}

/** The group's swatches, parsed once per list, not on every drag frame. Gradients are hidden when the field only allows solid colors. */
function groupItems(ctx: PickerContextValue, group: () => SwatchGroupConfig) {
  let lastKey = "";
  return computed<Item[]>((prev) => {
    const g = group();
    const source = g.recent ? ctx.recent.list() : g.colors === "default" ? DEFAULT_PALETTE : g.colors ?? [];
    const modes = ctx.store.modes;
    // keyed on content: hosts often pass a new array every render
    const key = source.map(swatchText).join("\u0001") + modes.join();
    if (prev && key === lastKey) return prev;
    lastKey = key;
    // swatches come from the host (often its database): only plain colors and gradients are shown
    const allowed = (value: string) => {
      if (typeof value !== "string" || !isSafeCssValue(value)) return false;
      if (!isGradient(value)) return parseColor(value) !== null;
      return parseLayers(value).every((l) => l.kind === "gradient" && modes.includes(l.gradient.type));
    };
    return source
      .map(normalize)
      // saved data can hold anything: only non-empty text becomes a swatch
        .filter((s) => typeof s.value === "string" && s.value !== "" && allowed(s.value))
      .map((s) => {
        const parsed = isGradient(s.value) ? null : parseColor(s.value);
        return { ...s, key: colorKey(s.value), hex: parsed ? toHexDigits(parsed.color) : "", gradient: !parsed };
      });
  });
}

function filterItems(items: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const hex = q.replace(/^#/, "");
  const hexQuery = /^[0-9a-f]{1,6}$/.test(hex);
  return items.filter(
    (s) => (s.label ?? "").toLowerCase().includes(q) || s.value.toLowerCase().includes(q) || (hexQuery && s.hex.toLowerCase().startsWith(hex)),
  );
}

const SWATCH = "[data-part='swatch']";

/** After a swatch is removed (when the host updates at once), focus the one now in its place, or the previous one, or +. */
function focusAfterRemove(button: HTMLElement) {
  const grid = button.closest<HTMLElement>("[data-part='swatch-grid']");
  if (!grid) return;
  const i = Array.from(grid.querySelectorAll(SWATCH)).indexOf(button);
  requestAnimationFrame(() => {
    if (button.isConnected || !grid.isConnected) return;
    const now = grid.querySelectorAll<HTMLElement>(SWATCH);
    (now[i] ?? now[i - 1] ?? grid.querySelector<HTMLElement>("[data-part='swatch-add']"))?.focus();
  });
}

const SwatchGroup = /* @__PURE__ */ defineComponent({
  name: "PickerSwatchGroup",
  props: {
    group: { type: prop<SwatchGroupConfig>(), required: true },
    query: { type: String, required: true },
    /** in tabs layout the group label is the tab, and every swatch is shown */
    tabbed: Boolean,
    /** renders a control at the end of the label row (the search button on the first group); a stable function, so it does not re-render the group */
    action: prop<() => VNodeChild>(),
    /** in tabs layout the grid is the tab panel (this id), named by the active tab (that id) */
    panelId: String,
    tabId: String,
  },
  setup(props) {
    const ctx = usePickerContext();
    const { store } = ctx;
    const solidMode = usePicker((st) => st.mode === "solid");
    const items = groupItems(ctx, () => props.group);
    const keys = computed(() => new Set(items.value.map((s) => s.key)));
    // only a color in this group counts, so dragging through other colors does not re-render the group
    const currentKey = usePicker((st) => {
      const key = currentKeyOf(st.value);
      return keys.value.has(key) ? key : null;
    });
    const expanded = ref(false);
    const renaming = ref<number | null>(null);
    const dropAt = ref<number | null>(null);
    const matches = computed(() => filterItems(items.value, props.query));
    let renameInput: HTMLInputElement | null = null;
    // the swatch being renamed gets focus back when the name field closes from the keyboard
    let renamed: HTMLElement | null = null;
    const startRename = (index: number, el: HTMLElement) => {
      renamed = el;
      renaming.value = index;
    };
    const endRename = (refocus: boolean) => {
      renaming.value = null;
      const el = renamed;
      if (refocus && el) requestAnimationFrame(() => el.isConnected && el.focus());
    };

    const strip = ({ key: _k, hex: _h, gradient: _g, ...rest }: Item): Swatch => rest;
    const reorder = (from: number, to: number) => {
      const { group } = props;
      if (!group.onReorder || from === to) return;
      const list = items.value.map(strip);
      const [moved] = list.splice(from, 1);
      list.splice(to > from ? to - 1 : to, 0, moved);
      group.onReorder(list);
    };

    // arrow keys move between swatches; only one swatch per group is in the tab order
    const onGridKeyDown = (e: KeyboardEvent) => {
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
      if (!keys.includes(e.key) || e.defaultPrevented || e.altKey) return;
      const grid = e.currentTarget as HTMLElement;
      const els = Array.from(grid.querySelectorAll<HTMLElement>(SWATCH));
      const i = els.indexOf(document.activeElement as HTMLElement);
      if (i === -1) return;
      e.preventDefault();
      const cols = els.filter((el) => el.offsetTop === els[0].offsetTop).length || 1;
      // the grid runs right to left in RTL, so Left goes forward there
      const ahead = isRtl(grid) ? -1 : 1;
      const step = { ArrowLeft: -ahead, ArrowRight: ahead, ArrowUp: -cols, ArrowDown: cols, Home: -i, End: els.length - 1 - i }[e.key]!;
      els[Math.min(els.length - 1, Math.max(0, i + step))]?.focus();
    };

    // focus the rename field and fill it once when it appears; after that it is the user's text
    const renameRef = (el: unknown) => {
      const input = el as HTMLInputElement | null;
      if (input && input !== renameInput && renaming.value !== null) {
        input.value = items.value[renaming.value]?.label ?? "";
        // refs run before a new subtree is attached; focus once it is in the document
        nextTick(() => input.focus());
      }
      renameInput = input;
    };

    return () => {
      const { group, query, tabbed } = props;
      const current = currentKey.value;
      const labels = ctx.labels;
      const all = items.value;
      const found = matches.value;
      const q = query.trim();
      const limited = group.limit && !expanded.value && !q && !tabbed ? found.slice(0, group.limit) : found;
      const selectedIndex = limited.findIndex((s) => s.key === current);
      if (group.showIn && (group.showIn === "solid") !== solidMode.value) return null;
      if (found.length === 0 && q) return null;
      if (found.length === 0 && !group.onAdd && !tabbed) return null;

      const canRename = Boolean(group.onRename);
      const shortcuts =
        [group.onRemove && "Delete", canRename && "F2", group.onReorder && "Alt+ArrowLeft Alt+ArrowRight"].filter(Boolean).join(" ") || undefined;
      const r = renaming.value;
      const item = r !== null ? all[r] : undefined;
      const more = group.limit && !q && all.length > group.limit;

      return (
        <div data-part="swatch-group" data-group={group.id} data-tabbed={tabbed ? "" : undefined}>
          {!tabbed && (group.label || props.action || more) ? (
            <div data-part="swatch-group-header">
              {group.label ? <span data-part="swatch-group-label">{group.label}</span> : null}
              {more ? (
                <button type="button" data-part="link-button" aria-expanded={expanded.value} onClick={() => (expanded.value = !expanded.value)}>
                  {expanded.value ? labels.showLess : fill(labels.showAllCount, { count: all.length })}
                </button>
              ) : null}
              {props.action?.() ?? null}
            </div>
          ) : null}
          <div
            data-part="swatch-grid"
            role={props.panelId ? "tabpanel" : "group"}
            id={props.panelId}
            aria-labelledby={props.panelId ? props.tabId : undefined}
            aria-label={props.panelId ? undefined : typeof group.label === "string" ? group.label : labels.swatchGroup}
            onKeydown={onGridKeyDown}
          >
            {limited.map((s, i) => {
              const selected = s.key === current;
              const tabStop = selectedIndex === -1 ? i === 0 : i === selectedIndex;
              const index = all.indexOf(s);
              return (
                <div
                  key={`${s.id ?? s.value}-${i}`}
                  data-part="swatch-cell"
                  data-drop={dropAt.value === index ? "" : undefined}
                  onDragover={(e) => {
                    if (!group.onReorder || !e.dataTransfer?.types.includes(REORDER_TYPE)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    dropAt.value = index;
                  }}
                  onDragleave={() => (dropAt.value = null)}
                  onDrop={(e) => {
                    const raw = e.dataTransfer?.getData(REORDER_TYPE);
                    dropAt.value = null;
                    if (!raw) return;
                    let from: { group?: unknown; index?: unknown };
                    try {
                      from = JSON.parse(raw);
                    } catch {
                      return;
                    }
                    if (from?.group !== group.id || !Number.isInteger(from.index) || (from.index as number) < 0 || (from.index as number) >= all.length) return;
                    e.preventDefault();
                    reorder(from.index as number, index);
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    data-part="swatch"
                    tabindex={tabStop ? 0 : -1}
                    data-state={selected ? "selected" : undefined}
                    data-checker=""
                    title={s.label ?? s.value}
                    aria-label={s.label ?? s.value}
                    aria-keyshortcuts={shortcuts}
                    style={{ "--_cs-swatch": safeCssValue(s.value) }}
                    onClick={() => store.applySwatch(s.value)}
                    onDblclick={(e: MouseEvent) => canRename && startRename(index, e.currentTarget as HTMLElement)}
                    // solid swatches can be dropped on the gradient bar; reorderable groups can be rearranged
                    draggable={!s.gradient || Boolean(group.onReorder)}
                    onDragstart={(e) => {
                      const dt = e.dataTransfer;
                      if (!dt) return;
                      if (!s.gradient) dt.setData(SWATCH_DRAG_TYPE, s.value);
                      if (group.onReorder) dt.setData(REORDER_TYPE, JSON.stringify({ group: group.id, index }));
                      dt.setData("text/plain", s.value);
                      dt.effectAllowed = "copyMove";
                    }}
                    onKeydown={(e) => {
                      const button = e.currentTarget as HTMLElement;
                      if (group.onRemove && (e.key === "Delete" || e.key === "Backspace")) {
                        e.preventDefault();
                        group.onRemove(strip(s));
                        focusAfterRemove(button);
                      } else if (canRename && e.key === "F2") {
                        e.preventDefault();
                        startRename(index, button);
                      } else if (group.onReorder && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                        // Alt + arrows move the swatch one place, the keyboard way to drag it
                        e.preventDefault();
                        const forward = (e.key === "ArrowRight") !== isRtl(button);
                        if (forward ? index >= all.length - 1 : index <= 0) return;
                        reorder(index, forward ? index + 2 : index - 1);
                        const grid = button.closest<HTMLElement>("[data-part='swatch-grid']");
                        // focus follows the swatch to its new place
                        requestAnimationFrame(() => grid?.querySelectorAll<HTMLElement>(SWATCH)[forward ? i + 1 : i - 1]?.focus());
                      }
                    }}
                  >
                    {group.renderSwatch?.(strip(s), { selected })}
                  </button>
                  {group.onRemove ? (
                    <button
                      type="button"
                      data-part="swatch-remove"
                      tabindex={-1}
                      title={labels.removeSwatch}
                      aria-label={`${labels.removeSwatch} ${s.label ?? s.value}`}
                      onClick={() => group.onRemove!(strip(s))}
                    >
                      <CloseIcon />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {group.onAdd && !q ? (
              <button
                type="button"
                data-part="swatch-add"
                data-tooltip={labels.addSwatch}
                aria-label={labels.addSwatch}
                onClick={() => group.onAdd!(store.getState().value)}
              >
                <PlusIcon />
              </button>
            ) : null}
            {found.length === 0 && !q ? (
              <p data-part="swatch-empty-hint">{group.emptyText ?? (group.onAdd ? labels.emptyWithAdd : labels.emptyGroup)}</p>
            ) : null}
          </div>
          {item ? (
            <form
              data-part="swatch-rename"
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget as HTMLFormElement).elements.namedItem("name") as HTMLInputElement;
                group.onRename?.(strip(item), input.value.trim());
                // Enter keeps the keyboard on the swatch; a blur (focus moved on) leaves focus where it went
                endRename(document.activeElement === input);
              }}
            >
              <span data-part="swatch-rename-swatch" style={{ "--_cs-swatch": safeCssValue(item.value) }} aria-hidden="true" />
              <input
                ref={renameRef}
                name="name"
                data-part="swatch-rename-input"
                aria-label={labels.renameSwatch}
                placeholder={labels.renameSwatch}
                onBlur={(e) => (e.currentTarget as HTMLInputElement).form?.requestSubmit()}
                onKeydown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    endRename(true);
                  }
                }}
              />
            </form>
          ) : null}
        </div>
      );
    };
  },
});

/** Swatch groups: brand, saved, document, recent, presets. Clicking applies; gradients replace the value. */
export const Swatches = /* @__PURE__ */ defineComponent({
  name: "PickerSwatches",
  props: {
    groups: { type: prop<SwatchGroupConfig[]>(), required: true },
    /** a search toggle that filters every group by name, value or hex */
    search: /* @__PURE__ */ bool(),
    /** `"tabs"` (default with 2+ groups): one grid with a tab per group. `"stack"`: every group listed */
    layout: prop<"tabs" | "stack">(),
  },
  setup(props) {
    const ctx = usePickerContext();
    const { storage, recent } = ctx;
    const groups = stableGroups(() => props.groups);
    const solidMode = usePicker((s) => s.mode === "solid");
    const query = ref("");
    const searchOpen = ref(false);
    const tab = ref<string | null>(null);
    const setTab = (id: string) => {
      tab.value = id;
      storage.set("swatch-tab", id);
    };
    // the stored tab is applied after mount (before paint), so the first client render matches the server's
    onMounted(() => {
      const saved = storage.get("swatch-tab");
      if (saved) tab.value = saved;
    });
    const visible = computed(() =>
      groups.value.filter(
        (g) =>
          (!g.showIn || (g.showIn === "solid") === solidMode.value) &&
          (g.onAdd || (g.recent ? recent.list().length > 0 : g.colors === "default" || (g.colors?.length ?? 0) > 0)),
      ),
    );
    const tabsShown = computed(() => (props.layout ?? (visible.value.length > 1 ? "tabs" : "stack")) === "tabs" && visible.value.length > 1);
    const activeGroup = computed(() => visible.value.find((g) => g.id === tab.value) ?? visible.value[0]);

    // more tabs than fit: they scroll, the edges fade, and the active tab is kept in view
    const tabsRef = ref<HTMLDivElement | null>(null);
    const overflow = ref<"" | "start" | "end" | "both">("");
    const updateOverflow = () => {
      const el = tabsRef.value;
      if (!el) return;
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      overflow.value = start && end ? "both" : start ? "start" : end ? "end" : "";
    };
    watchPostEffect((onCleanup) => {
      void activeGroup.value?.id;
      void tabsShown.value;
      const el = tabsRef.value;
      if (!el) return;
      // scroll only the tab strip (scrollIntoView could scroll the page too)
      const tabEl = el.querySelector<HTMLElement>('[data-state="active"]');
      if (tabEl) {
        const left = tabEl.offsetLeft - el.offsetLeft;
        if (left < el.scrollLeft) el.scrollLeft = left - 8;
        else if (left + tabEl.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = left + tabEl.offsetWidth - el.clientWidth + 8;
      }
      updateOverflow();
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateOverflow) : null;
      ro?.observe(el);
      onCleanup(() => ro?.disconnect());
    });

    const uid = useId();
    const searchToggleRef = ref<HTMLButtonElement | null>(null);
    // closing the search puts focus back on the button that opened it
    const closeSearch = () => {
      query.value = "";
      searchOpen.value = false;
      nextTick(() => searchToggleRef.value?.focus());
    };
    // focus the search field once when it opens
    let searchInput: HTMLInputElement | null = null;
    const searchRef = (el: unknown) => {
      const input = el as HTMLInputElement | null;
      if (input && input !== searchInput) nextTick(() => input.focus());
      searchInput = input;
    };

    // a stable function: the group that shows the button is not re-rendered for it
    const renderToggle = () => (
      <button
        ref={searchToggleRef}
        type="button"
        data-part="icon-button"
        data-size="sm"
        aria-label={ctx.labels.searchSwatches}
        data-tooltip={ctx.labels.searchSwatches}
        onClick={() => (searchOpen.value = true)}
      >
        <SearchIcon />
      </button>
    );

    return () => {
      const { search } = props;
      const labels = ctx.labels;
      const shown = visible.value;
      const tabs = tabsShown.value;
      const active = activeGroup.value;
      const tabIndex = Math.max(0, shown.indexOf(active));
      const searching = Boolean(search && searchOpen.value);
      const searchToggle = search ? renderToggle() : null;

      return (
        <div data-part="swatches" data-layout={tabs ? "tabs" : "stack"}>
          {searching ? (
            <label data-part="swatch-search">
              <SearchIcon aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                data-part="swatch-search-input"
                placeholder={labels.searchSwatches}
                aria-label={labels.searchSwatches}
                value={query.value}
                spellcheck={false}
                autocomplete="off"
                onInput={(e) => (query.value = (e.target as HTMLInputElement).value)}
                onKeydown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    closeSearch();
                  }
                }}
              />
              <button type="button" data-part="icon-button" data-size="sm" aria-label={labels.closeSearch} onClick={closeSearch}>
                <CloseIcon />
              </button>
            </label>
          ) : tabs ? (
            <div data-part="swatch-header">
              <div
                ref={tabsRef}
                data-part="swatch-tabs"
                role="tablist"
                aria-label={labels.swatchGroups}
                data-overflow={overflow.value || undefined}
                onScroll={updateOverflow}
                onKeydown={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  const n = shown.length;
                  const rtl = isRtl(el);
                  let next: number | null = null;
                  if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (tabIndex + 1) % n;
                  else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (tabIndex - 1 + n) % n;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = n - 1;
                  if (next === null) return;
                  e.preventDefault();
                  setTab(shown[next].id);
                  el.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
                }}
              >
                {shown.map((g, i) => (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    id={`${uid}-tab-${i}`}
                    aria-controls={`${uid}-panel`}
                    data-tab={g.id}
                    aria-selected={g === active}
                    data-state={g === active ? "active" : "inactive"}
                    tabindex={g === active ? 0 : -1}
                    onClick={() => setTab(g.id)}
                  >
                    {g.label ?? g.id}
                  </button>
                ))}
              </div>
              {searchToggle}
            </div>
          ) : searchToggle && !visible.value[0]?.label ? (
            // stacked: the search button sits on the first group's label row, or on its own row without a label
            <div data-part="swatch-header" data-align="end">
              {searchToggle}
            </div>
          ) : null}
          {tabs && !searching ? (
            <SwatchGroup
              key={active.id}
              group={active}
              query=""
              tabbed
              panelId={`${uid}-panel`}
              tabId={`${uid}-tab-${tabIndex}`}
            />
          ) : (
            groups.value.map((g) => (
              <SwatchGroup
                key={g.id}
                group={g}
                query={searching ? query.value : ""}
                action={search && !searching && g === shown[0] && g.label ? renderToggle : undefined}
              />
            ))
          )}
          {searching ? (
            <p data-part="swatch-empty" role="status">
              {query.value.trim() ? labels.noMatches : null}
            </p>
          ) : null}
        </div>
      );
    };
  },
});
