# DarkPrint

*Recap written 2026-07-29, at commit `340931e` on `feat/core-engine-ontology-v0.1`.*

For the durable structural reference — how a blueprint, a node and the ontology are
defined — see [`architecture/`](./architecture/README.md). This file is the short version:
what the project is for, where it stands, and what to do next.

---

## 1. The vision

**A registry where people publish, read and share blueprints: reusable patterns for getting
work done by agents.**

The claim the site is built on is that the useful artefact is not a prompt and not a model.
It is the **shape of the work**: which agents exist, what each one is handed, what each one
is kept away from, and where the run stops for a person. That shape is a directed graph.
DarkPrint stores it as text, scores it, and hands it back as a folder.

A blueprint is a **pattern for achieving a goal**. You download one, hand it to Claude Code
or an equivalent agent, and that agent adapts it into your codebase — or combines it with
another. **The composing happens on your machine, never here.** DarkPrint hands out files
and reads them back; it runs nothing. What you end up with, you can publish as a new
blueprint, which is how the registry grows.

**Nodes** are the parts a blueprint is built from, each a versioned card. The **ontology**
is the controlled vocabulary both are written against. Those three — blueprint, node,
vocabulary — are the whole model.

> ### "Dark factory" is a property, not the point
>
> A blueprint whose five lifecycle phases (planning, implementation, testing, debugging,
> deployment) are **all covered and all unattended** is *classed* a dark factory. It is one
> computed badge on one kind of blueprint.
>
> **This document used to say "everything on the site is arranged around that motif", and
> that is no longer true.** The idea evolved during development: blueprints and nodes are
> the spine, and the site exists to get people downloading and sharing them. The older
> framing survived in this file, in `README.md` and in much of the copy, and it was
> actively misleading — an agent reading `AGENTS.md` → `PROJECT.md` → `architecture/` was
> reconstructing the first concept and designing to it. Corrected 2026-08-04 on the
> author's instruction. If you find prose anywhere in this repo that treats the dark
> factory as the headline, it is a leftover; fix it rather than following it.

### The one rule that constrains everything

**Autonomy is descriptive, never a verdict.** (Doc 2 §1.1.)

A dark factory is a *description of a shape*, the way *acyclic* describes a shape. It is not
an award, not a score to maximise, not a rank. A blueprint that holds for a person before it
releases is a first-class blueprint whose author decided where a person belongs, and it is
shelved beside the rest. Most useful patterns are not dark factories and never will be.

Concretely, and enforced by tests that fail the build:

- no badge, no leaderboard, no sorting by autonomy;
- **no autonomy ordinal on any user-facing surface** — the class name is what a reader sees;
- nothing that frames a human node as a shortfall or a step not yet taken;
- where a person acts is drawn in violet, never in the alarm colour the site spends on
  defects.

There are **two different scales** on this site and they must never be confused:

| scale | subject | form |
|---|---|---|
| the 1–5 ladder | an organisation's maturity | a number (the only one that counts in rungs) |
| the autonomy class | one graph's shape | a name: assisted / supervised / conditional / closed-loop |

### What makes the claim more than prose

The engine enforces the argument the site makes. The reference case:

> `code-builder@1.0.0` declares `cannot: [acceptance-criteria]`. That entry names a data
> type in the ontology, so it is a rule rather than a note. Draw `planner -> builder` in the
> DOT and the bundle **fails to resolve** with `bundle/prohibition-violated`, *and*
> independently the security reading falls from 4 to 2 with the builder named as the reason.

Two checks, from two directions — a card's declared contract, and the topology — reaching the
same conclusion. That is the whole argument for typed graphs over prompt collections, and the
site can demonstrate it live at `/what-it-isnt` and behind the switch on `/build`.

### Interoperability

