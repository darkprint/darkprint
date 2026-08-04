# Information architecture — proposal

*2026-08-04, on `feat/core-engine-ontology-v0.1`. No code changed. Every number measured
with `npm run measure:prose` against the build at this commit.*

---

## 0. The correction this is built on

The author, 2026-08-04:

> we are not focusing on the concept of a dark factory but blueprints (i.e. graphs of
> automations that can be passed to Claude Code for example and also can be assembled into
> existing code or assembling blueprints together to enrich the functionalities. Such
> blueprints are like patterns to achieve a given goal)

**A blueprint is a reusable pattern for achieving a goal.** A graph of automations you hand
to an agent, drop into existing code, or compose with other blueprints. Nodes are the
parts. The vocabulary is how the parts describe themselves. "Dark factory" is a badge some
blueprints earn.

That is not what the repo says. `PROJECT.md`, `architecture/*.md` and much of the copy were
written when "dark factory" was the headline, and an agent reading `AGENTS.md` →
`PROJECT.md` → `architecture/*.md` reconstructs the older idea and designs to it. **Fixing
those documents is part of this work, not a footnote to it** — otherwise the next pass
re-derives the same site.

### The word "pattern" changes the site's job

If a blueprint is a pattern, the site is a **pattern library**, and pattern libraries have a
known shape: you arrive with a goal, you find the pattern that matches it, you take it. Not
"here is a formalism, learn it". The current site is organised as the formalism — three
spec layers, a ladder, a vocabulary — with the patterns filed behind them.

