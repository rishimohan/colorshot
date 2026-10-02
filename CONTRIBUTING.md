# Contributing

```bash
pnpm install
pnpm --filter @colorshot/playground dev   # playground: http://localhost:5190 (/?harness is the test page)
pnpm --filter @colorshot/site dev         # local docs: http://localhost:5191 (public docs: https://orshot.com/open-source/colorshot)
```

## Layout

| Path | What |
| --- | --- |
| `packages/core` | Framework-free logic: color parsing and conversion, gradients, the picker store. Zero dependencies. |
| `packages/styles` | The stylesheet, one file per part in `src/parts`, concatenated into `dist/styles.css` |
| `packages/react` | React components |
| `packages/vue` | Vue components. Same DOM, attributes and CSS variables as React, so one stylesheet styles both |
| `apps/playground` | Dev playground and the Playwright test harness |
| `apps/site` | Local docs app (the public docs are on orshot.com) |
| `skills/colorshot` | Agent skill, installed with `npx skills add rishimohan/colorshot` |
| `llms.txt` | API reference for LLMs, shipped in the package |

## Checks

```bash
pnpm typecheck
pnpm --filter @colorshot/core test           # unit, corpus and fuzz tests
pnpm --filter @colorshot/playground test:e2e # browser tests (Chromium, Firefox, WebKit)
pnpm build && pnpm size                      # gzip budgets
```

## Rules

- Values in and out are CSS strings. Parts of a value the user did not edit must come back exactly as written; add any new real-world value to the corpus in `packages/core/test/gradient.test.ts`.
- The parser never throws.
- Keep React and Vue in step: same props, `data-part` names and behavior.
- New features are opt-in props. Do not change defaults in a minor release.
- Add a changeset (`pnpm changeset`) to every change that affects a published package.
- When a prop or export changes, update `llms.txt` and `skills/colorshot/SKILL.md` too.

By contributing, you agree that your contributions are licensed under the MIT License, the same as the project.
