## What and why

<!-- What this changes and the problem it solves. Link the issue if there is one. -->

## Checklist

- [ ] `pnpm typecheck` and `pnpm --filter @colorshot/core test` pass
- [ ] `pnpm --filter @colorshot/playground test:e2e` passes, for UI changes
- [ ] `pnpm build && pnpm size` stays within budget
- [ ] React and Vue behave the same (props, `data-part` names, behavior)
- [ ] New behavior is behind an opt-in prop; defaults are unchanged
- [ ] Changeset added (`pnpm changeset`) if the published package changes
- [ ] `llms.txt` and `skills/colorshot/SKILL.md` updated if a prop or export changed