The exported `factory.dot` is **runnable by [Attractor](https://github.com/strongdm/attractor)**
as it stands. Card `spec` text is inlined as `prompt`, `model` is emitted as Attractor's
reserved `llm_model`, and the iteration cap becomes `max_retries`. Attractor silently ignores
unreserved attributes, which is why `card="id@version"` rides along without breaking it.

---

## 2. Where it stands

All gates green from a clean tree:

```
npm run build     136 pages, 9 downloadable bundles
npx tsc --noEmit  clean
npm run lint      clean
npm test          3211 tests, 69 files
```

**`public/bundles` is generated *and* checked in.** A build writes all nine README files
from the current `lib/core/config.ts`, so a commit taken from a tree that was last built
under an edited calibration ships published bundles whose scores no page agrees with. Run
`rm -rf .next public/bundles && npm run build` before committing and check `git status` on
that directory.

| | |
|---|---|
| engine | 30 modules under `lib/core`, isomorphic (no `node:*`, no `Date.now`, no `Math.random`) |
| content | 9 blueprints, 57 card files (53 distinct nodes, 4 with two versions) |
| ontology | v0.1.0, 49 curated terms + namespaced local extensions |
| routes | 19 route files → 136 prerendered pages, SSG only |
| figures | luminous-flow SVG scenes driven by anime.js v4.5 |

### What is built

- **The engine.** DOT lexer and parser, bundle resolution, autonomy / security / phase
  coverage / spec-similarity analysis, content-addressed archive with a pure-TS sha256,
  semver inference, Attractor emit and lint.
- **The registry, read-only.** Browse blueprints and nodes, open any card, read the ontology.
- **Download.** Nine bundles regenerate from source at build time and are served as folders.
- **`/upload`.** Validates and scores a bundle **in the browser tab** and stops there.
- **`/build`.** A seven-step guided path over 80 pre-resolved combinations, ending in a
  download, with a switch that demonstrates the criteria leak live.

### What is NOT built — and the site says so

**There is no backend.** No accounts, no publishing, no push, no votes, no telemetry, no MCP
server. Community figures shown in the registry are **seeded** and every one of them carries a
`◐ seeded` marker in glyph *and* word. Keep it that way: two HIGH findings in this project
were the site quietly presenting seeded numbers as facts.

---

## 3. Next steps

Ordered by my read of the value. **§3.2 is done and §3.4 is answered in a shape its own
entry did not ask for**; both are marked below with what shipped and what it cost. The
rest is not started.

### 3.1 Finish the length pass

The redesign cut the landing from ~4,100 visible words to 216, and `/build` by 37–66% per
step. Four explainer pages did not follow.

**Measure prose, not pixels and not raw word count.** Both cruder metrics give the wrong
answer here, and both were acted on before being checked:

- **Pixel height** ranks `/nodes` worst. It is a grid of 53 tiles — skimmed in seconds. Page
  height measures scrolling, and the complaint was about reading.
- **Raw word count** ranks `/blueprints/<slug>` worst at 3,283–3,790. About half of that is
  the four-pane viewer rendering card YAML and DOT as styled spans, so a `<pre>`-based filter
  misses it and counts source listing as prose. A registry detail page showing its own source
  is doing its job.

Prose only, at `340931e`:

| prose words | page | |
|---|---|---|
| 2,054 | `/spec/card` | grew — the dezoom gained a second placement for phone legibility |
| 2,048 | `/what-it-isnt` | fell only 13.8% while absorbing two landing sections |
| 2,045 | `/towards-a-dark-factory/the-climb` | fell 4.3%; a fourth route was declined as out-of-spec |
| 1,811 | `/towards-a-dark-factory/which-tasks` | |
| ~1,700 | `/blueprints/<slug>` ×9 | the non-listing half: About, Security, Download, Registry stats |

**Done at `2d70354`.** Measured on the rule above:

| page | before | after | |
|---|---|---|---|
| `/towards-a-dark-factory/the-climb` | 2,045 | **1,197** | −41% |
| `/towards-a-dark-factory/which-tasks` | 1,811 | **1,276** | −30% |
| `/what-it-isnt` | 2,048 | **1,599** | −22%, and −42% of what reads without opening a disclosure |
| `/spec/card` | 2,054 | **1,717** | −16%, −38% open |
| `/blueprints/<slug>` ×9, non-listing half | 19,107 | **17,504** | −8%, −19% open |
| `/towards-a-dark-factory` | 694 | 1,029 | **+48%** — it absorbed a block from its children; the three together fell 23% |

`/nodes` (2,396) and `/ontology` (2,060) were left alone on purpose. They are lists.

### What this pass taught, worth keeping

Cutting for pace is how honesty statements disappear, and the danger is not deletion. It is
**promotion to a disclosure**: the words stay in the HTML, every word-count check still passes,
and the reader never sees them. Twelve findings came out of this pass and most were that shape
— *"the absence of a finding here is silence, not a clean verdict"* went from open on eight
blueprint pages to open on none, and the severity word `warning` vanished from all nine while
an amber glyph carried the meaning alone.

So `components/site/honesty.test.ts` now holds a ledger of named claims, each tagged **open**
or **present**, and `components/ui/visible-text.ts` implements the difference by dropping the
body of any `<details>` that lacks an `open` attribute. A claim tagged `open` fails the build
if it moves behind a disclosure. Add to that ledger whenever a page starts stating a limit.

To re-measure, strip `<script>`, `<style>`, `<svg>` and `<pre>` inside `<main>` and count
words — but check by section first, because the pane listings do not sit in `<pre>`.

### 3.2 Apply the label guard to every scene — **done**

`components/home/roles-labels.test.ts` renders a figure, resolves each `<text>` through its
translations, and fails on overlapping or clipped labels. It caught four defects the
size-only check could not see, and it covered the roles figure alone.

Shipped as `components/viz/label-boxes.ts` (a plain module, not a test file) plus
`components/viz/scene-labels.test.ts`, which walks `components/**` and `app/**` for
`<FlowScene` and fails if a file that draws one is not in its roster. **15 drawers, 26
frames.** Four more defects came out of it, all in `components/home/SectionLevels.tsx`,
which was the largest unguarded set of drawings on the site.

Three things about it are worth keeping in mind before touching a figure:

- **The advance constant is `0.62` and lives in one place.** The shipped mono face measures
  0.600 exactly (`next/font`'s Geist Mono fallback is `local(Arial)` at `size-adjust:
  134.59%`, and 0.4458 × 1.3459 = 0.600), so a guard using the measurement has no margin at
  all. The 2026-07-29 swap to JetBrains Mono (`app/layout.tsx`) re-measured this: its
  generated fallback lands on the same `size-adjust: 134.59%`, so the measurement is still
  0.600 and `0.62` needed no change. `graph.test.ts` imports it rather than declaring a
  second one; that divergence is how the shared guard ended up three percent more
  permissive than its sibling.
- **It compares text against text, and text against a stroked `<rect>`.** Curves,
  arrowheads and node rings are not collected. The rect case exists because the first fix
  to level 4 slid the harness box onto the word `task` while every text-only case stayed
  green.
- **It throws rather than guessing.** A transform it cannot compose, a transform on an
  element it does not resolve them for, a `<text>` with no size, a markup string with no
  scene: all four fail the run with the value named.

### 3.3 Calibrate the weights (needs a decision, not code)

`lib/core/config.ts` holds every tunable number, deliberately in one file. Two are visibly
mis-set against real content:

- **four of nine blueprints floor at security 1.** Either the weights are too harsh or the
  scale is too short. Doc 3 §9 left this open for calibration against real data.
- **doc 2 §5.6's slider moves one metric where the doc implies four.**

Changing any of these is a PATCH of the ontology version, because it re-scores every blueprint.

### 3.4 Give the scoring model a home — **done: it is now `/spec/scoring`, its own route**

The previous entry here shipped the content as a section on `/spec` and left the
placement as an open question: that page had become the longest open-prose page on the
site, +86% over its own post-length-pass figure, on a route the redesign split into four
specifically because one long page made readers leave.

That question is resolved. `SectionExample`'s `#scoring` panel ("How a factory is
graded", the qualitative walk through all six radar axes) and `ScoringModel` (the
quantitative weights, bands and thresholds, still read live from `DARKPRINT_CONFIG` and
`getOntologyView()`, never transcribed) both moved onto a new `app/spec/scoring/page.tsx`.
`/spec` itself is back near its original length; the new page carries the weight instead,
on a route whose whole subject is exactly this.

**It is a fifth entry in the spec *sequence*, not a fourth *layer*.**
`components/spec/sequence.ts`'s `SPEC_LAYERS` stays three items (topology, card,
ontology — the site says "three layers" in enough places that a fourth would contradict
itself), and `SPEC_SCORING` is appended to `SPEC_SEQUENCE` as a plain `SpecPage` instead.
`/spec` itself keeps a small, separately-framed "How it's graded" callout — not a fourth
door in the three-layer grid — carrying `id="scoring"` so the anchor every blueprint page
already links (`/spec/scoring` directly now; the id itself is preserved as the bookmark
target for anyone still holding the old `/spec#scoring` fragment) lands one click from the
real content, same precedent as the topology/card/ontology anchors.

