# CLAIMS_RAW — verbatim claims extracted from the context surface

Phase 0A raw material for the darkprint context-reset audit. This file quotes; it does not
judge.

> **Currency note, added 2026-08-30. The rows below are unchanged and will stay unchanged.**
>
> Seven of them quote rules the code no longer follows, and a reader who acts on them will be
> acting on a retired rule: **FON-007, SKM-019, SKM-025, SKO-010, SKP-004, SKC-013, ARO-007**
> all rest on the `requires_human` cross-field rule, which D-92 withdrew when a card's `type`
> became the whole answer, or on the ontology version being stamped on a card, which D-93
> withdrew with the vocabulary-version registry.
>
> They are named here rather than corrected in place because this file's contract is to quote
> verbatim: editing a row would destroy the evidence of what the document said when it was read,
> which is the only thing the file is for. `docs/ARCHITECTURE.md` §11 carries the same list
> against the code. Every row is a verbatim, one-sentence quotation from a document in this repository's
instruction surface (see `docs/audit/CONTEXT_SURFACE.md` for the full file inventory), trimmed
to one sentence but otherwise unedited — grammar, typos, and phrasing are preserved exactly as
written. Statements are included whether or not they already look implemented, obvious, or
correct: filtering for plausibility was explicitly out of scope for this pass. Where a document
quotes the repository owner directly, or explicitly marks a statement as confirmed with the
owner, the Normative/Factual column says so (e.g. "Factual (owner-quoted)",
"Normative (owner-confirmed)") and the quoting construction is preserved in the quote itself.

Per the task's scope rules, product copy under `content/` and the generated files under
`public/` were **not** claim-mined here — see the scope note at the top of
`docs/audit/CONTEXT_SURFACE.md` for why. Source code under `app/`, `components/`, `lib/`, and
`scripts/` was checked for TODO/FIXME/NOTE: comments stating intent; none were found (see the
closing note in `CONTEXT_SURFACE.md`), so no rows exist for that category — this is a finding,
not an omission.

**1,470 rows.** IDs are prefixed by source-document code and are otherwise sequential within
that document; there is no significance to the ordering across documents. Nothing here has
been deduplicated across documents — the same underlying fact or rule is often quoted more
than once, from more than one document, deliberately: which documents repeat a claim, and
which restate it differently, is itself evidence for the phase that judges this material.

