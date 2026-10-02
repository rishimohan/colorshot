import { memo, type CSSProperties, type KeyboardEvent } from "react";
import type { PickerMode } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { ConicIcon, LinearIcon, RadialIcon, SolidIcon } from "../icons";
import { isRtl } from "../use-drag";

const ICONS = { solid: SolidIcon, linear: LinearIcon, radial: RadialIcon, conic: ConicIcon };

export interface ModeTabsProps {
  className?: string;
  style?: CSSProperties;
  /** show the mode names (default true). With `false`, tabs are icons with tooltips */
  showLabels?: boolean;
  /** show icons next to the names (default false; icons always show when labels are hidden) */
  showIcons?: boolean;
}

/**
 * Solid / Linear / Radial / Conic switch with a sliding indicator. Hidden when only one mode is allowed.
 * A radio group (there is no tab panel): one button in the tab order, arrow keys pick the next mode.
 */
export const ModeTabs = /* @__PURE__ */ memo(function ModeTabs({ className, style, showLabels = true, showIcons = false }: ModeTabsProps) {
  const { store, labels } = usePickerContext();
  const mode = usePicker((s) => s.mode);
  const modes = store.modes;
  if (modes.length < 2) return null;
  const index = Math.max(0, modes.indexOf(mode));

  const select = (m: PickerMode) => {
    store.setMode(m);
    store.commit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: PickerMode | undefined;
    const rtl = isRtl(e.currentTarget);
    if (e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = modes[(index + 1) % modes.length];
    else if (e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = modes[(index - 1 + modes.length) % modes.length];
    else if (e.key === "Home") next = modes[0];
    else if (e.key === "End") next = modes[modes.length - 1];
    if (!next) return;
    e.preventDefault();
    select(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus();
  };

  return (
    <div
      data-part="mode-tabs"
      role="radiogroup"
      aria-label={labels.fillType}
      data-labels={showLabels ? "" : undefined}
      className={className}
      style={{ "--_cs-index": index, "--_cs-count": modes.length, ...style } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <span data-part="mode-indicator" aria-hidden />
      {modes.map((m) => {
        const Icon = ICONS[m];
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            data-mode={m}
            aria-checked={active}
            aria-label={showLabels ? undefined : labels[m]}
            data-state={active ? "active" : "inactive"}
            data-tooltip={showLabels ? undefined : labels[m]}
            tabIndex={active ? 0 : -1}
            onClick={() => select(m)}
          >
            {(showIcons || !showLabels) && <Icon />}
            {showLabels && <span data-part="mode-label">{labels[m]}</span>}
          </button>
        );
      })}
    </div>
  );
});
