# Releasing

One package is published: `@orshot/colorshot`, assembled by `packages/colorshot` from the private source packages (`packages/core`, `react`, `vue`, `styles`). Publish with **pnpm** from the repo root after `pnpm build`.

## Before the first publish

- [ ] Claim the npm scope: create the `orshot` organization on npmjs.com (free for public packages) and require 2FA for publishing
- [ ] Optional: publish a small `colorshot` placeholder pointing to `@orshot/colorshot`, so the unscoped name stays yours
- [ ] Create the GitHub repo `rishimohan/colorshot` (the URL in every package.json), turn on private vulnerability reporting (see SECURITY.md)
- [ ] Public docs live on orshot.com at https://orshot.com/open-source/colorshot (in the Orshot repo). `apps/site` is the local docs app for development and is not deployed. When an API changes, update that page, `llms.txt` and `skills/colorshot/SKILL.md` in the same release
- [ ] Commit everything and push: `pnpm publish` refuses to run from a working tree with uncommitted changes

## First release (0.1.0)

Everything is already at `0.1.0` with a changelog entry.

```bash
pnpm install
pnpm typecheck
pnpm --filter @colorshot/core test
pnpm build
pnpm size
pnpm --filter @colorshot/playground test:e2e   # all three engines; needs `npx playwright install` once

npm login                 # once, with access to the @orshot scope
pnpm -r publish --access public --dry-run   # check the file lists
pnpm -r publish --access public             # add --otp=<code> when npm asks for 2FA
git tag v0.1.0 && git push --tags
```

`pnpm -r publish` only publishes `@orshot/colorshot`: the source packages and the apps are private.

## Later releases

1. Add a changeset for each change: `pnpm changeset` and pick `@orshot/colorshot` (patch / minor / major).
2. `pnpm changeset version` bumps versions and writes the changelogs. Commit.
3. Run the checks above, then `pnpm -r publish --access public` and tag `v0.x.y`.

Publishing from GitHub Actions with npm trusted publishing (provenance) is a good next step once the repo is public; until then, publish from a clean, committed checkout.

## Stable API

From 0.1.0, these follow semver: the exported components, hooks, functions and types; the documented props and labels; the documented `--cs-*` theme variables; `data-part` names and the `data-state`, `data-mode`, `data-theme`, `data-size` and `data-variant` attributes. Other attributes and any `--_cs-*` variables are internal and may change in any release.
