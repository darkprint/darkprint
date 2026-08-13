# Backend specification — inventory of aspects

**Last verified against commit `8a9801e388551b83cca70061bcb836f38574dd52` on 2026-08-13.**

## 0 · What this document is, and what it is not

An inventory of everything the DarkPrint backend has to provide, derived by reading
`docs/ARCHITECTURE.md` (and its five split sections) and then walking the frontend: every
`page.tsx` under `app/`, every component that reads or would write, every type under
`lib/` and every document under `content/`, plus `scripts/`, `next.config.ts` and the
117 `TODO(SEAM-xx)` anchors in the code.

**It is not** a plan, a partition, a schedule, or an estimate. Aspects are listed in
reading groups, and the groups carry no order. The IDs (`A-01` …) exist so an aspect can
be named in conversation; a lower number does not mean earlier, smaller or more
important. No implementation code appears here, and no endpoint is designed — where the
frontend already proposes a path (`docs/architecture/seams.md` does, for 113 seams), the
path is quoted as evidence of an interaction, not adopted as a decision.

### Granularity rule used

An aspect is something that could plausibly be built and verified on its own, from
outside, through a stated interface. So "the card library and its version chains" is one
aspect; "`GET /api/cards/{id}`" is not, and "the API" is not.

### How to read an entry

| Field | Meaning |
|---|---|
| **Purpose** | One sentence. What the aspect is for. |
| **Evidence** | Files and lines in the frontend that already assume it, or the section of `docs/ARCHITECTURE.md` that requires it. Each entry is labelled `code` (the frontend assumes it today), `doc` (a document requires it), or `speculative` (neither — stated with the reason it is nonetheless listed). |
| **Behaviour** | What it must do as seen from outside: what it stores, what operations it exposes, what rules it enforces. |
| **Unknowns** | Every decision the frontend does not settle, written as a question. None of them is answered here. |

