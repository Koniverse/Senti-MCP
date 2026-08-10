import { defineConfig } from 'vitest/config';

/**
 * Collection is scoped to `src/` on purpose, as an allowlist rather than a
 * blacklist.
 *
 * Vitest's default `include` is `**\/*.test.ts` from the project root, and its
 * default `exclude` covers `node_modules` and `dist` but not `.claude/`. This
 * repo's own workflow creates git worktrees under `.claude/worktrees/`, which
 * is gitignored — so a leftover worktree is invisible to `git status` while
 * being fully visible to the default glob. One did survive the `v1.0.1`
 * release: `npm test` collected 28 files / 394 tests, exactly half of them a
 * second copy of the suite running against a merged branch's code
 * ([CONTEXT D13](docs/CONTEXT.md)).
 *
 * Anchoring `include` at `src/` fixes the whole class instead of that one
 * path: no sibling tree nested anywhere under the root can be collected,
 * whatever it is named. Every test file this package owns lives in `src/`.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
