import { defineComponent } from "vue";
import type { PickerMode } from "@colorshot/core";
import { usePicker, usePickerContext } from "../context";
import { ConicIcon, LinearIcon, RadialIcon, SolidIcon } from "../icons";
import { bool } from "../props";
import { isRtl } from "../use-drag";

const ICONS = { solid: SolidIcon, linear: LinearIcon, radial: RadialIcon, conic: ConicIcon };

/**
 * Solid / Linear / Radial / Conic switch with a sliding indicator. Hidden when only one mode is allowed.
 * A radio group (there is no tab panel): one button in the tab order, arrow keys pick the next mode.
 */
export const ModeTabs = /* @__PURE__ */ defineComponent({
  name: "PickerModeTabs",
  props: {
    /** show the mode names (default true). With `false`, tabs are icons with tooltips */
    showLabels: /* @__PURE__ */ bool(true),
    /** show icons next to the names (default false; icons always show when labels are hidden) */
    showIcons: /* @__PURE__ */ bool(),
  },
  setup(props) {
    const ctx = usePickerContext();
    const { store } = ctx;
    const mode = usePicker((s) => s.mode);

    const select = (m: PickerMode) => {
      store.setMode(m);
      store.commit();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const modes = store.modes;
      const index = Math.max(0, modes.indexOf(mode.value));
      let next: PickerMode | undefined;
      const rtl = isRtl(e.currentTarget as HTMLElement);
      if (e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = modes[(index + 1) % modes.length];
      else if (e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = modes[(index - 1 + modes.length) % modes.length];
      else if (e.key === "Home") next = modes[0];
      else if (e.key === "End") next = modes[modes.length - 1];
      if (!next) return;
      e.preventDefault();
      select(next);
      (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus();
    };

    return () => {
      const modes = store.modes;
      if (modes.length < 2) return null;
      const { showLabels, showIcons } = props;
      const labels = ctx.labels;
      const index = Math.max(0, modes.indexOf(mode.value));
      return (
        <div
          data-part="mode-tabs"
          role="radiogroup"
          aria-label={labels.fillType}
          data-labels={showLabels ? "" : undefined}
          style={{ "--_cs-index": index, "--_cs-count": modes.length }}
          onKeydown={onKeyDown}
        >
          <span data-part="mode-indicator" aria-hidden="true" />
          {modes.map((m) => {
            const Icon = ICONS[m];
            const active = m === mode.value;
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
                tabindex={active ? 0 : -1}
                onClick={() => select(m)}
              >
                {showIcons || !showLabels ? <Icon /> : null}
                {showLabels ? <span data-part="mode-label">{labels[m]}</span> : null}
              </button>
            );
          })}
        </div>
      );
    };
  },
});
