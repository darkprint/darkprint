# DECISIONS — the decision ledger

> A decision that is not `OWNER-STATED` carries no authority. No agent may act on a
> `PENDING-OWNER-REVIEW` row, cite it as established, or use it to justify a change.

Built from `docs/audit/CONTEXT_SURFACE.md` and `docs/audit/CLAIMS_RAW.md`, with every
`Verifiable in code` value checked against the working tree at `27de537`, not inferred from
the documents. Conflicts found while building it are in `docs/audit/CONTEXT_CONFLICTS.md`.

## The provenance bar used here, stated so it can be argued with

A row is `OWNER-STATED` when one of three things exists:

1. **A quoting construction.** The source prints the owner's own words — `The author,
   2026-08-04:` followed by a quotation, `The author's note: "…"`, or a quoted instruction
   recorded in a code comment. An agent restating such a decision in its own words is still
   `OWNER-STATED`, because the original is traceable.
2. **A commit that records the change as the owner's request.** `Author-requested batch of
   six changes` (`feaa9bc`), `The author's instruction, 2026-08-11` (`62fee59`).
3. **An approval marker in a `docs/superpowers/` spec** — `Status: approved` in the header,
   or `Approved` against a numbered item. **The owner confirmed on 2026-08-12 that these are
   his approvals** (answer Q1 below), with one caveat recorded verbatim: *"I used the plugin
   superpowers but I used at the very beginning of the project. It could have been diverged
   a little wrt the current state of the project."* So an approval marker establishes that
   the decision was made; it does not establish that it still holds. Four rows moved to
   `OWNER-STATED` on this answer — D-28, D-32, D-35, D-52 — and two of them (D-32, D-35) are
   `CONTRADICTED` by the code, which is exactly the divergence the caveat predicts.

Everything else that *reports* owner approval without reproducing it stays `UNATTRIBUTED`:

- **`the author asked X` with no quotation.** Dozens of code comments and several documents
  use it. It may be entirely accurate; nothing in the repository lets a reader check it.
  Q1's answer raises the credibility of this class without establishing any single instance.
- **`The following interpretation was checked with the author during the review`
  (`sol_feedback.md:35`).** The only witness that the author confirmed the review's
  premises is the agent that wrote the review. Every `Factual (owner-confirmed)` row in
  `CLAIMS_RAW.md` rests on that one sentence, and none of them reproduces an owner word.

## The `files/` documents carry no authority, and 649 code comments cite them

`files/darkprint-design.md`, `files/darkprint-onboarding-positioning.md` and
`files/darkprint-ontology-v0.1.md` — "doc 1", "doc 2", "doc 3" — are named as *the
specifications* by `architecture/README.md:24-26` and `PROJECT.md:316-318`, and are cited by
section from **649 comments across 138 files** under `app/`, `components/`, `lib/`,
`scripts/` and `skills/`.

The owner answered on 2026-08-12 that **an agent wrote them**, that he did not write them
himself (Q2), and that he does not hold them as decisions he adopted (Q3, *"not really"*).
`CONTEXT_SURFACE.md` had read their Italian as a signal he wrote them; that reading is
falsified. Every rule tracing to them is therefore `AGENT-PROPOSED` — twenty rows below,
including D-12, the rule that nothing may be described as working that is not built, which
holds up the site's entire disclosure architecture.

So the chain is: an agent wrote three documents, later agents cited them 649 times as
"the specifications", and `architecture/README.md:24-26` and `PROJECT.md:316-318` told every
subsequent reader that is what they are. That is the mechanism this audit was asked to find,
in its clearest instance.

This does not make those rules wrong. It makes them unowned, and it means the phrase "doc 2
§0.4" in a code comment is not a citation of anything the owner decided.

## The skill exists on purpose; its contents are unread

The owner confirmed he created and shipped `skills/darkprint/` deliberately (Q4), adding
*"But I just left there as a test. I need to make it concrete useful"*, and that he has not
reviewed its contents (Q5). So D-86 is `OWNER-STATED` and D-60, D-61, D-62 and D-64 —
everything the skill instructs — are `AGENT-PROPOSED` and unread.

---