The pager's own aria-label was found reading "in four parts" against a five-item rail
after the split — a reviewer caught it, and it's fixed by deriving the count
(`SPEC_SEQUENCE.length`) rather than a second hand-typed copy of it, which is now the
pattern: nothing about this sequence should be stated twice in two places that can drift.

### 3.5 Fase 4 — the backend, if it is ever wanted

Doc 2 §11 items 14–17: registration at save, a public/private toggle, gallery upload, opt-in
telemetry. **This is the point where the honesty rules stop being free.** Today the site can
say "nothing here is measured" and be exactly right. The moment any of this lands, every
seeded marker and every disclaimer has to be revisited in the same change.

### 3.6 Sources still unread

**BlueGrid parts 1–3** sit behind a Cloudflare challenge and were never read. They are not
cited anywhere and must not be. If they matter, open them in a browser and fold them into
`/towards-a-dark-factory/the-climb`.

The HackerNoon article **is** read and is cited correctly: its ladder is numbered 1, 2, 3,
3.5, 4 and names no rungs. The five named rungs on this site are ours, and the source note
says so. That was a false attribution once; do not let it come back.

---

## 4. Working notes for whoever picks this up

- **`AGENTS.md` is not boilerplate.** This is Next.js 16 with real breaking changes. Read
  `node_modules/next/dist/docs/` before touching a route or the config.
