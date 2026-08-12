# CONTEXT_CONFLICTS — where the instruction surface disagrees with itself and with the code

Phase 0B of the darkprint context-reset audit. Built from `docs/audit/CONTEXT_SURFACE.md`
and `docs/audit/CLAIMS_RAW.md`; every code reference was checked against the working tree at
`27de537`. Decision IDs (`D-nn`) point at `docs/DECISIONS.md`.

Nothing here is a recommendation to change code. Several rows describe behaviour that is
probably right and a document that is probably stale; which one is wrong is the owner's
call. Sixteen of those calls were made on 2026-08-12 and are recorded verbatim in the
appendix. **No question in this report is left open.**

---

## 1 · Instruction conflicts

Pairs of files that tell an agent different things about the same subject. "Wins" means:
what an agent would do if that file were the only one it loaded.

### 1.1 The autonomy ordinal — build the gauge, or refuse to

| | |
|---|---|
| **File A** | `PROJECT.md:57-58`, `architecture/engine.md:55-56,63-64`, `files/darkprint-ontology-v0.1.md:125` |
| **Says** | "no autonomy ordinal on any user-facing surface", unqualified; "never as *N su 4* with a progress bar" |
| **File B** | `docs/superpowers/specs/2026-07-29-visual-polish-design.md:24-107`, `docs/superpowers/plans/2026-07-29-visual-polish.md:21-23,297-310,527-529`, `docs/superpowers/specs/2026-07-29-content-cli-design.md:110-128` |
| **Says** | Build `components/ui/AutonomyBar.tsx`, a four-segment filled gauge keyed off `AutonomyResult.level`, and **edit `PROJECT.md:36` and `architecture/engine.md:63` to record the exception** |

If only A loads, the agent refuses the gauge. If only B loads, the agent builds it and
rewrites the two documents that forbid it — B contains the replacement text. This is the
most dangerous pair in the repository, for three reasons.

First, **B has already happened and been undone.** Commit `6c69200` built `AutonomyBar`;
commit `feaa9bc`, an "Author-requested batch of six changes", deleted it, both call sites,
its tests, and "fully reverted the 'no-ordinal rule' exception it required across
`PROJECT.md`, `architecture/engine.md`, `lib/types.ts` and `lib/core/analysis/autonomy.ts`
— the rule is back to unqualified".

Second, **both B documents still say `Status: approved, ready for implementation
planning`** (`2026-07-29-visual-polish-design.md:4`, `2026-07-29-content-cli-design.md:4`),
and the plan still carries the PROJECT.md diff verbatim at `:527-529`. Nothing in either
file records the reversal. An agent handed the plan executes a reversal of a reversal.

Third, **both ends of this are now the owner's** (Q1, 2026-08-12): the spec's `Status:
approved` header is his approval, and so is the reversal at commit `feaa9bc`. So this is not
an agent overreaching — it is a decision the owner made and then unmade, with only the
first half written down in `docs/`. The plan is a live instruction to redo it. See D-31,
D-32.

### 1.2 Which route is the ontology index

| | |
|---|---|
| **File A** | `IMPLEMENTATION_PLAN.md:33-35,53` |
| **Says** | Move the vocabulary index to `/spec/ontology`; permanently redirect the old `/ontology` index; `/ontology` is a compatibility URL |
| **File B** | `components/site/SiteHeader.tsx:31-49`, `components/ontology/canonical-route.test.ts:9-49`, `next.config.ts` (the `/ontologies` block) |
| **Says** | `/ontology` is a page again and lists the terms; `/spec/ontology` specifies the format; nothing redirects `/ontology` |

A wins on a fresh read of `docs/` alone, and executing it deletes `app/ontology/page.tsx`
and adds a redirect that would shadow it. B is the state, and B carries the owner's own
words: `components/site/SiteHeader.tsx:37-39` quotes 2026-08-12 — "adopt the term Ontology
also for /ontology page … be consistent through all the website". A file with owner
provenance and a test is losing a documentation race to a file with neither. See D-39, D-40.

### 1.3 What the header's publish control is called — resolved 2026-08-12

**The owner chose the current state** ("keep the current"), so `Publish` stands and the
`[Validate]` rule below is superseded (D-88). The pair is kept on record because the
superseded half is still live text in `docs/superpowers/`, and an agent loading that spec
alone would still "fix" the header back.

| | |
|---|---|
| **File A** | `docs/superpowers/specs/2026-08-04-ia-redesign.md:109-114` |
| **Says** | `[Share yours]` was proposed and is NOT built; the button stays `[Validate]` until publishing exists, because "a '+ Share' label on every page of the site would be the one promise the site cannot keep" — quoted from `SiteHeader.tsx`'s own comment |
| **File B** | `components/site/SiteHeader.tsx:29,74` |
| **Says** | `{ href: "/upload", label: "Publish", group: "action" }` |

A wins on any read of the IA spec, and an agent following it renames the button back. The
rename to `Publish` arrived inside commit `c97dbcb`, a large restructuring whose message
does not mention it, and the reason A gave still applies: `components/upload/UploadFlow.tsx:1185`
says publishing has no backend. See D-43.

### 1.4 What `/build` is for

Three live documents give the route three different jobs:

- `docs/superpowers/specs/2026-08-04-ia-redesign.md:107-108,329-330` — "`/build` is the
  **authoring** page: how to make a blueprint, and how to hand that to your agent… a
  rebuild, and it is critical".
