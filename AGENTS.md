<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# `skills-lock.json` is not generated cruft — do not delete it

The repository ships one skill of its own, `skills/darkprint/`, and the documented way to
get it is `npx skills@latest add Brotherhood94/darkprint`. That command does a shallow git
clone and then searches the clone for skills, and `.claude/skills/` is one of the
directories it searches. One third-party skill, `content-reorg`, is vendored there and
tracked in git.

`skills-lock.json` at the repository root is what suppresses it: the CLI hides any skill
under an agent project directory whose name is a key in the repo's lock file. Re-measured
2026-08-11, after `impeccable` was deleted, by cloning this tree and running
`npx skills@latest add <clone> -l` from an empty directory with and without the file —

- with it:    `Found 1 skill`  → `darkprint`
- without it: `Found 2 skills` → `darkprint`, `content-reorg`

so removing it silently starts offering strangers a skill that is not this project's to
distribute, and nothing in `npx tsc --noEmit`, `npm run lint` or the test suite notices.
It looks like a lock file a package manager would regenerate. Nothing regenerates it.

The file still carries a key for `impeccable`, which was deleted on 2026-08-11 along with
the two `.claude/settings.local.json` hooks that ran it. The key is inert — the `with it`
count above was measured with it still in place — and it is left alone on purpose: the
only job this file has is suppressing `content-reorg`, and editing it to tidy one dead
line is not worth the chance of breaking that. Delete the key only alongside the vendored
skill it names, and re-run the two counts above afterwards.
