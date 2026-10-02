# @colorshot/vue

Color and gradient picker for Vue 3. Solid, linear, radial and conic gradients, every CSS color format including OKLCH and Display P3, swatches, eyedropper, and a popover field. Same features, DOM and styles as `@colorshot/react`.

```bash
npm i @colorshot/vue
```

```vue
<script setup lang="ts">
import { ref } from "vue";
import { ColorPicker, ColorField } from "@colorshot/vue";
import "@colorshot/vue/styles.css";

const fill = ref("linear-gradient(135deg, #3E5CEB, #22C55E)");
</script>

<template>
  <ColorPicker v-model="fill" @change-complete="saveToHistory" />
  <ColorField v-model="fill" label="Fill" />
</template>
```

- `v-model` takes and returns any CSS color or gradient string; `@change` fires while dragging, `@change-complete` once per gesture.
- Custom layouts from parts: `Picker.Root`, `Picker.Area`, `Picker.Hue`, `Picker.Alpha`, `Picker.Inputs`, `Picker.Swatches`...
- `ColorField` supports `v-model:open` and a `#trigger="{ value, open }"` slot.
- Vue 3.5+.

Docs: https://orshot.com/open-source/colorshot · MIT · by [Orshot](https://orshot.com)
