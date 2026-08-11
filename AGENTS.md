<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vendoring a third-party skill under `.claude/` gives it away under our name

This repository ships one skill of its own, `skills/darkprint/`, and the documented way to
get it is `npx skills@latest add Brotherhood94/darkprint`. That command does a shallow git
clone and then searches the clone for skills, and `.claude/skills/` is one of the
directories it searches. So a skill vendored there is handed to strangers as though it were
ours, and nothing in `npx tsc --noEmit`, `npm run lint` or the test suite notices.

Two were, for a while. `impeccable` and `content-reorg` sat in `.claude/skills/` and were
suppressed by a `skills-lock.json` at the repository root, which worked because the CLI
hides any skill under an agent project directory whose name is a key in that file. Both
skills were deleted on 2026-08-11, and the lock file went with them once it had been shown
to do nothing. Measured each time by running `npx skills@latest add <tree> -l` from an
empty directory, with the lock file and without it:

| state of `.claude/skills/` | with the lock file | without it |
| --- | --- | --- |
| `impeccable` + `content-reorg` | `Found 1 skill` → `darkprint` | `Found 3 skills` |
| `content-reorg` only | `Found 1 skill` → `darkprint` | `Found 2 skills` |
| empty, as now | `Found 1 skill` → `darkprint` | `Found 1 skill` |

The third row is what made it safe to remove: with nothing vendored, the file changed
nothing in either direction. It could not restore what had been deleted either —
`npx skills@latest experimental_install` read its two remaining keys, reported
`Restoring 2 skills`, then stopped on `Local path does not exist`, both entries being
`sourceType: local` against paths that no longer existed.

**So there is nothing to maintain today, and one thing to remember.** Put a third-party
skill under `.claude/` and the first two rows come back: it needs a key in a
`skills-lock.json` at the repository root, and `eslint.config.mjs` wants its
`.claude/skills/**` ignore back so our lint stops reporting warnings on somebody else's
source. Re-run the table above afterwards rather than trusting it, since it describes a CLI
this repository does not pin.