| ID | Verbatim quote, trimmed to one sentence | Source path and line | Surrounding context, one line | Normative or factual |
|---|---|---|---|---|
| AGT-001 | "This version has breaking changes — APIs, conventions, and file structure may all differ from your training data." | AGENTS.md:4 | Next.js warning block | Factual |
| AGT-002 | "Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." | AGENTS.md:4 | Next.js warning block | Normative |
| AGT-003 | "Heed deprecation notices." | AGENTS.md:4 | Next.js warning block | Normative |
| AGT-004 | "This repository ships one skill of its own, `skills/darkprint/`, and the documented way to get it is `npx skills@latest add Brotherhood94/darkprint`." | AGENTS.md:9-10 | opens the vendoring section | Factual |
| AGT-005 | "That command does a shallow git clone and then searches the clone for skills, and `.claude/skills/` is one of the directories it searches." | AGENTS.md:10-11 | vendoring section | Factual |
| AGT-006 | "So a skill vendored there is handed to strangers as though it were ours, and nothing in `npx tsc --noEmit`, `npm run lint` or the test suite notices." | AGENTS.md:12-13 | vendoring section | Factual |
| AGT-007 | "Two were, for a while. `impeccable` and `content-reorg` sat in `.claude/skills/` and were suppressed by a `skills-lock.json` at the repository root, which worked because the CLI hides any skill under an agent project directory whose name is a key in that file." | AGENTS.md:15-17 | vendoring section, history | Factual |
| AGT-008 | "Both skills were deleted on 2026-08-11, and the lock file went with them once it had been shown to do nothing." | AGENTS.md:17-19 | vendoring section, history | Factual |
| AGT-009 | "Measured each time by running `npx skills@latest add <tree> -l` from an empty directory, with the lock file and without it" | AGENTS.md:19-20 | vendoring section, method | Factual |
| AGT-010 | "`impeccable` + `content-reorg` \| `Found 1 skill` → `darkprint` \| `Found 3 skills`" | AGENTS.md:24 | vendoring measurement table, row 1 | Factual |
| AGT-011 | "`content-reorg` only \| `Found 1 skill` → `darkprint` \| `Found 2 skills`" | AGENTS.md:25 | vendoring measurement table, row 2 | Factual |
| AGT-012 | "empty, as now \| `Found 1 skill` → `darkprint` \| `Found 1 skill`" | AGENTS.md:26 | vendoring measurement table, row 3 | Factual |
| AGT-013 | "The third row is what made it safe to remove: with nothing vendored, the file changed nothing in either direction." | AGENTS.md:28-29 | vendoring section, conclusion | Factual |
| AGT-014 | "It could not restore what had been deleted either — `npx skills@latest experimental_install` read its two remaining keys, reported `Restoring 2 skills`, then stopped on `Local path does not exist`, both entries being `sourceType: local` against paths that no longer existed." | AGENTS.md:29-32 | vendoring section, further evidence | Factual |
| AGT-015 | "**So there is nothing to maintain today, and one thing to remember.**" | AGENTS.md:34 | closing paragraph | Normative |
| AGT-016 | "Put a third-party skill under `.claude/` and the first two rows come back: it needs a key in a `skills-lock.json` at the repository root, and `eslint.config.mjs` wants its `.claude/skills/**` ignore back so our lint stops reporting warnings on somebody else's source." | AGENTS.md:34-37 | closing paragraph, conditional instruction | Normative |
| AGT-017 | "Re-run the table above afterwards rather than trusting it, since it describes a CLI this repository does not pin." | AGENTS.md:38-39 | closing paragraph | Normative |
| CLD-001 | "@AGENTS.md" | CLAUDE.md:1 | entire file content, an import directive | Factual |
| RDM-001 | "**A registry of blueprints: reusable patterns for getting work done by agents.**" | README.md:3 | tagline | Factual |
| RDM-002 | "*Autonomy you can read as a graph.*" | README.md:4 | tagline, second line | Factual |
| RDM-003 | "DarkPrint is a concept build for `darkprint.io` — a place where builders share the **blueprints** they use to put agents to work." | README.md:6-7 | opening paragraph | Factual |
| RDM-004 | "This repository is a fully static front-end plus the engine behind it: a real archive of blueprint bundles under `content/`, parsed, resolved and scored at build time by `lib/core`." | README.md:7-9 | opening paragraph | Factual |
| RDM-005 | "There is no backend — no auth, no uploads, no voting, no telemetry — and the site says so on every surface where it matters." | README.md:9-10 | opening paragraph | Factual |
| RDM-006 | "A **pattern for achieving a goal**, written down as a directed graph of automations." | README.md:14 | "What's a blueprint?" definition | Factual |
| RDM-007 | "Each node is a versioned card saying what runs there, which model it uses, what it may reach, and what must never reach it." | README.md:14-16 | continues definition | Factual |
| RDM-008 | "The graph says how they connect — and, just as importantly, how they must not." | README.md:16-17 | continues definition | Factual |
| RDM-009 | "**Compose** — hand it to Claude Code, Gemini or Codex, which adapts it into your codebase and can combine it with other blueprints." | README.md:22-23 | loop step 2 | Factual |
| RDM-010 | "*This happens on your machine. DarkPrint runs nothing and holds none of your keys.*" | README.md:23-24 | loop step 2, emphasized | Factual |
| RDM-011 | "One badge a blueprint can earn, not the point of the site." | README.md:29 | "What's a dark factory?" opening | Normative |
| RDM-012 | "A plant so automated it needs no lights — no operators, only machines running themselves." | README.md:29-30 | dark factory definition | Factual |
| RDM-013 | "Applied here: a blueprint whose five lifecycle phases (planning, implementation, testing, debugging, deployment) are all present and all unattended." | README.md:30-32 | dark factory definition | Factual |
| RDM-014 | "Most useful patterns are not dark factories." | README.md:32 | dark factory definition | Factual |
| RDM-015 | "**Decision autonomy** — no human-approval checkpoints; it makes judgement calls on its own." | README.md:34 | dark factory characteristic 1 | Factual |
| RDM-016 | "**Closed loop** — agents plan → execute → verify → ship, instead of following a fixed script." | README.md:35 | dark factory characteristic 2 | Factual |
| RDM-017 | "**Spec over code** — the engineer writes specs and acceptance criteria, not code line by line." | README.md:36 | dark factory characteristic 3 | Factual |
| RDM-018 | "This is the distinction the whole build is organised around, so it is worth stating up front rather than in a footnote" | README.md:40-41 | "What's real and what isn't" intro | Normative |
| RDM-019 | "**Real** \| The 8 blueprint bundles and 52 node-card documents under `content/`, parsed and validated by `lib/core`." | README.md:45 | Real/Seeded/Not-built table, Real row | Factual |
| RDM-020 | "The 54-term core ontology." | README.md:45 | same Real row | Factual |
| RDM-021 | "The **Autonomy** and **Security** scores, computed from each resolved graph at build time with their full rationale." | README.md:45 | same Real row | Factual |
| RDM-022 | "Every count on the homepage that comes off the archive." | README.md:45 | same Real row | Factual |
| RDM-023 | "The upload wizard's steps 1–3, which run the real validator in your browser." | README.md:45 | same Real row | Factual |
| RDM-024 | "**Seeded** \| Downloads, votes, comments, the author table, and the four non-computed metrics (Efficacy, Reliability, Transparency, Cost / time)." | README.md:46 | table, Seeded row | Factual |
| RDM-025 | "These live in `lib/data/community.ts` and `lib/data/users.ts` and are labelled as seeded wherever they render." | README.md:46 | table, Seeded row | Factual |
| RDM-026 | "**Not built** \| Execution, run telemetry, voting, reputation, publishing, and the ontology promotion workflow." | README.md:47 | table, Not-built row | Factual |
| RDM-027 | "All designed, none wired up; the UI says so in place rather than implying otherwise." | README.md:47 | table, Not-built row | Factual |
| RDM-028 | "Dependency-light, isomorphic TypeScript (no React, no Next runtime), so the same code runs at build time on the server and inside the upload wizard in the browser." | README.md:51-52 | "The engine" section | Factual |
| RDM-029 | "**DOT parser** — the topology of a blueprint, with node/edge attributes and locations." | README.md:54 | engine component list | Factual |
| RDM-030 | "**Card layer** — parses and validates node cards (YAML/JSON), versioned `id@version`, content-addressed with a `sha256:` digest that excludes provenance fields." | README.md:55-56 | engine component list | Factual |
| RDM-031 | "**Ontology** — one curated core vocabulary (node types, data types, tools, risk markers) with a `broader` subsumption hierarchy, deprecation pointers, and a resolver that supports namespaced local extensions." | README.md:57-59 | engine component list | Factual |
| RDM-032 | "**Bundle loader** — joins a DOT to the cards it pins, type-checks every edge against the data-type lattice, and reports `Diagnostic`s with severity, code, hint and location." | README.md:60-61 | engine component list | Factual |
| RDM-033 | "**Analysis** — Autonomy (§8.1: the share of nodes that run unattended, bucketed 1–4) and Security (§8.2: a clean 4 minus weighted risk-pattern penalties)." | README.md:62-64 | engine component list | Factual |
| RDM-034 | "Every tunable number lives in one frozen `DEFAULT_ANALYSIS_CONFIG`, which the marketing copy reads from rather than restating." | README.md:64-65 | engine component list | Factual |
| RDM-035 | "**Registry** — the index over every loaded bundle: cards by id and version, who uses what, term usage counts." | README.md:66-67 | engine component list | Factual |
| RDM-036 | "`lib/content` is the server-only bridge: it reads `content/` off the filesystem, runs the engine over it, and produces the view models the UI consumes." | README.md:69-70 | closes engine section | Factual |
| RDM-037 | "`lib/content/layout.ts` is the one client-safe piece (the graph layout), so the wizard can draw a schematic too." | README.md:70-71 | closes engine section | Factual |
| RDM-038 | "**The hero** — a scroll-driven wordmark that morphs `DarkPrint → DarkFactory` (over a procedural 3D factory that reveals in the dark), and flips up to `BluePrint` (a cyanotype background with an animated technical drawing)." | README.md:75-77 | Surfaces list | Factual |
| RDM-039 | "**Blueprints** (`/blueprints`) — browse blueprints with search, tag/category filters and sorting." | README.md:78 | Surfaces list | Factual |
| RDM-040 | "**Blueprint detail** (`/blueprints/[slug]`) — the interactive pipeline schematic (React Flow), the 6-metric scorecard, an **explainability** section that shows how both computed scores were reached (every node counted, every point subtracted, each finding clickable to highlight the node in the schematic), the bundle's digest and pinned cards, DOT source, requirements and community notes." | README.md:79-83 | Surfaces list | Factual |
| RDM-041 | "**Nodes** (`/nodes`, `/nodes/[...id]`) — the node-card library." | README.md:84 | Surfaces list | Factual |
| RDM-042 | "The reusable unit is a node, not a sub-graph: one card per page with its declared interface, behaviour, evaluation metadata, full version history with an inferred changelog, the blueprints that pin it, and the raw YAML." | README.md:84-87 | Surfaces list | Factual |
| RDM-043 | "**Ontology** (`/ontology`, `/ontology/[...term]`) — the vocabulary browser: node types and data types as indented trees, risk markers by weight, and a page per term with its ancestry, narrower terms, deprecation status and usage across the registry." | README.md:88-90 | Surfaces list | Factual |
| RDM-044 | "**Upload** (`/upload`) — a 4-step wizard." | README.md:91 | Surfaces list | Factual |
| RDM-045 | "Steps 1–3 are real: files are read with `File.text()` in the tab, assembled into a `Bundle`, and run through `loadBundle` in the browser, producing the actual diagnostics, schematic and computed scores." | README.md:91-94 | Surfaces list | Factual |
| RDM-046 | "Step 4 (publish) is a mock and says so." | README.md:94 | Surfaces list | Factual |
| RDM-047 | "**Profiles** (`/u/[username]`) — a builder's blueprints and node cards." | README.md:95 | Surfaces list | Factual |
| RDM-048 | "Every blueprint carries the same card, colour-coded by how each number is produced" | README.md:99 | "The 6-metric scorecard" intro | Factual |
| RDM-049 | "Autonomy (1–4), Security \| **Static analysis** of the graph (auto) \| Computed" | README.md:103 | scorecard table row 1 | Factual |
| RDM-050 | "Cost / time \| **Measured** on a real run \| Seeded — no runner" | README.md:104 | scorecard table row 2 | Factual |
| RDM-051 | "Efficacy, Reliability, Transparency \| **Community** vote \| Seeded — no ballot" | README.md:105 | scorecard table row 3 | Factual |
| RDM-052 | "The site is fully static: every dynamic route has `generateStaticParams` and `dynamicParams = false`, and nothing is fetched at request time." | README.md:132-133 | after "Getting started" commands | Factual |
| RDM-053 | "content/                 the archive — 9 blueprint bundles + 57 node-card documents (53 distinct card ids; the rest are older pinned versions)" | README.md:138-139 | Project structure diagram | Factual |
| RDM-054 | "the two id segments are catch-alls: doc 3 §7 ids are namespaced (`lupo/pii-handling`), and a `/` in an id is a path separator" | README.md:144-145 | Project structure diagram, app/ annotation | Factual |
| RDM-055 | "`/gallery`, `/parts` and `/ontologies` are permanent redirects to `/blueprints`, `/nodes` and `/ontology`: the section is named **Blueprints**, the reusable unit was renamed from a sub-graph to a node card, and the gallery of vocabularies became one curated core ontology." | README.md:162-165 | after Project structure | Factual |
| RDM-056 | "The product this prototypes is described in `darkprint-io-note.md`; the build order and the specs behind `lib/core` are in `darkprint-design.md`." | README.md:169-170 | closing "Note" section | Factual |
| PRJ-001 | "Recap written 2026-07-29, at commit `340931e` on `feat/core-engine-ontology-v0.1`." | PROJECT.md:3 | Document header/dateline | Factual |
| PRJ-002 | "For the durable structural reference — how a blueprint, a node and the ontology are defined — see [`architecture/`](./architecture/README.md)." | PROJECT.md:5-6 | Points reader to architecture/ | Factual |
| PRJ-003 | "This file is the short version: what the project is for, where it stands, and what to do next." | PROJECT.md:7 | Self-description of PROJECT.md's role | Factual |
| PRJ-004 | "A registry where people publish, read and share blueprints: reusable patterns for getting work done by agents." | PROJECT.md:13-14 | "The vision" section, bolded lede | Factual |
| PRJ-005 | "The claim the site is built on is that the useful artefact is not a prompt and not a model." | PROJECT.md:16-17 | Opens the vision argument | Factual |
| PRJ-006 | "It is the **shape of the work**: which agents exist, what each one is handed, what each one is kept away from, and where the run stops for a person." | PROJECT.md:17-18 | Continues the vision argument | Factual |
| PRJ-007 | "That shape is a directed graph." | PROJECT.md:18 | Continues the vision argument | Factual |
| PRJ-008 | "DarkPrint stores it as text, scores it, and hands it back as a folder." | PROJECT.md:19 | Continues the vision argument | Factual |
| PRJ-009 | "A blueprint is a **pattern for achieving a goal**." | PROJECT.md:21 | Defines "blueprint" | Factual |
| PRJ-010 | "You download one, hand it to Claude Code or an equivalent agent, and that agent adapts it into your codebase — or combines it with another." | PROJECT.md:21-23 | Explains blueprint usage | Factual |
| PRJ-011 | "**The composing happens on your machine, never here.**" | PROJECT.md:23 | Emphasized architectural claim | Factual |
| PRJ-012 | "DarkPrint hands out files and reads them back; it runs nothing." | PROJECT.md:23-24 | Continues the architectural claim | Factual |
| PRJ-013 | "What you end up with, you can publish as a new blueprint, which is how the registry grows." | PROJECT.md:24-25 | Describes the growth loop | Factual |
| PRJ-014 | "**Nodes** are the parts a blueprint is built from, each a versioned card." | PROJECT.md:27 | Defines "node" | Factual |
| PRJ-015 | "The **ontology** is the controlled vocabulary both are written against." | PROJECT.md:27-28 | Defines "ontology" | Factual |
| PRJ-016 | "Those three — blueprint, node, vocabulary — are the whole model." | PROJECT.md:28-29 | Closes the model definition | Factual |
| PRJ-017 | "\"Dark factory\" is a property, not the point" | PROJECT.md:31 | Blockquote heading | Normative |
| PRJ-018 | "A blueprint whose five lifecycle phases (planning, implementation, testing, debugging, deployment) are **all covered and all unattended** is *classed* a dark factory." | PROJECT.md:33-35 | Defines "dark factory" | Factual |
| PRJ-019 | "It is one computed badge on one kind of blueprint." | PROJECT.md:35 | Continues definition | Factual |
| PRJ-020 | "This document used to say \"everything on the site is arranged around that motif\", and that is no longer true." | PROJECT.md:37-38 | Self-correction note | Factual (decision-record) |
| PRJ-021 | "The idea evolved during development: blueprints and nodes are the spine, and the site exists to get people downloading and sharing them." | PROJECT.md:38-39 | Explains the corrected framing | Factual |
| PRJ-022 | "The older framing survived in this file, in `README.md` and in much of the copy, and it was actively misleading" | PROJECT.md:39-41 | Names other files with the same stale framing (overlap signal: README.md) | Factual |
| PRJ-023 | "an agent reading `AGENTS.md` → `PROJECT.md` → `architecture/` was reconstructing the first concept and designing to it." | PROJECT.md:41-42 | Explains the harm of the stale framing (overlap signal: AGENTS.md, architecture/) | Factual |
| PRJ-024 | "Corrected 2026-08-04 on the author's instruction." | PROJECT.md:42-43 | Attributes the correction to the owner | Factual (owner-quoted) |
| PRJ-025 | "If you find prose anywhere in this repo that treats the dark factory as the headline, it is a leftover; fix it rather than following it." | PROJECT.md:43-44 | Direct instruction to a future reader/agent | Normative |
| PRJ-026 | "**Autonomy is descriptive, never a verdict.** (Doc 2 §1.1.)" | PROJECT.md:48 | Heading: "The one rule that constrains everything" | Normative |
| PRJ-027 | "A dark factory is a *description of a shape*, the way *acyclic* describes a shape." | PROJECT.md:50-51 | Elaborates the rule | Factual |
| PRJ-028 | "It is not an award, not a score to maximise, not a rank." | PROJECT.md:51 | Elaborates the rule | Normative |
| PRJ-029 | "A blueprint that holds for a person before it releases is a first-class blueprint whose author decided where a person belongs, and it is shelved beside the rest." | PROJECT.md:51-53 | Elaborates the rule | Normative |
| PRJ-030 | "Most useful patterns are not dark factories and never will be." | PROJECT.md:53 | Elaborates the rule | Factual |
| PRJ-031 | "no badge, no leaderboard, no sorting by autonomy;" | PROJECT.md:57 | Enforcement list, "enforced by tests that fail the build" | Normative |
| PRJ-032 | "**no autonomy ordinal on any user-facing surface** — the class name is what a reader sees;" | PROJECT.md:58 | Enforcement list | Normative |
| PRJ-033 | "nothing that frames a human node as a shortfall or a step not yet taken;" | PROJECT.md:59 | Enforcement list | Normative |
| PRJ-034 | "where a person acts is drawn in violet, never in the alarm colour the site spends on defects." | PROJECT.md:60-61 | Enforcement list | Normative |
| PRJ-035 | "There are **two different scales** on this site and they must never be confused:" | PROJECT.md:63-64 | Introduces the scales table | Normative |
| PRJ-036 | "the 1–5 ladder \| an organisation's maturity \| a number (the only one that counts in rungs)" | PROJECT.md:67 | Scales table, row 1 | Factual |
| PRJ-037 | "the autonomy class \| one graph's shape \| a name: assisted / supervised / conditional / closed-loop" | PROJECT.md:68 | Scales table, row 2 | Factual |
| PRJ-038 | "The engine enforces the argument the site makes." | PROJECT.md:72 | Opens "What makes the claim more than prose" | Factual |
| PRJ-039 | "`code-builder@1.0.0` declares `cannot: [acceptance-criteria]`." | PROJECT.md:74 | Reference-case blockquote | Factual |
| PRJ-040 | "That entry names a data type in the ontology, so it is a rule rather than a note." | PROJECT.md:75 | Reference-case blockquote | Factual |
| PRJ-041 | "Draw `planner -> builder` in the DOT and the bundle **fails to resolve** with `bundle/prohibition-violated`, *and* independently the security reading falls from 4 to 2 with the builder named as the reason." | PROJECT.md:75-77 | Reference-case blockquote | Factual |
| PRJ-042 | "Two checks, from two directions — a card's declared contract, and the topology — reaching the same conclusion." | PROJECT.md:79-80 | Summarizes the reference case | Factual |
| PRJ-043 | "That is the whole argument for typed graphs over prompt collections, and the site can demonstrate it live at `/what-it-isnt` and behind the switch on `/build`." | PROJECT.md:80-81 | Summarizes the reference case | Factual |
| PRJ-044 | "The exported `factory.dot` is **runnable by [Attractor](https://github.com/strongdm/attractor)** as it stands." | PROJECT.md:85-86 | "Interoperability" section | Factual |
| PRJ-045 | "Card `spec` text is inlined as `prompt`, `model` is emitted as Attractor's reserved `llm_model`, and the iteration cap becomes `max_retries`." | PROJECT.md:86-88 | Interoperability details | Factual |
| PRJ-046 | "Attractor silently ignores unreserved attributes, which is why `card=\"id@version\"` rides along without breaking it." | PROJECT.md:87-88 | Interoperability details | Factual |
| PRJ-047 | "npm run build     136 pages, 9 downloadable bundles" | PROJECT.md:97 | "Where it stands" gate-status block | Factual |
| PRJ-048 | "npx tsc --noEmit  clean" | PROJECT.md:98 | Gate-status block | Factual |
| PRJ-049 | "npm run lint      clean" | PROJECT.md:99 | Gate-status block | Factual |
| PRJ-050 | "npm test          3211 tests, 69 files" | PROJECT.md:100 | Gate-status block | Factual |
| PRJ-051 | "**`public/bundles` is generated *and* checked in.**" | PROJECT.md:103 | Warns about build/commit ordering | Factual |
| PRJ-052 | "A build writes all nine README files from the current `lib/core/config.ts`, so a commit taken from a tree that was last built under an edited calibration ships published bundles whose scores no page agrees with." | PROJECT.md:104-106 | Explains the hazard | Factual |
| PRJ-053 | "Run `rm -rf .next public/bundles && npm run build` before committing and check `git status` on that directory." | PROJECT.md:106-107 | Direct operational instruction | Normative |
| PRJ-054 | "engine \| 30 modules under `lib/core`, isomorphic (no `node:*`, no `Date.now`, no `Math.random`)" | PROJECT.md:111 | Stats table | Factual |
| PRJ-055 | "content \| 9 blueprints, 57 card files (53 distinct nodes, 4 with two versions)" | PROJECT.md:112 | Stats table | Factual |
| PRJ-056 | "ontology \| v0.1.0, 49 curated terms + namespaced local extensions" | PROJECT.md:113 | Stats table | Factual |
| PRJ-057 | "routes \| 19 route files → 136 prerendered pages, SSG only" | PROJECT.md:114 | Stats table | Factual |
| PRJ-058 | "figures \| luminous-flow SVG scenes driven by anime.js v4.5" | PROJECT.md:115 | Stats table | Factual |
| PRJ-059 | "**The engine.** DOT lexer and parser, bundle resolution, autonomy / security / phase coverage / spec-similarity analysis, content-addressed archive with a pure-TS sha256, semver inference, Attractor emit and lint." | PROJECT.md:119-121 | "What is built" list | Factual |
| PRJ-060 | "**The registry, read-only.** Browse blueprints and nodes, open any card, read the ontology." | PROJECT.md:122 | "What is built" list | Factual |
| PRJ-061 | "**Download.** Nine bundles regenerate from source at build time and are served as folders." | PROJECT.md:123 | "What is built" list | Factual |
| PRJ-062 | "**`/upload`.** Validates and scores a bundle **in the browser tab** and stops there." | PROJECT.md:124 | "What is built" list | Factual |
| PRJ-063 | "**`/build`.** A workspace over 80 pre-resolved combinations: one graph as the stage, three simultaneous choices below it, five tabs behind it (Graph, DOT, Cards, Vocabulary, Score), and two co-equal exits — a download, or a brief for the reader's own agent." | PROJECT.md:125-127 | "What is built" list | Factual |
| PRJ-064 | "**There is no backend.**" | PROJECT.md:131 | "What is NOT built" section | Factual |
| PRJ-065 | "No accounts, no publishing, no push, no votes, no telemetry, no MCP server." | PROJECT.md:131-132 | Enumerates missing backend features | Factual |
| PRJ-066 | "Community figures shown in the registry are **seeded** and every one of them carries a `◐ seeded` marker in glyph *and* word." | PROJECT.md:132-134 | Seeded-data disclosure claim | Factual |
| PRJ-067 | "Keep it that way: two HIGH findings in this project were the site quietly presenting seeded numbers as facts." | PROJECT.md:133-134 | Instruction plus incident history | Normative |
| PRJ-068 | "Ordered by my read of the value." | PROJECT.md:140 | Opens "Next steps", first-person owner voice | Factual (owner-quoted) |
| PRJ-069 | "**§3.2 is done and §3.4 is answered in a shape its own entry did not ask for**; both are marked below with what shipped and what it cost." | PROJECT.md:140-141 | Status of subsections | Factual |
| PRJ-070 | "The rest is not started." | PROJECT.md:142 | Status of subsections | Factual |
| PRJ-071 | "The redesign cut the landing from ~4,100 visible words to 216, and `/build` by 37–66% per step." | PROJECT.md:146-147 | §3.1 "Finish the length pass" | Factual |
| PRJ-072 | "Four explainer pages did not follow." | PROJECT.md:147 | §3.1 | Factual |
| PRJ-073 | "**Measure prose, not pixels and not raw word count.**" | PROJECT.md:149 | §3.1 methodology rule | Normative |
| PRJ-074 | "Both cruder metrics give the wrong answer here, and both were acted on before being checked:" | PROJECT.md:149-150 | §3.1 | Factual |
| PRJ-075 | "**Pixel height** ranks `/nodes` worst." | PROJECT.md:152 | §3.1 | Factual |
| PRJ-076 | "It is a grid of 53 tiles — skimmed in seconds." | PROJECT.md:152 | §3.1, re `/nodes` | Factual |
| PRJ-077 | "Page height measures scrolling, and the complaint was about reading." | PROJECT.md:153 | §3.1 | Factual |
| PRJ-078 | "**Raw word count** ranks `/blueprints/<slug>` worst at 3,283–3,790." | PROJECT.md:154 | §3.1 | Factual |
| PRJ-079 | "About half of that is the four-pane viewer rendering card YAML and DOT as styled spans, so a `<pre>`-based filter misses it and counts source listing as prose." | PROJECT.md:154-156 | §3.1 | Factual |
| PRJ-080 | "A registry detail page showing its own source is doing its job." | PROJECT.md:156-157 | §3.1 | Normative |
| PRJ-081 | "2,054 \| `/spec/card` \| grew — the dezoom gained a second placement for phone legibility" | PROJECT.md:163 | Prose-words table at `340931e` | Factual |
| PRJ-082 | "2,048 \| `/what-it-isnt` \| fell only 13.8% while absorbing two landing sections" | PROJECT.md:164 | Prose-words table | Factual |
| PRJ-083 | "2,045 \| `/towards-a-dark-factory/the-climb` \| fell 4.3%; a fourth route was declined as out-of-spec" | PROJECT.md:165 | Prose-words table | Factual |
| PRJ-084 | "`/towards-a-dark-factory/the-climb` \| 2,045 \| **1,197** \| −41%" | PROJECT.md:173 | "Done at `2d70354`" table | Factual |
| PRJ-085 | "`/towards-a-dark-factory/which-tasks` \| 1,811 \| **1,276** \| −30%" | PROJECT.md:174 | Same table | Factual |
| PRJ-086 | "`/what-it-isnt` \| 2,048 \| **1,599** \| −22%, and −42% of what reads without opening a disclosure" | PROJECT.md:175 | Same table | Factual |
| PRJ-087 | "`/spec/card` \| 2,054 \| **1,717** \| −16%, −38% open" | PROJECT.md:176 | Same table | Factual |
| PRJ-088 | "`/blueprints/<slug>` ×9, non-listing half \| 19,107 \| **17,504** \| −8%, −19% open" | PROJECT.md:177 | Same table | Factual |
| PRJ-089 | "`/towards-a-dark-factory` \| 694 \| 1,029 \| **+48%** — it absorbed a block from its children; the three together fell 23%" | PROJECT.md:178 | Same table | Factual |
| PRJ-090 | "`/nodes` (2,396) and `/ontology` (2,060) were left alone on purpose." | PROJECT.md:180 | Explains exclusions | Factual |
| PRJ-091 | "They are lists." | PROJECT.md:180 | Justifies the exclusion | Factual |
| PRJ-092 | "the author asked \"Field by field\" permanently open and asked for each subfield's role described." | PROJECT.md:187 | Re-measure table, `/spec/card` row | Factual (owner-quoted) |
| PRJ-093 | "Nine subfield entries were added and `components/ui/More.tsx` came off the page, so the *open* reading went from roughly 1,064 to 1,802 — +69%." | PROJECT.md:187 | Same row | Factual |
| PRJ-094 | "This is now the site's longest single-instance page that is not a list." | PROJECT.md:187 | Same row | Factual |
| PRJ-095 | "it absorbed the deleted `/spec`'s door furniture, `SectionExample` (386 words, and `/spec` was its only mount) and the `/concepts` content as `#the-words`." | PROJECT.md:188 | `/what-a-blueprint-is` row | Factual |
| PRJ-096 | "the `/spec/scoring` merge, minus the duplicate plate and both self-linking tail boxes." | PROJECT.md:189 | `/reading-the-radar` row | Factual |
| PRJ-097 | "None of the three is behind a disclosure, so the honesty ledger's *open* tags are all still honoured — the growth is readable text, which is the direction this project treats as safe." | PROJECT.md:191-192 | Conclusion on the re-measure | Normative |
| PRJ-098 | "The lever, if any of them needs cutting later, is named in each page's own header docblock." | PROJECT.md:193 | Points to another artifact location | Factual |
| PRJ-099 | "Cutting for pace is how honesty statements disappear, and the danger is not deletion." | PROJECT.md:197-198 | "What this pass taught" | Normative |
| PRJ-100 | "It is **promotion to a disclosure**: the words stay in the HTML, every word-count check still passes, and the reader never sees them." | PROJECT.md:198-199 | Continues the lesson | Factual |
| PRJ-101 | "Twelve findings came out of this pass and most were that shape" | PROJECT.md:199 | Continues the lesson | Factual |
| PRJ-102 | "*\"the absence of a finding here is silence, not a clean verdict\"* went from open on eight blueprint pages to open on none, and the severity word `warning` vanished from all nine while an amber glyph carried the meaning alone." | PROJECT.md:200-202 | Concrete example of the lesson | Factual |
| PRJ-103 | "`components/site/honesty.test.ts` now holds a ledger of named claims, each tagged **open** or **present**, and `components/ui/visible-text.ts` implements the difference by dropping the body of any `<details>` that lacks an `open` attribute." | PROJECT.md:204-206 | Describes the enforcement mechanism | Factual |
| PRJ-104 | "A claim tagged `open` fails the build if it moves behind a disclosure." | PROJECT.md:206-207 | Describes the enforcement mechanism | Factual |
| PRJ-105 | "Add to that ledger whenever a page starts stating a limit." | PROJECT.md:207 | Direct instruction | Normative |
| PRJ-106 | "To re-measure, strip `<script>`, `<style>`, `<svg>` and `<pre>` inside `<main>` and count words — but check by section first, because the pane listings do not sit in `<pre>`." | PROJECT.md:209-210 | Procedural instruction | Normative |
| PRJ-107 | "`components/home/roles-labels.test.ts` renders a figure, resolves each `<text>` through its translations, and fails on overlapping or clipped labels." | PROJECT.md:214-215 | §3.2 "done" | Factual |
| PRJ-108 | "It caught four defects the size-only check could not see, and it covered the roles figure alone." | PROJECT.md:215-216 | §3.2 | Factual |
| PRJ-109 | "Shipped as `components/viz/label-boxes.ts` (a plain module, not a test file) plus `components/viz/scene-labels.test.ts`, which walks `components/**` and `app/**` for `<FlowScene` and fails if a file that draws one is not in its roster." | PROJECT.md:218-220 | §3.2 | Factual |
| PRJ-110 | "**15 drawers, 26 frames.**" | PROJECT.md:220-221 | §3.2 | Factual |
| PRJ-111 | "Four more defects came out of it, all in `components/home/SectionLevels.tsx`, which was the largest unguarded set of drawings on the site." | PROJECT.md:221-222 | §3.2 | Factual |
| PRJ-112 | "**The advance constant is `0.62` and lives in one place.**" | PROJECT.md:226 | §3.2 "worth keeping in mind" | Factual |
| PRJ-113 | "The shipped mono face measures 0.600 exactly (`next/font`'s Geist Mono fallback is `local(Arial)` at `size-adjust: 134.59%`, and 0.4458 × 1.3459 = 0.600), so a guard using the measurement has no margin at all." | PROJECT.md:226-229 | §3.2 | Factual |
| PRJ-114 | "The 2026-07-29 swap to JetBrains Mono (`app/layout.tsx`) re-measured this: its generated fallback lands on the same `size-adjust: 134.59%`, so the measurement is still 0.600 and `0.62` needed no change." | PROJECT.md:229-231 | §3.2 | Factual |
| PRJ-115 | "`graph.test.ts` imports it rather than declaring a second one; that divergence is how the shared guard ended up three percent more permissive than its sibling." | PROJECT.md:231-233 | §3.2 | Factual |
| PRJ-116 | "**It compares text against text, and text against a stroked `<rect>`.**" | PROJECT.md:234 | §3.2 | Factual |
| PRJ-117 | "Curves, arrowheads and node rings are not collected." | PROJECT.md:235 | §3.2 | Factual |
| PRJ-118 | "The rect case exists because the first fix to level 4 slid the harness box onto the word `task` while every text-only case stayed green." | PROJECT.md:235-237 | §3.2 | Factual |
| PRJ-119 | "**It throws rather than guessing.**" | PROJECT.md:238 | §3.2 | Factual |
| PRJ-120 | "A transform it cannot compose, a transform on an element it does not resolve them for, a `<text>` with no size, a markup string with no scene: all four fail the run with the value named." | PROJECT.md:238-240 | §3.2 | Factual |
| PRJ-121 | "`lib/core/config.ts` holds every tunable number, deliberately in one file." | PROJECT.md:244 | §3.3 "needs a decision, not code" | Factual |
| PRJ-122 | "**four of nine blueprints floor at security 1.**" | PROJECT.md:247 | §3.3 | Factual |
| PRJ-123 | "Either the weights are too harsh or the scale is too short." | PROJECT.md:247-248 | §3.3 | Factual |
| PRJ-124 | "Doc 3 §9 left this open for calibration against real data." | PROJECT.md:248 | §3.3 | Factual |
| PRJ-125 | "**doc 2 §5.6's slider moves one metric where the doc implies four.**" | PROJECT.md:249 | §3.3 | Factual |
| PRJ-126 | "Changing any of these is a PATCH of the ontology version, because it re-scores every blueprint." | PROJECT.md:251 | §3.3 | Normative |
| PRJ-127 | "The first entry here shipped the content as a section on `/spec` and left the placement as an open question: that page had become the longest open-prose page on the site, +86% over its own post-length-pass figure, on a route the redesign split into four specifically because one long page made readers leave." | PROJECT.md:255-258 | §3.4 "done" history | Factual |
| PRJ-128 | "The second answer was a route of its own." | PROJECT.md:260 | §3.4 | Factual |
| PRJ-129 | "`SectionExample`'s `#scoring` panel (\"How a factory is graded\", the qualitative walk through all six radar axes) and `ScoringModel` (the quantitative weights, bands and thresholds, still read live from `DARKPRINT_CONFIG` and `getOntologyView()`, never transcribed) both moved onto `app/spec/scoring/page.tsx`, appended to `SPEC_SEQUENCE` as a fifth stop and a plain `SpecPage`" | PROJECT.md:260-264 | §3.4 | Factual |
| PRJ-130 | "never a fourth *layer*, because `SPEC_LAYERS` stays three items and the site says \"three layers\" in enough places that a fourth would contradict itself." | PROJECT.md:264-266 | §3.4 | Normative |
| PRJ-131 | "**The IA pass of 2026-08-07 is the third and last answer.**" | PROJECT.md:268 | §3.4 | Factual |
| PRJ-132 | "The author asked the grading door off the spec index and asked `/spec` itself deleted, which left a numbered spec stop under an index that no longer existed." | PROJECT.md:268-270 | §3.4 | Factual (owner-quoted) |
| PRJ-133 | "`/spec/scoring` merged into `/reading-the-radar` instead: one page carrying the picture (five spokes, why autonomy has none, what a vertex's colour says) and the arithmetic (the three badges, `ScoringModel` entire), under the title every inline link on the site already used for it, \"How a blueprint is graded\"." | PROJECT.md:270-273 | §3.4 | Factual |
| PRJ-134 | "The two routes had drawn the same `ScoreRadar` at the same blueprint at the same two width solves, and each ended by linking the other; that duplication is what the merge removed." | PROJECT.md:274-275 | §3.4 | Factual |
| PRJ-135 | "`SPEC_SEQUENCE` is four again — stop 00 is `/what-a-blueprint-is`, which is the door onto the three layer pages now." | PROJECT.md:277-278 | §3.4 | Factual |
| PRJ-136 | "`next.config.ts` 308s `/spec`, `/spec/scoring` and `/concepts`." | PROJECT.md:278 | §3.4 | Factual |
| PRJ-137 | "The fragments survive the moves that could carry them: `#weights` because `ScoringModel` owns that id and travelled whole, and `/spec#topology|#card|#ontology` because the three bands on `/what-a-blueprint-is` took those ids, which is what a browser re-applying a fragment to a fragment-less `Location` needs to find." | PROJECT.md:279-282 | §3.4 | Factual |
| PRJ-138 | "`/spec#scoring` does not survive: its compatibility door was on the page that was deleted." | PROJECT.md:282-283 | §3.4 | Factual |
| PRJ-139 | "The pager's own aria-label was found reading \"in four parts\" against a five-item rail after the split — a reviewer caught it, and it's fixed by deriving the count (`SPEC_SEQUENCE.length`) rather than a second hand-typed copy of it, which is now the pattern: nothing about this sequence should be stated twice in two places that can drift." | PROJECT.md:285-288 | §3.4 | Normative |
| PRJ-140 | "Doc 2 §11 items 14–17: registration at save, a public/private toggle, gallery upload, opt-in telemetry." | PROJECT.md:292 | §3.5 "the backend, if it is ever wanted" | Factual |
| PRJ-141 | "**This is the point where the honesty rules stop being free.**" | PROJECT.md:293 | §3.5 | Factual |
| PRJ-142 | "Today the site can say \"nothing here is measured\" and be exactly right." | PROJECT.md:293-294 | §3.5 | Factual |
| PRJ-143 | "The moment any of this lands, every seeded marker and every disclaimer has to be revisited in the same change." | PROJECT.md:294-295 | §3.5 | Normative |
| PRJ-144 | "**BlueGrid parts 1–3** sit behind a Cloudflare challenge and were never read." | PROJECT.md:299 | §3.6 "Sources still unread" | Factual |
| PRJ-145 | "They are not cited anywhere and must not be." | PROJECT.md:299-300 | §3.6 | Normative |
| PRJ-146 | "If they matter, open them in a browser and fold them into `/towards-a-dark-factory/the-climb`." | PROJECT.md:300-301 | §3.6 | Normative |
| PRJ-147 | "The HackerNoon article **is** read and is cited correctly: its ladder is numbered 1, 2, 3, 3.5, 4 and names no rungs." | PROJECT.md:303-304 | §3.6 | Factual |
| PRJ-148 | "The five named rungs on this site are ours, and the source note says so." | PROJECT.md:304-305 | §3.6 | Factual |
| PRJ-149 | "That was a false attribution once; do not let it come back." | PROJECT.md:305 | §3.6 | Normative |
| PRJ-150 | "**`AGENTS.md` is not boilerplate.**" | PROJECT.md:311 | §4 "Working notes for whoever picks this up" | Normative |
| PRJ-151 | "This is Next.js 16 with real breaking changes." | PROJECT.md:311-312 | §4 (overlap signal: AGENTS.md) | Factual |
| PRJ-152 | "Read `node_modules/next/dist/docs/` before touching a route or the config." | PROJECT.md:312 | §4 | Normative |
| PRJ-153 | "**Comments here explain *why*, citing the doc section or the defect that forced the decision.**" | PROJECT.md:313-314 | §4 | Normative |
| PRJ-154 | "Match that." | PROJECT.md:314 | §4 | Normative |
| PRJ-155 | "A comment restating the code is noise; a comment recording why a number is 0.32 is what stops the next person reverting it." | PROJECT.md:314-315 | §4 | Normative |
| PRJ-156 | "**The source docs are in `files/`** — `darkprint-design.md` (doc 1), `darkprint-onboarding-positioning.md` (doc 2), `darkprint-ontology-v0.1.md` (doc 3)." | PROJECT.md:316-317 | §4 (overlap signal: files/*.md) | Factual |
| PRJ-157 | "Section references throughout the codebase point at these." | PROJECT.md:318 | §4 | Factual |
| PRJ-158 | "**Verify agent and tool reports before trusting them.**" | PROJECT.md:319 | §4 | Normative |
| PRJ-159 | "Over this project a build was reported green while `lib/core` was red, a test passed against deliberately broken code because it anchored on the wrong string, and two \"regression tests awaiting a fix\" were actually stale tests asserting old behaviour." | PROJECT.md:319-322 | §4 | Factual |
| PRJ-160 | "Run the gates yourself." | PROJECT.md:322 | §4 | Normative |
| PRJ-161 | "**When you add a guard, falsify it.**" | PROJECT.md:323 | §4 | Normative |
| PRJ-162 | "Break the code on purpose, watch the test fail with the right message, restore." | PROJECT.md:323-324 | §4 | Normative |
| PRJ-163 | "Several tests in this repo exist because that step caught a check that was silently passing." | PROJECT.md:324-325 | §4 | Factual |
| PRJ-164 | "**When an ask describes a feature in account/hosting terms this site doesn't have, don't build the account system and don't quietly rewrite the ask into something smaller either — say so, then ship the honest version of the same interaction.**" | PROJECT.md:326-328 | §4 | Normative |
| PRJ-165 | "The precedent: \"fork blueprint... into the user account, download it, edit it, upload it back\" became `components/blueprint/ForkAction.tsx`, a disclosure holding the existing `ForkScene` drawing, two sentences saying what forking a text bundle actually means, and a link to the `DownloadPanel` that already lists every file — no account, no server-side copy, no claim that one exists." | PROJECT.md:328-333 | §4 | Factual |
| PRJ-166 | "Reused an existing honest component rather than inventing a second, differently-scoped download button under a name that would have overclaimed." | PROJECT.md:333-334 | §4 | Factual |
| PRJ-167 | "Even a disclosure this small needs the same scrutiny as any other new UI: it shipped once with its popover positioned to overflow the viewport by 92px on a phone, caught only by rendering it and reading `getBoundingClientRect()` — a class name is not evidence of where something actually draws." | PROJECT.md:335-338 | §4 closing | Normative |
| IPL-001 | This plan is derived from `sol_feedback.md`. | IMPLEMENTATION_PLAN.md:3 | Opening line of the plan | Factual |
| IPL-002 | The existing mock is the intended product, including fixture-backed capabilities that do not have services behind them yet. | IMPLEMENTATION_PLAN.md:3-5 | Frames how to read implementation status | Normative |
| IPL-003 | Product importance is therefore never inferred from implementation status. | IMPLEMENTATION_PLAN.md:5 | Follows from the mock-as-spec framing | Normative |
| IPL-004 | `pre-codex` is the immutable comparison baseline for this pass. | IMPLEMENTATION_PLAN.md:7 | Standalone statement before the ordered list | Factual |
| IPL-005 | Make the product a registry of reusable, version-pinned agent-workflow blueprints. | IMPLEMENTATION_PLAN.md:11-12 | Step 1, "Lock positioning and nouns" | Normative |
| IPL-006 | Use *Blueprint*, *Card*, *Registry*, *Validate*, and *Run* on first-visit surfaces. | IMPLEMENTATION_PLAN.md:12-13 | Continuation of step 1 | Normative |
| IPL-007 | Describe the specification as reproducible and checkable, never the LLM result as deterministic. | IMPLEMENTATION_PLAN.md:13-14 | End of step 1 | Normative |
| IPL-008 | Make `find → inspect → use → adapt locally → validate` and `goal → create → validate → publish` the two visible paths through the product. | IMPLEMENTATION_PLAN.md:15-16 | Step 2, "Lock the two loops" | Normative |
| IPL-009 | Keep Blueprints and Cards as the registry shelves; promote Create, Publish, and MCP as product workflows; group format education under Docs; keep the dark-factory material under Guides. | IMPLEMENTATION_PLAN.md:17-19 | Step 3, "Make navigation task-oriented" | Normative |
| IPL-010 | Start with the user's goal and the DarkPrint authoring skill. | IMPLEMENTATION_PLAN.md:20-21 | Step 4, "Make Create honest" | Normative |
| IPL-011 | Present the current three-control builder as an optional starter sandbox, not a general blueprint designer. | IMPLEMENTATION_PLAN.md:21-22 | Continuation of step 4 | Normative |
| IPL-012 | Lead with problem fit and limitations, then graph/contract, requirements, validation, version/provenance, and one canonical use action. | IMPLEMENTATION_PLAN.md:23-25 | Step 5, "Make artifact pages decision-oriented" | Normative |
| IPL-013 | Move schema teaching and raw source into supporting reference. | IMPLEMENTATION_PLAN.md:25 | End of step 5 | Normative |
| IPL-014 | Structural evidence, community assessment, and run evidence must be distinct. | IMPLEMENTATION_PLAN.md:26-27 | Step 6, "Separate evidence by provenance" | Normative |
| IPL-015 | Missing and low-sample evidence are real product states and must not be replaced with values merely to complete a chart. | IMPLEMENTATION_PLAN.md:27-28 | Continuation of step 6 | Normative |
| IPL-016 | Cover the new contracts with tests, run all repository gates, and inspect the finder and creator paths at desktop and mobile widths. | IMPLEMENTATION_PLAN.md:29-30 | Step 7, "Verify the loops" | Normative |
| IPL-017 | Treat 00–06 as one ordered reading path, render the same highlighted rail at the bottom of every page, and use those names in the Learn menu. | IMPLEMENTATION_PLAN.md:31-32 | Step 8, "Unify Learn" | Normative |
| IPL-018 | Move the vocabulary index, motivation, extension model, concrete overlay and validation rules to `/spec/ontology`; permanently redirect the old `/ontology` index while preserving `/ontology/<term>` detail routes. | IMPLEMENTATION_PLAN.md:33-35 | Step 9, "Make Ontology canonical" | Normative |
| IPL-019 | Put a GitHub-style Star control and count beside every blueprint and node-card title, with fixture provenance visible until a service exists. | IMPLEMENTATION_PLAN.md:36-37 | Step 10, "Expose community support" | Normative |
| IPL-020 | Blueprints, not autonomy, are the headline product. | IMPLEMENTATION_PLAN.md:43 | First bullet under "Product decisions adopted" | Normative |
| IPL-021 | DarkPrint stores and statically checks files; a user's harness runs them locally. | IMPLEMENTATION_PLAN.md:44 | Second adopted decision | Factual |
| IPL-022 | Human-gated workflows are first-class and autonomy remains descriptive. | IMPLEMENTATION_PLAN.md:45 | Third adopted decision | Normative |
| IPL-023 | `Static risk exposure` is the public label for the structure-derived risk reading. | IMPLEMENTATION_PLAN.md:46 | Fourth adopted decision | Factual |
| IPL-024 | It is not represented as a security audit. | IMPLEMENTATION_PLAN.md:47 | Continuation of the "Static risk exposure" decision | Normative |
| IPL-025 | MCP remains top-level because agent-side registry discovery is one of the two intended registry interfaces. | IMPLEMENTATION_PLAN.md:48-49 | Fifth adopted decision | Factual |
| IPL-026 | It is described separately from the authoring skill. | IMPLEMENTATION_PLAN.md:49 | Continuation of the MCP decision | Normative |
| IPL-027 | Ontology is reference/governance material under Docs rather than a first-visit shelf. | IMPLEMENTATION_PLAN.md:50 | Sixth adopted decision | Normative |
| IPL-028 | The documentation group is named **Learn**, ordered 00–06, and stop 03/page title is consistently **Ontology**. | IMPLEMENTATION_PLAN.md:51-52 | Seventh adopted decision | Factual |
| IPL-029 | `/spec/ontology` is the canonical ontology index; `/ontology` is a compatibility URL. | IMPLEMENTATION_PLAN.md:53 | Eighth adopted decision | Factual |
| IPL-030 | Stars are the chosen public support metaphor. | IMPLEMENTATION_PLAN.md:54 | Ninth adopted decision | Factual |
| IPL-031 | The current counts remain visibly seeded and browser-local starring adds only the current browser's own selection. | IMPLEMENTATION_PLAN.md:54-55 | Continuation of the stars decision | Factual |
| IPL-032 | A blueprint page has one canonical **Use this blueprint** area. | IMPLEMENTATION_PLAN.md:56 | Tenth adopted decision | Normative |
| IPL-033 | Individual source files remain available as evidence, not competing primary actions. | IMPLEMENTATION_PLAN.md:56-57 | Continuation of the "Use this blueprint" decision | Normative |
| IPL-034 | Implementing any of these as settled behavior would invent product policy. | IMPLEMENTATION_PLAN.md:61 | Preface to "Product decisions intentionally left open" | Normative |
| IPL-035 | Each needs an explicit decision before its fixture state becomes a production contract. | IMPLEMENTATION_PLAN.md:61-62 | Continuation of the open-decisions preface | Normative |
| IPL-036 | Whether warnings block publication or only errors do. | IMPLEMENTATION_PLAN.md:64 | Open decision 1 | Factual |
| IPL-037 | Whether local adaptations become lineage-preserving forks or new artifacts with provenance. | IMPLEMENTATION_PLAN.md:65-66 | Open decision 2 | Factual |
| IPL-038 | Blueprint release/version rules, including how a current version is selected. | IMPLEMENTATION_PLAN.md:67 | Open decision 3 | Factual |
| IPL-039 | Which artifacts and reports may be private, and who can see them. | IMPLEMENTATION_PLAN.md:68 | Open decision 4 | Factual |
| IPL-040 | The separate trust signals, eligibility rules, weighting, revocation, and abuse controls behind identity, validation, reviews, reputation, usage, and verified runs. | IMPLEMENTATION_PLAN.md:69-70 | Open decision 5 | Factual |
| IPL-041 | Run normalization across model, provider, hardware, input size, harness version, sample size, freshness, and uncertainty. | IMPLEMENTATION_PLAN.md:71-72 | Open decision 6 | Factual |
| IPL-042 | Ontology proposal, review, ownership, conflict, promotion, and deprecation policy. | IMPLEMENTATION_PLAN.md:73 | Open decision 7 | Factual |
| IPL-043 | The MCP retrieval contract: result kinds, exact releases, excerpts, ranking, authorization, and provenance. | IMPLEMENTATION_PLAN.md:74-75 | Open decision 8 | Factual |
| IPL-044 | Licenses for published specifications and generated bundles. | IMPLEMENTATION_PLAN.md:76 | Open decision 9 | Factual |
| IPL-045 | The boundary for malicious instructions, declared tool reach, static warnings, moderation, and provenance. | IMPLEMENTATION_PLAN.md:77-78 | Open decision 10 | Factual |
| IPL-046 | Account and organization roles and their permission transitions. | IMPLEMENTATION_PLAN.md:79 | Open decision 11 | Factual |
| IPL-047 | The distinct semantics of browser download, MCP fetch, clone, fork, and run events. | IMPLEMENTATION_PLAN.md:80 | Open decision 12 | Factual |
| IPL-048 | Discovery ranking for the website and MCP, including whether any social signal affects the default order. | IMPLEMENTATION_PLAN.md:81-82 | Open decision 13 | Factual |
| IPL-049 | Report, hiding, appeal, suspension, and disputed-evidence moderation states. | IMPLEMENTATION_PLAN.md:83 | Open decision 14 | Factual |
| IPL-050 | Retention and deletion rules for immutable releases, drafts, comments, reports, and personal data. | IMPLEMENTATION_PLAN.md:84-85 | Open decision 15 | Factual |
| IPL-051 | The production star service: identity, deduplication, unstar semantics, migration of seeded counts, and whether historical `votes` become stars or remain a separate signal. | IMPLEMENTATION_PLAN.md:86-87 | Open decision 16 | Factual |
| IPL-052 | Until those decisions are made, the UI may show the existence and provenance of fixture evidence, but must not imply a weighting, eligibility, ranking, or policy that has not been defined. | IMPLEMENTATION_PLAN.md:89-91 | Closing constraint after the open-decisions list | Normative |
| SOL-001 | Revision: the mock is treated as the complete target-product specification, including fixture-backed services that will be implemented before release. | sol_feedback.md:5-6 | document header, framing the review's core assumption | Normative |
| SOL-002 | This review covers the repository's product documents, architecture notes, current route hierarchy, rendered page headings and prose, navigation, mock registry data, blueprint and card detail templates, authoring and validation flows, and target community and MCP surfaces. | sol_feedback.md:10-13 | "Scope of this review" section | Factual |
| SOL-003 | No application code was changed. | sol_feedback.md:15 | scope disclosure | Factual |
| SOL-004 | The in-app browser was unavailable during the review, so visual conclusions are based on rendered HTML, component structure, responsive classes, and the repository's existing layout tests rather than a new screenshot pass. | sol_feedback.md:15-17 | scope disclosure, method limitation | Factual |
| SOL-005 | Before implementing visual recommendations, they should be checked at desktop and mobile widths in a browser. | sol_feedback.md:17-18 | closes the scope section | Normative |
| SOL-006 | This document treats the mock as the specification of the intended production service, not as a preview restricted to functionality that happens to be implemented today. | sol_feedback.md:22-25 | "Clarification about the mock" | Normative |
| SOL-007 | Accounts, publishing, private artifacts, forks, reputation, voting, run evidence, ontology promotion, and MCP retrieval should remain in the mock when they belong to the intended release. | sol_feedback.md:23-25 | same paragraph | Normative |
| SOL-008 | Recommendations to simplify or reposition those components are therefore based on their role in the final product, not on their current implementation status. | sol_feedback.md:27-28 | same section | Normative |
| SOL-009 | A fixture-backed component is valid. | sol_feedback.md:28-29 | same section | Normative |
| SOL-010 | What it needs is a defined data contract, complete interaction states, and a clear place in the user journey. | sol_feedback.md:29-30 | continues prior sentence | Normative |
| SOL-011 | Implementation status belongs in project tracking or a prototype-only annotation, not in the final information hierarchy. | sol_feedback.md:30-31 | closes "Clarification about the mock" | Normative |
| SOL-012 | The following interpretation was checked with the author during the review. | sol_feedback.md:35 | header line of "Confirmed product direction" — provenance marker for the whole section | Normative (owner-confirmed) |
| SOL-013 | DarkPrint is a registry for reusable agent-workflow blueprints. | sol_feedback.md:37 | opens "Confirmed product direction", under the checked-with-author marker | Factual (owner-confirmed) |
| SOL-014 | It is not an agent runner. | sol_feedback.md:37-38 | same sentence group | Factual (owner-confirmed) |
| SOL-015 | It stores, validates, explains, versions, and distributes specifications; the user's own agent harness adapts and executes them on the user's machine. | sol_feedback.md:38-39 | continues prior claim | Factual (owner-confirmed) |
| SOL-016 | The primary artifact is a blueprint bundle: a typed DOT graph defining nodes, handoffs, loops, and deliberate absences; one version-pinned YAML card per node defining that node's contract; a controlled ontology shared by the graph and cards; documentation for the person and for the agent that will adapt the bundle. | sol_feedback.md:41-46 | bundle definition list | Factual (owner-confirmed) |
| SOL-017 | The central product claim is that the useful reusable artifact is the shape of the work, not a prompt or a model. | sol_feedback.md:48-49 | product thesis statement | Factual (owner-confirmed) |
| SOL-018 | DarkPrint makes that shape inspectable and statically checkable: typed interfaces, explicit prohibitions, bounded loops, human checkpoints, tool reach, version pins, provenance, and explainable diagnostics. | sol_feedback.md:49-51 | continues prior claim | Factual (owner-confirmed) |
| SOL-019 | The GitHub analogy is valid in one important sense: DarkPrint serves both people looking for an existing artifact and people creating or publishing one. | sol_feedback.md:53-55 | analogy scoped explicitly | Factual (owner-confirmed) |
| SOL-020 | Those are two connected loops, not two different products. | sol_feedback.md:54-55 | leads into the find/create diagram | Factual (owner-confirmed) |
| SOL-021 | DarkPrint should not promise a deterministic result. | sol_feedback.md:71 | "The determinism claim" subsection, still under owner-confirmed marker | Normative (owner-confirmed) |
| SOL-022 | LLM nodes remain nondeterministic, and graphs can branch, retry, or stop on runtime state. | sol_feedback.md:71-72 | same subsection | Factual (owner-confirmed) |
| SOL-023 | What DarkPrint can promise is a reproducible and checkable workflow specification. | sol_feedback.md:74-75 | same subsection | Normative (owner-confirmed) |
| SOL-024 | The same pinned topology and card contracts can be resolved and analyzed again, even when two runs produce different outputs. | sol_feedback.md:75-76 | same subsection | Factual (owner-confirmed) |
| SOL-025 | Prefer reproducible, version-pinned, inspectable, and statically checked over a broad claim that the agent system itself is deterministic. | sol_feedback.md:76-77 | closes owner-confirmed section | Normative (owner-confirmed) |
| SOL-026 | The underlying product model is considerably stronger than the current first-visit story. | sol_feedback.md:81-82 | "Executive assessment" opens | Factual |
| SOL-027 | The engine, bundle format, immutability rules, typed boundaries, local execution model, and criteria-isolation example form a coherent thesis. | sol_feedback.md:82-84 | same paragraph | Factual |
| SOL-028 | DarkPrint is not merely a gallery of agent diagrams; it can become a trust and distribution layer for agent-workflow patterns. | sol_feedback.md:83-84 | same paragraph | Factual |
| SOL-029 | The website currently exposes too much of that model at once. | sol_feedback.md:86-87 | same section | Factual |
| SOL-030 | It often behaves as a complete reference manual before establishing a visitor's task. | sol_feedback.md:86-87 | continues prior sentence | Factual |
| SOL-031 | The same ideas are explained in the homepage, the conceptual introduction, three format pages, the authoring workspace, the blueprint detail template, the card detail template, the scoring page, and the ontology. | sol_feedback.md:87-89 | same paragraph | Factual |
| SOL-032 | Each explanation is individually careful, but their accumulation makes the product feel more complex than its actual core loop. | sol_feedback.md:90-91 | closes paragraph | Factual |
| SOL-033 | The highest-leverage change is therefore not a visual redesign. | sol_feedback.md:93 | transition sentence | Normative |
| SOL-034 | Lead with what people can find or make. | sol_feedback.md:95 | numbered hierarchy item 1 | Normative |
| SOL-035 | Let a blueprint detail page prove why the artifact can be trusted. | sol_feedback.md:96 | item 2 | Normative |
| SOL-036 | Move format education into contextual reference. | sol_feedback.md:97 | item 3 | Normative |
| SOL-037 | Model every target capability as a complete final-state workflow, even when fixtures currently stand behind it. | sol_feedback.md:98-99 | item 4 | Normative |
| SOL-038 | Keep the provenance of evidence explicit: computed, voted, reported, verified, or absent. | sol_feedback.md:100 | item 5 | Normative |
| SOL-039 | The mock should show the product as it is intended to behave at release. | sol_feedback.md:104 | "How target functionality should appear in the mock" | Normative |
| SOL-040 | It should not be a collection of "coming soon" notices. | sol_feedback.md:104-105 | same paragraph | Normative |
| SOL-041 | For every target capability, model at least: the successful state; an empty/new-user state; loading or processing where the operation is asynchronous; validation and service errors; permission and authentication boundaries; private, draft, published, superseded, and deleted states where applicable; partial evidence, such as too few runs or votes to compute a stable aggregate; the transition into and out of the workflow. | sol_feedback.md:105-114 | required-states checklist | Normative |
| SOL-042 | Fixture data should be realistic enough to exercise these states. | sol_feedback.md:116-117 | same section | Normative |
| SOL-043 | Labels such as `seeded` are useful while reviewing a public static prototype, but they are not a substitute for designing the final provenance model. | sol_feedback.md:117-118 | same section | Normative |
| SOL-044 | In the intended product, the interface should say `computed`, `community-rated`, `self-reported`, `verified run`, `insufficient sample`, or whatever the actual contract guarantees. | sol_feedback.md:118-120 | same section | Normative |
| SOL-045 | The same rule applies to navigation. MCP, publishing, and profiles should be promoted or demoted according to their importance in the final product, never merely because their backend has not been written yet. | sol_feedback.md:122-124 | closes section | Normative |
| SOL-046 | Several choices are important differentiators and should survive simplification. | sol_feedback.md:128 | opens "What should remain" | Normative |
| SOL-047 | The sentence "the registry publishes files, your machine runs them" is one of the clearest statements on the site. | sol_feedback.md:132-134 | "Keep the registry/local-machine boundary" | Factual |
| SOL-048 | It resolves questions about execution, provider keys, privacy, composition, and cost. | sol_feedback.md:133-134 | same subsection | Factual |
| SOL-049 | It should appear early and remain consistent. | sol_feedback.md:134 | same subsection | Normative |
| SOL-050 | The criteria-isolation example is the best proof of the product's value. | sol_feedback.md:138-140 | "Keep the absent-edge example" | Factual |
| SOL-051 | A missing `planner -> builder` edge, combined with the builder card's `cannot: [acceptance-criteria]`, demonstrates something a prompt collection cannot express. | sol_feedback.md:138-140 | same subsection | Factual |
| SOL-052 | It should remain the canonical worked example, but it only needs one full explanation. | sol_feedback.md:141 | same subsection | Normative |
| SOL-053 | The distinction is sound: a node is a position in a graph; a card is the reusable file pinned at that position. | sol_feedback.md:145-147 | "Keep cards versioned and reusable" | Factual |
| SOL-054 | The current navigation label `Cards` is clearer than `Nodes` for the registry shelf, even if the stable URL remains `/nodes`. | sol_feedback.md:146-147 | same subsection | Factual |
| SOL-055 | Human gates are legitimate design choices, not defects. | sol_feedback.md:151-152 | "Keep autonomy descriptive" | Normative |
| SOL-056 | Autonomy classes should remain filters and explanations, never rankings, progress bars, or rewards. | sol_feedback.md:151-152 | same subsection | Normative |
| SOL-057 | "Dark factory" should remain one classification of one graph shape, not the site's category or the summit of the product. | sol_feedback.md:152-154 | same subsection | Normative |
| SOL-058 | Diagnostics that name the node, rule, severity, and remediation are more valuable than a single score. | sol_feedback.md:158-159 | "Keep explainable validation" | Normative |
| SOL-059 | The resolved/error state and its explanation should be more prominent than aggregate grading. | sol_feedback.md:159-160 | same subsection | Normative |
| SOL-060 | The browser-side validator is a credible part of the target service. | sol_feedback.md:164-165 | "Keep honest local validation" | Factual |
| SOL-061 | It proves that a downloaded or agent-authored bundle can be checked without sending it to DarkPrint. | sol_feedback.md:164-166 | same subsection | Factual |
| SOL-062 | The publishing flow can then consume the validated artifact and its report as a separate, authenticated operation. | sol_feedback.md:166-167 | closes "What should remain" | Normative |
| SOL-063 | The homepage and metadata lead with "Autonomy you can read as a graph." | sol_feedback.md:173 | finding 1 | Factual |
| SOL-064 | The phrase is memorable, but it conflicts with the documented trajectory: blueprints are the product; autonomy is one property of a blueprint. | sol_feedback.md:173-174 | finding 1 | Factual |
| SOL-065 | It also narrows the audience to people pursuing full automation, despite the site's careful statement that human-gated graphs are first class. | sol_feedback.md:175-177 | finding 1 | Factual |
| SOL-066 | Recommendation: make the primary promise about reusable, inspectable agent workflows. | sol_feedback.md:179 | finding 1 | Normative |
| SOL-067 | Autonomy can remain a supporting line or a visual motif. | sol_feedback.md:180 | finding 1 | Normative |
| SOL-068 | Possible direction, not final copy: "Reusable blueprints for agent workflows. Inspect the graph, take the files, adapt them on your machine." | sol_feedback.md:182-185 | finding 1, explicitly disclaimed as non-final | Normative |
| SOL-069 | The current hero gives the MCP command first-viewport weight beside the authoring skill. | sol_feedback.md:187-189 | finding 1 | Factual |
| SOL-070 | That is justified only if direct agent retrieval and assisted creation are intended to be co-equal primary entry points at release. | sol_feedback.md:188-189 | finding 1 | Normative |
| SOL-071 | If MCP is the principal way repeat users discover blueprints, keep it and make the distinction explicit: the skill authors a blueprint; MCP searches and retrieves the registry. | sol_feedback.md:189-191 | finding 1 | Normative |
| SOL-072 | The problem is unclear roles, not implementation order. | sol_feedback.md:191 | closes finding 1 | Factual |
| SOL-073 | The homepage now contains an annotated DOT listing and an annotated YAML listing before the visitor reaches the product actions. | sol_feedback.md:195-196 | finding 2 | Factual |
| SOL-074 | This contradicts the repository's own useful distinction between a short conceptual onboarding and a deeper practical onboarding. | sol_feedback.md:196-197 | finding 2 | Factual |
| SOL-075 | The source listings are accurate and visually distinctive, but a cold visitor does not need five annotated DOT blocks and nine annotated card blocks to understand the offer. | sol_feedback.md:199-200 | finding 2 | Factual |
| SOL-076 | The page currently proves the file format before it proves why someone should browse or create a blueprint. | sol_feedback.md:201-202 | finding 2 | Factual |
| SOL-077 | Recommendation: retain the graph-to-file and node-to-card transformations as short visual moments, then link to the full annotated reference. | sol_feedback.md:204-205 | finding 2 | Normative |
| SOL-078 | The homepage should answer, in order: what is this, what can I get here, why is a graph better than a prompt collection, do I want to find one or create one. | sol_feedback.md:205-210 | finding 2 | Normative |
| SOL-079 | `/build` is titled "Design a blueprint", but its actual decisions are: one of four output types; tester or human approval; a retry cap. | sol_feedback.md:212-218 | finding 3 | Factual |
| SOL-080 | Those are useful teaching controls, but they do not design an arbitrary blueprint. | sol_feedback.md:220-221 | finding 3 | Factual |
| SOL-081 | The page then places the genuinely general creation tools near the bottom: the DarkPrint authoring skill and a reusable brief for any agent. | sol_feedback.md:221-222 | finding 3 | Factual |
| SOL-082 | This creates a scope mismatch. | sol_feedback.md:224-225 | finding 3 | Factual |
| SOL-083 | A visitor expects a general authoring tool and receives a starter configurator with a large reference workspace. | sol_feedback.md:224-225 | finding 3 | Factual |
| SOL-084 | Recommendation: choose one honest role for this route. | sol_feedback.md:227 | finding 3 | Normative |
| SOL-085 | Preferred: make it the creation entry point, start from the user's goal, then use the authoring skill or copyable agent brief to produce the graph and cards, and keep the starter as an optional worked example or sandbox. | sol_feedback.md:229-231 | finding 3, preferred option | Normative |
| SOL-086 | Lower-cost alternative: rename the page "Customize the starter blueprint" and make the general authoring skill the separate primary create route. | sol_feedback.md:232-233 | finding 3, fallback option | Normative |
| SOL-087 | Do not describe three starter parameters as the complete act of blueprint design. | sol_feedback.md:235 | closes finding 3 | Normative |
| SOL-088 | The detail template contains the core material a reuser needs, but it is surrounded by a field-by-field card encyclopedia, long analysis explanations, an annotated DOT walk, fixture-backed community notes, and repeated download interfaces. | sol_feedback.md:239-241 | finding 4 | Factual |
| SOL-089 | The primary question on this page is: should I trust and reuse this pattern for my task? | sol_feedback.md:243 | finding 4 | Factual |
| SOL-090 | The page should answer that question in order: what problem it solves and when it should not be used; the graph shape; inputs, outputs, requirements, human checkpoints, and tool reach; whether it resolves and what static analysis found; which exact version is being taken; how to use it. | sol_feedback.md:244-251 | finding 4 | Normative |
| SOL-091 | Raw DOT, every card field, score methodology, and full download manifest are supporting evidence. | sol_feedback.md:253-254 | finding 4 | Normative |
| SOL-092 | They should be available without becoming the main reading path. | sol_feedback.md:254 | finding 4 | Normative |
| SOL-093 | There should also be one canonical "Use this blueprint" area. | sol_feedback.md:256 | finding 4 | Normative |
| SOL-094 | The current header download, folder disclosure, individual files, and lower download panel repeat the same action and explanation. | sol_feedback.md:257-258 | closes finding 4 | Factual |
| SOL-095 | Downloads, votes, reputation, validator status, comments, forks, and several radar axes are important target-service components. | sol_feedback.md:262-263 | finding 5 | Normative |
| SOL-096 | They should remain in the mock. | sol_feedback.md:263 | finding 5 | Normative |
| SOL-097 | Their current presence, however, implies product rules that the repository has not yet fully settled: what counts as a download, who may vote, how votes are weighted, how reputation accrues, how validator status is earned or revoked, and how abuse is moderated. | sol_feedback.md:263-266 | finding 5 | Factual |
| SOL-098 | Because these figures determine sorting, fill charts, occupy profile summaries, and make some artifacts look more trusted than others, the mock must specify their semantics as carefully as it specifies card versioning. | sol_feedback.md:268-270 | finding 5 | Normative |
| SOL-099 | Keep fixture-backed counts, comments, reputation, validator marks, forks, and sorting in the mock when they are intended production features. | sol_feedback.md:274-275 | finding 5 recommendation | Normative |
| SOL-100 | Define the event and aggregation behind every number before treating the component as stable. | sol_feedback.md:276-277 | finding 5 recommendation | Normative |
| SOL-101 | Design default, empty, low-sample, mature, disputed, removed, and abuse-limited states. | sol_feedback.md:278 | finding 5 recommendation | Normative |
| SOL-102 | Decide which social signal, if any, may influence default discovery ranking. | sol_feedback.md:279-280 | finding 5 recommendation | Normative |
| SOL-103 | A popularity sort can remain, but it should be a deliberate product decision rather than a convenient use of fixture fields. | sol_feedback.md:280-281 | same recommendation | Normative |
| SOL-104 | On blueprint pages, separate structural evidence, run evidence, and community assessment. | sol_feedback.md:282-283 | finding 5 recommendation | Normative |
| SOL-105 | They can all be fully designed without pretending they share provenance. | sol_feedback.md:283 | same recommendation | Normative |
| SOL-106 | "No run evidence yet" is a required final-product state, not a reason to remove the full evidence component. | sol_feedback.md:284-285 | closes finding 5 | Normative |
| SOL-107 | Autonomy and security are computed from static structure. | sol_feedback.md:289 | finding 6 | Factual |
| SOL-108 | Efficacy, reliability, and transparency come from votes. | sol_feedback.md:289-291 | finding 6 | Factual |
| SOL-109 | Cost/time comes from reported or verified runs. | sol_feedback.md:291 | finding 6 | Factual |
| SOL-110 | Rescaling them onto one polygon gives them visual equivalence even though their provenance, units, and availability are different. | sol_feedback.md:291-292 | finding 6 | Factual |
| SOL-111 | Keep the full six-axis component if it is part of the intended service, but specify how each axis is produced and what the chart does when an axis has insufficient evidence. | sol_feedback.md:296-297 | finding 6 recommendation | Normative |
| SOL-112 | Make resolution status, diagnostics, autonomy class, human checkpoints, phase coverage, tool reach, and static risk findings the structural evidence layer. | sol_feedback.md:298-299 | finding 6 recommendation | Normative |
| SOL-113 | Make run evidence and community assessment distinct layers with visible provenance, sample size, uncertainty, and freshness. | sol_feedback.md:300-301 | finding 6 recommendation | Normative |
| SOL-114 | Design radar states for all axes present, one or more axes absent, low-confidence data, stale data, disputed data, and a change of ontology/scoring version. | sol_feedback.md:302-303 | finding 6 recommendation | Normative |
| SOL-115 | Do not plot a fixture value merely to close the polygon. | sol_feedback.md:304-305 | finding 6 recommendation | Normative |
| SOL-116 | An intentionally open or muted axis can communicate that the final service does not yet have enough evidence for a defensible value. | sol_feedback.md:305-306 | same recommendation | Normative |
| SOL-117 | Also reconsider the label `Security`. | sol_feedback.md:308 | finding 6 | Normative |
| SOL-118 | The current number is a static risk-marker reading, not a security audit. | sol_feedback.md:308-309 | finding 6 | Factual |
| SOL-119 | "Static risk exposure", "Declared risk", or similarly bounded wording would set a more accurate expectation. | sol_feedback.md:309-310 | closes finding 6 | Normative |
| SOL-120 | The Learn menu currently asks visitors to distinguish what a blueprint is, the DOT file, the YAML card, the vocabulary, blueprint design, blueprint grading, and the dark-factory maturity essay. | sol_feedback.md:314-322 | finding 7 | Factual |
| SOL-121 | This is a good documentation tree but an expensive product menu. | sol_feedback.md:324-325 | finding 7 | Factual |
| SOL-122 | The three file-format pages are details of one concept, not peer destinations in the main user journey. | sol_feedback.md:324-325 | finding 7 | Factual |
| SOL-123 | Recommendation: make the main navigation task-oriented and put the format pages under a single Docs or Reference entry. | sol_feedback.md:327-328 | closes finding 7 | Normative |
| SOL-124 | The exact labels can change, but the hierarchy should express tasks before implementation formats. | sol_feedback.md:332-333 | "Recommended information architecture" | Normative |
| SOL-125 | `Ontology` may remain globally visible if governance of the shared vocabulary is meant to be a daily community activity. | sol_feedback.md:367-368 | same section | Normative |
| SOL-126 | If it is mainly a schema reference, it belongs under Docs. | sol_feedback.md:368 | same section | Normative |
| SOL-127 | MCP can remain a top-level destination if agent-side discovery is a primary release workflow. | sol_feedback.md:369-370 | same section | Normative |
| SOL-128 | Its navigation position should be justified by that final importance, not by whether the server is currently implemented. | sol_feedback.md:370-371 | same section | Normative |
| SOL-129 | The page and label should make its distinct job clear: search and retrieve the registry from an agent, rather than author a new blueprint. | sol_feedback.md:371-373 | same section | Normative |
| SOL-130 | `Profile` represents the authenticated user menu rather than a permanent text link. | sol_feedback.md:375-376 | same section | Normative |
| SOL-131 | It should lead to drafts, private artifacts, published work, forks, validation/review activity, account settings, and organization/workspace switching if organizations are in scope. | sol_feedback.md:376-377 | same section | Normative |
| SOL-132 | The GitHub analogy supports this structure. | sol_feedback.md:379-380 | same section | Factual |
| SOL-133 | GitHub serves readers and authors, but its primary object remains the repository. | sol_feedback.md:380-382 | same section | Factual |
| SOL-134 | Creation, discovery, source inspection, history, and collaboration all orbit that object. | sol_feedback.md:381-382 | same section | Factual |
| SOL-135 | DarkPrint's primary object should similarly remain the blueprint rather than the documentation tree. | sol_feedback.md:381-382 | closes "Recommended information architecture" | Normative |
| SOL-136 | The site introduces many valid terms too early. | sol_feedback.md:386 | "Vocabulary simplification" | Factual |
| SOL-137 | Use a layered vocabulary. | sol_feedback.md:386 | same section | Normative |
| SOL-138 | Blueprint: a reusable pattern for an agent workflow. | sol_feedback.md:392 | "Product vocabulary" list | Normative |
| SOL-139 | Card: the versioned contract attached to one node. | sol_feedback.md:393 | "Product vocabulary" list | Normative |
| SOL-140 | Registry: where blueprints and cards are published. | sol_feedback.md:394 | "Product vocabulary" list | Normative |
| SOL-141 | Validate: check that the graph and cards agree. | sol_feedback.md:395 | "Product vocabulary" list | Normative |
| SOL-142 | Run: what the user's own harness does outside DarkPrint. | sol_feedback.md:396 | "Product vocabulary" list | Normative |
| SOL-143 | Introduce bundle, topology/DOT, ontology, port and data type, digest and semantic version, and harness/rubric/eval/guardrail when the visitor inspects source or authors a bundle. | sol_feedback.md:398-407 | "Reference vocabulary" list | Normative |
| SOL-144 | The current `/what-a-blueprint-is` begins clearly, then expands into bundle anatomy, blueprint/card/ontology, harness, rubric, eval, guardrails, static versus online constraints, and three constraint locations. | sol_feedback.md:409-412 | vocabulary section | Factual |
| SOL-145 | Those ideas are sound, but not all belong in the first conceptual explanation. | sol_feedback.md:411-412 | same section | Factual |
| SOL-146 | Use node for a place in a graph and card for the reusable file. | sol_feedback.md:416 | terminology rules | Normative |
| SOL-147 | Qualify DarkPrint authoring skill so it is not confused with a card's `skill` field. | sol_feedback.md:417 | terminology rules | Normative |
| SOL-148 | Use bundle only when the folder contents matter; otherwise say blueprint. | sol_feedback.md:418 | terminology rules | Normative |
| SOL-149 | Use dark factory only for the all-phases, unattended classification or the essay. | sol_feedback.md:419 | terminology rules | Normative |
| SOL-150 | Do not use deterministic without specifying that it describes the workflow specification or a particular tool node, not LLM output. | sol_feedback.md:420-421 | terminology rules | Normative |
| SOL-151 | Do not call reported values measurements unless DarkPrint can verify the run. | sol_feedback.md:422-423 | terminology rules | Normative |
| SOL-152 | Fixture provenance is a prototype concern; final provenance labels should describe the real production source. | sol_feedback.md:423-424 | closes terminology rules | Normative |
| SOL-153 | Current role: brand hero, graph-to-DOT walkthrough, node-to-YAML walkthrough, five lifecycle actions, and two registry doors. | sol_feedback.md:430-431 | `/` — Homepage | Factual |
| SOL-154 | The brand and graph visual language are distinctive. | sol_feedback.md:435 | `/` "What works" | Factual |
| SOL-155 | The local execution boundary is explicit. | sol_feedback.md:436 | `/` "What works" | Factual |
| SOL-156 | Browse and create are both present. | sol_feedback.md:437 | `/` "What works" | Factual |
| SOL-157 | The graph/card relationship is demonstrated rather than only defined. | sol_feedback.md:438 | `/` "What works" | Factual |
| SOL-158 | Replace the autonomy-first headline with a blueprint-first promise. | sol_feedback.md:442 | `/` "Simplify" | Normative |
| SOL-159 | Keep the MCP command in the first decision area only if direct agent discovery is a primary launch workflow; distinguish it clearly from the authoring skill. | sol_feedback.md:443-444 | `/` "Simplify" | Normative |
| SOL-160 | Shorten both source walkthroughs to one transformation moment each. | sol_feedback.md:445 | `/` "Simplify" | Normative |
| SOL-161 | Give full visual weight to the target actions that define the final product. | sol_feedback.md:446-447 | `/` "Simplify" | Normative |
| SOL-162 | Group them by job: find, create, use, validate, and publish. | sol_feedback.md:448 | `/` "Simplify" | Normative |
| SOL-163 | Do not group them by which backend happens to be implemented first. | sol_feedback.md:448-449 | `/` "Simplify" | Normative |
| SOL-164 | End with the two confirmed doors: find/reuse and create/publish. | sol_feedback.md:449 | closes `/` review | Normative |
| SOL-165 | Current role: searchable/filterable shelf with a featured starter and nine fixture blueprints. | sol_feedback.md:453-454 | `/blueprints` | Factual |
| SOL-166 | It is already shaped as a production result page rather than a decorative gallery. | sol_feedback.md:458 | `/blueprints` "What works" | Factual |
| SOL-167 | Goal-relevant facets such as phase and autonomy are descriptive rather than rankings. | sol_feedback.md:459 | `/blueprints` "What works" | Factual |
| SOL-168 | The starter is a sensible default entry. | sol_feedback.md:460 | `/blueprints` "What works" | Factual |
| SOL-169 | Make task/goal search the strongest control; names and tags alone will not scale to the intended registry. | sol_feedback.md:464-465 | `/blueprints` "Simplify and future-proof" | Normative |
| SOL-170 | Add facets around domain, inputs/outputs, tool requirements, human checkpoints, validation status, and risk markers only when they help selection. | sol_feedback.md:466-467 | same subsection | Normative |
| SOL-171 | Keep popularity sorts if they belong in the final service, but define what is counted, how manipulation is handled, and whether popularity may affect default ranking. | sol_feedback.md:468-469 | same subsection | Normative |
| SOL-172 | Cards should emphasize problem fit, graph shape, requirements, and evidence rather than social counters. | sol_feedback.md:470-471 | same subsection | Normative |
| SOL-173 | Avoid exposing every possible facet before the corpus needs it; progressive filters can preserve the community-scale structure without making nine results feel over-filtered. | sol_feedback.md:472-473 | closes `/blueprints` review | Normative |
| SOL-174 | Current role: artifact overview, interactive graph, selected card breakdown, six-axis scorecard, bundle facts, static analysis, source walk, community discussion, and downloads. | sol_feedback.md:477-478 | `/blueprints/[slug]` | Factual |
| SOL-175 | Recommended hierarchy: problem/fit/limitations; graph with selected-node contract; requirements and operational reach; validation and static findings; version/provenance/dependencies/usage; one primary use/download action; source and methodology as tabs; community evidence and discussion with zero/low-sample states. | sol_feedback.md:480-489 | `/blueprints/[slug]` | Normative |
| SOL-176 | Move the field-by-field card explanation to the card schema reference. | sol_feedback.md:491-492 | `/blueprints/[slug]` | Normative |
| SOL-177 | A blueprint page should show values specific to this blueprint, not repeatedly teach what `id`, `name`, `phase`, `author`, and `ontology_version` mean. | sol_feedback.md:492-493 | closes `/blueprints/[slug]` review | Normative |
| SOL-178 | Current role: a 53-card expert shelf grouped by node type and filterable by type and phase. | sol_feedback.md:497 | `/nodes` | Factual |
| SOL-179 | This is a real reusable dependency registry, not a decorative list. | sol_feedback.md:501 | `/nodes` "What works" | Factual |
| SOL-180 | `Cards` is the right visible label. | sol_feedback.md:502 | `/nodes` "What works" | Normative |
| SOL-181 | Grouping and filtering are appropriate at this density. | sol_feedback.md:503 | `/nodes` "What works" | Factual |
| SOL-182 | Add search by job/capability, input, output, and prohibition as the library grows. | sol_feedback.md:507 | `/nodes` "Simplify" | Normative |
| SOL-183 | Reduce each tile to job, interface summary, important reach/risk, current version, and usage count. | sol_feedback.md:508-509 | `/nodes` "Simplify" | Normative |
| SOL-184 | Keep author and phase secondary to what the card can be reused for. | sol_feedback.md:510 | `/nodes` "Simplify" | Normative |
| SOL-185 | Consider whether Cards stays top-level after blueprint search can return reusable cards contextually. | sol_feedback.md:511-512 | `/nodes` "Simplify" | Normative |
| SOL-186 | It is valuable for expert users, but not necessarily a first-visit door. | sol_feedback.md:512 | closes `/nodes` review | Factual |
| SOL-187 | Current role: contract overview, full specification, interfaces, prohibitions, every field explained, author notes, version history, raw source, risk/autonomy, identity, and mock community notes. | sol_feedback.md:516-518 | `/nodes/[...id]` | Factual |
| SOL-188 | Recommended hierarchy: what the card does; inputs/outputs/dependencies/reach/prohibitions; specification handed to the agent; blueprints that pin it; version history and provenance; raw YAML. | sol_feedback.md:520-527 | `/nodes/[...id]` | Normative |
| SOL-189 | The "Every field on this card" section repeats a schema manual across every card page and accounts for much of the template's reading load. | sol_feedback.md:529-531 | `/nodes/[...id]` | Factual |
| SOL-190 | Show the values here and link each field group to `/spec/card` for definitions. | sol_feedback.md:530-531 | `/nodes/[...id]` | Normative |
| SOL-191 | Do not repeat the action/spec/notes in multiple forms on one page. | sol_feedback.md:531-532 | closes `/nodes/[...id]` review | Normative |
| SOL-192 | Current role: explains five term kinds, lists all terms and weights, and describes core, local, and promotion layers. | sol_feedback.md:536-537 | `/ontology` | Factual |
| SOL-193 | The ontology is a real part of the product, not invented navigation. | sol_feedback.md:541 | `/ontology` "What works" | Factual |
| SOL-194 | The five kinds and their connection to card fields are made explicit. | sol_feedback.md:542-543 | `/ontology` "What works" | Factual |
| SOL-195 | Local namespaces versus the curated core is an important governance model for the target service. | sol_feedback.md:543-544 | `/ontology` "What works" | Factual |
| SOL-196 | Make the index a searchable reference table/tree first. | sol_feedback.md:548 | `/ontology` "Simplify" | Normative |
| SOL-197 | Put the long rationale for phases, roots, weights, lattices, and governance in short contextual introductions or linked documentation. | sol_feedback.md:549-550 | `/ontology` "Simplify" | Normative |
| SOL-198 | Keep the complete promotion workflow in the mock, specifying proposal, eligibility, discussion, validator review, acceptance, rejection, conflicts, deprecation, and the equivalence pointer left behind after promotion. | sol_feedback.md:551-553 | `/ontology` "Simplify" | Normative |
| SOL-199 | Reconcile the displayed core/local counts consistently. | sol_feedback.md:554-555 | `/ontology` "Simplify" | Normative |
| SOL-200 | A local risk marker must not make the curated core appear to have a different size on different pages. | sol_feedback.md:555-556 | closes `/ontology` review | Normative |
| SOL-201 | Current role: definition, hierarchy, weight where relevant, registry usage, facts, and adoption. | sol_feedback.md:559-560 | `/ontology/[...term]` | Factual |
| SOL-202 | The compact term pages are generally well scoped. | sol_feedback.md:562-563 | `/ontology/[...term]` | Factual |
| SOL-203 | Keep adoption as a target-service component, but replace repeated explanatory prose with an actual state component: not eligible, approaching threshold, eligible for review, in review, accepted, rejected, superseded, or deprecated. | sol_feedback.md:563-566 | `/ontology/[...term]` | Normative |
| SOL-204 | Usage in real blueprints/cards is the strongest input and should remain prominent. | sol_feedback.md:565-566 | closes `/ontology/[...term]` review | Normative |
| SOL-205 | Current role: a five-tab technical workspace over one starter, three choices, one bundle download, the authoring skill, and a generic agent brief. | sol_feedback.md:570-571 | `/build` | Factual |
| SOL-206 | The page contains three different products: a teaching sandbox; a starter configurator; a general blueprint authoring handoff. | sol_feedback.md:573-577 | `/build` | Factual |
| SOL-207 | They should not compete in one continuous page. | sol_feedback.md:579 | `/build` | Normative |
| SOL-208 | Make general creation the entry, then offer the starter as an example. | sol_feedback.md:579-581 | `/build` | Normative |
| SOL-209 | The graph, DOT, card, vocabulary, and score views are valuable in the sandbox, but they are not prerequisites to choosing a goal. | sol_feedback.md:580-581 | `/build` | Normative |
| SOL-210 | The authoring skill is the clearest general creation flow represented in the mock. | sol_feedback.md:583-584 | `/build` | Factual |
| SOL-211 | If that is the intended production method, promote it from the lower exit to the principal path for someone creating a real blueprint. | sol_feedback.md:584-585 | closes `/build` review | Normative |
| SOL-212 | Current role: four-step upload wizard that validates locally and is intended to finish by publishing to the registry. | sol_feedback.md:589-591 | `/upload` | Factual |
| SOL-213 | Keep Upload blueprint if validation followed by publication is the final workflow. | sol_feedback.md:592 | `/upload` | Normative |
| SOL-214 | The mock should make the boundary explicit: selecting and validating files happens in the tab; only the confirmed publish action sends the validated bundle to DarkPrint. | sol_feedback.md:593-595 | `/upload` | Normative |
| SOL-215 | That distinction is stronger than renaming the whole route to validation and removing its intended outcome. | sol_feedback.md:595 | `/upload` | Factual |
| SOL-216 | Recommended flow: choose/drop bundle; resolve and show diagnostics; preview computed structure and evidence; resolve publication blockers and metadata; sign in or choose the publishing identity; choose visibility/license/version/provenance/release notes; publish, then land on the immutable release page. | sol_feedback.md:597-605 | `/upload` | Normative |
| SOL-217 | The mock should include publication success, validation failure, version conflict, unauthorized, private draft, duplicate digest, superseding release, and interrupted upload states. | sol_feedback.md:607-609 | `/upload` | Normative |
| SOL-218 | It should also decide whether card-only and ontology-extension publication are part of this route, their own flows, or explicitly outside the release scope. | sol_feedback.md:609-611 | `/upload` | Normative |
| SOL-219 | Do not leave them as ambiguous disabled content types in the final mock. | sol_feedback.md:610-611 | closes `/upload` review | Normative |
| SOL-220 | Current role: blueprint definition, bundle anatomy, graph/card/ontology, harness, rubric, eval, guardrails, static/runtime distinctions, and reference-page doors. | sol_feedback.md:615-616 | `/what-a-blueprint-is` | Factual |
| SOL-221 | Keep this route, but reduce it to the product's minimum conceptual model: a blueprint is a reusable pattern as a graph; each node pins a versioned card; the ontology lets the files agree and be checked; DarkPrint distributes and validates while the user's harness runs; one absent edge demonstrates why topology matters. | sol_feedback.md:618-624 | `/what-a-blueprint-is` | Normative |
| SOL-222 | Move eval/rubric/guardrail theory into an execution or evaluation guide. | sol_feedback.md:626-627 | `/what-a-blueprint-is` | Normative |
| SOL-223 | A visitor should not need those concepts to browse and reuse a blueprint. | sol_feedback.md:627 | closes `/what-a-blueprint-is` review | Normative |
| SOL-224 | These are documentation pages and should behave like a reference set rather than a primary onboarding sequence. | sol_feedback.md:631-632 | `/spec/topology`, `/spec/card`, `/spec/ontology` | Normative |
| SOL-225 | Keep the pager and contextual cross-links. | sol_feedback.md:634 | same section | Normative |
| SOL-226 | Remove them as individual main-menu choices. | sol_feedback.md:635 | same section | Normative |
| SOL-227 | Let examples be opened from real blueprint/card detail pages. | sol_feedback.md:636 | same section | Normative |
| SOL-228 | On `/spec/card`, reduce the 1,800-word open explanation by defining each field once in a compact schema table, with longer rationale only where a rule is non-obvious. | sol_feedback.md:637-638 | same section — specific word-count claim | Normative/Factual |
| SOL-229 | Avoid re-explaining the absent edge in prose after the diagram and diagnostic already demonstrate it. | sol_feedback.md:639-640 | closes spec pages review | Normative |
| SOL-230 | Current role: explains the radar, provenance badges, computed and fixture-backed axes, weights, autonomy bands, similarity threshold, and telemetry filters. | sol_feedback.md:644-645 | `/reading-the-radar` | Factual |
| SOL-231 | Reframe as "How DarkPrint analyzes a blueprint". | sol_feedback.md:647 | `/reading-the-radar` | Normative |
| SOL-232 | Lead with resolution and diagnostics, then static readings, community assessments, and run evidence as three separate provenance layers. | sol_feedback.md:647-648 | `/reading-the-radar` | Normative |
| SOL-233 | Keep all six target axes, but define ballot eligibility, vote weighting, minimum sample, run verification, aggregation, freshness, and missing-data behavior. | sol_feedback.md:649 | `/reading-the-radar` | Normative |
| SOL-234 | The page should explain the final model, not implementation status or placeholder arithmetic. | sol_feedback.md:650-651 | closes `/reading-the-radar` review | Normative |
| SOL-235 | Current role: defines the dark-factory special case and presents an organizational maturity ladder. | sol_feedback.md:655-656 | `/towards-a-dark-factory` | Factual |
| SOL-236 | The page is coherent after its recent reduction, but it is not part of the core find/create loop. | sol_feedback.md:658 | `/towards-a-dark-factory` | Factual |
| SOL-237 | Keep it as a guide or essay and link it contextually from autonomy classifications. | sol_feedback.md:659 | `/towards-a-dark-factory` | Normative |
| SOL-238 | It should not occupy the same navigation level as creating, validating, or browsing artifacts. | sol_feedback.md:659-660 | closes `/towards-a-dark-factory` review | Normative |
| SOL-239 | Current role: working install and interview instructions, output explanation, validation handoff, accounts/publishing, and registry-assisted authoring. | sol_feedback.md:664-665 | `/skill` | Factual |
| SOL-240 | This is the clearest current creator journey and should live under Create, not under the generic category Set up. | sol_feedback.md:667-668 | `/skill` | Normative |
| SOL-241 | The first three sections form a complete loop: install, answer design questions, validate the generated bundle. | sol_feedback.md:668-672 | `/skill` | Factual |
| SOL-242 | Keep account-backed publishing and registry-assisted authoring in the mock as complete next steps. | sol_feedback.md:674-675 | `/skill` | Normative |
| SOL-243 | Turn them from explanatory "not built" blocks into target interactions: sign in, choose or create a workspace, search suggested cards/blueprints through MCP, accept or reject the suggestions, validate the generated bundle, choose visibility, and publish. | sol_feedback.md:675-679 | `/skill` | Normative |
| SOL-244 | The skill page should still prioritize the linear authoring task over lengthy explanations of every supporting service. | sol_feedback.md:678-679 | closes `/skill` review | Normative |
| SOL-245 | Current role: semantic retrieval explanation and client setup for the agent-facing registry. | sol_feedback.md:683 | `/mcp` | Factual |
| SOL-246 | Keep the route and its global prominence if MCP is a principal release workflow. | sol_feedback.md:685 | `/mcp` | Normative |
| SOL-247 | Replace the preview framing in the final mock with the complete connection and use journey: client selection, authentication, scopes, installation, connection test, example search, result inspection, exact-version fetch, disconnect, and error recovery. | sol_feedback.md:685-690 | `/mcp` | Normative |
| SOL-248 | Specify what semantic ranking returns, how private artifacts are excluded or authorized, and how provenance and versions are carried into agent context. | sol_feedback.md:688-690 | `/mcp` | Normative |
| SOL-249 | The current conceptual depth is still high for setup. | sol_feedback.md:692-693 | `/mcp` | Factual |
| SOL-250 | Put the command and connection test first; place retrieval internals and client-specific details after the first successful connection. | sol_feedback.md:693-694 | closes `/mcp` review | Normative |
| SOL-251 | Current role: authored blueprints/cards plus fixture-backed reputation, downloads, validator status, and forks. | sol_feedback.md:698-699 | `/u/[username]` | Factual |
| SOL-252 | Profiles are structurally important for the GitHub-like two-sided product. | sol_feedback.md:701 | `/u/[username]` | Factual |
| SOL-253 | Keep both archive facts and target community signals: published blueprints; published cards; versions and contributions; provenance/ownership; forks and lineage; validator status and review history; reputation with its contributing events visible; public activity and private workspaces subject to permissions. | sol_feedback.md:701-711 | `/u/[username]` | Normative |
| SOL-254 | The mock should define how each signal is earned and provide traceable detail rather than a single unexplained reputation total. | sol_feedback.md:713-714 | `/u/[username]` | Normative |
| SOL-255 | Include new-user, active author, validator, suspended, private-only, and organization/team profiles if those are release roles. | sol_feedback.md:714-715 | closes `/u/[username]` review, closes page-by-page section | Normative |
| SOL-256 | The same concepts currently recur across multiple routes. | sol_feedback.md:719 | "Cross-page duplication to remove" | Factual |
| SOL-257 | Assign each one a canonical home. | sol_feedback.md:719 | same section | Normative |
| SOL-258 | The rule should be: teach once, demonstrate where relevant, link for the full definition. | sol_feedback.md:734 | closes the canonical-home table | Normative |
| SOL-259 | For the confirmed two-sided model, the blueprint detail page should become the strongest surface. | sol_feedback.md:738-739 | "The blueprint detail page as the product center" | Normative |
| SOL-260 | It is where a finder decides to reuse, an author sees what they published, a future reviewer leaves evidence, and an agent-facing integration resolves a specific version. | sol_feedback.md:739-740 | same section | Factual |
| SOL-261 | A stable mock should prove these states: clean valid; with warnings; invalid/unpublishable; human-gated; using a local ontology extension; with a superseded card version; with no community/run evidence; with mature community/run evidence; with low-sample or disputed evidence; private/draft; fork with visible lineage; release awaiting moderation or validator review. | sol_feedback.md:742-755 | same section | Normative |
| SOL-262 | Designing these states is more valuable than filling every current page only with mature, successful social numbers. | sol_feedback.md:757-758 | same section | Normative |
| SOL-263 | Fixture data should cover the whole lifecycle. | sol_feedback.md:758 | closes section | Normative |
| SOL-264 | The mock should not be called stable until these decisions have explicit answers. | sol_feedback.md:762 | "Product questions to settle before implementation" | Normative |
| SOL-265 | What is publishable? Does a warning block publication, or only an error? | sol_feedback.md:764 | question 1 | Normative |
| SOL-266 | What is fork identity? Is a locally adapted blueprint a fork with lineage, or simply a new blueprint with provenance? | sol_feedback.md:765-766 | question 2 | Normative |
| SOL-267 | What is a version of a blueprint? The cards have semver rules; the blueprint itself also needs immutable releases and a visible current version. | sol_feedback.md:767-768 | question 3 | Normative/Factual |
| SOL-268 | What can be private? Draft blueprints, cards, local ontology terms, and validation results may need different visibility rules. | sol_feedback.md:769-770 | question 4 | Normative |
| SOL-269 | What earns trust? Validity, author identity, usage, reviews, verified runs, and maintainer status must not collapse into one reputation number. | sol_feedback.md:771-772 | question 5 | Normative |
| SOL-270 | How is run evidence normalized? Cost and time are not comparable without model, provider, hardware, input size, harness version, and sample size. | sol_feedback.md:773-774 | question 6 | Normative/Factual |
| SOL-271 | Who can change the ontology? Promotion thresholds alone do not define review, conflicts, deprecation, or ownership. | sol_feedback.md:775-776 | question 7 | Factual |
| SOL-272 | What does MCP return? Exact releases, cards, excerpts, rankings, and provenance need a stable retrieval contract. | sol_feedback.md:777-778 | question 8 | Normative |
| SOL-273 | What licenses apply? Reusable prompts/specifications and generated bundles need a clear license model before community publishing. | sol_feedback.md:779-780 | question 9 | Normative |
| SOL-274 | What prevents malicious bundles? DarkPrint does not run them, but it distributes instructions and tool scopes that another agent may execute. | sol_feedback.md:781-783 | question 10 | Factual |
| SOL-275 | Static checks, warnings, moderation, and provenance need an explicit boundary. | sol_feedback.md:783 | question 10, continued | Normative |
| SOL-276 | Which account roles exist? Author, organization owner, maintainer, validator, moderator, and ordinary runner need explicit permissions and transitions. | sol_feedback.md:784-785 | question 11 | Normative |
| SOL-277 | What is a download or use event? Browser download, MCP fetch, clone, fork, and run are different signals and should not be collapsed accidentally. | sol_feedback.md:786-787 | question 12 | Normative |
| SOL-278 | How does discovery rank results? Text relevance, semantic similarity, validation, usage, reputation, freshness, and personalization need a transparent ordering contract for both website search and MCP retrieval. | sol_feedback.md:788-790 | question 13 | Normative |
| SOL-279 | What is the moderation lifecycle? Reports, hidden artifacts, appeals, suspended accounts, malicious instructions, and disputed community evidence need mock states. | sol_feedback.md:791-792 | question 14 | Normative |
| SOL-280 | What can be deleted? Immutable published releases, private drafts, comments, run reports, and personal data have different retention and erasure requirements. | sol_feedback.md:793-794 | question 15, closes section | Normative |
| SOL-281 | Make blueprints the headline product. | sol_feedback.md:800 | "Recommended stabilization order", Phase 1 | Normative |
| SOL-282 | Document the reproducible-specification claim. | sol_feedback.md:801 | Phase 1 | Normative |
| SOL-283 | Establish the public vocabulary: Blueprint, Card, Registry, Validate, Run. | sol_feedback.md:802 | Phase 1 | Normative |
| SOL-284 | Decide the stable label for static risk analysis. | sol_feedback.md:803 | Phase 1 | Normative |
| SOL-285 | Finder: search -> detail -> use -> local adaptation -> validate. | sol_feedback.md:807 | Phase 2 | Normative |
| SOL-286 | Creator: create/skill -> local files -> validate -> publish. | sol_feedback.md:808 | Phase 2 | Normative |
| SOL-287 | Ensure every primary CTA advances one of those loops. | sol_feedback.md:809 | Phase 2 | Normative |
| SOL-288 | Mock the complete target interaction for every primary CTA, including success and failure states, even when the current implementation is fixture-backed. | sol_feedback.md:810-811 | Phase 2 | Normative |
| SOL-289 | Task-oriented global navigation. | sol_feedback.md:815 | Phase 3 | Normative |
| SOL-290 | Format pages grouped under Docs/Reference. | sol_feedback.md:816 | Phase 3 | Normative |
| SOL-291 | MCP placed according to its intended launch importance, with a complete setup and retrieval flow. | sol_feedback.md:817-818 | Phase 3 | Normative |
| SOL-292 | Dark-factory material under Guides. | sol_feedback.md:819 | Phase 3 | Normative |
| SOL-293 | Blueprint detail centered on fit, graph, requirements, findings, version, and use. | sol_feedback.md:823 | Phase 4 | Normative |
| SOL-294 | Card detail centered on contract, reuse, versions, and source. | sol_feedback.md:824 | Phase 4 | Normative |
| SOL-295 | Move repeated schema education to reference pages. | sol_feedback.md:825 | Phase 4 | Normative |
| SOL-296 | Separate computed, reported, verified-run, community-rated, and unavailable data structurally. | sol_feedback.md:829-830 | Phase 5 | Normative |
| SOL-297 | Define how downloads, votes, reputation, validator status, comments, and forks are created, aggregated, moderated, and displayed. | sol_feedback.md:831-832 | Phase 5 | Normative |
| SOL-298 | Use fixture data to exercise the final sorting and trust decisions after those rules are defined. | sol_feedback.md:833-834 | Phase 5 | Normative |
| SOL-299 | Define empty, low-sample, loading, invalid, warning, unpublished, private, moderated, disputed, and superseded states. | sol_feedback.md:835-836 | Phase 5 | Normative |
| SOL-300 | Test the two complete loops at desktop and mobile widths. | sol_feedback.md:840 | Phase 6 | Normative |
| SOL-301 | Check navigation comprehension with a cold technical user. | sol_feedback.md:841 | Phase 6 | Normative |
| SOL-302 | Measure time to answer: what is this, where does it run, how do I find one, how do I make one, and why should I trust one. | sol_feedback.md:842-843 | Phase 6 | Normative |
| SOL-303 | Verify that every target action has a complete mocked destination and state transition; no primary CTA should terminate in explanatory copy. | sol_feedback.md:844-845 | Phase 6 | Normative |
| SOL-304 | Verify that a user can evaluate and take a blueprint without reading the reference manual. | sol_feedback.md:846 | closes Phase 6 | Normative |
| SOL-305 | A technical visitor with no prior explanation should be able to answer these questions after three to five minutes. | sol_feedback.md:850-851 | "Suggested success test for the stable mock" | Normative |
| SOL-306 | A blueprint is a reusable, versioned specification of an agent workflow. | sol_feedback.md:853 | success-test item 1 | Factual |
| SOL-307 | DarkPrint stores and checks it; my own tools run it. | sol_feedback.md:854 | success-test item 2 | Factual |
| SOL-308 | The graph controls handoffs and isolation, while cards define nodes. | sol_feedback.md:855 | success-test item 3 | Factual |
| SOL-309 | I can search for an existing blueprint or create one with my agent. | sol_feedback.md:856 | success-test item 4 | Factual |
| SOL-310 | I can inspect the exact files and static findings before using it. | sol_feedback.md:857 | success-test item 5 | Factual |
| SOL-311 | A human checkpoint is a valid design choice, not a lower-quality blueprint. | sol_feedback.md:858 | success-test item 6 | Normative |
| SOL-312 | I can publish through the designed account flow and retrieve registry artifacts through the designed MCP flow. | sol_feedback.md:859-860 | success-test item 7 | Factual |
| SOL-313 | If the visitor instead remembers DOT syntax, six radar axes, ontology promotion thresholds, and the dark-factory maturity ladder but cannot explain how to find or create a useful blueprint, the hierarchy is still inverted. | sol_feedback.md:862-864 | closes success-test section | Factual |
| SOL-314 | DarkPrint's strongest trajectory is a GitHub-like registry for reusable agent-workflow specifications, with both a human discovery interface and an agent discovery interface. | sol_feedback.md:868-869 | "Bottom line" | Factual |
| SOL-315 | Its moat is the checkable structure around the instructions: typed handoffs, explicit isolation, versioned contracts, provenance, and explainable diagnostics. | sol_feedback.md:870-871 | "Bottom line" | Factual |
| SOL-316 | The mock already contains almost every concept the production service may need. | sol_feedback.md:873 | "Bottom line" | Factual |
| SOL-317 | Stability now requires turning each intended capability into a defined workflow with real semantics, representative states, and a justified place in the hierarchy. | sol_feedback.md:873-875 | "Bottom line" | Normative |
| SOL-318 | Simplification should remove duplicate teaching and unclear roles, not remove target features merely because their implementation comes later. | sol_feedback.md:875-877 | closes document | Normative |
| PCL-001 | "REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task." | docs/superpowers/plans/2026-07-29-content-cli.md:3 | blockquote note to agentic workers | Normative |
| PCL-002 | "Ship the landing's usage-framing copy tweaks, a coming-soon CLI callout, a new `/install` page, and live "dark factory" classification on `/build`." | docs/superpowers/plans/2026-07-29-content-cli.md:5-6 | **Goal:** line | Normative |
| PCL-003 | "Task 4 depends on `components/ui/AutonomyBar.tsx` from the visual-polish plan... that task must be merged before Task 4 of this plan starts." | docs/superpowers/plans/2026-07-29-content-cli.md:9-11 | Architecture section | Normative |
| PCL-004 | "Doc 2 §0.4 — nothing may be described as working that is not built." | docs/superpowers/plans/2026-07-29-content-cli.md:20 | Global Constraints | Normative |
| PCL-005 | "No real MCP server or CLI package is being built in this plan." | docs/superpowers/plans/2026-07-29-content-cli.md:24 | Global Constraints | Factual |
| PCL-006 | "no beat's static markup may contain the literal string `"opacity-0"`." | docs/superpowers/plans/2026-07-29-content-cli.md:30-31 | Global Constraints, describing beats.test.ts | Factual |
| PCL-007 | "`components/site/nav.test.ts` requires every top-level route under `app/` to have a header nav entry (with narrow, justified exceptions)." | docs/superpowers/plans/2026-07-29-content-cli.md:33-34 | Global Constraints | Factual |
| PCL-008 | "`npm test`, `npm run typecheck`, and `npm run build` must pass after every task." | docs/superpowers/plans/2026-07-29-content-cli.md:37 | Global Constraints | Normative |
| PCL-009 | "A small, plain "not live yet" marker — amber, never the alarm/signal color, since this states a timeline fact and not a defect." | docs/superpowers/plans/2026-07-29-content-cli.md:175-177 | ComingSoonBadge doc comment (code block) | Normative |
| PCL-010 | "An MCP server for the registry is not built yet." | docs/superpowers/plans/2026-07-29-content-cli.md:250 | SectionDoors CLI callout copy (code block) | Factual |
| PCL-011 | "Task 1 covers content-cli-design.md §1 (landing usage framing)." | docs/superpowers/plans/2026-07-29-content-cli.md:756 | Self-Review, spec coverage | Factual |
| PCL-012 | "No TBD/TODO." | docs/superpowers/plans/2026-07-29-content-cli.md:762 | Self-Review, placeholder scan | Factual |
| PCL-013 | "`AutonomyBar`'s `{ level, label }` prop shape... is used identically here in Task 4 against `AutonomyResult`." | docs/superpowers/plans/2026-07-29-content-cli.md:767-769 | Self-Review, type consistency | Factual |
| PCL-014 | "Tasks 1-3 have no dependency on the visual-polish plan and can be executed in parallel with it or before it." | docs/superpowers/plans/2026-07-29-content-cli.md:773-774 | Self-Review, task ordering | Normative |
| PVP-001 | "REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task." | docs/superpowers/plans/2026-07-29-visual-polish.md:3 | blockquote note to agentic workers | Normative |
| PVP-002 | "Ship four visual changes — a segmented autonomy gauge on blueprint cards, a full-card cyanotype grid, a site-wide monospace font swap, and a "wiring draw" entrance for the hero wordmark." | docs/superpowers/plans/2026-07-29-visual-polish.md:5-7 | **Goal:** line | Normative |
| PVP-003 | "**No autonomy ordinal on any user-facing surface** is the project's own stated rule (`PROJECT.md:36`, doc 2 §1.1) — Task 2 of this plan is a **deliberate, documented exception** to it, not a violation to hide." | docs/superpowers/plans/2026-07-29-visual-polish.md:21-23 | Global Constraints | Normative |
| PVP-004 | "The alarm/signal color (`--color-signal` / `text-signal`) must never render near the human-presence glyph (`⏸`)." | docs/superpowers/plans/2026-07-29-visual-polish.md:26-27 | Global Constraints | Normative |
| PVP-005 | "SSR / no-JS / `prefers-reduced-motion: reduce` readers always get the finished, static page with zero animation runtime." | docs/superpowers/plans/2026-07-29-visual-polish.md:30-31 | Global Constraints | Factual |
| PVP-006 | "`label-boxes.ts:60-69` documents that the constant `0.62` was derived from **Geist Mono specifically**." | docs/superpowers/plans/2026-07-29-visual-polish.md:51-52 | "Why ADVANCE is part of this task" | Factual |
| PVP-007 | "If the computed value **exceeds 0.62**, raise `ADVANCE` to that new measurement plus the same proportional margin the original derivation used." | docs/superpowers/plans/2026-07-29-visual-polish.md:163-164 | Task 1 Step 3 | Normative |
| PVP-008 | "The segmented autonomy gauge — a deliberate, documented exception to "no autonomy ordinal on any user-facing surface" (PROJECT.md, doc 2 §1.1)." | docs/superpowers/plans/2026-07-29-visual-polish.md:297-299 | AutonomyBar.tsx module comment (code block) | Normative |
| PVP-009 | "One color per level, fixed — segment N is always this color when filled, regardless of which level the blueprint actually reached." | docs/superpowers/plans/2026-07-29-visual-polish.md:309-310 | AutonomyBar.tsx doc comment | Factual |
| PVP-010 | "no autonomy ordinal on any user-facing surface — the class name is what a reader sees, **except** the segmented gauge on the top edge of a blueprint card and the `/build` score panel." | docs/superpowers/plans/2026-07-29-visual-polish.md:527-529 | Task 4 Step 1, proposed PROJECT.md edit | Normative |
| PVP-011 | "Task 2+3+4 cover visual-polish-design.md §1 (segment bar + reversal documentation)." | docs/superpowers/plans/2026-07-29-visual-polish.md:1072-1073 | Self-Review, spec coverage | Factual |
| PVP-012 | "No TBD/TODO." | docs/superpowers/plans/2026-07-29-visual-polish.md:1078 | Self-Review, placeholder scan | Factual |
| PVP-013 | "`AutonomyBar`'s `{ level, label }` props (Task 2) are used identically in Task 3." | docs/superpowers/plans/2026-07-29-visual-polish.md:1083-1084 | Self-Review, type consistency | Factual |
| PBW-001 | "REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task." | docs/superpowers/plans/2026-08-06-build-workspace.md:3 | blockquote note to agentic workers | Normative |
| PBW-002 | "Replace `/build`'s eight-step guided path with a single workspace — one large graph, three simultaneous controls, and two co-equal exits — without changing a single byte of the bundle any set of choices produces." | docs/superpowers/plans/2026-08-06-build-workspace.md:5 | **Goal:** line | Normative |
| PBW-003 | "The model layer (`lib/starter/*`, `components/build/state.ts`, `components/build/choices.ts`) is untouched; only presentation changes." | docs/superpowers/plans/2026-08-06-build-workspace.md:7 | Architecture | Factual |
| PBW-004 | "**The bundle must not change.** For any `StarterChoices`, the produced bundle must be byte-identical before and after this work." | docs/superpowers/plans/2026-08-06-build-workspace.md:13 | Global Constraints | Normative |
| PBW-005 | "**All 80 combinations must resolve.** `app/build/page.tsx` walks `ALL_COMBINATIONS` through `loadBundle` at build time and one error-severity diagnostic fails the build." | docs/superpowers/plans/2026-08-06-build-workspace.md:14 | Global Constraints | Factual |
| PBW-006 | "**SSG only.** `dynamicParams = false`, no server-side data fetching at request time." | docs/superpowers/plans/2026-08-06-build-workspace.md:15 | Global Constraints | Normative |
| PBW-007 | "Read `node_modules/next/dist/docs/` before touching the route file or config — this Next.js has real breaking changes." | docs/superpowers/plans/2026-08-06-build-workspace.md:15 | Global Constraints | Normative |
| PBW-008 | "**Canonical scale.** Spacing tiers 8/12/16/20/40/64/80-112 (banned: 48, 56, 32, 96)." | docs/superpowers/plans/2026-08-06-build-workspace.md:17 | Global Constraints | Normative |
| PBW-009 | "**Semantic colours.** cyan = interactive, violet = where a person acts, emerald = a figure read off the engine, signal = a defect, amber = **not built yet** (only `ComingSoonBadge` and `.route-box`)." | docs/superpowers/plans/2026-08-06-build-workspace.md:18 | Global Constraints | Normative |
| PBW-010 | "**Never run prettier.** This repo has no prettier config; it reflows to 80 columns and produces a spurious diff." | docs/superpowers/plans/2026-08-06-build-workspace.md:21 | Global Constraints | Normative |
| PBW-011 | "**Do not weaken guards.** Never delete or loosen an assertion about accessibility, contrast, label overlap, or an honesty disclaimer." | docs/superpowers/plans/2026-08-06-build-workspace.md:22 | Global Constraints | Normative |
| PBW-012 | "A snapshot test that cannot fail is not a safety net." | docs/superpowers/plans/2026-08-06-build-workspace.md:104 | Task 1 Step 4 | Normative |
| PBW-013 | "If the artefacts genuinely do not differ, that is a finding about the spec's claim and must be reported, not papered over." | docs/superpowers/plans/2026-08-06-build-workspace.md:227 | Task 2 Step 4 | Normative |
| PBW-014 | "amber has exactly two reserved jobs and "changed" is neither." | docs/superpowers/plans/2026-08-06-build-workspace.md:252 | Task 3 Step 1 | Normative |
| PBW-015 | "This is the defect in spec §1.4 and the highest-risk task in the plan: real geometry, not a container swap." | docs/superpowers/plans/2026-08-06-build-workspace.md:288 | Task 4 header | Factual |
| PBW-016 | "That file is named in `architecture/website.md` as the highest-value guard on the site." | docs/superpowers/plans/2026-08-06-build-workspace.md:315 | Task 4 Step 1 | Factual (overlaps architecture/website.md) |
| PBW-017 | "Never `fullPage` — Chrome grows the viewport to document height and every `100vh` block balloons into a layout no reader ever sees." | docs/superpowers/plans/2026-08-06-build-workspace.md:336 | Task 4 Step 4 | Normative |
| PBW-018 | "`lib/content/bundle-export.ts` already writes an `AGENTS.md` into every download." | docs/superpowers/plans/2026-08-06-build-workspace.md:358-359 | Task 5 Step 1 | Factual |
| PBW-019 | "No MCP server exists — it is stated as coming, never as available." | docs/superpowers/plans/2026-08-06-build-workspace.md:373 | Task 5 Step 4 | Factual |
| PBW-020 | "If it wants to update the snapshot, the restructure changed the artefact and something is wrong — stop and find out what, do not run `-u`." | docs/superpowers/plans/2026-08-06-build-workspace.md:448 | Task 7 Step 1 | Normative |
| PBW-021 | "Expected: 139/139 static pages, zero errors." | docs/superpowers/plans/2026-08-06-build-workspace.md:465 | Task 7 Step 2 | Factual |
| PBW-022 | "**Stale references have survived three passes in this repo** — this step is not optional." | docs/superpowers/plans/2026-08-06-build-workspace.md:511 | Task 8 Step 4 | Factual |
| PBW-023 | "No gaps." | docs/superpowers/plans/2026-08-06-build-workspace.md:542 | Self-Review, spec coverage table | Factual |
| PBW-024 | "no "TBD", no "add error handling", no "similar to task N"." | docs/superpowers/plans/2026-08-06-build-workspace.md:544 | Self-Review, placeholder scan | Factual |
| PLR-001 | "REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:3 | blockquote note to agentic workers | Normative |
| PLR-002 | "Add a beat to the landing, between the wordmark and the blueprint walk, that argues why a blueprint beats a prompt." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:5 | **Goal:** line | Normative |
| PLR-003 | "**Em dash rule.** `components/home` is a guarded copy tree (`components/build/path.test.ts`). New copy must not use an em dash as a pause." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:17 | Global Constraints | Normative |
| PLR-004 | "**Nothing on the landing may be a document.** `components/home/beats.test.ts` forbids `<table>`, `<pre>`, and YAML-shaped `key:` runs on every beat." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:18 | Global Constraints | Normative |
| PLR-005 | "**The finished state is what a reader without JS gets.** No `opacity-0` may appear in the prerendered HTML of any beat." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:19 | Global Constraints | Normative |
| PLR-006 | "This figure may use only `line` (the blueprint pole, and the default) and `dim` ("present but subordinate")." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:21 | Global Constraints, Tone discipline | Normative |
| PLR-007 | "**No ledger edits.** Do not add, remove, or reword any entry in `components/site/honesty.test.ts`." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:22 | Global Constraints | Normative |
| PLR-008 | "**Copy is verbatim from the spec.** The wording in §3 of the spec was approved as written. Do not improve it." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:23 | Global Constraints | Normative |
| PLR-009 | "if you start from a prompt or a skill, your experiment is not reproducible. You see the agents spawning, but the harness decides how to reach the goal. There is no blueprint." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:115-117 | quoted as "The author, 2026-08-10:" in SectionSameRun.tsx module comment | Normative (owner-quoted) |
| PLR-010 | "`components/site/honesty.test.ts` pins, in the open, that nothing on this site measures a run." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:131-132 | module comment | Factual |
| PLR-011 | "The author asked for it on 2026-08-10, out of their own note on reproducibility: a prompt hands the harness a goal and the harness invents the route." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:406-409 | Task 2 Step 2, app/page.tsx comment addition | Normative (owner-referenced, not a direct quote) |
| PLR-012 | "§2 placement → Task 2 Step 1. §3 copy → Task 1 Step 3, verbatim." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:471 | Self-review, spec coverage | Factual |
| PLR-013 | "Placeholders. None. Every code step carries the code." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:473 | Self-review | Factual |
| PLR-014 | "One thing deliberately not planned. The figure's exact geometry is a first draft." | docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:477 | Self-review | Factual |
| CRN-001 | "Measured with `npm run measure:prose` against the build at `37f27ca`." | docs/content-reorg/2026-08-04/nodes-id.md:3 | header dateline | Factual |
| CRN-002 | "Site-wide: 45,262 words across 53 pages. The largest single lever on the site." | docs/content-reorg/2026-08-04/nodes-id.md:27 | §1 Measured baseline | Factual |
| CRN-003 | "`open` equals `total`: nothing on this template is folded at all." | docs/content-reorg/2026-08-04/nodes-id.md:28 | §1 Measured baseline | Factual |
| CRN-004 | "Work through the build brief and emit the source it describes, adding nothing the brief does not ask for." | docs/content-reorg/2026-08-04/nodes-id.md:35-36 | §2 Diagnosis, quoted duplicated `card.action` text | Factual |
| CRN-005 | "`card.action`, printed twice: `app/nodes/[...id]/page.tsx:388` as the header lead, and again at `:670` as the first paragraph of the Behaviour panel." | docs/content-reorg/2026-08-04/nodes-id.md:38-39 | §2 Diagnosis | Factual |
| CRN-006 | "The audit run before `scripts/measure-prose.ts` was fixed claimed this template also stated version and digest three times each... Neither survives measurement... Two other figures from that same audit were already found wrong by roughly 4×. Treat anything inherited from it as unverified." | docs/content-reorg/2026-08-04/nodes-id.md:42-48 | §2 "A correction to the record" | Factual |
| CRN-007 | "The identical string is the page's header lead 280 words above, where a reader meets it first." | docs/content-reorg/2026-08-04/nodes-id.md:63 | §4 Edits table, rationale | Normative |
| CRN-008 | "No entry names this surface." | docs/content-reorg/2026-08-04/nodes-id.md:73 | §5 Guardrail check, honesty ledger | Factual |
| CRN-009 | "before 45,262 after 43,725 -1,537 words" | docs/content-reorg/2026-08-04/nodes-id.md:86 | §6 Target | Factual |
| CRN-010 | "The prediction was wrong, and low... the real saving is half again as large." | docs/content-reorg/2026-08-04/nodes-id.md:92-94 | §6 Target | Factual |
| CRN-011 | "Gates on the applied edit: `npm test` 3,216 pass / 72 files, `tsc --noEmit` clean, `npm run lint` clean, build clean." | docs/content-reorg/2026-08-04/nodes-id.md:98 | §6 Target, closing line | Factual |
| CRO-001 | "Measured against the build at `68b4402`." | docs/content-reorg/2026-08-04/ontology-term.md:3 | header dateline | Factual |
| CRO-002 | "Site-wide: 13,200 words across 50 pages, 264 a page. Second-largest template." | docs/content-reorg/2026-08-04/ontology-term.md:22 | §1 Measured baseline | Factual |
| CRO-003 | "No within-page duplication anywhere... Whatever makes this template large, it is not a page repeating itself." | docs/content-reorg/2026-08-04/ontology-term.md:26-27 | §2 Diagnosis | Factual |
| CRO-004 | "Cross-page boilerplate: 4,577 words, and almost none of it is cuttable." | docs/content-reorg/2026-08-04/ontology-term.md:30 | §2 Diagnosis | Factual |
| CRO-005 | "The counting works; the workflow that would read it does not exist, no threshold has been calibrated, and no term has ever been promoted." | docs/content-reorg/2026-08-04/ontology-term.md:34 | §2 boilerplate table, quoted site copy | Factual |
| CRO-006 | "None. Every candidate fails a guardrail or fails on its merits." | docs/content-reorg/2026-08-04/ontology-term.md:44 | §4 Edits | Normative |
| CRO-007 | "That is guardrails §2 outright: a sentence saying a thing is not built." | docs/content-reorg/2026-08-04/ontology-term.md:47-49 | §4 Edits | Normative |
| CRO-008 | "These qualify something printed beside them. Moving the qualifier away from the qualified thing is the same defect as folding it, whatever the word count says." | docs/content-reorg/2026-08-04/ontology-term.md:53-54 | §4, quoting "§2's rule" | Normative (quoted construction) |
| CRO-009 | "'Saves 3,381 words' is on the skill's own red-flag list as a reason to touch a limit statement, so it is not one." | docs/content-reorg/2026-08-04/ontology-term.md:56 | §4 Edits | Normative |
| CRO-010 | "Each term page is linked directly from every card that declares the term, so any of the 50 can be a reader's first arrival." | docs/content-reorg/2026-08-04/ontology-term.md:59-60 | §4 Edits | Factual |
| CRO-011 | "Unchanged: 264 words a page, 13,200 site-wide." | docs/content-reorg/2026-08-04/ontology-term.md:79 | §6 Target | Factual |
| CRO-012 | "The template is not bloated. It is 50 short, mostly tabular pages, and the one large block they share is the sentence that stops three counters reading as a live promotion pipeline." | docs/content-reorg/2026-08-04/ontology-term.md:81-83 | §6 Target, closing line | Factual |
| SCL-001 | "Status: approved, ready for implementation planning" | content-cli-design.md:4 | doc header | Factual |
| SCL-002 | "Scope: four content/positioning changes, grouped because they're all about explaining what the site lets you *do* rather than visual styling or new interactive functionality." | :6-7 | scope statement | Factual |
| SCL-003 | "A third group (semantic search) was brainstormed and then deliberately deferred — no spec was written for it." | :15-16 | related-spec note | Factual |
| SCL-004 | "The site currently states explicitly (`app/towards-a-dark-factory/the-climb/page.tsx:412`): \"there are no accounts, no votes and no telemetry, and there is no MCP server to point a client at yet.\"" | :22-24 | scope decision | Factual |
| SCL-005 | "Building an actual MCP server + published `darkprint` CLI package is a substantial, separate engineering project (hosting, protocol implementation, a package to publish) — explicitly **out of scope** for this spec." | :24-27 | scope decision | Normative |
| SCL-006 | "This document covers only the marketing/positioning surface (CLI callout + `/install` page), both honestly framed as upcoming." | :27-28 | scope decision | Normative |
| SCL-007 | "If/when the real server is built, it gets its own design spec." | :29 | scope decision | Normative |
| SCL-008 | "`ContentCard.tsx` cites **doc 2 §0.4** — \"nothing may be described as working that is not built\"" | :31-32 | framing rule | Normative |
| SCL-009 | "`SectionDoors.tsx`'s own comment applies the same rule to its one \"build your own\" line." | :33 | framing rule | Factual |
| SCL-010 | "Every new surface in this spec must say plainly that MCP access isn't live yet, everywhere the question arises (the same standard `SectionDoors` already holds itself to)." | :34-35 | framing rule | Normative |
| SCL-011 | "No new sections, no new paragraphs." | :41 | landing page | Normative |
| SCL-012 | "The landing is deliberately minimal by an explicit, recent, documented editorial pass (`SectionBlueprint.tsx`, `SectionNodeIsCard.tsx` comments: \"the copy is one sentence and stops,\" \"suggestive and atmospheric, almost no text,\" prior paragraphs moved to `/spec/topology` and `/spec/card\`)." | :41-44 | landing page | Factual |
| SCL-013 | "Adding new blocks would undo that work." | :45 | landing page | Normative |
| SCL-014 | "Instead, adjust the single `lead` sentence in each section's `SectionHeading` to pivot from pure \"what it is\" toward \"what you do with it,\" while staying one sentence." | :47-48 | landing page | Normative |
| SCL-015 | "`SectionBlueprint.tsx` (`components/home/SectionBlueprint.tsx:127`) — current lead: \"Which agents run, and what each one hands to the next.\"" | :50-51 | landing page | Factual |
| SCL-016 | "the point being a reader leaves knowing they can take this blueprint and run it, not just look at it" | :53-54 | landing page | Normative |
| SCL-017 | "`SectionNodeIsCard.tsx` (`components/home/SectionNodeIsCard.tsx:272`) — current lead: \"Open one and it says which model runs it and what must never reach it.\"" | :55-56 | landing page | Factual |
| SCL-018 | "Add the reuse angle (a card someone else published is pinnable into your own blueprint by `id@version`, the same mechanic the card drawing already shows)." | :56-58 | landing page | Normative |
| SCL-019 | "No new links are added; the existing single link under each figure (\"Open this blueprint\" / \"Read this card\") stays as the sole CTA, consistent with the one-link pattern both sections already use." | :60-62 | landing page | Normative |
| SCL-020 | "Merged into the existing `SectionDoors` component (`components/home/SectionDoors.tsx`), the landing's final \"Read one, or build one\" section — not a new standalone section." | :68-69 | CLI callout | Normative |
| SCL-021 | "The existing two doors (`Browse the blueprints`, `Build your own`) and the three build-time counts (`PLATFORM_STATS`) are untouched." | :71-72 | CLI callout | Factual |
| SCL-022 | "Add a third block within the same section: a visually prominent terminal-mockup panel showing `npx darkprint setup`, styled consistently with the section's existing `bg-blueprint-deep` / `bp-grid` chrome." | :73-75 | CLI callout | Normative |
| SCL-023 | "This is intentionally more visually weighty than the section's current restrained prose (a deliberate trade-off, chosen over a minimal teaser line, because the CLI moment is worth making concrete even before it's live)." | :75-77 | CLI callout | Normative |
| SCL-024 | "Include a short (1-2 line) simulated preview of what the command will do once live (e.g. connecting to the registry, making blueprints/nodes available to an agent) — clearly distinguished as a preview, not live output." | :78-80 | CLI callout | Normative |
| SCL-025 | "A clear \"coming soon\" label sits directly on the block (not just implied by context), and it links to `/install` for the full story." | :81-82 | CLI callout | Normative |
| SCL-026 | "This satisfies doc 2 §0.4 the same way `SectionDoors`'s existing \"nowhere to publish yet\" line already does — state the limitation exactly where the capability is first suggested." | :82-84 | CLI callout | Normative |
| SCL-027 | "New route, `app/install/page.tsx`, mirroring context7.com/install's structure" | :90 | /install page | Normative |
| SCL-028 | "Tabs per MCP-capable client (Claude Code, Cursor, VS Code, etc.), each showing the config snippet that client will need once the server exists." | :92-93 | /install page | Normative |
| SCL-029 | "A short explanation of what will be exposed: blueprints and node cards as MCP resources/tools an agent can pull directly, rather than browsing the gallery by hand." | :94-95 | /install page | Normative |
| SCL-030 | "Every tab and the page header carry a clear, unavoidable \"coming soon — not live yet\" treatment." | :96-97 | /install page | Normative |
| SCL-031 | "This is the one page on the site entirely *about* something unbuilt, so it has to be the clearest about that fact, not the least clear." | :97-98 | /install page | Normative |
| SCL-032 | "No signup/waitlist form — there's no backend to collect it against (doc 2 §0.4 / PROJECT.md's \"no accounts\" stance)." | :99-100 | /install page | Normative |
| SCL-033 | "Instead, a link back to `/blueprints` and to the project's GitHub (if a public repo link already exists sitewide — reuse whatever the nav already links to, don't invent a new external link)." | :100-102 | /install page | Normative |
| SCL-034 | "Add to primary nav / footer wherever `/blueprints` and `/nodes` are already linked, so it's discoverable the same way those are." | :103-104 | /install page | Normative |
| SCL-035 | "`components/build/ScorePanel.tsx` (the sticky panel that stays visible through all 7 steps, per doc 2 §5.7) and its narrow-viewport counterpart `ScoreStrip` already show the autonomy class live as the reader's choices change it (`autonomy.label`, e.g. \"Supervised\" → \"Closed-loop\")." | :110-113 | /build section | Factual |
| SCL-036 | "This is the same reversal decision made in Group A, applied to a second surface — not a new decision." | :113-114 | /build section | Factual |
| SCL-037 | "Reuse `AutonomyBar` (introduced in the visual-polish spec, Group A) inside `ScorePanel`/`ScoreStrip`, next to the existing class label, driven by the same `AutonomyResult` (`level`, `autonomyClass`) already flowing into these components today." | :116-118 | /build section | Normative |
| SCL-038 | "All 80 combinations are pre-verified through the real engine at build time (`path.test.ts`'s `ALL_COMBINATIONS` walk), so no new client-side analysis logic is needed — this is wiring, not new computation." | :118-121 | /build section | Factual |
| SCL-039 | "When the reader's choices land on zero human-in-the-loop nodes, the bar fills fully (level 4 / emerald) and reads the same way a published blueprint card's bar would, making the \"dark factory\" designation visible live rather than only discoverable after download." | :122-125 | /build section | Normative |
| SCL-040 | "`ScorePanel.tsx`'s module comment is a sixth place (alongside the five listed in the visual-polish spec) that documents the no-ordinal rule and needs the same dated exception note pointing at this spec and the visual-polish spec." | :126-128 | /build section | Normative |
| SCL-041 | "No change to `Was`, `Rationale`, security scoring, or any other part of the panel — this spec only adds the bar next to the existing autonomy label." | :129-130 | /build section | Normative |
| SVP-001 | "Status: approved, ready for implementation planning" | visual-polish-design.md:4 | doc header | Factual |
| SVP-002 | "Scope: four independent visual changes, grouped because they're all \"look and feel\" rather than new functionality or content." | :6-7 | scope | Factual |
| SVP-003 | "The project has a deliberate, previously-tested, five-times-documented principle: **no autonomy ordinal on any user-facing surface.**" | :24-25 | core rule being reversed | Normative |
| SVP-004 | "`PROJECT.md:36` — \"no autonomy ordinal on any user-facing surface\"" | :27 | source citation | Factual |
| SVP-005 | "`architecture/engine.md:63` — \"Doc 2 §1.1 is enforced by tests here: no ordinal on any surface\"" | :28 | source citation | Factual |
| SVP-006 | "`files/darkprint-ontology-v0.1.md:125` (source spec, Italian) — \"mai come *N su 4* con barra di progresso\" (\"never as *N out of 4* with a progress bar\")" | :29-30 | source citation | Factual |
| SVP-007 | "`components/ui/AutonomyMeter.tsx` module comment — explicitly names \"a four-segment gauge... no fill, no greyed remainder\" as the rejected pattern, and \"every class now renders identically\" (no class → color ramp)" | :31-33 | source citation | Factual |
| SVP-008 | "`files/darkprint-onboarding-positioning.md:236` — a human-in-the-loop choice \"must not look like a penalty\"" | :34-35 | source citation | Normative |
| SVP-009 | "This is a **deliberate, informed reversal**, not an oversight." | :37-38 | rule reversal | Factual |
| SVP-010 | "The reasoning for the original rule stays valid (autonomy is descriptive, not a grade; a blueprint with a human gate is not a worse blueprint) — but the card is getting a segmented, filled, per-level colored gauge anyway, because that's what was asked for." | :38-40 | rule reversal | Normative |
| SVP-011 | "The reversal is scoped **narrowly**: it adds one new visual element to the card." | :40-41 | rule reversal | Normative |
| SVP-012 | "`AutonomyMeter.tsx`'s existing row (class label, dark-factory token, \"N nodes wait for a person\") — unchanged." | :43-44 | rule reversal scope | Normative |
| SVP-013 | "The tested rule that the alarm/signal color (`--color-signal` / `text-signal`) may never sit near the human-presence glyph (`autonomy-surfaces.test.ts`, \"the indicator's colour\" block) — none of the 4 segment colors is signal red, so this test is unaffected and must keep passing." | :45-48 | rule reversal scope | Normative |
| SVP-014 | "Sorting/filtering — the gallery still never sorts by autonomy (only filters), per `GalleryBrowser.tsx`'s existing behavior." | :49-50 | rule reversal scope | Factual |
| SVP-015 | "A thin (≈4–6px) horizontal bar spanning the full width of the card, at the very top edge (above the existing `h-40` thumbnail preview panel in `components/ui/ContentCard.tsx`), divided into 4 equal segments with a small gap (≈2px) between them, rounded to match the card's `rounded-lg` top corners." | :54-57 | what to build | Normative |
| SVP-016 | "Segment coloring, one color per level, keyed off `AutonomyResult.level` (1–4) / `autonomyClass`: 1=assisted=violet `#a78bfa`; 2=supervised=amber `#ffb020`; 3=conditional=cyan `#38bdf8`; 4=closed-loop=emerald `#34d399`" | :59-67 | color table | Normative |
| SVP-017 | "Segments `1..level` render filled in their respective color; segments beyond `level` stay dim/neutral (`--color-line`, matching the card's existing border tone)." | :69-72 | what to build | Normative |
| SVP-018 | "E.g. a \"Conditional\" (level 3) blueprint shows violet, amber, cyan filled, and the 4th segment dim." | :70-72 | what to build (example) | Factual |
| SVP-019 | "This is a genuine gauge — closer to the exact pattern the source spec named as rejected (color ramp from dim/cool to warm to \"pass\" colors) than a purely categorical alternative would have been." | :74-76 | what to build | Factual |
| SVP-020 | "That trade-off was discussed explicitly with the project owner and chosen deliberately over a non-ordinal alternative (a single flat color chip with no segments/fill)." | :76-78 | what to build | Factual |
| SVP-021 | "Keep an `aria-label` / `sr-only` text on the bar mirroring what `AutonomyMeter` already computes (e.g. \"Autonomy class: Conditional (level 3 of 4)\"), and a `title` attribute for a mouse user, matching the pattern `AutonomyMeter` already uses (`title={full}`)." | :82-84 | accessibility | Normative |
| SVP-022 | "The bar is decorative-primary (conveys real information) rather than purely decorative, so it needs a real accessible name, not `aria-hidden`." | :85-86 | accessibility | Normative |
| SVP-023 | "Add a small new component (e.g. `components/ui/AutonomyBar.tsx`) rather than folding this into `AutonomyMeter.tsx`, since it's visually and structurally a different element (card top strip vs. inline row) with a different job." | :90-92 | new component | Normative |
| SVP-024 | "`ContentCard.tsx` renders it above the `h-40` thumbnail div." | :93 | new component | Normative |
| SVP-025 | "Don't delete the old rationale — annotate the reversal in place, dated, so there's a paper trail" | :97-98 | documentation | Normative |
| SVP-026 | "`PROJECT.md:36` — note that the top-of-card gauge is an intentional, dated exception to the no-ordinal rule, and why (see this spec)." | :100-101 | documentation | Normative |
| SVP-027 | "`architecture/engine.md:63` — same note, pointing at the new component." | :102 | documentation | Normative |
| SVP-028 | "`components/ui/AutonomyMeter.tsx` module comment — add a note that a *separate* component (`AutonomyBar`) now renders a segmented gauge on the card top, and that this file's own \"no ordinal\" behavior is intentionally kept for the inline row." | :103-105 | documentation | Normative |
| SVP-029 | "Leave the historical spec text in `files/*.md` untouched (those are frozen source docs); the amendment lives in `PROJECT.md`/`architecture/` and code comments, not by editing history." | :106-108 | documentation | Normative |
| SVP-030 | "Extend the existing `.bp-grid` utility class (already defined in `app/globals.css`, currently used only on the `h-40` thumbnail panel at 22%/10%/6% blueprint-line opacity) to the full card, applied on top of the existing `bg-surface` background — not the `bg-blueprint-deep/40` tint wash that the thumbnail panel also has, just the grid-line texture." | :114-116 | card transparency | Normative |
| SVP-031 | "The intent: the whole card reads as \"a sheet of the blueprint\" rather than only its preview window looking that way." | :117-119 | card transparency | Normative |
| SVP-032 | "Opacity stays as defined in `.bp-grid` today (it's already subtle); no legibility regression expected for card body text since the pattern is line-only, not a fill." | :119-121 | card transparency | Factual |
| SVP-033 | "Implementation: add the `bp-grid` class to the outer card container (or the body `<div>`) in `components/ui/ContentCard.tsx`, removing the redundancy of it being scoped only to the preview panel." | :123-125 | card transparency | Normative |
| SVP-034 | "Replace **Geist Mono** with **JetBrains Mono** as the site's `--font-mono`." | :131 | font swap | Normative |
| SVP-035 | "`app/layout.tsx` — swap the `next/font/google` import from Geist Mono to JetBrains Mono (available on Google Fonts, so no new hosting/licensing setup needed), keep the same weight range currently loaded." | :133-135 | font swap | Normative |
| SVP-036 | "`app/globals.css`'s `@theme inline` block — `--font-mono` binds to the new font's CSS variable, same as today's `var(--font-geist-mono)` pattern." | :136-137 | font swap | Normative |
| SVP-037 | "This is a global swap: every current mono use is affected — term/ID labels (the `Id` component in `components/spec/parts.tsx`, which is what renders things like `acceptance-criteria`), `.eyebrow` labels, edge labels in graph figures, nav, metadata rows, etc." | :139-142 | font swap | Factual |
| SVP-038 | "No visual redesign of *where* mono is used — only which typeface renders it." | :142-143 | font swap | Normative |
| SVP-039 | "`components/hero/Wordmark.tsx` runs a 4-beat anime.js timeline once the hero scrolls into view (`useReveal`, `phase === \"shown\"`)" | :150-152 | wordmark baseline | Factual |
| SVP-040 | "letters arrive (`splitText` + `stagger`, opacity/translateY/scale, center-out, 58ms stagger, 880ms `outExpo`) — **this is the beat being replaced**" | :153-154 | wordmark baseline | Factual |
| SVP-041 | "a rule is drawn under the name (`svg.createDrawable` + `draw` prop)" | :155 | wordmark baseline | Factual |
| SVP-042 | "the name settles (spring overshoot)" | :156 | wordmark baseline | Factual |
| SVP-043 | "one pass of light crosses the letters (opacity flicker stagger)" | :157 | wordmark baseline | Factual |
| SVP-044 | "The file's existing invariant is preserved untouched: SSR, no-JS, and reduced-motion readers always get the finished heading with no animation runtime at all (`useReveal`'s `static` phase short-circuits before any of this runs)." | :159-162 | wordmark baseline | Normative |
| SVP-045 | "Nothing about that gating changes." | :162 | wordmark baseline | Normative |
| SVP-046 | "Draws — appears as a stroke-only outline of its own glyph shape, tracing itself in like a circuit/schematic line being sketched (`stroke-dashoffset` animated 1 → 0, the same drawing mechanic `svg.createDrawable` already uses for the rule under the wordmark — this reuses an established technique rather than introducing a new one)." | :169-172 | what changes | Normative |
| SVP-047 | "Instantiates — once a letter's outline finishes drawing, it cross-fades: the stroke-only outline fades out while the real, solid DOM letter (today's final look — solid fill, cyan/blue glow) fades in." | :173-176 | what changes | Normative |
| SVP-048 | "Stagger timing follows the existing pattern (center-out, similar ~58ms per-letter offset), sized so the whole beat still finishes before `AT.settle` (900ms) — beats 2–4 keep their current timing untouched." | :177-179 | what changes | Normative |
| SVP-049 | "The word \"DarkPrint\" is fixed, so letter outline paths are **precomputed once**, not generated at runtime" | :183-184 | implementation | Normative |
| SVP-050 | "A one-time generation step (a small script using a font-outline library against the actual Space Grotesk Semibold font file) produces SVG path data for each of the 9 letters, at the sizes/weights the wordmark uses." | :186-188 | implementation | Normative |
| SVP-051 | "That path data is committed as a static TS constant (e.g. in `components/hero/`), not regenerated on every build or in the browser — no runtime font-parsing dependency." | :189-190 | implementation | Normative |
| SVP-052 | "An absolutely-positioned SVG overlay, sized/positioned to exactly match the real `<h1>` span's box, renders these paths during the animated phase only." | :191-193 | implementation | Normative |
| SVP-053 | "The real DOM text (`data-mark=\"mark\"`) stays the source of truth throughout, exactly as it is today (`text.splitText` still cuts the real heading for the entrance; the SVG overlay is purely the \"how it arrives\" layer on top)." | :193-195 | implementation | Factual |
| SVP-054 | "Maintenance cost: if the display font or the word \"DarkPrint\" itself ever changes, the precomputed path data needs regenerating via the same script." | :196-198 | implementation | Factual |
| SVP-055 | "This is called out explicitly as the trade-off for the more literal \"wiring\" effect, vs. a cheaper CSS-only wipe/flicker alternative that was considered and not chosen (less literal, but zero font-outline dependency)." | :197-200 | implementation | Factual |
| SVP-056 | "No change to the accessible-name handling `splitText` already does (visually-hidden full copy inserted, generated spans marked `aria-hidden`)." | :204-205 | accessibility | Normative |
| SVP-057 | "The SVG overlay is `aria-hidden` throughout, same as the existing drawn rule." | :206-207 | accessibility | Normative |
| SCR-001 | "The ask: a reusable skill for reorganising the site's pages — where things sit, and how much a reader has to get through — for every route except the landing, the gallery and the blueprint pages, which are approved as they stand." | content-reorg-design.md:5-7 | intro | Factual |
| SCR-002 | "The complaint was \"too much information that can only distract a user\"." | :13 | motivation (owner-quoted) | Factual (owner-quoted) |
| SCR-003 | "Measuring the site turned that into something more specific than \"the pages are long\"." | :13-14 | motivation | Factual |
| SCR-004 | "`npm run measure:prose` over the 133 prerendered pages ... 89594 words of prose across 133 pages" | :16-30 | measurement table | Factual |
| SCR-005 | "Re-measured after `/what-it-isnt` was removed (1,579 words), which is why the total moved from 91,122 across 134 pages." | :32-33 | table footnote | Factual |
| SCR-006 | "Fifty of those words did not leave the site: the wizard's vocabulary-asymmetry disclaimer relocated to `/upload`, which is the page it describes." | :33-34 | table footnote | Factual |
| SCR-007 | "**Two in-scope templates carry two-thirds of the prose the site serves.**" | :36 | finding | Factual |
| SCR-008 | "`/spec/card`, the worst page by per-page length and the obvious place to start, is 1.4% of it." | :36-37 | finding | Factual |
| SCR-009 | "`/nodes/[...id]` has `open` equal to `total`, so nothing on it is folded at all." | :38 | finding | Factual |
| SCR-010 | "An audit of every route found what fills that template: `card.action` printed verbatim twice per page, version and digest each stated three times, the enforced/free-text distinction explained three times in about a hundred words, and a fifty-word site-wide fact about bundles restated on 55 of 57 pages." | :40-43 | audit finding | Factual |
| SCR-011 | "Those are single edits worth ten thousand words." | :43 | audit finding | Factual |
| SCR-012 | "So the ranking is **site-wide words (per page × instances)**, not per-page length. It is the metric the skill and the script both sort by." | :45-46 | metric decision | Normative |
| SCR-013 | "The same concept is explained in four places, and that is invisible from inside any one page. `/spec/topology` argued the absent edge three times on its own; `/spec/card` and `/what-it-isnt` made it a fourth and fifth." | :50-53 | rationale | Factual |
| SCR-014 | "(`/what-it-isnt` has since been removed on the author's instruction, which settled that particular duplication by deleting one end of it.)" | :53 | rationale | Factual (owner-instructed) |
| SCR-015 | "The risk-marker arithmetic is written in full on `/ontology` and again in full on each of the ten marker term pages, which then link to `/spec/scoring` where it belongs." | :54-56 | rationale | Factual |
| SCR-016 | "A page-at-a-time review cannot see any of that." | :56 | rationale | Factual |
| SCR-017 | "PROJECT.md §3.1 already records the danger: cutting for pace does not delete honesty statements, it **promotes them to a disclosure**." | :60-61 | constraint | Normative |
| SCR-018 | "The words stay in the HTML, every word count still passes, and the reader never sees them." | :61-62 | constraint | Factual |
| SCR-019 | "That is why `components/site/honesty.test.ts` exists and why `components/ui/visible-text.ts` splits `plainText` from `openText`." | :62-64 | constraint | Factual |
| SCR-020 | "A baseline run confirmed the danger is live rather than historical. Five agents were given `/spec/card` and `/spec/scoring` with the real complaint and a 30% target, and no skill" | :66-67 | experiment setup | Factual |
| SCR-021 | "**Two of five cut or paraphrased a ledger `open` claim** — both the same sentence, `/spec/card`'s \"Both are legitimate, and a reader has to be able to tell which is which without running anything\", which the file's own comment records as having been deleted once before by a length pass and put back." | :69-72 | experiment finding | Factual |
| SCR-022 | "**All five damaged limit statements** that no test pins. One substituted a `title` attribute for visible text, which `visible-text.ts` strips. One proposed adding the claim to the ledger in the same commit. One proposed relaxing a test assertion so its cut would pass. One declared a protective code comment stale in order to edit past it." | :73-76 | experiment finding | Factual |
| SCR-023 | "Every rationalisation they used is now a row in the skill's red-flags list, verbatim." | :78 | finding | Factual |
| SCR-024 | "**The same run with the skill loaded: 0 of 5.** Same two routes, same 30% pressure, same verbatim complaint, same adversarial scorer reading `honesty.test.ts` for itself." | :80-81 | experiment result | Factual |
| SCR-025 | "**Ledger `open` claims cut, folded or paraphrased: 0.** All three `/spec/card` agents left \"Both are legitimate…\" verbatim and in the open — the sentence RED killed twice — and each one independently rejected folding the YAML listing, naming §3.1's failure mode to do it." | :83-87 | experiment result | Factual |
| SCR-026 | "Two rejected a cut on the grounds that \"a figure that draws it\" does not rescue a claim." | :87-88 | experiment result | Factual |
| SCR-027 | "One agent declined a 75-word cut with \"'Saves 75 words' is on the skill's red-flag list as a reason to touch a limit statement, so it is not one\"." | :88-91 | experiment result | Factual |
| SCR-028 | "One recorded eight cuts it had found and rejected, with the reason for each." | :91-92 | experiment result | Factual |
| SCR-029 | "One stated outright that 30% is not reachable on `open` here rather than manufacturing it." | :92 | experiment result | Factual |
| SCR-030 | "**What the skill did not stop.** Every proposal still reached for cross-page ownership (\"`/nodes/code-builder` owns it\") to justify cutting prose *adjacent* to a limit statement — guardrails §1's explicitly-rejected argument, applied to sentences the agent had first classified as outside the ledger." | :93-96 | limitation | Factual |
| SCR-031 | "It cost no ledger claim, and the scorer caught it every time, but the skill bans the move for ledger claims and the agents read that as licence everywhere else." | :96-98 | limitation | Factual |
| SCR-032 | "Three of five converged on cutting the same sentence this way." | :98 | limitation | Factual |
| SCR-033 | "That is the next thing to fix in `guardrails.md`, and it is a scope question for the author rather than a bug." | :99-100 | note | Normative |
| SCR-034 | "Two further findings came out of it: three proposals wrote numbers by hand into `ScoringModel.tsx`, whose header says every number there is read and none typed; and one route's audit surfaced the measurement bug recorded in §6." | :102-104 | finding | Factual |
| SCR-035 | "`.claude/skills/content-reorg/` — project-level, versioned with the rules it encodes, so that when the ledger grows the skill that must respect it is in the same commit." | :108-109 | skill shape | Normative |
| SCR-036 | "SKILL.md method, two verbs, guardrail summary, red flags / references/guardrails.md the ledger, the forbidden list, how to check each / workflows/audit.js the fan-out / scripts/measure-prose.ts the instrument (repo-level, `npm run measure:prose`)" | :112-118 | skill shape | Factual |
| SCR-037 | "**Two verbs.** `audit` measures, diagnoses and proposes, writing one spec per route and changing nothing. `apply` executes an approved spec for one route and proves it with the gates." | :120-122 | design | Normative |
| SCR-038 | "The checkpoint between them is the point of the design." | :122 | design | Normative |
| SCR-039 | "**Levers, in order:** cut (said elsewhere) → relocate (real, but not needed for this page's decision) → collapse (some readers only) → compress (last resort, flagged for review because it touches the author's sentences)." | :124-126 | design | Normative |
| SCR-040 | "Cut beats collapse: folding is how the limit statements went quiet, and a folded block still costs the reader a decision." | :126-127 | design | Normative |
| SCR-041 | "**The audit is a fan-out** because duplication has to be found across all routes at once, before any per-route proposal is written." | :129-131 | design | Normative |
| SCR-042 | "Three duplication lenses — definitions, disclaimers, template boilerplate — then one auditor per route, each feeding straight into an adversarial guardrail pass that defaults to UNSAFE." | :130-132 | design | Normative |
| SCR-043 | "`scripts/measure-prose.ts` reads `.next/server/app`, which is what a visitor is served, rather than rendering components in isolation." | :136-137 | instrument | Factual |
| SCR-044 | "Two numbers per page, `total` and `open`, because a pass that moves `total` and leaves `open` alone has not cut anything a reader experiences." | :137-139 | instrument | Normative |
| SCR-045 | "It implements §3.1's rules directly, including the trap that section names: the pane listings are not inside a `<pre>`, because `SourcePane` draws its rows as `<div role=\"option\">`. `role=\"listbox\"` is stripped for that." | :141-144 | instrument detail | Factual |
| SCR-046 | "The GREEN verification run then found the half §3.1 does not name — `components/home/nodecard/YamlListing.tsx` draws the identical shape on `/spec/card` and carries no role at all, so 383 words of card YAML, a third of the page, were counted as prose." | :144-146 | finding | Factual |
| SCR-047 | "The class the two components share is stripped as well, along with `aria-hidden` glyphs, which a whitespace-splitting counter had been scoring at 4,309 words of punctuation site-wide." | :146-148 | finding | Factual |
| SCR-048 | "It imports `openText`/`plainText` from `components/ui/visible-text.ts` rather than reimplementing them, so the measurement cannot drift from the guard it has to agree with." | :150-151 | instrument | Normative |
| SCR-049 | "That needed `allowImportingTsExtensions` in `tsconfig.json`, which is safe because `noEmit` is already set and Next compiles through SWC." | :152-153 | instrument | Factual |
| SCR-050 | "**What it cannot see, and says so:** `/build` and `/upload` hold their content behind client state, so prerendered HTML is step one of seven and step one of N." | :155-156 | limitation | Factual |
| SCR-051 | "The landing measures **305** prose words against §3.1's 216. That is not an error in §3.1: `3cfe0da` moved the Download, Compose and Upload panels onto the landing afterwards." | :161-163 | correction | Factual |
| SCR-052 | "`README.md`'s counts are stale (8 blueprints / 52 cards against 9 and 57)." | :165 | correction | Factual |
| SCR-053 | "**Every number in the first version of this spec was wrong**, and the reason is worth keeping. `dropByAttribute` found a matching element and handed the rest of the document to a tag-stripper, which took every later sibling sharing that tag with it. Nothing threw." | :166-169 | correction | Factual |
| SCR-054 | "`/blueprints/[slug]` reported 539 words a page instead of 1,455 and ranked fifth instead of third; the \"1,150 words of listing on `starter-software-factory`\" this spec cited as the listing trap was the bug's own output, and that page's only listbox is a 269-word field list." | :169-172 | correction | Factual |
| SCR-055 | "The instrument now has `scripts/measure-prose.test.ts`, whose first case is that bug." | :172-173 | correction | Factual |
| SCR-056 | "The conclusions held — the two node/ontology templates still dominate — but they held by luck, and PROJECT.md §4's rule about verifying tool output applies to a tool written for this task as much as to any other." | :173-175 | correction | Normative |
| SCR-057 | "The landing, `/blueprints` and `/blueprints/[slug]` are untouched, per the ask." | :179 | deliberately not done | Factual |
| SCR-058 | "The audit did find defects there — the landing ships its 59-word `<desc>` twice in the DOM because `SectionBlueprint` renders both `LANDING_NARROW` and `LANDING_WIDE`, and every `ContentCard` prints its title twice — logged here rather than acted on." | :179-182 | finding, not fixed | Factual |
| SCR-059 | "No page content has been changed. This ships the instrument and the method; the first `audit` run is the next step." | :183-184 | closing | Factual |
| SIA-001 | "we are not focusing on the concept of a dark factory but blueprints (i.e. graphs of automations that can be passed to Claude Code for example and also can be assembled into existing code or assembling blueprints together to enrich the functionalities. Such blueprints are like patterns to achieve a given goal)" | ia-redesign.md:12-15 | §0, the correction this doc is built on | Normative (owner-quoted) |
| SIA-002 | "**A blueprint is a reusable pattern for achieving a goal.** A graph of automations you hand to an agent, drop into existing code, or compose with other blueprints." | :17-19 | §0 | Factual |
| SIA-003 | "Nodes are the parts. The vocabulary is how the parts describe themselves. \"Dark factory\" is a badge some blueprints earn." | :19-20 | §0 | Factual |
| SIA-004 | "That is not what the repo says. `PROJECT.md`, `architecture/*.md` and much of the copy were written when \"dark factory\" was the headline, and an agent reading `AGENTS.md` → `PROJECT.md` → `architecture/*.md` reconstructs the older idea and designs to it." | :22-24 | §0 | Factual |
| SIA-005 | "**Fixing those documents is part of this work, not a footnote to it** — otherwise the next pass re-derives the same site." | :24-26 | §0 | Normative |
| SIA-006 | "If a blueprint is a pattern, the site is a **pattern library**, and pattern libraries have a known shape: you arrive with a goal, you find the pattern that matches it, you take it." | :30-31 | §0 | Normative |
| SIA-007 | "The current site is organised as the formalism — three spec layers, a ladder, a vocabulary — with the patterns filed behind them." | :31-33 | §0 | Factual |
| SIA-008 | "**nothing on the site today says what any blueprint is *for*.**" | :35-36 | §0 | Factual |
| SIA-009 | "`/blueprints` lists nine bundles by title and category. A visitor with a goal (\"I want code review to run itself\") has no path from that goal to `guarded-merge-bot`." | :36-37 | §0 | Factual |
| SIA-010 | "That is the single largest gap this proposal addresses, and it is an *addition*, not a reorganisation." | :37-38 | §0 | Factual |
| SIA-011 | "site-wide word counts by route ... 89594 words across 133 pages" | :44-67 | §1 measurement table | Factual |
| SIA-012 | "**The registry detail templates are 74,725 of the 89,594 words** (`/nodes/[...id]`, `/ontology/[...term]`, `/blueprints/[slug]`, `/u/[username]`) and they are the part nobody calls a labyrinth." | :71-73 | §1 finding | Factual |
| SIA-013 | "The labyrinth is the **8,318 words** across `/spec/*` and `/towards-a-dark-factory/*` — 9% of the site holding 3 of 8 nav slots, or 5 of 8 if you count `Build one` and `Install`." | :73-75 | §1 finding | Factual |
| SIA-014 | "**`/blueprints` is 733 words for the thing the site exists to hand out**, while `/spec` and its four children are 4,858. The explanation outweighs the object 6.6:1." | :76-77 | §1 finding | Factual |
| SIA-015 | "Approved: two nouns and one Learn menu." | :83 | §2 nav | Normative |
| SIA-016 | "**`/ontology` moves under Learn**, but the 50 term pages keep their URLs and stay linked from every card. The index is a reference index; it is not a destination someone arrives wanting." | :102-104 | §2 nav | Normative |
| SIA-017 | "**`/build` moves into Learn and must not be called \"Compose\".** Composition happens on the user's machine (§6b), so a website step named for it contradicts the model on the one page a reader would test it against." | :105-107 | §2 nav | Normative |
| SIA-018 | "`/build` is the **authoring** page: how to make a blueprint, and how to hand that to your agent. It is a rebuild, and it is critical — §6c." | :107-108 | §2 nav | Normative |
| SIA-019 | "**`[Share yours]` was proposed and is NOT built.** `SiteHeader.tsx` already carries the reason, written before this document existed: \"`/upload` validates and scores a bundle in the browser and stops there; publishing has no backend. A '+ Share' label on every page of the site would be the one promise the site cannot keep.\"" | :109-112 | §2 nav | Factual |
| SIA-020 | "That is right and it outranks §2. The button stays `[Validate]` until publishing exists, at which point the rename is one line." | :112-114 | §2 nav | Normative |
| SIA-021 | "**\"What a blueprint is\" is a new page** and the only addition to the route list." | :115 | §2 nav | Normative |
| SIA-022 | "The header drops from 8 flat items to 3 + a menu." | :116 | §2 nav | Factual |
| SIA-023 | "**Footer** keeps the full flat list — that is what footers are for, and it is where the deep links (`/spec/topology`, `/u/<author>`, term pages) stay reachable without cluttering the header." | :118-120 | §2 nav | Normative |
| SIA-024 | "Every route gets one job. Where a route has two, that is the defect." | :126 | §3 | Normative |
| SIA-025 | "`/blueprints` \| 733 \| **The shelf.** Find the pattern that matches your goal. \| **Add goal-first framing**: each card leads with what the blueprint is *for*, not its title and category. Add filters: goal/domain, autonomy class, `# dark factory`. This page is under-built for its job." | :132 | §3 route table | Normative |
| SIA-026 | "`/blueprints/[slug]` \| 1455/869 open \| **One pattern in full**, and the download. \| Keep. Approved in an earlier pass." | :133 | §3 route table | Normative |
| SIA-027 | "`/nodes/[...id]` \| 854 × 53 \| **One part in full.** \| Biggest single lever on the site (45,262 words, `open` == `total`, nothing folded). Out of scope here; it is a density problem, not an IA one. `content-reorg` owns it." | :135 | §3 route table | Factual |
| SIA-028 | "**`/what-a-blueprint-is`** \| new \| **The one page that teaches the object.** Graph + cards + vocabulary, drawn. \| **New — approved by the author, 2026-08-04.**" | :142 | §3 route table | Normative (owner-approved) |
| SIA-029 | "`/build` \| 440 (step 1 of 7) \| Today: answer 7 questions, get one of 80 pre-resolved bundles. \| **Rebuild.** Becomes *how to author a blueprint* — a breakdown a reader follows and can hand to their agent. Animation-led, no dense text." | :157 | §3 route table | Normative |
| SIA-030 | "**19 routes today, 20 proposed.** The only deletions are in §7 and they are sections, not routes." | :160 | §3 | Factual |
| SIA-031 | "The landing is 305 words in five beats: hero, what a blueprint is, a node is a card, download/compose/upload, two doors." | :169 | §4 | Factual |
| SIA-032 | "Its own header comment records the author's rule for it: \"The landing should have concepts and suggestive illustration not technical ones.\"" | :168-169 | §4 | Normative (owner-authored rule, quoted) |
| SIA-033 | "**That rule is right and the landing already follows it. Do not rebuild the landing.**" | :171 | §4 | Normative |
| SIA-034 | "What it lacks is a place to hand off to. Beats 2 and 3 each carry one concept in one sentence and one figure; a reader who wants the next level of detail is currently sent to `/spec`, which is the formalism, not the concept. That is the labyrinth entrance." | :173-175 | §4 | Factual |
| SIA-035 | "**That plan was wrong, and the page shipped differently.** Reading the four components before assembling them showed the assembly would have built the labyrinth rather than cleared it" | :192-194 | §4 self-correction | Factual |
| SIA-036 | "`SectionNodeCard` is a `lg:h-[420vh]` scroll stage. It would make the page a cold reader meets *first* four screen-heights long." | :196-198 | §4 self-correction | Factual |
| SIA-037 | "So the site was not missing a figure. **It was missing one sentence: what a blueprint is *for*.** Nothing anywhere said \"pattern\"." | :204-205 | §4 | Factual |
| SIA-038 | "The page as built is 379 words: the definition, the three parts named in a line each with links to the pages that draw them properly, the download / adapt / share loop with composition explicitly off-site, and two doors." | :205-208 | §4 | Factual |
| SIA-039 | "The author's note: \"it is important to give user the core concepts using also drawings and animation when needed.\"" | :217-218 | §5 | Normative (owner-quoted) |
| SIA-040 | "**A figure I proposed and then withdrew.** The risk-marker arithmetic on `/ontology/<term>` looked like a 660-word win. Measured, it is on **3 pages, 49 words each — 147 site-wide**. Not worth a figure." | :227-229 | §5 self-correction | Factual |
| SIA-041 | "The 660 came from the audit run before the measurement bug in `scripts/measure-prose.ts` was found, and so did the `card.action` figure in §7; both were wrong by roughly 4×." | :229-232 | §5 | Factual |
| SIA-042 | "**Animation budget stays where it is.** The hero has it, and `SectionNodeCard`'s scroll choreography has it. Nothing in this proposal asks for more; §3.1 of PROJECT.md already records that the four-screen-height card stage is a placement cost, not a win." | :234-236 | §5 | Normative |
| SIA-043 | "**a. Nothing maps a goal to a blueprint, and the target is community-scale.** The author expects the registry to reach thousands of user-published blueprints." | :242-244 | §6a | Factual (owner expectation) |
| SIA-044 | "That makes this **search-first, from the start** — a filter strip over nine cards is a design that has to be thrown away at a hundred." | :244-245 | §6a | Normative |
| SIA-045 | "`/towards-a-dark-factory/which-tasks` is the only page that reasons about *which* automation suits *which* task — 1,252 words at the third level of a demoted essay branch." | :256-257 | §6a | Factual |
| SIA-046 | "**Recommendation:** lift them onto `/blueprints` as the facet names, and leave the essay where it is." | :258-259 | §6a | Normative |
| SIA-047 | "**This is the largest thing in this document and it is mostly not IA.** Search, moderation and versioning are product surface, not navigation." | :261-262 | §6a | Factual |
| SIA-048 | "The IA decision that follows from it is narrow: design `/blueprints` as a result page now, even while it holds nine, so the shape does not have to change later." | :262-264 | §6a | Normative |
| SIA-049 | "The composition should be done by a given tool like Claude Code on behalf of a user, not the website; then a user can share a composition as a new blueprint." | :269-271 | §6b (owner quote) | Normative (owner-quoted) |
| SIA-050 | "That settles a question this document had open, and it settles it well." | :272 | §6b | Factual |
| SIA-051 | "**The landing's beat 4 is already this drawing** — `SectionLifecycle` renders download / compose / upload. It does not currently say the middle step is off-site." | :284-286 | §6b | Factual |
| SIA-052 | "**The engine needs no composite-node feature.** A shared composition is just a new blueprint: a flat graph of nodes, indistinguishable in format from any other." | :287-289 | §6b | Normative |
| SIA-053 | "This is why `grep -r 'composite\\|compose' lib/core` returning nothing is *correct* rather than a gap, and it retires the concern this section used to raise." | :289-290 | §6b | Factual |
| SIA-054 | "**The deleted qualifier does not need to come back.** `SectionComponentRecap` said \"the format lets one blueprint reference another as a composite node, and nothing on the site does that today\"." | :291-294 | §6b | Factual |
| SIA-055 | "**What does need saying, in the open:** that DarkPrint does not run or compose anything — it hands out files and reads them." | :296-297 | §6b | Normative |
| SIA-056 | "**Open, and asked separately:** if an agent does the composing, does the bundle have to tell it how? Today `README.md` documents `attractor run factory.dot` for a human. Nothing in a bundle is addressed to the agent doing the adapting." | :301-303 | §6b, open question | Factual |
| SIA-057 | "the build objective is to show to a user how to create a blueprint and therefore showing a breakdown such that the user can understand and use it but also give such indications to its Claude Code (or Gemini or Codex) and build a blueprint of them. This part is critical very important and should be supported by core animations and no dense texts." | :308-311 | §6c (owner quote) | Normative (owner-quoted) |
| SIA-058 | "So `/build` is **not** a picker, and not a competitor to `/blueprints`. It answers *how do I make one of these?* and it has two audiences at once" | :313-314 | §6c | Normative |
| SIA-059 | "That second audience is the part nothing on the site serves today, and it is the same audience §6d's bundle `AGENTS.md` serves." | :321-322 | §6c | Factual |
| SIA-060 | "**They should be the same artefact**: what `/build` teaches a reader to decide is what the agent needs told." | :322-324 | §6c | Normative |
| SIA-061 | "**Constraints the author set, and they are binding:** core animations, no dense text." | :326-327 | §6c | Normative (owner constraint) |
| SIA-062 | "The current `/build` is a 7-step wizard over 80 pre-resolved combinations — a configurator that ends in a download. That is a different page from the one described above." | :327-329 | §6c | Factual |
| SIA-063 | "This is a **rebuild, not a demotion**, and it is the second-largest piece of work in this document after `/blueprints`." | :329-330 | §6c | Normative |
| SIA-064 | "**d. Bundles get an agent-facing file.** Approved, 2026-08-04. Today a bundle carries `blueprint.dot`, `factory.dot`, `cards/` and a `README.md` addressed to a human (`attractor run factory.dot`)." | :335-337 | §6d | Normative |
| SIA-065 | "Nothing in it is addressed to the agent doing the adapting, which makes \"hand it to Claude Code\" aspirational rather than literal." | :337-338 | §6d | Factual |
| SIA-066 | "the AGENTS.md should be provided by a user once uploading a blueprint." | :355-356 | §6d (owner quote) | Normative (owner-quoted) |
| SIA-067 | "**What only the author knows.** The cards describe the graph. They cannot describe *what to look for in your codebase*, *where this pattern fits*, *when not to use it*, or *what went wrong the first time*. ... **The author must write it.**" | :359-362 | §6d | Normative |
| SIA-068 | "**What the author must not write.** The node list, the wiring, the prohibitions and the digest are all derivable from `blueprint.dot` and `cards/`. Typed by hand they can contradict the files they sit beside, and nothing would catch it." | :364-367 | §6d | Normative |
| SIA-069 | "**On friction — the author asked, and my answer is that this shape removes it.** A required free-text file is a real barrier at community scale, and it is the kind of barrier that costs you the casual contributor who had a good pattern." | :385-387 | §6d | Factual |
| SIA-070 | "The generated half means **every bundle has an `AGENTS.md` whether or not the uploader writes anything.** Nobody is blocked from publishing." | :389-391 | §6d | Normative |
| SIA-071 | "The written half is **optional, prompted at upload, and shown as a quality signal** on the blueprint page." | :391-392 | §6d | Normative |
| SIA-072 | "**The prohibitions lead the file.** `cannot:` is what an agent adapting a pattern is most likely to get wrong, and it is generated, so it is always there and always true." | :397-398 | §6d | Normative |
| SIA-073 | "**One consequence to accept deliberately:** the written half is prose the site distributes about a bundle, and the site cannot check it." | :400-401 | §6d | Factual |
| SIA-074 | "If an uploader writes *\"this runs your CI automatically\"* and it does not, DarkPrint hands that sentence out." | :401-403 | §6d | Factual |
| SIA-075 | "`/nodes/[...id]` — `card.action` printed verbatim twice per page \| 19 × 53 = **1,007** \| Duplication within one template. Measured on `/nodes/code-builder`: the action sentence appears exactly twice." | :414 | §7 deletions | Factual |
| SIA-076 | "Everything else moves or stays. **Nothing in `/towards-a-dark-factory` is deleted** — it is demoted, which is what the author asked for." | :418-419 | §7 | Normative (owner-directed) |
| SIA-077 | "Approved: **a property, defined at the badge.** No dedicated page." | :425 | §8 | Normative |
| SIA-078 | "Blueprint page: one sentence beside the badge — *\"All five phases run with nobody in the loop.\"*" | :428 | §8 | Normative |
| SIA-079 | "**The engine changes to make that sentence true.** Approved 2026-08-04." | :432 | §8 | Normative |
| SIA-080 | "lib/core/analysis/autonomy.ts: `- const isDarkFactory = autonomousNodes === totalNodes;` / `+ const isDarkFactory = autonomousNodes === totalNodes && CORE_PHASE_IDS.every((p) => phasesCovered.has(p));`" | :434-439 | §8 proposed diff | Normative |
| SIA-081 | "**Dark factories go from 6 to 4.** Both losses are corrections rather than regressions: a nightly data janitor and an ETL forge have no planning phase, and under the author's definition they were never dark factories." | :459-461 | §8 | Factual |
| SIA-082 | "**Watch when implementing:** `phasesCovered` does not exist in `autonomy.ts` today." | :466 | §8 | Factual |
| SIA-083 | "**Fix the documents** (`PROJECT.md`, `architecture/website.md`, `architecture/engine.md`) so blueprints-as-patterns is what the repo says. Everything else re-derives the old site until this is done." | :476-478 | §9 order of work | Normative |
| SIA-084 | "**Change `isDarkFactory`** (§8). Small, measured, and two blueprints lose a badge they should never have had." | :479 | §9 | Normative |
| SIA-085 | "**Build `/what-a-blueprint-is`** from existing figures (§4). Cheapest, highest leverage." | :482 | §9 | Normative |
| SIA-086 | "**Restructure the nav** (§2). Small diff: `SiteHeader`, `SiteFooter`, one new menu." | :483 | §9 | Normative |
| SIA-087 | "**Rebuild `/build` as the authoring page** (§6c) and **generate bundle `AGENTS.md`** (§6d) together — they are the same content addressed to the same second audience, and building either alone means writing it twice." | :484-486 | §9 | Normative |
| SIA-088 | "**Rebuild `/blueprints` as a result page** (§6a). The project. Search-shaped from day one even while it holds nine." | :487-488 | §9 | Normative |
| SIA-089 | "Steps 1–4 are a day or two. Step 5 is a week and is the one the author called critical." | :492-493 | §9 | Factual |
| SIA-090 | "**How much search to build now.** Settled that the target is community-scale (§6a) ... Unsettled how much of that shape is worth building while the registry holds nine — a facet UI over nine cards can read as pretension rather than infrastructure." | :500-503 | §10 open questions | Factual |
| SIA-091 | "**`/build`'s existence**, not just its placement. Settled that it is not composition (§6b); unsettled whether a 7-question wizard over 80 fixed combinations earns a route once `/blueprints` can match a goal." | :504-506 | §10 | Factual |
| SIA-092 | "**Whether `/build` and bundle `AGENTS.md` really are one artefact.** I have asserted it in §6c because the audience is identical, but `/build` teaches a general method while `AGENTS.md` describes one specific pattern. If they diverge in practice, §6d should be generated from cards and `/build` written by hand, and the \"same artefact\" claim comes out." | :511-515 | §10 | Factual |
| SBR-001 | "the \"about one hour\" push away a user" | build-restructure-design.md:12 | §0 (owner fragment) | Normative (owner-quoted) |
| SBR-002 | "I want to stress that the dot files along the cards can be provided to claude code, codex or other harness and use to solve tasks of the user for the user problem. Such blueprint should be transparent to the user in some sense. Indeed, we plan to include a MCP call to the registry of blueprint such that via claude code, it can query the registry via a RAG system the best fitting blueprint." | :16-20 | §0 (owner quote) | Normative (owner-quoted) |
| SBR-003 | "**The deliverable of `/build` is something an agent can act on.** Not a blueprint the reader has studied — a folder they hand to Claude Code, Codex or another harness, which then does *their* work." | :22-23 | §0 | Normative |
| SBR-004 | "the build objective is to show to a user how to create a blueprint and therefore showing a breakdown such that the user can understand and use it but also give such indications to its claude code (or gemini or codex) and build a blueprint of them" | :30-32 | §0 (owner quote, near-dup of SIA-057) | Normative (owner-quoted) |
| SBR-005 | "`lib/content/bundle-export.ts` already writes an `AGENTS.md` into every download. The handoff exists. It is buried as \"the other half of the last step\", eight steps in." | :34-35 | §0 | Factual |
| SBR-006 | "`components/build/steps.tsx` defines eight steps. Only **three are choices**" | :43 | §1.1 | Factual |
| SBR-007 | "4 × 2 × 10 = the 80 combinations `app/build/page.tsx` resolves at build time." | :56 | §1.1 | Factual |
| SBR-008 | "Step 5 is not a choice by its own admission — `steps.tsx` says of the demo toggle: \"Turn it back off. Nobody would ship this, which is why it is not one of the choices.\"" | :58-59 | §1.1 | Factual |
| SBR-009 | "`/what-a-blueprint-is` is the item directly above `/build` in the Learn menu." | :70 | §1.2 | Factual |
| SBR-010 | "`app/build/page.tsx` states it plainly in its own header comment: \"The deliverable of the hour is a factory the reader owns and can run.\" The hour is the wiring-up and the first green run, on the reader's machine. **This page is three radio choices and a download.**" | :74-76 | §1.3 | Factual |
| SBR-011 | "The claim is not false. It is attached to the wrong activity and placed in the first two words a reader meets, where it reads as the price of admission." | :78-79 | §1.3 | Normative |
| SBR-012 | "The graph pane renders at roughly 400×300 inside a three-column grid. At that size `fitView` fights the `minZoom` floor and the drawing crops: node names cut at both edges (\"…ot Factory\", \"GHTED)\"), and the `acceptance criteria` edge label sits on top of a node's kind eyebrow." | :83-86 | §1.4 defect | Factual |
| SBR-013 | "Four surfaces — graph, three-files list, raw DOT, score rail — compete for one screen, and the DOT is clipped horizontally on top of that." | :86-87 | §1.4 | Factual |
| SBR-014 | "Eight equal chips in one flat row, seven of them wearing a `✓` before the reader has done anything, and a `step 1 of 8` counter below. With three simultaneous controls there is no sequence to be partway through." | :91-93 | §1.5 | Factual |
| SBR-015 | "**The graph gets the width it needs.** It is the stage, not a column." | :142 | §2.2 design | Normative |
| SBR-016 | "**The `•` markers make the page's own claim visible.** \"Every choice changes all three\" is currently a sentence taken on faith; here, changing the output kind lights up DOT, Cards and Vocabulary at once." | :143-146 | §2.2 | Normative |
| SBR-017 | "*Marker semantics, stated so they cannot be guessed at:* a marker appears on every tab whose content differs from what it was immediately before the reader's last choice, and clears when that tab is opened." | :147-150 | §2.2 | Normative |
| SBR-018 | "It reports the effect of one choice, not cumulative drift from the default — otherwise every tab would be marked forever after the first change and the signal would mean nothing." | :150-151 | §2.2 | Normative |
| SBR-019 | "**The controls stay put while the stage changes.** Today each choice sits on its own screen, so the reader never sees the before and after of their own decision." | :152-153 | §2.2 | Normative |
| SBR-020 | "The chip row, the `step N of 8` counter and the Back/Next pair are **deleted**." | :155 | §2.2 | Normative |
| SBR-021 | "The four non-choice steps become one line each, linking to the pages that own them ... a single `.route-box` — the site's existing \"this box leaves the page\" primitive — placed directly under the header band and above the workspace, holding both links (`/what-a-blueprint-is` for the three parts, `/spec/topology` for the absent edge)." | :157-161 | §2.2 | Normative |
| SBR-022 | "**Take this starter** — `DownloadStep`, largely as-is, plus one sentence it does not currently say plainly: the folder already contains an `AGENTS.md`, so it is already a thing you hand to a coding agent." | :166-168 | §2.3 | Normative |
| SBR-023 | "**Have your agent write one** — `AgentHandoff`, promoted from footnote to co-equal. It keeps its closing move: tell the agent to state what it left out, then point at `/upload`, which runs the real validator in the reader's own tab." | :170-173 | §2.3 | Normative |
| SBR-024 | "Nothing on this site can check what a model returns, and the page must not imply otherwise." | :173 | §2.3 | Normative |
| SBR-025 | "Under both, one signpost for the planned registry-over-MCP retrieval, wearing `ComingSoonBadge`. **Stated as coming, never as available** — no MCP server exists." | :175-176 | §2.3 | Normative (Factual) |
| SBR-026 | "You now have the folder. Wiring it to your own agent runner and getting a first green run takes about an hour." | :182-183 | §2.4 proposed copy | Normative |
| SBR-027 | "`lib/starter/*` \| **untouched** — the model, the 80 variants, the bundle writer" | :193 | §3 disposition table | Normative |
| SBR-028 | "`components/build/GuidedPath.tsx` \| **replaced** by `BuildWorkspace.tsx`" | :203 | §3 | Normative |
| SBR-029 | "`components/build/steps.tsx` \| **deleted** — teaching steps become links, choice intros become `▸ why this matters`" | :204 | §3 | Normative |
| SBR-030 | "`components/build/path-state.ts` \| **deleted** — no path, so no move rules, levels or markers" | :205 | §3 | Normative |
| SBR-031 | "`components/build/LifecycleStrip.tsx` \| **deleted** — only `steps.tsx` mounts it" | :206 | §3 | Normative |
| SBR-032 | "**Blast radius is contained to `components/build/` and `app/build/page.tsx`.** Verified: the only imports of `components/build/*` from outside that directory are `ALL_COMBINATIONS` and `GuidedPath`, both in `app/build/page.tsx`." | :208-210 | §3 | Factual |
| SBR-033 | "Six such comments — in `components/upload/UploadFlow.tsx` (×3), `components/install/InstallTabs.tsx` (×2) and `components/panes/SkeletonPane.tsx` (×1) — name files this spec deletes or renames, and **must be updated in the same commit**." | :212-215 | §3 | Normative |
| SBR-034 | "Stale route and file references have survived three passes in this repo." | :215 | §3 | Factual |
| SBR-035 | "The load-bearing guarantee is not the steps. It is: **every one of the 80 combinations resolves through the real engine, and one error-severity diagnostic fails the build.**" | :221-223 | §4 testing | Normative |
| SBR-036 | "`path.test.ts` \| → `workspace.test.ts`. Keeps every assertion walking `ALL_COMBINATIONS` through `loadBundle`. Drops only assertions about step order, move rules and chip markers — they will be asserting about deleted concepts." | :227 | §4 | Normative |
| SBR-037 | "**new** \| the change markers are honest: changing `output` must mark DOT, Cards **and** Vocabulary. This is the page's central claim and would otherwise rot silently." | :230 | §4 | Normative |
| SBR-038 | "**Equivalence check before the work is called done:** for a fixed set of choices, the bundle produced after the restructure must be **byte-identical** to the bundle produced before it. The presentation changes; the artefact must not." | :233-235 | §4 | Normative |
| SBR-039 | "**~60KB of tested code is deleted.** Mitigated by the equivalence check above: everything deleted is presentation, and the engine, variants, bundle writer and 80-combination proof are untouched." | :241-243 | §5 risks | Factual |
| SBR-040 | "**A reader can now reach the choices without meeting \"what a node is\".** Accepted." | :244-245 | §5 | Normative |
| SBR-041 | "**`ChoiceGraphPane` at full width is real geometry work**, not a container swap. The current crop comes from a `minZoom` floor fighting a 400px pane; both need re-tuning together, and the new label-crop guard is what holds it." | :247-249 | §5 | Factual |
| SBR-042 | "The MCP registry server and its RAG retrieval. Signposted as coming; not built, not promised." | :255-256 | §6 out of scope | Normative |
| SLR-001 | "🤔 Second problem: if you start from a prompt or a skill, your \"experiment\" is **not reproducible**. You see the #agents spawning, but the harness decides how to reach the goal. There is no blueprint." | landing-reproducibility-beat-design.md:12-14 | §0 (owner quote) | Normative (owner-quoted) |
| SLR-002 | "🔬 And #reproducibility is exactly what lets you swap one part of the blueprint, rerun, and measure if the result got better. No blueprint, no eval." | :16-17 | §0 (owner quote) | Normative (owner-quoted) |
| SLR-003 | "Can u include this consideration in the homepage? Not as it is but the concept behind to have the possibility to reproduce and define a what a given harness has to run exactly?" | :21-22 | §0 (owner quote, direct instruction) | Normative (owner-quoted) |
| SLR-004 | "**A, the cause.** A prompt hands the harness a goal and the harness invents the route. A blueprint hands it the route. This is a claim about *control*, and it says nothing about measuring anything." | :25-27 | §0 | Factual |
| SLR-005 | "**B, the consequence.** Because the route is pinned, two runs differ only where the blueprint changed, which is the precondition for swapping one node and attributing the difference to the swap." | :28-30 | §0 | Factual |
| SLR-006 | "This concept is not absent from the site. It is unclaimed." | :41-42 | §1 | Factual |
| SLR-007 | "**`components/explain/RunLayers.tsx`** already draws the four layers a run has — blueprint, harness, rubric, eval" | :44-46 | §1 | Factual |
| SLR-008 | "It is written down before the run, which is what makes two runs comparable, and kept away from the harness." | :46-47 | §1 (quotes existing component copy) | Factual |
| SLR-009 | "**`components/home/SectionLifecycle.tsx`** (beat 4 today) already calls the artifact \"a reproducible, version-pinned specification you can inspect before your own harness runs it\"" | :52-54 | §1 | Factual |
| SLR-010 | "**Nothing anywhere states the causal chain.** No blueprint → the harness improvises → runs are not comparable → a change cannot be attributed. That chain is the missing thing, and it is the strongest argument the project has for existing." | :59-61 | §1 | Factual |
| SLR-011 | "A new **beat 2**, between `Hero` and `SectionBlueprint`." | :71 | §2 placement | Normative |
| SLR-012 | "The author was offered this position against three cheaper ones and picked it, with the risk stated: at beat 2 the reader has not yet been shown a graph or a card, so the beat argues about an artifact it has not displayed." | :82-84 | §2 | Factual (owner decision) |
| SLR-013 | "This takes the landing from five beats to six." | :93 | §2 | Factual |
| SLR-014 | "### The same run twice / A prompt gives your harness a goal and lets it invent the route. A blueprint gives it the route: which agents run, what each one is handed, and what must never reach them." | :108-111 | §3 proposed copy | Normative |
| SLR-015 | "Pinned that way, two runs differ only where you changed the blueprint. That is what lets you swap one node, run it again in your own harness, and attribute the difference to the swap. Without a blueprint there is nothing held constant, so there is nothing to compare." | :115-117 | §3 proposed copy | Normative |
| SLR-016 | "The lead is A. The caption is B, and its closing sentence is the author's \"no blueprint, no eval\" said in the site's register and without the word `eval`" | :121-123 | §3 | Factual |
| SLR-017 | "from a prompt: three traces diverging through different intermediate nodes, unlit greys / from a blueprint: three traces exactly coincident, reading as one bright path, `--color-blueprint-line`" | :129-132 | §3 figure table | Normative |
| SLR-018 | "Cyan is excluded because `app/globals.css` spends it on \"you can act on this\"; violet is reserved for where a person acts (`HUMAN_PRESENCE_MARK`, guarded by `components/ui/autonomy-surfaces.test.ts`); amber is \"not built yet\"; emerald is \"resolved against the engine\"." | :140-142 | §3 colour reasoning | Factual |
| SLR-019 | "nothing on this site measures a run, so these two filters describe a design rather than a behaviour" | :153-154 | §4 (quotes ledger) | Factual |
| SLR-020 | "and `/reading-the-radar` adds, in the open: \"There is no runner and no endpoint.\"" | :156-157 | §4 | Factual |
| SLR-021 | "**The running is explicitly the reader's**: \"run it again in *your own harness*\"." | :162 | §4 | Normative |
| SLR-022 | "**The verb is `attribute`, not `measure` or `score`.** The beat claims the difference can be assigned to a cause, which is a property of holding the specification constant. It does not claim a number comes back." | :163-165 | §4 | Normative |
| SLR-023 | "**The word `eval` does not appear.** `RunLayers` defines it as running the blueprint through a harness and grading the result across a distribution." | :166-168 | §4 | Factual |
| SLR-024 | "**Decision, confirmed with the author: no new limit statement, and no new ledger entry.** The beat describes a property of the artifact rather than advertising a capability, so there is nothing here that needs qualifying." | :171-173 | §4 (owner-confirmed, later superseded) | Normative (owner-quoted) |
| SLR-025 | "The site-wide refusal is already carried by the footer on every page — \"The registry publishes files. Your machine runs them.\"" | :173-174 | §4 | Factual |
| SLR-026 | "**If the caption is ever rewritten to promise a measurement, a comparison, or a score, it needs a limit statement beside it and a ledger row**, per the repository's own rule that a claim and its qualifier travel together." | :177-179 | §4 | Normative |
| SLR-027 | "### 4.1 · Superseded 2026-08-11: the beat now prints scores" | :181 | §4.1 revision marker | Factual |
| SLR-028 | "That last paragraph was the condition, and the rewrite met it. ... the right-hand panel now draws four runs, four scores and three deltas." | :183-186 | §4.1 | Factual |
| SLR-029 | "**A limit statement, beside the panel that draws the numbers.** A `.label`-tier line under the right-hand figure: \"illustrative: DarkPrint does not run your graph\"." | :190-193 | §4.1 | Normative |
| SLR-030 | "**A ledger row**, `/ (beat 2) · the scores in the right-hand panel`, `where: \"open\"`, in `components/site/honesty.test.ts`." | :195-196 | §4.1 | Normative |
| SLR-031 | "Also true and worth writing down: the footer line this section leaned on — \"The registry publishes files. Your machine runs them.\" — was removed on the author's instruction on 2026-08-11." | :204-206 | §4.1 | Factual (owner-instructed) |
| SLR-032 | "The site-wide refusal it carried is no longer on every page, which is a second, independent reason this beat needed a qualifier of its own rather than inheriting one." | :206-207 | §4.1 | Factual |
| SLR-033 | "`components/home/beats.test.ts` \| no `opacity-0` in the prerendered HTML, so the finished state is what a reader without JS gets \| figure is static; `phase=\"static\"` covers the server, JS-off and reduced-motion readers alike." | :217 | §5 guards | Normative |
| SLR-034 | "em-dash rule (`components/build/workspace.test.ts`) \| `components/home` is a guarded tree; no em dash as a pause in new copy \| the hand-off writes the lead and the right-hand caption with a pause dash; both ship as a comma" | :220 | §5 guards | Normative |
| SLR-035 | "A row stood here reading \"no `<table>`, no `<pre>`, no YAML-shaped `key:` runs on any beat\", attributed to `beats.test.ts`. No such assertion exists in that file or anywhere else in the suite" | :222-224 | §5 self-correction | Factual |
| SLR-036 | "`npm run build && npm test && npx tsc --noEmit && npm run lint` all green." | :247 | §7 done means | Normative |
| SLR-037 | "The landing renders six beats, with the new one between the wordmark and the blueprint walk, verified in a browser at 1440px rather than only in the markup." | :248-249 | §7 | Normative |
| FDS-001 | Alcune scelte sono **decise**, altre sono **raccomandazioni da confermare** (segnalate come tali). | files/darkprint-design.md:3 | doc status header | Normative |
| FDS-002 | `darkprint.io` — piattaforma dove sviluppatori e ricercatori caricano, valutano, condividono e **prelevano per eseguire** blueprint di *dark factory*. | files/darkprint-design.md:9 | §0 Cos'è DarkPrint | Factual |
| FDS-003 | Target primario: sviluppatori e ricercatori tecnici nel mondo degli agenti AI. | files/darkprint-design.md:11 | §0 | Factual |
| FDS-004 | Il DOT prodotto e consumato da DarkPrint deve restare leggibile dal tooling Attractor esistente. | files/darkprint-design.md:25 | vincolo 1 | Normative |
| FDS-005 | Verificare la specifica Attractor **prima** di finalizzare lo schema. | files/darkprint-design.md:25 | vincolo 1 | Normative |
| FDS-006 | Ogni nodo porta con sé la specifica in linguaggio naturale che **istruisce Claude Code, o un agente equivalente**, su cosa fare. | files/darkprint-design.md:27 | vincolo 2 | Factual |
| FDS-007 | Il blueprint è materiale di istruzione strutturato, non bytecode. | files/darkprint-design.md:27 | vincolo 2 | Factual |
| FDS-008 | DarkPrint **non esegue codice agentico lato server**. | files/darkprint-design.md:29 | vincolo 3 | Factual |
| FDS-009 | Non c'è sandbox, non ci sono chiavi API di terzi in custodia, non c'è costo di esecuzione a carico della piattaforma. | files/darkprint-design.md:29 | vincolo 3 | Factual |
| FDS-010 | Nessun OAuth GitHub, nessun collegamento di repository utente, nessun uso di Git come archivio dei blueprint. | files/darkprint-design.md:31 | vincolo 4 | Normative |
| FDS-011 | Il vincolo 4 riguarda **il prodotto**, non il flusso di sviluppo dell'autore. | files/darkprint-design.md:33 | nota vincolo 4 | Normative |
| FDS-012 | Il repo di DarkPrint stesso può stare su GitHub e usare GitHub Actions per la CI. | files/darkprint-design.md:33 | nota vincolo 4 | Factual |
| FDS-013 | Decisione: il sito ha **due primitive strutturali** — il **nodo** (card singola) e il **blueprint** (grafo completo). | files/darkprint-design.md:39 | §1 | Normative |
| FDS-014 | La sezione "parts" intesa come *sottografi riutilizzabili* viene **rimandata**, non implementata ora. | files/darkprint-design.md:41 | §1 | Factual |
| FDS-015 | progettare il modello dati del blueprint in modo che sia già *componibile* (un blueprint può referenziare un altro blueprint come nodo composito), anche se l'UI non lo espone subito. | files/darkprint-design.md:46 | §1 implicazione implementativa | Normative |
| FDS-016 | Il DOT porta **solo la topologia**; il dettaglio ricco vive in **card esterne**. | files/darkprint-design.md:54 | §2 decisione centrale | Normative |
| FDS-017 | Ogni nodo nel DOT ha un **identificatore univoco** che fa da puntatore alla card che lo istanzia. | files/darkprint-design.md:61 | §2 | Factual |
| FDS-018 | ogni identificatore presente nel DOT ha la sua card | files/darkprint-design.md:78 | §2 requisito validatore 1 | Normative |
| FDS-019 | non esistono card orfane nel bundle | files/darkprint-design.md:78 | §2 requisito validatore 2 | Normative |
| FDS-020 | i tipi dichiarati negli input/output sono coerenti lungo ogni arco | files/darkprint-design.md:80 | §2 requisito validatore 3 | Normative |
| FDS-021 | tutti i valori di campi strutturali esistono nell'ontologia dichiarata | files/darkprint-design.md:81 | §2 requisito validatore 4 | Normative |
| FDS-022 | `id` — identificatore univoco, **è la chiave che lega la card al nodo nel DOT** | files/darkprint-design.md:92 | §3.1 identità | Factual |
| FDS-023 | È il payload che viene consegnato a Claude Code (o equivalente) quando il grafo viene istanziato. | files/darkprint-design.md:98 | §3.2 campo spec | Factual |
| FDS-024 | Deve essere **autosufficiente**: l'agente che lo riceve non vede il resto del grafo, quindi la spec deve contenere tutto ciò che serve a svolgere quel compito, e nient'altro. | files/darkprint-design.md:105 | §3.2 regole spec | Normative |
| FDS-025 | **L'isolamento non è solo assenza di un arco, è assenza del contenuto nella spec.** | files/darkprint-design.md:106 | §3.2 regole spec | Normative |
| FDS-026 | Un arco mancante nel DOT con la spec che rivela comunque i criteri è un falso isolamento, e l'analisi statica non se ne accorgerebbe. | files/darkprint-design.md:106 | §3.2 regole spec | Factual |
| FDS-027 | **Principio invariante: una card pubblicata non si modifica mai sul posto.** | files/darkprint-design.md:132 | §4 versionamento | Normative |
| FDS-028 | Se cambia, nasce una nuova versione. | files/darkprint-design.md:132 | §4 | Normative |
| FDS-029 | **Per DarkPrint si pinna la versione esatta.** | files/darkprint-design.md:149 | §4 | Normative |
| FDS-030 | Ogni versione di card è identificata anche da un **hash del suo contenuto**. | files/darkprint-design.md:153 | §4 | Factual |
| FDS-031 | Lo storico delle versioni è **immutabile**: una card vecchia resta sempre recuperabile. | files/darkprint-design.md:159 | §4 | Factual |
| FDS-032 | **Decisione: object storage, non Git.** | files/darkprint-design.md:169 | §5.1 | Normative |
| FDS-033 | Git resta possibile come **funzione di export** in un secondo momento, ma non è l'archivio del sito, e nulla nell'architettura deve dipenderne. | files/darkprint-design.md:175 | §5.1 nota | Normative |
| FDS-034 | il contenuto immutabile vive nell'object storage indicizzato per hash, i metadati di ricerca nel database. | files/darkprint-design.md:187 | §5.2 regola pratica | Normative |
| FDS-035 | L'ontologia è **il contratto**; le card sono le **istanze** che lo rispettano. | files/darkprint-design.md:193 | §6 | Factual |
| FDS-036 | quel valore **non è testo libero**: è un riferimento a una voce dell'ontologia. | files/darkprint-design.md:197 | §6.1 | Normative |
| FDS-037 | **Principio: aggiungere è sicuro, cambiare o togliere è pericoloso.** | files/darkprint-design.md:209 | §6.2 | Normative |
| FDS-038 | **Soluzione: non si cancella mai davvero.** | files/darkprint-design.md:215 | §6.2 | Normative |
| FDS-039 | Le migrazioni sono esplicite e tracciate, mai silenziose. | files/darkprint-design.md:222 | §6.2 | Normative |
| FDS-040 | a livelli — raccomandato per DarkPrint | files/darkprint-design.md:230 | §7 modello ontologia | Normative |
| FDS-041 | costo e tempo **non sono misurati oggettivamente dalla piattaforma**: sono riportati da chi esegue. | files/darkprint-design.md:268 | §8 correzione | Factual |
| FDS-042 | DarkPrint non può verificarli in modo indipendente. | files/darkprint-design.md:268 | §8 | Factual |
| FDS-043 | la scheda del blueprint mostra il **numero di esecuzioni** e la **dispersione** dei valori, non solo la media. | files/darkprint-design.md:271 | §8 conseguenze | Normative |
| FDS-044 | l'etichetta in interfaccia dice *riportato*, non *misurato*. | files/darkprint-design.md:274 | §8 | Normative |
| FDS-045 | il punteggio è **descrittivo, non un voto**. Un blueprint con nodi umani non è un blueprint peggiore. | files/darkprint-design.md:280 | §8.1 | Normative |
| FDS-046 | si parte da 4 e si sottrae... **non conta la frazione, conta la gravità** | files/darkprint-design.md:305 | §8.2 | Factual |
| FDS-047 | il sistema deve **mostrare all'utente esattamente quali nodi** hanno determinato il punteggio | files/darkprint-design.md:322 | §8.3 | Normative |
| FDS-048 | Entrambe si ricavano **puramente dalla struttura del grafo, senza eseguirlo**. | files/darkprint-design.md:324 | §8.3 | Factual |
| FDS-049 | repo su GitHub collegato a Vercel, ogni PR genera un **deploy di anteprima** con link dedicato. | files/darkprint-design.md:340 | §9.1 flusso autore | Factual |
| FDS-050 | GitHub Actions con runner Scaleway per i test pre-deploy. | files/darkprint-design.md:340 | §9.1 | Factual |
| FDS-051 | Variabili d'ambiente e chiavi API si configurano nel pannello Vercel, **non** dentro la sandbox di Claude Code. | files/darkprint-design.md:342 | §9.1 nota | Normative |
| FDS-052 | Non compare "esecuzione dei blueprint". Per il vincolo §0.1.3 l'esecuzione avviene sulla macchina dell'utente. | files/darkprint-design.md:353 | §9.2 | Factual |
| FDS-053 | Il backend non ospita sandbox agentiche, non custodisce chiavi API di terzi e non sostiene costi di inferenza. | files/darkprint-design.md:353 | §9.2 | Factual |
| FDS-054 | **Decisione: Supabase copre auth, database e storage.** Non aggiungere un servizio separato per ciascuno. | files/darkprint-design.md:357 | §9.3 | Normative |
| FDS-055 | **Sequenza unica per entrambi i documenti.** Non esistono due ordini di implementazione: quello di riferimento è uno solo. | files/darkprint-design.md:372 | §10 | Normative |
| FDS-056 | **Verificare la specifica Attractor** e confermare che lo schema del §2 e del §3 vi rientri. Questo è un prerequisito, non una questione aperta rimandabile | files/darkprint-design.md:382 | §11 | Normative |
| FDS-057 | Tutte le soglie e i pesi ancora aperti vanno in **un unico file di configurazione**, non sparsi nel codice. | files/darkprint-design.md:385 | §11 nota implementativa | Normative |
| FOP-001 | Feedback raccolto da un tester: chi non conosce le dark factory **non capisce il sito**. | files/darkprint-onboarding-positioning.md:11 | §0 problema | Factual |
| FOP-002 | Alla fine si è basato sulla spiegazione a voce dell'autore, non su ciò che leggeva. | files/darkprint-onboarding-positioning.md:11 | §0 | Factual |
| FOP-003 | Mancano un claim iniziale forte e un percorso "come ne creo una". | files/darkprint-onboarding-positioning.md:11 | §0 | Factual |
| FOP-004 | Il sito **definisce il concetto prima di far localizzare il lettore**. | files/darkprint-onboarding-positioning.md:15 | §0 causa 1 | Factual |
| FOP-005 | Due onboarding diversi sono trattati come uno solo. | files/darkprint-onboarding-positioning.md:16 | §0 causa 2 | Factual |
| FOP-006 | **Decisione: tenerli fisicamente separati.** | files/darkprint-onboarding-positioning.md:25 | §0 | Normative |
| FOP-007 | DarkPrint è una **galleria/registry di blueprint di dark factory**, con l'MCP come canale aggiuntivo di accesso, non come prodotto principale. | files/darkprint-onboarding-positioning.md:31 | §1 | Factual |
| FOP-008 | Una dark factory copre **cinque fasi**: planning, implementation, testing, debugging, deployment. | files/darkprint-onboarding-positioning.md:33 | §1 | Factual |
| FOP-009 | si chiamano *dark* perché le luci sono spente, gli umani non servono in produzione. | files/darkprint-onboarding-positioning.md:33 | §1 | Factual |
| FOP-010 | Specifications go in. Software comes out. | files/darkprint-onboarding-positioning.md:37 | §1 claim principale, "già validato nelle note" | Factual (owner-quoted) |
| FOP-011 | il gap tra il livello 2... e il livello 4... **non è tecnologico, è architetturale e organizzativo**. | files/darkprint-onboarding-positioning.md:41 | §1 gancio argomentativo | Factual |
| FOP-012 | La tecnologia per arrivare al livello 4 esiste già. Quello che manca sono i pattern per strutturare il lavoro. | files/darkprint-onboarding-positioning.md:41 | §1 | Factual |
| FOP-013 | **Un blueprint non deve essere completamente autonomo per avere valore su DarkPrint.** | files/darkprint-onboarding-positioning.md:52 | §1.1 | Normative |
| FOP-014 | Un grafo con un nodo di intervento umano è legittimo e benvenuto. | files/darkprint-onboarding-positioning.md:52 | §1.1 | Normative |
| FOP-015 | Nella galleria l'autonomia è un **filtro**, non un ordinamento di merito. | files/darkprint-onboarding-positioning.md:58 | §1.1 conseguenze | Normative |
| FOP-016 | Nessun linguaggio valutativo attorno al numero. | files/darkprint-onboarding-positioning.md:59 | §1.1 | Normative |
| FOP-017 | L'indicatore di autonomia mostra **dove sono gli interventi umani**, non quanto manca alla piena autonomia. | files/darkprint-onboarding-positioning.md:60 | §1.1 | Normative |
| FOP-018 | Nessun badge o incentivo che premi l'autonomia alta di per sé. | files/darkprint-onboarding-positioning.md:61 | §1.1 | Normative |
| FOP-019 | Anche la copertura di fase (§8) segue la stessa regola: coprire tre fasi su cinque è una descrizione, non un difetto. | files/darkprint-onboarding-positioning.md:62 | §1.1 | Normative |
| FOP-020 | I livelli descrivono la **maturità di un'organizzazione**... Il punteggio di autonomia descrive una **scelta di design su un singolo blueprint**. | files/darkprint-onboarding-positioning.md:66 | §1.1 | Normative |
| FOP-021 | L'ordine non è "definizione poi esempi". È: **localizza, poi definisci**. | files/darkprint-onboarding-positioning.md:76 | §2.1 | Normative |
| FOP-022 | La fabbrica al buio. Una riga, e il nome del sito diventa autoesplicativo. | files/darkprint-onboarding-positioning.md:79 | §2.1 gradino 2 | Normative |
| FOP-023 | La stessa cosa in due stati: **la fabbrica e la sua stampa**. La hero dimostra letteralmente il nome del sito. | files/darkprint-onboarding-positioning.md:94 | §2.2 | Factual |
| FOP-024 | Libreria di animazione: **anime.js** (richiesta esplicita). | files/darkprint-onboarding-positioning.md:100 | §2.3 | Normative (owner-quoted signal) |
| FOP-025 | anime.js v4 ha cambiato API rispetto alla v3... Verificare la versione installata prima di scrivere il codice. | files/darkprint-onboarding-positioning.md:102 | §2.3 nota implementazione | Normative |
| FOP-026 | l'estetica del disegno tecnico isometrico è **più on-brand** per un sito di blueprint di un modello 3D renderizzato. | files/darkprint-onboarding-positioning.md:110 | §2.3 strada A | Normative |
| FOP-027 | non usare `material.wireframe = true`... Per linee pulite serve `EdgesGeometry` + `LineSegments`. | files/darkprint-onboarding-positioning.md:116 | §2.3 trappola tecnica | Normative |
| FOP-028 | **Raccomandazione: strada A**, a meno che non si voglia rotazione e profondità reali. | files/darkprint-onboarding-positioning.md:118 | §2.3 | Normative |
| FOP-029 | **Lo scroll pilota una timeline in seek, non triggera animazioni.** | files/darkprint-onboarding-positioning.md:122 | §2.4 vincoli tecnici | Normative |
| FOP-030 | **`IntersectionObserver` + `requestAnimationFrame`**, mai un listener di scroll che scrive stile a ogni evento. | files/darkprint-onboarding-positioning.md:123 | §2.4 | Normative |
| FOP-031 | **Rispettare `prefers-reduced-motion`**: stato statico, nessuna transizione. | files/darkprint-onboarding-positioning.md:124 | §2.4 | Normative |
| FOP-032 | Le label... **sono testo nel DOM**, animate in opacità... perché devono restare leggibili dai crawler. | files/darkprint-onboarding-positioning.md:125 | §2.4 | Normative |
| FOP-033 | L'`h1` resta testo reale. | files/darkprint-onboarding-positioning.md:126 | §2.4 | Normative |
| FOP-034 | **Fallback mobile**: versione statica o semplificata. | files/darkprint-onboarding-positioning.md:127 | §2.4 | Normative |
| FOP-035 | Ripulire tutto il testo del sito dai pattern di scrittura AI: costruzioni "non X, ma Y", trattini lunghi usati come pausa, triplette ritmiche, enfasi vuote. | files/darkprint-onboarding-positioning.md:131 | §2.5 copy guidelines | Normative |
| FOP-036 | Una Skill dà una capacità a un agente. Una dark factory è l'architettura di più agenti, e soprattutto è l'insieme delle regole di isolamento tra loro. | files/darkprint-onboarding-positioning.md:139 | §3 | Factual |
| FOP-037 | Chi scrive il codice non deve mai vedere i test di accettazione. Se li vede, li aggira. | files/darkprint-onboarding-positioning.md:143 | §3 esempio | Normative |
| FOP-038 | gli LLM sono troppo inclini ad accordarsi con i propri turni precedenti e troppo disposti a dichiarare vittoria su qualcosa che hanno appena prodotto. | files/darkprint-onboarding-positioning.md:143 | §3 | Factual |
| FOP-039 | Generazione e validazione devono essere completamente isolate. | files/darkprint-onboarding-positioning.md:143 | §3 | Normative |
| FOP-040 | **Giustifica l'intero impianto del sito.** Se il valore sta nella struttura, allora un repository di grafi ha senso e un repository di prompt no. | files/darkprint-onboarding-positioning.md:150 | §3 | Factual |
| FOP-041 | Alla fine l'utente ha una dark factory **sua, scaricabile e funzionante**. | files/darkprint-onboarding-positioning.md:177 | §5 | Factual |
| FOP-042 | la simulazione pura è scartata: costosa da costruire e non dimostra nulla | files/darkprint-onboarding-positioning.md:179 | §5 | Normative |
| FOP-043 | **Non partire dal template del nodo.** | files/darkprint-onboarding-positioning.md:183 | §5.1 | Normative |
| FOP-044 | **Il sito non simula l'esecuzione**... il sito mostra la **corrispondenza tra le quattro rappresentazioni della stessa cosa**. | files/darkprint-onboarding-positioning.md:191 | §5.1 | Factual |
| FOP-045 | **Comportamento richiesto: la selezione è sincronizzata in tutti e quattro i riquadri.** | files/darkprint-onboarding-positioning.md:200 | §5.1 | Normative |
| FOP-046 | Lo stesso componente si riusa poi nella pagina di dettaglio di ogni blueprint della galleria. Non è un pezzo usa e getta del tutorial. | files/darkprint-onboarding-positioning.md:209 | §5.1 | Normative |
| FOP-047 | **Non vede mai i criteri** | files/darkprint-onboarding-positioning.md:216 | §5.2 tabella nodo builder | Normative |
| FOP-048 | **La lezione centrale non sta in un nodo, sta in un arco che non c'è.** | files/darkprint-onboarding-positioning.md:221 | §5.2 | Factual |
| FOP-049 | Ogni combinazione di scelte deve produrre una fabbrica **funzionante**: se rendi persistente una configurazione rotta, spedisci a qualcuno una fabbrica difettosa col tuo marchio sopra. | files/darkprint-onboarding-positioning.md:225 | §5.3 | Normative |
| FOP-050 | più autonomia non è automaticamente meglio: se la fabbrica tocca qualcosa di critico, quel nodo umano lo vuoi. | files/darkprint-onboarding-positioning.md:234 | §5.3 scelta 2 | Normative |
| FOP-051 | Chi sceglie l'approvazione umana non deve vedere niente che somigli a una penalità. | files/darkprint-onboarding-positioning.md:236 | §5.3 | Normative |
| FOP-052 | "Il `builder` può vedere i criteri di accettazione?" Non è una scelta, è una **dimostrazione**. | files/darkprint-onboarding-positioning.md:243 | §5.4 | Normative |
| FOP-053 | Nessuno lo lascerebbe attivo, per questo non può essere una scelta persistente. | files/darkprint-onboarding-positioning.md:249 | §5.4 | Factual |
| FOP-054 | Il loop è `tester → debugger → tester`. **Non torna al `builder`.** | files/darkprint-onboarding-positioning.md:253 | §5.5 | Normative |
| FOP-055 | Il `builder` resta **isolato per sempre** dalle informazioni sui fallimenti. | files/darkprint-onboarding-positioning.md:257 | §5.5 | Normative |
| FOP-056 | Vedere **i criteri** permette di scrivere codice costruito apposta per passarli senza risolvere il problema. Vedere **le evidenze di un fallimento che hai causato** dice solo cosa si è rotto. | files/darkprint-onboarding-positioning.md:261 | §5.5 | Normative |
| FOP-057 | il `debugger` riceve stack trace, asserzioni fallite, atteso contro ottenuto. **Non** l'insieme completo dei criteri. | files/darkprint-onboarding-positioning.md:263 | §5.5 | Normative |
| FOP-058 | il debugger può **ricostruire i criteri accumulando messaggi di errore**... il tetto di iterazioni serve a **limitare quanta informazione trapela**. | files/darkprint-onboarding-positioning.md:265 | §5.5 | Factual |
| FOP-059 | **Tetto di iterazioni.** Senza, è un ciclo senza condizione d'uscita, uno dei marcatori di rischio dell'ontologia. | files/darkprint-onboarding-positioning.md:268 | §5.5 requisiti loop | Normative |
| FOP-060 | **Via di escalation.** Esaurito il tetto non si fallisce e basta: si risale al `planner`... oppure si ferma e si chiama un umano. | files/darkprint-onboarding-positioning.md:269 | §5.5 | Normative |
| FOP-061 | **Criterio di progresso.** Se dopo due giri i fallimenti sono identici, il debugger gira a vuoto: fermarsi prima del tetto. | files/darkprint-onboarding-positioning.md:270 | §5.5 | Normative |
| FOP-062 | **Il loop insegna costo e tempo**, perché il loop è esattamente il punto dove il costo esplode. | files/darkprint-onboarding-positioning.md:274 | §5.6 | Factual |
| FOP-063 | progettare una dark factory è un **compromesso**, non un'ottimizzazione. | files/darkprint-onboarding-positioning.md:281 | §5.6 | Factual |
| FOP-064 | **Le varianti strutturali sono 8** (4 tipi di output × 2 modalità di approvazione)... Tutte e 8 devono produrre una fabbrica scaricabile e funzionante. | files/darkprint-onboarding-positioning.md:287 | §5.7 | Normative |
| FOP-065 | **Il pannello dei punteggi resta sempre visibile** durante le scelte. | files/darkprint-onboarding-positioning.md:288 | §5.7 | Normative |
| FOP-066 | **Le scelte si fanno dentro la vista del grafo**, cliccando sul nodo interessato, non in un form laterale. | files/darkprint-onboarding-positioning.md:289 | §5.7 | Normative |
| FOP-067 | La "skill per imparare a usare una dark factory"... **è questo stesso tutorial, impacchettato per Claude**. Stessa sostanza, canale di distribuzione diverso. Non progettarla come artefatto separato. | files/darkprint-onboarding-positioning.md:293 | §5.8 | Normative |
| FOP-068 | Il punto fragile: l'utente scarica, esce dal sito, gira nel suo terminale, e lì lo perdi. **Il ritorno va progettato, non sperato.** | files/darkprint-onboarding-positioning.md:299 | §6 | Factual |
| FOP-069 | Non chiedere l'account per il download. Chiederlo per **salvare**. | files/darkprint-onboarding-positioning.md:303 | §6.1 | Normative |
| FOP-070 | Ogni utente che completa il tutorial produce un blueprint pubblicabile, quindi il problema della galleria vuota al lancio non esiste. | files/darkprint-onboarding-positioning.md:307 | §6.1 | Factual |
| FOP-071 | I blueprint privati vanno **esclusi dall'indice di semantic search dell'MCP**. | files/darkprint-onboarding-positioning.md:326 | §6.4 | Normative |
| FOP-072 | I blueprint privati vanno **esclusi dai conteggi d'uso** che fanno scattare la promozione di una voce dall'ontologia locale al nucleo. | files/darkprint-onboarding-positioning.md:327 | §6.4 | Normative |
| FOP-073 | L'MCP è **l'upgrade di chi ha già capito, non la porta d'ingresso**. | files/darkprint-onboarding-positioning.md:335 | §7.1 | Factual |
| FOP-074 | claude mcp add --transport http darkprint https://mcp.darkprint.io/mcp | files/darkprint-onboarding-positioning.md:346 | §7.2 comando pronto da copiare | Factual |
| FOP-075 | **Badge copiabile** in Markdown per il README dei repo degli autori... non introduce alcuna dipendenza da GitHub. | files/darkprint-onboarding-positioning.md:359 | §7.2 | Normative |
| FOP-076 | **Il requisito "sito non scrapabile" è accantonato**, perché in conflitto diretto con SEO, ranking LLM e MCP. | files/darkprint-onboarding-positioning.md:367 | §7.3 | Normative |
| FOP-077 | **Vincolo per non incastrarsi:** non costruire nulla di attivamente anti-scraping... Mettere **rate limiting sulle API**. | files/darkprint-onboarding-positioning.md:369 | §7.3 | Normative |
| FOP-078 | **Decisione: le cinque fasi diventano una dimensione di primo livello dell'ontologia**, accanto al tipo di nodo. | files/darkprint-onboarding-positioning.md:375 | §8 | Normative |
| FOP-079 | **Gruppo Telegram** collegato al sito, pubblica il **blueprint della settimana**. | files/darkprint-onboarding-positioning.md:391 | §9 | Factual |
| FOP-080 | Da valutare, rimandato: il sito come portfolio pubblico di competenze. | files/darkprint-onboarding-positioning.md:396 | §9 | Factual |
| FOP-081 | Questa è **l'unica sequenza di riferimento** per entrambi i documenti... Non seguire due liste separate. | files/darkprint-onboarding-positioning.md:419 | §11 | Normative |
| FOP-082 | Verificare la specifica Attractor e confermare che lo schema previsto vi rientri... Se non ci rientra, lo schema si adatta prima di essere implementato, non dopo. | files/darkprint-onboarding-positioning.md:423 | §11 Fase 0 | Normative |
| FOP-083 | Ontologia v0.1 scritta a mano (file `darkprint-ontology-v0.1.md`)... Se non la scrivi tu, se la inventa l'implementatore e poi te la ritrovi ovunque. | files/darkprint-onboarding-positioning.md:424 | §11 Fase 0 | Normative |
| FOP-084 | l'hero animata è al punto 17 di proposito... il problema segnalato dal feedback è di testo e di sequenza, non di grafica. | files/darkprint-onboarding-positioning.md:462 | nota finale sull'ordine | Factual |
| FON-001 | **Questo file è il contratto.** Va implementato come dato, non come costanti sparse nel codice. | files/darkprint-ontology-v0.1.md:5 | header | Normative |
| FON-002 | Regola di evoluzione (doc 1 §6.2): **aggiungere è sicuro, rinominare e rimuovere no.** | files/darkprint-ontology-v0.1.md:7 | header | Normative |
| FON-003 | Ogni nodo dichiara **tre cose** indipendenti tra loro. | files/darkprint-ontology-v0.1.md:13 | §1 | Factual |
| FON-004 | Chiuse. Sono la definizione stessa di dark factory e non si estendono nei namespace locali. | files/darkprint-ontology-v0.1.md:25 | §2 phase | Normative |
| FON-005 | **Copertura di fase**... È **descrittiva, non un voto**. | files/darkprint-ontology-v0.1.md:35 | §2 | Normative |
| FON-006 | `human-in-the-loop` è la categoria che l'analisi dell'autonomia interroga. | files/darkprint-ontology-v0.1.md:59 | §3 | Factual |
| FON-007 | Se `type` è un sottotipo di `human-in-the-loop`, il campo `requires_human` della card **deve** essere `true`. Incoerenza tra i due è un errore di validazione, non un avviso. | files/darkprint-ontology-v0.1.md:61 | §3 nota validatore | Normative |
| FON-008 | I pesi indicati sono **valori di partenza da tarare**, e vivono nel file di configurazione, non qui. | files/darkprint-ontology-v0.1.md:67 | §4 | Normative |
| FON-009 | Tre marcatori **non si dichiarano nella card**: li deriva l'analisi statica dal grafo, e vanno calcolati anche se l'autore non li ha scritti. | files/darkprint-ontology-v0.1.md:89 | §4.1 | Factual |
| FON-010 | **`criteria-leak` va verificato anche sul contenuto della `spec`, non solo sulla topologia**... È il controllo più importante dell'intero sistema e non va rimandato. | files/darkprint-ontology-v0.1.md:95 | §4.1 | Normative |
| FON-011 | Conta **la gravità, non la frazione**: un solo `arbitrary-code-execution` pesa più di quattro nodi puliti. | files/darkprint-ontology-v0.1.md:106 | §5 | Factual |
| FON-012 | Un marcatore presente su più nodi conta una volta sola per il blueprint, ma la spiegazione elenca **tutti** i nodi che l'hanno fatto scattare. | files/darkprint-ontology-v0.1.md:106 | §5 | Normative |
| FON-013 | Il risultato si presenta come *autonomia livello N*, mai come *N su 4* con barra di progresso. | files/darkprint-ontology-v0.1.md:125 | §6 | Normative |
| FON-014 | **Non** estendibile: `phase`. Le cinque fasi sono chiuse. | files/darkprint-ontology-v0.1.md:140 | §7 | Normative |
| FON-015 | Una voce locale **deve dichiarare da quale voce del nucleo discende**, altrimenti l'analisi statica non sa come trattarla e la ignora silenziosamente, che è il peggior esito possibile. | files/darkprint-ontology-v0.1.md:142 | §7 | Normative |
| FON-016 | Un marcatore locale deve dichiarare un peso, altrimenti vale 0 e non incide. | files/darkprint-ontology-v0.1.md:143 | §7 | Normative |
| FON-017 | I conteggi d'uso per la promozione **escludono i blueprint privati**. | files/darkprint-ontology-v0.1.md:144 | §7 | Normative |
| FON-018 | Cambiare un peso è **PATCH**, ma ricalcola i punteggi di tutti i blueprint. La scheda deve indicare **con quale versione dell'ontologia** un punteggio è stato calcolato. | files/darkprint-ontology-v0.1.md:158 | §8 | Normative |
| SKM-001 | This skill writes files and nothing else. | skills/darkprint/SKILL.md:3 | frontmatter description | Normative |
| SKM-002 | It runs no graph, starts no server, publishes nothing and sends nothing anywhere. | skills/darkprint/SKILL.md:3 | frontmatter description | Factual |
| SKM-003 | the bundle is scored by dropping the folder on darkprint.io/upload, which analyses it statically in the browser tab. | skills/darkprint/SKILL.md:3 | frontmatter description | Factual |
| SKM-004 | The engine reads the pair statically and reports what the shape implies — where a person acts, what the risk surface is, and above all whether the node that produces the work can see the criteria the work will be judged against. | skills/darkprint/SKILL.md:12 | intro | Factual |
| SKM-005 | Your job in this skill is to get an author from "here is a task I want done by agents" to that bundle, by interviewing them. Not by filling in a form for them, and not by guessing. | skills/darkprint/SKILL.md:15 | intro | Normative |
| SKM-006 | Writes | `blueprint.dot`, `cards/*.yaml`, `README.md`, `AGENTS.md` in a directory the author names | skills/darkprint/SKILL.md:22 | scope table | Factual |
| SKM-007 | Does not write | `factory.dot`. DarkPrint's own exporter compiles that from the bundle; duplicating the emit rules here would let the two drift | skills/darkprint/SKILL.md:23 | scope table | Factual |
| SKM-008 | Does not do | run the graph, run any node, call a model, start a server, publish, or send the bundle anywhere | skills/darkprint/SKILL.md:24 | scope table | Normative |
| SKM-009 | Cannot do | score the bundle. The engine is not on this machine. The author scores it by dropping the folder on `/upload` | skills/darkprint/SKILL.md:25 | scope table | Factual |
| SKM-010 | Say all four of those plainly if the author asks what happens next. Never imply an account, a workspace, a sync or a push. | skills/darkprint/SKILL.md:27 | after scope table | Normative |
| SKM-011 | **Read it before you type any card**, and quote term ids from it rather than from memory. | skills/darkprint/SKILL.md:35 | reading list | Normative |
| SKM-012 | Both reference files marked *generated* are rendered from the engine's own source. If one disagrees with something you remember, the reference is right. | skills/darkprint/SKILL.md:44 | reading list | Factual |
| SKM-013 | This is a grill, not a form. | skills/darkprint/SKILL.md:51 | posture | Normative |
| SKM-014 | **One question at a time.** Ask it, stop, wait for the answer. | skills/darkprint/SKILL.md:53 | posture rule 1 | Normative |
| SKM-015 | **Recommend an answer with every question.** | skills/darkprint/SKILL.md:55 | posture rule 2 | Normative |
| SKM-016 | **Look facts up; ask only for decisions.** | skills/darkprint/SKILL.md:58 | posture rule 3 | Normative |
| SKM-017 | **Do not write a single file until the author confirms shared understanding.** | skills/darkprint/SKILL.md:62 | posture rule 4 | Normative |
| SKM-018 | **Say the engine consequence out loud.** | skills/darkprint/SKILL.md:64 | posture rule 5 | Normative |
| SKM-019 | The author never types a card id, a DOT node id, a version, a `dependencies` list, a port description, a `requires_human` flag or a `spec`. | skills/darkprint/SKILL.md:69 | after posture | Normative |
| SKM-020 | **Q0.3 — THE GATE.** *Name the command that exits non-zero when the work is wrong.* | skills/darkprint/SKILL.md:87 | Phase 0 | Normative |
| SKM-021 | If nothing but the author can decide the work is finished, there is no `validation` node; the criteria check has no generator set and does not run at all, and a security level of 4 in that state is silence rather than a pass. | skills/darkprint/SKILL.md:89 | Q0.3 FOR | Factual |
| SKM-022 | **If they cannot name it, stop here and say so.** Do not draw a graph. | skills/darkprint/SKILL.md:92 | Q0.3 | Normative |
| SKM-023 | **Stop rule.** Two noes across Q0.3–Q0.6 and you report which two and stop. One no gets a named remedy and a re-ask. | skills/darkprint/SKILL.md:113 | Phase 0 | Normative |
| SKM-024 | Never type a node with an abstract category (`human-in-the-loop`, `evaluative`). | skills/darkprint/SKILL.md:139 | Q1.3 FOR | Normative |
| SKM-025 | The two human types force `requires_human: true` — set it yourself, never ask; getting it wrong is `card/human-type-inconsistent`, an **error**. | skills/darkprint/SKILL.md:140 | Q1.3 FOR | Normative |
| SKM-026 | Offer the five with their meanings, and offer **"none" as a complete answer, not a gap**. | skills/darkprint/SKILL.md:146 | Q1.4 | Normative |
| SKM-027 | Coverage is descriptive; nothing scores off it. Never invent a phase to fill a strip. | skills/darkprint/SKILL.md:147 | Q1.4 | Normative |
| SKM-028 | Do that and the generator set is empty and the most important check in the system silently does not run. | skills/darkprint/SKILL.md:153 | Q1.5 trap | Factual |
| SKM-029 | **Never type a port `any` when the author can describe it.** | skills/darkprint/SKILL.md:171 | Q2.2 | Normative |
| SKM-030 | A bundle typed `any` throughout loads perfectly and checks nothing. That is the single most damaging thing this skill can produce. | skills/darkprint/SKILL.md:173 | Q2.2 | Factual |
| SKM-031 | the source may be **narrower** than the target, never broader. | skills/darkprint/SKILL.md:185 | Q2.4 | Normative |
| SKM-032 | Without that port type the producer set is empty and `analysis/criteria-leak-unanchored` reports that the check never ran. | skills/darkprint/SKILL.md:197 | Q2.6 FOR | Factual |
| SKM-033 | **Q3.2 — THE QUESTION THAT MUST BE ANSWERED DELIBERATELY.** Does the node that produces the work see the criteria the work will be judged against? Yes or no. There is no default and I will not pick one. | skills/darkprint/SKILL.md:209 | Phase 3 | Normative |
| SKM-034 | Draw that edge and the resolver refuses it outright — `bundle/prohibition-violated`, an error, because with no `out=` pin the carriers are every output of the producer and the criteria are among them. | skills/darkprint/SKILL.md:216 | Q3.2 no-branch | Factual |
| SKM-035 | Pin it to a different port to get past that and the analyzer charges `criteria-leak` anyway, −2.0, because its walk reads the graph at node level and does not care which port an edge carries. | skills/darkprint/SKILL.md:218 | Q3.2 no-branch | Factual |
| SKM-036 | whoever writes the work must not see the acceptance tests, because if they see them they write toward them. | skills/darkprint/SKILL.md:222 | Q3.2 yes-branch | Normative |
| SKM-037 | **The rule that decides where the brief comes from.** The topological half of the check reads the graph at **node** level: any edge at all from the criteria producer into a node whose work is judged establishes the marker, whichever port that edge carries. | skills/darkprint/SKILL.md:225 | Phase 3 | Factual |
| SKM-038 | The brief is handed to the builder when the graph is instantiated — the builder is a source node with an input port and no incoming edge. | skills/darkprint/SKILL.md:229 | Phase 3 | Factual |
| SKM-039 | **Sort the answers into two piles and show the piles.** An entry naming a data type is enforced by the resolver; everything else is prose a reader reads and nothing checks. | skills/darkprint/SKILL.md:233 | Q3.3 | Normative |
| SKM-040 | The engine cannot tell the two apart — `judge → fixer → judge` (endorsed) and `judge → builder → judge` (forbidden) are the same shape — which is why it emits `analysis/criteria-relayed-through-judge` and declines to decide. | skills/darkprint/SKILL.md:241 | Q3.4 | Factual |
| SKM-041 | Without it, `unbounded-loop` charges −1.5 on every member of the cycle. | skills/darkprint/SKILL.md:253 | Q3.6 FOR | Factual |
| SKM-042 | Following it blindly can drop a judge onto the criteria path, where it **absorbs** the criteria walk: the score improves while the criteria still reach the builder. | skills/darkprint/SKILL.md:273 | Phase 4 warning | Factual |
| SKM-043 | Do not add a validation node to silence a marker. | skills/darkprint/SKILL.md:276 | Phase 4 | Normative |
| SKM-044 | The two grammars are **incompatible for any multi-word name**, so always pin `card="code-builder@1.0.0"` and never rely on the bare `version=` fallback. | skills/darkprint/SKILL.md:288 | Q5.1 | Normative |
| SKM-045 | Reject `digraph edge graph node strict subgraph` as node ids; avoid `start`, `Start`, `exit`, `end`, which Attractor resolves as pipeline boundaries. | skills/darkprint/SKILL.md:289 | Q5.1 | Normative |
| SKM-046 | The stop condition is **the closing of the port ledger**. | skills/darkprint/SKILL.md:301 | stop condition | Normative |
| SKM-047 | every declared input has a named producing node, or an explicit "arrives with the run"; | skills/darkprint/SKILL.md:304 | stop condition 1 | Normative |
| SKM-048 | every declared output has a consumer, or is terminal on a node with `outputs: []`; | skills/darkprint/SKILL.md:305 | stop condition 2 | Normative |
| SKM-049 | every cycle has a cap on one member; | skills/darkprint/SKILL.md:308 | stop condition 4 | Normative |
| SKM-050 | **Q3.2 has an explicit yes or no.** | skills/darkprint/SKILL.md:309 | stop condition 5 | Normative |
| SKM-051 | That is exactly the set of facts `loadBundle` refuses a bundle over. | skills/darkprint/SKILL.md:311 | after stop condition | Factual |
| SKM-052 | The one that is load-bearing: a generator's `spec` must not paraphrase the criteria producer's. Under 0.35 3-gram Jaccard, no criterion named, no threshold quoted. | skills/darkprint/SKILL.md:321 | after "what you write" | Normative |
| SKM-053 | Nothing else. No `factory.dot`, no second `.dot`, and no card named `blueprint.yaml` or `extensions.yaml` — `/upload` reads roles off filenames and those two names are claimed by the manifest and the local vocabulary, so a card called either silently disappears from the bundle. | skills/darkprint/SKILL.md:351 | layout | Factual |
| SKM-054 | You cannot run `loadBundle`; it lives in the DarkPrint repo, not on this machine. | skills/darkprint/SKILL.md:364 | after writing, pre-flight | Factual |
| SKM-055 | An author surprised by `/upload` has been failed by this interview. | skills/darkprint/SKILL.md:372 | pre-flight | Normative |
| SKM-056 | Drop the whole folder on **http://localhost:3100/upload** — or **darkprint.io/upload** — and you will see the real graph and the six-axis score, computed by the same engine that validated the shipped blueprints. | skills/darkprint/SKILL.md:378 | feedback loop | Factual |
| SKM-057 | Nothing is uploaded, nothing is sent anywhere, and there is no server to send it to. | skills/darkprint/SKILL.md:381 | feedback loop | Factual |
| SKM-058 | The engine reads the bundle statically. It does not run any node, call any model or execute anything the graph describes. | skills/darkprint/SKILL.md:383 | feedback loop | Factual |
| SKM-059 | Publishing a blueprint to the DarkPrint registry is **not built yet**. There is no account, no private workspace, no sync and no push from your editor. Today a blueprint is a folder you own and share yourself, and `/upload` is where you read it. | skills/darkprint/SKILL.md:391 | honest ending | Factual |
| SKM-060 | Do not soften that into a waiting list, a "coming soon" you invent, or an implication that something exists that does not. | skills/darkprint/SKILL.md:395 | honest ending | Normative |
| SKO-001 | GENERATED FILE — do not edit by hand. | skills/darkprint/references/ontology.md:2 | header comment | Normative |
| SKO-002 | Rendered from lib/core/ontology/core.ts and lib/core/config.ts by scripts/skill-refs.ts. | skills/darkprint/references/ontology.md:3 | header comment | Factual |
| SKO-003 | scripts/generate-skill-refs.test.ts fails the suite if this file drifts. | skills/darkprint/references/ontology.md:5 | header comment | Factual |
| SKO-004 | Ontology version `0.1.0`. 49 terms. | skills/darkprint/references/ontology.md:10 | intro | Factual |
| SKO-005 | A term that is not here is `card/unknown-term` (error). A term of the wrong kind — a `data-type` in the `tools` list, a `tool` in `type` — is `card/wrong-term-kind` (error). | skills/darkprint/references/ontology.md:12 | intro | Normative |
| SKO-006 | Write `ontology_version: "0.1.0"` on every card. A card declaring a different version loads, and reports `bundle/ontology-mismatch` (warning) once per card. | skills/darkprint/references/ontology.md:16 | intro | Normative |
| SKO-007 | `phase: []` — or the field omitted entirely — is a **complete and correct answer**, and the validator emits nothing at all about it. | skills/darkprint/references/ontology.md:22 | phase section | Factual |
| SKO-008 | This is the one dimension that is never namespaced: `me/triage` as a phase is `card/namespaced-phase` (error). | skills/darkprint/references/ontology.md:27 | phase section | Normative |
| SKO-009 | Two of these are **abstract categories** and a node should not be typed with one: they exist so the metrics can ask a subsumption question. | skills/darkprint/references/ontology.md:41 | node-type section | Normative |
| SKO-010 | `human-gate` and `human-input` are subsumed by `human-in-the-loop` and carry `impliesHuman`, so a card declaring either **must** also declare `requires_human: true`. | skills/darkprint/references/ontology.md:44 | node-type section | Normative |
| SKO-011 | The autonomy fraction is the share of nodes whose `type` is *not* subsumed by `human-in-the-loop`. Bands: > 0.9 closed-loop, ≥ 0.7 conditional, ≥ 0.5 supervised, below that assisted. | skills/darkprint/references/ontology.md:48 | node-type section | Factual |
| SKO-012 | `tool`'s own description names running tests, which invites typing the test runner `tool`... the blueprint scores 4 on security because nothing was asked, not because nothing was found. | skills/darkprint/references/ontology.md:62 | the trap | Factual |
| SKO-013 | The security score starts at 4 and each distinct marker present anywhere in the blueprint is charged **once**, however many nodes carry it: `clamp(round(4 − Σ weights), 1, 4)`. | skills/darkprint/references/ontology.md:72 | risk-marker section | Factual |
| SKO-014 | a locally namespaced marker with no weight counts 0 and does not move the score. | skills/darkprint/references/ontology.md:75 | risk-marker section | Factual |
| SKO-015 | Three markers are **inferred** from the graph whether or not any card declares them. Declaring one the engine would have inferred anyway changes nothing; failing to declare one does not hide it. | skills/darkprint/references/ontology.md:78 | risk-marker section | Factual |
| SKO-016 | The cap is a **top-level** key of `params`, one of `max_iterations`, `maxIterations`, `max_retries`, holding a non-negative integer (`0` counts). | skills/darkprint/references/ontology.md:97 | unbounded-loop detail | Factual |
| SKO-017 | `messaging`, `git`, `vector-store`, `file-io`, `shell` and `python-sandbox` are deliberately excluded. | skills/darkprint/references/ontology.md:104 | unvalidated-external-access detail | Factual |
| SKO-018 | **Producers** are nodes declaring an output port whose type is subsumed by `acceptance-criteria`. | skills/darkprint/references/ontology.md:109 | criteria-leak precisely | Factual |
| SKO-019 | **Judges** are nodes typed `validation`, and **generators** are the predecessors of any judge, closed upward through non-judge nodes. | skills/darkprint/references/ontology.md:110 | criteria-leak precisely | Factual |
| SKO-020 | **topological** — walking forward from a producer, absorbing at judges, reaches a generator. The criteria reach the node whose work is being judged. | skills/darkprint/references/ontology.md:114 | criteria-leak precisely | Factual |
| SKO-021 | **declarative** — one node emits both an `acceptance-criteria` port *and* another port a directly connected judge reads as the artefact under judgement. | skills/darkprint/references/ontology.md:116 | criteria-leak precisely | Factual |
| SKO-022 | **content** — the 3-gram Jaccard similarity between a generator's `spec` and a producer's exceeds 0.35 (`analysis/criteria-leak-suspected`). | skills/darkprint/references/ontology.md:122 | criteria-leak warnings | Factual |
| SKO-023 | Specs under three words are excluded from the comparison entirely. | skills/darkprint/references/ontology.md:126 | criteria-leak warnings | Factual |
| SKO-024 | **relayed** — reachable only by walking *through* a judge (`analysis/criteria-relayed-through-judge`). | skills/darkprint/references/ontology.md:127 | criteria-leak warnings | Factual |
| SKO-025 | **out of band** — a `params` key matching `/criteri/i` naming something nothing in the graph produces (`analysis/criteria-out-of-band`). | skills/darkprint/references/ontology.md:131 | criteria-leak warnings | Factual |
| SKO-026 | **unanchored** — one of the two legs is missing... **The check did not run.** A 4 in this state is silence, not a pass. Both sets empty is silent by design. | skills/darkprint/references/ontology.md:134 | criteria-leak warnings | Factual |
| SKO-027 | Compatibility along an edge is directional: a source port fits a target port when the types are equal, when either side is `any`, or when the **source is narrower** than the target. | skills/darkprint/references/ontology.md:141 | data-type section | Factual |
| SKO-028 | **Do not reach for `any`.** It matches everything... A bundle typed `any` throughout loads perfectly and checks nothing. | skills/darkprint/references/ontology.md:145 | data-type section | Normative |
| SKO-029 | `acceptance-criteria` is load-bearing: it is the port type the entire `criteria-leak` machinery anchors on. Criteria typed `text` or `structured` are criteria the engine cannot see. | skills/darkprint/references/ontology.md:149 | data-type section | Factual |
| SKO-030 | `tools` says what the node is permitted to do. `mcp` says which installed server supplies it, is free text, and is checked against nothing. | skills/darkprint/references/ontology.md:198 | tool section | Factual |
| SKO-031 | `node-type`, `risk-marker`, `data-type` and `tool` accept a locally namespaced term (`me/my-term`), which must be rooted in an `extensions.yaml` carried by the bundle. `phase` never accepts one. | skills/darkprint/references/ontology.md:219 | local terms | Factual |
| SKO-032 | **Do not emit local terms unless the author asks for one and writes the extension.** An unrooted local term is silently ignored, which is the worst outcome available. | skills/darkprint/references/ontology.md:223 | local terms | Normative |
| SKD-001 | this skill does not emit `factory.dot` | skills/darkprint/references/dot-and-attractor.md:5 | intro | Factual |
| SKD-002 | `[A-Za-z_][A-Za-z0-9_]*`. No hyphens, no leading digit, never quoted. | skills/darkprint/references/dot-and-attractor.md:30 | node ids | Normative |
| SKD-003 | `digraph`, `edge`, `graph`, `node`, `strict`, `subgraph` are statement keywords and cannot open a node statement. | skills/darkprint/references/dot-and-attractor.md:34 | node ids | Factual |
| SKD-004 | `start`, `Start`, `exit`, `end` are legal here but Attractor resolves them as pipeline boundaries by name, and they collide with the entry and exit nodes DarkPrint synthesises when it compiles. | skills/darkprint/references/dot-and-attractor.md:36 | node ids | Factual |
| SKD-005 | The two grammars are incompatible for every multi-word name, so always write the pin explicitly. | skills/darkprint/references/dot-and-attractor.md:41 | node ids | Normative |
| SKD-006 | `card="id@version"` is canonical and always wins. | skills/darkprint/references/dot-and-attractor.md:48 | node ids | Factual |
| SKD-007 | An unpinned pointer (`card="solver"`, `card="solver@latest"`, `version="1.x"`) is `bundle/unpinned-card`, an **error**. | skills/darkprint/references/dot-and-attractor.md:51 | node ids | Factual |
| SKD-008 | Attributes are **comma**-separated. `[a=1; b=2]` and `[a=1 b=2]` are both `attractor/attr-separator`. | skills/darkprint/references/dot-and-attractor.md:55 | attribute syntax | Factual |
| SKD-009 | Comments are `//` or `/* … */`. A `#` comment is `attractor/hash-comment`. | skills/darkprint/references/dot-and-attractor.md:58 | attribute syntax | Factual |
| SKD-010 | `type` is a **reserved Attractor node attribute** and means *handler override*. DarkPrint's node type is an ontology term inside the YAML card and never a DOT attribute. | skills/darkprint/references/dot-and-attractor.md:65 | never write type= | Factual |
| SKD-011 | The same goes for the rest of Attractor's reserved node names — `prompt`, `max_retries`, `llm_model`, `label`, `shape`, `class`, `timeout`, `goal_gate`, `fidelity`, `thread_id`, `retry_target`, `fallback_retry_target`, `llm_provider`, `reasoning_effort`, `auto_status`, `allow_partial`. | skills/darkprint/references/dot-and-attractor.md:70 | reserved names | Factual |
| SKD-012 | On an **edge**, `label`, `condition`, `weight`, `fidelity`, `thread_id` and `loop_restart` are reserved. `out=` and `in=` are not. | skills/darkprint/references/dot-and-attractor.md:76 | reserved names | Factual |
| SKD-013 | Only the first graph in the file is read. It must be a `digraph`, and every edge `->`; a `graph` or a `--` edge is `dot/not-directed`, an **error** that stops the pipeline dead. | skills/darkprint/references/dot-and-attractor.md:81 | one graph one file | Factual |
| SKD-014 | Only **one** `.dot` file goes in the bundle. `/upload` classifies files by name: the first `.dot` or `.gv` is the topology and a second one is demoted with a note. | skills/darkprint/references/dot-and-attractor.md:85 | one graph one file | Factual |
| SKD-015 | never name a card `blueprint.yaml` or `extensions.yaml`. Those two names are claimed by the manifest and the local vocabulary. A card named either is classified as something else, vanishes from the card set, and every node pinning it reports `bundle/missing-card`. | skills/darkprint/references/dot-and-attractor.md:92 | filenames load-bearing | Normative |
| SKD-016 | Nothing in the engine requires a card's filename to match its `id` and `version`; the card's own fields are its identity. | skills/darkprint/references/dot-and-attractor.md:98 | filenames load-bearing | Factual |
| SKD-017 | DarkPrint's own exporter compiles a resolved bundle into a `factory.dot` that Attractor runs as it stands. **This skill does not write that file**. | skills/darkprint/references/dot-and-attractor.md:106 | Part 2 | Factual |
| SKD-018 | A `__start` and a `__exit` node are **synthesised** rather than borrowed from your graph: your entry node is an ordinary card node with a prompt to run. | skills/darkprint/references/dot-and-attractor.md:128 | Part 2 | Factual |
| SKD-019 | **`spec` is the prompt.** It is delivered to an agent that does not see the rest of the graph, so it has to be self-sufficient. | skills/darkprint/references/dot-and-attractor.md:135 | Part 2 consequences | Factual |
| SKD-020 | **`model` is a default, not a binding.** The compiled graph carries a model stylesheet whose rules can override it, and an explicit node attribute outranks the sheet. | skills/darkprint/references/dot-and-attractor.md:138 | Part 2 consequences | Factual |
| SKD-021 | **The iteration cap has one home.** Write it as a top-level key of `params`. The security analyzer and the exporter read it through the same function. | skills/darkprint/references/dot-and-attractor.md:141 | Part 2 consequences | Factual |
| SKP-001 | You cannot run the engine. It lives in the DarkPrint repository, not on this machine. | skills/darkprint/references/preflight.md:3 | intro | Factual |
| SKP-002 | Anything marked **error** means the bundle will not load, and you fix it. Anything marked *warning* the author will see on `/upload`, so **predict it out loud** before they do. | skills/darkprint/references/preflight.md:7 | intro | Normative |
| SKP-003 | The one that bites in practice: a plain scalar containing `": "` is read as a nested mapping. **Quote any value containing a colon-space**, or write it as a `>-` folded block. | skills/darkprint/references/preflight.md:38 | §3 card validates | Normative |
| SKP-004 | no key outside the accepted set — a typo is an `info` and is **silently ignored**, so check the spelling of `risk_markers` and `requires_human` by eye | skills/darkprint/references/preflight.md:58 | §3 card validates | Normative |
| SKP-005 | **subsumption** — `cannot: [structured]` refuses an incoming `acceptance-criteria`; `cannot: [acceptance-criteria]` does **not** refuse an incoming `structured`. | skills/darkprint/references/preflight.md:80 | §5 prohibitions | Factual |
| SKP-006 | **the carrier** — with no `out=` pin, the carriers are *every output of the source card*... `cannot` is the tripwire, not the whole guard. | skills/darkprint/references/preflight.md:82 | §5 prohibitions | Factual |
| SKP-007 | no output typed `any` upstream of a node with a narrower prohibition — `any` never violates anything and the whole mechanism goes inert | skills/darkprint/references/preflight.md:87 | §5 prohibitions | Normative |
| SKP-008 | `analysis/criteria-relayed-through-judge` | the fixer sits downstream of the judge that holds the criteria... Moves no score | skills/darkprint/references/preflight.md:134 | §9 predicted warnings | Factual |
| SKP-009 | `bundle/undeclared-dependency` | never fine. Fix it | skills/darkprint/references/preflight.md:135 | §9 predicted warnings | Normative |
| SKP-010 | `bundle/no-entry` / `bundle/no-exit` | never fine in a first emit. A blueprint with no source and no sink is a loop with no way in | skills/darkprint/references/preflight.md:136 | §9 predicted warnings | Normative |
| SKP-011 | `bundle/port-ambiguous` | never fine. Pin the edge | skills/darkprint/references/preflight.md:137 | §9 predicted warnings | Normative |
| SKP-012 | a card whose content changed has a **new version**, and the old file is **deleted**, not left beside it | skills/darkprint/references/preflight.md:147 | §10 re-emitting | Normative |
| SKP-013 | the bump is large enough: a changed `spec` prices as **minor**; a changed port, `type` or `param` prices as **major** | skills/darkprint/references/preflight.md:149 | §10 re-emitting | Normative |
| SKC-001 | GENERATED FILE — do not edit by hand. | skills/darkprint/references/card-schema.md:2 | header comment | Normative |
| SKC-002 | Rendered from lib/core/card/schema.ts and lib/core/card/validate.ts by scripts/skill-refs.ts. | skills/darkprint/references/card-schema.md:3 | header comment | Factual |
| SKC-003 | The wire format is **snake_case**... and the validator maps it onto the camelCase model quoted at the bottom of this file. | skills/darkprint/references/card-schema.md:10 | intro | Factual |
| SKC-004 | Exactly this set, and nothing else. An unrecognised key is reported as `info` and **ignored**, so a typo does not fail the card; it silently does nothing. | skills/darkprint/references/card-schema.md:16 | key list | Factual |
| SKC-005 | Writing both on one card is an `info` and the snake_case one wins. Prefer snake_case: it is what every shipped card is written in. | skills/darkprint/references/card-schema.md:48 | spellings | Normative |
| SKC-006 | A missing, null, non-string or blank value on any of these is an **error**, and no card comes back at all. | skills/darkprint/references/card-schema.md:54 | required fields | Factual |
| SKC-007 | `spec` | non-blank; under 40 trimmed characters is `card/spec-too-thin`, a warning | skills/darkprint/references/card-schema.md:63 | required fields table | Factual |
| SKC-008 | `inputs` | must be **present**; write `[]` explicitly when the node needs nothing | skills/darkprint/references/card-schema.md:64 | required fields table | Normative |
| SKC-009 | `required` | optional boolean, **inputs only**; on an output it is an `info` and is dropped. Defaults to true. | skills/darkprint/references/card-schema.md:76 | port table | Factual |
| SKC-010 | An entry that names a `data-type` is **enforced**. The resolver refuses any incoming edge whose *carrier* is that type or anything narrower, with `bundle/prohibition-violated`, an error. | skills/darkprint/references/card-schema.md:94 | `cannot` section | Factual |
| SKC-011 | pinning the edge to a different port satisfies the prohibition. The bundle then loads — and the analyzer charges `criteria-leak` anyway, because its topological walk reads the graph at node level and does not care which port an edge carries. | skills/darkprint/references/card-schema.md:101 | `cannot` section | Factual |
| SKC-012 | An entry that names anything else is **free text**. It is shown to a reader and checked by nothing... A misspelled data type downgrades silently to prose with no diagnostic anywhere. | skills/darkprint/references/card-schema.md:108 | `cannot` section | Factual |
| SKC-013 | A `type` subsumed by `human-in-the-loop`... with `requires_human` not set to `true` is `card/human-type-inconsistent`, an **error**. | skills/darkprint/references/card-schema.md:123 | cross-field rule | Normative |
| SKC-014 | A published version is never edited in place. Rewriting a card's content while leaving the old file beside it is `bundle/digest-mismatch` (error). | skills/darkprint/references/card-schema.md:129 | re-emitting | Normative |
| SKC-015 | the five phases are "the expected high level phases a dark factory should have, but do not necessarily have to stick to nodes". | skills/darkprint/references/card-schema.md:180 | NodeCard.phases JSDoc, doc 3 §1 citing "the author's ruling" | Factual (owner-quoted) |
| SKC-016 | Nothing downstream may render an empty list as a defect: it feeds phase coverage, which doc 2 §1.1 and doc 3 §2 make descriptive rather than a score. | skills/darkprint/references/card-schema.md:186 | NodeCard.phases JSDoc | Normative |
| SKC-017 | **A default rather than a binding**, and that is the whole of its contract... An explicit node attribute outranks the sheet, so `attractor/emit.ts` writing this field onto the node is what makes the downloaded bundle run on the named model until whoever runs it says otherwise. | skills/darkprint/references/card-schema.md:210 | NodeCard.model JSDoc | Factual |
| SKC-018 | Absent on most cards, and absence is an answer rather than a hole... Nothing that renders a card may draw the empty case as missing data. | skills/darkprint/references/card-schema.md:216 | NodeCard.model JSDoc | Normative |
| SKC-019 | an MCP server is a concrete process somebody installed, and the vocabulary has no term for one. | skills/darkprint/references/card-schema.md:232 | NodeCard.mcp JSDoc | Factual |
| SKC-020 | `code-builder` declaring `cannot: [acceptance-criteria]` makes the starter's absent edge a rule the analyzer checks, in place of a convention the author happened to remember. | skills/darkprint/references/card-schema.md:268 | NodeCard.cannot JSDoc | Factual |
| SKW-001 | The author decides the shape. You write the words. | skills/darkprint/references/writing-cards.md:3 | intro | Normative |
| SKW-002 | One sentence, imperative, naming the operation and the artefact. It is the line a reader scans; it is not the instruction the agent receives. | skills/darkprint/references/writing-cards.md:9 | `action` | Normative |
| SKW-003 | **`spec` is compiled into the node's `prompt`.** It is delivered verbatim to an agent that does not see the rest of the graph, so it has to be self-sufficient. | skills/darkprint/references/writing-cards.md:23 | `spec` | Factual |
| SKW-004 | Aim for **150–400 words**. Under 40 characters is `card/spec-too-thin`. Under three words is excluded from the similarity comparison entirely, so a placeholder card is both useless and unchecked. | skills/darkprint/references/writing-cards.md:28 | `spec` | Normative |
| SKW-005 | A node whose work is judged must not paraphrase the criteria producer's `spec`. The engine computes 3-gram Jaccard similarity between the two and warns above **0.35**. | skills/darkprint/references/writing-cards.md:41 | the rule you cannot break | Normative |
| SKW-006 | The starter blueprint's builder spec measures **0.0356** against its planner's. That is what independent prose looks like. | skills/darkprint/references/writing-cards.md:52 | the rule you cannot break | Factual |
| SKW-007 | whoever writes the work must not see the acceptance tests, because a node that sees them writes toward them, and the check stops measuring the work and starts measuring the aim. | skills/darkprint/references/writing-cards.md:56 | the rule you cannot break | Normative |
| SKW-008 | Six specs sharing a third of their trigrams cross the threshold against each other. Write each one about its own job, in its own words. | skills/darkprint/references/writing-cards.md:62 | house style | Normative |
| SKW-009 | A plain scalar containing `": "` is parsed as a nested mapping and the whole card fails with `card/parse-error`. | skills/darkprint/references/writing-cards.md:74 | port description | Factual |
| SKW-010 | Optional, and absence carries no judgement. | skills/darkprint/references/writing-cards.md:86 | `notes` | Normative |
| SKW-011 | **What the blueprint does**, in the author's own sentence from Q0.1. | skills/darkprint/references/writing-cards.md:105 | README.md contents | Normative |
| SKW-012 | **The edges, including the ones deliberately absent**, with a line per absence saying why. This is the section that earns the file. | skills/darkprint/references/writing-cards.md:107 | README.md contents | Normative |
| SKW-013 | Do not claim the bundle has been validated. It has not — the engine is not on this machine. | skills/darkprint/references/writing-cards.md:115 | README.md contents | Normative |
| SKW-014 | the one instruction that matters: **do not add an edge from the criteria producer into any node whose work is judged**, not even to hand over something else. | skills/darkprint/references/writing-cards.md:128 | AGENTS.md contents | Normative |
| SKW-015 | Content changed ⇒ new version, old file **deleted**, DOT pin updated. | skills/darkprint/references/writing-cards.md:138 | re-emitting | Normative |
| SKW-016 | When a card's identity is a parameter — the starter encodes its debugger's iteration cap as `1.<cap>.0` — keep that convention. | skills/darkprint/references/writing-cards.md:143 | re-emitting | Factual |
| TPL-001 | anything outside that set is silently ignored, so a typo in `risk_markers` does nothing rather than failing loudly. | skills/darkprint/templates/card.yaml:4 | header comment | Factual |
| TPL-002 | NEVER name a card file `blueprint.yaml` or `extensions.yaml`. | skills/darkprint/templates/card.yaml:7 | header comment | Normative |
| TPL-003 | The topological half of the `criteria-leak` check reads the graph at NODE level: any edge at all from the criteria producer into a judged node establishes the marker, whichever port that edge carries. | skills/darkprint/templates/blueprint.dot:42 | "THE EDGE THAT IS NOT HERE" comment | Factual |
| ARB-001 | A blueprint is a **graph plus the cards its nodes are pinned to**. It is stored as a folder of text and it is handed back as a folder of text. | architecture/blueprint.md:3-4 | intro | Factual |
| ARB-002 | Cards are **not** copied in. They live once in `content/cards/` and the DOT pins them by `id@version`, which is what lets one card serve many blueprints. | architecture/blueprint.md:21-22 | source layout | Factual |
| ARB-003 | **Nothing runs `planner -> builder`.** The acceptance criteria reach the node that judges the work and never the node that produces it. | architecture/blueprint.md:66-67 | DOT example commentary | Factual |
| ARB-004 | That absence is the point of the blueprint, and it is enforced twice — see `engine.md`. | architecture/blueprint.md:67-68 | DOT example commentary | Factual |
| ARB-005 | The parser is hand-written (lexer → recursive descent) and lives in `lib/core/dot/`. It is a subset, not full Graphviz: no subgraph mutation, no HTML labels. | architecture/blueprint.md:70-71 | DOT example commentary | Factual |
| ARB-006 | `factory.dot` runs as it stands. A runner handed that folder and nothing else has the whole instruction for every node, which is why no skill document needs to travel with it. | architecture/blueprint.md:98-99 | "what a reader downloads" | Factual |
| ARB-007 | Attractor **silently ignores unreserved attributes**, which is why `card="id@version"` can ride along in a file Attractor executes without confusing it. | architecture/blueprint.md:101-102 | same section | Factual |
| ARB-008 | Reserved attributes DarkPrint emits: `prompt`, `llm_model`, `max_retries`, `label`, `shape`, `goal`. | architecture/blueprint.md:103 | same section | Factual |
| ARB-009 | `resolveBundle` (`lib/core/bundle/resolve.ts`) turns a folder into a `ResolvedBlueprint`, or into diagnostics. | architecture/blueprint.md:110-111 | resolution section | Factual |
| ARB-010 | Any **error**-severity diagnostic means the bundle does not resolve. `lib/content/read.ts` throws on one, so a broken bundle fails the build rather than shipping. | architecture/blueprint.md:123-124 | resolution section | Factual |
| ARB-011 | `sha256` over canonical JSON, computed by a **pure-TypeScript** implementation (`lib/core/hash/`) because the engine must run in the browser. | architecture/blueprint.md:133-134 | digest section | Factual |
| ARB-012 | The digest is printed in the bundle README so a reader can verify that what they downloaded is what was scored. | architecture/blueprint.md:134-135 | digest section | Factual |
| ARB-013 | That last one has bitten before in spirit: an earlier export omitted a bundle's local ontology extensions, so DarkPrint's own upload rejected a folder DarkPrint had generated. | architecture/blueprint.md:149-151 | closing incident note | Factual |
| ARB-014 | **The test that matters is the round trip** — export a bundle, feed it back through `/upload`, and it must resolve with the same scores. | architecture/blueprint.md:151-152 | closing incident note | Normative |
| ARE-001 | 30 modules under `lib/core`. Everything the site claims about a graph is computed here. | architecture/engine.md:3 | intro | Factual |
| ARE-002 | **Hard constraint: `lib/core/**` is isomorphic.** No `node:fs`, `node:path`, `node:crypto`, no `Buffer`, no `Date.now()`, no `Math.random()`. | architecture/engine.md:5-6 | intro | Normative |
| ARE-003 | It runs unchanged in the browser, which is what lets `/upload` validate and score a bundle with no server. | architecture/engine.md:6-7 | intro | Factual |
| ARE-004 | `lib/content/read.ts` throws on an error-severity diagnostic, so a broken bundle **fails the build** rather than shipping. | architecture/engine.md:34-35 | pipeline section | Factual |
| ARE-005 | `lib/content/view.ts` is the only bridge from engine output to UI shapes, and it decides nothing — it translates. | architecture/engine.md:35-36 | pipeline section | Factual |
| ARE-006 | Thresholds live in `config.ts`. The ordinal band exists internally for sorting; **no surface ever prints it.** | architecture/engine.md:55-56 | autonomy section | Normative |
| ARE-007 | `isDarkFactory` — `totalNodes > 0 && autonomousNodes === totalNodes`. A literal **zero-human-node** test, not a threshold. | architecture/engine.md:58-59 | autonomy section | Factual |
| ARE-008 | An eleven-node graph clears 0.90 with a person still standing in it, so the fraction cannot carry that claim. | architecture/engine.md:59-60 | autonomy section | Factual |
| ARE-009 | A graph one gate short of it is not "nearly" anything. It is a supervised graph, which is a legitimate thing to be. | architecture/engine.md:62-63 | autonomy section | Normative |
| ARE-010 | Doc 2 §1.1 is enforced by tests here: no ordinal on any surface, no ranking, no badge. | architecture/engine.md:63-64 | autonomy section | Normative |
| ARE-011 | Starts at a clean **4** and subtracts weighted penalties for risk markers, then clamps. | architecture/engine.md:70-71 | security section | Factual |
| ARE-012 | **Open calibration item:** four of nine blueprints floor at security 1. Either the weights are too harsh or the scale is too short. | architecture/engine.md:84-85 | security section | Factual |
| ARE-013 | Doc 3 §9 left this for tuning against real data; see `../PROJECT.md` §3.3. Changing any weight is a PATCH of the ontology version. | architecture/engine.md:85-86 | security section | Normative/Factual |
| ARE-014 | The argument DarkPrint exists to make is that **isolation is a property of the graph**, and it is checked two independent ways. | architecture/engine.md:92-93 | criteria-leak section | Factual |
| ARE-015 | **topological** — is there a path carrying `acceptance-criteria` into a producing node? **similarity** — does a card's `spec` *paraphrase* the criteria? Jaccard over 3-gram shingles, threshold **0.35** (`config.ts`). | architecture/engine.md:100-102 | criteria-leak section | Factual |
| ARE-016 | A card isolated on the diagram and quoting the criteria in its prose is leaking in practice. | architecture/engine.md:102-103 | criteria-leak section | Factual |
| ARE-017 | Measured example: `code-builder@1.0.0` against `spec-planner@1.0.0` scores **0.0356**. | architecture/engine.md:105 | criteria-leak section | Factual |
| ARE-018 | Three bypasses were found and closed in this project by attacking the check's own design: absorption at *any* validation node (which made the engine's own remediation hint a recipe for hiding the leak), `tester → builder` reporting clean, and the check going silent when no node was typed `validation`. | architecture/engine.md:110-113 | criteria-leak blockquote | Factual |
| ARE-019 | A card's `cannot` entry naming an ontology data type is a rule. An incoming edge carrying that type raises **`bundle/prohibition-violated`**, an *error*, so the bundle does not resolve. | architecture/engine.md:117-118 | declared-prohibition section | Factual |
| ARE-020 | Same conclusion from two directions. This is what the `/build` switch demonstrate live, and both surfaces must report the **refusal before the score** — a bundle that does not resolve is not a bundle with a low number. | architecture/engine.md:127-129 | "the two together" | Normative/Factual |
| ARE-021 | **Descriptive only** — it never scores a graph for missing one, because a card's `phase` is optional and repeatable and phases describe the factory rather than every node. | architecture/engine.md:136-137 | phase coverage section | Normative |
| ARE-022 | Codes are `namespace/kebab-case` and carry a severity. Any **error** means the bundle does not resolve. | architecture/engine.md:143-144 | diagnostics section | Factual |
| ARE-023 | Every code should carry a **hint** that names the fix. The `version-bump-too-small` hint, for instance, lists every reason the bump was required — which is what makes the build failure actionable rather than annoying. | architecture/engine.md:153-155 | diagnostics section | Normative/Factual |
| ARE-024 | Content-addressed: canonical JSON → pure-TS sha256 → digest. Card versions are **archived side by side**, never edited in place, which is what lets a figure quote `targeted-debugger@1.0.0`'s `max_iterations: 3` and know it cannot drift. | architecture/engine.md:161-163 | archive section | Factual |
| ARE-025 | `lib/core/config.ts`, deep-frozen. Doc 1 §11, taken literally: every threshold and weight that real data will later move lives here and nowhere else, because scattered constants make calibration a treasure hunt. | architecture/engine.md:169-171 | config section | Factual |
| ARE-026 | The last two blocks describe features that **do not exist**. They are design, not behaviour; do not let a surface imply otherwise. | architecture/engine.md:182-183 | config section (promotion/telemetry, unused — no backend) | Normative/Factual |
| ARE-027 | **When you change a check, attack it before trusting it.** Every bypass listed above was found by asking "how would I get past this?" rather than by running the suite, and each one passed every test at the time. | architecture/engine.md:197-199 | closing note | Normative/Factual |
| ARN-001 | One node = one **card**. A card is a YAML document (JSON is accepted) describing what a single agent, tool, gate or check is, what it needs, what it produces, and what it must never see. | architecture/node-card.md:3-4 | intro | Factual |
| ARN-002 | `content/cards/code-builder@1.0.0.yaml` is the one to read first. It carries the isolation contract the entire site argues for. | architecture/node-card.md:15-16 | reference card section | Factual |
| ARN-003 | `spec` \| **The instruction handed to the agent.** Inlined into `factory.dot` as Attractor's `prompt`. This is the field that actually runs. | architecture/node-card.md:83 | field table | Factual |
| ARN-004 | `spec` is held to a minimum substance by `card/spec-too-thin`, and it is one of the two halves of the criteria-leak check: a spec that *paraphrases* the acceptance criteria leaks them even when the graph shows no edge. | architecture/node-card.md:86-88 | field table follow-up | Factual |
| ARN-005 | `model` \| **Absent emits nothing** rather than an empty string, so the graph's `model_stylesheet` still decides. | architecture/node-card.md:94 | field table | Factual |
| ARN-006 | `mcp` \| Concrete MCP server names. Free text, deliberately *not* merged with `tools` — they answer different questions. | architecture/node-card.md:97 | field table | Factual |
| ARN-007 | `skill` \| **DarkPrint stores the pointer and reads nothing at the other end.** No skill document travels in a bundle, and the bundle README says so. | architecture/node-card.md:98 | field table | Factual |
| ARN-008 | Port `type` is an **ontology `data-type` term**. Edge compatibility is checked against the type lattice, so `json` satisfies a port typed `structured`. | architecture/node-card.md:109-110 | interface section | Factual |
| ARN-009 | **`cannot` is the field that makes the site's argument checkable.** An entry naming an ontology data type is a prohibition on *receiving* it. | architecture/node-card.md:120-121 | limits section | Factual |
| ARN-010 | If an incoming edge carries that type, the bundle fails with `bundle/prohibition-violated` — an error, so it does not resolve at all. | architecture/node-card.md:121-122 | limits section | Factual |
| ARN-011 | The test is `ontology.isA(carrier.type, prohibited.id)` (`lib/core/bundle/resolve.ts`), which is reflexive and one-directional: `cannot: [structured]` fires against an edge carrying `json`, and `cannot: [acceptance-criteria]` is silent against an edge carrying the broader `structured`. | architecture/node-card.md:124-126 | limits section | Factual |
| ARN-012 | Entries that name no ontology term — `"read the checks the work will be run against"` — are **free text**: shown to a reader, checked by nothing. | architecture/node-card.md:128-129 | limits section | Factual |
| ARN-013 | The card page and `/spec/card` both say which is which, because that distinction is the site's whole claim. | architecture/node-card.md:129-130 | limits section | Factual |
| ARN-014 | `lib/core/version/bump.ts` derives the required bump from two cards. It is not advisory: `resolveBundle` runs it over a bundle's version chain, and `lib/content/read.ts` runs it over the whole library at build time, so a wrong number **fails the build**. | architecture/node-card.md:136-138 | versioning section | Factual |
| ARN-015 | **declaring a `cannot` entry** — it narrows what the node accepts \| **major** | architecture/node-card.md:143 | versioning table | Normative |
| ARN-016 | adding or changing `model` \| **minor** — an overridable default, not a narrowing | architecture/node-card.md:148 | versioning table | Normative |
| ARN-017 | The landing's annotated card and `/spec/card` read `code-builder@1.0.0` through `cardSource()`, so they cannot drift from the archive. Keep it that way — do not replace it with a transcription. | architecture/node-card.md:163-165 | closing note | Normative/Factual |
| ARO-001 | The controlled vocabulary the DOT and the cards both draw from. Version **0.1.0**. | architecture/ontology.md:3 | intro | Factual |
| ARO-002 | `phase` — 5, and the list is closed | architecture/ontology.md:25 | phase heading | Factual |
| ARO-003 | **Phases describe the factory, not every node.** A card's `phase` is optional and repeatable: a node may sit in several or in none. | architecture/ontology.md:31-32 | phase section | Factual |
| ARO-004 | Phase coverage is *descriptive* — it reports which phases a graph touches and never scores a graph for missing one. | architecture/ontology.md:32-33 | phase section | Normative |
| ARO-005 | Note the collision hazard: these five words are nearly the same as the five **roles** the site names on `/spec/topology` (planner, builder, tester, debugger, deployer). | architecture/ontology.md:35-36 | phase section | Factual |
| ARO-006 | A role is the job a node does in a graph; a phase is a field on a card drawn from this closed list. The site states the distinction wherever both appear. | architecture/ontology.md:36-38 | phase section | Factual |
| ARO-007 | `human-gate` and `human-input` are under `human-in-the-loop`, which is what `requires_human` must agree with and what `isDarkFactory` counts. | architecture/ontology.md:47-48 | node-type section | Factual |
| ARO-008 | The seven leaves carry weights in `lib/core/config.ts` and drive the security reading. | architecture/ontology.md:59 | risk-marker section | Factual |
| ARO-009 | An unrecognised marker weighs **0** — it is shown but never silently scored. | architecture/ontology.md:60 | risk-marker section | Normative |
| ARO-010 | The lattice is what makes port compatibility and `cannot` work. `isA` is **reflexive and one-directional**: `json` satisfies a port typed `structured`; `structured` does not satisfy one typed `json`. | architecture/ontology.md:72-74 | data-type section | Factual |
| ARO-011 | `acceptance-criteria` is the term the whole site turns on — it is what `code-builder@1.0.0` declares it `cannot` receive. | architecture/ontology.md:76-77 | data-type section | Factual |
| ARO-012 | These are *capabilities*. A card's `mcp` field names concrete servers and is deliberately separate: they answer different questions. | architecture/ontology.md:87-88 | tool section | Factual |
| ARO-013 | **A local term must be namespaced** (`owner/term`). An un-namespaced unknown term is `card/unknown-term`, an error. | architecture/ontology.md:107-108 | local extensions rules | Normative |
| ARO-014 | It must declare `broader`, pointing at a curated term, so it inherits a place in the lattice. | architecture/ontology.md:109 | local extensions rules | Normative |
| ARO-015 | `partitionTerms()` in `resolve.ts` is the one place that splits curated from local. Use it rather than counting terms yourself — a page that counted the overlay into the core is exactly how the old `/spec` came to print "50 terms" when the core has 49. | architecture/ontology.md:110-112 | local extensions rules | Normative/Factual |
| ARO-016 | **Extensions travel with the bundle.** `ontology/extensions.yaml` is exported into any bundle that uses local terms, or the download cannot reproduce its own scores. | architecture/ontology.md:113-114 | local extensions rules | Normative |
| ARO-017 | The version is stamped on every card (`ontology_version`) and every bundle. | architecture/ontology.md:120 | versioning | Factual |
| ARO-018 | The last one is easy to under-rate: moving a number re-scores every blueprint that already exists, which is why it is a version change at all and why every tunable lives in that one file rather than scattered through the analyzers. | architecture/ontology.md:128-130 | versioning | Factual |
| ARO-019 | **Before changing a weight, check the open calibration item** in `../PROJECT.md` §3.3: four of nine blueprints currently floor at security 1, which suggests the weights or the scale need tuning against real data rather than another ad-hoc nudge. | architecture/ontology.md:144-146 | closing note | Normative/Factual |
| ARR-001 | The structural reference for DarkPrint: what the pieces are, how they fit, and where the truth actually lives. | architecture/README.md:3-4 | opening description | Factual |
| ARR-002 | Written 2026-07-29 at commit `340931e`. | architecture/README.md:6 | dateline | Factual |
| ARR-003 | Every fact here is derived from code, and every section names the file it came from. | architecture/README.md:21 | "How to use these documents" | Normative |
| ARR-004 | When the two disagree, the code is right and the document is stale — fix the document. | architecture/README.md:22 | same section | Normative |
| ARR-005 | These are not specifications. The specifications are in `files/` (doc 1 design, doc 2 onboarding and positioning, doc 3 ontology v0.1), and the code cites them by section throughout. | architecture/README.md:24-26 | same section | Factual |
| ARR-006 | These documents describe **what was built**, so that a change can be made without re-deriving the whole system first. | architecture/README.md:26-27 | same section | Factual |
| ARR-007 | The reason this folder exists is that the project has three layers that must agree, and a change to any one of them silently invalidates the others. | architecture/README.md:31-32 | "Keeping them consistent" | Factual |
| ARR-008 | Before changing any of them, check the table in the relevant document under **"What breaks if you change this"**. | architecture/README.md:43-44 | same section | Normative |
| ARR-009 | **The ontology version is part of every card and every bundle.** Adding a term is a MINOR bump; removing or renaming one is MAJOR; moving a number in `lib/core/config.ts` is a PATCH, because it re-scores every blueprint that already exists. | architecture/README.md:48-50 | mechanical rule 1 | Normative |
| ARR-010 | **Nothing in `lib/core/**` may touch the host.** No `node:fs`, `node:path`, `node:crypto`, no `Buffer`, no `Date.now()`, no `Math.random()`. | architecture/README.md:51-53 | mechanical rule 2 | Normative |
| ARR-011 | The engine runs unchanged in the browser on `/upload`, and that is what lets the site validate a bundle without a server. | architecture/README.md:53-54 | mechanical rule 2, continued | Factual |
| ARR-012 | Read one bundle end to end. It is five files and it contains every concept. | architecture/README.md:57 | "The shortest path to understanding" | Normative |
| ARR-013 | Then read `content/cards/code-builder@1.0.0.yaml`, which carries the isolation contract the whole site argues for, and follow `cannot: [acceptance-criteria]` into `lib/core/bundle/resolve.ts` to see it enforced. | architecture/README.md:64-66 | closing instruction | Normative |
| ARW-001 | Next.js 16 App Router, **SSG only** — `generateStaticParams` + `dynamicParams = false`, typed `PageProps<"/route/[param]">`. 19 route files prerender to **136 pages**. React 19, Tailwind v4, TypeScript strict. | architecture/website.md:3-5 | intro | Factual |
| ARW-002 | `AGENTS.md` is not boilerplate: this is Next.js 16 with real breaking changes. Read `node_modules/next/dist/docs/` before touching a route or the config. | architecture/website.md:7-8 | blockquote (echoes AGENTS.md) | Normative |
| ARW-003 | `/blueprints` \| 1 \| the shelf. Download / compose / upload moved to the landing (lifecycle-scoring pass); this index is the grid and nothing under it | architecture/website.md:18 | routes table | Factual |
| ARW-004 | `/nodes/[...id]` \| 53 \| one card in full: interfaces, params, `mcp`, `skill`, `cannot`, risk markers, version history, raw YAML | architecture/website.md:21 | routes table | Factual |
| ARW-005 | `/install` \| "Install": the DarkPrint skill tutorial (`SkillSetup`) above a rule, `npx skills@latest add Brotherhood94/darkprint` and what the interview writes; under the rule, publishing/accounts/live push and the per-client MCP preview (`InstallTabs`), both badged, no server exists yet | architecture/website.md:46 | Do-routes table | Factual |
| ARW-006 | A redirect cannot carry a fragment, but a browser re-applies the one it started with to a `Location` that has none. | architecture/website.md:56-57 | redirects section | Factual |
| ARW-007 | Beat 4 is the lifecycle-scoring pass's rewrite of the three-panel section that used to sit below the `/blueprints` grid (download / **fork** / update). | architecture/website.md:76-77 | landing section | Factual |
| ARW-008 | Fork is not one of its three panels any more — it moved to the blueprint detail page as `ForkAction`, a real interaction beside the graph it applies to, closer than a landing panel three clicks from any one blueprint. | architecture/website.md:77-80 | landing section | Factual |
| ARW-009 | **compose** (new — composing/wiring one graph into another is a property of the DOT format, true today, no disclaimer needed), and **upload** (links to `/upload`, states plainly that publishing so others can find it is not built). | architecture/website.md:80-83 | landing section | Factual |
| ARW-010 | See `PROJECT.md` §4 for the honesty pattern this established: describe the real interaction an ask maps to, never the account system it was phrased in terms of. | architecture/website.md:83-85 | landing section | Normative |
| ARW-011 | The ~370-word figure is `HomePage` rendered through `renderToStaticMarkup`, tags stripped and entities resolved, minus text a sighted reader never sees. | architecture/website.md:87-89 | landing word-count methodology | Factual |
| ARW-012 | A raw count with none of that excluded reads 451 — the difference is invisible text, not added prose. | architecture/website.md:91-92 | landing word-count methodology | Factual |
| ARW-013 | There used to be a fifth beat here — the lights going out across the starter graph (`SectionLightsOut.tsx`), describing a blueprint with no human node. | architecture/website.md:94-96 | landing history | Factual |
| ARW-014 | Cut from the landing at the author's request; doc 2 §1.1's constraint that beat existed to guard (a graph with a person in it is a first-class blueprint, never a shortfall) still binds every autonomy reading on the site, just no longer illustrated here. | architecture/website.md:96-98 | landing history | Factual (owner-referenced) |
| ARW-015 | `app/page.tsx`'s header comment records this, so nobody "restores" the spine. | architecture/website.md:111 | landing history | Factual |
| ARW-016 | The author rejected the earlier CAD-box register by name while keeping the blueprint grid. | architecture/website.md:125 | figure-language section | Factual (owner-referenced) |
| ARW-017 | So: a node is a **lit disc with a halo**, an edge is a **curve with a light travelling it**, an absence is a dashed hairline, and the graticule is untouched. | architecture/website.md:125-127 | figure-language section | Factual |
| ARW-018 | **`static` is the finished drawing.** `useReveal` returns `static \| armed \| shown`. `static` is the server, no-JS and `prefers-reduced-motion`, and in that state the markup is already complete. Animation is what gets *added*, never what reveals. | architecture/website.md:142-144 | load-bearing rule 1 | Normative |
| ARW-019 | **Labels are never `display:none`.** They are real text at SSR, revealed by opacity. Hover is a reveal, not existence. | architecture/website.md:146-147 | load-bearing rule 2 | Normative |
| ARW-020 | so touch, narrow viewports and reduced motion show every label unconditionally. Every node is focusable, so a keyboard reveals what a pointer reveals. | architecture/website.md:148-150 | load-bearing rule 2 | Factual |
| ARW-021 | **`role="group"`, not `role="img"`.** An `img` role makes the subtree presentational, which would silence the focusable nodes inside it. | architecture/website.md:152-153 | load-bearing rule 3 | Normative |
| ARW-022 | **Never animate an element that carries its own `transform` attribute.** anime.js writes `style.transform`, and a CSS transform *replaces* an SVG presentation attribute outright. | architecture/website.md:155-156 | load-bearing rule 4 | Normative |
| ARW-023 | That shipped once: beat 3's card was drawn at the SVG origin, half off-canvas, for everyone with motion enabled — and the prerendered HTML was correct, so no SSR test could see it. | architecture/website.md:157-158 | load-bearing rule 4 | Factual |
| ARW-024 | `FlowLift` is the anchor/inner-group pattern that fixes it, and `flow.test.ts` fails if any scene animates a transformed element. | architecture/website.md:159-160 | load-bearing rule 4 | Factual |
| ARW-025 | The v3 default export **does not exist** in this package. | architecture/website.md:164 | anime.js version note | Factual |
| ARW-026 | `createSeededRandom` (**never `Math.random`** — scenes render on the server). | architecture/website.md:167-168 | anime.js version note | Normative |
| ARW-027 | `roles-labels.test.ts` **covers the roles figure only.** Generalising it is `../PROJECT.md` §3.2, and it is the highest-value small task on the list — it caught four defects the size-only check could not see. | architecture/website.md:183-185 | guards section | Factual |
| ARW-028 | **rename or remove a route** \| add a redirect in `next.config.ts`; internal links; and grep the *comments* — stale route references have survived three passes | architecture/website.md:194 | "what breaks" table | Factual |
| ARW-029 | **touch autonomy rendering** \| the ordinal must not reappear: `grep -rniE "autonomy (level\|score\|rank\|rating\|tier\|[0-9])" .next/server/app public/bundles` must return nothing | architecture/website.md:197 | "what breaks" table | Normative |