Concretely: **nothing on the site today says what any blueprint is *for*.** `/blueprints`
lists nine bundles by title and category. A visitor with a goal ("I want code review to run
itself") has no path from that goal to `guarded-merge-bot`. That is the single largest gap
this proposal addresses, and it is an *addition*, not a reorganisation.

---

## 1. Where the words are now

```
site-wide  per page   open    ×  route
    45262       854    854   53  /nodes/[...id]
    13200       264    264   50  /ontology/[...term]
    13095      1455    869    9  /blueprints/[slug]
     3168       528    528    6  /u/[username]
     2648      2648   2648    1  /nodes
     2052      2052   2052    1  /ontology
     1263      1263    830    1  /spec/card
     1252      1252    761    1  /towards-a-dark-factory/which-tasks
     1183      1183    722    1  /towards-a-dark-factory/the-climb
     1050      1050   1050    1  /spec/topology
     1025      1025   1025    1  /towards-a-dark-factory
     1007      1007    823    1  /spec/scoring
      802       802    802    1  /spec/ontology
      736       736    736    1  /spec
      733       733    733    1  /blueprints
      440       440    395    1  /build
      305       305    305    1  /
      296       296    296    1  /upload
       77        77     77    1  /install
   ------
    89594 words across 133 pages
```

Two facts that should drive every decision below:

1. **The registry detail templates are 74,725 of the 89,594 words** (`/nodes/[...id]`,
   `/ontology/[...term]`, `/blueprints/[slug]`, `/u/[username]`) and they are the part
   nobody calls a labyrinth. The labyrinth is the **8,318 words** across `/spec/*` and
   `/towards-a-dark-factory/*` — 9% of the site holding 3 of 8 nav slots, or 5 of 8 if you
   count `Build one` and `Install`.
2. **`/blueprints` is 733 words for the thing the site exists to hand out**, while `/spec`
   and its four children are 4,858. The explanation outweighs the object 6.6:1.

---

## 2. Navigation

Approved: two nouns and one Learn menu.

```
DarkPrint    Blueprints    Nodes                      Learn ▾    [Share yours]

                                                        Learn ▾
                                                        ├── What a blueprint is
                                                        ├── The spec language        /spec
                                                        │     ├── The topology, in DOT
                                                        │     ├── The node card, in YAML
                                                        │     └── The vocabulary
                                                        ├── How a blueprint is graded /spec/scoring
                                                        ├── How to build your own    /build  (see §6c)
                                                        ├── Towards a Dark Factory   (+2 children)
                                                        └── Install
```

Notes on the choices inside that:

- **`/ontology` moves under Learn**, but the 50 term pages keep their URLs and stay linked
  from every card. The index is a reference index; it is not a destination someone arrives
  wanting.
- **`/build` moves into Learn and must not be called "Compose".** Composition happens on the
  user's machine (§6b), so a website step named for it contradicts the model on the one
  page a reader would test it against. `/build` is the **authoring** page: how to make a
  blueprint, and how to hand that to your agent. It is a rebuild, and it is critical — §6c.
- **`[Share yours]`** replaces the current `[Validate]` button. Same route (`/upload`),
  honest about the intent, and it is the supply side of a registry.
- **"What a blueprint is" is a new page** and the only addition to the route list. See §4.
- The header drops from 8 flat items to 3 + a menu.

**Footer** keeps the full flat list — that is what footers are for, and it is where the
deep links (`/spec/topology`, `/u/<author>`, term pages) stay reachable without cluttering
the header.

---

## 3. Route → role

Every route gets one job. Where a route has two, that is the defect.

### The registry — what you take

| route | words | role | change |
|---|---|---|---|
| `/blueprints` | 733 | **The shelf.** Find the pattern that matches your goal. | **Add goal-first framing**: each card leads with what the blueprint is *for*, not its title and category. Add filters: goal/domain, autonomy class, `# dark factory`. This page is under-built for its job. |
| `/blueprints/[slug]` | 1455 / 869 open | **One pattern in full**, and the download. | Keep. Approved in an earlier pass. Lead with what it is for and what you get; the score card is support, not the headline. |
| `/nodes` | 2648 | **The parts bin.** | Keep. Exempt from prose targets — it is a grid of 53 tiles, skimmed. |
| `/nodes/[...id]` | 854 × 53 | **One part in full.** | Biggest single lever on the site (45,262 words, `open` == `total`, nothing folded). Out of scope here; it is a density problem, not an IA one. `content-reorg` owns it. |
| `/u/[username]` | 528 × 6 | An author's shelf. | Keep. No length problem. |

### Learn — what it means

| route | words | role | change |
|---|---|---|---|
| **`/what-a-blueprint-is`** | new | **The one page that teaches the object.** Graph + cards + vocabulary, drawn. | **New — approved by the author, 2026-08-04.** §4. |
| `/spec` | 736 | The formalism's index: three layers. | Keep, demote. It is an index; it should be short and it is. |
| `/spec/topology` | 1050 | Layer 1, DOT. | Keep. |
| `/spec/card` | 1263 / 830 | Layer 2, the card. | Keep. |
| `/spec/ontology` | 802 | Layer 3, vocabulary. | Keep. |
| `/spec/scoring` | 1007 / 823 | How the six axes are read. | Keep, under Learn. |
| `/towards-a-dark-factory` | 1025 | The 1–5 organisational ladder. | Keep, demote. Essay. |
| `/towards-a-dark-factory/which-tasks` | 1252 / 761 | Which tasks suit this. | Keep, demote. **But see §6** — this is the best goal-matching content on the site and it is buried three levels down. |
| `/towards-a-dark-factory/the-climb` | 1183 / 722 | Four phases, holdouts. | Keep, demote. Essay. |
| `/install` | 77 | MCP setup. | Keep. Not built yet, and says so. |

### Do

| route | words | role | change |
|---|---|---|---|
| `/build` | 440 (step 1 of 7) | Today: answer 7 questions, get one of 80 pre-resolved bundles. | **Rebuild.** Becomes *how to author a blueprint* — a breakdown a reader follows and can hand to their agent. Animation-led, no dense text. Under Learn. §6c. |
| `/upload` | 296 (step 1 of N) | Validate and score a bundle in the tab. | Becomes the `[Share yours]` target. |

**19 routes today, 20 proposed.** The only deletions are in §7 and they are sections, not
routes.

---

## 4. The landing, and the page it hands off to

The landing is 305 words in five beats: hero, what a blueprint is, a node is a card,
download/compose/upload, two doors. Its own header comment records the author's rule for
it: *"The landing should have concepts and suggestive illustration not technical ones."*

**That rule is right and the landing already follows it. Do not rebuild the landing.**

What it lacks is a place to hand off to. Beats 2 and 3 each carry one concept in one
sentence and one figure; a reader who wants the next level of detail is currently sent to
`/spec`, which is the formalism, not the concept. That is the labyrinth entrance.

### `/what-a-blueprint-is` — proposed

One page, roughly 400 words, four figures, answering in order:

1. **What it is.** A graph of automations. *(figure: the starter graph, five nodes, drawn —
   reuse `SectionRoles`)*
2. **What each node carries.** A card: what it runs, what it may reach, what must never
   reach it. *(figure: the annotated card — reuse `SectionNodeCard` from `/spec/card`)*
3. **What you do with it.** Hand it to Claude Code or an equivalent agent, which adapts it
   into your codebase and can combine it with another. **That happens on your machine, not
   here** — DarkPrint hands out files and reads them back. Share the result as a new
   blueprint. *(figure: the three panels — reuse `SectionLifecycle` from the landing)*
4. **How you know it is any good.** Six axes, two computed. *(figure: the radar — reuse the
   Score card)*

Every figure already exists. This page is **assembly, not new drawing** — which is why it
is cheap and why it should be built before anything else in this proposal.

Then: landing beat 5 ("two doors") points here and at `/blueprints`. `/spec` becomes what
this page hands *off* to, for people who want the formalism.

---

## 5. Prose that should be a drawing

The author's note: *"it is important to give user the core concepts using also drawings and
animation when needed."* Ranked by words displaced per figure.

| where | words now | proposal |
|---|---|---|
| `/nodes/[...id]` — the enforced/free-text distinction, explained in three sentences on 53 pages | 58 × 53 ≈ **3,100** | One glyph key, drawn once, in the card header. Measured as the three explanatory sentences only; the `⊘ enforced` / `◌ free text` row labels are data and stay. |
| `/towards-a-dark-factory` — the 1–5 ladder | 1025 | The ladder is a figure. It is currently mostly prose. |
| `/spec/topology` — the absent edge, argued three times in prose on one page | ~300 | It is already drawn there. Cut two of the three prose tellings, keep the drawing. |
| `/spec/scoring` — "two computed, four recorded" | ~200 | A two-column figure with the `○ not built` badge in the recorded column, where it already is. |

**A figure I proposed and then withdrew.** The risk-marker arithmetic on `/ontology/<term>`
looked like a 660-word win. Measured, it is on **3 pages, 49 words each — 147 site-wide**.
Not worth a figure. The 660 came from the audit run before the measurement bug in
`scripts/measure-prose.ts` was found, and so did the `card.action` figure in §7; both were
wrong by roughly 4×. Every number in this document was re-measured against the current
build. Treat any figure inherited from that earlier audit as unverified.

**Animation budget stays where it is.** The hero has it, and `SectionNodeCard`'s scroll
choreography has it. Nothing in this proposal asks for more; §3.1 of PROJECT.md already
records that the four-screen-height card stage is a placement cost, not a win.

---

## 6. Four findings that are not IA, and matter more than some of it

**a. Nothing maps a goal to a blueprint, and the target is community-scale.** The author
expects the registry to reach thousands of user-published blueprints. That makes this
**search-first, from the start** — a filter strip over nine cards is a design that has to be
thrown away at a hundred.

What that implies, beyond this pass:

| | today | needed at community scale |
|---|---|---|
| `/blueprints` | a 733-word grid of 9 | query + facets (domain, autonomy, phases covered, risk markers); the grid becomes the empty-query state |
| `/nodes` | a grid of 53 tiles | same. It stops being browsable somewhere around a few hundred |
| `/u/[username]` | 6 author shelves | becomes meaningful — reputation, not decoration |
| — | — | **versioning, deprecation, moderation and trust signals**, none of which exist |

`/towards-a-dark-factory/which-tasks` is the only page that reasons about *which* automation
suits *which* task — 1,252 words at the third level of a demoted essay branch. Its four
checks are the vocabulary a search UI needs. **Recommendation:** lift them onto
`/blueprints` as the facet names, and leave the essay where it is.

**This is the largest thing in this document and it is mostly not IA.** Search, moderation
and versioning are product surface, not navigation. The IA decision that follows from it is
narrow: design `/blueprints` as a result page now, even while it holds nine, so the shape
does not have to change later.

**b. Composition happens off-site, and the site should say so plainly.** Resolved by the
author, 2026-08-04:

> The composition should be done by a given tool like Claude Code on behalf of a user, not
> the website; then a user can share a composition as a new blueprint.

That settles a question this document had open, and it settles it well. The loop is:

```
    download            compose                    share
  darkprint.io  ->  your machine, your agent  ->  darkprint.io
   a pattern        Claude Code adapts and         the result, as a
                    combines them in your          new blueprint
                    codebase
```

Three consequences:

1. **The landing's beat 4 is already this drawing** — `SectionLifecycle` renders
   download / compose / upload. It does not currently say the middle step is off-site. One
   clause fixes it, and that clause is the whole model.
2. **The engine needs no composite-node feature.** A shared composition is just a new
   blueprint: a flat graph of nodes, indistinguishable in format from any other. This is
   why `grep -r 'composite\|compose' lib/core` returning nothing is *correct* rather than a
   gap, and it retires the concern this section used to raise.
3. **The deleted qualifier does not need to come back.** `SectionComponentRecap` said *"the
   format lets one blueprint reference another as a composite node, and nothing on the site
   does that today"*. Under this model nothing should reference anything as a composite
   node, so there is no unbuilt feature to disclose. The ledger entry stays out.

**What does need saying, in the open:** that DarkPrint does not run or compose anything —
it hands out files and reads them. `/upload` and `/towards-a-dark-factory/the-climb` both
carry a version of this already. The new `/what-a-blueprint-is` page must carry it too,
beside beat 3, or the page will read as though the site composes.

**Open, and asked separately:** if an agent does the composing, does the bundle have to
tell it how? Today `README.md` documents `attractor run factory.dot` for a human. Nothing
in a bundle is addressed to the agent doing the adapting.

**c. `/build` is the authoring page, and it is critical.** Settled by the author,
2026-08-04:

> the build objective is to show to a user how to create a blueprint and therefore showing
> a breakdown such that the user can understand and use it but also give such indications
> to its Claude Code (or Gemini or Codex) and build a blueprint of them. This part is
> critical very important and should be supported by core animations and no dense texts.

So `/build` is **not** a picker, and not a competitor to `/blueprints`. It answers *how do I
make one of these?* and it has two audiences at once:

| audience | what they need from the page |
|---|---|
| the reader | a breakdown they can follow: what a blueprint is made of, in what order you decide it, why each part exists |
| **their agent** | the same breakdown as *instructions they can hand to Claude Code, Gemini or Codex* so it authors the blueprint for them |

That second audience is the part nothing on the site serves today, and it is the same
audience §6d's bundle `AGENTS.md` serves. **They should be the same artefact**: what
`/build` teaches a reader to decide is what the agent needs told. If the page ends in a
copyable instruction block the reader pastes into their agent, the two halves are one page.

**Constraints the author set, and they are binding:** core animations, no dense text. The
current `/build` is a 7-step wizard over 80 pre-resolved combinations — a configurator that
ends in a download. That is a different page from the one described above. This is a
**rebuild, not a demotion**, and it is the second-largest piece of work in this document
after `/blueprints`.

Keeping it a distinct route is approved. `/blueprints` still gets its own finder (§6a);
the two do not overlap once `/build` stops handing out bundles and starts teaching.

**d. Bundles get an agent-facing file.** Approved, 2026-08-04. Today a bundle carries
`blueprint.dot`, `factory.dot`, `cards/` and a `README.md` addressed to a human
(`attractor run factory.dot`). Nothing in it is addressed to the agent doing the adapting,
which makes "hand it to Claude Code" aspirational rather than literal.

```
public/bundles/<slug>/
  blueprint.dot
  factory.dot
  cards/
  README.md      human: what this is, how to run it, the digest
  AGENTS.md      NEW, agent-facing:
                   what this pattern does
                   what to look for in the codebase
                   how to wire each node in
                   what must never be connected
```

### Who writes it

The author, 2026-08-04: *"the AGENTS.md should be provided by a user once uploading a
blueprint."* An earlier draft of this section said the opposite — generated, never typed.
Both are half right, and the split is the design.

**What only the author knows.** The cards describe the graph. They cannot describe *what to
look for in your codebase*, *where this pattern fits*, *when not to use it*, or *what went
wrong the first time*. That is pattern knowledge, and it is the entire reason a blueprint is
a pattern rather than a graph. No generator can produce it. **The author must write it.**

**What the author must not write.** The node list, the wiring, the prohibitions and the
digest are all derivable from `blueprint.dot` and `cards/`. Typed by hand they can
contradict the files they sit beside, and nothing would catch it — the failure
`ScoringModel.tsx`'s *"every number here is read, none is typed"* rule exists to prevent.

So `AGENTS.md` has two halves with different provenance:

```
AGENTS.md
┌─ generated, at build time, from blueprint.dot + cards/ ────────┐
│  what this pattern is: N nodes, the wiring                     │
│  what must never be connected  ← every `cannot:` entry         │
│  what each node needs and emits                                │
└────────────────────────────────────────────────────────────────┘
┌─ written by the uploader ──────────────────────────────────────┐
│  what problem this solves                                      │
│  what to look for in the codebase before wiring it in          │
│  when NOT to use this                                          │
└────────────────────────────────────────────────────────────────┘
```

**On friction — the author asked, and my answer is that this shape removes it.** A required
free-text file is a real barrier at community scale, and it is the kind of barrier that
costs you the casual contributor who had a good pattern. But:

- The generated half means **every bundle has an `AGENTS.md` whether or not the uploader
  writes anything.** Nobody is blocked from publishing.
- The written half is **optional, prompted at upload, and shown as a quality signal** on the
  blueprint page. That converts it from a tax into a reason to bother — the same way a good
  README earns stars.
- If it were one hand-written file, it would be both a barrier *and* unverifiable. Splitting
  it makes the mandatory part free and the optional part the only part worth reading.

**The prohibitions lead the file.** `cannot:` is what an agent adapting a pattern is most
likely to get wrong, and it is generated, so it is always there and always true.

**One consequence to accept deliberately:** the written half is prose the site distributes
about a bundle, and the site cannot check it. If an uploader writes *"this runs your CI
automatically"* and it does not, DarkPrint hands that sentence out. There is precedent —
`card.action` is already author-written and already shown — but it is a new honesty surface
and should be recorded as one when it ships.

---

## 7. What gets deleted outright

Only sections, no routes.

| what | words | why |
|---|---|---|
| `/nodes/[...id]` — `card.action` printed verbatim twice per page | 19 × 53 = **1,007** | Duplication within one template. Measured on `/nodes/code-builder`: the action sentence appears exactly twice. |
| `/spec/topology` — two of three prose tellings of the absent edge | ~200 | Drawn on the same page. |
| Footer's "What a dark factory is" link | — | Already gone with `/what-it-isnt`. Would point at the new page instead. |

Everything else moves or stays. **Nothing in `/towards-a-dark-factory` is deleted** — it is
demoted, which is what the author asked for.

---

## 8. "Dark factory" after this

Approved: **a property, defined at the badge.** No dedicated page.

- Gallery: a `# dark factory` filter chip beside the autonomy class.
- Blueprint page: one sentence beside the badge — *"All five phases run with nobody in the
  loop."*
- The essays keep the name and stay under Learn.

**The engine changes to make that sentence true.** Approved 2026-08-04.

```diff
  // lib/core/analysis/autonomy.ts
- const isDarkFactory = autonomousNodes === totalNodes;
+ const isDarkFactory =
+   autonomousNodes === totalNodes &&
+   CORE_PHASE_IDS.every((p) => phasesCovered.has(p));
```

### Measured impact — 2 of 9 blueprints change

Computed against the current archive by resolving each blueprint's cards and unioning their
declared `phases`:

| | now | after | phases | blueprint | missing |
|---|---|---|---|---|---|
| | dark | dark | 5/5 | `adversarial-consensus-line` | |
| | dark | dark | 5/5 | `checkpoint-resume-runner` | |
| | — | — | 3/5 | `frontline-triage` | planning, debugging |
| | dark | dark | 5/5 | `grounded-research-desk` | |
| | — | — | 4/5 | `guarded-merge-bot` | debugging |
| | — | — | 3/5 | `incident-commander` | planning, debugging |
| **change** | dark | — | 4/5 | `nightly-data-janitor` | planning |
| **change** | dark | — | 4/5 | `schema-forge-etl` | planning |
| | dark | dark | 5/5 | `starter-software-factory` | |

**Dark factories go from 6 to 4.** Both losses are corrections rather than regressions: a
nightly data janitor and an ETL forge have no planning phase, and under the author's
definition they were never dark factories. The change fixes two wrong labels.

Nothing else moves — the autonomy *class* is a separate computation and is untouched, so no
score, no radar axis and no gallery ordering changes. Only the badge.

**Watch when implementing:** `phasesCovered` does not exist in `autonomy.ts` today. Phase
coverage is computed from the resolved cards, which the autonomy analyzer may not currently
receive; if it does not, this needs the coverage passed in rather than re-derived, or the
site gets two answers to one question. Check before writing the diff above as though it
were a one-line change.

---

## 9. Order of work

1. **Fix the documents** (`PROJECT.md`, `architecture/website.md`, `architecture/engine.md`)
   so blueprints-as-patterns is what the repo says. Everything else re-derives the old site
   until this is done.
2. **Change `isDarkFactory`** (§8). Small, measured, and two blueprints lose a badge they
   should never have had. Do it before any badge copy is written, so the copy is drafted
   against what the engine actually computes.
3. **Build `/what-a-blueprint-is`** from existing figures (§4). Cheapest, highest leverage.
4. **Restructure the nav** (§2). Small diff: `SiteHeader`, `SiteFooter`, one new menu.
5. **Rebuild `/build` as the authoring page** (§6c) and **generate bundle `AGENTS.md`**
   (§6d) together — they are the same content addressed to the same second audience, and
   building either alone means writing it twice.
6. **Rebuild `/blueprints` as a result page** (§6a). The project. Search-shaped from day
   one even while it holds nine.
7. **Density passes** on `/nodes/[...id]` and `/ontology/[...term]` — 58,462 words, the two
   biggest levers, already tooled by `content-reorg`.

Steps 1–4 are a day or two. Step 5 is a week and is the one the author called critical.
Step 6 is the project, and it drags versioning, moderation and trust in behind it. Step 7 is
mechanical and can happen any time.

---

## 10. What I am least sure of

- **How much search to build now.** Settled that the target is community-scale (§6a), so
  `/blueprints` should be shaped as a result page immediately. Unsettled how much of that
  shape is worth building while the registry holds nine — a facet UI over nine cards can
  read as pretension rather than infrastructure.
- **`/build`'s existence**, not just its placement. Settled that it is not composition
  (§6b); unsettled whether a 7-question wizard over 80 fixed combinations earns a route
  once `/blueprints` can match a goal. §6c.
- **`/nodes` at top level.** Nodes are parts, and pattern libraries rarely front their parts
  bin. It is there because you named it, and because 45,262 words of the site live under
  it — but if `/blueprints` does its job, most people should never need it.

- **Whether `/build` and bundle `AGENTS.md` really are one artefact.** I have asserted it in
  §6c because the audience is identical, but `/build` teaches a general method while
  `AGENTS.md` describes one specific pattern. If they diverge in practice, §6d should be
  generated from cards and `/build` written by hand, and the "same artefact" claim comes
  out.
