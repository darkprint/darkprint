<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# `skills-lock.json` is not generated cruft — do not delete it

The repository ships one skill of its own, `skills/darkprint/`, and the documented way to
get it is `npx skills@latest add Brotherhood94/darkprint`. That command does a shallow git
clone and then searches the clone for skills, and `.claude/skills/` is one of the
directories it searches. Two third-party skills are vendored there and tracked in git.

`skills-lock.json` at the repository root is what suppresses them: the CLI hides any skill
under an agent project directory whose name is a key in the repo's lock file. Verified on
this tree by deleting the file and re-running the CLI against a clone —

- with it:    `Found 1 skill`  → `darkprint`
- without it: `Found 3 skills` → `darkprint`, `content-reorg`, `impeccable`

so removing it silently starts offering strangers two skills that are not this project's
to distribute, and nothing in `npx tsc --noEmit`, `npm run lint` or the test suite notices.
It looks like a lock file a package manager would regenerate. Nothing regenerates it.
