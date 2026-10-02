import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { C } from "../components/Code";
import { H2, H3, Note, PageHeader, Table } from "../components/Docs";

const K = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;
const Mod = () => (
  <>
    <K>⌘</K> / <K>Ctrl</K>
  </>
);

type Row = [ReactNode, ReactNode];

function Keys({ title, rows, intro }: { title: string; rows: Row[]; intro?: ReactNode }) {
  return (
    <>
      <H3>{title}</H3>
      {intro && <p>{intro}</p>}
      <Table head={["Keys", "Action"]} rows={rows} />
    </>
  );
}

export function AccessibilityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Access"
        title="Accessibility and keyboard"
        lead="Every control works with a keyboard, a screen reader, touch and a trackpad. Here is every shortcut and what screen readers hear."
      />

      <H2>Keyboard shortcuts</H2>
      <Keys
        title="Anywhere in the picker"
        intro={
          <>
            These work while focus is inside the picker, but not while typing in a text field, which keeps its own copy, paste and undo.
            Turn the single keys off with <C>shortcuts={"{false}"}</C>.
          </>
        }
        rows={[
          [
            <>
              <K>1</K> <K>2</K> <K>3</K> <K>4</K>
            </>,
            <>
              Switch mode, in the order of <C>modes</C>: Solid, Linear, Radial, Conic.
            </>,
          ],
          [<K key="i">I</K>, "Pick a color from the screen (when the eyedropper is available)."],
          [
            <>
              <Mod /> + <K>C</K>
            </>,
            "Copy the current CSS value. A short Copied message is announced.",
          ],
          [
            <>
              <Mod /> + <K>V</K>
            </>,
            "Paste any CSS color or gradient and apply it.",
          ],
          [
            <>
              <Mod /> + <K>Z</K>
            </>,
            <>
              Undo. Needs the <C>history</C> prop.
            </>,
          ],
          [
            <>
              <K>Shift</K> + <Mod /> + <K>Z</K>
            </>,
            <>
              Redo. Needs the <C>history</C> prop.
            </>,
          ],
        ]}
      />
      <Keys
        title="Color area"
        rows={[
          [
            <>
              <K>←</K> <K>→</K>
            </>,
            "Saturation (or chroma in the OKLCH area) by 1%.",
          ],
          [
            <>
              <K>↑</K> <K>↓</K>
            </>,
            "Brightness (or lightness) by 1%.",
          ],
          [
            <>
              <K>Shift</K> + arrows
            </>,
            "Steps of 10%.",
          ],
          [
            <>
              <K>Page Up</K> <K>Page Down</K>
            </>,
            "Steps of 10%.",
          ],
        ]}
      />
      <Keys
        title="Hue and opacity sliders"
        rows={[
          [
            <>
              <K>←</K> <K>→</K> <K>↑</K> <K>↓</K>
            </>,
            "Move by 1%. Hold Shift for 10%.",
          ],
          [
            <>
              <K>Page Up</K> <K>Page Down</K>
            </>,
            "Move by 10%.",
          ],
          [
            <>
              <K>Home</K> <K>End</K>
            </>,
            "Jump to the start or end.",
          ],
        ]}
      />
      <Keys
        title="Mode tabs"
        rows={[
          [
            <>
              <K>←</K> <K>→</K>
            </>,
            "Previous or next mode. Wraps around.",
          ],
          [
            <>
              <K>Home</K> <K>End</K>
            </>,
            "First or last mode.",
          ],
        ]}
      />
      <Keys
        title="Gradient stops"
        intro="Every stop is in the tab order. Focusing a stop selects it, so the area and sliders edit that stop."
        rows={[
          [
            <>
              <K>←</K> <K>→</K>
            </>,
            "Move the stop by 1%. Hold Shift for 10%.",
          ],
          [
            <>
              <K>Home</K> <K>End</K>
            </>,
            "Move the stop to 0% or 100%.",
          ],
          [
            <>
              <K>Delete</K> <K>Backspace</K>
            </>,
            "Remove the stop and focus the next one. A gradient keeps at least two.",
          ],
          [
            <>
              <K>Enter</K> <K>+</K>
            </>,
            'Add a stop halfway to the next one and focus it. "Add stop" in the gradient options menu does the same.',
          ],
        ]}
      />
      <Keys
        title="Angle dial and center pad"
        rows={[
          [
            <>
              Arrows on the dial
            </>,
            "Turn by 1°. Hold Shift for 15°.",
          ],
          [
            <>
              Arrows on the center dot
            </>,
            "Move the center by 1%. Hold Shift for 10%.",
          ],
        ]}
      />
      <Keys
        title="Number and hex fields"
        rows={[
          [
            <>
              <K>↑</K> <K>↓</K>
            </>,
            "Step the number. Hold Shift for 10 steps.",
          ],
          [<K key="e">Enter</K>, "Apply what you typed."],
          [<K key="s">Esc</K>, "Throw away what you typed."],
          ["Drag the field label", "Scrub the value left or right. Hold Shift for fine control."],
          ["Paste into the hex field", "Any CSS color or gradient is applied right away."],
        ]}
      />
      <Keys
        title="Menus (format, size, options)"
        rows={[
          [
            <>
              <K>↓</K> <K>↑</K> <K>Enter</K> <K>Space</K>
            </>,
            "Open the menu, move, choose.",
          ],
          [
            <>
              <K>Home</K> <K>End</K>
            </>,
            "First or last option.",
          ],
          ["Type a letter", "Jump to the option that starts with it."],
          [<K key="esc">Esc</K>, "Close the menu. Inside a ColorField, a second Esc closes the popover."],
        ]}
      />
      <Keys
        title="Swatches"
        intro="Each group is one tab stop."
        rows={[
          [
            <>
              <K>←</K> <K>→</K> <K>↑</K> <K>↓</K>
            </>,
            "Move between swatches.",
          ],
          [
            <>
              <K>Home</K> <K>End</K>
            </>,
            "First or last swatch.",
          ],
          [
            <>
              <K>Enter</K> <K>Space</K>
            </>,
            "Apply the swatch.",
          ],
          [
            <>
              <K>Delete</K> <K>Backspace</K>
            </>,
            <>
              Remove the swatch, when the group has <C>onRemove</C>.
            </>,
          ],
          [
            <K key="f2">F2</K>,
            <>
              Rename the swatch, when the group has <C>onRename</C>. <K>Enter</K> saves, <K>Esc</K> cancels.
            </>,
          ],
          [
            <>
              <K>←</K> <K>→</K> on the group tabs
            </>,
            "Switch groups.",
          ],
          [<K key="esc2">Esc</K>, "In the search box: clear and close the search."],
        ]}
      />
      <Keys
        title="ColorField"
        rows={[
          [
            <>
              <K>Enter</K> <K>Space</K> <K>↓</K>
            </>,
            "Open the picker. Focus moves into it.",
          ],
          [<K key="esc3">Esc</K>, "Close and put focus back on the trigger."],
          [<K key="tab">Tab</K>, "Tab past the last control, or Shift+Tab before the first, closes the picker and returns focus to the trigger."],
        ]}
      />

      <H2>Screen readers</H2>
      <Table
        head={["Control", "What it is"]}
        rows={[
          ["Color area", 'A slider named "Saturation and brightness", read like "Saturation 80%, brightness 65%". The OKLCH area reads lightness and chroma.'],
          ["Hue, opacity", 'Sliders read like "217 degrees" and "50%".'],
          ["Mode tabs", 'A radio group named "Fill type": arrow keys pick Solid, Linear, Radial or Conic.'],
          ["Gradient stops", 'Sliders named "Color stop 2 of 3", read with the stop color and position. Adding or removing a stop is announced.'],
          ["Number fields", 'Spin buttons with full channel names, like "RGB Red". An invalid hex value is announced.'],
          ["Angle dial, center dot", "Sliders with their value in degrees or percent."],
          ["Swatches", "Toggle buttons named after the swatch label, or its value. The selected one is pressed."],
          ["Format and option menus", "A combobox with a listbox."],
          ["Current swatch", 'A button named "Copy CSS value". Clicking it copies the value.'],
          ["Copy and paste", 'A polite status message: "Copied" or "Pasted".'],
          [
            "ColorField",
            <>
              A button with <C>aria-haspopup="dialog"</C> and <C>aria-expanded</C>, named like "Fill: #3E5CEB". The popover is a dialog.
            </>,
          ],
        ]}
      />
      <p>
        All text, including the names above, can be translated with the <Link to="/docs/color-picker#labels">labels</Link> prop.
      </p>

      <H2>Pointer, touch and trackpad</H2>
      <ul>
        <li>Drags use pointer capture, so they keep tracking when the pointer leaves the control or the popover.</li>
        <li>Touch works on every control. On touch screens, thumbs and controls are larger and hit areas extend past the tracks.</li>
        <li>
          A two-finger swipe on a trackpad moves the area thumb, the sliders (sideways swipes), a hovered gradient stop and the angle
          dial. A swipe that started outside a control keeps scrolling the page. Pinch zoom is left alone.
        </li>
        <li>Fast drags are coalesced to one update per frame.</li>
      </ul>

      <H2>Motion and contrast</H2>
      <ul>
        <li>
          With <C>prefers-reduced-motion: reduce</C>, transitions and animations are off.
        </li>
        <li>Focus rings sit on a gap in the panel color, so they show on any color, including the thumbs on the area.</li>
        <li>
          In Windows High Contrast and other forced color modes, colors stay visible and focus shows as a system highlight outline.
        </li>
        <li>Right-to-left pages (<C>dir="rtl"</C>) flip the tab indicators and the arrow keys of tabs, radio groups and swatches.</li>
        <li>
          <C>contrastWith</C> shows the WCAG ratio of the picked color against a background, so users can check text colors as they
          pick.
        </li>
      </ul>
      <Note>
        Found something that does not work with your screen reader or keyboard? Please open an issue on GitHub with the browser and
        reader you use.
      </Note>
    </>
  );
}