## 1 · What the product is

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-01 | DarkPrint is a registry of blueprints — graphs of automations you hand to an agent, drop into existing code, or compose with other blueprints — and blueprints, not the dark factory, are the headline. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:12-15` (owner quoted); `PROJECT.md:38-43`; `README.md:3,6-7`; `IMPLEMENTATION_PLAN.md:11-12,43`; `sol_feedback.md:37` | OWNER-STATED | IMPLEMENTED — `app/layout.tsx:38-46`; `components/site/SiteHeader.tsx:52-56` | CONFIRMED |
| D-02 | "Dark factory" is a computed property of one graph shape, never the site's category, its summit, or a goal. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:19-20`; `PROJECT.md:31-35`; `README.md:29`; `sol_feedback.md:152-154`; `files/darkprint-ontology-v0.1.md:35` | OWNER-STATED (covered by the same 2026-08-04 quotation) | IMPLEMENTED — `lib/core/analysis/autonomy.ts:317`; the essay is Learn stop 06, `components/spec/sequence.ts:415-420` | CONFIRMED |
| D-03 | DarkPrint runs nothing: it hands out files and reads them back, and both composing and running happen on the user's own machine with their own tool. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:269-271` (owner quoted); `PROJECT.md:23-24`; `README.md:9-10,23-24`; `files/darkprint-design.md:29`; `sol_feedback.md:38-39` | OWNER-STATED | IMPLEMENTED — no runner anywhere in `lib/`; `/upload` resolves in the browser tab | CONFIRMED |
| D-04 | A blueprint pins the route a harness takes, so two runs differ only where the blueprint changed; a prompt hands the harness a goal and lets it invent the route. | `docs/superpowers/specs/2026-08-10-landing-reproducibility-beat-design.md:12-17,21-22` (owner quoted); `docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:115-117` | OWNER-STATED | IMPLEMENTED — `components/home/SectionSameRun.tsx`, landing beat 2 | CONFIRMED |
| D-05 | The registry will be reachable from an agent through an MCP server that RAG-searches it for the best-fitting blueprint. | `docs/superpowers/specs/2026-08-06-build-restructure-design.md:16-20` (owner quoted) | OWNER-STATED | NOT-IMPLEMENTED — `lib/mcp.ts:6-9` states there is no server; `app/mcp/page.tsx:163` labels the contract table `Design proposal` | CONFIRMED |
| D-06 | The three primitives are the blueprint (a graph), the node (a versioned card) and the ontology (the vocabulary both are written against), and those three are the whole model. | `PROJECT.md:27-29`; `README.md:14-17`; `files/darkprint-design.md:39`; `architecture/README.md:3-4` | UNATTRIBUTED | IMPLEMENTED — `lib/core/dot`, `lib/core/card`, `lib/core/ontology`; three Browse rows in `components/site/SiteHeader.tsx:52-56` | PENDING-OWNER-REVIEW |
| D-07 | The central product claim is that the useful reusable artefact is the *shape of the work*, not a prompt and not a model. | `PROJECT.md:16-18`; `sol_feedback.md:48-51`; `files/darkprint-onboarding-positioning.md:150` | UNATTRIBUTED (`sol_feedback.md:35`'s confirmation marker is the reviewing agent's own report) | UNVERIFIABLE (a thesis, not a behaviour) | PENDING-OWNER-REVIEW |
| D-08 | DarkPrint promises a reproducible, checkable specification and never a deterministic LLM result. | `sol_feedback.md:71-77`; `IMPLEMENTATION_PLAN.md:13-14`; `sol_feedback.md:420-421` | UNATTRIBUTED (same marker as D-07; the owner's own quotation at D-04 argues reproducibility, not determinism) | IMPLEMENTED — `app/layout.tsx:42` says "statically checks"; the word `deterministic` appears on no user-facing surface (only in code comments) | PENDING-OWNER-REVIEW |
| D-09 | The site's headline claim is "Autonomy you can read as a graph." | commit `feaa9bc` ("Author-requested batch of six changes"); `README.md:4` | OWNER-STATED | CONTRADICTED — retired; `app/layout.tsx:38-46` now leads with "reusable blueprints for agent workflows", and the phrase survives only at `README.md:4` | CONFIRMED (as a decision; superseded in code — see D-10) |
| D-10 | The primary promise is about reusable, inspectable agent workflows, not autonomy. | `sol_feedback.md:179-185`; `IMPLEMENTATION_PLAN.md:11-13` | AGENT-PROPOSED (`sol_feedback.md:182-185` disclaims its own wording as "Possible direction, not final copy") | IMPLEMENTED — `app/layout.tsx:52-54` carries that non-final wording almost verbatim | PENDING-OWNER-REVIEW |
| D-11 | The validated marketing claim is "Specifications go in. Software comes out." | `files/darkprint-onboarding-positioning.md:37` ("già validato nelle note") | AGENT-PROPOSED (Q2/Q3: doc 2, neither owner-written nor owner-adopted; the "già validato" marker has no note behind it) | CONTRADICTED — removed by commit `feaa9bc`, which records the owner replacing it; the string appears nowhere under `app/` or `components/` | PENDING-OWNER-REVIEW |

## 2 · The honesty rules

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-12 | Nothing may be described as working that is not built, and the limitation is stated exactly where the capability is first suggested. | doc 2 §0.4, cited at `docs/superpowers/plans/2026-07-29-content-cli.md:20`, `docs/superpowers/specs/2026-07-29-content-cli-design.md:31-35,82-84`, `docs/superpowers/plans/2026-08-06-build-workspace.md:18`; `PROJECT.md:131-132` | AGENT-PROPOSED (Q2/Q3: doc 2 §0.4). The site's most load-bearing rule originates in a document the owner did not write and does not hold as adopted | IMPLEMENTED — `components/site/honesty.test.ts` (19 pinned claims), `components/ui/ComingSoonBadge.tsx`, `app/settings/page.tsx:33-46` | PENDING-OWNER-REVIEW |
| D-13 | Community figures are seeded, and every one carries a `◐ seeded` marker in glyph *and* word wherever it renders. | `PROJECT.md:132-134`; `README.md:46`; `lib/data/account.ts:11-14` | UNATTRIBUTED | IMPLEMENTED — `lib/data/community.ts`, `lib/data/account.ts`, `components/ui/community-support.test.ts:57`, `components/ui/autonomy-surfaces.test.ts:217-229` | PENDING-OWNER-REVIEW |
| D-14 | A claim tagged `open` in the honesty ledger fails the build if it moves behind a disclosure; cutting for pace is how limit statements disappear. | `PROJECT.md:197-207`; `docs/superpowers/specs/2026-07-31-content-reorg-design.md:60-64` | UNATTRIBUTED | IMPLEMENTED — `components/site/honesty.test.ts`; `components/ui/visible-text.ts:38,48` (`plainText` / `openText`) | PENDING-OWNER-REVIEW |
| D-15 | Amber has exactly two reserved jobs — "not built yet" and "this box leaves the page" — and no third thing may take it. | `docs/superpowers/plans/2026-08-06-build-workspace.md:18,252`; `app/globals.css:74-103` | UNATTRIBUTED | IMPLEMENTED — `app/globals.css:74-103` reserves it and adds `--color-copper-line` rather than reuse it | PENDING-OWNER-REVIEW |
| D-16 | The homepage's beat-2 qualifier "illustrative: DarkPrint does not run your graph" comes off the page, together with the two guards that pinned it. | commit `62fee59` ("The author's instruction, 2026-08-11, given after being shown the two tests that pinned the line"); `components/home/SectionSameRun.tsx:138`; `components/site/honesty.test.ts:405-430` | OWNER-STATED | IMPLEMENTED — the string is gone from all three files | CONFIRMED |
| D-17 | When an ask is phrased in account or hosting terms this site does not have, say so and ship the honest version of the same interaction rather than building the account system or quietly shrinking the ask. | `PROJECT.md:326-338`; `architecture/website.md:83-85` | UNATTRIBUTED | IMPLEMENTED — `components/blueprint/ForkAction.tsx`; `app/settings/page.tsx:33-52` (every control `disabled`, the reason stated above the first panel) | PENDING-OWNER-REVIEW |
| D-18 | Reported values are never called measurements; the interface says *reported*, not *measured*, until DarkPrint can verify the run. | `files/darkprint-design.md:268-274`; `sol_feedback.md:422-423` | UNATTRIBUTED | IMPLEMENTED — `components/blueprint/EvidenceLayers.tsx:10-45` separates computed from reported; `components/site/honesty.test.ts` pins "nothing on this site measures a run" as `open` | PENDING-OWNER-REVIEW |

## 3 · The engine and the file format

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-19 | `lib/core/**` is isomorphic — no `node:*`, no `Buffer`, no `Date.now()`, no `Math.random()` — so the same engine runs in the browser on `/upload`. | `architecture/engine.md:5-7`; `architecture/README.md:51-54`; `PROJECT.md:111`; `README.md:51-52` | UNATTRIBUTED | IMPLEMENTED — 30 modules under `lib/core`; `components/upload/UploadFlow.tsx` runs `loadBundle` client-side | PENDING-OWNER-REVIEW |
| D-20 | A published card is never edited in place: content changed means a new version, the old file archived beside it, content-addressed by a `sha256:` digest. | `files/darkprint-design.md:132,153,159`; `skills/darkprint/references/card-schema.md:129`; `architecture/engine.md:161-163`; `architecture/node-card.md:136-138` | AGENT-PROPOSED (Q2/Q3: doc 1 §4) | IMPLEMENTED — `lib/core/version/bump.ts`, `lib/core/hash/`, `bundle/digest-mismatch` | PENDING-OWNER-REVIEW |
| D-21 | Every threshold and weight lives in one configuration file and nowhere else. | `files/darkprint-design.md:385`; `files/darkprint-ontology-v0.1.md:67`; `architecture/engine.md:169-171`; `README.md:64-65` | AGENT-PROPOSED (Q2/Q3: doc 1 §11) | IMPLEMENTED — `lib/core/config.ts:123` `DARKPRINT_CONFIG`, deep-frozen | PENDING-OWNER-REVIEW |
| D-22 | Isolation is a property of the graph and is checked two independent ways: a card's declared `cannot` (an error that refuses the bundle) and the topological/similarity criteria-leak walk. | `architecture/engine.md:92-129`; `architecture/node-card.md:120-126`; `PROJECT.md:74-80`; `skills/darkprint/references/ontology.md:109-134`; `files/darkprint-onboarding-positioning.md:143,221` | AGENT-PROPOSED (Q2/Q3: doc 2 §3, doc 3 §4.1) | IMPLEMENTED — `lib/core/bundle/resolve.ts` (`bundle/prohibition-violated`), `lib/core/analysis/` criteria-leak | PENDING-OWNER-REVIEW |
| D-23 | A generator's `spec` paraphrasing the criteria producer's is a leak, warned above 0.35 3-gram Jaccard. | `architecture/engine.md:100-102`; `skills/darkprint/references/writing-cards.md:41`; `skills/darkprint/references/ontology.md:122` | UNATTRIBUTED | IMPLEMENTED — `lib/core/config.ts:151-155` `similarityThreshold: 0.35` | PENDING-OWNER-REVIEW |
| D-24 | The five phases are a closed list, never namespaced, and phase coverage is descriptive — nothing scores off it and no surface may draw an empty list as a defect. | `files/darkprint-ontology-v0.1.md:25,35,140`; `architecture/ontology.md:31-33`; `skills/darkprint/references/card-schema.md:186`; `architecture/engine.md:136-137` | AGENT-PROPOSED (Q2/Q3: doc 3 §2) — but see D-25, where the owner did rule on what the five phases mean | IMPLEMENTED — `lib/core/ontology/core.ts`; `card/namespaced-phase` | PENDING-OWNER-REVIEW |
| D-25 | The five phases the card field draws from are "the expected high level phases a dark factory should have, but do not necessarily have to stick to nodes". | `skills/darkprint/references/card-schema.md:180` (quoted in a JSDoc block as "the author's ruling") | OWNER-STATED | IMPLEMENTED — `phases` is optional and repeatable on `NodeCard` | CONFIRMED |
| D-26 | A local ontology term must be namespaced and must declare `broader`, or the analysis ignores it silently, which is the worst outcome available. | `files/darkprint-ontology-v0.1.md:142-143`; `architecture/ontology.md:107-109`; `skills/darkprint/references/ontology.md:219-223` | AGENT-PROPOSED (Q2/Q3: doc 3 §7) | IMPLEMENTED — `card/unknown-term`; `partitionTerms()` in `lib/core/ontology/resolve.ts` | PENDING-OWNER-REVIEW |
| D-27 | The exported `factory.dot` is runnable by Attractor as it stands, and DarkPrint's schema must stay readable by existing Attractor tooling. | `PROJECT.md:85-88`; `files/darkprint-design.md:25`; `architecture/blueprint.md:98-103`; `skills/darkprint/references/dot-and-attractor.md:106` | AGENT-PROPOSED (Q2/Q3: doc 1 §0 constraint 1) | IMPLEMENTED — `lib/core/attractor/emit.ts`; `public/bundles/*/factory.dot` | PENDING-OWNER-REVIEW |
| D-28 | A blueprint is a dark factory only when every node is unattended **and** all five phases are covered. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:432-439` ("Approved 2026-08-04", no attribution) | OWNER-STATED (Q1: a bare `Approved` in a superpowers spec is the owner's approval) | IMPLEMENTED — `lib/core/analysis/autonomy.ts:317` `autonomousNodes === totalNodes && bp.phaseCoverage.missing.length === 0` | CONFIRMED |
| D-29 | The security weights are provisional starting values to be calibrated against real data; four of nine blueprints flooring at 1 is an open item, not a result. | `PROJECT.md:244-251`; `architecture/engine.md:84-86`; `architecture/ontology.md:144-146`; `files/darkprint-ontology-v0.1.md:67` | UNATTRIBUTED | IMPLEMENTED as an unresolved state — `lib/core/config.ts:134-149` still holds the doc 3 starting weights | PENDING-OWNER-REVIEW |
| D-30 | Changing any weight is a PATCH of the ontology version because it re-scores every blueprint that already exists. | `files/darkprint-ontology-v0.1.md:158`; `PROJECT.md:251`; `architecture/README.md:48-50`; `architecture/ontology.md:128-130` | AGENT-PROPOSED (Q2/Q3: doc 3 §8) | UNVERIFIABLE (a release convention; nothing enforces it) | PENDING-OWNER-REVIEW |

## 4 · Autonomy, and how it is shown

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-31 | No autonomy ordinal on any user-facing surface, no badge, no leaderboard, no sorting by autonomy — the class name is what a reader sees. | `PROJECT.md:57-58`; `files/darkprint-ontology-v0.1.md:125`; `architecture/engine.md:55-56,63-64`; commit `feaa9bc` | OWNER-STATED — commit `feaa9bc` records the owner deleting `AutonomyBar` and reverting the documented exception, so "the rule is back to unqualified" | IMPLEMENTED — no `components/ui/AutonomyBar.tsx`; `components/ui/autonomy-surfaces.test.ts`; `components/gallery/GalleryBrowser.tsx:162` filters and never sorts | CONFIRMED |
| D-32 | The segmented autonomy gauge is a deliberate, documented, narrowly scoped exception to D-31. | `docs/superpowers/specs/2026-07-29-visual-polish-design.md:24-48,74-78`; `docs/superpowers/plans/2026-07-29-visual-polish.md:21-23,527-529`; `docs/superpowers/specs/2026-07-29-content-cli-design.md:116-128` | OWNER-STATED (Q1: `Status: approved` at `2026-07-29-visual-polish-design.md:4`), then reversed by the owner at commit `feaa9bc` | CONTRADICTED — `AutonomyBar` was built (commit `6c69200`) and deleted (commit `feaa9bc`), together with the PROJECT.md and engine.md exception notes | CONFIRMED |
| D-33 | A human-gated blueprint is first-class; where a person acts is drawn in violet, never in the alarm colour the site spends on defects, and nothing frames a human node as a shortfall. | `PROJECT.md:59-61`; `files/darkprint-onboarding-positioning.md:52,236`; `sol_feedback.md:151-152` | AGENT-PROPOSED (Q2/Q3: doc 2 §1.1, §5.3) — the sibling rule D-31 is OWNER-STATED; this one is not | IMPLEMENTED — `components/ui/autonomy-surfaces.test.ts:100-127`; `HUMAN_PRESENCE_MARK` | PENDING-OWNER-REVIEW |
| D-34 | The 1–5 organisational maturity ladder and the per-blueprint autonomy class are two different scales and must never be confused. | `PROJECT.md:63-68`; `files/darkprint-onboarding-positioning.md:66` | UNATTRIBUTED | IMPLEMENTED — `lib/core/analysis/autonomy.ts` header; `components/home/levels.test.ts` | PENDING-OWNER-REVIEW |

## 5 · Site structure and navigation

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-35 | The header is two nouns plus one Learn menu, dropping from eight flat items to three plus a menu. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:83,116` ("Approved:", no attribution) | OWNER-STATED (Q1) — **superseded by D-88** | CONTRADICTED — `components/site/SiteHeader.tsx:52-95` is three Browse rows, a Design menu, a Publish button, Learn and an account menu | CONFIRMED |
| D-36 | `/what-a-blueprint-is` is a new page, the one page that teaches the object, and the only addition to the route list. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:142` ("New — approved by the author, 2026-08-04") | OWNER-STATED | IMPLEMENTED — `app/what-a-blueprint-is/page.tsx`; stop 00 of `components/spec/sequence.ts:220-225` | CONFIRMED |
| D-37 | The documentation group is named Learn, ordered 00–06, with the same rail on every page in it. | `IMPLEMENTATION_PLAN.md:31-32,51-52` | AGENT-PROPOSED | IMPLEMENTED (partly) — `components/spec/sequence.ts` runs 00–06 and `components/learn/LearnShell.tsx` renders one rail, but the rail is on the **left**, not "at the bottom of every page" as `IMPLEMENTATION_PLAN.md:31-32` asks | PENDING-OWNER-REVIEW |
| D-38 | `/spec` is deleted, its three layer pages kept, and `/spec/scoring` merged into `/reading-the-radar`. | `PROJECT.md:268-278`; `components/spec/sequence.ts:13-28`; `next.config.ts` | UNATTRIBUTED — "The author asked the grading door off the spec index and asked `/spec` itself deleted" (`PROJECT.md:268-270`) is reported, never quoted | IMPLEMENTED — no `app/spec/page.tsx`; `next.config.ts` 308s `/spec` and `/spec/scoring` | PENDING-OWNER-REVIEW |
| D-39 | `/spec/ontology` is the canonical ontology index and `/ontology` is a compatibility URL. | `IMPLEMENTATION_PLAN.md:33-35,53` | AGENT-PROPOSED | CONTRADICTED — `app/ontology/page.tsx` exists, `next.config.ts` carries no `/ontology` redirect, and `components/ontology/canonical-route.test.ts:34-49` asserts the reversal by name | PENDING-OWNER-REVIEW |
| D-40 | One word for the concept everywhere: `/ontology` is "Ontology" (the browser), `/spec/ontology` is "Ontology file (YAML)" (the format). | `components/site/SiteHeader.tsx:37-39` (owner quoted, 2026-08-12: "adopt the term Ontology also for /ontology page … be consistent through all the website") | OWNER-STATED | IMPLEMENTED — `components/site/SiteHeader.tsx:56,84`; `components/build/WorkspaceStage.test.ts:40` | CONFIRMED |
| D-41 | `/install` splits into two routes, one for the skill and one for MCP. | `next.config.ts` (owner quoted, 2026-08-07: "I prefer two pages, one for the skill and one for the mcp.") | OWNER-STATED | IMPLEMENTED — `app/skill/page.tsx`, `app/mcp/page.tsx`, `/install` 308s to `/skill` | CONFIRMED |
| D-42 | `/towards-a-dark-factory` is demoted, not deleted; nothing inside it is removed. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:418-419`; `sol_feedback.md:659-660` | UNATTRIBUTED ("which is what the author asked for", reported, not quoted) — **moot, superseded by D-89** | CONTRADICTED — the route survives as Learn stop 06, but both children were deleted: `next.config.ts` 308s `/towards-a-dark-factory/the-climb` and `/which-tasks` onto the parent, and the comment there records the-climb as deleted by the author | PENDING-OWNER-REVIEW |
| D-43 | The header's action button stays `[Validate]` until publishing exists, because a `+ Share` label on every page would be the one promise the site cannot keep. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:109-114`, under the `Approved:` at `:83` | OWNER-STATED (Q1) — **superseded by D-88** | CONTRADICTED — `components/site/SiteHeader.tsx:74` reads `label: "Publish"`; the page it opens still says publishing has no backend (`components/upload/UploadFlow.tsx:1185`) | CONFIRMED |
| D-44 | `/blueprints` is designed as a search-first result page from day one, even while it holds nine, because the target is community-scale. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:242-245,262-264` (the owner's expectation of "thousands" is reported at `:242-244`, not quoted) | UNATTRIBUTED | IMPLEMENTED — `components/gallery/GalleryBrowser.tsx` (search + tag/category/phase/autonomy/fork facets, URL-backed) | PENDING-OWNER-REVIEW |
| D-45 | Account surfaces exist as presentation only: `/settings` and five profile tabs render seeded fixtures, and every control that would need a backend is drawn switched off and says so. | commit `b22ee53`; `app/settings/page.tsx:23-52`; `lib/data/account.ts:1-27` | UNATTRIBUTED — the commit describes the work; nothing records who asked for it | IMPLEMENTED — `app/settings/page.tsx`, `app/u/[username]/{blueprints,cards,saved,terms,[slug]}`, `components/profile/tabs.ts:41-47` | PENDING-OWNER-REVIEW |
| D-46 | The authoring skill route is named "Assisted Design", and `/build` is deliberately not a row in the Design menu. | `components/site/SiteHeader.tsx:60-76` ("on the author's instruction", "the omission is the author's call" — reported, not quoted) | UNATTRIBUTED | IMPLEMENTED — `components/site/SiteHeader.tsx:65,74-76` | PENDING-OWNER-REVIEW |
| D-89 | `/towards-a-dark-factory` as it stands is the current shape: one page, with `/which-tasks` folded in and `/the-climb` gone. | Owner, 2026-08-12 (answer: "I'm not interested in the children. it is fine the current page") | OWNER-STATED | IMPLEMENTED — `app/towards-a-dark-factory/page.tsx`; `next.config.ts` 308s both former children onto it | CONFIRMED |
| D-85 | MCP is a top-level navigation destination, placed by its intended importance at release rather than by whether the server exists; it is described separately from the authoring skill. | `IMPLEMENTATION_PLAN.md:48-49`; `sol_feedback.md:369-373` | AGENT-PROPOSED | IMPLEMENTED — `components/site/SiteHeader.tsx:64`, with `BUILD_BLURB` distinguishing it from `/skill` | PENDING-OWNER-REVIEW |
| D-88 | The header as it stands is the current shape — three Browse rows, a Design menu, a `Publish` button, Learn and the account menu — and it supersedes both the 2026-08-04 "two nouns and one Learn menu" approval and the `[Validate]` rule. | Owner, 2026-08-12 (answer: "keep the current", asked against D-35 and D-43) | OWNER-STATED | IMPLEMENTED — `components/site/SiteHeader.tsx:52-95` | CONFIRMED |

## 6 · `/build` and the authoring path

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-47 | The build objective is to show a user how to create a blueprint, as a breakdown they can follow *and* hand to their own Claude Code, Gemini or Codex — supported by core animations and no dense text. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:308-311` and `docs/superpowers/specs/2026-08-06-build-restructure-design.md:30-32` (owner quoted, twice) | OWNER-STATED | IMPLEMENTED, but not at `/build` — the creation entry is `app/skill/page.tsx` ("Assisted Design") and the agent-facing half is the bundle `AGENTS.md`; `/build` is an optional worked example (`components/spec/sequence.ts:368-378`) | CONFIRMED |
| D-48 | The deliverable of `/build` is a folder an agent can act on, not a blueprint the reader has studied. | `docs/superpowers/specs/2026-08-06-build-restructure-design.md:22-23,34-35` | AGENT-PROPOSED (the spec's reading of the D-47 quotation) | IMPLEMENTED — `lib/content/bundle-export.ts:68` writes `AGENTS.md` into every download | PENDING-OWNER-REVIEW |
| D-49 | `/build`'s eight-step guided path is replaced by one workspace — one graph as the stage, three simultaneous controls, five tabs, two co-equal exits — without changing a byte of the bundle any set of choices produces. | `docs/superpowers/specs/2026-08-06-build-restructure-design.md:142-176,193-235`; `docs/superpowers/plans/2026-08-06-build-workspace.md:5,13-14` | AGENT-PROPOSED | IMPLEMENTED — `components/build/BuildWorkspace.tsx`, `WorkspaceStage.tsx`, `ALL_COMBINATIONS` at `components/build/choices.ts:150`; no `GuidedPath.tsx`, `steps.tsx` or `path-state.ts` | PENDING-OWNER-REVIEW |
| D-50 | Every one of the 80 pre-resolved combinations must resolve through the real engine, and one error-severity diagnostic fails the build. | `docs/superpowers/specs/2026-08-06-build-restructure-design.md:221-223`; `docs/superpowers/plans/2026-08-06-build-workspace.md:14`; `files/darkprint-onboarding-positioning.md:225` | UNATTRIBUTED | IMPLEMENTED — `app/build/page.tsx` walks `ALL_COMBINATIONS` through `loadBundle` at build time | PENDING-OWNER-REVIEW |
| D-51 | `/build` is renamed to what it is — an optional worked example, "Customize the starter" — rather than being the general blueprint designer. | `sol_feedback.md:232-233` (offered as the *lower-cost alternative* to `sol_feedback.md:229-231`'s preferred option); `IMPLEMENTATION_PLAN.md:21-22` | AGENT-PROPOSED | IMPLEMENTED — `components/spec/sequence.ts:368-378` | PENDING-OWNER-REVIEW |
| D-52 | Every bundle carries an agent-facing `AGENTS.md` whose generated half always exists, so nobody is blocked from publishing. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:335-337` ("Approved, 2026-08-04"), `:389-391` | OWNER-STATED (Q1) | IMPLEMENTED — `lib/content/bundle-export.ts:68,430` | CONFIRMED |
| D-53 | The author-written half of a bundle's `AGENTS.md` is optional, prompted at upload, and shown as a quality signal on the blueprint page. | `docs/superpowers/specs/2026-08-04-ia-redesign.md:355-356` (owner quoted: "the AGENTS.md should be provided by a user once uploading a blueprint."), `:391-392` | OWNER-STATED | NOT-IMPLEMENTED — `components/upload/UploadFlow.tsx` has no `AGENTS.md` prompt, and no blueprint surface renders one as a quality signal | CONFIRMED |

## 7 · Evidence, scores and community signals

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-54 | "Static risk exposure" is the public label for the structure-derived risk reading, and it is never represented as a security audit. | `IMPLEMENTATION_PLAN.md:46-47`; `sol_feedback.md:308-310` | AGENT-PROPOSED | IMPLEMENTED — `lib/content/view.ts:202`, `components/ui/ScoreRadar.tsx:45`, `components/spec/ScoringModel.tsx:264`, and eleven other surfaces | PENDING-OWNER-REVIEW |
| D-55 | Stars are the public support metaphor, with a control and count beside every blueprint and node-card title, counts visibly seeded and starring browser-local. | `IMPLEMENTATION_PLAN.md:36-37,54-55`; commit `6e9d0ac` | AGENT-PROPOSED | IMPLEMENTED — `components/ui/FavoriteStar.tsx`, `components/ui/community-support.test.ts` | PENDING-OWNER-REVIEW |
| D-56 | Structural evidence, community assessment and run evidence are three distinct layers with visible provenance, and a missing value is a real product state rather than something to fill. | `IMPLEMENTATION_PLAN.md:26-28`; `sol_feedback.md:282-285,296-306` | AGENT-PROPOSED | IMPLEMENTED — `components/blueprint/EvidenceLayers.tsx:10-45` | PENDING-OWNER-REVIEW |
| D-57 | Popularity sorting stays out until the event semantics behind it are defined. | `IMPLEMENTATION_PLAN.md:61-62,89-91`; `sol_feedback.md:279-281`; `docs/superpowers/specs/2026-08-04-ia-redesign.md:262-264` | AGENT-PROPOSED | IMPLEMENTED — `components/ui/autonomy-surfaces.test.ts:252` ("does not offer popularity sorting until event semantics are defined") | PENDING-OWNER-REVIEW |
| D-58 | Sixteen product policies — publishability, fork identity, blueprint versioning, privacy, trust signals, run normalisation, ontology governance, the MCP retrieval contract, licensing, malicious-bundle boundaries, account roles, event semantics, ranking, moderation, retention, the star service — are deliberately left open, and the UI may not imply any of them. | `IMPLEMENTATION_PLAN.md:61-91`; `sol_feedback.md:762-794` | AGENT-PROPOSED | IMPLEMENTED as a restraint — no surface asserts any of the sixteen; `app/mcp/page.tsx:163` marks the retrieval contract a proposal | PENDING-OWNER-REVIEW |
| D-59 | Cost and time are reported by whoever ran the blueprint, never measured by the platform, and the card shows the number of runs and the dispersion rather than only a mean. | `files/darkprint-design.md:268-274` | AGENT-PROPOSED (Q2/Q3: doc 1 §8) | NOT-IMPLEMENTED — there is no run-count or dispersion surface; `lib/data/community.ts:51` carries a single seeded stand-in for the cost/time axis | PENDING-OWNER-REVIEW |

## 8 · The authoring skill

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-60 | The skill writes files and nothing else: it runs no graph, starts no server, publishes nothing, and cannot score the bundle. | `skills/darkprint/SKILL.md:3,22-27`; `skills/darkprint/references/preflight.md:3` | AGENT-PROPOSED (Q5: the owner has not reviewed the skill's contents) | IMPLEMENTED — the skill ships as documents only; `lib/core` is not on the author's machine | PENDING-OWNER-REVIEW |
| D-61 | The skill does not emit `factory.dot`; DarkPrint's own exporter compiles it, so the emit rules cannot drift in two places. | `skills/darkprint/SKILL.md:23`; `skills/darkprint/references/dot-and-attractor.md:5,106` | AGENT-PROPOSED (Q5) | IMPLEMENTED — `lib/core/attractor/emit.ts` is the only emitter | PENDING-OWNER-REVIEW |
| D-62 | The skill interviews rather than fills in a form: one question at a time, a recommended answer with every question, facts looked up and only decisions asked, and no file written until the author confirms. | `skills/darkprint/SKILL.md:51-69` | AGENT-PROPOSED (Q5) | UNVERIFIABLE (a rule about agent behaviour, not about this codebase) | PENDING-OWNER-REVIEW |
| D-63 | The "skill for learning to use a dark factory" is this tutorial repackaged for Claude, not a separate artefact. | `files/darkprint-onboarding-positioning.md:293` | AGENT-PROPOSED (Q2/Q3: doc 2 §5.8) | CONTRADICTED — `skills/darkprint/SKILL.md` is a blueprint-authoring interview with its own five references and two templates, sharing only the criteria-isolation example with the `/build` tutorial | PENDING-OWNER-REVIEW |
| D-64 | Two reference files are generated from engine source and test-locked; when a reference disagrees with memory, the reference is right. | `skills/darkprint/references/ontology.md:2-5`; `skills/darkprint/references/card-schema.md:2-3`; `skills/darkprint/SKILL.md:44` | AGENT-PROPOSED (Q5) | IMPLEMENTED — `scripts/generate-skill-refs.ts`, `scripts/skill-refs.ts`, `scripts/generate-skill-refs.test.ts` | PENDING-OWNER-REVIEW |
| D-65 | The documented way to get the skill is `npx skills@latest add Brotherhood94/darkprint`, and a third-party skill vendored under `.claude/skills/` is handed to strangers as ours unless it is locked out. | `AGENTS.md:9-13,34-39` | UNATTRIBUTED | IMPLEMENTED — no `.claude/skills/` in the tree, no `skills-lock.json`, and `eslint.config.mjs` carries no `.claude/skills/**` ignore | PENDING-OWNER-REVIEW |
| D-86 | This repository ships one skill of its own, `skills/darkprint/`, created deliberately — but as a test, and it needs to be made concretely useful. | Owner, 2026-08-12 (answer Q4: "yes. But I just left there as a test. I need to make it concrete useful"); `AGENTS.md:9-10` | OWNER-STATED | IMPLEMENTED — `skills/darkprint/` with five references and two templates; the contents are unreviewed (Q5) | CONFIRMED |
| D-87 | Skills that push a line of development the owner has not chosen are disabled rather than followed. | Owner, 2026-08-12 (answer Q13: "yes. I felt that some skills where forcing me to stay on a path of developement that I was not sure"); `.claude/settings.local.json` `skillOverrides`; commits `be76e32`, `3ceff81`, `5b92067` | OWNER-STATED | IMPLEMENTED — ~19 skills disabled locally; both vendored skills and `skills-lock.json` deleted 2026-08-11 | CONFIRMED |

## 9 · Working rules addressed to agents

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-66 | Read `node_modules/next/dist/docs/` before writing any route or config code, because this Next.js has real breaking changes. | `AGENTS.md:4`; `PROJECT.md:311-312`; `architecture/website.md:7-8`; `docs/superpowers/plans/2026-08-06-build-workspace.md:15` | UNATTRIBUTED | UNVERIFIABLE (a working instruction) | PENDING-OWNER-REVIEW |
| D-67 | Never run prettier: this repo has no prettier config and it reflows to 80 columns, producing a spurious diff. | `docs/superpowers/plans/2026-08-06-build-workspace.md:21` | UNATTRIBUTED | IMPLEMENTED — no prettier config or dependency in `package.json` | PENDING-OWNER-REVIEW |
| D-68 | Never delete or loosen an assertion about accessibility, contrast, label overlap or an honesty disclaimer. | `docs/superpowers/plans/2026-08-06-build-workspace.md:22,104,448` | UNATTRIBUTED | IMPLEMENTED as practice — but see D-16, where the owner's own instruction removed one honesty disclaimer and both its guards | PENDING-OWNER-REVIEW |
| D-69 | Verify agent and tool reports before trusting them, and run the gates yourself. | `PROJECT.md:319-322`; `docs/superpowers/specs/2026-07-31-content-reorg-design.md:173-175` | UNATTRIBUTED (`PROJECT.md:140`'s first-person "Ordered by my read of the value" is the closest thing to an owner voice in that file, and whose voice it is cannot be established) | UNVERIFIABLE | PENDING-OWNER-REVIEW |
| D-70 | When you add a guard, falsify it: break the code on purpose, watch the test fail with the right message, restore. | `PROJECT.md:323-325`; `architecture/engine.md:197-199` | UNATTRIBUTED | UNVERIFIABLE | PENDING-OWNER-REVIEW |
| D-71 | Measure prose, not pixels and not raw word count, and rank by site-wide words (per page × instances). | `PROJECT.md:149-157`; `docs/superpowers/specs/2026-07-31-content-reorg-design.md:45-46` | UNATTRIBUTED (the originating complaint, "too much information that can only distract a user", *is* an owner quotation at `2026-07-31-content-reorg-design.md:13`, but the metric is the agent's answer to it) | IMPLEMENTED — `scripts/measure-prose.ts`, `scripts/measure-prose.test.ts`, `npm run measure:prose` | PENDING-OWNER-REVIEW |
| D-72 | Never take a `fullPage` screenshot: Chrome grows the viewport to document height and every `100vh` block balloons into a layout no reader ever sees. | `docs/superpowers/plans/2026-08-06-build-workspace.md:336` | UNATTRIBUTED | UNVERIFIABLE (a tooling instruction) | PENDING-OWNER-REVIEW |
| D-73 | Comments explain *why*, citing the doc section or the defect that forced the decision; a comment restating the code is noise. | `PROJECT.md:313-315` | UNATTRIBUTED | IMPLEMENTED — the convention is followed throughout `app/`, `components/` and `lib/` | PENDING-OWNER-REVIEW |
| D-74 | No em dash as a pause in `components/home`, and no AI-writing patterns ("not X, but Y", rhythmic triplets, empty emphasis) anywhere in the site's text. | `docs/superpowers/plans/2026-08-10-landing-reproducibility-beat.md:17`; `files/darkprint-onboarding-positioning.md:131` | AGENT-PROPOSED (Q2/Q3: doc 2 §2.5) | IMPLEMENTED — the guard is in `components/build/workspace.test.ts`, not in `components/home` as `2026-08-10-landing-reproducibility-beat.md:17` states | PENDING-OWNER-REVIEW |
| D-75 | Cyan is interactive, violet is where a person acts, emerald is a figure read off the engine, signal is a defect, and amber is "not built yet". | `docs/superpowers/plans/2026-08-06-build-workspace.md:18`; `app/globals.css:411` | UNATTRIBUTED | IMPLEMENTED — `app/globals.css:411`, and `app/globals.css:74-103` adds `--color-copper-line` rather than reuse amber | PENDING-OWNER-REVIEW |
| D-76 | The canonical spacing tiers are 8/12/16/20/40/64/80-112, and 48, 56, 32 and 96 are banned. | `docs/superpowers/plans/2026-08-06-build-workspace.md:17` | UNATTRIBUTED | NOT-IMPLEMENTED as a rule — no test, lint rule or Tailwind theme restriction holds it; it survives only as a sentence in one plan | PENDING-OWNER-REVIEW |

## 10 · The backend, if it is ever wanted

| ID | Decision in one sentence | Source path and line | Provenance | Verifiable in code | Status |
|---|---|---|---|---|---|
| D-77 | There is no backend: no accounts, no publishing, no push, no votes, no telemetry, no MCP server. | `PROJECT.md:131-132`; `README.md:47`; `skills/darkprint/SKILL.md:391` | UNATTRIBUTED (a statement of the current build, restated as a constraint) | IMPLEMENTED — and now partly stale: account *surfaces* exist as seeded presentation (D-45), which `PROJECT.md:131-132` and `README.md:47` do not mention | PENDING-OWNER-REVIEW |
| D-78 | The moment any backend feature lands, every seeded marker and every disclaimer has to be revisited in the same change. | `PROJECT.md:293-295`; `app/settings/page.tsx:44-47` | UNATTRIBUTED | IMPLEMENTED as a recorded precondition — `app/settings/page.tsx:44-47` names it | PENDING-OWNER-REVIEW |
| D-79 | Supabase covers auth, database and storage; no separate service for each. | `files/darkprint-design.md:357` | AGENT-PROPOSED (Q2/Q3: doc 1 §9.3 "Decisione" — decided by whoever wrote doc 1, not by the owner) | NOT-IMPLEMENTED — no Supabase dependency in `package.json` | PENDING-OWNER-REVIEW |
| D-80 | Immutable content lives in object storage indexed by hash, not in Git; Git is at most a later export function. | `files/darkprint-design.md:169-187` | AGENT-PROPOSED (Q2/Q3: doc 1 §5.1 "Decisione") | NOT-IMPLEMENTED — content lives in `content/` in this Git repository and is copied to `public/bundles/` at prebuild | PENDING-OWNER-REVIEW |
| D-81 | No GitHub OAuth, no linking of user repositories, no Git as the blueprint archive — a product constraint, not a constraint on the author's own workflow. | `files/darkprint-design.md:31-33` | AGENT-PROPOSED (Q2/Q3: doc 1 §0 constraint 4) | CONTRADICTED — superseded by the owner's answers of 2026-08-13, recorded as `backend.md` B-02: sign-in **is** GitHub OAuth. Implemented and merged at `ec516fa` (`lib/server/auth/**`), tagged `t000-verified`. Repository linking and Git-as-archive are untouched by that reversal and remain out | CONTRADICTED |
| D-82 | Private blueprints are excluded from the MCP semantic-search index and from the usage counts that trigger ontology promotion. | `files/darkprint-onboarding-positioning.md:326-327`; `files/darkprint-ontology-v0.1.md:144` | AGENT-PROPOSED (Q2/Q3: doc 2 §6.4, doc 3 §7) | NOT-IMPLEMENTED — `lib/core/config.ts:161` holds promotion thresholds nothing reads; `architecture/engine.md:182-183` says so | PENDING-OWNER-REVIEW |
| D-83 | Do not build anything actively anti-scraping; put rate limiting on the APIs instead, because "not scrapable" conflicts with SEO, LLM ranking and MCP. | `files/darkprint-onboarding-positioning.md:367-369` | AGENT-PROPOSED (Q2/Q3: doc 2 §7.3) | CONTRADICTED — superseded by the owner's answers of 2026-08-13, recorded as `backend.md` B-17: rate limits apply to reads **and** writes, with API keys for high-volume consumers. Rate-limiting reads is the anti-scraping measure D-83 ruled out; the cost to MCP and LLM discoverability was accepted knowingly. Not yet built (T230) | CONTRADICTED |
| D-84 | An account is asked for on *save*, never on download. | `files/darkprint-onboarding-positioning.md:303` | AGENT-PROPOSED (Q2/Q3: doc 2 §6.1) | NOT-IMPLEMENTED — downloads are open and there is no save; `app/u/[username]/saved/page.tsx` renders a seeded list | PENDING-OWNER-REVIEW |

---

## Counts

After the owner's answers of 2026-08-12 (Q1–Q13, recorded at the foot of
`docs/audit/CONTEXT_CONFLICTS.md`):

| Provenance | before answers | after |
|---|---|---|
| **Decisions total** | 85 | **89** |
| `OWNER-STATED` | 14 | **23** |
| `AGENT-PROPOSED` | 13 | **35** |
| `UNATTRIBUTED` | 58 | **31** |

| Status | before | after |
|---|---|---|
| `CONFIRMED` | 14 | **23** |
| `PENDING-OWNER-REVIEW` | 71 | **66** |

| Verifiable in code | count |
|---|---|
| `IMPLEMENTED` | 64 |
| `CONTRADICTED` | 10 |
| `NOT-IMPLEMENTED` | 8 |
| `UNVERIFIABLE` | 7 |

D-85 to D-89 are numbered out of order because they were added after the ledger was first
numbered; the IDs are stable and each sits in the section it belongs to.

The ten `CONTRADICTED` rows are D-09, D-11, D-32, D-35, D-39, D-42, D-43, D-63, D-81 and
D-83. Six of
them are `CONTRADICTED` because a later owner decision superseded the earlier one, which is
the healthy case: D-32 (`feaa9bc`), D-35 and D-43 (D-88), D-42 (D-89), and D-81 and D-83
(the owner's twenty backend answers of 2026-08-13, recorded as `backend.md` B-02 and B-17).
Both of the last two were `AGENT-PROPOSED` and unowned, so what superseded them is the
first owner statement either question ever received rather than a reversal of one. **No question in
this audit is left open.**

One thing the answers settled by direction rather than by fact, and it is recorded rather
than resolved: whether `/towards-a-dark-factory/the-climb` was deleted at the owner's
instruction is still unknown. Two files say it was and neither quotes him; he answered that
the current page is fine and the children are not of interest. So D-89 endorses the state
going forward, and the historical attribution is closed as not pursued — not as confirmed.

**One consequence of D-88, stated once and not argued.** Keeping `Publish` in the header
means the chrome names a capability the site does not have; the page it opens says so
(`components/upload/UploadFlow.tsx:1185`), and the rule that would have forbidden it, D-12,
is `AGENT-PROPOSED` and unowned, so nothing with authority stands against it.

The largest movement is not in the counts. It is that 22 rows moved from `UNATTRIBUTED` to
`AGENT-PROPOSED` — meaning the audit no longer says *we cannot tell who decided this*, it
says *nobody with authority decided this*.