- `sol_feedback.md:232-233` + `IMPLEMENTATION_PLAN.md:21-22` — "rename the page 'Customize
  the starter blueprint'"; "an optional starter sandbox, not a general blueprint designer".
- `docs/superpowers/specs/2026-08-06-build-restructure-design.md:22-23` — "The deliverable
  of `/build` is something an agent can act on. Not a blueprint the reader has studied."

The code implements the second (`components/spec/sequence.ts:368-378`, `Customize the
starter`, `Optional worked example`) while the owner's own quotation at
`2026-08-04-ia-redesign.md:308-311` and `2026-08-06-build-restructure-design.md:30-32`
describes the first. The first is what an agent loading only `docs/superpowers/specs/`
would rebuild. See D-47, D-49, D-51.

### 1.5 Whether the authoring path and the bundle handoff are one artefact

`docs/superpowers/specs/2026-08-04-ia-redesign.md:322-324` asserts that what `/build`
teaches and what a bundle's `AGENTS.md` says "**should be the same artefact**", and
`:484-486` instructs that they be built together because "building either alone means
writing it twice". `:511-515` then lists this as an open question the document itself is
unsure of. `sol_feedback.md:583-585,667-668` instead promotes the authoring **skill** to
the principal create path. The code split all three: `/skill` is "Assisted Design",
`/build` is an optional worked example excluded from the Design menu
(`components/site/SiteHeader.tsx:68-76`), and `lib/content/bundle-export.ts:68` generates
the bundle `AGENTS.md` independently of both. An agent loading the IA spec will try to
merge things the chrome deliberately separates, and the chrome's reason is a reported
author instruction with no quotation behind it.

### 1.6 Whether the dark factory may be the headline

`PROJECT.md:43-44` is an unconditional instruction: "If you find prose anywhere in this
repo that treats the dark factory as the headline, it is a leftover; fix it rather than
following it." But `architecture/README.md:24-26` tells the same agent that "the
specifications are in `files/`", and `files/darkprint-onboarding-positioning.md:31` defines
DarkPrint as "una galleria/registry di blueprint di **dark factory**", while
`files/darkprint-design.md:9` defines it as the place people "**prelevano per eseguire**
blueprint di *dark factory*". `README.md:29-36` still gives the concept its own section.
An agent is told to fix the framing and, in the next file, told that the framing's home is
the authority. See D-01, D-02.

### 1.7 Whether `files/` may be corrected — and whether it has any authority at all

**Resolved 2026-08-12, against the documents.** The owner did not write doc 1, doc 2 or
doc 3 and does not hold them as decisions he adopted (Q2, Q3). Both files below are
therefore wrong about the same thing, and the conflict between them is moot: neither
"frozen source doc" nor "the specifications" describes what these three files are. The cost
is that **649 comments across 138 source files cite them by section** — `doc 1 §11`,
`doc 2 §0.4`, `doc 3 §6` — and every one of those citations now points at an unowned
document. The original conflict is preserved below because it is what let the ambiguity
survive this long.

| | |
|---|---|
| **File A** | `docs/superpowers/specs/2026-07-29-visual-polish-design.md:106-108` — "Leave the historical spec text in `files/*.md` untouched (those are frozen source docs)" |
| **File B** | `architecture/README.md:21-26` — "Every fact here is derived from code… When the two disagree, the code is right and the document is stale — fix the document", immediately followed by "These are not specifications. The specifications are in `files/`" |
| **File C** | `PROJECT.md:316-318` — "The source docs are in `files/`… Section references throughout the codebase point at these" |

So `files/` is simultaneously frozen, authoritative, and cited by section from live code —
and it currently describes an architecture that does not exist (Supabase, object storage,
GitHub Actions on Scaleway runners: `files/darkprint-design.md:169-187,340,357`). No file
tells an agent what to do when a frozen authority is wrong. See D-79, D-80.

### 1.8 Which routes are out of scope for content work

Three documents give `/blueprints/[slug]` three dispositions:

- `docs/superpowers/specs/2026-07-31-content-reorg-design.md:179` — untouched, "per the ask".
- `docs/superpowers/specs/2026-08-04-ia-redesign.md:133` — "Keep. Approved in an earlier pass."
- `sol_feedback.md:239-258` + `IMPLEMENTATION_PLAN.md:23-25` — re-order the whole template.

