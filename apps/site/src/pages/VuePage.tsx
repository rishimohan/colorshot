import { Link } from "react-router-dom";
import { C, Code } from "../components/Code";
import { H2, PageHeader } from "../components/Docs";

const BASIC = `
<script setup lang="ts">
import { ref } from "vue";
import { ColorPicker } from "@orshot/colorshot/vue";
import "@orshot/colorshot/styles.css";

const fill = ref("#3E5CEB");
</script>

<template>
  <ColorPicker v-model="fill" />
</template>
`;

const FULL = `
<script setup lang="ts">
import { ref } from "vue";
import { ColorPicker, ColorField } from "@orshot/colorshot/vue";

const fill = ref("linear-gradient(90deg, #3E5CEB 0%, #F97316 100%)");
const border = ref("#0f172a");

function save(value: string) {
  // once per drag, click or typed value
}
</script>

<template>
  <ColorPicker
    v-model="fill"
    :modes="['solid', 'linear', 'radial', 'conic']"
    :swatches="[{ id: 'presets', label: 'Presets', colors: 'default' }]"
    gradient-presets
    @change-complete="save"
  />

  <ColorField v-model="border" label="Border" :modes="['solid']" />
</template>
`;

export function VuePage() {
  return (
    <>
      <PageHeader
        eyebrow="More"
        title="Vue"
        lead="@orshot/colorshot/vue is the Vue 3 package. It uses the same core and the same stylesheet as React, renders the same DOM, and behaves the same."
      />
      <Code lang="bash" code="npm i @orshot/colorshot" />

      <H2>Usage</H2>
      <p>
        The value is bound with <C>v-model</C>. It is the same CSS string the React picker uses.
      </p>
      <Code lang="vue" code={BASIC} />

      <H2>Props and events</H2>
      <p>
        Props match the React components, written in kebab-case in templates. <C>onChange</C> becomes the <C>v-model</C> update, and{" "}
        <C>onChangeComplete</C> becomes the <C>change-complete</C> event.
      </p>
      <Code lang="vue" code={FULL} />
      <ul>
        <li>
          Same props as <Link to="/docs/color-picker">ColorPicker</Link> and <Link to="/docs/color-field">ColorField</Link>.
        </li>
        <li>
          Same <C>--cs-*</C> variables and <C>data-part</C> selectors. <Link to="/docs/theming">Theming</Link> applies as is.
        </li>
        <li>Same keyboard support and screen reader names.</li>
      </ul>

      <H2>Differences from React</H2>
      <ul>
        <li>
          <C>v-model</C> instead of <C>value</C> + <C>onChange</C>. <C>@change</C> fires while dragging, <C>@change-complete</C> once per
          gesture.
        </li>
        <li>
          <C>ColorField</C>: <C>v-model:open</C> instead of <C>open</C> + <C>onOpenChange</C>, and a <C>#trigger="{"{ value, open }"}"</C> slot
          instead of <C>renderTrigger</C>. <C>pickerClass</C> / <C>pickerStyle</C> style the picker inside the popover.
        </li>
        <li>
          Parts: <C>{"<Picker.Root v-model=\"value\">"}</C> with <C>Picker.Area</C>, <C>Picker.Hue</C>, <C>Picker.Alpha</C>,{" "}
          <C>Picker.Inputs</C>, <C>Picker.Swatches</C> and the rest, the same set as React.
        </li>
        <li>Vue 3.5 or newer.</li>
      </ul>

      <H2>Build your own on the core</H2>
      <p>
        For a picker of your own, use <Link to="/docs/core">@orshot/colorshot</Link> directly. Keep the store outside Vue's reactivity, and copy
        the state you render into a <C>shallowRef</C> from <C>subscribe</C>.
      </p>
      <Code
        lang="vue"
        code={`
<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { createPicker } from "@orshot/colorshot";

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const props = defineProps<{ modelValue: string }>();

const picker = createPicker({
  value: props.modelValue,
  onChange: (value) => emit("update:modelValue", value),
});
const state = shallowRef(picker.getState());
const off = picker.subscribe((s) => (state.value = s));
onBeforeUnmount(off);
// follow outside changes to v-model
watch(() => props.modelValue, (value) => picker.setValue(value));
</script>

<template>
  <input
    type="range"
    min="0"
    max="360"
    :value="state.hsva.h"
    @input="picker.setHsva({ h: Number(($event.target as HTMLInputElement).value) })"
    @change="picker.commit()"
  />
</template>
`}
      />
    </>
  );
}
