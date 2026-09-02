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
* **Outstanding work is the one exception, and it lives in `docs/ARCHITECTURE.md` §11.0.**
  Read it at the start of a session, before proposing what to do next. It is not a plan and
  not a status report: it is the list of things that are owed, each with what blocks it and
  where the detail is. It exists because "is this done yet" kept being re-derived from
  conversation that no longer exists, and re-derivation gets it wrong — a premise that was
  true in one session is quietly false in the next.
  * Update a row **in the same change that changes its state**, never afterwards. A queue
    updated later is a queue that disagrees with the tree.
  * A row reaching `DONE` carries the date and the commit, and moves into §11's subsections
    on the next pass. §11.0 stays short enough to actually read.
  * Adding a row is cheap and correct. Leaving something owed out of it, because it felt
    obvious at the time, is how it gets lost.
* Never record a decision in docs/DECISIONS.md as CONFIRMED unless the owner stated it
  in this conversation. Otherwise it is PENDING-OWNER-REVIEW and carries no authority.
* When an instruction file and the code disagree, the code wins and you report the
  divergence. Never edit the code to match a document.

## Documentation is part of the definition of done

`docs/ARCHITECTURE.md` is the single source of truth for the DarkPrint frontend and the
specification from which the backend will be built. It must never lag behind the code.

Update it in the **same commit** as the change:

| If you change | Update these sections |
| --- | --- |
| add, remove or rename a route | 4 sitemap, and 5 journeys if the route is reachable |
| add or change a domain concept, a type, or a fixture field | 2 glossary, 3 concept model |
| add a form, an upload, a button or any interaction needing a server | 8 seams, new SEAM id, plus a TODO(SEAM-xx) in the code |
| replace a mock with a real call | 8 seams, and flip the status tag from MOCK to LIVE everywhere it appears |
| add a shared component, a hook, or a folder | 6 architecture: tree and dependency graph |
| change where state lives or what is persisted | 7 state and data flow |
| change a design token or an animation convention | 9 design system |
| change metadata, JSON-LD, breakpoints, error or empty states | 10 cross cutting |
| make a deliberate shortcut or leave something unfinished | 11 known gaps |

Rules:
* update the `Last verified against commit <sha> on <date>` line whenever you touch the document
* add a row to the revision log in section 12
* if a change makes a diagram wrong, fix the diagram. Never add a note saying it is outdated
* if you cannot update a section, write a `TBD:` line with the open question. Silence is not allowed
* status tags are LIVE, MOCK, PLANNED. No other values
* never invent an endpoint, an entity or a behavior that is not in the code

Commit checklist:
- [ ] docs/ARCHITECTURE.md updated, or explicitly not affected and why
- [ ] every touched Mermaid diagram compiles
- [ ] Last verified line and revision log updated
