# CLAUDE.md

## Running the project

- `npm run dev` — dev server
- `npm run build` — production build; `prebuild` runs `scripts/generate-bundles.ts`,
  which rewrites `public/bundles/**` and `public/cards/**` from `content/`. Expect that
  diff and commit it, or run `rm -rf .next public/bundles && npm run build` first if you
  want a clean rebuild before committing.
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `eslint`
- `npm test` — `vitest run`

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ
from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before
writing any route or config code. Heed deprecation notices.

## Code conventions

- `lib/core/**` is isomorphic: no `node:*`, no `Buffer`, no `Date.now()`, no
  `Math.random()`. It has to keep running the same in the browser on `/upload`.
- Never run prettier. This repo has no prettier config, and it reflows to 80 columns,
  producing a spurious diff.
- Comments explain *why*, not what — cite the reason that forced the decision. A comment
  restating the code is noise.
- No em dash as a pause, and no AI-writing patterns ("not X, but Y", rhythmic triplets,
  empty emphasis) in shipped copy.
- Never take a `fullPage` screenshot. Chrome grows the viewport to document height and
  every `100vh` block balloons into a layout no reader ever sees.

## Definition of done

- Verify agent and tool reports before trusting them; run the gates yourself.
- When you add a guard, falsify it: break the code on purpose, watch the test fail with
  the right message, then restore it.
- Never delete or loosen an assertion about accessibility, contrast, label overlap, or an
  honesty disclaimer without the owner's explicit instruction.
- Before calling work done: `npm run typecheck`, `npm run lint`, `npm test`, and
  `npm run build` must all pass.

## Vendoring third-party skills

Do not vendor a third-party skill under `.claude/skills/` without also adding it to a
`skills-lock.json` at the repository root and restoring the `.claude/skills/**` ignore in
`eslint.config.mjs`. `npx skills@latest add <tree>` searches `.claude/skills/`, and
anything vendored there and not locked out gets handed to strangers as though it were
this repository's own skill.

### Context hygiene

* Do not create new markdown files at the repository root. Ever.
* New durable knowledge goes into exactly one of: CLAUDE.md (rules),
  docs/ARCHITECTURE.md (how the system is), docs/DECISIONS.md (why it is that way).
* Plans, status updates, session summaries and retrospectives do not belong in the
  repository. They are ephemeral and they stay in the conversation.
* Never record a decision in docs/DECISIONS.md as CONFIRMED unless the owner stated it
  in this conversation. Otherwise it is PENDING-OWNER-REVIEW and carries no authority.
* When an instruction file and the code disagree, the code wins and you report the
  divergence. Never edit the code to match a document.
