# DarkPrint — architecture

## 0 · Header

**Purpose.** This is the canonical description of DarkPrint (darkprint.io) as it exists in
this repository today: a frontend-only Next.js application whose UI is itself the
specification of a backend that has not been built. It exists so that whoever implements
that backend can read the UI's own promises — every disabled control, every seeded number,
every `◐ seeded` marker — as a contract, rather than reverse-engineering one from the
components.

**Who updates it and when.** Whoever changes a route, an entity shape, or a UI element that
implies a server interaction updates the corresponding section (and, for [8 · Backend
contract seams](architecture/seams.md), the matching `TODO(SEAM-xx)` comment in the code) in
the same change. This document does not get updated speculatively or on a schedule — see
[12 · Maintenance protocol](#12-maintenance-protocol-and-revision-log).

**Last verified against commit `16cbc40` on 2026-08-22.**

**Stack summary.** Next.js 16.2.11 (App Router, Turbopack, no Pages Router code), React
19.2.4, TypeScript 5 (`tsc --noEmit` as the type gate), Tailwind CSS v4 (CSS-first
`@theme` config in `app/globals.css`, no `tailwind.config.*` file), Vitest 4 for tests,
ESLint 9 (`eslint-config-next`). `@xyflow/react` renders the interactive graph canvas,
`animejs` 4.5 drives the hero and luminous-flow animation, `yaml` parses card/manifest
files, `opentype.js` generates the wordmark's SVG paths at build time, `@vercel/analytics`
is the only telemetry. Node >=22.18.0. No backend, no database, no auth provider — every
data source is either the `content/` archive (read at build time) or a seeded fixture in
`lib/data/**`.

**How to run locally.**

```
npm run dev          # dev server
npm run build         # prebuild regenerates public/bundles + public/cards from content/, then next build
npm run typecheck      # tsc --noEmit
npm run lint            # eslint
npm test                 # vitest run
```

`npm run build`'s `prebuild` step (`scripts/generate-bundles.ts`) rewrites `public/bundles/**`
and `public/cards/**`. Expect that diff and commit it, or run `rm -rf .next public/bundles`
first for a clean rebuild.

---

## Index

This document is split where a section's carried-over source material made it too long to
inline. Sections 2, 3, 4, 5 and 8 live in `docs/architecture/`; everything else is below.

0. [Header](#0-header) — this section
1. [The product in one page](#1-the-product-in-one-page)
2. [Domain glossary](architecture/glossary.md)
3. [Concept model](architecture/concept-model.md)
4. [Sitemap and routing](architecture/routes.md)
5. [User journeys](architecture/journeys.md)
6. [Frontend architecture](#6-frontend-architecture)
7. [State and data flow](#7-state-and-data-flow)
8. [Backend contract seams](architecture/seams.md)
9. [Design system](#9-design-system)
10. [Cross-cutting](#10-cross-cutting)
11. [Known gaps and decisions](#11-known-gaps-and-decisions)
12. [Maintenance protocol and revision log](#12-maintenance-protocol-and-revision-log)

---

## 1 · The product in one page

DarkPrint's own claim, verbatim and load-bearing (`components/hero/Wordmark.tsx:105`,
mirrored in the default page title, `app/layout.tsx:39`):

> **Reusable blueprints for agent workflows.**

**What it offers.** A public registry of *blueprints* — graphs of automations described as
a DOT topology plus versioned *node cards* — that a reader can browse, inspect down to the
YAML and DOT bytes, statically score (autonomy, static risk exposure, phase coverage), and
download. A companion vocabulary (*ontology*) gives every card's type, tools and risk
markers a shared, versioned meaning. Nothing on the site runs a blueprint: DarkPrint
distributes files and reads them back; composing and running both happen on the reader's
own machine, with their own harness (D-03, `OWNER-STATED`, `CONFIRMED` — no runner exists
anywhere in `lib/`).

**To whom.** The landing's "two ways in" band and the six client configs on `/mcp` and
`/skill` (Claude Code, Codex, Claude Desktop, Cursor, VS Code, Gemini CLI,
`components/mcp/clients.ts:16`) name the audience directly: people who already run a coding
agent or harness and want a reproducible, inspectable unit of work to hand it, rather than
a one-off prompt.

**The core value loop**, read off the landing's own five beats (`app/page.tsx:113-131`,
docblock at `:1-111`) and the lifecycle panel that closes the page
(`components/home/SectionLifecycle.tsx`):

1. **Claim** (Hero) — reusable blueprints, not prompts, are the artefact.
2. **Reproducibility argument** (`SectionSameRun`) — a blueprint pins the steps a harness
   takes, so a rerun is the same run and a change is attributable; a prompt lets the harness
   invent its own route, so nothing about it can be held constant
   (`docs/DECISIONS.md` D-04, `OWNER-STATED`, `CONFIRMED`).
3. **The blueprint itself** (`SectionBlueprint`) — a DOT graph of nodes, each a pointer at a
   card, drawn off a real archived bundle.
4. **The node card** (`SectionNodeIsCard`) — one reusable, versioned unit of work, drawn off
   a real archived card.
5. **What a reader does with it** (`SectionLifecycle`) — download it, compose it into
   something bigger, or upload it for the analyzer to read; the panel links each action to
   its page (`/blueprints`, `/build`, `/upload`).

The page ends there — on the lifecycle panel's own links — rather than on a separate
"find one / build one" doors section, which the author had cut as a redundant second
statement of the same two-way choice (`app/page.tsx:56-68`).

**Where the landing and the rest of the site agree, and where they used to disagree.** They
agree today. D-01 (`OWNER-STATED`, `CONFIRMED`, `docs/superpowers/specs/2026-08-04-ia-redesign.md:12-15`)
settles that blueprints, not "the dark factory," are the headline, and D-02 (same
provenance) settles "dark factory" as a *computed property* of one graph shape — every node
unattended and all five phases covered — never the site's category or its goal. The current
build matches both: `/towards-a-dark-factory` is one explainer page reached from the Learn
menu, not a nav-level category, and `isDarkFactory` never appears as a headline number
anywhere (`lib/core/analysis/autonomy.ts:317`). This *was* a real, recorded disagreement:
D-09 records the site's headline once being "Autonomy you can read as a graph"
(`commit feaa9bc`), later retired from every on-site surface in favour of the current claim
(D-09 is marked `CONTRADICTED` — i.e., superseded — in the decision ledger, and the phrase
survives only in the repository's root `README.md:4`, which is project documentation, not
UI copy a visitor reads). No other landing-vs-site claim conflict was found: the six landing
beats, the Learn sequence, and every route's own `generateMetadata` describe the same three
primitives (blueprint, node card, ontology) throughout.

---

## 6 · Frontend architecture

### 6.1 · Layer model

Eight layers, lowest to highest. Import directions were verified by grep, not assumed from
naming.

| Layer | What it is | May import from |
|---|---|---|
| `lib/core/**` | The isomorphic domain engine: DOT parsing, card/ontology validation, autonomy and security analysis, hashing, version-bump checking. Verified clean — zero occurrences of `node:*`, `Buffer`, `Date.now()` or `Math.random()` outside test files, confirming `CLAUDE.md`'s isomorphism rule against the actual code rather than trusting the doc | nothing else in the app |
| `lib/data/**` | Seeded/mock fixtures — authors, accounts, community signals, owned bundles. Each file's own header states it exists because there is no backend yet (`lib/data/community.ts:1-9`: "this module *is* the database... until there is a real one") | sibling `lib/data/*` files, `lib/types.ts` only |
| `content/**` | The archive on disk: `blueprints/<slug>/blueprint.dot` + `blueprint.yaml`, `cards/<id>@<version>.yaml`, `ontology/extensions.yaml`. Not code; read by `lib/content/read.ts` via `readFileSync`/`readdirSync` | — |
| `lib/content/**` | The server-only archive reader/aggregator. `read.ts` is the one file in the repo touching the filesystem and self-guards with a runtime throw if `typeof window !== "undefined"` (`lib/content/read.ts:49-52`). Two sibling files, `ontology-file.ts` and `bundle-export.ts`, are isomorphic (no `node:fs`) and are the only parts of `lib/content` imported by client components | `lib/core`, `lib/data`, top-level `lib/*.ts` |
| `lib/*.ts` (top-level) | Mixed utility layer: `types.ts`, `format.ts`, `href.ts`, `mcp.ts`, `skill.ts`, `criteria-state.ts`, `graph-seed.ts`. Not strictly isomorphic as a group — `graph-seed.ts` imports `layeredLayout` from `lib/content/layout` | `lib/core`, `lib/content` (the isomorphic parts) |
| `components/**` | UI, organised as one `ui/` primitives folder plus 22 feature folders (below) | `lib/core`, `lib/content` (server components only), `lib/data`, top-level `lib/*` |
| `app/**` | Routes. All spot-checked pages are server components (no `"use client"`) | `components/**`, `lib/**` |
| `public/bundles/**`, `public/cards/**` | Generated static mirror of `content/`, written by `scripts/generate-bundles.ts` at the `prebuild` step | — |

**One documented layering violation.** `lib/mcp.ts:24` imports `MCP_CLIENTS` from
`@/components/mcp/clients` — a top-level `lib/*.ts` file importing from `components/`,
inverting the `lib → components` direction the rest of the layer table holds. The file's
own comment (`lib/mcp.ts:12-21`) states this is deliberate: deriving the landing's one-line
command from the same array `/mcp`'s tab strip renders keeps "exactly one place to change
it," and `mcp.test.ts` pins `MCP_CLIENTS[0]` being Claude Code so a silent reorder is
caught. No cycle results (`components/mcp/clients.ts` does not import back), so it is a
one-way, tested inversion rather than a defect — flagged here because a clean-layering rule
should note its one exception rather than imply there are none.

No other violations were found: no `components/` → `app/` import in shipped code (only in
test files that mount a page component for integration testing, e.g.
`components/site/honesty.test.ts:38-41`), no `lib/core` import of anything outside
`lib/core`, and no `lib/data` import of `lib/core` or `lib/content`.

Legend: green = `LIVE` (real data/behaviour), amber = `MOCK` (fixture-backed), grey/dashed =
`PLANNED` (shape declared, nothing behind it) — the same three tags used throughout this
document (see [4 · Sitemap and routing](architecture/routes.md#status-tags)). The dashed
edge is the layering violation noted above, not a status.

```mermaid
flowchart LR
  classDef live fill:#0f5132,stroke:#0f5132,color:#fff
  classDef mock fill:#664d03,stroke:#664d03,color:#fff
  classDef planned fill:#41464b,stroke:#41464b,color:#fff,stroke-dasharray: 4 3

  app["app/**\n(routes)"]:::live
  components["components/**\n(UI)"]:::live
  libTop["lib/*.ts\n(types, format, href, mcp, skill, graph-seed)"]:::live
  libContent["lib/content/**\n(server-only archive reader)"]:::live
  libData["lib/data/**\n(mock account+community fixtures)"]:::mock
  libCore["lib/core/**\n(isomorphic engine)"]:::live
  content[("content/**\n(the archive on disk)")]:::live
  public[("public/bundles, public/cards\n(generated mirror)")]:::live
  scripts["scripts/**\n(build-time generation)"]:::live

  app --> components
  app --> libTop
  app --> libContent
  components --> libCore
  components --> libContent
  components --> libData
  components --> libTop
  libTop --> libContent
  libTop -.->|"violation: lib -> components,\nlib/mcp.ts:24"| components
  libContent --> libCore
  libContent --> libData
  libContent --> content
  scripts --> content
  scripts --> public
  scripts --> libCore
```

### 6.2 · Directory tree

**`app/`** — routes (App Router; every spot-checked page is a server component):

| Path | Purpose |
|---|---|
| `page.tsx`, `layout.tsx`, `globals.css`, `icon.svg` | Home page, root layout (fonts, header/footer chrome, skip link, `Analytics`), design tokens, favicon |
| `blueprints/`, `blueprints/[slug]/` | Blueprint gallery and detail page |
| `build/` | The `/build` interactive workspace (starter template + three controls) |
| `mcp/` | MCP client install/registry design-proposal page |
| `nodes/`, `nodes/[...id]/` | Node/card browser and detail |
| `ontology/`, `ontology/[...term]/` | Ontology term browser and detail |
| `reading-the-radar/` | Scorecard explainer |
| `settings/` | Account settings page (mostly disabled controls) |
| `skill/` | Claude Code skill install page |
| `spec/topology/`, `spec/card/`, `spec/ontology/` | The three format layer pages |
| `towards-a-dark-factory/` | Long-form explainer / the 1-5 maturity ladder |
| `u/[username]/`, `.../blueprints/`, `.../cards/`, `.../saved/`, `.../terms/` | Public profile and its four tabs |
| `upload/` | Bundle upload/validation wizard |
| `what-a-blueprint-is/` | Learn stop 00, the door to the three layer pages |

**`components/`** — UI, one primitives folder plus 22 feature folders:

| Folder | Purpose |
|---|---|
| `ui/` | Generic design-system primitives — 34 files (buttons, badges, meters, pills, cards, rails, diagnostics list, etc.); the largest and most reused folder |
| `blueprint/` | Blueprint detail-page UI: canvas, requirements, evidence layers, comments, fork/clone/download actions |
| `bundle/` | Bundle file tree, header, version history, the `load.ts` view-model builder |
| `build/` | The `/build` workspace: state machine, score panel, choice graph pane, vocabulary pane, download step |
| `explain/` | Concept-explainer figures and run-layer diagrams used on explainer pages |
| `gallery/` | The blueprint gallery browser (single file) |
| `graph/` | DOT/flow graph rendering primitives shared by every canvas |
| `hero/` | The landing hero: wordmark animation, setup chips, grid spotlight |
| `home/` | Landing-page sections (lifecycle, blueprint, node-card beats) and their supporting geometry/data |
| `learn/` | The Learn-shell rail and figures shared across the Learn sequence |
| `mcp/` | MCP client config data and install-tabs UI |
| `nodes/` | Node/card browser, summary, interfaces, version history |
| `ontology/` | Ontology term table/tree/catalog/vocabulary browser |
| `panes/` | The multi-pane layout system (graph pane, source pane, DOT breakdown, synchronized panes) used by `/build` and blueprint detail |
| `profile/` | Profile shell, tabs, owned bundles/cards, pinned/saved lists, `load.ts` |
| `settings/` | Settings form fields and controls |
| `site/` | Global chrome: header, footer, logo |
| `skill/` | Skill-install setup UI |
| `spec/` | Spec-page tables, rows, scoring-model figure |
| `upload/` | Upload flow, dropzone, validation report |
| `viz/` | The shared SVG "luminous flow" drawing system: scenes, tokens, easing, reveal/scroll hooks |
| `mcp/`, `skill/` | (listed above) |

**`lib/`**:

| Folder / file | Purpose |
|---|---|
| `core/` | The isomorphic engine — `analysis/` (autonomy, security, phase-coverage), `archive/` (registry, store), `attractor/` (emit, lint), `bundle/` (resolve, types), `card/` (parse, schema, validate), `dot/` (lexer, parser, graph), `hash/`, `ontology/`, `version/`, plus `config.ts`, `diagnostics.ts`, `index.ts` (the barrel — an explicit inventory of the engine's public surface) |
| `content/` | Server-only archive reader/aggregator — `read.ts` (fs reader, guarded), `index.ts` (build-time cache), `view.ts` (blueprint view model), plus the two isomorphic files `bundle-export.ts` and `ontology-file.ts` |
| `data/` | Mock/seed fixtures — `account.ts`, `bundles.ts`, `community.ts`, `node-community.ts`, `profiles.ts`, `users.ts` |
| `starter/` | The `/build` variant engine — `variants.ts` (pure, deterministic: three choices in, one `Bundle` out) and `cards.ts` |
| `types.ts`, `format.ts`, `href.ts`, `mcp.ts`, `skill.ts`, `criteria-state.ts`, `graph-seed.ts` | Shared domain types and small utilities |
| `db/` | **Backend, LIVE.** Postgres via Drizzle — `schema.ts` (**16 tables** — T000's ten: `account`, `handle_reservation`, `ontology_version`, `ontology_term`, `bundle`, `release`, `card_version`, `target`, `target_actor`, `audit`; T005's six: `save`, `ballot`, `note`, `note_vote`, `run_report`, `api_key`), `migrations/` with paired up/down SQL, `migrate.ts` + `cli.ts` (the runner behind `npm run db:migrate` / `db:rollback`), `client.ts`, and `storage.ts` (the S3-compatible object client, keyed by digest). Merged at `ec516fa`, tagged `t000-verified`; extended by T005 at `011a851`, tagged `t005-verified` |
| `server/auth/` | **Backend, LIVE.** GitHub OAuth — `github.ts` (the provider exchange), `oauth-state.ts`, `cookie.ts` (HMAC-signed), `session.ts` (`SessionToken` is signed and carries `exp`; `SessionPayload` is what a handler receives and carries `{ accountId, handle }` only), `guard.ts` (`withSession`). Expiry, **not** revocation: a stolen cookie stays valid until `exp` |
| `server/http/` | **Backend, LIVE.** The response envelope of B-03 — `ok.ts` for payloads at 200, `problem.ts` for RFC 9457 `application/problem+json` |
| `server/archive/` | **Backend, LIVE.** Bundle records and their append-only releases — `bundle.ts`, `release.ts`, `well-formed.ts` (an iterative, path-scoped walk that refuses content Postgres would silently rewrite), `constraints.ts` (index names derived from the schema at runtime, never restated), `errors.ts`. Merged at `3fd050f`, tagged `t010-verified` |
| `server/cards/` | **Backend, LIVE.** One immutable row per `(cardId, version)` with its digest, owner and visibility. Reads take an `Actor` and filter through `server/policy`, so a private card is unreadable by anyone but its owner and an operator at the storage boundary rather than by caller convention. `addCard` requires a strict semver — narrower than `REF_VERSION`, because `compareSemver` cannot order `1.0` and "latest" must always be defined. Merged at `aee6e07`, tagged `t020-verified` |
| `server/versioning/` | **Backend, LIVE.** Server-authoritative bump inference for blueprints and ontologies (`lib/core` already carried the card path) — `blueprint-bump.ts`, `ontology-bump.ts`, `declared-bump.ts`. An ambiguous pairing infers the **most expensive residue-free explanation**, never the cheapest, so an under-declared bump is refused rather than shipped. Merged at `87dffd8`, tagged `t025-verified` |
| `server/policy/` | **Backend, LIVE.** The authorization decision — `can.ts`, `visible-to.ts`, `is-owner.ts`. Pure, zero runtime imports, never throws, no default-allow. Two subjects only: a resource's owner and a break-glass operator (B-13). Merged at `eef7cce`, tagged `t060-verified` |
| `server/ontology/` | **Backend, LIVE.** The published vocabulary and its versions — `store.ts` (publish/read a version), `view.ts` (`openView`, the read model a page or route consumes), `bump.ts`, `errors.ts`. Versions are immutable: a republish of an existing semver is refused with `DuplicateOntologyVersionError` rather than overwriting, and a declared bump smaller than the terms require is refused with `VersionBumpTooSmallError`. Merged at `1f9a9d0`, tagged `t030-verified` |
| `server/registry/` | **Backend, LIVE.** The cross-store read model the `/api` routes are served from — one query layer over `server/cards`, `server/archive` and `server/ontology`, taking an `Actor` and filtering every row through `server/policy` so visibility is decided once at the storage boundary rather than per route. **The first module any route actually calls**, which is the condition §12's revision log named for re-reading the seams. Merged at `8656c32`, tagged `t080-verified` **Extended by T081 with `errors.ts`, `store.ts` and `http.ts`**: `withRegistryStore` converts **every** rejection because this read model has **no decisions** — measured, `grep -rn "throw "` over every non-test file returns zero, and every empty answer is a **value** because B-03 answers 404 over 403 — so a classified subset would fail **open** on the clause the wrapper exists for. `withRegistryErrors` answers `problem+json` **500** `store-failed` on all eleven routes with `detail` the instance's own `message` byte for byte (D-81-01/02). Merged at `8656c32` tagged `t080-verified`, extended at `752721d` tagged `t081-verified` |
| `server/export/` | **Backend, LIVE.** Distribution — turning a stored release back into the files an agent runs. `export-release.ts` (the folder as bytes), `serve-file.ts` / `serve-card.ts` (one file at a time), `build.ts`, `lookup.ts`, `vocabulary.ts`, `content-type.ts`, `downloads.ts`, `errors.ts`. Every input comes from Postgres — `release.dot`, `release.manifest`, `card_version.source`, `release.local_vocabulary` — so this module touches object storage nowhere (D-90-07). `ExportReadError` is a **sibling** of `ExportError`, not a subclass, so a read failure and a caller error cannot be told apart by a single `instanceof` that catches both. Merged at `6d746ff`, tagged `t090-verified` |
| `server/engine/` | **Backend, LIVE.** The authoritative parse-resolve-analyze pass over submitted bytes, consuming `@/lib/core` and nothing else from the application. Publishes `LimitExceededError`, `CircularReferenceError` and `UnserializableValueError`. **Its byte guard is an ITERATIVE walk with an explicit frame stack, `MAX_NESTING_DEPTH = 10 000` refusing as a typed error, and a size that matches `Buffer.byteLength(JSON.stringify(input))` — measured against a 486-cell corpus generated over `SerializeJSONProperty`'s own branches rather than a list.** `limits.ts` carries the audit that ends five rounds of one defect class: **seven spec operations delegated, eleven transcribed**, delegated being safe by construction. Merged at `ad44537`, tagged `t040-verified` |
| `server/naming/` | **Backend, LIVE.** Every user-chosen identifier — handles, bundle slugs, card ids, term namespaces — and the permanence of their reservations. `handles.ts`, `slugs.ts`, `grammar.ts` (one grammar derived from the engine's `CARD_ID`, round-tripped rather than parsed, since `parseCardRef` trims and would reserve a different primary key than the one asked for), `suggest.ts`, `reserved.ts`, `constraint.ts`, `errors.ts`. A handle is **permanently reserved once used**: a released handle can never be claimed by a second account, and **can** be reclaimed by its original holder — one atomic `ON CONFLICT DO UPDATE … WHERE handle_reservation.account_id = excluded.account_id`, which never raises, so the module reads `rowCount` and refuses. Merged at `38eb820`, tagged `t070-verified` |
| `server/accounts/` | **Backend, LIVE.** The account record, its four editable surfaces and the GitHub session. `read.ts`, `write.ts`, `validate.ts`, `store.ts`, `http.ts`, `errors.ts`, `guards.ts`. **`withStore` lets *decisions* through unwrapped and sanitizes everything else** (D-13), and `withAccountErrors` maps every class `isDecision` recognises to `problem+json` — status per class (409 `HandleTakenError`, 400 `InvalidNameError`, 500 `NamingStoreError`/`AccountStoreError`) with **`detail` the instance's own `message` byte for byte**, so a foreign fault keeps the operation name of the call that actually failed. Merged at `194dd86`, tagged `t050-verified` |
| `server/saves/` | **Backend, LIVE.** Private bookmarks over B-10's polymorphic `(kind, id)` target — blueprint, card and term. `read.ts`, `write.ts`, `visible.ts`, `store.ts`, `http.ts`, `guards.ts`, `errors.ts`, `types.ts`. **A save is private and so is its COUNT**: `countSaves` returns `0` for a denied caller, so *not yours*, *no such account* and *yours and empty* are indistinguishable (D-140-01), and the count is derived from the same filtered query as the list so the two agree by construction. **`visibleTo` asks a different question per kind** and the asymmetry is deliberate — blueprints and cards ask *visible*, terms ask *exists*, because `ontology_term` has no owner column and B-07 makes terms public (D-140-03). **Consumes `NotAccountOwnerError` from `server/accounts` rather than minting a second class** and publishes `SaveStoreError` for D-13 (D-140-02). **`listSaves` is ordered and every term is computable from the published record**: `date_trunc('milliseconds', saved_at) DESC, target_kind::text ASC, ref_id ASC` — the truncation because `savedAt` crosses as a millisecond `Date` while the column is microsecond `timestamptz` (D-140-11), and the cast because Postgres orders an enum by declaration order (D-140-09/10). Merged at `174cb0e`, tagged `t140-verified` |
| `server/publish/` | **Backend, LIVE.** Turns validated bytes into a bundle and its first release, or appends a release to one that exists. `publish.ts`, `errors.ts`, `index.ts`. **It COMPOSES and owns no storage** — engine, archive, versioning, naming, policy, cards, ontology and accounts — so its dominant risk is re-implementing a decision a merged module already owns, and twelve contract items were ruled before any code existed. **`publish` honours `can` rather than comparing ids** (D-100-04): the obvious `ownerHandle === actor.handle` shortcut makes `can` trivially true AND refuses a rightful owner immediately after a rename, since `changeHandle` updates the row while the cookie keeps the old handle. **It calls `openView(db, manifest.ontologyVersion, terms)`** so the stored scorecard and the export agree — scoring against the shipped core while the export resolves the manifest's named version means publish accepts and the first export 404s. **The card-bytes conflict compares SOURCE, not digests and not `body`**: `source` is `text` and round-trips byte-identical while `body` is `jsonb` and round-trips value-identical only, so a `body` comparison reintroduces the blindness a digest comparison has (D-100-02). **Four foreign rejections reach a caller unaltered, each keeping one author**: `MalformedVocabularyError` 400, `UnknownOntologyVersionError` 422, `CardStoreError` 422, `ExportError` 422. **`persistArtefacts` freezes the folder at publish** — the first write to object storage in this run, and B-01's split implemented rather than deferred — encoded by a codec this module publishes, because `keyForDigest` addresses one object per digest so a folder cannot be stored file-per-key. Publishes `PublishRefusedError` with five kinds and **six message forms** — `conflict` carries two — taking `error-hygiene`'s equality 29 → 30 |
| `server/limits/` | **Backend, LIVE.** Rate ceilings and API keys. `check.ts`, `config.ts`, `counter.ts`, `keys.ts`, `secret.ts`, `store.ts`, `http.ts`, `errors.ts`, `types.ts`, `index.ts`. **`checkLimit` CANNOT reach `db` — it is not a parameter** (T231, D-231-01), which is stronger than the discipline the previous sentence described and is held by an equality on `check.ts`'s import list plus a transitive check that nothing it imports reaches `@/lib/db` at any depth. **The precondition D-230-05 held by caller discipline is now a type**: `resolveKey` returns a branded `ResolvedKey` only it can mint, `LimitSubject` is a three-arm union carrying its own tier, and an unresolved key, a **revoked record listed by `listKeys`**, or a bare `keyId` string is a compile error. The brand proves **provenance, not non-revocation** — deleting `isNull(revokedAt)` from `resolveKey`'s WHERE still mints one, which is why it was left unnarrowed and why that mutation now reds **3** cells on two axes where F-230-J measured **0 across 164**. `tierOf` is withdrawn: the subject carries the tier. Previously — D-230-05's clause counts a keyed *request*'s one indexed read, which is `resolveKey`'s at the route, so a statement here would make a keyed request cost two where the clause licenses one. The counter is in-process, so **N warm instances multiply the effective ceiling by N** and that weakening is published rather than inferred. **`limitFor` refuses every bucket outside its table** and uses `Object.hasOwn` on both levels, so `limitFor(config, "constructor", "key")` cannot reach `Object.prototype` and answer a function where the signature says `BucketLimit`. **`issueKey` returns the secret exactly once and `ApiKeyRecord` does not carry it** — stored hashed, unrecoverable, structural rather than remembered. **Revoked rows are LISTED rather than filtered**, because that is AC4's observation rather than a convenience. Owner's ceilings, per hour: `read` 600/600/6000 anonymous/account/key, `write` REFUSED/120/120, `upload` REFUSED/30/30. **An unconfigured bucket refuses with a year-long backoff, not the Unix epoch** (F-230-M): every configured window is an hour, so reusing it would make an unnamed bucket byte-indistinguishable from a deliberately closed cell, and an epoch `resetAt` invited a client honouring the published machine-readable field to retry immediately, forever. Publishes five classes, taking `error-hygiene`'s equality 24 → 28 |
| `server/profiles/` | **Backend, LIVE.** The public author surface — `{ author, joinedAt, counts: { blueprints, terms } }`, cut to the countable half by D-130-06. `read.ts`, `terms.ts`, `store.ts`, `http.ts`, `errors.ts`, `types.ts`. **No owner/visitor branch anywhere**: AC2 falls out of the `Actor`, T080 decides visibility, and there is no second `readable()` — the alternative was re-implementing T080's filter against `card_version`, which D-130-04 forbids and which is why `counts.cards` is not here at all. **`withProfileStore` wraps only this module's own statements** and is deliberately narrower than `withRegistryStore`, because `getPublicAuthor` and `blueprints` seal their own and re-wrapping a sealed fault relabels a working store. Publishes **two** classes: `ProfileStoreError`, and `MalformedStoredVocabularyError` for a stored vocabulary the parser refuses — **D-130-10, and the wrapper passes it through unrelabelled with the arm ordered before the store-fault chain, load-bearing and commented as such.** Merged at `1a848d6`, tagged `t130-verified` |

**Top level:**

| Path | Purpose |
|---|---|
| `content/` | The archive: `blueprints/` (9 dirs), `cards/` (57 versioned YAML files, 53 distinct ids), `ontology/extensions.yaml` |
| `public/` | Generated static mirror (`bundles/`, `cards/`, plus static assets) — rewritten by `scripts/generate-bundles.ts` at every `prebuild` |
| `scripts/` | Build-time generation: `generate-bundles.ts` (content → public), `generate-skill-refs.ts`, `generate-wordmark-paths.ts`, `measure-prose.ts` |
| `skills/darkprint/` | The vendored Claude Code authoring skill (SKILL.md, references, templates) |
| `docs/` | `ARCHITECTURE.md` (this file) and `architecture/` (its split sections), `DECISIONS.md`, `audit/` |
| `tests/` | Backend test trees that cannot sit beside the code they test, because `docs/ORCHESTRATION.md` has each backend task's tests written **blind**, in a separate worktree branched before the implementation exists — `tests/server/**` per task (`t010`, `t020`, `t025`, `t030`, `t060`, `t080` so far), `tests/support/**` for database/storage/env fixtures and the control-character constants nobody should retype. Also the repo-level guards that are nobody's task and red for everyone: `no-raw-control-bytes.test.ts`, `first-pass-calibration.test.ts`, `task-state-agreement.test.ts`, `wave-dependencies.test.ts`, `error-hygiene.test.ts` (D-13's four-part clause over every published error class, domain built by construction) and `architecture-current.test.ts` (this document against the tree). Collected by `vitest.config.ts`'s non-colocated globs |
| `backend.md` | The backend build's state store — task partition, contracts, published signatures, per-task logs. Not documentation: it is the file the parallel implementer/test-author/adversary sessions read and write |

---

## 7 · State and data flow

**No React context providers exist anywhere in the codebase** (zero `createContext` calls).
Every state slice below is module-scope (build time), `useSyncExternalStore` against a
browser API, or a plain component-local `useState` — no `useReducer` usage was found
either.

| State slice | Owner | Lifetime | Persisted? | Replaced by what once the backend exists |
|---|---|---|---|---|
| Registry filters/sort/search (`/nodes`, `/blueprints`, `/ontology`) | `components/ui/useQueryState.ts` (`useSyncExternalStore` over `window.location.search`) | Per browser tab; survives Back/Forward | URL query string, via `history.replaceState` | No change needed — URL-as-state stays; a backend adds server-side filtering behind the same params |
| Search-box draft (typed, not yet committed) | `NodeBrowser.tsx:303`, `GalleryBrowser.tsx:102` | Per render tree, 250ms debounce into the URL | none | N/A, UX debounce artifact |
| Scroll-spy "which type group is visible" | `NodeBrowser.tsx:541` | Per render tree | none | N/A, cosmetic |
| Favorites/bookmarks | `components/ui/FavoriteStar.tsx` (`useSyncExternalStore` over `localStorage`) | Per browser, survives reloads, never syncs across devices | `localStorage["darkprint:favorites"]` | An account-scoped `save` row keyed on `(account, target)` — see the "two disjoint save sets" note below |
| "Saved" list (5-row fixture) | `lib/data/bundles.ts:554` `SAVES`, via `components/profile/load.ts:116,126` | Build time only, identical for every visitor | none — not real per-user data | An account-scoped API read of a real bookmarks table |
| `/upload` wizard step, kind, files, manifest form, "submitted" flag | `components/upload/UploadFlow.tsx:544-548`, plain `useState` | Per mount of `UploadFlow` | none — files never leave the tab (`UploadFlow.tsx:1001-1006`) | A server-persisted upload/draft session, if resumability across reloads is ever wanted |
| `/upload` derived validation, autonomy/risk scores, ontology view | `UploadFlow.tsx:552-569`, `useMemo` over the above | Recomputed per render | none | The client-side re-validation stays even with a backend; the server adds its own authoritative pass at publish time |
| `/build` workspace controls (output, approval, iteration cap) | `components/build/BuildWorkspace.tsx:171`, `useState<StarterChoices>` | Per mount | none | Only relevant if "save my starter config" ever becomes a feature — a small per-account preference row |
| `/build` "which tab changed" badge marks, derived bundle/download files | `BuildWorkspace.tsx:172,174` | Per mount, recomputed from choices | none — files generated as `data:` URLs in-tab | A real `bundle_release` write only if "download" becomes "publish a starter" |
| Graph/pane node selection (`/build`, blueprint detail, `/upload` step 3) | `WorkspaceStage.tsx:193,201`, `SynchronisedPanes.tsx:82`, `ValidationReport.tsx:144` | Per mount | none | N/A — view state, no backend equivalent needed |
| Settings page live preview (display name, bio, avatar hue) | `components/settings/ProfileFields.tsx:52-54` | Per mount, resets on reload by design | none by design (`ProfileFields.tsx:18-19`) | An account profile `PATCH` endpoint; every other `/settings` field stays `disabled` until then |
| "Signed-in account" | `lib/data/account.ts:77` `ACCOUNT`, a single module-scope constant | Build time, identical for every request | none — a fixture, not a session | A real server session/auth cookie. The "owner" view today is a plain string comparison (`components/profile/load.ts:78`), not a stored session |
| Owned bundles/drafts/lineage/drift | `lib/data/bundles.ts:177` `OWNED_BUNDLES` | Build time | none | A real per-account bundles table (drafts, publish history, fork lineage) |
| Community notes/comments, node/community star counts | `lib/data/community.ts`, `lib/data/node-community.ts` | Build time | none | A comments/votes table with real authorship and POST endpoints |
| Comments "load more" reveal | `Comments.tsx:87` | Per mount | none | N/A, pagination-disclosure UI over static seed data |
| Build-time archive read and derived index (blueprints, cards, digests, registry, shared `OntologyView`) | `lib/content/read.ts:135,137`, `lib/content/index.ts:54` (lazy module-scope caches) | Build time only, one Node process | filesystem, under `content/` | A real database read behind the same `readContent()`-shaped API — the module already documents itself as "SERVER ONLY, BUILD TIME ONLY" and throws if bundled for the browser (`read.ts:8-13,49-53`) |
| Assorted disclosure/tab/copy-flash UI state (`ForkAction.tsx:52`, `DotBreakdown.tsx:333`, `CopyButton.tsx:51`, `SiteHeader.tsx:192-193`, `InstallTabs.tsx:10`, `BundleDropzone.tsx:424-427`, etc.) | Various, per component | Per mount/render | none | N/A, purely cosmetic — no backend implication |

**Two things worth flagging.**

1. **Two disjoint "save" stores exist for one concept, and the code says so three times**
   (`lib/data/bundles.ts:551-552`, `components/bundle/BundleHeader.tsx:25`,
   `components/profile/SavedList.tsx:15-20`). `FavoriteStar` writes to
   `localStorage["darkprint:favorites"]`; the profile's Saved tab renders the unrelated
   5-row `SAVES` fixture. A favorite starred on a card page never appears in the same
   reader's own Saved tab. A real backend needs to unify these into one bookmarks table
   before that tab can honestly reflect what a reader starred elsewhere — see also TBD-4 in
   [8 · Backend contract seams](architecture/seams.md).
2. **`/settings`' `ProfileFields.tsx` states its own state-management rule in its docblock**:
   a control is live `useState` only if its effect is local and immediate (the
   avatar/bio/name preview); anything whose only effect would be persistence is rendered
   `readOnly`/`disabled` instead of wired to fake state. Worth preserving as a principle
   when the backend lands, rather than wiring every field to `useState` reflexively.

---

## 9 · Design system

### 9.1 · Tokens

Source of truth: `app/globals.css` (Tailwind v4, CSS-first — no `tailwind.config.*` file;
`postcss.config.mjs` only wires `@tailwindcss/postcss`). Tokens live in three `@theme`
blocks: a tree-shaken `@theme { }` (colors/spacing/type, `:45-160`), a `@theme static { }`
that Tailwind must never tree-shake because it's consumed from inline styles and anime.js
rather than utility scanning (durations, `--color-key`, `--color-warn`, `:171-201`), and a
`@theme inline { }` wiring the three `next/font` variables (`:203-207`).

**Color semantics**, stated verbatim in the CSS comments and confirmed independently in
`components/viz/tokens.ts:44-71`: **cyan is interactive, violet is where a person acts,
emerald is a figure read off the engine, signal is a defect.** `amber` is reserved for
exactly two jobs sitewide — `ComingSoonBadge` ("not built yet") and `.route-box`/
`.route-label` ("this box leaves the page") — and nothing else may use it
(`components/ui/ComingSoonBadge.tsx:1`, `app/globals.css:378-411`). A separate, deliberately
duller `--color-warn` exists precisely so a real warning can't be confused with the amber
"not built" signal. Three color "poles": dark/factory (`--color-void`, `--color-surface*`),
blueprint/cyanotype (`--color-blueprint*`), and copper (`--color-copper*`, reserved
exclusively for the node-card figure, never conflated with amber despite both reading as
"orange").

**Spacing** is a documented seven-tier vertical scale (`globals.css:9-24`): `inline` 8px,
`tight` 12px, `element` 16px, `card` 20px, `block` 40px, `section` 64px, `band` 80-112px —
with four banned values stated explicitly (48, 56, 32, 96). Verified against actual usage:
broadly followed, but **not fully enforced** — live counter-examples include
`components/home/SectionLevels.tsx:703,717` (`mt-8`, `gap-14`),
`components/home/SectionLifecycle.tsx:221` (`mt-8`, with its own comment acknowledging
it's "the mock's 32px"), `components/hero/Wordmark.tsx:541`, `components/profile/ProfileShell.tsx:57`,
`components/site/SiteFooter.tsx:99` (both `py-12`).

**Horizontal width has exactly one narrowing token**: `--measure: 36rem` via `.prose-lane`
(`globals.css:139,531-533`), governing **body prose only** — not figures, tables, code
panes, or a `SectionHeading` lead, per two explicit author rulings quoted in
`components/ui/SectionHeading.tsx:84-86`. `.container-page` (1200px, 38 files) caps overall
page width. Plain `max-w-*` utilities still appear at 45+ call sites for narrow one-off
elements outside the prose/heading system (e.g. `Wordmark.tsx:515`'s `max-w-2xl` on the
claim line).

**Radii**: a four-step ladder (`sm` 5px chips/code, `md` 8px buttons/inputs, `lg` 12px
panels/cards, `xl` 18px full-bleed sheets); bare `rounded` is pinned to `sm` rather than
Tailwind's default, and `2xl`+ are disabled outright (`globals.css:116-134`).

**Typography**: three fonts (Geist Sans, JetBrains Mono, Space Grotesk) plus three
code-enforced "mono tiers" — `.eyebrow` (11px), `.label-lead` (14px), `.label` (11px,
`globals.css:446-487`) — with an explicit floor: "11px is the absolute floor and there are
no exceptions."

**Motion tokens** (`@theme static`): `--ease-out` ("THE default curve, everywhere"),
`--ease-in-out`, durations from `--dur-press` 120ms to `--dur-reveal` 520ms, mirrored for
anime.js as `MOTION` in `components/viz/tokens.ts:219-236`.

**Z-index** is a fixed five-rung ladder (header 50 → card hit target 10), documented rather
than tokenized (`globals.css:32-42`): "nothing inside a card may exceed 20."

### 9.2 · Component inventory

**Primitives** — `components/ui/**`, 34 files: buttons/links (`Button.tsx`), badges/pills
(`Badge.tsx`, `TagPill.tsx`, `MetaPill.tsx`, `ComingSoonBadge.tsx`), cards/rows
(`ContentCard.tsx`, `ContentRow.tsx`), the diagnostics/severity system
(`DiagnosticList.tsx`, `severity.ts`), meters/scoring (`AutonomyMeter.tsx`,
`MetricBars.tsx`, `ScoreRadar.tsx`, `PhaseCoverage.tsx`), the shared filter bar
(`RegistryFilterBar.tsx`), textures (`GridBand.tsx`, `GridPaper.tsx`), the copy-to-clipboard
control (`CopyButton.tsx`), the favorite toggle (`FavoriteStar.tsx`), the display-type
scale (`SectionHeading.tsx`), and supporting non-component modules (`useQueryState.ts`,
`visible-text.ts`, `severity.ts`, `menu-group.ts`).

**Composed** — 22 feature folders, each built from the primitives above for one part of the
product: `blueprint/` (9 files), `bundle/` (6), `build/` (12), `gallery/` (1), `graph/` (7),
`hero/` (5), `home/` (20, the largest composed folder), `nodes/` (4), `ontology/` (4),
`panes/` (11), `profile/` (10), `settings/` (2), `site/` (3), `spec/` (6), `upload/` (4),
`viz/` (11 — infrastructure other folders draw scenes with, not primitives in the `ui/`
sense), `explain/` (5), `learn/` (2), `mcp/` (2), `skill/` (1).

### 9.3 · Animation conventions

`animejs` is imported directly in exactly three files: `components/hero/Wordmark.tsx`,
`components/viz/useLuminousFlow.ts`, `components/viz/easing.ts`. Everything else animated
goes through the two hooks below or plain CSS.

- **`components/viz/easing.ts:35-48`** documents a real gotcha: anime.js 4.5.0 removed its
  string-form `cubicBezier(...)` parser, so handing the CSS token `MOTION.easeOut` directly
  to anime.js silently becomes linear. `easing.ts` re-derives an actual `cubicBezier()`
  function from the same control points, kept separate from `viz/tokens.ts` so that file
  stays import-free of the anime.js engine (a render-safe barrel for server components).
- **The hero wordmark** (`components/hero/Wordmark.tsx`) draws in over four timed beats: each
  letter outlines via `svg.createDrawable` then cross-fades into real DOM text, a `FlowEdge`
  rule draws under the name, the mark "settles" with an anime.js `spring()` overshoot, and a
  single brightness sweep passes across the letters. Gated by `useReveal`'s `static` phase,
  which always renders the finished heading under SSR/no-JS/reduced-motion.
- **`useLuminousFlow`** is the one hook driving every "luminous flow" SVG scene sitewide
  (graphs, node figures) — nodes fade in, edges draw via `svg.createDrawable`, a looping
  travelling pulse runs on a `strokeDashoffset` normalized so duration is length-independent,
  using a seeded PRNG (not `Math.random()`) to avoid SSR/hydration mismatches. A second
  `IntersectionObserver` pauses off-screen loops purely to save main-thread repaint cost.

**The scroll-driven mechanism, concretely.** `components/viz/useReveal.ts` is, in its own
words, "the single place this site decides whether anything moves" — a three-phase state
machine (`static` / `armed` / `shown`) driven by one `matchMedia("(prefers-reduced-motion:
reduce)")` listener and one non-repeating `IntersectionObserver` (default `threshold:
0.25`, `rootMargin: "0px 0px -12% 0px"`). `components/viz/useScrollProgress.ts` is the
second primitive — a 0..1 pin-travel fraction for sticky-scrubbed sections (e.g. the
node-card walk), computed via `requestAnimationFrame`-throttled `getBoundingClientRect()`
reads, deliberately reusing `useReveal`'s single motion-preference check rather than adding
a second `matchMedia`. When motion is gated off it returns `progress: 1` (the finished
state), so a reduced-motion reader sees every annotation attached at once rather than none.
Global CSS respects the same preference: `scroll-behavior: auto` under
`prefers-reduced-motion: reduce`, and two pure-CSS keyframe animations exist only inside a
`prefers-reduced-motion: no-preference` block (`globals.css:578-653`).

### 9.4 · Rules for a new page to look native

1. Spacing lands on one of the seven named tiers (§9.1); the four banned values are 48, 56,
   32, 96.
2. Body prose is the only thing `.prose-lane`/`--measure` narrows; headings, leads, figures,
   tables and code panes run the container's width.
3. The z-index ladder has five fixed rungs — pick one, don't invent a number; nothing inside
   a card exceeds 20.
4. Radii are the four-step ladder; `rounded` is `sm`, not Tailwind's default.
5. Color semantics are fixed and may not be reassigned — cyan/violet/emerald/signal/amber as
   above.
6. Mono type has exactly three tiers and none is a heading level: "a mono uppercase run is a
   LABEL... if it needs to appear in the document outline it is a `PanelHeading`."
7. Motion is gated in exactly one place (`useMotionAllowed`/`useReveal`); a new
   animated component renders its finished, accessible state under SSR/no-JS/reduced-motion
   rather than starting hidden, and should route through `useReveal`/`useLuminousFlow`/
   `useScrollProgress` rather than adding a second `matchMedia`/`IntersectionObserver`.
8. Hover states are gated behind the `hoverable` custom variant
   (`@media (hover: hover) and (pointer: fine)`) — "a touch pointer has no leave."
9. Panels use `.panel`/`.panel-lead` rather than ad hoc `bg-surface`/`border` combinations,
   and at most one `.panel-lead` per page ("two leads is no lead").

**Divergence from a prior working note.** An earlier project memory recorded "text runs
full width — no max-w, no prose-lane" as an absolute rule. The current code does not match
that description: `.prose-lane`/`--measure` is a real, actively used token system (~15
direct consumers) governing body prose specifically, and `.container-page` caps overall
page width at 1200px. Per this repository's own rule that code wins over a stale note, §9.4
above states the rule as the code actually enforces it today; the note is being corrected
in the assistant's memory as part of this session.

---

## 10 · Cross-cutting

### 10.1 · Metadata and SEO, including JSON-LD

`LIVE` (partial). `app/layout.tsx:36-57` sets global defaults — `metadataBase`, a title
template (`"%s · DarkPrint"`), description, keywords, and a partial `openGraph` block
(title/description/type only, no `images`, no `twitter` card, no `viewport`/`themeColor`
export anywhere). 9 dynamic routes export their own minimal `generateMetadata` (`{ title,
description }` with a `"X not found"` fallback, e.g. `app/blueprints/[slug]/page.tsx:60-67`);
14 static routes export `metadata` directly, same shape. The homepage (`app/page.tsx`) has
no metadata of its own by design, so it inherits the root default and the hero's claim is
the indexable one (`app/layout.tsx:26-35`). `PLANNED`/absent: no `canonical`/`alternates`,
no JSON-LD anywhere in the codebase, and no `app/sitemap.ts` or `app/robots.ts` (no shell
file exists for either — not even a stub).

### 10.2 · Accessibility

`LIVE`. One skip link (`app/layout.tsx:76-81`, WCAG 2.4.1, justified in-comment by the
header's ~10 links plus every hero graph node being a focus stop). 120 files carry `aria-*`
attributes, 41 use `sr-only`, and real ARIA roles are used purposefully (`role="search"`,
`role="status"` live region, `role="switch"` + `aria-checked`, `role="img"`/`role="region"`
with accessible names). A centrally enforced rule — glyph *and* word both carry meaning,
colour is decoration — lives in `components/ui/severity.ts:1-19` after a real regression
(a diagnostic once shipped `aria-hidden` glyph with no text), enforced by
`components/blueprint/severity-word.test.ts` across all nine archive bundles. Two
accessibility properties CLAUDE.md names are `LIVE`-tested under other file names: contrast
(`components/viz/flow.test.ts:520-650`, full WCAG relative-luminance math against real hex
values pulled from `app/globals.css`, not hardcoded) and label overlap
(`components/panes/archive-labels.test.ts`, measures every archive blueprint's rendered
graph at 7 widths and asserts nothing collides).

### 10.3 · Responsive breakpoints

`LIVE`. No custom breakpoints — Tailwind's stock `sm`/`md`/`lg`/`xl`/`2xl`, mobile-first.
Usage skews toward `sm:` (65 files) and `lg:` (43); `2xl:` is nearly unused (1 file). A
custom `hoverable` variant (`@media (hover: hover) and (pointer: fine)`,
`globals.css:215`) gates hover-only affordances separately from width. `prefers-reduced-motion`
is respected globally (§9.3).

### 10.4 · Error handling

`PLANNED`/absent for framework-level boundaries, `LIVE` for content-level handling. No
`error.tsx`, `not-found.tsx`, `global-error.tsx` or `loading.tsx` exists anywhere under
`app/` — not even a stub — so the app falls back entirely to Next.js's built-in default
404/500 pages (the `/_not-found` and `/_global-error` rows in
[4 · Sitemap and routing](architecture/routes.md) are framework defaults for exactly this
reason). `notFound()` is used consistently across every dynamic route, each paired with
`dynamicParams = false` so an unknown slug/id is a build-time 404, not a runtime lookup.
The engine's own `Diagnostic[]` (error/warning/info) is fully `LIVE`-surfaced:
`components/ui/DiagnosticList.tsx` renders it in two places, and on `/upload`
`components/upload/ValidationReport.tsx:266-279` prints a plain-language verdict sentence
*above* the raw diagnostic list — parse failure, unfinished bundle ("not a defect"), or
resolved-with-errors — a deliberate fix so a reader isn't left to infer the verdict from five
red rows.

### 10.5 · Loading and empty states

`LIVE` for empty states, absent for loading. No `loading.tsx`/Suspense boundary exists
anywhere. A single shared `EmptyState` component (`components/profile/parts.tsx:180-198`)
renders five distinct, real copy strings across the profile tabs ("Nothing published yet",
"Saves are private", "No published blueprints", "No node cards", "No terms under this
handle" — each with its own action link). The validator has its own separate empty state
("No problems found, the validator had nothing to say about this bundle",
`components/ui/DiagnosticList.tsx:79-88`).

### 10.6 · Analytics

`LIVE`, pageviews only. `@vercel/analytics` (`package.json:21`) is mounted once, globally,
as the last child of `<body>` (`app/layout.tsx:3,96`). The adjacent comment
(`:91-95`) states the scope explicitly: page-view counting only, no-ops outside a Vercel
deployment, and distinct from the unbuilt blueprint-run telemetry of SEAM-84/85. No custom
`track()` calls exist anywhere in the codebase.

---

## 11 · Known gaps and decisions

### 11.1 · Deliberate shortcuts

Recorded in the code as intentional, not accidental:

- **`lib/core/**` is fully built and real** — autonomy, static risk exposure, phase
  coverage and every digest are genuinely computed, at build time for the archive and
  in-tab for `/upload` and `/build`. The gap is entirely in the write plane: nothing in the
  UI can *submit* a vote, a run, a publish, or a session, and every such control says so in
  place rather than pretending.
- **Community and account data is deliberately seeded, not deleted or half-built.** Each
  `lib/data/**` file states outright, in its own header comment, that it stands in for a
  table that doesn't exist yet (e.g. `lib/data/community.ts:1-9`).
- **The read/write split (`docs/architecture/seams.md` §5.2 in Phase 2A's own analysis)
  means the read plane — 22 of 113 seams — could be built first, behind the same URLs the
  pages already consume, without moving a single page component's data shape.**

- **No size bound exists on a caller-supplied vocabulary, and none can be added inside
  `lib/server/engine`.** The engine's byte limit (`maxBytes`) excludes `input.ontology`
  from the measured set, because an `OntologyView` carries the whole of `CORE_ONTOLOGY`
  and charging a caller for the curated vocabulary would refuse a small upload for the
  size of something it did not send. That exclusion is correct **only while `ontology`
  is not caller-reachable**, which is true today: no route sets it. It is a premise, not
  a convenience — an exclusion from a measured set becomes a bypass of the bound the
  moment the excluded field becomes caller-reachable, and nothing fails in between.
  Worse for placement: `ontology` arrives as a *prebuilt* `OntologyView`, so
  `ontologyView()`'s O(terms) merge (`lib/core/ontology/resolve.ts:128`) has already run
  by the time the engine is entered. **A limit bounds only the work that happens after it
  runs**, so the cap has to sit at the route, on the bytes the view is built from, before
  `ontologyView` is called. Binding on whoever writes the first route that accepts a
  caller's vocabulary.

- **One `GET /api/authors/{handle}` reads the whole readable blueprint set to count one
  author's.** `lib/server/profiles/read.ts:68` is
  `(await blueprints(db, actor)).filter((b) => b.ownerHandle === handle)`: every bundle and
  every release T080 considers readable is materialised, then all but one author's rows are
  discarded by a JavaScript predicate. The cheap version is an `owner_id` filter in SQL, and
  that is precisely the second copy of `readable()` D-130-04 forbids — a visibility rule
  re-implemented beside the one that already exists is the copy that goes stale when the
  policy changes, and it goes stale by leaking private rows. **Read from the code, not
  timed.** The cost is recorded as a shape; whether it hurts is a question about registry
  size that nobody has measured. Binding on whoever gives T080 a reader that filters by
  owner inside the ruled filter rather than beside it.

- **AC1's write-time refusal has NO witness in the merged corpus, and this is structural rather
  than an oversight.** T133's implementer deleted its own refusal and **zero** merged cells
  reddened; its adversary re-ran the same mutation against the blind suite and got **27** — 12 AC1,
  12 AC4, 3 hygiene, **all blind cells, none outside the T133 suite.** The refusal closed the only
  path merged cells used to store a bad shape, and the `seedRelease` raw-SQL bypass then re-opened
  it deliberately for the two T090 cells that need one. **The second reason is worse than the
  first**: under a writer that refuses everything, **127 merged cells go SILENT rather than red**,
  because eight merged files seed through `addRelease` in `beforeAll` and a throw in a hook produces
  skips. A full-suite run under a broken writer gets *quieter*, not louder. So AC1 is defended by
  the blind suite alone, and anyone deleting that suite deletes the guarantee with it.

- **AC3's operator query under-reports, now by ONE clause rather than by the whole of `terms`.** It
  decides "not a mapping", "`text` absent or not a string" (via `IS DISTINCT FROM`, because `<>` on
  an absent JSON key yields NULL and silently drops the row), and "`terms` is not a list". It does
  **not** decide whether the entries are term mappings — that is T030's grammar, and transcribing
  it into SQL would be a second copy in a dialect that cannot import the parser, **which is the
  copy nobody runs and the defect this task exists to close.** Measured against 17 planted rows:
  10 of 10 SQL-separable refusals caught, **zero false positives**. Every row it names is genuinely
  refused; only misses are the gap.

- **AC1's write-time refusal has no witness in the merged corpus, and neither does publishing's.**
  T133 established the shape; T100 inherits it. The refusal's witnesses are the blind cells, and a
  suite deleted takes the guarantee with it.

- **The read half of the frozen artefact does not exist, so `serveFile` still generates from
  Postgres.** T100 writes the artefact; **nothing reads it.** `t090/serve.test.ts`'s AC6 cell stays
  red and is now **T091's**, not T100's — the contract's claim that it *"turns green by itself the
  day T100 persists"* was FALSE, and two merge logs had booked that red as clearing here.

- **A vocabulary that fails to parse publishes as "no local terms".** Cards relying on it then
  resolve `card/unknown-term` and the publish is refused *in-error*, **so it does not pass unnoticed
  — but the refusal names the cards when the vocabulary is what is broken.** `readOptionalVocabulary`
  refusing 400 with the parse diagnostics would close it; that is a new refusal surface and a
  follow-up.

- **An unparseable declared `version` on a FIRST release is stored unchecked.** `addRelease` does not
  validate the grammar and AC8 has no `previous` to compare against, so `version: "banana"`
  publishes. On an append it is caught. **No admissible kind fits**, and inventing a sixth would
  break the whitelist five cells assert.

- **`sourcesByRef` mirrors a rule it cannot import.** `ResolvedBlueprint` exposes each node's parsed
  card but not the file it was parsed from, so there is no published route from a ref back to its
  verbatim bytes. **A `file` field on `ResolvedNode` would delete the function**, and `lib/core` is
  not this task's.

- **A lost create race returns 409 rather than retrying as an append**, ruled rather than overlooked:
  converting a lost create into an append makes `PublishResult.created` a claim about *who won a
  race* rather than *what happened to the bundle*, and a retry the caller issues is observable where
  one the server performs is not.

### 11.2 · Open `TBD:` questions

Per this document's grounding rule, a `PENDING-OWNER-REVIEW` row in `docs/DECISIONS.md`
becomes a question here, never a statement. The full sets already live in the split
documents rather than being repeated:

- [3 · Concept model](architecture/concept-model.md#open-tbd-questions-in-this-document) —
  9 questions about entity shape (`DotAttrs` persistence, draft digest typing, comment
  polymorphism, download/support counting grain, release versioning, card/term privacy,
  ownership transfer, term-usage indexing, ontology overlay versioning).
- [8 · Backend contract seams](architecture/seams.md#open-tbd-questions-in-this-document) —
  4 questions about the write plane (object-storage vs. Git as the archive backend,
  "create" vs. "add a release" semantics for publishing, slug uniqueness scope, and
  whether `localStorage` favorites migrate into a real account on launch).
- [4 · Sitemap and routing](architecture/routes.md#orphan-routes) — 1 question: which file
  is the canonical audit deliverable, since `docs/audit/CHANGELOG.md` (named by this
  document's own instructions, see §11.3) exists in no commit.

Two structural gaps outside those documents, worth stating plainly here: **who is allowed to
grant the `validator` badge** (`Account.validatorWeight` exists and is seeded, but nothing
in the code proposes a granting process — `app/settings/page.tsx:47-52`), and **whether the
16 product policies `docs/DECISIONS.md` D-58 lists as deliberately open (publishability,
fork identity, blueprint versioning, privacy, trust signals, run normalisation, ontology
governance, the MCP retrieval contract, licensing, malicious-bundle boundaries, account
roles, event semantics, ranking, moderation, retention, the star service)** are meant to be
resolved before or after Stage 0 of any implementation.

### 11.3 · `PENDING-BACKEND` and `UNREACHABLE-ROUTE`, from the audit

This document's own instructions name `docs/audit/CHANGELOG.md` as the source for this
subsection. That file does not exist in the working tree or in any commit reachable from
`HEAD` (`git log --all -- docs/audit/CHANGELOG.md` returns nothing) — the same absence
`docs/architecture/routes.md` already flags as a `TBD:`. The equivalent findings live in
`docs/audit/REPORT.md`, used here instead with that divergence noted rather than silently
substituted.

**`UNREACHABLE-ROUTE`: zero found** (`docs/audit/REPORT.md:291-300`). `components/site/nav.test.ts`
is a live, passing guard walking every top-level `app/*/page.tsx`, asserting a header/Learn-menu/
account-menu entry exists for each, and asserting every chrome link resolves to a real page.
Matches [4 · Sitemap and routing](architecture/routes.md#orphan-routes) exactly.

**`PENDING-BACKEND`: two module families kept on purpose** (`docs/audit/REPORT.md:205-236`):

1. `lib/core/**` — ~90 flagged unused-export/type lines. The barrel at `lib/core/index.ts`
   states in its own header that it is a declared API surface, not incidental code; the UI
   exercises only the parts a given screen needs today, and the rest (`emitAttractorDot`,
   `lintAttractor`, `buildRegistry`, `computeSecurity`, `checkVersionChain`, and their
   types) sits ready for the API routes and CLI tooling a real backend will add. Fully
   mapped to seam IDs in [8 · Backend contract seams § cross-check](architecture/seams.md#cross-check-against-the-audits-pending-backend-items).
2. `lib/data/{account,bundles,community,profiles}.ts` — 6 flagged unused types
   (`NotificationSetting`, `Drift`, `DraftDetail`, `Draft`, `ReportedCost`, `PinnedRef`),
   each used to type a sibling field in the same file but never imported by name elsewhere
   (normal under TypeScript's structural typing). Same cross-check, same conclusion: keep,
   no action, textbook `PENDING-BACKEND`.

---

## 12 · Maintenance protocol and revision log

**Protocol.** This file (and its `docs/architecture/*.md` companions) follows the context
hygiene rules in `CLAUDE.md`: no new root-level markdown files, durable knowledge goes in
exactly one of `CLAUDE.md` (rules), this document (how the system is), or
`docs/DECISIONS.md` (why it is that way), and a decision here is never asserted with more
authority than `docs/DECISIONS.md` gives it — a `PENDING-OWNER-REVIEW` row stays a `TBD:`
question. When the code and this document disagree in the future, the code wins and the
next revision records the divergence; nobody edits the code to match a stale doc.

**Revision log.**

| Date | Commit | Sections touched |
|---|---|---|
| 2026-08-12 | `f32267c` | Initial publication — all sections (0-12), assembled from Phase 2A's `ROUTES.md`, `ENTITIES.md`, `SEAMS.md` (carried over unchanged into §2-4, §8) and a fresh code-derived pass for §1, §5-7, §9-11 |
| 2026-08-18 | `3c485f8` | §8 seams — SEAM-42..48 and SEAM-50 marked **superseded for T050's account routes**. Seven rows contradicted T050's published route block, and `CLAUDE.md` makes this document binding, so T050's blind author bound to the wrong published surface in good faith. Marked rather than edited away: the rows are the record of what the frontend expected, and the correction is placed **above** them so the next reader hits it first. No route or module changed |
| 2026-08-18 | `fef79f2` | §6.2 — `lib/server/naming/` added, and §4 the two `/api/names/**` routes, as T070 merged (`38eb820`, tagged `t070-verified`). Caught by `tests/architecture-current.test.ts` on the merge itself. §8 seams **unchanged**: no seam covers identifier availability, because no page asks for it today — the handle field on `/settings` is `readOnly`. Recorded rather than invented: this is the second task whose routes have no seam id, and the open `TBD:` in §4 about whether §8 gains entries for routes no page consumes now covers thirteen of seventeen |
| 2026-08-18 | `a4bc5b2` | §11.1 — new shortcut recorded: **no size bound exists on a caller-supplied vocabulary, and none can be added inside `lib/server/engine`**. Found by T040's implementer auditing its own unobservability claims after handing the tree back. `maxBytes` excludes `input.ontology`; that exclusion is a **premise** (`ontology` is not caller-reachable) rather than a convenience, and the field arrives as a prebuilt `OntologyView`, so `ontologyView()`'s O(terms) merge is already spent before the engine is entered. A limit bounds only the work that happens after it runs, so the cap belongs at the route on the bytes, not in the module on the type. No route or module changed |
| 2026-08-18 | `011a851` | §6.2 — `db/` gains T005's six community and account tables (`save`, `ballot`, `note`, `note_vote`, `run_report`, `api_key`), taking `schema.ts` from ten to sixteen, as T005 merged as the tenth task. **§8 seams unchanged**: T005 ships schema only — no route, no module, no page consumes these tables yet, so no seam changes status. The `target_actor_kind` enum keeps its `note_vote` member, which has no writer; removing it would alter an existing type, and that is recorded here rather than fixed silently. §4 unchanged, no route added |
| 2026-08-19 | `194dd86` | §6.2 — `lib/server/accounts/` added; §4 the nine `/api/{account,auth}/**` routes, taking the sitemap to twenty-six. Every account route's status list carries **500**: D-50-18 ruled a sanitized store fault answers `problem+json` rather than escaping raw, and D-50-21 extended it to every class `isDecision` recognises. §10 gains the `store-failed` problem type. **§8 seams: SEAM-42..48 and SEAM-50 were already marked superseded for these routes** at `3c485f8`, so no status flips here — the rows record what the frontend expected and the published block is what shipped. Recorded rather than smoothed: `NamingStoreError`'s arrival is observed by a colocated real-42P01 test only, because a closed port fails at connect and cannot reach it |
| 2026-08-19 | `752721d` | §6.2 — `lib/server/registry/` gains `errors.ts`, `store.ts` and `http.ts` as T081 merged. §4 unchanged: **no route was added** — the eleven `/api/{blueprints,cards,ontology}/**` routes already existed and gained a fault path they had never had, so their sitemap rows gain **500** rather than new entries. §10 records the `store-failed` problem type once, shared with T050's account routes. §8 seams unchanged. **Recorded rather than smoothed:** every fault driven in this task was a closed port — no live-database fault, no parameterised statement — so `params:` was never populated in any measured rejection, and D-13's bound-parameter clause is held by construction rather than by witness |
| 2026-08-20 | `ad44537` | §6.2 — `lib/server/engine/` added; §4 the four `POST /api/validate/**` routes, taking the sitemap to thirty. **§10 gains no new problem type: the engine returns diagnostics at 200 (B-03) and refuses only with typed errors the routes map to 400/413.** §8 seams unchanged — SEAM-30's request shape could not be joined to the module's signatures and the contract won. **Recorded rather than smoothed: merged on a FAIL.** D-40-L is charged, measured and unfixed — `limits.ts:468` reads `Number(length)` where `LengthOfArrayLike` is `ToNumber`, so the walk answers where the ruled formula refuses. Barrel-only, one-line repair measured at 10 of 10 agreeing, carried as a follow-up because every charge from D-40-E on is unreachable through any route and the consumers that would reach them do not exist |
| 2026-08-20 | `<this commit>` | §6.2 — the **two** `server/registry/` rows collapsed into one. A table keyed by path carried a duplicate key: one row from T080's merge describing the cross-store read model, a second from T081's listing its files and fault path. **Both were accurate, which is why neither reader of either merge noticed** — a duplicate key in a keyed table is invisible to anyone reading one row. Found by T130's implementer while drafting its own §6.2 row, i.e. by a party constructing the neighbouring entry rather than by anyone auditing this one. No content lost: the merged row carries T080's description and T081's additions, with both merge shas and both tags |
| 2026-08-15 | `6d746ff` | §6.2 — `lib/server/export/` added, and §4 the three `/api/files/**` routes, as T090 merged (`6d746ff`, tagged `t090-verified`). Caught by `tests/architecture-current.test.ts` on the merge itself rather than noticed later, which is what it was added for one commit earlier. §8 — SEAM-19 marked half-crossed: the per-file download links have a served endpoint now, while `DownloadPanel` still points at the static `public/bundles/` mirror |
| 2026-08-23 | `t100` | §6.2 — `lib/server/publish/` added as T100 merged. §4 sitemap gains **`POST /api/bundles`**. §11.1 gains six shortcuts. **`error-hygiene` 29 → 30** for `PublishRefusedError`. **Adversary verdict NOT PASS with six findings, all fixed**, and two of them were cells that had NEVER EXECUTED: one seeded the single card its own fixture builds to be un-storable, and rebinding the module last revealed two more — **0ms → 27ms and 0ms → 21ms**, since an early red masks every write below it while being correct about its own subject. **A6's witness does NOT clear here and the contract's claim that it would was false**: T100 persists and `serveFile` still generates from Postgres, so the frozen bytes are written and never read — that cell's message is re-pointed at **T091** rather than left to misdirect the next reader. Two merge logs had booked that red as clearing at T100 |
| 2026-08-23 | `t231` | §6.2 — `server/limits/` amended as T231 merged. **`checkLimit` cannot reach a connection: `db` is not a parameter**, and the key precondition is a brand only `resolveKey` can mint. **`error-hygiene` did NOT move and that is the measurement**: both halves predicted 29 → 30, and T231 publishes types rather than error classes, so 29 stands — the guard passing is the result, not an omission. No route, seam, component or token moved. **Adversary verdict: 13 failed of 6442, 0 skipped, and NOT ONE from either half** — nine were a positional shift in T230's suite after `db` left the signature, one an arity pin reading a stale block, one T090's T091 dependency, one `tierOf`, one a load-induced `D-40-F` flake falsified with three clean isolated runs. **All corrected at this merge, and two of the corrections were instruments stating a property they did not implement**: `publishedArity` counted declared rather than required parameters while its own message said *"a default or rest parameter moves this number legitimately"*, and `keys.ts:299` named the sibling `keys.test.ts` whose `stubDb` discards the WHERE argument it claimed defended the clause |
| 2026-08-22 | `16cbc40` | §2 glossary and §3 concept model gain **`StoredVocabulary`** as T133 merged — `{ text, terms }` or `null`, published from `@/lib/server/archive` and **derived from the two merged readers rather than invented**: every clause already had a reader enforcing it and nobody had written it down. §11.1 gains AC1's missing witness and AC3's remaining under-report. **`error-hygiene` 28 → 29** for `MalformedVocabularyError`. No route, seam, component or token moved, so §4 and §8–§10 are unaffected. **The adversary's verdict was NOT PASS with four findings, three against the implementation** — a re-export the ruling had granted and the author declined, an AC3 query catching 5 of 10 rows it could decide, and a `schema.ts` comment that quoted the very spelling its guard forbids, leaving that cell **red-to-red across a 1017-character rewrite of the thing it watches.** The fourth was a bounded gap in the blind suite: its leak instrument walked `Object.entries`, so a value stashed non-enumerably satisfied D-13's hygiene clause exactly while evading the scan — **two guards in tension, and the shape that satisfies one evades the other** |
| 2026-08-22 | `8aae1da` | §6.2 — `lib/server/limits/` added as T230 merged. §4 sitemap gains the **three** `/api/account/keys/**` routes, taking it to thirty-nine. **`error-hygiene`'s equality moves 24 → 28** — five classes, and the figure was pre-registered by T230's adversary as a PREDICTION (`24 → 28`) before the merge and hit exactly. §11 — the adversary's verdict was **NOT PASS with six findings, five against the BLIND SUITE**, and the one behaviour owed by the implementation (F-230-M, an unconfigured bucket's 429 carrying `resetAt: new Date(0)`) was fixed before merge. **F-230-J is the finding worth recording here**: deleting `isNull(revokedAt)` from `resolveKey`'s WHERE — the one line implementing AC4 — reddened **0 of 164 cells across both halves**, while end-to-end a revoked key held **6000 against 600**. The cell existed and its own comment called it THE DISCRIMINATING CELL; it asserted the **intersection** of two readings of "refused immediately" and the intersection was weaker than the criterion either reading states. Corrected at this merge. **T231 carries the structural repair** — `checkLimit` taking what `resolveKey` returns, so the precondition is a compile error rather than caller discipline |
| 2026-08-22 | `a903b3d` | §11.1 — the T130 shortcut row **written, having been logged as written and not been**. The `1a848d6` entry above says §11.1 gains the full-registry-scan cost D-130-04 buys; the section did not contain it, so for a day the only record of that cost was the log entry claiming the record existed. That is the failure `architecture-current`'s own header names — a check satisfiable by the record of a change rather than by the change — arriving in the document instead of in the guard, because **no guard reads §11.1**: the two mechanised checks cover modules and routes, and a prose section owes its accuracy to whoever writes it. Found by re-reading the section the log pointed at rather than the log |
| 2026-08-21 | `1a848d6` | §6.2 — `lib/server/profiles/` added as T130 merged. §4 sitemap gains `GET /api/authors/{handle}`, taking it to thirty-six. §8 — **SEAM-53 flips to LIVE for the countable half only**: `blueprints`, `cards`, `terms`, `owned`, `saves`, `pinned` and the follow counts are **not** in the published record, and the seam's row says which. §11.1 gains the cost D-130-04 buys: **one `GET /api/authors/{handle}` scans every bundle, every release and then the cards** to count one author's blueprints, because the cheap `owner_id` filter is the second `readable()` the ruling forbids — read from `snapshot.ts`, not timed. **Recorded rather than smoothed:** the module publishes **two** error classes and `error-hygiene` moved 22 → 24, not 22 → 23 — **the ruling that created the second class and the count travelled in different messages**, which is how the wrong figure stayed correct-looking (D-130-20). And **twenty-two blind cells did NOT merge**: ten assert `setPins`/`toggleFollow` and travel to T131, twelve assert `counts.cards` and travel to T132, with `pins.test.ts` and `follow.test.ts` kept whole on `test/t130-profiles` as the archive |
| 2026-08-21 | `174cb0e` | §6.2 — `lib/server/saves/` added as T140 merged. §4 sitemap gains the **four** `/api/account/saves/**` routes, taking it to thirty-five. §8 — **SEAM-61 and SEAM-62 flip to LIVE**, and their key space is the one D-140-07 **withdrew** rather than mapped: the compound `blueprint:<slug>` / `node:<id>@<version>` / `bundle:<owner>/<slug>` could not address a three-member enum, so all four routes take the barrel's own `{ kind, refId }` and translate nothing. §10 gains no new problem type — `SaveStoreError` renders through the shared `store-failed`. **Recorded rather than smoothed:** **there is no 403 in any status line**, structurally — every route passes `session.accountId`, so `NotAccountOwnerError` compares an id against itself (T050's `http.ts` rules it and this task cites rather than re-derives) — and **no 404 on a write**, because a write-time existence check on a polymorphic target is the oracle AC1 closes. **AC1's non-owner denial is therefore unreachable from HTTP in this task and is held by module cells**, with a route cell driving somebody else's `accountId` as the witness that the unreachability is true rather than assumed |
| 2026-08-20 | `3bf0be8` | §8 seams — SEAM-61 and SEAM-62 rewritten and open question 4 struck as ANSWERED, under D-140-07, which publishes `app/api/account/saves/**` as four routes over one request shape. The compound key space (`blueprint:<slug>`, `node:<id>@<version>`, `bundle:<owner>/<slug>`) is **withdrawn**, not mapped: it cannot address a three-member enum, and translating it would invent three things the contract does not state. `components/ui/FavoriteStar.tsx`'s `TODO(SEAM-62)` corrected in the same commit, being where T140's implementer actually found the dead surface. No §4 sitemap row yet: the routes have not merged. |
| 2026-08-15 | `68b6f19` | §6.2 directory tree — `lib/server/{ontology,registry}/` added; both were merged and tagged (`t030-verified`, `t080-verified`) while the tree recorded neither, and the `tests/` row was still naming four task suites out of six. §4 sitemap — a new **API routes** table: fifteen `route.ts` handlers existed and the sitemap recorded zero, because it listed only `page.tsx`. §8 seams — SEAM-01, 07, 09 and 13 marked **half-crossed**: T080 is the first task whose routes call a backend module, which is the exact condition the 2026-08-14 rows named for re-reading them, but the server end is open and no page consumes it, so none becomes `LIVE` end to end. Carries one `TBD:` — eleven of the fifteen routes have no seam id and it is not decidable without ruling on what a seam is for. Found by T080's session on its way out of a task this file is not part of; mechanised as `tests/architecture-current.test.ts`, which reds when a `lib/server` module or an `/api` route exists and is recorded nowhere |
| 2026-08-14 | `49b8d2f` | §6.2 directory tree — `lib/server/{archive,cards,versioning}/` added as T010, T020 and T025 merged (`3fd050f`, `aee6e07`, `87dffd8`); `tests/` gains the two repo-level guards. §8 seams still **unchanged**: five backend modules now exist and no route calls any of them, so every seam stays `PLANNED` until one does |
| 2026-08-14 | `b9851af` | §6.2 directory tree — `lib/db/`, `lib/server/{auth,http,policy}/`, `tests/` and `backend.md` added as the first backend code to merge (T000 at `ec516fa`, T060 at `eef7cce`). §8 seams deliberately **unchanged**: these are modules, and no route calls them yet, so every seam stays `PLANNED` until one does |
| 2026-08-13 | `f8ff1f7` | §4 sitemap (call sites for `ContentRow` / `NodeCardSummary`), §8 seams (SEAM-56 rewritten for stars/validated, SEAM-59 split, SEAM-113 added), §2 glossary and §3 concept model (`stars`, `validated`, card visibility) |
