import { ref, useId, watch, watchEffect } from "vue";

/**
 * Shared state for the Select listbox and the Menu: open / active item, flipping above the trigger when there
 * is no room below, closing on an outside press, and returning focus to the trigger on close.
 */
export function usePopup(onOpened?: (menu: HTMLElement) => void) {
  const open = ref(false);
  const active = ref(0);
  // the active item gets a focus ring only while the keyboard moves it (the pointer only highlights)
  const keyboard = ref(false);
  const placement = ref<"bottom" | "top">("bottom");
  const rootRef = ref<HTMLDivElement | null>(null);
  const triggerRef = ref<HTMLButtonElement | null>(null);
  const menuRef = ref<HTMLDivElement | null>(null);
  const id = useId();

  const close = (focus = true) => {
    open.value = false;
    if (focus) triggerRef.value?.focus();
  };

  // flip above the trigger when there is no room below
  watch(
    open,
    (isOpen) => {
      const root = rootRef.value;
      const menu = menuRef.value;
      if (!isOpen || !root || !menu) return;
      const r = root.getBoundingClientRect();
      const h = menu.offsetHeight;
      placement.value = r.bottom + h + 8 > window.innerHeight && r.top > h + 8 ? "top" : "bottom";
      onOpened?.(menu);
    },
    { flush: "post" },
  );

  watchEffect((onCleanup) => {
    if (!open.value) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.value?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    onCleanup(() => document.removeEventListener("pointerdown", onDown, true));
  });

  return { open, active, keyboard, placement, rootRef, triggerRef, menuRef, id, close };
}