Line numbers were re-checked against the working tree at the commit above; where a
document's own anchor disagrees with the code, the code's line is used and the
disagreement is recorded in [§3](#3--where-the-frontend-and-docsarchitecturemd-disagree).

Two words are used the way the code uses them: the **archive** is the immutable,
content-addressed half (`content/`, read by `lib/content/read.ts`); the **index** is
everything that moves (`lib/data/**`, which its own header calls "that database … until
there is a real one", `lib/data/community.ts:1-9`).

---

## 1 · Aspect index

| ID | Aspect | Evidence class |
|---|---|---|
| **I — Content and persistence** | | |
| [A-01](#a-01--published-artefact-store-the-archive) | Published-artefact store (the archive) | code + doc |
| [A-02](#a-02--node-card-library-identity-and-version-chains) | Node-card library, identity and version chains | code + doc |
| [A-03](#a-03--ontology-store-and-vocabulary-versioning) | Ontology store and vocabulary versioning | code + doc |
| [A-04](#a-04--registry-read-model-and-query-index) | Registry read model and query index | code |
| [A-05](#a-05--artefact-distribution-and-export) | Artefact distribution and export | code |
| **II — Ingest and the write plane** | | |
| [A-06](#a-06--bundle-validation-and-diagnostics-service) | Bundle validation and diagnostics service | code |
| [A-07](#a-07--static-analysis-service-autonomy-risk-phase-coverage) | Static analysis service (autonomy, risk, phase coverage) | code |
| [A-08](#a-08--publishing-releases-and-history) | Publishing, releases and history | code + doc |
| [A-09](#a-09--fork-lineage-and-drift) | Fork, lineage and drift | code |
| [A-10](#a-10--namespace-and-slug-allocation) | Namespace and slug allocation | code |
| **III — Identity and access** | | |
| [A-11](#a-11--accounts-and-sessions) | Accounts and sessions | code |
| [A-12](#a-12--authorization-ownership-and-visibility) | Authorization, ownership and visibility | code + doc |
| [A-13](#a-13--ownership-transfer-and-account-deletion) | Ownership transfer and account deletion | code |
| [A-14](#a-14--profiles-and-the-public-author-surface) | Profiles and the public author surface | code |
| **IV — Community signals** | | |
| [A-15](#a-15--bookmarks-saves) | Bookmarks (saves) | code |
| [A-16](#a-16--stars-and-support-counts) | Stars and support counts | code |
| [A-17](#a-17--download-counting) | Download counting | code |
| [A-18](#a-18--community-ballot-and-vote-weighting) | Community ballot and vote weighting | code + doc |
| [A-19](#a-19--validator-role-and-grants) | Validator role and grants | code + doc |
| [A-20](#a-20--notes-comments-and-note-votes) | Notes (comments) and note votes | code |
| [A-21](#a-21--run-report-ingestion-and-cost-aggregation) | Run-report ingestion and cost aggregation | code + doc |
| [A-22](#a-22--notifications-and-event-fan-out) | Notifications and event fan-out | code |
| **V — Discovery** | | |
| [A-23](#a-23--search-filters-and-ranking) | Search, filters and ranking | code + doc |
| [A-24](#a-24--term-usage-index-and-promotion) | Term-usage index and promotion | code + doc |
| [A-25](#a-25--mcp-server-surface) | MCP server surface | code + doc |
| [A-26](#a-26--programmatic-clients-and-credentials) | Programmatic clients and credentials | code, partly speculative |
| **VI — Platform, cross-cutting** | | |
| [A-27](#a-27--api-error-and-response-conventions) | API error and response conventions | code, partly speculative |
| [A-28](#a-28--rate-limiting-abuse-and-content-boundaries) | Rate limiting, abuse and content boundaries | doc, partly speculative |
| [A-29](#a-29--observability-and-audit) | Observability and audit | speculative |
| [A-30](#a-30--migrations-seed-data-and-environments) | Migrations, seed data and environments | code, partly speculative |
| [A-31](#a-31--rendering-caching-and-invalidation-contract) | Rendering, caching and invalidation contract | code |

---

## 2 · The aspects

### Group I — Content and persistence

#### A-01 · Published-artefact store (the archive)

**Purpose.** Hold the bytes of every published bundle — manifest, topology, the card
versions it pins, the local vocabulary it carries — immutably and addressed by content,
and give them back byte-identically.

**Evidence**

- `code` — `lib/content/read.ts:217` `readContent()` is the only filesystem touch in the
  repository; it assembles one `Bundle` per directory under `content/blueprints/`
  (`:355-385`), memoizes at module scope (`:141`, `:218`) and self-guards against ever
  running in a browser (`:53-57`). SEAM-107 anchors it at `read.ts:44`.
- `code` — the archive on disk is the store's current implementation: 9
  `content/blueprints/<slug>/{blueprint.yaml,blueprint.dot}` pairs, 57
  `content/cards/<id>@<version>.yaml` files, one `content/ontology/extensions.yaml`.
- `code` — identity is `ResolvedBlueprint.digest`, `bundleDigest` over the DOT source and
  the sorted card digests (`lib/core/hash/digest.ts:61`); the UI prints
  `shortDigest(bp.digest)` as the bundle's version string
  (`app/blueprints/[slug]/page.tsx:315`, `components/bundle/load.ts:159,219`).
- `code` — `lib/core/archive/store.ts` declares `StoredObject`, `ContentStore`,
  `contentDigest`, `memoryContentStore`, exported at `lib/core/index.ts:187-188` and
  called by nothing in the app.
- `doc` — `docs/architecture/concept-model.md` §2 ("the archive … is immutable and
  content-addressed. Everything in it is a file, hashed, and never edited in place") and
  §3; `docs/architecture/seams.md` SEAM-107, SEAM-109.

**Behaviour**

- Stores, per published bundle: manifest fields (`slug`, `title`, `summary`, optional
  `description`, `category`, `author`, `createdAt`, `updatedAt`, required `tags`,
  `ontologyVersion` — `lib/core/bundle/types.ts`, validated by `read.ts:425-449`), the DOT
  source verbatim, the set of pinned card refs, and the digest.
- The digest is computed, never accepted from the client: it is `sha256` over the DOT plus
  the sorted card digests, and card digests are sorted but **not** deduplicated, so a
  bundle pinning one card twice is a different bundle (`digest.ts:61`).
- Bytes go back out unchanged: the source panes (`bundleSource`, `lib/content/index.ts:172`)
  and every per-file download read the same stored text.
- A bundle carrying an error-severity diagnostic is refused rather than stored
  (`read.ts:281-291`: "broken content must fail the build rather than ship a blueprint the
  engine could not vouch for").
- The manifest's `slug` must equal the directory the bundle sits in today (`read.ts:363-367`).

**Unknowns**

1. Object storage keyed by hash, a relational store, or Git? `ContentStore` is declared and
   unused, and `docs/DECISIONS.md` D-80 (object storage, `AGENT-PROPOSED`,
   `NOT-IMPLEMENTED`, `PENDING-OWNER-REVIEW`) contradicts the working tree, where content
   lives in Git.
2. Is `ContentStore`/`contentDigest` the intended interface for this aspect, or dead
   design to delete? (`docs/architecture/seams.md` cross-check, TBD 1.)
3. Are the author's exact uploaded bytes stored, or a canonicalised re-serialisation? The
   digest is over canonical JSON of the parsed card, but the source panes and downloads
   print the original text.
4. Can two bundles share a digest (identical bytes, two owners)? Is that a conflict, a
   dedup, or two rows?
5. What replaces "the manifest slug must equal the directory name" when there are no
   directories?
6. Is a private, unpublished bundle stored in the same place as a published one, or in a
   separate draft store? `OwnedBundle.draft` (`lib/data/bundles.ts:162`) is present exactly
   when the slug is *not* in the archive.
7. Is anything ever deleted from the archive, or is it append-only forever? `/settings`
   states the deletion cascade keeps published work
   (`app/settings/page.tsx:437-441`).

---

#### A-02 · Node-card library, identity and version chains

**Purpose.** Hold every published version of every node card as an immutable document,
with a content digest and a checkable version chain, shared across all bundles that pin it.

**Evidence**

- `code` — `content/cards/<id>@<version>.yaml`, 57 files, 53 distinct ids; four ids carry
  two versions (`acceptance-verifier`, `bounded-retry`, `intent-router`, `schema-gate`).
- `code` — `CardRef = "id@version"`, built by `cardRef` and parsed by `parseCardRef`
  (`lib/core/card/schema.ts:187`), which refuses an unversioned or `@latest` reference;
  ids must match `CARD_ID` (`:167`), versions `REF_VERSION` (`:174`).
- `code` — `cardDigest` (`lib/core/hash/digest.ts:47`) is sha256 over canonical JSON of the
  card minus `author` and `provenance`, which is what makes `Registry.duplicates()`
  possible (`lib/core/archive/registry.ts:66`).
- `code` — `checkVersionChain` (`lib/core/card/validate.ts:847`) and `inferBump`
  (`lib/core/version/bump.ts`) hold each published step to the bump the engine infers;
  `read.ts:309-333` sweeps the whole library and fails the build on a mismatch. SEAM-40 is
  anchored at `validate.ts:47` and says in the code that this "must run at publish time,
  since a published version can never be edited".
- `code` — the card wire schema is `CARD_KNOWN_KEYS` (`lib/core/card/validate.ts:69-100`),
  snake_case on the wire, camelCase in the model, with both spellings accepted for four
  keys; unknown keys are `info`-level and ignored, not rejected (`:251-258`).
- `code` — `components/nodes/VersionHistory.tsx` (SEAM-11) renders every version with its
  digest and the blueprints pinning it; `app/nodes/[...id]/page.tsx` prints the engine's
  bump verdict beside the declared number.
- `doc` — `docs/architecture/concept-model.md` §3 ("Content hash versioning of node cards",
  three mechanisms).

**Behaviour**

- Stores one immutable document per `(id, version)`; a published version is never edited
  in place. A card shared by two bundles is one document.
- Computes and stores the digest; two cards describing the same node collapse onto one
  digest regardless of YAML key order or authorship.
- Enforces at write time that a new version's declared bump is at least the bump the engine
  infers from the diff (everything except `version`, `author`, `provenance`).
- Answers: every version of an id newest-first, one exact ref, the newest version of every
  id, which blueprints pin a given ref, and which groups of refs are content-duplicates.
- Rejects an id or version that does not match the reference grammar, because the grammar
  is what makes "always pin the exact version" checkable at the reference site.

**Unknowns**

1. Is a card publishable on its own, or only as part of a bundle? `/upload`'s Node kind is
   `disabled` with the reason in its accessible name (`components/upload/UploadFlow.tsx:96-101`,
   `:843-847`), and the archive only carries cards some DOT pins.
2. Can a card be private? `lib/data/cards.ts` seeds private cards that are not documents in
   `content/cards/`, and `concept-model.md` §6 raises the same TBD.
3. Private-card rows today violate the published-card grammar: `version: "v0.1.0"` fails
   `REF_VERSION` and the seeded `phases` ids (`plan`, `build`) are not among the five
   phases. Are private cards held to the same schema as published ones, or not validated
   until publish?
4. Which wire spelling is canonical over an API — the card's snake_case
   (`requires_human`, `ontology_version`) or the manifest's camelCase (`ontologyVersion`)?
   One bundle carries both today.
5. Is a version ever yanked, deprecated or superseded? Nothing in the UI proposes one.
6. Are unknown card keys preserved on round-trip, or dropped? They are accepted with an
   `info` diagnostic and never re-emitted.
7. Who owns a card whose `author` field names a handle that does not exist, or that has
   been renamed? The field is a string inside the bytes and nothing checks it
   (`lib/content/view.ts:261-271`).

---

#### A-03 · Ontology store and vocabulary versioning

**Purpose.** Hold the curated core vocabulary and every local overlay, merge them into one
view a bundle is resolved against, and record which version each score was computed under.

**Evidence**

- `code` — `CORE_ONTOLOGY` (`lib/core/ontology/core.ts`), version `0.1.0`, 49 terms across
  five closed kinds; `content/ontology/extensions.yaml` adds one; the merged view keeps the
  base version (`lib/core/ontology/resolve.ts:125-127`).
- `code` — one shared `OntologyView` per build, memoized, because `isA` memoizes per
  instance and sharing it is "the only way digests and scores are computed against provably
  identical vocabulary" (`lib/content/read.ts:104-154`). SEAM-108.
- `code` — `view.validate()` rules: `ontology/phase-not-extensible`,
  `ontology/local-term-unrooted` (errors), `ontology/local-marker-unweighted`,
  `ontology/local-marker-bad-weight` (warnings), plus `ontology/dangling-pointer` and
  `ontology/cyclic-broader` (`lib/core/diagnostics.ts`); a malformed overlay fails the whole
  read (`read.ts:232-235`).
- `code` — `/upload` layers a dropped `extensions.yaml` over the core in the tab
  (`UploadFlow.tsx:142-144`, `:567-581`) and the route discloses three times that the
  wizard resolves against the core alone while the archive resolves against core + overlay
  (`app/upload/page.tsx:195-200`).
- `code` — `DARKPRINT_CONFIG.ontologyVersion` (`lib/core/config.ts:129`) and every
  analysis result carries `ontologyVersion`; the bundle page prints "Scores computed under"
  and "Two scores from different ontology versions are not comparable"
  (`components/bundle/Aside.tsx:155-172`).
- `doc` — `docs/architecture/concept-model.md` §7; `docs/DECISIONS.md` D-24, D-26, D-30.

**Behaviour**

- Stores terms with `id`, `kind` (one of the five), `label`, `description`, optional
  `broader`, `since`, optional `deprecated {since, replacedBy, note}`, optional
  `defaultWeight` (local risk markers only), optional `impliesHuman`, and a `local` flag
  that is provenance, not spelling (`resolve.ts:150-155`).
- Serves a merged view per version: an overlay term sharing an id replaces the base term in
  place and the shadowing is reported.
- Enforces: `phase` is closed and may not be extended; a local term must reach the core
  through `broader`; `broader` is at most one parent, acyclic; deprecation is a redirect
  that is followed at most one hop and never across kinds.
- Records, with every stored score, the vocabulary version it was computed under.
- Serves the whole vocabulary and one term with its ancestors, children, reach and weight
  (`app/ontology/page.tsx`, `app/ontology/[...term]/page.tsx`).

**Unknowns**

1. Is a local overlay a versioned, publishable artefact of its own, or always a file inside
   a bundle? Its own `version` is discarded by the merge today
   (`concept-model.md` §7 TBD).
2. Who may publish a core-ontology version, and what happens to already-stored scores when
   one lands? `docs/DECISIONS.md` D-30 says a weight change is a PATCH of the ontology
   version and nothing enforces it.
3. Do overlays share one global namespace keyed by handle prefix, or is an overlay scoped to
   the bundle that carries it? Two bundles could then define the same id differently.
4. Are scores recomputed on an ontology release, or frozen at their stated version?
5. `/upload` resolves against the core alone and the archive against core + overlay, and the
   route discloses the divergence. Does the server's authoritative pass use the overlay the
   uploader supplied, the published overlays, or both?
6. Is `ontology/extensions.yaml` still a single archive-wide file when there are many
   authors?

---

#### A-04 · Registry read model and query index

**Purpose.** Answer every list, filter, join and reverse-index question the browsing pages
ask, without rescanning the archive per request.

**Evidence**

- `code` — `Registry` (`lib/core/archive/registry.ts:49-92`) is a stated interface:
  `blueprints()`, `blueprint(slug)`, `cards()`, `versionsOf(id)`, `latestCards()`,
  `card(ref)`, `usersOf(id)`, `duplicates()`, `phases()`, `cardsByPhase(phase)`, `tags()`,
  `categories()`, `searchCards(query)`; built by `buildRegistry` (`:167`) per process.
- `code` — every browsing page consumes it: `app/blueprints/page.tsx` (SEAM-01),
  `app/nodes/page.tsx` (SEAM-07), `app/nodes/[...id]/page.tsx` (SEAM-09/11/12),
  `app/ontology/page.tsx` (SEAM-14), `components/profile/load.ts:85` (`usersOf` for the
  per-card "used in" count).
- `code` — two rules the index enforces and a database must too: the slug is the primary key
  and the first claimant wins; only cards a DOT node instantiates are indexed
  (`registry.ts` docblocks; `concept-model.md` §2 quotes both).
- `code` — `Registry.duplicates()` has **no page**; nothing in the UI renders it (SEAM-13).
- `doc` — `docs/architecture/concept-model.md` §2 calls the `Registry` interface "the API
  surface a backend has to reproduce".

**Behaviour**

- Serves blueprint summaries with the fields the gallery tile needs, plus the facet
  vocabularies it filters on (`tags()`, `categories()`, `phases()`).
- Serves card summaries at `/nodes` tile altitude: `id, version, ref, name, action, type,
  typeLabel, phases[], tools[], requiresHuman, riskMarkers[], usedIn, author?`
  (`components/nodes/NodeCardSummary.tsx`).
- Maintains the reverse index card-ref → blueprint slugs, distinct and sorted, and its
  per-version variant used by the version-history panel.
- Groups cards by phase such that the groups cover the set without partitioning it: a card
  in two phases is in both buckets, a card in none is in no bucket, and neither is a defect.
- Returns a frozen empty bucket for a phase nothing declares, which is a fact about the
  index rather than an error.

**Unknowns**

1. Is this a materialised index (rebuilt on write) or a live query over the store?
2. What happens on a slug collision at write time, given that the read model silently skips
   the later namesake?
3. Pagination: no list endpoint in the frontend has a page size or a cursor, because the
   archive is 9 and 53 rows. What is the shape once it is not?
4. Is `duplicates()` a product surface, an operator tool, or dead? Nothing renders it.
5. Do orphan cards (in a bundle, pinned by no node) get indexed at all? They are excluded
   today and carry `bundle/orphan-card` at warning severity.
6. Are private bundles in the same index as public ones, with a filter, or in a separate
   one?

---

#### A-05 · Artefact distribution and export

**Purpose.** Serve the downloadable form of a bundle — the folder, its generated files and
each card on its own address — at stable URLs that a `curl` line and an agent can both use.

**Evidence**

- `code` — `scripts/generate-bundles.ts` writes `public/bundles/<slug>/**` (9 folders) and
  `public/cards/<ref>.yaml` (57 files) at `prebuild`, deterministically, and re-parses every
  emitted `factory.dot` through `parseDot` + `lintAttractor` before shipping it
  (script header, `:1-52`). SEAM-109, SEAM-19, SEAM-22.
- `code` — `lib/content/bundle-export.ts` decides what a bundle *is* once it leaves the
  site: `TOPOLOGY_DOT`, `FACTORY_DOT`, `BUNDLE_CARDS_DIR`, `BUNDLE_README`, `BUNDLE_AGENTS`,
  `BUNDLE_VOCABULARY`; `bundleFilePaths`, `bundleHref`, `bundleDownloadCommand:308`,
  `cardDownloadCommand:321`, both over `SITE_ORIGIN = "https://darkprint.io"` (`:121`).
- `code` — `factory.dot` is compiled by the exporter and is never in `content/`; the
  authoring skill deliberately does not emit it (`lib/skill.ts` header). SEAM-24.
- `code` — `README.md` and `AGENTS.md` are generated per bundle (`bundleReadme`,
  `bundleAgents`), and the generated half of `AGENTS.md` always exists so nobody is blocked
  from publishing (`docs/DECISIONS.md` D-52, `CONFIRMED`). SEAM-25.
- `code` — the per-file listing on both bundle pages is derived from `bundleFilePaths`, the
  same array the download command is built from (`components/bundle/load.ts:104-134,144-202`).
- `code` — a card also has an address that names no blueprint (`public/cards/<ref>.yaml`),
  plus an in-tab `data:text/yaml` button (`app/nodes/[...id]/page.tsx`, SEAM-10/22).

**Behaviour**

- Serves, per published bundle: `blueprint.dot` (as authored), `factory.dot` (compiled for
  Attractor), `cards/<ref>.yaml` per pinned card, `README.md`, `AGENTS.md`, and
  `ontology/extensions.yaml` when and only when the bundle's cards declare a local term.
- Compiles the generated files server-side at publish; the compile is pure and sorted so two
  publishes of the same content produce byte-identical files.
- Serves each card version at its own stable URL, independent of any blueprint.
- Emits a copyable one-line command whose URL list is the same array as the file listing on
  the page, so the folder a reader fetches is the folder the page describes.
- Refuses to emit a `factory.dot` that would not lex, parse and lint as Attractor input.

**Unknowns**

1. Is the download a set of files, an archive (zip/tar), or both? `SEAM-100` names a
   possible `POST /api/bundles/export` and `/build` assembles nine `data:` URLs in the tab.
2. Is a bundle addressable by digest as well as by slug? `/mcp` states the distinction is
   load-bearing ("fetch by slug and you get whatever the registry holds today; fetch by
   digest and you get the bytes you tested against", `app/mcp/page.tsx:323-326`) and no URL
   in the frontend carries a digest.
3. Are generated files stored at publish or generated per request? The digest covers the DOT
   and the cards only, so a `README.md` regenerated later is outside the digest.
4. `SITE_ORIGIN` is a hardcoded constant. Is the download origin the same host as the API?
5. Are older releases fetchable? A published bundle gets exactly one release today
   (`components/bundle/load.ts:223-226`), while `Releases` promises "a pin somebody took
   never stops resolving" (`components/bundle/Aside.tsx:327-329`).
6. Does anything serve a *private* bundle's files to its owner?

---

### Group II — Ingest and the write plane

#### A-06 · Bundle validation and diagnostics service

**Purpose.** Re-run the engine's parse-and-resolve pass authoritatively on the server over
submitted bytes, and return the same `Diagnostic[]` the browser already renders.

**Evidence**

- `code` — the whole of `/upload` runs `loadBundle` in the tab and nothing is sent
  (`components/upload/UploadFlow.tsx:567-581`, success screen `:1012-1018`). SEAM-30 names
  the server counterpart; SEAM-29 (DOT), SEAM-31 (vocabulary layering), SEAM-33 (card and
  ontology validation, both `PLANNED` and saying so on screen, `:843-847`), SEAM-41
  (Attractor lint over a buffer), SEAM-32 (`REPORT.md`).
- `code` — the client classifier is real and would need a server twin: one topology, one
  manifest, one vocabulary, the rest cards, everything else ignored with a stated reason
  (`components/upload/BundleDropzone.tsx:117-184`); `MAX_KB = 512` per file (`:91`,
  enforced at `:449`).
- `code` — resolution **degrades**: a bundle whose DOT parsed comes back with an analysis
  over the nodes that resolved, and three states are designed —
  `resolves` / `unfinished` / `rejected` (`components/upload/progress.ts`,
  `UploadFlow.tsx:591-595`).
- `code` — `lib/core/**` is isomorphic by contract (`CLAUDE.md`), which is what makes one
  implementation runnable on both sides.
- `doc` — `docs/architecture/seams.md` §E; `docs/ARCHITECTURE.md` §10.4 (the engine's
  `Diagnostic[]` is fully LIVE-surfaced).

**Behaviour**

- Accepts a bundle as `{ manifest, dot, cardFiles: Record<name, text>, vocabulary? }` and
  returns `{ blueprint?, analysis?, diagnostics: Diagnostic[] }`.
- Reports every defect as a diagnostic rather than throwing: `code` from the closed union
  (`lib/core/diagnostics.ts:11-127`), `severity` of `error | warning | info`, `message`,
  optional `hint`, optional `location` (`file`, `line`, `column`, `nodeId`, `cardRef`,
  `edge`, `path`).
- Keeps the three verdicts distinct, because the UI already writes three different
  sentences for them, and "still being written" is explicitly not a fault
  (`UploadFlow.tsx:1176-1201`).
- Reports vocabulary defects separately from bundle defects: `loadBundle` deliberately
  leaves them to whoever built the view.
- Enforces the isolation checks that are not stylistic: `bundle/prohibition-violated` is an
  error; the three `criteria-leak` non-verdicts are warnings and never move the score.
- Accepts a topology-only submission (no manifest) by synthesising a minimal manifest, the
  way the client does (`BundleDropzone.tsx:311-344`).

**Unknowns**

1. Is validation a standalone service (validate without publishing) as well as a step inside
   publish? The wizard implies the first and SEAM-69 the second.
2. What is the submission envelope — multipart upload, JSON with inlined text, or a
   pre-signed upload plus a reference?
3. Limits: is 512 KB per file the server's limit too? What is the cap on file count, total
   bundle size, node count, card count, DOT source length? Only the per-file client cap
   exists today.
4. Are non-UTF-8 bytes, symlink-like paths, or nested directories in a submitted selection
   an error, ignored, or rejected?
5. Does the server re-derive the file→role classification, or trust a client-declared
   manifest of which file is which?
6. Is `REPORT.md` generated server-side (SEAM-32) or does it stay a client artefact?
7. Are validation runs stored (for a "last validated" state, an audit trail, or resumability)
   or purely transactional? `/upload` state is per-mount and nothing persists
   (`ARCHITECTURE.md` §7).

---

#### A-07 · Static analysis service (autonomy, risk, phase coverage)

**Purpose.** Produce the two engine-written scorecard readings and the phase-coverage
description for a resolved bundle, and record what they were computed against.

**Evidence**

- `code` — `computeAutonomy` (`lib/core/analysis/autonomy.ts:239`) returns `AutonomyResult`
  (`:120`) with `autonomyClass`, `isDarkFactory` (`:320`), `level`, `label`, `fraction`,
  `autonomousNodes`, `totalNodes`, `contributions[]`, `rationale`, `ontologyVersion`,
  `diagnostics`. SEAM-36.
- `code` — `computeSecurity` (`lib/core/analysis/security.ts:441`) returns `SecurityResult`
  (`:178`): `level` 1-4 clamped, `raw` (`4 − Σ weights`), `penalties[]` (a marker charged
  once per blueprint), `findings[]` (one per marker+node, `declared` or `inferred`),
  `rationale`, `ontologyVersion`. SEAM-37.
- `code` — `computePhaseCoverage` (`lib/core/analysis/phase-coverage.ts`) returns sets of
  ids only — `covered`, `missing`, `byPhase`, `unphased` — deliberately no percentage and no
  label. SEAM-38.
- `code` — the tunables live in one frozen object: autonomy bands `0.9/0.7/0.5`, the seven
  security weights, `unknownMarkerWeight: 0`, `criteriaLeak.similarityThreshold: 0.35` with
  `similarityFiresMarker: false` (`lib/core/config.ts:127-175`).
- `code` — the view model turns these into the six-axis scorecard and normalises to 0-100
  (`lib/content/view.ts:153-214`); two of the six are `source: "auto"`.
- `doc` — `docs/architecture/concept-model.md` §4; `docs/DECISIONS.md` D-29 (the weights are
  provisional starting values), D-31 (no autonomy ordinal on any surface).

**Behaviour**

- Computes both readings from the resolved graph alone — nothing user-submitted may write
  them.
- Counts three node categories, never two: unattended, staffed, and undescribed (card
  missing). `totalNodes − autonomousNodes` is not the human count.
- Charges a risk marker once per blueprint however many nodes carry it, and records for each
  finding whether the marker was declared or inferred.
- Emits its own diagnostics as part of the reading: `analysis/empty-graph`,
  `analysis/unresolved-node`, and the three `criteria-leak` non-verdicts that exist so the
  check can never be silently inert.
- Stamps every result with the ontology version it was computed under.
- Never surfaces the 1-4 autonomy band as a value a client can render or sort on.

**Unknowns**

1. Computed on write and stored, or computed on read? The digest fixes the inputs, so a
   stored score is valid until the ontology or the weights move.
2. When a weight or a band changes, are stored scores recomputed, invalidated, or kept with
   their old version stamp?
3. Are the per-node `contributions[]`, `penalties[]` and `findings[]` stored, or recomputed
   on demand for the explainability panel?
4. Is `isDarkFactory` stored as a column (the gallery filters on `df=1`) or derived per
   query?
5. Does the server accept a client-computed analysis at all, or always recompute? `/upload`
   and `/build` both compute in-tab today.
6. Is there a scoring API for un-published bytes (the `/upload` case) distinct from the
   publish-time pass?

---

#### A-08 · Publishing, releases and history

**Purpose.** Turn a validated bundle into a registry entry — or a new release of one — with
a digest, a scorecard and a history line.

**Evidence**

- `code` — two publish surfaces exist and neither sends anything: `/upload` step 4's
  `Publish blueprint` sets local state (`components/upload/UploadFlow.tsx:1158-1165`,
  SEAM-69), and the owner's bundle page has `Publish a release`, `disabled` with
  `title="Nothing publishes yet: there is no account and no registry write path."`
  (`components/bundle/Aside.tsx:334-343`, SEAM-68).
- `code` — three distinct disabled reasons are already written for the wizard's button —
  `still being written`, `blocked` with an error count, and `not wired up`
  (`UploadFlow.tsx:1176-1201`).
- `code` — the invariants publishing must honour are stated in the visibility panel's copy:
  "Publishing runs the validator over your graph and gives the copy a scorecard of its own.
  It does not change the upstream, and the lineage line stays"
  (`components/bundle/Aside.tsx:92-95`).
- `code` — a published bundle gets exactly one history entry and one release, because the
  archive holds one folder (`components/bundle/load.ts:176-195,223-226`); a draft carries a
  hand-written `HistoryEntry[]` and `Release[]` (`lib/data/bundles.ts:86-105,253-300`).
- `code` — history entries are identities, not patches: `version` for a published bundle
  *is* `shortDigest(digest)` (`load.ts:159,219`), while drafts carry semver strings like
  `v1.4.0-hardened`.
- `code` — SEAM-40's anchor states the version-chain check "must run at publish time, since
  a published version can never be edited" (`lib/core/card/validate.ts:47`).
- `code` — SEAM-26: the author-written half of `AGENTS.md` is prompted at upload in the
  design and has no control in the wizard; `docs/DECISIONS.md` D-53 records it
  `OWNER-STATED` / `NOT-IMPLEMENTED`.
- `code` — SEAM-96: `/skill` states there is no live push from the editor
  (`app/skill/page.tsx:29`).

**Behaviour**

- Accepts a bundle plus a visibility choice, re-validates it, recomputes the digest and the
  scorecard, and stores the result as a new entry or a new release.
- Refuses a bundle that does not resolve; the refusal reason must distinguish "unfinished"
  from "in error", because the UI already does.
- Publishing a copy never mutates the upstream and never removes the lineage record.
- Every card version the bundle pins must exist or be published in the same act, and each
  must pass the version-chain check against the versions already published under that id.
- Produces a history entry per release, keyed by digest, and a release row a reader can
  fetch.

**Unknowns**

1. Is publishing "create a bundle" or "add a release to a bundle that already exists", and
   which one does the wizard perform? `seams.md` TBD 2 raises exactly this; `/upload` and
   `/u/<owner>/<slug>` are two paths to one write.
2. Does publishing take the bytes already uploaded, or re-upload? Nothing is stored before
   publish today.
3. Can a release be edited, retracted or unpublished? "Everything you published stays" is
   the only statement, and it is in the deletion copy (`app/settings/page.tsx:437-441`).
4. Does a release get a semver of its own, or is the digest its only identity?
   (`concept-model.md` §3 TBD.)
5. What is a conflict here — two publishes of the same slug, two of the same digest, a
   concurrent release on the same bundle — and what does the client see?
6. Are cards published implicitly with the bundle that pins them, or separately first?
7. Is the author-supplied half of `AGENTS.md` collected at publish (D-53) and stored where —
   inside the bundle bytes, or beside them?
8. Does publishing accept a submission from a non-browser client (the skill, a CLI)? See
   [A-26](#a-26--programmatic-clients-and-credentials).

---

#### A-09 · Fork, lineage and drift

**Purpose.** Let an account take a copy of somebody else's bundle, record where it came
from, and tell the owner when the upstream has moved past it.

**Evidence**

- `code` — `ForkAction` opens a disclosure that explains what forking means and performs no
  fork; it carries `ComingSoonBadge` over the intended model ("yours, private until you
  publish, listed on your profile", `components/blueprint/ForkAction.tsx`). SEAM-70. It is
  mounted on both blueprint and card pages (`app/nodes/[...id]/page.tsx`).
- `code` — lineage is one optional field on the ordinary bundle row, not a type:
  `OwnedBundle.forkedFrom: Lineage {owner, slug, version}` (`lib/data/bundles.ts:31-36,159`),
  and the file's header argues the model explicitly ("there is no `Fork` type, no `forks`
  array and no second list", `:1-28`).
- `code` — fork counts and lists are computed over **public rows only**, in one place, so
  the promise is kept once: `publicForksOf` (`:522-526`), mirrored inline at
  `app/blueprints/[slug]/page.tsx:180-186` with the promise restated at `:172-179`, and the
  panel closes with "A private fork is never announced here, and the author of this
  blueprint is not told it exists" (`components/bundle/Aside.tsx:262-265`). SEAM-71,
  SEAM-110.
- `code` — `Drift {tone: "ok" | "moved" | "blocked", note}` with three designed tones and an
  `UpstreamMoved {card, from, to, at}` panel that names a repin a reader can go and check
  (`lib/data/bundles.ts:46-49,108-114`, `components/bundle/Aside.tsx:185-217`). SEAM-72.
- `code` — the `fork` notification says "Public forks only. A private fork is never
  announced to the upstream author." (`lib/data/account.ts:100-104`). SEAM-104.

**Behaviour**

- Creates a new bundle owned by the forking account, carrying the upstream's bytes and a
  lineage record naming owner, slug and the upstream release taken.
- Never announces a private fork on the upstream: fork counts, fork lists, and the upstream
  author's notifications all read the public set.
- Computes drift by comparing this copy's pinned card versions against the upstream's
  current release, and reports it as one of three tones, where `blocked` describes this
  bundle's own problem and never frames it as falling behind.
- Keeps the lineage line through publication and through ownership transfer.

**Unknowns**

1. Does forking copy the bytes, or reference the upstream release by digest until the copy
   diverges?
2. Can a card be forked? `ForkAction` is mounted on card pages with `kind="node"`, and no
   card-level lineage field exists anywhere.
3. Is drift computed on read, on a schedule, or on an upstream-release event? All three are
   consistent with the panel.
4. What does drift compare when the upstream has been deleted, transferred, or made
   private?
5. Is a fork of a fork's lineage a chain or only the immediate parent? `Lineage` holds one
   parent.
6. Does a public fork appear on the upstream immediately, or only once it has a release?

---

#### A-10 · Namespace and slug allocation

**Purpose.** Decide and enforce the shape and uniqueness of every user-chosen identifier:
bundle slugs, handles, card ids and ontology term namespaces.

**Evidence**

- `code` — the wizard derives a slug from the title with `slugify` and falls back to
  `"untitled-blueprint"`; a dropped manifest owns its own slug
  (`components/upload/BundleDropzone.tsx:294-301`, `UploadFlow.tsx:732-734`). SEAM-35 names
  `GET /api/slugs/available?slug=` and the seam row records that **no collision check exists
  anywhere** while the registry treats the slug as a primary key.
- `code` — two route shapes imply two different uniqueness scopes: `/blueprints/{slug}`
  (global) and `/u/{owner}/{slug}` (per owner).
- `code` — four slugs are permanently reserved because the profile tabs occupy them:
  `blueprints`, `cards`, `saved`, `terms` (`components/profile/tabs.ts`).
- `code` — a card id must match `CARD_ID` and may be namespaced (`berti/solver-a`);
  a term id is bare for a core term and namespaced for a local one, and **term ownership is
  the id prefix, not a field** (`app/u/[username]/terms/page.tsx`,
  `components/profile/load.ts:164-166`, `app/settings/page.tsx:164-173`).
- `code` — both detail routes are catch-alls precisely so a namespaced id resolves as path
  segments (`lib/href.ts:22-40`, `app/nodes/[...id]/page.tsx:47-62`).
- `code` — a handle rename must keep the old handle reserved, because every published card
  carries the handle inside its own bytes (`app/settings/page.tsx:258-265`). SEAM-45.

**Behaviour**

- Allocates a bundle slug at publish, checks availability before the write, and returns a
  suggestion when it is taken.
- Enforces the id grammars the engine already enforces at reference sites, so a stored id is
  one a DOT node can pin.
- Reserves the four route-shadowing slugs, and any other segment the route table would
  shadow.
- On a handle change, keeps the old handle reserved rather than freeing it for reuse.
- Ties a local term's namespace to the handle that owns it, since nothing else records
  ownership.

**Unknowns**

1. Is a slug globally unique or unique per owner? The two routes imply different answers
   (`seams.md` TBD 3).
2. Are slugs case-sensitive, and is there a normalisation (unicode, hyphen collapsing)
   beyond the client `slugify`?
3. What is the reserved-word list beyond the four tab slugs — do `new`, `settings`, `api`
   need reserving?
4. Can a card id be claimed, or does the first publisher of an id own it forever? Two
   authors publishing `solver@1.0.0` is unaddressed.
5. Does a namespaced card id (`handle/id`) have to match the publishing account's handle?
6. When a handle is renamed, do the author's namespaced term ids and card ids change, stay,
   or both resolve?

---

### Group III — Identity and access

#### A-11 · Accounts and sessions

**Purpose.** Establish who is making a request, so every owner-scoped surface and every
write has a subject.

**Evidence**

- `code` — there is no session anywhere: `ACCOUNT` is a single module-scope constant
  (`lib/data/account.ts:83`) and the owner view is selected by a string comparison against
  it (`components/profile/load.ts:157`), both branches prerendered. SEAM-42, SEAM-54.
- `code` — the account menu renders that fixture's avatar and handle, and deliberately has
  **no `Sign out` row**: "a menu item that cannot do the one thing its verb names is worse
  than its absence" (`components/site/SiteHeader.tsx:411-425`).
- `code` — `Account` (`lib/data/account.ts:51-73`): `author`, `email` (never rendered
  publicly), `joinedAt`, optional `validatorSince`, `validatorWeight`, `defaultVisibility`,
  `notifications[]`.
- `code` — `/settings` renders it into an inert form, every control `readOnly` or
  `disabled`, with the honesty strip above the first field
  (`app/settings/page.tsx:200-226`, SEAM-43 to SEAM-50).
- `code` — one field group is live because its whole effect is the preview beside it
  (`components/settings/ProfileFields.tsx`, SEAM-44), and the file states the rule: a
  control works when its effect is local and immediate, and is switched off when its only
  effect would be persistence.
- `doc` — `docs/ARCHITECTURE.md` §7 ("A real server session/auth cookie. The 'owner' view
  today is a plain string comparison, not a stored session"); `docs/architecture/routes.md`
  §Access.
- `doc` — `docs/architecture/journeys.md` §5.6 declines to draw a registration journey at
  all: "There is no registration flow to diagram truthfully as a success path", and the
  account menu has no sign-up row.

**Behaviour**

- Stores one account per handle with the fields above, and a stable identity that survives a
  handle rename.
- Establishes a session, tells a client who it is, and ends the session — the three
  operations the missing menu row and SEAM-42 name.
- Keeps `email` off every public surface.
- Distinguishes "no session" from "session for another handle", because the profile pages
  render three different chromes (owner, visitor, and the no-session disclosure
  `ProfileShell` prints today).

**Unknowns**

1. What is the auth model — password, email link, OAuth, something else? `docs/DECISIONS.md`
   D-81 records "no GitHub OAuth, no linking of user repositories" as `AGENT-PROPOSED` /
   `NOT-IMPLEMENTED`, and D-79 (Supabase for auth+db+storage) is also `AGENT-PROPOSED`.
2. Is sign-up open, invite-only, or waitlisted? No surface proposes one.
3. Is an account required to download? `docs/DECISIONS.md` D-84 ("an account is asked for on
   *save*, never on download") is `AGENT-PROPOSED` / `NOT-IMPLEMENTED`.
4. Session transport: cookie, bearer token, both? See also
   [A-26](#a-26--programmatic-clients-and-credentials).
5. Is `Account` one row per `Author`, or can one identity hold several handles /
   organisations?
6. Is email verified, and does the account work before verification? The field's designed
   response shape includes `verificationSent` (SEAM-46) and the section note reads
   `◐ nothing sends`.
7. What happens to the seeded `mara-veil` fixture identity and the five other authors when
   real accounts exist? See [A-30](#a-30--migrations-seed-data-and-environments).

---

#### A-12 · Authorization, ownership and visibility

**Purpose.** Decide who may read and who may write each artefact, and keep the four
visibility promises the UI has already made in writing.

**Evidence**

- `code` — visibility is a per-bundle enum with an account-level default:
  `OwnedBundle.visibility` (`lib/data/bundles.ts:158`) and `Account.defaultVisibility`
  (fixture: `private`, `lib/data/account.ts:91`). SEAM-67, SEAM-48.
- `code` — the four promises, each stated where it is kept:
  1. a private fork is never announced on its upstream (`lib/data/bundles.ts:508-526`,
     `components/bundle/Aside.tsx:262-265`, `app/blueprints/[slug]/page.tsx:172-186`);
  2. a save is private and so is its count — the `saved` tab is owner-only
     (`components/profile/tabs.ts`, `app/u/[username]/saved/page.tsx`);
  3. the owner's blueprint and card counts include the private half and the visitor's do
     not, and the tab strip says so in words (`components/profile/load.ts:192-200`);
  4. a private bundle has no resolved graph and therefore no reading at all
     (`app/u/[username]/[slug]/page.tsx`).
- `code` — the split is enforced in the *data*, not only in the rendering:
  `ProfileView.ownedCards` and `saves` are built only for the owner
  (`components/profile/load.ts:64-72,174-177,211`).
- `code` — the live `Visibility` filter writes `?visibility=` and both owner shelves read it
  (`components/profile/VisibilityFilter.tsx`, SEAM-64, SEAM-113).
- `code` — the seam table's `Auth required` column is the frontend's own reading of what
  each interaction implies: `none`, `session`, or `owner`
  (`docs/architecture/seams.md`, header).
- `doc` — `docs/architecture/concept-model.md` §6; `docs/DECISIONS.md` D-82 (private
  blueprints excluded from the search index and from promotion counts, `AGENT-PROPOSED`).

**Behaviour**

- Stores visibility per bundle, defaulting from the account's preference, overridable per
  bundle.
- Serves a private bundle only to its owner, and never leaks its existence: not in fork
  counts, not in an upstream author's notifications, not in search, not in a visitor's
  counts.
- Distinguishes three read contexts on the same route — anonymous, signed-in visitor, owner
  — because the profile routes already render two of them as different pages.
- Gates every write on ownership of the target, except the community writes (star, vote,
  note, run report), which are gated on session alone.

**Unknowns**

1. Can a node card or a local ontology term be private, or is publishing a bundle the only
   thing that makes a card public? `lib/data/cards.ts` seeds private cards; `concept-model.md`
   §6 raises the same TBD.
2. Is ownership ever shared — an organisation, a team, a transfer in flight? `OwnedBundle`
   has one `owner` string and `/settings` §06 offers a transfer control.
3. Is there a role above owner (moderator, admin) and what may it do? `docs/DECISIONS.md`
   D-58 lists "account roles" among sixteen deliberately open policies.
4. Is "private" also unlisted-but-link-shareable, or strictly owner-only?
5. Does making a public bundle private again withdraw it from anyone who pinned it, and what
   happens to bundles that pin its cards?
6. Are private bundles excluded from term-usage counts used for ontology promotion (D-82) —
   and from anything else that aggregates?

---

#### A-13 · Ownership transfer and account deletion

**Purpose.** Move a bundle to another handle, and delete an account, without breaking
anything that already pins its content.

**Evidence**

- `code` — both controls are drawn and disabled, each with the cascade written beside it
  (`app/settings/page.tsx:433-449`, SEAM-50, SEAM-51):
  - deletion: "Your handle is reserved, your private bundles are destroyed, and everything
    you published stays. A pinned card cannot be withdrawn: {published} bundles in the
    archive would stop resolving" — where `{published}` is counted off the archive at build
    time, not typed (`:168`, `:439`);
  - transfer: "Hand ownership to another handle. The digest does not change, because the
    bundle is the same bytes. Only the author line moves."
- `code` — the handle-reservation rule that makes both possible: a published card carries
  the handle inside its own bytes (`:258-265`).
- `code` — the counts under "Authored under this handle" are read off the archive and marked
  `✓ counted` rather than seeded (`:157-173`, `:277-296`). SEAM-52, SEAM-111.

**Behaviour**

- Transfer moves ownership between handles without changing the digest; only the author line
  moves.
- Deletion reserves the handle permanently, destroys private bundles, keeps published work,
  and never withdraws a pinned card version.
- Both operations leave every pinned reference resolvable, since that is the property the
  copy promises.

**Unknowns**

1. Does a transfer need the recipient's acceptance, and what is the state in between?
2. Does the `author` field inside the published bytes change on transfer, given that the
   digest excludes `author` for cards but the manifest's `author` is inside the bundle
   digest's inputs?
3. What happens to the transferred bundle's stars, downloads, notes and run reports?
4. On deletion, what happens to the account's notes, votes and run reports — deleted,
   anonymised, or kept attributed to a reserved handle?
5. Is deletion immediate or deferred? The seam's proposed response is a `202`.
6. Are ontology terms namespaced under a deleted handle kept, and can the reserved handle be
   re-granted to the same person later?

---

#### A-14 · Profiles and the public author surface

**Purpose.** Serve the page at one handle: who they are, what they have published, what
they chose to pin, and the summary figures the header prints.

**Evidence**

- `code` — `profileView(username)` assembles the whole surface from six queries
  (`components/profile/load.ts:153-215`); five routes render slices of it. SEAM-53, SEAM-58.
- `code` — `Author {username, displayName, avatarHue, validator, bio?}` (`lib/types.ts:172`),
  fixture at `lib/data/users.ts`; `Profile {joinedAt, watchers, support, validated, pinned}`
  (`lib/data/profiles.ts:33-60`).
- `code` — pinned is a selection of at most two, and a pin the archive cannot resolve renders
  nothing at all rather than a placeholder (`load.ts:182-190`). SEAM-55 — and **there is no
  pin control anywhere in the UI**.
- `code` — the header's preview line is three figures: `totalDownloads`, `stars` (a sum
  computed fresh from blueprint votes plus card support, not a stored field) and `validated`,
  all marked `◐ seeded`, closing with "No telemetry, ballot, or verified run report is
  connected" (`components/profile/ProfileHeader.tsx`). SEAM-56.
- `code` — `Watch` is drawn and disabled with `title="Nothing stores a follow yet: there are
  no accounts behind this page."`; the watcher count is seeded. SEAM-57.
- `code` — counted-vs-seeded is a deliberate split: what the archive can count is counted at
  build time and marked `✓ counted`; only what it cannot is seeded
  (`lib/data/profiles.ts:9-21`, `lib/data/account.ts:23-27`).
- `code` — the terms tab reads ownership off the id prefix
  (`app/u/[username]/terms/page.tsx`). SEAM-60.

**Behaviour**

- Serves per handle: the author record, the profile record, published blueprints, authored
  cards, namespaced terms, and per-tab counts whose owner and visitor values legitimately
  differ.
- Stores the pinned selection (at most two, either a blueprint slug or a card ref) and drops
  a pin whose target no longer resolves.
- Stores follows and serves a watcher count and a "am I watching" flag.
- Keeps computed figures computed: anything the archive can count must not become a stored
  counter.

**Unknowns**

1. Where is the pin control? Nothing in the UI can set one, so is pinning an intended
   feature, an operator-seeded curation, or an artefact of the fixture?
2. Is `Profile.support` (support for the *person*) a real, separate counter from the sum of
   their content's stars? The header prints a computed sum, the fixture stores a number, and
   the two are different figures.
3. Does a follow produce a feed, or only a count? "There is no follow, no feed and nothing to
   notify" (`lib/data/profiles.ts:36-40`).
4. Is `avatarHue` user-chosen (the settings preview lets it move) and stored, or derived?
   Unknown authors get a hue derived from the name (`lib/content/view.ts:274-278`).
5. Does a profile exist for a handle that has published nothing, and is it reachable?
6. Are profiles ever private?

---

### Group IV — Community signals

#### A-15 · Bookmarks (saves)

**Purpose.** Let a reader privately keep blueprints, cards and terms, and show them back on
one list.

**Evidence**

- `code` — **two disjoint save sets exist for one UI verb, and the code says so three
  times** (`lib/data/bundles.ts:544-553`, `components/bundle/BundleHeader.tsx`,
  `components/profile/SavedList.tsx`):
  1. `FavoriteStar` writes `localStorage["darkprint:favorites"]`, a `Set` of compound keys
     — `blueprint:<slug>`, `node:<id>@<version>`, `bundle:<owner>/<slug>` — read through
     `useSyncExternalStore` with a fixed `false` server snapshot
     (`components/ui/FavoriteStar.tsx:30-94`). SEAM-62.
  2. The profile's Saved tab renders the unrelated five-row `SAVES` fixture
     (`lib/data/bundles.ts:554`), typed `{href, path, summary, kind}` where `kind` is
     `"blueprint" | "node card" | "vocabulary term"` (`:535-542`). SEAM-61.
- `code` — the save is private and so is its count: the visitor branch is the designed empty
  state, "Saves are private", with no number shown
  (`app/u/[username]/saved/page.tsx`, `components/profile/tabs.ts`).
- `code` — the local store tolerates private browsing and a full quota by silently not
  persisting (`FavoriteStar.tsx:38-57`).
- `doc` — `docs/ARCHITECTURE.md` §7 flag 1 and `docs/architecture/seams.md` TBD 4 both say a
  backend has to unify these into one table keyed on `(account, target)`.

**Behaviour**

- Stores a save per `(account, target)` where a target is one of three kinds, and serves the
  owner's list and a per-target "is it saved" flag.
- Never exposes the list or its size to anyone but the owner.
- Keeps a save distinct from a star: one is a private bookmark, the other is a public count
  (`lib/data/bundles.ts:528-534`).

**Unknowns**

1. Are the browser-local favourites migrated into the account on first sign-in, or discarded?
   (`seams.md` TBD 4.)
2. What exactly is a target — a slug, a card id, a card ref including the version, a term id?
   The local key forms and the `SAVES` rows disagree in grain (`node:<id>@<version>` vs a
   card page href without a version).
3. Can a save be made against something the reader can see but that later goes private or is
   deleted? What does the list show then?
4. Is a save ordered (recency), foldered, or annotated?
5. Does a signed-out reader keep browser-local saves at all once accounts exist?

---

#### A-16 · Stars and support counts

**Purpose.** Count public support for a blueprint or a card, and let a signed-in reader add
or remove theirs.

**Evidence**

- `code` — the control and the count sit beside every blueprint and card title
  (`components/ui/FavoriteStar.tsx:152-183` renders the count with
  `title="Seeded support count; no community backend is connected"`;
  `app/blueprints/[slug]/page.tsx:296` passes `support={bp.votes}`;
  `app/nodes/[...id]/page.tsx` passes `count={starsFor(card.id)}`). SEAM-75, SEAM-76.
- `code` — the two are stored differently today: a blueprint's is
  `CommunitySignals.votes` (`lib/data/community.ts:46`), a card's is **derived** —
  `round(downloadsFor(id) * 0.08)` — kept in one module precisely so the placeholder is
  replaceable by one repository lookup (`lib/data/node-community.ts:85-95`).
- `code` — the same figure is rendered under four names across the site: `votes`, `support`,
  `stars`, "N public" (`docs/architecture/glossary.md`, naming table row "Support / votes /
  stars").
- `code` — the profile header sums blueprint votes and card support into a fifth figure that
  is not stored anywhere (`components/profile/ProfileShell.tsx`).

**Behaviour**

- Stores one star per `(account, target)` and serves the aggregate count plus the caller's
  own state, which is what the toggle needs.
- Distinguishes a star from a save everywhere: the star is public and counted, the save is
  private.
- Counts blueprints and cards on the same footing, since one control renders both.

**Unknowns**

1. Are card stars counted per id or per version? The download counter behind today's
   derivation is keyed by id, so versions share it.
2. Do blueprints and cards share one counter table keyed by a polymorphic target, or two?
   (`concept-model.md` §2 TBD.)
3. Can a star be cast anonymously, and is it rate-limited or deduplicated per account?
4. Is the count denormalised on the artefact row or computed per read?
5. Does a star survive its target being made private, transferred, or forked?

---

#### A-17 · Download counting

**Purpose.** Count how many times a blueprint or a card has been taken, for the figure both
tiles and both detail pages print.

**Evidence**

- `code` — `Blueprint.downloads` comes from `CommunitySignals.downloads`
  (`lib/data/community.ts:46`), rendered on gallery tiles, the blueprint page and profiles.
  SEAM-77, whose seam row notes it could be "derived from access logs".
- `code` — cards use a separate map keyed by card **id**, not by ref
  (`NODE_DOWNLOADS`, `lib/data/node-community.ts:24-83`), returning `0` for an unlisted id,
  "which reads as a card nobody has downloaded yet". SEAM-78.
- `code` — every surface marks the figure `◐ seeded`; on the card page the marker sits
  beside the number because that page has no other paragraph naming it
  (`app/nodes/[...id]/page.tsx`).
- `code` — the download itself is a static file fetch today (`public/bundles/**`,
  `public/cards/**`) or an in-tab `data:` URL, so nothing observes it.

**Behaviour**

- Counts a download of a bundle and of a card version, and serves the aggregate.
- Is honest about grain: the UI prints one label ("↓ N downloads") over two different
  countings today.

**Unknowns**

1. What counts as a download — a file fetch, a folder fetch, a `curl` of the whole list, a
   CLI pull, an MCP fetch, a `data:` URL click that never touches the server?
2. Per card id or per card version?
3. Are they counted from access logs or from an explicit event the client posts? The seam
   row leaves both open.
4. Are they deduplicated per account, per IP, per time window?
5. Do private-bundle fetches count?

---

#### A-18 · Community ballot and vote weighting

**Purpose.** Collect and aggregate the three subjective scorecard metrics — efficacy,
reliability, transparency — with validator votes weighted.

**Evidence**

- `code` — the three metrics come straight from the index row and each `detail` string is
  written in the conditional, ending "Seeded, no ballot exists"
  (`lib/content/view.ts:170-192`). SEAM-74.
- `code` — `MetricSource` is the write-authority discriminator: `auto` (engine only),
  `community` (the ballot), `reported` (whoever ran it) — `lib/types.ts:36`, and
  `METRIC_SOURCE_META` gives each a label and a colour (`lib/format.ts`).
- `code` — `EvidenceLayers` column 2 states `insufficient sample` and refuses to close the
  radar polygon with a placeholder (`components/blueprint/EvidenceLayers.tsx`).
- `code` — the weighting is declared and unapplied: `Account.validatorWeight = 3`
  (`lib/data/account.ts:88`), and `/settings` §05 says "validator voting is not built, so
  the three community metrics on every scorecard are seeded and nothing here carries weight
  over anyone else's reading" (`app/settings/page.tsx:401-405`).
- `code` — no control exists to cast one of these votes anywhere in the UI.
- `doc` — `docs/architecture/concept-model.md` §4 ("who may write each one").

**Behaviour**

- Stores one ballot per `(account, blueprint, metric)` on a 0-100 axis, and serves the
  aggregate plus the sample size.
- Weights a validator's ballot by their weight at the time of the vote or at aggregation.
- Publishes the sample size alongside the figure, because the UI already refuses to show an
  aggregate as a fact without it.
- Never lets a ballot write an `auto` metric.

**Unknowns**

1. What is the input — a 0-100 slider, a five-point scale, a thumbs pair? No control exists
   to read the shape off.
2. Is a vote per blueprint, per release digest, or per (blueprint, version)? Two releases of
   one blueprint may deserve different scores.
3. What is the minimum sample before a figure is shown at all, and what is shown below it?
   `EvidenceLayers` has an `insufficient sample` state; the threshold is unset.
4. Is a voter required to have downloaded or run the blueprint?
5. Can a vote be changed or withdrawn, and is the voter's identity public?
6. Is the weight applied at write time (stored weighted) or at read time (weights can move
   retroactively)?
7. Are the three metrics independent votes or one submission? SEAM-74's proposed body has
   all three optional.

---

#### A-19 · Validator role and grants

**Purpose.** Mark an account as a validator, which is what makes its ballot weigh more.

**Evidence**

- `code` — `Author.validator: boolean` (`lib/types.ts:172-180`) and
  `Account {validatorSince?, validatorWeight}` (`lib/data/account.ts:51-73`).
- `code` — the badge renders on profiles with `title="Preview badge; validator voting is not
  built"` (`components/profile/ProfileHeader.tsx`). SEAM-83.
- `code` — `/settings` §05 wears `ComingSoonBadge` and names two unbuilt things apart: an
  account is one, a ballot is another (`app/settings/page.tsx:59-64`, `:378-406`). SEAM-49.
- `code` — three of six seeded authors are validators (`lib/data/users.ts`).
- `doc` — `docs/ARCHITECTURE.md` §11.2 states this plainly as a structural gap: "who is
  allowed to grant the `validator` badge — `Account.validatorWeight` exists and is seeded,
  but nothing in the code proposes a granting process".

**Behaviour**

- Stores the flag, the grant date and the weight per account, and serves them on the public
  author record and on the account.
- Applies the weight wherever a ballot is aggregated
  ([A-18](#a-18--community-ballot-and-vote-weighting)).

**Unknowns**

1. Who grants it — an admin, a threshold, an election, an application?
2. Is the weight per-account (as the field implies) or a single constant for the role?
3. Can it be revoked, and what happens to ballots already weighted by it?
4. Does the badge mean anything beyond vote weight — moderation, review, promotion of
   ontology terms?
5. Is `Profile.validated` (run reports this handle contributed that were accepted) an input
   to the grant, or unrelated? The two are separate fields today.

---

#### A-20 · Notes (comments) and note votes

**Purpose.** Let readers write notes on a blueprint or a card, list them, and vote on them.

**Evidence**

- `code` — the list is read-only and **there is no form**: the empty state says "There is no
  form on this page and no runner behind it, so posting is not built"
  (`components/blueprint/Comments.tsx:72-78`); the `◐ seeded` marker is on the heading so it
  is read whichever branch the list takes (`:63-66`). SEAM-79, SEAM-80.
- `code` — one component serves both subjects, with the noun corrected per surface
  (`Comments({comments, subject})`, mounted from `app/blueprints/[slug]/page.tsx` and
  `app/nodes/[...id]/page.tsx`).
- `code` — two separate maps, one row type: `COMMUNITY[slug].comments`
  (`lib/data/community.ts:100`) and `NODE_COMMENTS[cardId]`
  (`lib/data/node-community.ts:110`, empty for every card, deliberately).
- `code` — `Comment {id, author: Author, body, createdAt, votes}` (`lib/types.ts:182-189`),
  where `id` is local to its parent row, so the real key is `(parent, id)`; `author` is an
  embedded object where every other author reference is a string.
- `code` — `VISIBLE_NOTES = 10` and a `Load more` reveal over the already-shipped array, with
  the cost stated in the file (find-in-page does not reach the rest). SEAM-82.
- `code` — `Comment.votes` renders per row and no control casts one. SEAM-81.

**Behaviour**

- Stores a note against a blueprint or a card, with an author, a body and a creation time,
  and serves them newest-first with a cursor and a page size (10 is the size the UI uses).
- Stores a vote per `(account, note)` and serves the aggregate.
- Serves an author reference the client can render as a chip: handle, display name, hue,
  validator flag.

**Unknowns**

1. Is a note polymorphic over `(blueprint | card)` or two tables? (`concept-model.md` §2 TBD.)
2. Is a note attached to a blueprint or to a release digest?
3. Can a note be edited or deleted, by whom, and is there moderation? "Moderation" is one of
   the sixteen policies `docs/DECISIONS.md` D-58 leaves open.
4. Is there threading or replies? The row type has no parent field.
5. Is the vote a single direction or up/down? SEAM-81's proposed body is `{direction: 1 | -1}`
   and nothing renders a control.
6. Are notes ordered by recency or by votes, and does that ordering affect the `Load more`
   cursor?
7. Is markdown allowed in a body, and what is the length limit?

---

#### A-21 · Run-report ingestion and cost aggregation

**Purpose.** Accept a self-reported statistic about a run that happened on somebody else's
machine, and aggregate accepted reports into the one `reported` metric.

**Evidence**

- `code` — **no UI element exists**; the shape is declared by `ReportedCost {runs, median,
  spread{p10,p90}, model}` (`lib/data/community.ts:34-43`) and it is `undefined` on every row
  and absent from the fallback, "because it is absent in fact". SEAM-84.
- `code` — the aggregation rules are already configured and read by nothing:
  `telemetry.minRuns: 5`, `telemetry.outlierZScore: 3` (`lib/core/config.ts:171-174`).
  SEAM-85.
- `code` — two states are written for the cost row: the 0-run sentence ("The figure is a
  seeded placeholder, not a measurement") and a below-`minRuns` sentence that names it a
  sample rather than a figure to compare (`lib/content/view.ts:232-251`).
- `code` — `EvidenceLayers` column 3 lists exactly the fields a comparable report needs:
  "model, provider, hardware, input size, harness version, sample size, spread, and
  freshness" (`components/blueprint/EvidenceLayers.tsx`).
- `code` — the architectural constraint: the word is `reported`, never `measured`, on the
  union member, the badge and the blurb, because DarkPrint never observes a run
  (`lib/types.ts:27-36`). SEAM-86. `PageHolds` states the same on every bundle page: "What
  it still does not: a run, a key, or any telemetry about either"
  (`components/bundle/Aside.tsx:29-38`).
- `code` — `Profile.validated` counts accepted reports this handle submitted **for other
  accounts' blueprints**, and never adds a run to any blueprint's evidence layer
  (`lib/data/profiles.ts:46-57`).
- `doc` — `docs/DECISIONS.md` D-59 (`NOT-IMPLEMENTED`): the card must show run count and
  dispersion, not only a mean.

**Behaviour**

- Accepts a report identifying the exact bytes it ran (`digest`) plus the conditions —
  model, provider, hardware, input size, harness version, cost units, duration, timestamp —
  and answers whether it was accepted.
- Aggregates accepted reports into a median and a p10-p90 spread, dropping outliers beyond
  the configured z-score, and never publishes an aggregate without its run count and model.
- Never presents an aggregate below the minimum sample as a figure to compare.
- Never claims to have measured anything.

**Unknowns**

1. What produces a report? There is no form, no CLI and no harness integration; the entire
   producer side is undesigned.
2. What is accepted vs rejected, and what makes a report trustworthy at all given that the
   platform cannot verify any of it?
3. Are reports per digest or per slug? A report against one release says nothing about the
   next.
4. Is cost normalised across models and currencies before being put on the 0-100 axis, and
   by what? ("Run normalisation" is one of D-58's sixteen open policies.)
5. Are reports public per row, or only in aggregate? `Profile.validated` implies per-row
   attribution exists somewhere.
6. Is the seeded `CommunitySignals.cost` stand-in kept as a fallback once real reports
   exist, or removed?
7. What is "freshness" — do old reports expire out of the aggregate?

---

#### A-22 · Notifications and event fan-out

**Purpose.** Tell an account when something happened to its content, according to four
preferences it already has rows for.

**Evidence**

- `code` — four `NotificationSetting` rows, each with a stable id, the event in a reader's
  words, why it is on or off by default, and a boolean: `repin`, `fork`, `deprecation`,
  `digest` (`lib/data/account.ts:92-117`). SEAM-103 to SEAM-106; the switches are `disabled`
  and the section note reads `◐ nothing sends` (`app/settings/page.tsx:302-331`, SEAM-47).
- `code` — each row states its own rule: `repin` is "the one notification a version-pinned
  registry genuinely needs"; `fork` is **"Public forks only. A private fork is never
  announced to the upstream author."**; `deprecation` "comes with the pointer to whatever
  supersedes it"; `digest` is off by default.
- `code` — the events each one fans out from already exist as aspects: a card version
  publishing ([A-02](#a-02--node-card-library-identity-and-version-chains)), a fork
  ([A-09](#a-09--fork-lineage-and-drift)), an ontology release
  ([A-03](#a-03--ontology-store-and-vocabulary-versioning)).

**Behaviour**

- Stores the four preferences per account and serves them for the settings form.
- Emits a notification when the corresponding event occurs, honouring the preference and the
  public-fork rule.
- Carries the pointer to the successor term with a deprecation notice.
- Runs the weekly digest on a schedule and leaves it off by default.

**Unknowns**

1. What is the delivery channel — email, in-app inbox, both? There is no inbox surface
   anywhere in the UI, and `/settings` calls the section "Email & notifications".
2. Is `repin` triggered by a card *you pinned* publishing a new version (as the copy says),
   which needs a per-account watch list of pinned refs — where is that stored?
3. Do follows ([A-14](#a-14--profiles-and-the-public-author-surface)) generate notifications
   too? `Watch` exists as a control with no event behind it.
4. Are the four rows the whole set, or is this an extensible event catalogue?
5. What is the retry/idempotency contract for a fan-out that fails?
6. Is there a digest of anything other than new blueprints?

---

### Group V — Discovery

#### A-23 · Search, filters and ranking

**Purpose.** Answer "which blueprints, cards or terms match this" for the three browsing
shelves, and for an agent asking in prose.

**Evidence**

- `code` — every shelf filters a fully prerendered array client-side and stores its state in
  the query string via `history.replaceState`
  (`components/ui/useQueryState.ts`, SEAM-112). The exact parameter sets are already fixed:
  - `/blueprints`: `q`, `tag`, `cat`, `phase`, `autonomy`, `df=1`, `forks`, `sort`
    (`components/gallery/GalleryBrowser.tsx:96-194`). SEAM-02.
  - `/nodes`: `q`, `type`, `phase`, `human=1`, `risk=1`, `sort`
    (`components/nodes/NodeBrowser.tsx:289-307`). SEAM-08.
  - `/ontology`: `q`, `kind`, `origin` (`components/ontology/VocabularyBrowser.tsx:119-121`).
    SEAM-15.
- `code` — the only search in the repository is `Registry.searchCards`, a case-insensitive
  substring match over id/name/action/notes with `spec` deliberately excluded
  (`lib/core/archive/registry.ts:91,333`), and it is **not wired to any page**.
- `code` — autonomy is a filter and never a sort key, and no surface offers popularity
  sorting (`components/ui/autonomy-surfaces.test.ts` pins both; `docs/DECISIONS.md` D-31,
  D-57).
- `code` — the ranking constraint is stated on `/mcp`: "a relevance score with no published
  derivation is the kind of number this site refuses everywhere else, so either the ordering
  is explainable from the archive or results come back with their evidence and no order at
  all" (`app/mcp/page.tsx:137-141`). SEAM-88.
- `code` — semantic search over blueprints is the owner-stated purpose of the MCP server
  (`docs/DECISIONS.md` D-05, `OWNER-STATED` / `NOT-IMPLEMENTED`). SEAM-93.
- `code` — the owner shelves' find boxes are drawn and switched off, with the reason in
  place (`app/u/[username]/cards/page.tsx:64-71`, `components/profile/parts.tsx`
  `ShelfToolbar`). SEAM-64.

**Behaviour**

- Serves the three shelves' filters as server-side parameters behind the same query-string
  keys the URLs already use, so a shared link keeps working.
- Serves the facet vocabularies (tags, categories, phases, node types) alongside results.
- Keeps "no results" a designed state with a `Clear filters` control that clears exactly the
  keys each shelf owns.
- Excludes private content from every public search
  ([A-12](#a-12--authorization-ownership-and-visibility); D-82).
- Publishes its ordering, or returns no ordering at all.

**Unknowns**

1. Is search lexical, semantic (embeddings), or both? D-05 says RAG; the only implementation
   is a substring match.
2. If semantic: what is embedded — the card `spec` (deliberately excluded from the current
   search), the manifest, the whole bundle — and when is it re-embedded?
3. What is the ranking, and how is it explained? The constraint is stated; the answer is
   not.
4. Are the owner shelves' find boxes searching the same index as the public one, including
   private rows?
5. Is `sort` server-side, and which keys are allowed given that autonomy may not be one and
   popularity is deliberately withheld until event semantics are defined (D-57)?
6. Is there a search over ontology terms and notes too, or only blueprints and cards?

---

#### A-24 · Term-usage index and promotion

**Purpose.** Count who uses each vocabulary term, and decide when a local term becomes a
candidate for the curated core.

**Evidence**

- `code` — `termUsageIndex(registry)` walks every card and accumulates, per term id, the
  distinct cards, blueprints and authors naming it, across six reference sites (`phases`,
  `type`, `riskMarkers`, `tools`, port types)
  (`components/ontology/TermTable.tsx:190-215`). SEAM-17.
- `code` — the counts render on `/ontology`, on every term page, and drive `narrowerReach`
  (`app/ontology/[...term]/page.tsx`); `NO_USAGE` is the designed empty row and an abstract
  root's own count of 0 is explained rather than hidden.
- `code` — `PromotionConfig {distinctAuthors: 3, distinctBlueprints: 5}`
  (`lib/core/config.ts:165-168`) and **nothing reads it**. SEAM-18.
- `doc` — `docs/architecture/concept-model.md` §7 TBD (persisted `term_usage` table vs
  read-time query, and the exclusion of private blueprints);
  `docs/DECISIONS.md` D-82 (`AGENT-PROPOSED`).

**Behaviour**

- Serves, per term: which cards name it, which blueprints those cards are used in, and how
  many distinct authors — the three counts promotion needs.
- Serves promotion candidates against the configured thresholds.
- Excludes private content from the counts, or the shared vocabulary can be steered with
  content nobody can see (the reason `lib/core/config.ts:74-79` states).

**Unknowns**

1. Persisted table or read-time query? (`concept-model.md` §7 TBD.)
2. Who acts on a promotion candidate — is promotion automatic at threshold, or a curated
   decision? "Ontology governance" is one of D-58's sixteen open policies.
3. What happens to the local id when a term is promoted — is `lupo/pii-handling` rewritten to
   `pii-handling` in every card that names it, aliased, or deprecated with a redirect?
4. Are the thresholds per kind (a tool vs a risk marker), or global?
5. Does usage include a bundle's own local overlay terms that no card outside it names?

---

#### A-25 · MCP server surface

**Purpose.** Let an agent read the registry from inside its own session, over MCP.

**Evidence**

- `code` — `/mcp` is explicitly a design proposal, and the page says so in its lead, its
  metadata description and per table row: every operation prints `not built`
  (`app/mcp/page.tsx:73-82`, `:294-318`). SEAM-87 to SEAM-92.
- `code` — four operations are named in words, deliberately with **no function signatures**,
  "because none has been designed and a plausible one would be a lie in a different font"
  (`:65-70`, `OPERATIONS` at `:85-110`): `search` (task in the agent's own words →
  blueprints and cards, each with kind, author and digest), `read a card` (card id → the
  YAML as published), `inspect provenance` (slug → who published it, what it was forked
  from, every release digest), `fetch a release` (slug + digest → `blueprint.dot`,
  `cards/*.yaml`, `README.md`, `AGENTS.md`, names read from `bundle-export.ts` so the
  proposal cannot describe a different registry).
- `code` — six real client configs exist for a package that does not exist
  (`components/mcp/clients.ts`, `lib/mcp.ts:1-21`, `MCP_CONNECT_COMMAND` derived from
  `MCP_CLIENTS[0]`), and §1 says above the command "The package does not exist: running this
  adds a server that is not there".
- `code` — scope: "Read access to the registry, and nothing else" (`app/mcp/page.tsx:214-216`).
- `code` — the four open questions the page itself records: ranking, excerpt shape,
  authorization, cards-or-releases (`OPEN` at `:137-154`).

**Behaviour**

- Exposes the four read operations above over MCP transport, returning facts about an
  artefact and no judgement of it: what it is, who wrote it, and the digest it was published
  under.
- Keeps the slug/digest distinction load-bearing: by slug you get whatever the registry
  holds today, by digest you get the bytes you tested against.
- Returns file names that match what the exporter actually writes.
- Excludes private content (D-82).

**Unknowns**

1. All four of the page's own open questions, unanswered here by design: ranking; excerpt
   shape; authorization (there is nothing to authorize today, and a private bundle would
   need an account, storage and a backend); cards or releases or both, and what it means to
   pin one without the other.
2. Is the server stdio-only (`npx -y darkprint mcp`, as every client config assumes), remote,
   or both?
3. Is the MCP surface a separate service or a thin client over the same HTTP API the site
   uses?
4. Who publishes the `darkprint` npm package, and is it the same artefact as the CLI the
   clone menus name? See [A-26](#a-26--programmatic-clients-and-credentials).
5. Are MCP reads counted as downloads ([A-17](#a-17--download-counting))?

---

#### A-26 · Programmatic clients and credentials

**Purpose.** Serve the non-browser callers the UI already names — a CLI, the authoring
skill's editor, an MCP host — and decide what credential each carries.

**Evidence**

- `code` — `darkprint clone <slug>` and `darkprint clone card <ref>` are printed in the clone
  menus wearing `ComingSoonBadge`, because "there is no `darkprint` package on npm"
  (`components/blueprint/CloneMenu.tsx`, `lib/mcp.ts:6-7`). SEAM-21, SEAM-23.
- `code` — the working alternative today is an anonymous `curl` line over `SITE_ORIGIN`
  (`lib/content/bundle-export.ts:308,321`), and the panel says in place that this copies a
  snapshot over HTTP and is not a clone (`components/bundle/BundleHeader.tsx`).
- `code` — `/skill` states the missing half: there is no live push from the editor the skill
  runs in — "it writes the folder to your disk, and you bring it here"
  (`app/upload/page.tsx:178-179`, pinned verbatim by `components/site/honesty.test.ts`).
  SEAM-96.
- `code` — the skill itself installs and runs today over git
  (`SKILL_INSTALL_COMMAND`, `lib/skill.ts`), and nothing in this repository's gates fails
  when its output stops matching what `/skill` and `/upload` say it writes. SEAM-94.
- `speculative` — nothing in the frontend proposes a token, a scope or a credential of any
  kind. Listed anyway because three named callers (CLI, skill push, MCP) would all need one
  the moment publishing exists, and because `/mcp`'s own authorization question is recorded
  as open rather than answered.

**Behaviour**

- Serves reads to anonymous clients over plain HTTP, since that is what the printed `curl`
  line already promises.
- Accepts an authenticated write from a non-browser client, if publishing from the editor is
  wanted, without a browser session.

**Unknowns**

1. Is there a CLI at all, or is `darkprint clone` a copy affordance the site should stop
   printing?
2. Is the `darkprint` npm package one artefact (CLI + MCP server) or two?
3. What credential does a non-browser write carry — a personal token, a device flow, an OAuth
   app — and what scopes does it have?
4. Does the authoring skill ever talk to the registry, or does the folder always travel
   through `/upload`?
5. Is anonymous read guaranteed to stay anonymous once private content exists (i.e. does the
   download URL stay unauthenticated)?

---

### Group VI — Platform, cross-cutting

#### A-27 · API error and response conventions

**Purpose.** Give every operation one shape for success, one for refusal, and one for "the
data is fine but there is nothing to say", so the states the UI already designed can be
rendered from a response.

**Evidence**

- `code` — the engine's own convention is settled and should not be re-invented: every stage
  reports user-data problems as `Diagnostic[]` instead of throwing
  (`lib/core/diagnostics.ts:1-5`), with a closed `DiagnosticCode` union, three severities,
  a message, an optional hint and an optional location.
- `code` — the "degrade, do not stop" rule is load-bearing: a bundle whose DOT parsed comes
  back with an analysis over the nodes that resolved, and the three states are separately
  worded (`components/upload/progress.ts`, `UploadFlow.tsx:1176-1201`).
- `code` — absence is a designed state, not an empty response: `insufficient sample`, `no
  verified runs`, `computed` (`components/blueprint/EvidenceLayers.tsx`); "No problems found,
  the validator had nothing to say about this bundle"
  (`components/ui/DiagnosticList.tsx`); five distinct `EmptyState` strings across the profile
  tabs (`components/profile/parts.tsx`).
- `code` — 404 semantics today: `notFound()` on every dynamic route, paired with
  `dynamicParams = false`, so an unknown slug is a build-time 404
  (`app/blueprints/[slug]/page.tsx:62`, `app/nodes/[...id]/page.tsx:62`, and the four `/u/`
  routes); `generateMetadata` returns a "X not found" title.
- `code` — there is **no** `error.tsx`, `not-found.tsx`, `global-error.tsx` or `loading.tsx`
  anywhere under `app/` (verified: none exist), so the framework defaults are the whole of
  the error UI. `docs/ARCHITECTURE.md` §10.4-10.5 records the same.
- `speculative` — the HTTP envelope itself (status codes, error body shape, validation-error
  format) has no evidence anywhere in the frontend, because no call is ever made.

**Behaviour**

- Returns diagnostics as data, with codes stable enough to switch on, since the UI groups
  them by code today (`components/blueprint/severity-word.test.ts`,
  `lib/criteria-state.ts`).
- Distinguishes "refused" from "incomplete but legible": the UI already writes different
  copy for each and must not be forced to infer one from an error count.
- Keeps a glyph *and* a word on every severity, because the accessibility rule is centrally
  enforced (`components/ui/severity.ts:1-19`) and tested across all nine archive bundles.

**Unknowns**

1. What is the error envelope — problem+json, a `{error}` object, plain status codes?
2. Which failures are HTTP errors and which are 200-with-diagnostics? A bundle with five
   validation errors is a legitimate answer, not a server failure.
3. Are `DiagnosticCode`s part of the public API contract (and therefore frozen), or internal?
4. What is a 404 vs a 403 for a private bundle — does the API distinguish "not yours" from
   "does not exist"? Doing so leaks existence; not doing so changes the owner's error UI.
5. Are there partial successes (publish succeeded, notification fan-out failed) and how are
   they reported?
6. What idempotency guarantees do the write operations give?

---

#### A-28 · Rate limiting, abuse and content boundaries

**Purpose.** Keep an open, scrapable read surface usable while bounding what a writer can
cost or upload.

**Evidence**

- `doc` — `docs/DECISIONS.md` D-83 (`AGENT-PROPOSED`, `NOT-IMPLEMENTED`): do not build
  anything actively anti-scraping; put rate limiting on the APIs instead, because "not
  scrapable" conflicts with SEO, LLM ranking and MCP.
- `doc` — D-58 lists "malicious-bundle boundaries" and "moderation" among sixteen product
  policies deliberately left open.
- `code` — the only limit that exists anywhere is a client-side courtesy: `MAX_KB = 512`
  per file, skipped with a notice rather than an error
  (`components/upload/BundleDropzone.tsx:91,449-459`).
- `code` — the engine has one hard bound of its own: `MAX_PARAM_DEPTH = 100` on a card's
  `params` (`lib/core/card/validate.ts:108,718-722`), plus a minimum `spec` length
  (`card/spec-too-thin`).
- `code` — the read surface is deliberately open: every artefact is downloadable over HTTP
  with no account, and `/mcp` records that there is nothing to authorize today because of
  it (`app/mcp/page.tsx:146-149`).
- `speculative` — nothing in the frontend expresses a quota, a 429, a captcha or a
  moderation state. Listed because every write aspect above (publish, star, vote, note, run
  report) is an unauthenticated-by-default cost the moment it exists.

**Behaviour**

- Bounds submission size, file count and validation cost per request and per account.
- Bounds the community writes (stars, ballots, notes, run reports) per account and per
  window.
- Leaves the read surface crawlable rather than defending it.

**Unknowns**

1. What are the actual limits — per account, per IP, per token, per endpoint?
2. What does the UI do at a limit? No surface renders a rate-limit state today.
3. What is a malicious bundle here — a card `spec` carrying a prompt injection aimed at the
   agent that reads it, an enormous graph, a zip bomb, a link to malware? The registry
   distributes instructions for agents to execute, so this needs a stated boundary.
4. Is uploaded content scanned or moderated before it is public, and by whom?
5. Is there a takedown path (DMCA, abuse) and what does it do to a content-addressed,
   pinned-by-others artefact?
6. Is licensing declared per bundle? "Licensing" is another of D-58's sixteen.

---

#### A-29 · Observability and audit

**Purpose.** Let whoever operates the registry see what it did, without ever observing a
blueprint run.

**Evidence**

- `code` — the only telemetry in the product today is page-view counting:
  `@vercel/analytics` mounted once as the last child of `<body>`
  (`app/layout.tsx:3,96`), with the adjacent comment stating the scope — page views only,
  no-ops outside a Vercel deployment, and **distinct from the unbuilt blueprint-run
  telemetry** of SEAM-84/85 (`:91-95`). No custom `track()` call exists anywhere.
- `code` — the hard constraint an observability design must not break: the registry holds
  "this bundle and who owns it. What it still does not: a run, a key, or any telemetry about
  either. Execution stays on your machine." (`components/bundle/Aside.tsx:33-36`), and
  `MetricSource` says `reported`, never `measured` (`lib/types.ts:27-36`).
- `code` — the build-time equivalents of an audit trail exist and are strict: the loader
  throws with **every** problem from **every** bundle listed rather than the first
  (`lib/content/read.ts:281-291`), and `scripts/generate-bundles.ts` does the same.
- `speculative` — request logging, metrics, tracing, an admin view and an audit log have no
  frontend evidence at all. Listed because every write aspect above changes state that a
  reader is told is checkable, and "who published this release, when" is already printed on
  a page (`components/bundle/History.tsx`) with no store behind it.

**Behaviour**

- Records what changed, by whom and when, for the operations whose results the UI presents
  as history (publishes, releases, transfers, visibility changes).
- Records nothing about the execution of a blueprint, since that happens on the reader's
  machine and the product's copy says so in several places.

**Unknowns**

1. Is there an audit log distinct from the user-visible history, and who can read it?
2. What is logged per request, and for how long is it retained? "Retention" is one of D-58's
   sixteen open policies.
3. Are download counts derived from access logs (SEAM-77 leaves that open), and does that
   make logs load-bearing product data rather than operational data?
4. Is there an operator/admin surface at all? None exists in the route table.
5. What is the alerting and health-check surface for the publish path, whose failure mode
   today (a build that throws) is loud by construction?

---

#### A-30 · Migrations, seed data and environments

**Purpose.** Get from a repository whose data is nine directories and six fixture modules to
a running store, repeatably, and keep the two consistent while both exist.

**Evidence**

- `code` — the seed content is real and already validated: 9 bundles, 57 card files (53 ids),
  1 ontology overlay, all of which fail the build if they do not resolve
  (`lib/content/read.ts:281-291`).
- `code` — the seed *index* is six fixture modules, each declaring in its own header that it
  stands in for a table: `lib/data/account.ts` (one account),
  `lib/data/users.ts` (6 authors, keyed by a short key that is **not** the handle),
  `lib/data/profiles.ts` (6 profiles), `lib/data/bundles.ts` (5 owned bundles, 5 saves),
  `lib/data/cards.ts` (2 private cards), `lib/data/community.ts` (9 signal rows with 12
  notes), `lib/data/node-community.ts` (53 download rows, 0 notes).
- `code` — the seeding rule stated in code, which a migration has to respect: **a seeded
  bundle is always private**, because a public one is a claim about the registry a fixture
  cannot make true (`lib/data/bundles.ts:10-22`); the same rule is restated for private
  cards (`lib/data/cards.ts:1-26`).
- `code` — the counted-vs-seeded discipline: anything the archive can count is counted and
  marked `✓ counted`, and seeding such a figure is how the two markers stop meaning
  anything (`lib/data/profiles.ts:9-14`, `app/settings/page.tsx:157-167`).
- `code` — determinism is already a property of the export path: `exportBundle` is pure and
  sorted, the output directory is cleared before writing, and nothing reads a clock or a
  random source (`scripts/generate-bundles.ts` header).
- `code` — `lib/core/**` may not read the clock or a random source at all (`CLAUDE.md`;
  `BundleManifest.createdAt` is "supplied by the caller", `concept-model.md` §2).
- `speculative` — schema migrations, environment separation and backup/restore have no
  frontend evidence; they are listed because a content-addressed archive plus a mutable
  index is exactly the shape where the two can drift.

**Behaviour**

- Imports the archive as published content and the fixtures as the accounts, profiles and
  signals that make the existing pages render, without turning any counted figure into a
  stored one.
- Preserves the digests: an imported bundle must hash to the same digest the site prints
  today, or every pinned reference and every printed version string changes.
- Keeps the "no clock, no randomness inside the engine" rule, so timestamps enter from the
  caller and an import is reproducible.

**Unknowns**

1. Do the six seeded authors become real accounts, demo accounts, or are they dropped and the
   nine bundles re-attributed?
2. Is `lib/data/**` deleted at cutover, or does it remain as a development fixture behind an
   environment flag? `docs/DECISIONS.md` D-78 says every seeded marker and disclaimer must be
   revisited in the same change that makes it false.
3. What are the environments (local, preview, production) and does each get its own copy of
   the archive?
4. Backup and restore: is the archive recoverable independently of the index, given that one
   is immutable and one is not?
5. How is a schema change to a *published card* handled, given that a published version can
   never be edited — is the wire format versioned separately from the ontology?
6. Are the `AUTHORS` short keys (`mara`, `sol`, `kwame`…) meaningful, or an artefact? Three of
   six differ from the handle.

---

#### A-31 · Rendering, caching and invalidation contract

**Purpose.** Decide what the site renders per request once the registry can change without a
rebuild, and what invalidates when a write lands.

**Evidence**

- `code` — every page is statically prerendered from the archive at build time, and the
  dynamic routes are closed sets: `dynamicParams = false` plus `generateStaticParams()` over
  the archive on `/blueprints/[slug]` (`:62-66`), `/nodes/[...id]` (`:62-68`),
  `/ontology/[...term]`, and the five `/u/[username]*` routes (which enumerate
  `AUTHOR_LIST`, e.g. `app/u/[username]/cards/page.tsx:34-36`).
- `code` — `app/nodes/[...id]/page.tsx:49-62` states the reason in full: the archive reader
  walks `content/` off the working directory, which is a build-time fact, so an unknown id is
  a build-time 404 rather than a request-time render.
- `code` — 165 prerendered pages across 27 route patterns
  (`docs/architecture/routes.md` §Cross-check).
- `code` — the two module-scope caches that make this work (`lib/content/read.ts:139,141`,
  `lib/content/index.ts:57`) are per-process and per-build by design.
- `code` — the owner view is a *page*, not a session state, and both variants ship in the
  build (`components/profile/load.ts:34-41`; `routes.md` §Access) — which is the single
  assumption a session breaks.
- `code` — 13 permanent redirects live in `next.config.ts:67-125` and are checked before the
  filesystem.

**Behaviour**

- Serves a registry whose contents change between deploys, which the current
  `generateStaticParams` + `dynamicParams = false` arrangement cannot do for new slugs.
- Invalidates or revalidates the affected pages when a publish, a release, a star, a note or
  a visibility change lands.
- Keeps owner-specific and visitor-specific renderings apart once one URL can serve both.

**Unknowns**

1. Which routes stay static, which become ISR with a revalidate window, and which become
   per-request? Nothing in the code chooses.
2. What is the invalidation trigger — tag-based revalidation on write, time-based, or a full
   rebuild per publish?
3. Does a newly published blueprint appear immediately, or at the next deploy? The current
   answer is "at the next build", and no copy anywhere promises otherwise.
4. How are per-account surfaces cached, given that `/u/{handle}` currently prerenders both
   the owner and visitor variants?
5. Do the download URLs stay static assets under `public/` (cacheable, immutable) or become
   API routes?
6. Is the ontology view still built once per process when it can change under a running
   server? `isA` memoizes per instance and the loader relies on one shared view.

---

## 3 · Where the frontend and `docs/ARCHITECTURE.md` disagree

Reported, not resolved. In each case the code is quoted as it stands.

1. **Seam and entity line anchors have drifted, systematically, by 3-5 lines.**
   `docs/architecture/seams.md` and `concept-model.md` cite e.g. `lib/types.ts:41` for
   `Metric` (actual `:46`), `:167` for `Author` (actual `:172`), `:178` for `Comment`
   (actual `:182`), `lib/data/community.ts:42` for `CommunitySignals` (actual `:46`) and
   `:30` for `ReportedCost` (actual `:34`), `lib/core/analysis/autonomy.ts:317` for
   `isDarkFactory` (actual `:320`), `security.ts:438` for `computeSecurity` (actual `:441`),
   `hash/digest.ts:44`/`:58` (actual `:47`/`:61`), `card/validate.ts:844` for
   `checkVersionChain` (actual `:847`), `lib/data/account.ts:77` for `ACCOUNT` (actual
   `:83`). The cause is visible: the `// Backend contract seams anchored in this file` header
   blocks were inserted at the top of each anchored file *after* the tables were written, and
   every line below shifted by the size of the block. Symbol names in those documents are
   reliable; the line numbers are not.
2. **`docs/ARCHITECTURE.md` §6.2 lists `lib/data/` as six files** — `account.ts`,
   `bundles.ts`, `community.ts`, `node-community.ts`, `profiles.ts`, `users.ts` — while the
   directory holds eight: `cards.ts` (private cards, added 2026-08-13) and `index.ts` (the
   server-only barrel) are missing. The same document's `concept-model.md` §2 *does* document
   `PrivateCard`, so the two halves of the architecture doc disagree with each other as well
   as with the tree.
3. **Component counts in §6.2/§9.2 do not match the tree.** The document says "22 feature
   folders" and "`ui/` … 34 files"; `components/` holds `ui/` plus **20** feature folders,
   and `components/ui/` holds 38 files (32 excluding tests).
4. **The private-card fixture does not satisfy the card grammar the engine enforces.**
   `lib/data/cards.ts` seeds `version: "v0.1.0"`, which `REF_VERSION`
   (`lib/core/card/schema.ts:174`) rejects, so the `ref` that `privateNodeSummaryFor` builds
   (`components/profile/load.ts:137`) is not a parseable card ref; and its `phases` ids
   (`plan`, `build`) are not among the five closed phase ids
   (`planning`, `implementation`, `testing`, `debugging`, `deployment`,
   `lib/core/ontology/core.ts:42-88`) — `plan` is in fact a `data-type` term. Neither the
   glossary nor the concept model records this. It matters here because it is the only
   evidence in the repository about whether private cards are validated at all.
5. **`docs/ARCHITECTURE.md` §11.3 names `docs/audit/CHANGELOG.md` as its source and that file
   exists in no commit** — the document already flags this as a `TBD:`, and it is still true
   at this commit.
6. **`PLATFORM_STATS` (`lib/data/index.ts`) is documented as the homepage counters and is
   read by nothing.** Both `components/hero/Hero.tsx:48` and `Wordmark.tsx:120-122` record
   that they stopped reading it; the export was kept. It is listed here because it is the one
   place a seeded download total would reach the landing page if it were rewired.
7. **Code-internal, not doc-vs-code, but found while checking the above:** `lib/mcp.ts`'s
   header says `components/mcp/clients.ts` "already holds the four client configs the
   `/mcp` page shows"; the array holds six (Claude Code, Codex, Claude Desktop, Cursor,
   VS Code, Gemini CLI). `docs/ARCHITECTURE.md` §1 has the right number.
8. **`docs/architecture/routes.md` describes `/upload` step 4 as `PLANNED (step 4 Publish)`
   while the same table calls the route `LIVE (steps 1-3)`** — accurate, but note that the
   wizard's Publish button is not merely unwired: it advances to a success screen that states
   nothing was sent (`UploadFlow.tsx:1000-1018`). A backend replacing it changes the screen,
   not only the handler.

---

## 4 · Coverage check

Every route in the build, and the aspects it depends on. A route listed with only Group I/VI
aspects needs no write plane. Aspects in **bold** are ones the route is the *primary*
evidence for.

| Route | File | Aspects it depends on |
|---|---|---|
| `/` | `app/page.tsx` | A-01, A-02, A-03, A-04, A-31 |
| `/blueprints` | `app/blueprints/page.tsx` | A-01, A-04, **A-23**, A-07, A-17, A-16, A-31 |
| `/blueprints/[slug]` | `app/blueprints/[slug]/page.tsx` | A-01, A-02, A-04, **A-05**, **A-07**, A-09 (fork panel, public-only rule), A-12, A-14 (watchers), **A-16**, A-17, **A-18**, **A-20**, **A-21** (evidence layers), A-27, A-31 |
| `/build` | `app/build/page.tsx` | A-06 (the same engine, run in-tab), A-07, A-05 (the nine files it hands over), A-31; no write plane by design (SEAM-99/101/102 are `n/a`) |
| `/mcp` | `app/mcp/page.tsx` | **A-25**, A-23 (ranking), A-26, A-12 (what a private bundle would need) |
| `/nodes` | `app/nodes/page.tsx` | A-02, A-04, **A-23**, A-03 (type labels), A-31 |
| `/nodes/[...id]` | `app/nodes/[...id]/page.tsx` | **A-02**, A-03, A-04, A-05 (card download + clone line), **A-16**, **A-17**, A-20, A-09 (`ForkAction` on a card), A-27, A-31 |
| `/ontology` | `app/ontology/page.tsx` | **A-03**, **A-24**, A-23 (`q`/`kind`/`origin`), A-31 |
| `/ontology/[...term]` | `app/ontology/[...term]/page.tsx` | **A-03**, **A-24**, A-10 (namespaced ids as path segments), A-27 |
| `/reading-the-radar` | `app/reading-the-radar/page.tsx` | **A-07** (the shipped weights and the three metric sources), A-18, A-21 |
| `/settings` | `app/settings/page.tsx` | **A-11**, **A-13**, A-12 (default visibility), A-14 (profile fields), **A-19**, **A-22**, A-10 (handle rename + reservation), A-01/A-02/A-03 (the three `✓ counted` figures) |
| `/skill` | `app/skill/page.tsx` | **A-26**, A-08 (push a release from the editor), A-23 (grounded design depends on search), A-25 |
| `/spec/topology` | `app/spec/topology/page.tsx` | A-01, A-06 (the validator checks it documents) |
| `/spec/card` | `app/spec/card/page.tsx` | A-02, A-06 |
| `/spec/ontology` | `app/spec/ontology/page.tsx` | A-03, A-06 |
| `/towards-a-dark-factory` | `app/towards-a-dark-factory/page.tsx` | none (hardcoded essay; no archive read) |
| `/u/[username]` | `app/u/[username]/page.tsx` | **A-14**, A-11 (owner-vs-visitor), A-12, A-16, A-17, A-21 (`validated`), A-24 (terms by prefix) |
| `/u/[username]/blueprints` | `app/u/[username]/blueprints/page.tsx` | **A-12** (public/private split, owner counts), A-08, A-09, A-23 (the disabled find box and sort), A-14 |
| `/u/[username]/cards` | `app/u/[username]/cards/page.tsx` | **A-12**, A-02 (private cards, unvalidated today), A-23, A-14 |
| `/u/[username]/saved` | `app/u/[username]/saved/page.tsx` | **A-15**, A-12 (a save's count is private too), A-11 |
| `/u/[username]/terms` | `app/u/[username]/terms/page.tsx` | A-03, **A-10** (ownership is the id prefix), A-24 |
| `/u/[username]/[slug]` | `app/u/[username]/[slug]/page.tsx` | **A-08** (releases, history), **A-09** (lineage, drift, forks), **A-12** (visibility switch), A-01, A-05, A-07, A-16, A-14 (watchers) |
| `/upload` | `app/upload/page.tsx`, `components/upload/**` | **A-06**, **A-07**, **A-08**, A-03 (the core-vs-overlay divergence), A-10 (slug availability), A-11 (a session to publish into), A-12 (public or private at publish), A-05 (`AGENTS.md` author half), A-27, A-28 (upload limits) |
| `/what-a-blueprint-is` | `app/what-a-blueprint-is/page.tsx` | A-01, A-02, A-03 |
| `/_not-found`, `/_global-error` | framework | **A-27**, A-31 |
| `/icon.svg` | `app/icon.svg` | none |

**Non-route surfaces, for completeness**

| Surface | Aspects |
|---|---|
| Site chrome — header, footer, account menu (`components/site/**`) | A-11 (the missing `Sign out` row is the seam), A-14 |
| `FavoriteStar`, mounted on tiles and both detail pages | A-15, A-16 |
| `scripts/generate-bundles.ts` (`prebuild`) | A-05, A-30, A-31 |
| `lib/content/read.ts` (the archive read itself) | A-01, A-03, A-04, A-31 |
| `next.config.ts` — 13 permanent redirects | A-31 |
| `@vercel/analytics` in `app/layout.tsx` | A-29 |
| `skills/darkprint/**` (installs over git, writes a folder) | A-26, A-06 (its output is what `/upload` reads) |
| `public/bundles/**`, `public/cards/**` | A-05, A-17 |

**Aspects no route depends on** — listed so the gap is visible rather than implied:
A-04's `duplicates()` query (SEAM-13, no page renders it), A-19's granting process (no
surface proposes one), A-21's producer side (no UI element exists at all), A-22's delivery
(no inbox surface exists), A-24's promotion candidates (SEAM-18, nothing reads the config),
A-28 and A-29 in full (no surface expresses a limit, a quota or an operator view).

---

## 5 · Sources read

`docs/ARCHITECTURE.md` §0-§12 and its five split sections (`glossary.md`,
`concept-model.md`, `routes.md`, `journeys.md`, `seams.md`); `docs/DECISIONS.md` (89 rows);
all 24 `page.tsx` files under `app/` plus `layout.tsx`; the components that read or would
write (`upload/**`, `bundle/**`, `profile/**`, `blueprint/**`, `gallery/`, `nodes/`,
`ontology/`, `settings/`, `site/`, `mcp/`, `ui/FavoriteStar.tsx`, `ui/useQueryState.ts`);
`lib/types.ts`, `lib/core/**` (barrel, config, diagnostics, card schema and validation,
hashing, versioning, ontology core and resolve, registry, the three analyzers),
`lib/content/**`, `lib/data/**`, `lib/mcp.ts`, `lib/skill.ts`, `lib/href.ts`;
`content/**` (9 bundles, 57 cards, 1 overlay); `scripts/generate-bundles.ts`;
`next.config.ts`; and all 117 `TODO(SEAM-xx)` anchors in the code.
