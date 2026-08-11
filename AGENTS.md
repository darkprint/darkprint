<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# `skills-lock.json` is inert now, and this is the trap it used to guard

Nothing under `.claude/skills/` any more. `impeccable` and `content-reorg` were both
deleted on 2026-08-11 and the directory went with them, so this section is a record of a
hazard rather than a live warning. Read it before vendoring anything under `.claude/`
again, because the hazard comes back with the first skill that lands there.

The repository ships one skill of its own, `skills/darkprint/`, and the documented way to
get it is `npx skills@latest add Brotherhood94/darkprint`. That command does a shallow git
clone and then searches the clone for skills, and `.claude/skills/` is one of the
directories it searches — so anything vendored there is offered to strangers as though it
were ours. `skills-lock.json` is what suppressed them: the CLI hides any skill under an
agent project directory whose name is a key in the repo's lock file.

Measured three times on this tree, by running `npx skills@latest add <tree> -l` from an
empty directory with and without the file:

| state of `.claude/skills/` | with the lock file | without it |
| --- | --- | --- |
| `impeccable` + `content-reorg` | `Found 1 skill` → `darkprint` | `Found 3 skills` |
| `content-reorg` only | `Found 1 skill` → `darkprint` | `Found 2 skills` |
| empty, as now | `Found 1 skill` → `darkprint` | `Found 1 skill` |

The third row is why the file is now inert: it changes nothing in either direction. It is
also unable to bring the deleted skills back — `npx skills@latest experimental_install`
reads its two remaining keys, reports `Restoring 2 skills`, and then stops on
`Local path does not exist`, because both entries are `sourceType: local` pointing at
paths that are gone. So the file is harmless in both directions and safe to delete.

It is kept anyway, along with its two dead keys, because it is the cheapest place for the
rule to live: **vendor a third-party skill under `.claude/` and it needs a key here, or the
next person to run the documented install command hands it out under this project's name.**
Nothing in `npx tsc --noEmit`, `npm run lint` or the test suite notices if that goes wrong.
The `.claude/skills/**` entry in `eslint.config.mjs` was removed for the same reason and
its comment says so; both want restoring together.