The first two are the closest thing in the corpus to an owner exclusion (the content-reorg
spec's intro at `:5-7` names the landing, the gallery and the blueprint pages as "approved
as they stand"). The third instructs a rebuild of one of them, and is the file most likely
to be loaded by an agent picking up current work.

### 1.9 Where the em-dash guard lives

`docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:17` names
`components/build/path.test.ts`. Its own spec, at
`docs/superpowers/specs/2026-08-10-landing-reproducibility-beat-design.md:220`, names
`components/build/workspace.test.ts`. `path.test.ts` was renamed to `workspace.test.ts` by
`docs/superpowers/plans/2026-08-06-build-workspace.md`, four days earlier. An agent
following the plan looks for a file the previous plan deleted. See D-74.

---

## 2 · Document versus code

Claims about the code that the code contradicts.

| # | Document says | Code says |
|---|---|---|
| 2.1 | `README.md:45` — "The 8 blueprint bundles and 52 node-card documents under `content/`. The 54-term core ontology." | `content/blueprints/` holds **9**; `content/cards/` holds **57** files, **53** distinct ids; `lib/core/ontology/core.ts` holds **49** terms. `README.md:138-139`, in the same file, gives 9 and 57. `docs/superpowers/specs/2026-07-31-content-reorg-design.md:165` recorded this as stale on 2026-07-31 and it is still there |
| 2.2 | `README.md:169-170` — "The product this prototypes is described in `darkprint-io-note.md`" | No such file exists anywhere in the repository; the source docs are `files/darkprint-design.md`, `files/darkprint-onboarding-positioning.md`, `files/darkprint-ontology-v0.1.md` |
| 2.3 | `README.md:64-65` — "Every tunable number lives in one frozen `DEFAULT_ANALYSIS_CONFIG`" | `lib/core/config.ts:123` exports `DARKPRINT_CONFIG`. The identifier `DEFAULT_ANALYSIS_CONFIG` occurs nowhere in the tree |
| 2.4 | `README.md:4` — the tagline "*Autonomy you can read as a graph.*" | Retired by commit `feaa9bc` at the owner's request; `app/layout.tsx:38-46` leads with "reusable blueprints for agent workflows". README is the last surface still carrying it |
| 2.5 | `PROJECT.md:114` and `architecture/website.md:3-5` — "19 route files → 136 prerendered pages" | **24** `page.tsx` files under `app/`. `docs/superpowers/plans/2026-08-06-build-workspace.md:465` expected 139 pages on 2026-08-06, so the figure was already stale in PROJECT.md when written |
| 2.6 | `PROJECT.md:100` — "npm test 3211 tests, 69 files" | **93** test files. Commit `62fee59` (2026-08-11) reports 3631 tests |
| 2.7 | `PROJECT.md:277-278` — "`SPEC_SEQUENCE` is four again — stop 00 is `/what-a-blueprint-is`" | `components/spec/sequence.ts` runs **seven** stops, 00–06. Its own header opens "The seven Learn routes" and then says "`SPEC_SEQUENCE` is back to four" twenty lines later (`:26-27`) — the file contradicts itself in its own comments |
| 2.8 | `architecture/engine.md:58-59` — "`isDarkFactory` — `totalNodes > 0 && autonomousNodes === totalNodes`. A literal **zero-human-node** test, not a threshold" | `lib/core/analysis/autonomy.ts:317` — `autonomousNodes === totalNodes && bp.phaseCoverage.missing.length === 0`. Phase coverage is now part of the test, per `docs/superpowers/specs/2026-08-04-ia-redesign.md:432-439`. See D-28 |
| 2.9 | `architecture/website.md:10-46` route tables list `/install`, `/towards-a-dark-factory/which-tasks`, `/towards-a-dark-factory/the-climb` | All three are deleted; `next.config.ts` 308s each of them. The tables omit `/mcp`, `/skill`, `/settings`, and `app/u/[username]/{blueprints,cards,saved,terms,[slug]}` — five of the site's routes have no row at all |
| 2.10 | `architecture/website.md:50-56` lists eight redirects | `next.config.ts` defines **fourteen**, and states `/which-tasks → /towards-a-dark-factory` where the document says `→ /towards-a-dark-factory/which-tasks`, a destination that no longer exists |
| 2.11 | `architecture/website.md:87-89` — "the landing: five beats, ~370 visible words" | Six beats since commit `c97dbcb`; `components/home/SectionSameRun.tsx` is beat 2 |
| 2.12 | `PROJECT.md:214` and `architecture/website.md:183-185` name `components/home/roles-labels.test.ts` | The file is `components/home/roles.test.ts` |
| 2.13 | `docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:18` — "`components/home/beats.test.ts` forbids `<table>`, `<pre>`, and YAML-shaped `key:` runs on every beat" | No such assertion exists in `beats.test.ts` or anywhere in the suite — its own spec found this and said so at `2026-08-10-landing-reproducibility-beat-design.md:222-224`, and the plan shipped with the false claim intact. `components/home/SectionSameRun.tsx:807` now renders a `<table>` on the landing |
| 2.14 | `docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:19` and `.../specs/2026-08-10-landing-reproducibility-beat-design.md:217` — "No `opacity-0` may appear in the prerendered HTML of any beat", attributed to `beats.test.ts` | `beats.test.ts` contains no `opacity-0` assertion. The only tests holding that invariant are `components/hero/Wordmark.test.ts:81,131`, `components/hero/GridSpotlight.test.ts:34` and `components/build/WorkspaceStage.test.ts:32` — none of them covers a landing beat |
| 2.15 | `docs/superpowers/specs/2026-08-06-build-restructure-design.md:212-215` — six stale comments in `components/upload/UploadFlow.tsx`, `components/install/InstallTabs.tsx` and `components/panes/SkeletonPane.tsx` "must be updated in the same commit" | `components/install/` does not exist; `InstallTabs.tsx` lives under `components/mcp/`. The instruction to fix stale references is itself stale |
| 2.16 | `docs/superpowers/specs/2026-07-29-visual-polish-design.md:27` — "`PROJECT.md:36` — 'no autonomy ordinal on any user-facing surface'" | That sentence is at `PROJECT.md:58`. Every `<file>:<line>` citation in the corpus is unpinned; this one has drifted 22 lines, and `docs/superpowers/plans/2026-07-29-visual-polish.md:21-23` repeats it |
| 2.17 | `PROJECT.md:131-132` — "No accounts, no publishing, no push, no votes, no telemetry, no MCP server" | Literally true — nothing authenticates — but five account *surfaces* now exist as seeded presentation: `app/settings/page.tsx` and `app/u/[username]/{blueprints,cards,saved,terms}` plus `app/u/[username]/[slug]`, with `lib/data/account.ts`, `components/profile/` and `components/settings/`. `README.md:47` has the same gap. The sentence an agent reads to decide whether account UI exists says it does not |
| 2.18 | `skills/darkprint/references/writing-cards.md:143` — "the starter encodes its debugger's iteration cap as `1.<cap>.0`" | True of `lib/starter/cards.ts:544` (`debuggerVersion(maxIterations)`, the `/build` generator) and false of `content/blueprints/starter-software-factory/blueprint.dot:9`, which pins `targeted-debugger@1.0.0` at `max_iterations: 3`. Two artefacts are called "the starter"; the instruction does not say which |
| 2.19 | `files/darkprint-design.md:340,357` — Vercel preview deploys, GitHub Actions on Scaleway runners, "Supabase copre auth, database e storage" | No CI configuration in the repository, no Supabase dependency in `package.json`. `@vercel/analytics` is the only piece of that architecture present |
| 2.20 | `docs/superpowers/specs/2026-07-31-content-reorg-design.md:108-109` — the skill lives at `.claude/skills/content-reorg/`, "versioned with the rules it encodes, so that when the ledger grows the skill that must respect it is in the same commit" | Deleted 2026-08-11 (commit `3ceff81`), for the reason `AGENTS.md:9-13` gives. The spec's central architectural argument now describes something the repository has decided against |

**Claims that were checked and hold**, so a later pass does not re-check them: 30 modules
under `lib/core` (`architecture/engine.md:3`, `PROJECT.md:111`); 49 ontology terms
(`skills/darkprint/references/ontology.md:10`, `PROJECT.md:113`); 53 distinct card ids
(`sol_feedback.md:497`); `similarityThreshold: 0.35` (`architecture/engine.md:100-102`,
`lib/core/config.ts:155`); upload steps 1–3 real and step 4 a mock that says so
(`README.md:91-94`, `components/upload/UploadFlow.tsx:56-60,1185`); `AutonomyMeter` prints
no ordinal and the gallery filters but never sorts by autonomy (`PROJECT.md:57-58`,
`components/gallery/GalleryBrowser.tsx:162`).

---

## 3 · Naming divergence

The same concept under different names across instruction files, product copy and code.
This is where a backend will get built against the wrong noun.

### 3.1 The reusable unit

| Surface | Name |
|---|---|
| Route | `/nodes`, `/nodes/[...id]` |
| Header label | **Cards** (`components/site/SiteHeader.tsx:53`) |
| Content directory | `content/cards/` |
| Type | `NodeCard` (`lib/core/card/schema.ts`) |
| Architecture doc | `architecture/node-card.md`, "node card" |
| Skill reference | `card-schema.md`, "the card" |
| `PROJECT.md:27` | "**Nodes** are the parts a blueprint is built from, each a versioned card" |
| Retired names | `/parts` (308 → `/nodes`), "sub-graph" (`README.md:162-165`), "part" (`components/learn/PartFigures.tsx`, still) |
| Reviewer's ruling | `sol_feedback.md:145-147` — "a node is a position in a graph; a card is the reusable file pinned at that position" |

Five names for one thing, and the distinction `sol_feedback.md:145-147` draws is the one an
API has to encode. The route says `nodes`, the chrome says `Cards`, the filesystem says
`cards`, and one live component is still called `PartFigures`.

### 3.2 The graph and its container

| Name | Where | Means |
|---|---|---|
| **blueprint** | `/blueprints`, `content/blueprints/`, `Blueprint` type | Sometimes the graph, sometimes the whole folder |
| **bundle** | `lib/core/bundle/`, `resolveBundle`, `loadBundle`, `blueprint.yaml` manifest | The folder |
| **blueprint.dot** | the file in a bundle | The authored topology |
| **factory.dot** | the exported file | The compiled, Attractor-runnable graph |
| **dark factory** | the computed badge | A property of a resolved blueprint |
| **pattern** | `docs/superpowers/specs/2026-08-04-ia-redesign.md:17-19`, `PROJECT.md:21` | The product-facing word for a blueprint |
| **factory** | `app/build/page.tsx`, `lib/starter/`, `files/darkprint-onboarding-positioning.md:177,225` | What `/build` produces |

`sol_feedback.md:418` rules "Use bundle only when the folder contents matter; otherwise say
blueprint" — a rule the code does not follow and could not, since `Bundle` is a type. Two
files inside one folder are called `blueprint.dot` and `factory.dot` and are the same graph
at two compilation stages; `skills/darkprint/references/dot-and-attractor.md:5` exists
largely to stop an agent confusing them.

### 3.3 The vocabulary

| Surface | Name | Since |
|---|---|---|
| Route | `/ontology` (browser), `/spec/ontology` (format) | |
| Header | **Ontology** and **Ontology file (YAML)** | 2026-08-12, owner instruction |
| Header, before | **Vocabulary** and **Ontology** | until 2026-08-12 |
| Component | `components/ontology/VocabularyBrowser.tsx`, `VocabularyRow`, `VocabularyShapes.tsx`, `components/build/VocabularyPane.tsx`, `components/learn/PartFigures.tsx:1033` `VocabularyFigure` | unchanged |
| `/build` tab | **Ontology** (`components/build/WorkspaceStage.test.ts:40`), while the surface id is `"vocabulary"` (`components/build/surfaces.ts:52`) | |
| Retired route | `/ontologies` (308 → `/ontology`) — "a gallery of vocabularies became one curated core ontology" (`README.md:162-165`) | |
| Card field | `ontology_version` | |
| Docs | `architecture/ontology.md` says "vocabulary" throughout; `sol_feedback.md` uses both | |

The owner's instruction was "be consistent through all the website". The chrome complies;
nine identifiers and one internal surface id do not, and a reader of `architecture/ontology.md`
or `sol_feedback.md` learns the retired word.

### 3.4 The risk reading

| Name | Where |
|---|---|
| **Security** | `README.md:45,62-64,103`; `PROJECT.md:247`; `architecture/engine.md:70-71,84-85`; `architecture/ontology.md:59`; `skills/darkprint/references/ontology.md:72`; `lib/types.ts` field `security`; `AutonomyResult`/`SecurityResult` |
| **Static risk exposure** | `lib/content/view.ts:202`, `components/ui/ScoreRadar.tsx:45`, `components/spec/ScoringModel.tsx:264`, `components/blueprint/Explainability.tsx` ×5, `components/blueprint/BundlePanel.tsx:214`, `components/blueprint/EvidenceLayers.tsx:45`, `components/upload/{UploadFlow,ValidationReport}.tsx`, `components/build/WorkspaceStage.tsx:358,386` |
| **Declared risk** | offered as an alternative at `sol_feedback.md:309-310` |
| **risk marker** | the ontology kind the score is computed from |

The field is `security`, the label is `Static risk exposure`, and every document except
`IMPLEMENTATION_PLAN.md` says `Security`. An agent adding a surface from the documents
writes the wrong word; an agent adding an API field from the label writes the wrong key.
See D-54.

### 3.5 The autonomy readings

`autonomyClass` (the name a reader sees), `level` (the 1–4 ordinal kept for sorting and
never printed), `band` (`architecture/engine.md:55`), *ordinal* (the forbidden rendering),
the **1–5 organisational maturity ladder** (`PROJECT.md:63-68`, `components/home/SectionLevels.tsx`),
and *autonomy fraction* (`skills/darkprint/references/ontology.md:48`). `PROJECT.md:63-64`
warns that two of these "must never be confused" and both are small integers.

### 3.6 Community support

| Name | Where |
|---|---|
| `votes` | `lib/data/community.ts:44`, `lib/types.ts`, `README.md:46` |
| **Stars** | `IMPLEMENTATION_PLAN.md:54`, `lib/data/node-community.ts` `starsFor()` |
| **support** | `components/bundle/BundleHeader.tsx` prop `support`, `components/ui/community-support.test.ts` |
| **Favorite** | `components/ui/FavoriteStar.tsx`, commit `6e9d0ac` |
| **Saved** | `components/profile/tabs.ts:44`, `app/u/[username]/saved/` |
| **Pinned** | `components/profile/Pinned.tsx` |

Six names across two mechanisms — a seeded count and a `localStorage` key — that a backend
would have to tell apart. `IMPLEMENTATION_PLAN.md:86-87` lists "whether historical `votes`
become stars or remain a separate signal" as an explicitly open decision, which is exactly
this collision written down and left unresolved.

### 3.7 The publish path

`/upload` is the route; `Publish` is the header button (`components/site/SiteHeader.tsx:74`);
`Validate and publish` is the page title (`app/upload/page.tsx:35`); `Upload blueprint` is
what `components/site/honesty.test.ts` calls it; `[Validate]` is what
`docs/superpowers/specs/2026-08-04-ia-redesign.md:112-114` says it must stay; `Share a
blueprint` is the name it was renamed off; `[Share yours]` is the name that was proposed
and refused. Seven names for one control.

### 3.8 The creation path

`/build` (route) · `Customize the starter` (title and nav, `components/spec/sequence.ts:372-374`)
· `Design a blueprint` (its title in `architecture/website.md:44` and `sol_feedback.md:212`)
· `Build one` (`docs/superpowers/specs/2026-08-04-ia-redesign.md:73-75`) · `Compose` (the
name `2026-08-04-ia-redesign.md:105-107` forbids) · `Create` (the header row it used to
carry) · `Assisted Design` (`/skill`'s label today) · *the authoring page* / *the workspace*
/ *the sandbox* / *the starter configurator* / *the teaching sandbox*
(`sol_feedback.md:573-577`). Two routes, eleven names, and `sol_feedback.md:573-577` says
the page "contains three different products" — which is now literally true of the pair.

### 3.9 `AGENTS.md`, three files

1. `AGENTS.md` at the repository root — instructions to a coding agent working on this repo,
   imported by `CLAUDE.md`.
2. The `AGENTS.md` written into every downloadable bundle
   (`lib/content/bundle-export.ts:68,430`) — instructions to an agent adapting a blueprint.
3. The `AGENTS.md` the authoring skill writes (`skills/darkprint/SKILL.md:22`,
   `skills/darkprint/references/writing-cards.md:128`) — the same as (2), produced elsewhere.

`docs/superpowers/plans/2026-08-06-build-workspace.md:358-359` and
`docs/superpowers/specs/2026-08-04-ia-redesign.md:335-337` both refer to it by the bare
name. An agent asked to "update AGENTS.md" has a one-in-three chance.

### 3.10 `spec` and `skill`, overloaded

- **`spec`**: the card field compiled into Attractor's `prompt`
  (`architecture/node-card.md:83`); the `/spec/*` Learn routes; `SPEC_SEQUENCE`,
  `SpecPage`, `SpecLayerPage`, `SpecSection` — which now cover seven routes, three of which
  are not under `/spec`; "specification" as the product noun
  (`sol_feedback.md:853`); and `docs/superpowers/specs/` the design-document folder.
- **`skill`**: the card field DarkPrint stores and never reads
  (`architecture/node-card.md:98`); the DarkPrint authoring skill at `skills/darkprint/`;
  the `/skill` route labelled "Assisted Design"; and a Claude Skill in the CLI sense
  (`AGENTS.md:9-13`). `sol_feedback.md:417` explicitly asks that the first two be
  distinguished; the route name does not.

### 3.11 Phase, role, step, beat

`phase` is a closed five-term ontology dimension (planning, implementation, testing,
debugging, deployment). `role` is the job a node does — planner, builder, tester, debugger,
deployer — five words that are "nearly the same", which `architecture/ontology.md:35-38`
flags as a collision hazard. `step` is a Learn stop number and was also the `/build` wizard's
counter. `beat` is a landing section. `stop` is a Learn entry. Four of the five have five
members.

### 3.12 Provenance labels

`seeded` (`◐`, the marker in glyph and word), `counted` (`✓`, `lib/data/account.ts:24-26`),
`computed` / `community-rated` / `self-reported` / `verified run` / `insufficient sample`
(proposed at `sol_feedback.md:118-120`), `computed` / `reported` / `voted` / `absent`
(`sol_feedback.md:100`), `fixture` (`IMPLEMENTATION_PLAN.md` throughout), `mock`
(`README.md:94`, `sol_feedback.md:516-518`), `illustrative` (removed 2026-08-11, D-16), and
`not built` (`ComingSoonBadge`). The code ships `seeded`, `counted`, `computed` and `not
built`; the documents propose four more vocabularies for the same axis.

### 3.13 Smaller ones worth listing

- **`risk_markers` (wire) vs `riskMarkers` (model)** — `skills/darkprint/references/card-schema.md:10`;
  a typo in either is an `info` and is silently ignored (`preflight.md:58`).
- **`type`** — a DOT attribute reserved by Attractor meaning *handler override*, and a
  DarkPrint ontology term inside the YAML card. `dot-and-attractor.md:65` exists because of it.
- **`tools` vs `mcp`** — capabilities versus concrete installed servers, "deliberately not
  merged" (`architecture/node-card.md:97`), and both read as "what it can reach".
- **`DEFAULT_ANALYSIS_CONFIG` vs `DARKPRINT_CONFIG`** — see 2.3.
- **author / owner / user / builder / reader / visitor** — `docs/` uses "the author" for the
  repository owner while `content/` uses `author` for a blueprint's publisher, and
  `lib/data/users.ts` types the second one `Author`. `skills/darkprint/SKILL.md` uses "the
  author" for a third person: whoever the skill is interviewing.

---

## 4 · Silent drift

### 4.1 Written as future work, or as a proposal, and implemented anyway

Each row names the originating decision and whether it is `OWNER-STATED`.

| What shipped | Originating decision | Provenance | Where it is in code |
|---|---|---|---|
| `isDarkFactory` now also requires full phase coverage, which cost two blueprints their badge | D-28, `2026-08-04-ia-redesign.md:432-439` ("Approved 2026-08-04") | **not OWNER-STATED** — UNATTRIBUTED, see Q1 | `lib/core/analysis/autonomy.ts:317` |
| Every downloaded bundle carries a generated `AGENTS.md` | D-52, `2026-08-04-ia-redesign.md:335-337` ("Approved, 2026-08-04") | **not OWNER-STATED** — UNATTRIBUTED, see Q1 | `lib/content/bundle-export.ts:68,430` |
| The public label of one of the two computed scores was renamed to "Static risk exposure" on fourteen surfaces | D-54, `IMPLEMENTATION_PLAN.md:46-47` from `sol_feedback.md:308-310` | **not OWNER-STATED** — AGENT-PROPOSED | `lib/content/view.ts:202` and thirteen components |
| A star control and seeded count beside every blueprint and card title | D-55, `IMPLEMENTATION_PLAN.md:36-37` | **not OWNER-STATED** — AGENT-PROPOSED | `components/ui/FavoriteStar.tsx`, `components/ui/community-support.test.ts` |
| Evidence split into three provenance layers on every blueprint page | D-56, `IMPLEMENTATION_PLAN.md:26-28` | **not OWNER-STATED** — AGENT-PROPOSED | `components/blueprint/EvidenceLayers.tsx` |
| The site's OpenGraph description, in wording `sol_feedback.md:182-185` disclaimed as "Possible direction, not final copy" | D-10 | **not OWNER-STATED** — AGENT-PROPOSED | `app/layout.tsx:52-54` |
| `/build` rebuilt from an eight-step path into a single workspace; ~60KB of tested code deleted | D-49, `2026-08-06-build-restructure-design.md` | **not OWNER-STATED** — AGENT-PROPOSED (the owner quotation behind it, at `:16-20,30-32`, is about the MCP registry and the build objective, not about the wizard) | `components/build/BuildWorkspace.tsx`, `WorkspaceStage.tsx` |
| `/build` renamed to "Customize the starter" — the *lower-cost alternative* the review offered, not its preferred option | D-51, `sol_feedback.md:232-233` | **not OWNER-STATED** — AGENT-PROPOSED | `components/spec/sequence.ts:368-378` |
| Learn ordered 00–06 as one reading path | D-37, `IMPLEMENTATION_PLAN.md:31-32,51-52` | **not OWNER-STATED** — AGENT-PROPOSED | `components/spec/sequence.ts` |
| MCP as a top-level navigation destination | D-85, `IMPLEMENTATION_PLAN.md:48-49` | **not OWNER-STATED** — AGENT-PROPOSED (the owner quotation at `2026-08-06-build-restructure-design.md:16-20` establishes the *plan to build MCP*, not its place in the chrome) | `components/site/SiteHeader.tsx:64` |
| Account surfaces: `/settings` with seven sections, five profile tabs, an owner's view of a bundle, a brand mark | D-45, commit `b22ee53` | **not OWNER-STATED** — UNATTRIBUTED | `app/settings/`, `app/u/[username]/*`, `components/{profile,settings,bundle}/` |
| The header's action button reads `Publish`, reversing a rule `SiteHeader.tsx` itself used to carry | D-43, commit `c97dbcb` (unmentioned in its message) | drifted in unattributed; **endorsed after the fact by the owner on 2026-08-12** (D-88) | `components/site/SiteHeader.tsx:74` |

### 4.2 Presented as done, or as existing, and does not exist

| Claim | Reality |
|---|---|
| `docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:18-19` presents two `beats.test.ts` assertions as live guards | Neither exists — see 2.13, 2.14. The plan's own spec found the first and the plan shipped anyway |
| `architecture/website.md:46` documents `/install` as a route with a described layout | Deleted 2026-08-07; 308s to `/skill` |
| `architecture/website.md:38-40` documents `/towards-a-dark-factory/which-tasks` and `/the-climb` | Both deleted 2026-08-11 |
| `docs/superpowers/specs/2026-08-06-build-restructure-design.md:212-215` instructs an agent to update comments in `components/install/InstallTabs.tsx` | `components/install/` does not exist |
| `PROJECT.md:214`, `architecture/website.md:183` present `roles-labels.test.ts` as a file | It is `components/home/roles.test.ts` |
| `README.md:169-170` cites `darkprint-io-note.md` as the product description | No such file |
| `README.md:45` presents 8 bundles / 52 cards / 54 terms as the archive | 9 / 57 / 49 |
| `files/darkprint-design.md:357` presents Supabase as the decided backend | No Supabase anywhere |
| `IMPLEMENTATION_PLAN.md:53` presents `/spec/ontology` as the canonical ontology index | `/ontology` is; the reversal is owner-instructed and tested |
| `docs/superpowers/plans/2026-08-06-build-workspace.md:17` presents a canonical spacing scale with four banned tiers | No test, lint rule or theme restriction enforces it (D-76) |
| `PROJECT.md:277-278` presents `SPEC_SEQUENCE` as four stops | Seven |

### 4.3 The one drift the code documents against itself

On 2026-08-11 the owner instructed that the line "illustrative: DarkPrint does not run your
graph" come off the homepage, having first been shown the two tests that pinned it (commit
`62fee59`). It was removed from `components/home/SectionSameRun.tsx`, from
`components/home/beats.test.ts`, and from the honesty ledger in
`components/site/honesty.test.ts`, which now carries this in place of the row:

> This is NOT the reason an entry is normally allowed to leave… Beat 2 still draws four
> runs, four scores and three deltas in fixed tabular columns, which is the shape of a
> readout off a real harness, and DarkPrint still runs nobody's graph… The claim is intact
> and the qualifier is gone, which is the one combination this file was written to prevent.

This is the clearest `OWNER-STATED` decision in the corpus (D-16) and it removes a guard
that the site's most load-bearing rule (D-12, `UNATTRIBUTED`) would have kept. It is listed
here not as a defect but because it is the one place where the owner's recorded instruction
and the repository's stated principles are known to disagree — and because it is evidence
that D-12 should not be assumed to be the owner's rule until the owner says so.

---

### 4.4 Tooling that shaped the work, and that the owner was pushing back against

Answering Q7–Q9 and Q13 on 2026-08-12, the owner said of three script families that they
"were forcing the harness not running exactly what I had in mind. I needed to insist", and
of the local `skillOverrides` block that "some skills where forcing me to stay on a path of
developement that I was not sure". Four mechanisms in the repository have that effect, and
none of them is `OWNER-STATED`:

| Mechanism | How it constrains the work |
|---|---|
| `scripts/generate-skill-refs.test.ts` | Fails the whole suite if `skills/darkprint/references/{ontology,card-schema}.md` disagree with `lib/core/ontology/core.ts` or `lib/core/card/schema.ts`. So **every engine change is gated on regenerating two skill documents the owner has not read** (Q5). D-64 |
| `scripts/generate-bundles.ts` (`prebuild`) | Rewrites 101 tracked files under `public/bundles/**` on every build, which is why `PROJECT.md:103-107` has to instruct `rm -rf .next public/bundles && npm run build` before committing. Every build produces a diff the agent then has to reason about |
| `scripts/measure-prose.ts` (+ `measure-prose.test.ts`) | The instrument behind D-71, whose *ranking* metric — site-wide words, per page × instances — is the agent's answer to the owner's complaint, not the owner's. It is what made `/nodes/[...id]` "the biggest single lever on the site" and drove several content passes |
| The superpowers plan format | `REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development…` opens all four plans in `docs/superpowers/plans/`, directing whichever agent reads one into a fixed execution mode before it has read the task |

The vendored `impeccable` and `content-reorg` skills (deleted 2026-08-11, commits `be76e32`,
`3ceff81`, `5b92067`) and the `skillOverrides` block are the same story from the other end,
and are the one part of it the owner has already acted on. See D-87.

---

## Appendix · The questions, and the owner's answers of 2026-08-12

| # | Question | Answer | What it changed |
|---|---|---|---|
| Q1 | Does a bare "Approved" in the IA proposal mean you approved it? | **Yes** — "since I used the plugin superpowers but I used at the very beginning of the project. It could have been diverged a little wrt the current state of the project" | D-28, D-32, D-35, D-52 → `OWNER-STATED`/`CONFIRMED`. The caveat is now part of the provenance rule in `docs/DECISIONS.md`: an approval marker establishes that a decision was made, never that it still holds |
| Q2 | Did you write the three `files/` documents? | **No** | Falsifies `CONTEXT_SURFACE.md`'s Italian-language inference |
| Q3 | Are they nonetheless decisions you adopted? | **"not really"** | 20 rows → `AGENT-PROPOSED`, including D-12. 649 code comments across 138 files cite these documents by section |
| Q4 | Did you deliberately create and ship `skills/darkprint/`? | **Yes** — "But I just left there as a test. I need to make it concrete useful" | New row D-86, `OWNER-STATED`. Verdict for `skills/**` moves from `ASK` to `OUT-OF-SCOPE` (product) |
| Q5 | Have you reviewed the skill's contents? | **No** | D-60, D-61, D-62, D-64 → `AGENT-PROPOSED` and unread |
| Q6 | Should the three non-generated skill references be drift-tested? | **"I don't know"** | Still open. It is an engineering choice, not a provenance question; noted, not resolved |
| Q7 | Is `scripts/generate-bundles.ts` meant to stay? | **"maybe not"** | See §4.4 |
| Q8 | Are the `generate-skill-refs` scripts meant to stay? | **"maybe not"** | See §4.4 |
| Q9 | Is `scripts/measure-prose.ts` still wanted? | **"maybe not"** | See §4.4 |
| Q10 | Did you write `scripts/generate-wordmark-paths.ts`? | **Yes** | Verdict → `OUT-OF-SCOPE`, owner-authored source |
| Q11 | Is `shot5.mjs` a leftover? | **"I don't know what it is. If irrelevant, it can go"** | It imports `puppeteer-core`, which is in neither `package.json` nor `node_modules`, and hardcodes a scratchpad path from a different session. It cannot run. Verdict → `DELETE` |
| Q12 | Did you add the `shadcn` MCP server in `.mcp.json` on purpose? | **No** — "as the mcp server needed always to be designed by me" | Verdict → `DELETE`. There is no `components.json` and no `shadcn` import anywhere in `app/`, `components/` or `lib/`, so the `shadcn` devDependency in `package.json` has no consumer either. **Note the collision: the `shadcn` MCP server is a component-registry dev tool and has nothing to do with the DarkPrint MCP registry of D-05** — if the answer was about the latter, D-05 needs re-reading, not `.mcp.json` |
| Q13 | Did you set the `skillOverrides` block? | **Yes** — "I felt that some skills where forcing me to stay on a path of developement that I was not sure" | New row D-87, `OWNER-STATED`. See §4.4 |

### Answered 2026-08-12, second round

| # | Question | Answer | What it changed |
|---|---|---|---|
| Q14 | Did a person other than you write the three `files/` documents? | **No — an agent wrote them** | Removes the last hedge. Doc 1, doc 2 and doc 3 are agent-written, owner-unadopted, and cited 649 times as "the specifications". No reason survives to read them before re-pointing those citations |
| Q15 | The header you approved as "two nouns and one Learn menu" is now five targets plus an account menu, and `Publish` reverses a rule the same document quoted. Which is current? | **"keep the current"** | New row D-88, `OWNER-STATED`. D-35 and D-43 stay `CONTRADICTED` and are marked superseded. Conflict 1.3 resolved |

### Closed 2026-08-12 · `/towards-a-dark-factory`

`docs/superpowers/specs/2026-08-04-ia-redesign.md:418-419` says **"Nothing in
`/towards-a-dark-factory` is deleted — it is demoted, which is what the author asked for"**.
The route then lost both children in two different ways:

- **`/which-tasks` was merged** on 2026-08-07 — folded into the parent whole (the glance
  figure, the eight worked tasks, the four questions, what to do with a no), with a 308 left
  behind. A demotion, matching the approved document.
- **`/the-climb` was deleted** at commit `61a508c` — not merged. Gone with it: four sections
  narrating an autonomous pipeline, `RoutePager`, `components/howto/route.ts`, `CLIMB_ROUTE`,
  `PhaseStrip` and `IsolationWall`. One honesty-ledger row went out with it and was not
  relocated.

Two files record that deletion as the owner's and neither quotes him:
`app/towards-a-dark-factory/page.tsx:12` — *"It was 'stop 1 of 2' until the author deleted
stop 2"* — and `next.config.ts` — *"this landed on `/towards-a-dark-factory/the-climb` until
the author deleted that page"*.

| Q16 | Did you ask for `/towards-a-dark-factory/the-climb` to be deleted? |
|---|---|
| **Answer, 2026-08-12** | *"I'm not interested in the children. it is fine the current page"* |

**This closes the question by direction, not by fact, and the distinction is kept.** D-89
records that the route as it stands is the owner's current shape, `OWNER-STATED` and
`CONFIRMED`. Whether an agent deleted that page and attributed it to him remains unknown,
and no later phase should read D-89 as evidence that it did not. It is the one loose thread
this audit found and did not pull, at the owner's direction.
