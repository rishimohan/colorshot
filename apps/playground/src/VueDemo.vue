<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { ColorField, ColorPicker, Picker, isGradient, type DisplayFormat, type Swatch, type SwatchGroupConfig } from "@orshot/colorshot/vue";

// follow the playground's Theme select, which sets data-theme on <html>
const readTheme = () => {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : undefined;
};
const theme = ref(readTheme());
const observer = new MutationObserver(() => (theme.value = readTheme()));
observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
onBeforeUnmount(() => observer.disconnect());

const BRAND: Swatch[] = [
  { value: "#0F172A", label: "Ink" },
  { value: "#3E5CEB", label: "Orshot blue" },
  { value: "#22C55E", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "linear-gradient(135deg, #3E5CEB 0%, #22C55E 100%)", label: "Brand gradient" },
];
const FORMATS: DisplayFormat[] = ["hex", "rgb", "hsl", "hsb", "oklch", "lch", "lab", "p3", "cmyk"];

const value = ref("linear-gradient(135deg, #3E5CEB 0%, #22C55E 100%)");
const changes = ref(0);
const log = ref<string[]>([]);
const saved = ref<Swatch[]>([
  { value: "#E11D48", id: "1" },
  { value: "oklch(0.75 0.15 200)", id: "2" },
  { value: "radial-gradient(circle at 30% 30%, #FDE68A 0%, #F97316 100%)", id: "3" },
]);
const swatches = computed<SwatchGroupConfig[]>(() => [
  { id: "brand", label: "Brand", colors: BRAND },
  {
    id: "saved",
    label: "Saved",
    colors: saved.value,
    onAdd: (v) => (saved.value = [...saved.value, { value: v, id: String(Date.now()) }]),
    onRemove: (sw) => (saved.value = saved.value.filter((x) => x.id !== sw.id)),
    onReorder: (list) => (saved.value = list),
    onRename: (sw, label) => (saved.value = saved.value.map((x) => (x.id === sw.id ? { ...x, label } : x))),
  },
  { id: "recent", label: "Recent", recent: true, limit: 8 },
  { id: "presets", label: "Presets", colors: "default", limit: 8 },
]);
const onComplete = (v: string) => (log.value = [v, ...log.value].slice(0, 6));

const composed = ref("oklch(0.68 0.19 25)");

const fill = ref("linear-gradient(135deg, #3E5CEB 0%, #22C55E 100%)");
const border = ref("rgba(15, 23, 42, 0.4)");
const text = ref("#0F172A");
const fieldOpen = ref(false);

const compact = ref("#22C55E");
const PRESETS: SwatchGroupConfig[] = [{ id: "presets", label: "Presets", colors: "default" }];
</script>

<template>
  <section class="section">
    <header>
      <h2>Vue: everything on</h2>
      <p>@orshot/colorshot/vue with v-model, @change and @change-complete. Same props as "Everything on" above, so the two can be compared side by side.</p>
    </header>
    <div class="section-body">
      <div class="row">
        <ColorPicker
          v-model="value"
          :theme="theme"
          history
          swatch-search
          gradient-presets
          :formats="FORMATS"
          :swatches="swatches"
          @change="changes++"
          @change-complete="onComplete"
        />
        <div class="inspector">
          <dl>
            <dt>value</dt>
            <dd><code>{{ value }}</code></dd>
            <dt>change events</dt>
            <dd>{{ changes }}</dd>
            <dt>change-complete (undo entries)</dt>
            <dd>
              <span v-if="log.length === 0" class="muted">none yet</span>
              <code v-for="(l, i) in log" :key="i">{{ l }}</code>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <header>
      <h2>Vue: custom layout</h2>
      <p>Picker.Root with parts in a template, OKLCH area, before / after preview.</p>
    </header>
    <div class="section-body">
      <div class="row">
        <Picker.Root v-model="composed" :theme="theme" :modes="['solid']" space="oklch" history class="composed">
          <div class="composed-grid">
            <Picker.Area />
            <div class="composed-side">
              <Picker.Preview show-original class="composed-preview" />
              <Picker.Hue />
              <Picker.Alpha />
            </div>
          </div>
          <div class="composed-bottom">
            <Picker.EyeDropper />
            <Picker.Inputs :formats="['oklch', 'hex', 'p3']" />
          </div>
        </Picker.Root>
        <div class="inspector">
          <code>{{ composed }}</code>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <header>
      <h2>Vue: ColorField</h2>
      <p>Trigger + teleported popover. The Text field uses v-model:open and the #trigger slot.</p>
    </header>
    <div class="section-body">
      <div class="row">
        <div class="fields">
          <label class="field-row">
            <span>Fill</span>
            <ColorField v-model="fill" :theme="theme" label="Fill" gradient-presets swatch-search history />
          </label>
          <label class="field-row">
            <span>Border</span>
            <ColorField v-model="border" :theme="theme" label="Border" :modes="['solid']" />
          </label>
          <label class="field-row">
            <span>Text</span>
            <ColorField
              v-model="text"
              v-model:open="fieldOpen"
              :theme="theme"
              label="Text color"
              :modes="['solid', 'linear']"
              contrast-with="#ffffff"
              placement="right-start"
            >
              <template #trigger="{ value: v, open }">
                <span data-part="field-swatch" :style="{ '--_cs-swatch': v }" aria-hidden="true" />
                <span data-part="field-text">{{ open ? "Editing…" : "Text color" }}</span>
              </template>
            </ColorField>
          </label>
        </div>
        <div class="inspector">
          <div class="field-preview" :style="{ background: fill, border: `3px solid ${border}` }">
            <span :style="isGradient(text) ? { backgroundImage: text, WebkitBackgroundClip: 'text', color: 'transparent' } : { color: text }">Aa</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="vue-compact">
    <header>
      <h2>Vue: compact</h2>
      <p>Same props as the React "Compact" demo above; their DOM should match.</p>
    </header>
    <div class="section-body">
      <ColorPicker v-model="compact" :theme="theme" size="sm" :swatches="PRESETS">
        <button type="button" data-testid="vue-slot-button" @click="compact = '#000000'">Reset to black</button>
      </ColorPicker>
    </div>
  </section>
</template>
