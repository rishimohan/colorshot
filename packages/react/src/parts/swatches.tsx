import { memo, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { colorKey, isGradient, isSafeCssValue, parseColor, parseLayers, safeCssValue, toHexDigits } from "@colorshot/core";
import { useIsoLayoutEffect, usePicker, usePickerContext } from "../context";
import { CloseIcon, PlusIcon, SearchIcon } from "../icons";
import { fill } from "../labels";
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
  label?: ReactNode;
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
  renderSwatch?: (swatch: Swatch, state: { selected: boolean }) => ReactNode;
  /** only show this group for solid colors or for gradients */
  showIn?: "solid" | "gradient";
  /** drag swatches (or Alt + arrow keys) to reorder; called with the new order */
  onReorder?: (swatches: Swatch[]) => void;
  /** double-click or F2 renames a swatch */
  onRename?: (swatch: Swatch, label: string) => void;
  /** text shown when the group is empty (defaults to a hint about the + button) */
  emptyText?: ReactNode;
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

function useAllowed() {
  const { store } = usePickerContext();
  const modes = store.modes;
  return (value: string) => {
    // swatches come from the host (often its database): only plain colors and gradients are shown
    if (typeof value !== "string" || !isSafeCssValue(value)) return false;
    if (!isGradient(value)) return parseColor(value) !== null;
    const layers = parseLayers(value);
    return layers.every((l) => l.kind === "gradient" && modes.includes(l.gradient.type));
  };
}

/** Drag type for a swatch dropped onto the gradient bar. */
export const SWATCH_DRAG_TYPE = "application/x-colorshot-color";

const REORDER_TYPE = "application/x-colorshot-swatch";

type Item = Swatch & { key: string; hex: string; gradient: boolean };

/** The server has no stored recent colors: the first client render shows none either, so hydration matches. */
const NO_RECENT: string[] = [];
const noRecent = () => NO_RECENT;
const noRecentCount = () => 0;
const noSubscribe = () => () => {};

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
export function useStableGroups(groups: SwatchGroupConfig[]): SwatchGroupConfig[] {
  const latest = useRef(groups);
  latest.current = groups;
  const stable = useRef<{ source: SwatchGroupConfig[]; groups: SwatchGroupConfig[] } | null>(null);
  const prev = stable.current;
  if (!prev || prev.source.length !== groups.length || !groups.every((g, i) => sameGroup(prev.source[i], g))) {
    const find = (id: string) => latest.current.find((g) => g.id === id);
    stable.current = {
      source: groups,
      groups: groups.map((g) => delegate(g, find)),
    };
  }
  return stable.current!.groups;
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

function useGroupItems(group: SwatchGroupConfig): Item[] {
  const { store, recent } = usePickerContext();
  // only the recent group follows the recent colors (a new one is added after every interaction)
  const recentList = useSyncExternalStore(group.recent ? recent.subscribe : noSubscribe, group.recent ? recent.list : noRecent, noRecent);
  const allowed = useAllowed();
  const source = group.recent ? recentList : group.colors === "default" ? DEFAULT_PALETTE : group.colors ?? [];
  // parsed once per list, not on every drag frame; gradients are hidden when the field only allows solid colors
  return useMemo(
    () =>
      source
        .map(normalize)
        // saved data can hold anything: only non-empty text becomes a swatch
        .filter((s) => typeof s.value === "string" && s.value !== "" && allowed(s.value))
        .map((s) => {
          const parsed = isGradient(s.value) ? null : parseColor(s.value);
          return { ...s, key: colorKey(s.value), hex: parsed ? toHexDigits(parsed.color) : "", gradient: !parsed };
        }),
    // keyed on content: hosts often pass a new array every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source.map(swatchText).join("\u0001"), store.modes.join()],
  );
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

interface GroupProps {
  group: SwatchGroupConfig;
  query: string;
  /** in tabs layout the group label is the tab, and every swatch is shown */
  tabbed?: boolean;
  /** a control at the end of the label row (the search button on the first group) */
  action?: ReactNode;
  /** in tabs layout the grid is the tab panel (this id), named by the active tab (that id) */
  panelId?: string;
  tabId?: string;
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

const SwatchGroup = /* @__PURE__ */ memo(function SwatchGroup({ group, query, tabbed, action, panelId, tabId }: GroupProps) {
  const { store, labels } = usePickerContext();
  const solidMode = usePicker((st) => st.mode === "solid");
  const items = useGroupItems(group);
  const keys = useMemo(() => new Set(items.map((s) => s.key)), [items]);
  // only a color in this group counts, so dragging through other colors does not re-render the group
  const currentKey = usePicker((st) => {
    const key = currentKeyOf(st.value);
    return keys.has(key) ? key : null;
  });
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  // the swatch being renamed gets focus back when the name field closes from the keyboard
  const renamed = useRef<HTMLElement | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const matches = useMemo(() => filterItems(items, query), [items, query]);
  const q = query.trim();
  const limited = group.limit && !expanded && !q && !tabbed ? matches.slice(0, group.limit) : matches;
  const selectedIndex = limited.findIndex((s) => s.key === currentKey);
  if (group.showIn && (group.showIn === "solid") !== solidMode) return null;
  if (matches.length === 0 && q) return null;
  if (matches.length === 0 && !group.onAdd && !tabbed) return null;

  const apply = (s: Swatch) => store.applySwatch(s.value);
  const strip = ({ key: _k, hex: _h, gradient: _g, ...rest }: Item): Swatch => rest;
  const reorder = (from: number, to: number) => {
    if (!group.onReorder || from === to) return;
    const list = items.map(strip);
    const [moved] = list.splice(from, 1);
    list.splice(to > from ? to - 1 : to, 0, moved);
    group.onReorder(list);
  };
  const canRename = Boolean(group.onRename);
  const startRename = (index: number, el: HTMLElement) => {
    renamed.current = el;
    setRenaming(index);
  };
  const endRename = (refocus: boolean) => {
    setRenaming(null);
    const el = renamed.current;
    if (refocus && el) requestAnimationFrame(() => el.isConnected && el.focus());
  };
  const shortcuts =
    [group.onRemove && "Delete", canRename && "F2", group.onReorder && "Alt+ArrowLeft Alt+ArrowRight"].filter(Boolean).join(" ") || undefined;

  return (
    <div data-part="swatch-group" data-group={group.id} data-tabbed={tabbed ? "" : undefined}>
      {!tabbed && (group.label || action || (group.limit && !q && items.length > group.limit)) && (
        <div data-part="swatch-group-header">
          {group.label && <span data-part="swatch-group-label">{group.label}</span>}
          {group.limit && !q && items.length > group.limit && (
            <button type="button" data-part="link-button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
              {expanded ? labels.showLess : fill(labels.showAllCount, { count: items.length })}
            </button>
          )}
          {action}
        </div>
      )}
      <div
        data-part="swatch-grid"
        role={panelId ? "tabpanel" : "group"}
        id={panelId}
        aria-labelledby={panelId ? tabId : undefined}
        aria-label={panelId ? undefined : typeof group.label === "string" ? group.label : labels.swatchGroup}
        onKeyDown={(e) => {
          // arrow keys move between swatches; only one swatch per group is in the tab order
          const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
          if (!keys.includes(e.key) || e.defaultPrevented || e.altKey) return;
          const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(SWATCH));
          const i = els.indexOf(document.activeElement as HTMLElement);
          if (i === -1) return;
          e.preventDefault();
          const cols = els.filter((el) => el.offsetTop === els[0].offsetTop).length || 1;
          // the grid runs right to left in RTL, so Left goes forward there
          const ahead = isRtl(e.currentTarget) ? -1 : 1;
          const step = { ArrowLeft: -ahead, ArrowRight: ahead, ArrowUp: -cols, ArrowDown: cols, Home: -i, End: els.length - 1 - i }[e.key]!;
          els[Math.min(els.length - 1, Math.max(0, i + step))]?.focus();
        }}
      >
        {limited.map((s, i) => {
          const selected = s.key === currentKey;
          const tabStop = selectedIndex === -1 ? i === 0 : i === selectedIndex;
          const index = items.indexOf(s);
          return (
            <div
              key={`${s.id ?? s.value}-${i}`}
              data-part="swatch-cell"
              data-drop={dropAt === index ? "" : undefined}
              onDragOver={(e) => {
                if (!group.onReorder || !e.dataTransfer.types.includes(REORDER_TYPE)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropAt !== index) setDropAt(index);
              }}
              onDragLeave={() => setDropAt(null)}
              onDrop={(e) => {
                const raw = e.dataTransfer.getData(REORDER_TYPE);
                setDropAt(null);
                if (!raw) return;
                let from: { group?: unknown; index?: unknown };
                try {
                  from = JSON.parse(raw);
                } catch {
                  return;
                }
                if (from?.group !== group.id || !Number.isInteger(from.index) || (from.index as number) < 0 || (from.index as number) >= items.length) return;
                e.preventDefault();
                reorder(from.index as number, index);
              }}
            >
              <button
                type="button"
                aria-pressed={selected}
                data-part="swatch"
                tabIndex={tabStop ? 0 : -1}
                data-state={selected ? "selected" : undefined}
                data-checker=""
                title={s.label ?? s.value}
                aria-label={s.label ?? s.value}
                aria-keyshortcuts={shortcuts}
                style={{ "--_cs-swatch": safeCssValue(s.value) } as CSSProperties}
                onClick={() => apply(s)}
                onDoubleClick={(e) => canRename && startRename(index, e.currentTarget)}
                // solid swatches can be dropped on the gradient bar; reorderable groups can be rearranged
                draggable={!s.gradient || Boolean(group.onReorder)}
                onDragStart={(e) => {
                  if (!s.gradient) e.dataTransfer.setData(SWATCH_DRAG_TYPE, s.value);
                  if (group.onReorder) e.dataTransfer.setData(REORDER_TYPE, JSON.stringify({ group: group.id, index }));
                  e.dataTransfer.setData("text/plain", s.value);
                  e.dataTransfer.effectAllowed = "copyMove";
                }}
                onKeyDown={(e) => {
                  if (group.onRemove && (e.key === "Delete" || e.key === "Backspace")) {
                    e.preventDefault();
                    group.onRemove(strip(s));
                    focusAfterRemove(e.currentTarget);
                  } else if (canRename && e.key === "F2") {
                    e.preventDefault();
                    startRename(index, e.currentTarget);
                  } else if (group.onReorder && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                    // Alt + arrows move the swatch one place, the keyboard way to drag it
                    e.preventDefault();
                    const forward = (e.key === "ArrowRight") !== isRtl(e.currentTarget);
                    if (forward ? index >= items.length - 1 : index <= 0) return;
                    reorder(index, forward ? index + 2 : index - 1);
                    const grid = e.currentTarget.closest<HTMLElement>("[data-part='swatch-grid']");
                    // focus follows the swatch to its new place
                    requestAnimationFrame(() => grid?.querySelectorAll<HTMLElement>(SWATCH)[forward ? i + 1 : i - 1]?.focus());
                  }
                }}
              >
                {group.renderSwatch?.(strip(s), { selected })}
              </button>
              {group.onRemove && (
                <button
                  type="button"
                  data-part="swatch-remove"
                  tabIndex={-1}
                  title={labels.removeSwatch}
                  aria-label={`${labels.removeSwatch} ${s.label ?? s.value}`}
                  onClick={() => group.onRemove!(strip(s))}
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}
        {group.onAdd && !q && (
          <button
            type="button"
            data-part="swatch-add"
            data-tooltip={labels.addSwatch}
            aria-label={labels.addSwatch}
            onClick={() => group.onAdd!(store.getState().value)}
          >
            <PlusIcon />
          </button>
        )}
        {matches.length === 0 && !q && (
          <p data-part="swatch-empty-hint">{group.emptyText ?? (group.onAdd ? labels.emptyWithAdd : labels.emptyGroup)}</p>
        )}
      </div>
      {renaming !== null && items[renaming] && (
        <form
          data-part="swatch-rename"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("name") as HTMLInputElement;
            group.onRename?.(strip(items[renaming]), input.value.trim());
            // Enter keeps the keyboard on the swatch; a blur (focus moved on) leaves focus where it went
            endRename(document.activeElement === input);
          }}
        >
          <span data-part="swatch-rename-swatch" style={{ "--_cs-swatch": safeCssValue(items[renaming].value) } as CSSProperties} aria-hidden />
          <input
            name="name"
            data-part="swatch-rename-input"
            aria-label={labels.renameSwatch}
            placeholder={labels.renameSwatch}
            defaultValue={items[renaming].label ?? ""}
            autoFocus
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                endRename(true);
              }
            }}
          />
        </form>
      )}
    </div>
  );
},
// compared by content: groups rebuilt with the same swatches (a new array each render) do not re-render
(a, b) =>
  a.query === b.query && a.tabbed === b.tabbed && a.action === b.action && a.panelId === b.panelId && a.tabId === b.tabId && sameGroup(a.group, b.group));

export interface SwatchesProps {
  groups: SwatchGroupConfig[];
  /** a search box that filters every group by name, value or hex */
  search?: boolean;
  /** `"tabs"` (default with 2+ groups): one grid with a tab per group. `"stack"`: every group listed */
  layout?: "tabs" | "stack";
  className?: string;
  style?: CSSProperties;
}

/** Swatch groups: brand, saved, document, recent, presets. Clicking applies; gradients replace the value. */
export const Swatches = /* @__PURE__ */ memo(function Swatches({ groups: groupsProp, search, layout, className, style }: SwatchesProps) {
  const { labels, storage, recent } = usePickerContext();
  const groups = useStableGroups(groupsProp);
  const solidMode = usePicker((s) => s.mode === "solid");
  const hasRecent = groups.some((g) => g.recent);
  const recentCount = useSyncExternalStore(hasRecent ? recent.subscribe : noSubscribe, () => (hasRecent ? recent.list().length : 0), noRecentCount);
  const [query, setQuery] = useState("");
  const visible = groups.filter(
    (g) =>
      (!g.showIn || (g.showIn === "solid") === solidMode) &&
      (g.onAdd || (g.recent ? recentCount > 0 : g.colors === "default" || (g.colors?.length ?? 0) > 0)),
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const uid = useId();
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  // closing the search puts focus back on the button that opened it
  const refocusToggle = useRef(false);
  const tabs = (layout ?? (visible.length > 1 ? "tabs" : "stack")) === "tabs" && visible.length > 1;
  const [tab, setTabState] = useState<string | null>(null);
  const setTab = (id: string) => {
    setTabState(id);
    storage.set("swatch-tab", id);
  };
  // the stored tab is applied after mount but before paint, so the first client render matches the server's
  useIsoLayoutEffect(() => {
    const saved = storage.get("swatch-tab");
    if (saved) setTabState(saved);
  }, [storage]);
  const active = visible.find((g) => g.id === tab) ?? visible[0];

  // more tabs than fit: they scroll, the edges fade, and the active tab is kept in view
  const tabsRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<"" | "start" | "end" | "both">("");
  const updateOverflow = () => {
    const el = tabsRef.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow(start && end ? "both" : start ? "start" : end ? "end" : "");
  };
  useEffect(() => {
    const el = tabsRef.current;
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
    return () => ro?.disconnect();
  }, [active?.id, visible.length, tabs]);
  const tabIndex = Math.max(0, visible.indexOf(active));

  const searching = Boolean(search && searchOpen);
  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
    refocusToggle.current = true;
  };
  useIsoLayoutEffect(() => {
    if (searching || !refocusToggle.current) return;
    refocusToggle.current = false;
    searchToggleRef.current?.focus();
  }, [searching]);
  // the same element between renders, so the group that shows it is not re-rendered for it
  const searchToggle = useMemo(
    () =>
      search && (
        <button
          ref={searchToggleRef}
          type="button"
          data-part="icon-button"
          data-size="sm"
          aria-label={labels.searchSwatches}
          data-tooltip={labels.searchSwatches}
          onClick={() => setSearchOpen(true)}
        >
          <SearchIcon />
        </button>
      ),
    [search, labels.searchSwatches],
  );

  return (
    <div data-part="swatches" data-layout={tabs ? "tabs" : "stack"} className={className} style={style}>
      {searching ? (
        <label data-part="swatch-search">
          <SearchIcon aria-hidden />
          <input
            type="search"
            data-part="swatch-search-input"
            placeholder={labels.searchSwatches}
            aria-label={labels.searchSwatches}
            value={query}
            spellCheck={false}
            autoComplete="off"
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
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
            data-overflow={overflow || undefined}
            onScroll={updateOverflow}
            role="tablist"
            aria-label={labels.swatchGroups}
            onKeyDown={(e) => {
              const n = visible.length;
              const rtl = isRtl(e.currentTarget);
              let next: number | null = null;
              if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (tabIndex + 1) % n;
              else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (tabIndex - 1 + n) % n;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = n - 1;
              if (next === null) return;
              e.preventDefault();
              setTab(visible[next].id);
              e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
            }}
          >
            {visible.map((g, i) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${i}`}
                aria-controls={`${uid}-panel`}
                data-tab={g.id}
                aria-selected={g === active}
                data-state={g === active ? "active" : "inactive"}
                tabIndex={g === active ? 0 : -1}
                onClick={() => setTab(g.id)}
              >
                {g.label ?? g.id}
              </button>
            ))}
          </div>
          {searchToggle}
        </div>
      ) : (
        // stacked: the search button sits on the first group's label row, or on its own row without a label
        searchToggle && !visible[0]?.label && <div data-part="swatch-header" data-align="end">{searchToggle}</div>
      )}
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
        groups.map((g) => (
          <SwatchGroup
            key={g.id}
            group={g}
            query={searching ? query : ""}
            action={!searching && g === visible[0] && g.label ? searchToggle : undefined}
          />
        ))
      )}
      {searching && (
        <p data-part="swatch-empty" role="status">
          {query.trim() ? labels.noMatches : null}
        </p>
      )}
    </div>
  );
});