- **Comments here explain *why*, citing the doc section or the defect that forced the
  decision.** Match that. A comment restating the code is noise; a comment recording why a
  number is 0.32 is what stops the next person reverting it.
- **The source docs are in `files/`** — `darkprint-design.md` (doc 1),
  `darkprint-onboarding-positioning.md` (doc 2), `darkprint-ontology-v0.1.md` (doc 3).
  Section references throughout the codebase point at these.
- **Verify agent and tool reports before trusting them.** Over this project a build was
  reported green while `lib/core` was red, a test passed against deliberately broken code
  because it anchored on the wrong string, and two "regression tests awaiting a fix" were
  actually stale tests asserting old behaviour. Run the gates yourself.
- **When you add a guard, falsify it.** Break the code on purpose, watch the test fail with
  the right message, restore. Several tests in this repo exist because that step caught a
  check that was silently passing.
- **When an ask describes a feature in account/hosting terms this site doesn't have,
  don't build the account system and don't quietly rewrite the ask into something smaller
  either — say so, then ship the honest version of the same interaction.** The precedent:
  "fork blueprint... into the user account, download it, edit it, upload it back" became
  `components/blueprint/ForkAction.tsx`, a disclosure holding the existing `ForkScene`
  drawing, two sentences saying what forking a text bundle actually means, and a link to
  the `DownloadPanel` that already lists every file — no account, no server-side copy, no
  claim that one exists. Reused an existing honest component rather than inventing a
  second, differently-scoped download button under a name that would have overclaimed.
  Even a disclosure this small needs the same scrutiny as any other new UI: it shipped
  once with its popover positioned to overflow the viewport by 92px on a phone, caught
  only by rendering it and reading `getBoundingClientRect()` — a class name is not
  evidence of where something actually draws.
