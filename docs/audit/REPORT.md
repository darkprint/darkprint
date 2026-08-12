# Dead-code audit — evidence and classification

Phase 0-2 of the darkprint dead-code audit, branch `chore/audit-cleanup`. Raw gate output
and repo stats are in `docs/audit/baseline.txt`.

## Phase 1B — outcome (2026-08-12)

The owner answered all five questions below. Executed on that basis:

- **Deleted**: all 7 whole `DEAD` files, all 5 boilerplate SVGs, both dead CSS rules, and
  all 14 `DEAD` in-file functions/consts/types — including the `PLATFORM_STATS` cluster
  (Q1: no, don't revive) and the `SectionRoles` cluster (`cardId`/`boxProps`/`wireProps`
  plus their `roles.test.ts` block; Q2: no, don't revive) and the dead `RunLayers`
  function (Q5: confirmed dead, removed).
- **Not deleted**: the `shadcn` devDependency (Q3: owner confirmed it should go, but will
  remove it in their own pass rather than this one — left untouched here).
- **Corrected**: the stale comments in `components/home/index.ts`,
  `components/hero/Hero.tsx` and `components/hero/Wordmark.tsx` that described
  `SectionRoles.tsx`/`SectionExample.tsx`/`SectionDoors.tsx` as still present (Q4: yes).
- Deleting a symbol sometimes orphaned a sibling that existed only to serve it (e.g.
  `SuggestedModels`' `MODEL_CONTEXT_WINDOW`/`formatContextWindow`/`ChipList`'s
  `contextWindows` prop in `components/blueprint/Requirements.tsx`, and `HandoverAxis`'
  `OFFLINE`/`ONLINE`/`AxisCell`/`AxisStep` in `components/explain/ConceptFigures.tsx`).
  Those were removed too, rather than left as new dead code the audit would have to
  rediscover.
- All four gates verified green after every deletion: `npm run typecheck`, `npm run
  lint`, `npm test` (3622/3622 — down from 3636 only because several test files
  dynamically generate one case per file/anchor by walking the directory tree, so the
  reduction tracks the files removed, not a break), and `npm run build` (still 165
  pages). `npx knip` re-run afterward reports zero unused files (down from 7) and the
  unused-export/-type counts dropped by exactly the symbols removed.
- Below is the original **read-only** evidence and classification as gathered; it is left
  as written rather than edited into past tense throughout, since it is the record of
  what the evidence showed *before* action was taken.

**Scope reminder carried through every verdict below:** this repository is the
frontend-only implementation of darkprint.io. The backend does not exist. Every data
source is a mock, a fixture or hardcoded content, deliberately, as an executable
specification of the service to build. "Not referenced yet" is not "dead" — the burden of
proof for `DEAD` is a confirmed absence of any reference *and* a read of the code *and*,
where the code's own comments discuss its lifecycle, confirmation that no live consumer
was documented as replacing it.

## How the evidence was gathered

- **knip** (primary signal): unused files, exports, types, dependencies.
- **depcheck**: cross-check on dependencies.
- **madge**: orphans (too noisy to use directly — see note) and circular deps.
- **ts-prune**: skipped in favour of knip's export report, which is a maintained
  superset of the same analysis (task's own fallback option).
- Per candidate: `git log -1 --format=%ad -- <path>`, and where a symbol looked orphaned,
  `git log --oneline -- <path>` / `git log -p` to find the commit that removed its last
  caller.
- Per candidate: `rg -n "<name>"` across the whole repo, `.md`/`.json`/`.css` included,
  distinguishing a real import from a prose comment that only *mentions* the name.
- `npm test` (3636 tests, 92 files, all passing) as a live guard, in particular
  `components/site/nav.test.ts`, which walks the filesystem and both link tables and
  fails if a route exists with no link to it or a link points at nothing.

**`madge --orphans` note:** run over `app components lib`, it flagged 200+ files as
"orphans" — every `page.tsx` (reached by the router, not an import), every `.test.ts(x)`
(reached by vitest's config globs, not an import) and barrel re-exports. This is exactly
the false-positive shape the task warns about, so it was used only to confirm the absence
of *other* orphan modules beyond knip's 7, not as a standalone signal.

## Summary

| Label | Count | Approx. bytes | Action |
|---|---:|---:|---|
| `DEAD` | 29 items (7 whole files, 5 assets, 1 dependency, 2 CSS rules, 14 functions/consts/types across 10 locations) | ~36.3 KB (whole files + assets: 33,864 + 3,314 bytes) + a few KB (in-file symbols, not separately measured) | Candidate for deletion in Phase 1B, owner sign-off requested on 3 (see questions) |
| `DUPLICATE` | 0 | – | none met the near-identical-twin bar |
| `PENDING-BACKEND` | 1 module family (`lib/core/**`, ~90 flagged export/type lines) + 1 module family (`lib/data/{account,bundles,community,profiles}.ts`, 6 flagged types) | n/a (kept) | keep, documented below, feeds Phase 2 |
| `UNREACHABLE-ROUTE` | 0 | – | none — see Routes section |
| `KEEP` (knip false positive: exported, used only within the same file) | ~30 exports/types | n/a | no action, noted for export hygiene only |

Also reported, not classifiable in the five labels: 1 benign type-only circular
dependency, and a cluster of **stale source comments** naming two files that were
deleted five days before the most recent edit of the comment that still describes them
as present.

---

## `DEAD`

### Whole files

| Path | Kind | Bytes | Evidence | Last commit | Confidence | Proposed action |
|---|---|---:|---|---|---|---|
| `components/home/lifecycle/AssistFigure.tsx` | component | 5378 | knip unused-file; zero repo-wide references outside its own file and sibling `TeacherFigure.tsx`'s docblock; `git log -p` on `SectionLifecycle.tsx` shows its import line (`import { AssistFigure } from "./lifecycle/AssistFigure"`) deleted in commit `7c6bc80` ("landing: 'One registry, two loops' becomes one question"), replaced by `next/image` reading `public/home/lifecycle/*.webp` | 2026-08-08 | high | delete |
| `components/home/lifecycle/ConnectFigure.tsx` | component | 4095 | same commit, same replacement; import line deleted in `7c6bc80` | 2026-08-08 | high | delete |
| `components/home/lifecycle/TeacherFigure.tsx` | component | 4084 | same | 2026-08-08 | high | delete |
| `components/home/lifecycle/UploadFigure.tsx` | component | 4499 | same | 2026-08-08 | high | delete |
| `components/spec/FigureFrame.tsx` | component | 3012 | knip unused-file; the only live `FigureFrame` import site (`app/what-a-blueprint-is/page.tsx:9`) resolves to a **different, structurally unrelated** `FigureFrame` re-exported from `components/learn/PartFigures.tsx:1088` (`export { Frame as FigureFrame }`), whose own docblock states it replaced the three landing-page figures' old frame ("All three used to live inside a `h-28` box..."). Confirmed by reading both: this file is not near-identical to its replacement, so `DEAD` rather than `DUPLICATE` | 2026-08-07 | high | delete |
| `components/ui/OnwardRoutes.tsx` | component | 10792 | knip unused-file; zero import statements anywhere; its own docblock records, in detail, that both consumers dropped their route-box sections (`/skill` per the author's 2026-08-07 ruling, `/mcp` per the 2026-08-11 "§B4" hand-off) — `app/skill/page.tsx:83` and `app/mcp/page.tsx:371` both cite this file by path in a comment, not an import | 2026-08-11 | high | delete |
| `components/ui/PageContents.tsx` | component | 2004 | knip unused-file; zero import statements anywhere; `app/build/page.tsx:195` and `components/spec/sequence.ts:48` both describe it in the past tense as replaced by a sidebar rail | 2026-08-10 | high | delete |

### Assets

| Path | Bytes | Evidence | Last commit | Confidence | Proposed action |
|---|---:|---|---|---|---|
| `public/file.svg` | 391 | Unmodified `create-next-app` boilerplate. Zero references anywhere (`rg -n "file.svg"` — no hits); single commit in the file's entire history | 2026-07-23 (initial commit) | high | delete |
| `public/vercel.svg` | 128 | Same pattern | 2026-07-23 | high | delete |
| `public/next.svg` | 1375 | Same pattern | 2026-07-23 | high | delete |
| `public/globe.svg` | 1035 | Same pattern | 2026-07-23 | high | delete |
| `public/window.svg` | 385 | Same pattern | 2026-07-23 | high | delete |

(`app/icon.svg` is the real, live favicon — App Router convention, excluded per the
false-positive guard, not listed here.)

### Functions, consts and types inside otherwise-kept files

| Path:Line | Symbol | Kind | Evidence | Last commit | Confidence | Proposed action |
|---|---|---|---|---|---|---|
| `lib/href.ts:15` | `kindHref` | function | Zero references besides its own declaration; `contentHref`/`nodeHref`/`termHref` in the same file are the ones actually called | 2026-07-28 | high | delete function |
| `components/graph/framing.ts:490` | `minCanvasFor` | function | Zero callers, including within the same file; `legiblePx` is computed independently elsewhere (`schematic-boxes.ts`) | 2026-08-06 | high | delete function |
| `components/blueprint/Requirements.tsx:92` | `SuggestedModels` | function/component | Never rendered as JSX anywhere; `app/blueprints/[slug]/page.tsx`'s own comment states "'Suggested models' stood here and is gone" | 2026-08-05 | high | delete function |
| `components/build/choices.ts:160` | `outputSubject` | function | Single grep hit repo-wide (its own declaration); no internal or external caller | 2026-08-08 | high | delete function |
| `components/explain/ConceptFigures.tsx:564` | `HandoverAxis` | function/component | Never rendered as JSX (`<HandoverAxis` — zero hits); every other hit is a prose comment naming it, including three in `app/what-a-blueprint-is/page.tsx` that discuss what it *used to* draw | 2026-08-08 | high | delete function |
| `components/explain/RunLayers.tsx:388` | `RunLayers` | function/component | Never rendered as JSX; the file's other exports (`BlueprintGraph`, `LAYERS`, `RubricGlyph`, `TONE`) are imported by `RunSystemMap.tsx`, which is the thing actually mounted on `/what-a-blueprint-is` — confirmed by reading `RunSystemMap.tsx`'s import list. The file itself is `KEEP` for its other four exports; only the `RunLayers` function is dead | 2026-08-10 | high | delete function — pending owner Q5 |
| `components/ui/PhaseCoverage.tsx:66` | `PhaseCoverageView` | type | Zero usages anywhere, including the same file — the components in this file destructure `covered`/`missing` as separate props rather than a value of this shape | 2026-08-12 | high | delete type |
| `components/viz/easing.ts:54` | `EASE_IN_OUT` | const | Zero importers; its sibling `EASE_OUT` is the one actually used by `Wordmark.tsx` and `useLuminousFlow.ts` | 2026-08-06 | medium | delete const |
| `components/home/roles.ts:135,140,146` | `cardId`, `boxProps`, `wireProps` | functions | See "The SectionRoles cluster" below — production-dead, exercised only by the module's own test | 2026-08-07 | high | delete functions + their test block — pending owner Q2 |
| `lib/data/index.ts:19,22,29` | `SEED_BLUEPRINTS`, `FEATURED_BLUEPRINTS`, `PLATFORM_STATS` | consts | See "The PLATFORM_STATS cluster" below | 2026-07-28 | high | delete consts — pending owner Q1 |

### The `SectionRoles` cluster — a deeper case

`components/home/roles.ts` is mostly `KEEP`: `ROLE_BOXES`, `ROLE_WIRES`, `ROLE_ABSENCE`
and `roleBox` are imported by `components/home/graph.ts`, which is consumed by
`BlueprintWalk.tsx`, which mounts on the live landing page. But three of its exports —
`cardId`, `boxProps`, `wireProps` — exist only to feed props to a component called
`SectionRoles`, per the file's own header comment ("What `SectionRoles` draws, as
data") and per-function doc comments ("What `NodeBox` needs", "What `Edge` needs").

`components/home/SectionRoles.tsx` does not exist. `git log --diff-filter=D -- components/home/SectionRoles.tsx`
shows it was deleted in commit `d900af2` ("Cut four reconciling paragraphs and the four
orphaned components", 2026-08-07), along with three sibling components
(`SectionExample.tsx`, `components/spec/LatticeFigure.tsx`,
`components/spec/EnforcementFigure.tsx` — all three also confirmed gone by the same
method).

`rg -n "\bboxProps\b"` today returns exactly two hits: the declaration and
`components/home/roles.test.ts` (which calls it directly and via `wireProps`/`cardId` in
its "the props the drawing is built from" block, lines 141-155). No production file
imports any of the three. This is dead application code kept alive only by its own unit
test — worth calling out distinctly from a plain unused export, because knip's default
config counts a test import as a legitimate consumer and does not flag it.

### The `PLATFORM_STATS` cluster — a deeper case, flagged for the owner

`lib/data/index.ts` exports `SEED_BLUEPRINTS`, `FEATURED_BLUEPRINTS` and
`PLATFORM_STATS`, all three derived live from `lib/content` (real counts off the
archive, not seeded mock numbers). None has a current importer. Two source comments
claim a consumer:

- `components/hero/Hero.tsx:48`: "This file used to read `PLATFORM_STATS`... the same
  three figures still appear on beat 5, in `components/home/SectionDoors.tsx`".
- `components/hero/Wordmark.tsx:120`: "`PLATFORM_STATS` itself stays —
  `components/home/SectionDoors.tsx` still prints the same three figures on beat 5".

`components/home/SectionDoors.tsx` does not exist. `SectionLifecycle.tsx`'s own header
comment says outright: "the doors offered two ways in; this offers five... So the links
are back and the section is the ending. `SectionDoors` is deleted." `SectionLifecycle`,
its confirmed successor, imports only `next/image` and static `.webp` paths — no data
from `lib/data`.

So the evidence is internally consistent and points to `DEAD`: the sole documented
consumer of these three exports is gone, and nothing replaced it. Classified `DEAD` on
that evidence, but flagged as an owner question below rather than assumed, because
unlike the rest of this list it is presentational product content (three counters a
reader used to see) rather than pure engineering scaffolding, and reviving it is cheap
(the data is already computed) if it was only ever meant to move, not disappear.

### CSS

| Selector | File:lines | Evidence | Last commit | Confidence | Proposed action |
|---|---|---|---|---|---|
| `.dot-grid` | `app/globals.css:347-353` | Zero references in any `.ts`/`.tsx` file (checked as a literal class-name substring, not just an exact selector, to catch `cx()`-built strings); no sibling class of a similar name is used either | 2026-08-11 | high | delete rule |
| `.grain::after` | `app/globals.css:356-364` | Same — zero references; comment above it documents an *intended* usage pattern ("use on `::after` with `pointer-events:none`") that nothing in the codebase follows through on | 2026-08-11 | high | delete rule |

### Dependency

| Package | Type | Evidence | Confidence | Proposed action |
|---|---|---|---|---|
| `shadcn` | devDependency | Flagged independently by knip and depcheck; no `components.json` anywhere in the repo; zero import of `shadcn` in `app/`, `components/` or `lib/`; the only repo mentions are the `package.json` line itself and a since-removed `.mcp.json`/`.claude/settings.local.json` MCP-server declaration that a prior, separate audit in this repository (`docs/audit/CONTEXT_SURFACE.md`, Q12) already recorded the owner denying ("as the mcp server needed always to be designed by me") | high | remove from `package.json` — pending owner Q3 |

`@tailwindcss/postcss` and `tailwindcss` were also flagged by depcheck alone (not knip).
Both are **false positives**: `postcss.config.mjs` loads `@tailwindcss/postcss` as its
only plugin, and `app/globals.css:1` is `@import "tailwindcss";`. depcheck's static
resolver does not follow either of those non-`import`-statement usages. `KEEP`, no
action.

---

## `DUPLICATE`

None found. `components/spec/FigureFrame.tsx` was the one file that looked like a
duplicate on its name alone (another `FigureFrame` is live elsewhere), but reading both
shows they are structurally unrelated implementations of the same general idea (a
captioned frame) rather than near-identical twins — classified `DEAD` above instead. A
targeted search for other copy/backup/v2-style filenames and for repeated large blocks
found nothing else.

---

## `PENDING-BACKEND`

### `lib/core/**` — the engine's public surface

`lib/core/index.ts` opens with: *"The one module the app imports... Re-exports are
written out by name rather than `export *` so this file doubles as the inventory of what
the engine promises."* That is an explicit, first-party statement that this barrel is a
declared API surface, not incidental code — and it accounts for **90 of the 169**
knip-flagged unused-export/unused-type lines (both a symbol's origin declaration in its
submodule, e.g. `lib/core/analysis/autonomy.ts:73`, and its re-export in the barrel,
e.g. `lib/core/index.ts:148`, are separately flagged for the same underlying export).
Examples: `emitAttractorDot`, `lintAttractor`, `buildRegistry`, `computeSecurity`,
`checkVersionChain` and their associated types are all exported from the barrel and not
currently called by any page or component, because the UI so far only exercises the
parts of the engine a given screen needs — the rest is the isomorphic analysis/build
engine (`lib/core/**`, which `CLAUDE.md` itself flags as load-bearing for the future
`/upload` browser path) sitting ready for the API routes and CLI tooling a real backend
will add. `KEEP`, no action; this is exactly the "mock data, api stubs, types" case the
task's own type table names.

### `lib/data/{account,bundles,community,profiles}.ts` — the seeded account layer

Six knip-flagged unused types — `NotificationSetting`, `Drift`, `DraftDetail`, `Draft`,
`ReportedCost`, `PinnedRef` — are each used to type a sibling field in the same file
(e.g. `notifications: readonly NotificationSetting[]`), just never imported by name from
outside it (normal under TypeScript's structural typing — a consumer can hold a value of
the shape without ever writing the type's name). Every one of these four files opens
with a comment stating outright that it exists because there is no backend yet:
`lib/data/account.ts`: *"There are no accounts. `PROJECT.md` §2 says so... This module
is the row an account would be"*; `lib/data/community.ts`: *"everything that moves...
belongs to a database instead. This module is that database... until there is a real
one."* `KEEP`, no action — textbook `PENDING-BACKEND`.

---

## `KEEP` — knip false positives (exported, used only inside the declaring file)

~30 exports/types across `components/graph/framing.ts`, `components/graph/return-lane.ts`,
`components/graph/schematic-boxes.ts`, `components/graph/AgentNode.tsx`,
`components/build/choices.ts` (`STARTER_NODES`, `CAPS`), `components/home/roles.ts`
(`cardId` is the one exception — see above), `components/home/graph.ts`,
`components/home/nodecard/{yaml.ts,YamlListing.tsx}`, `components/ontology/{TermTable,TermTree}.tsx`,
`components/profile/Pinned.tsx`, `components/site/Logo.tsx`,
`components/ui/{RegistryFilterBar,useQueryState,PhaseCoverage}.tsx` (`PhaseCoverageView`
is the one exception — see above), `components/viz/{label-boxes,useLuminousFlow}.ts`,
`components/panes/{dot-breakdown,model}.ts`, `components/spec/sequence.ts`,
`components/upload/BundleDropzone.tsx`, `lib/graph-seed.ts`, `lib/starter/variants.ts`,
`lib/criteria-state.ts`, `lib/types.ts` (`AutonomyLevel`), `lib/content/{bundle-export,layout}.ts`,
and `scripts/skill-refs.ts` (whose three flagged symbols are all consumed by that same
script's own `GENERATED_REFS` array, itself run by `npm run generate:skill-refs`).

All confirmed, per-symbol, by reading the file and finding a real call site in the same
module. This is live code that is exported more widely than it needs to be — a minor
export-hygiene nit, not dead code, and out of scope for a deletion pass. No action
requested.

---

## Unused dependencies and unused exports — see above

Covered inline in the `DEAD` and `KEEP` sections: one true unused dependency
(`shadcn`), two depcheck false positives (`tailwindcss`, `@tailwindcss/postcss`), ten
dead exports/consts/types, and ~30 knip-flagged-but-live exports.

---

## Dead code inside otherwise-kept files

- **Unused CSS rules**: `.dot-grid` and `.grain::after` in `app/globals.css` — see above.
- **Commented-out code blocks**: none found. Searched for `// const|let|export|function|import|return|<Component` patterns and for `/* ... */` blocks wrapping statement-shaped text across `app/`, `components/`, `lib/`, `scripts/`; every hit was prose, not disabled code.
- **`@deprecated` / `TODO` / `FIXME` markers**: one `@deprecated` marker, on `OnwardRoutes.tsx`'s `blurb` field — moot, the whole file is `DEAD` above. No `TODO`/`FIXME` markers anywhere in `app/`, `components/`, `lib/`, `scripts/` (the only hits are the literal string `"TODO"` used as card-content test fixtures in `lib/core/analysis/*`).
- **Unreachable branches / dead feature flags**: none found. `npm run lint` and `npm run typecheck` both pass clean (0 warnings), which for this ruleset (`eslint-config-next` + strict TypeScript) would ordinarily surface at least some unreachable-code and unused-variable cases if present.
- **Unused props**: not separately audited — this would require a per-component read of every prop against every call site, which is a much larger pass than the file/export/type-level analysis above; flagged as a gap, not a finding.

---

## Routes

- **Route list** (from `npm run build`, see `docs/audit/baseline.txt`): 22 static/SSG
  top-level routes plus 6 dynamic segments (`/blueprints/[slug]`, `/nodes/[...id]`,
  `/ontology/[...term]`, `/u/[username]`, `/u/[username]/[slug]`, and four more
  `/u/[username]/*` sub-routes), 165 pages generated in total.
- **Per-route bundle size**: not reported by this Next.js version's (16.2.11, Turbopack)
  build output — no `First Load JS`/`kB` column appears in the table it prints. Not
  independently measurable without a webpack-bundle-analyzer-style pass, which was out
  of scope for this audit.
- **`UNREACHABLE-ROUTE`: zero found.** `components/site/nav.test.ts` is a live,
  passing guard that (a) walks every top-level `app/*/page.tsx` directory and asserts
  it has a header/Learn-menu/account-menu entry (`"lists every top-level route in the
  header"`), (b) walks the two multi-step sequences (`/spec/*`,
  `/towards-a-dark-factory/*`) and asserts every child route is carried in the footer,
  and (c) asserts every header and footer link resolves to a real `page.tsx`. All three
  pass today, alongside the other 3633 tests. This does not cover the dynamic detail
  routes (`/blueprints/[slug]`, `/nodes/[...id]`, etc.), but those are reached through
  their own index pages by construction, not by a chrome link, so the same check does
  not apply to them.
- All redirects in `next.config.ts` were spot-checked against `nav.test.ts`'s
  `"redirects every old path, permanently, to a page that exists"` and
  `"has removed every old page, so the redirect is the only answer"` cases — both pass.

---

## Circular dependency (reported, not actionable)

`madge --circular` found one: `lib/core/bundle/types.ts` → `lib/core/analysis/phase-coverage.ts`.
Read both: `bundle/types.ts` imports `PhaseCoverage` from `phase-coverage.ts` with
`import type`, and its own comment states the cycle "is therefore erased at compile
time: this module declares no values, so it emits no imports at all." Confirmed —
this is a type-only cycle with no runtime import, a common and harmless TypeScript
pattern. No action.

---

## Stale documentation found while tracing evidence (not a code-deletion item)

Several source comments — not markdown files, but `.ts`/`.tsx` docblocks — describe
files that no longer exist as though they were still present:

- `components/home/index.ts:13-15` (last touched 2026-08-12, in a commit that did not
  touch this docblock) still reads: *"`SectionRoles` is the one with no mount at all
  now... the file and its two guards stay, so the drawing can be re-mounted without
  being re-derived."* `components/home/SectionRoles.tsx` was deleted on 2026-08-07
  (commit `d900af2`). The same docblock also lists `SectionExample` as one of four
  components "still here at their own paths" — `components/home/SectionExample.tsx`
  was deleted in the same commit.
- `components/hero/Wordmark.tsx:120-125` and `components/hero/Hero.tsx:48-53` both cite
  `components/home/SectionDoors.tsx` as the current home of `PLATFORM_STATS`'s three
  counters. That file is deleted (see the `PLATFORM_STATS` case above).
- By contrast, `app/mcp/page.tsx:371-374` already self-corrects: it cites
  `OnwardRoutes.tsx` and explicitly notes "that file's count of remaining mounts is
  stale by one and says so" — a model of how to leave this kind of note.

Per the task's own rule, a stale document is never evidence that code is needed, and
these don't change any verdict above — the verdicts were reached by reading the actual
current code and grepping for real usages, not by trusting the comments. Reported
because the comments themselves are worth a cleanup pass, and because they were the
reason `PLATFORM_STATS` and the `SectionRoles`-only exports looked "kept" on a shallow
read before the git-history check.

---

## Questions for the owner

1. `SEED_BLUEPRINTS`, `FEATURED_BLUEPRINTS` and `PLATFORM_STATS` in `lib/data/index.ts`
   were last rendered by `SectionDoors.tsx`, deleted 2026-08-07 when the landing page
   was reworked, and nothing has shown the three platform counters since. Is reviving
   them (e.g. back onto `SectionLifecycle` or the hero) still intended? (If no, they are
   deleted along with the rest of the `DEAD` list.)
2. `cardId`, `boxProps` and `wireProps` in `components/home/roles.ts` exist only to
   serve `SectionRoles.tsx`, deleted 2026-08-07, and are now exercised only by their own
   unit test (`roles.test.ts`, the "the props the drawing is built from" block). Is
   `SectionRoles` meant to come back? (If no, the three functions and that test block
   are deleted together.)
3. `shadcn` is an unused devDependency with no `components.json`. A separate audit
   already in this repo (`docs/audit/CONTEXT_SURFACE.md`, Q12) recorded you saying you
   did not add the paired `.mcp.json` shadcn MCP server on purpose. Should the `shadcn`
   devDependency be removed in the same pass as this one?
4. Several source comments (listed above) describe two deleted components
   (`SectionRoles.tsx`, `SectionExample.tsx`, and the `SectionDoors.tsx` /
   `PLATFORM_STATS` pairing) as if they still exist. Should those comments be corrected
   as part of Phase 1B?
5. `components/explain/RunLayers.tsx` exports one dead function (`RunLayers`) alongside
   four live ones (`BlueprintGraph`, `LAYERS`, `RubricGlyph`, `TONE`). Comments in
   `components/explain/ConceptFigures.tsx` and `app/what-a-blueprint-is/page.tsx`
   describe `RunLayers` (the function) as a section of the page that exists today. Was
   that section cut, with the comments left behind? (If yes, the function is deleted
   along with the rest of the `DEAD` list; if it was instead renamed and is still live
   somewhere, say where and it is reclassified `KEEP`.)

---

## Gaps and out-of-scope notes

- Unused props on otherwise-live components were not audited (see "Dead code inside
  otherwise-kept files" above) — would need a call-site-by-call-site read per component.
- `content/**` and its generated mirrors in `public/bundles/**` / `public/cards/**` were
  treated as product copy per the task's own rule and not individually claim-mined or
  orphan-checked beyond confirming the generator's own count (9 bundles, 57 card
  versions) matches between `content/` and `public/` in the build log.
- Per-route JS bundle size could not be reported — see Routes section.
