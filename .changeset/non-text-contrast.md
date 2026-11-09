---
"@orshot/colorshot": minor
---

`contrastFor="ui"` checks `contrastWith` as non-text contrast (WCAG 1.4.11) for borders, icons and focus rings. The color area draws its line at 3:1 instead of 4.5:1, and the badge shows Pass or Fail instead of AAA / AA / AA Large / Fail. It works on `ColorPicker`, `ColorField`, `Picker.Area` and `Picker.Contrast` in React and Vue. The default (`"text"`) is unchanged.

The contrast line in the color area now reaches the top or bottom edge where the boundary leaves the area. It used to stop at the last sampled column, a few pixels short of the edge.

Core: `contrastLevel(ratio, "ui")` returns `"Pass"` or `"Fail"`, `contrastMinimum(target)` returns the ratio needed to pass (4.5 or 3), and the `ContrastTarget` type is exported.
