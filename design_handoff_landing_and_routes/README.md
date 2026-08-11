# Handoff — the landing's first two beats, and three routes

Five changes. They are independent of each other: any one can ship alone, and the build
order at the end is a suggestion rather than a dependency chain.

| # | Change | Route | Mock |
| --- | --- | --- | --- |
| 1 | A brand mark, above the wordmark | `/` (hero) | `DarkPrint Hero.dc.html` (option `1a`) |
| 2 | The reproducibility beat, rewritten around scores | `/` (beat 2) | `DarkPrint Same Run.dc.html` (option `3a`) |
| 3 | Three sections, so the stop has a section list | `/towards-a-dark-factory` | `DarkPrint Route - Towards a Dark Factory.dc.html` |
| 4 | Three numbered steps, ending on the folder | `/skill` | `DarkPrint Route - Create.dc.html` |
| 5 | Re-registered as a design proposal | `/mcp` | `DarkPrint Route - MCP.dc.html` |

## How to read the mocks

Each `.dc.html` opens directly in a browser with no build step. They are **design
references** — intended structure, copy, colour and geometry — not production code to copy.
Recreate them inside the existing app: **Next.js 16 App Router, React 19, TypeScript,
Tailwind CSS v4 (CSS-first theme)**.

Two exceptions, where the mock's markup **is** the deliverable and should be lifted
verbatim: the logo's SVG geometry (§1) and the two figures in the beat (§2). Their
coordinates carry decisions.

Every mock uses hex literals because it has no access to the theme. **In the app, use the
token** — `var(--color-cyan)`, `text-cyan`, etc. `components/viz/flow.test.ts` already
fails a hex literal in a scene and the same reasoning applies everywhere else.

## Rules that bind all five

- **`--color-faint` (#3b4058) is never live ink.** `app/globals.css` annotates it
  "decorative separators only — 1.83:1, never live text, always aria-hidden". Nothing
  meaning-bearing may be drawn in it. Use `--color-dim`, which the same file annotates as
  ≥4.5:1 on these surfaces.
- **Colour carries meaning here** (`globals.css`): cyan is interactive, violet is where a
  person acts, emerald is a figure, amber is `ComingSoonBadge` and `.route-box`. Do not
  spend one on decoration.
- **No zero-offset coloured halos.** `components/ui/Button.tsx` rejects them: a glow "says
  this element is emitting light, which is decoration".
- **Nothing ships `opacity-0` in markup.** `components/home/beats.test.ts` fails a beat that
  does — the server must render the finished thing, and animation may only move what is
  already there (spec §0). Applies to the new mark in §1.
- **Radii** from the four-step ladder: `sm 5 · md 8 · lg 12 · xl 18`.

---

# 1 · A brand mark, above the hero wordmark

DarkPrint has a wordmark and no mark. This adds one: **a folder holding a graph**, which is
the site's own sentence about what a blueprint is (`components/home/lifecycle/Folder.tsx`
already draws a folder opening to show `blueprint.dot`, `cards/*.yaml`, `README.md`,
`AGENTS.md`).

## Where it goes

In `components/hero/Wordmark.tsx`, **above the `.eyebrow`**, centred, at **88px**, inside
the existing centred column. Everything else in that component is untouched: eyebrow,
`h1` (name + rule + claim), the two buttons, the two CLI chips.

Not beside the name. At the hero's 112px type the mark competes with the `D` and pushes the
word off centre; the wordmark is already doing brand duty there, so the mark reads better as
an emblem crowning the stack. (`DarkPrint Hero.dc.html` carries both — `1a` above,
`1b` beside — if you want to see the comparison.)

**`aria-hidden` in the hero.** The `h1` right below it already says "DarkPrint"; a mark with
an accessible name announces the brand twice. It takes `role="img"` and a name only where it
stands alone (favicon, social card).

## Geometry — lift this verbatim

64×64 box. The silhouette is `Folder.tsx`'s own, halved.

```
back + tab   M8 14h13a2 2 0 0 1 2 2v4h31a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V16a2 2 0 0 1 2-2z
             fill --color-blueprint-line at 30%

front flap   M8 26h46a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V28a2 2 0 0 1 2-2z
             fill --color-blueprint-deep, stroke --color-blueprint-line, stroke-width 1.8

perforation  4 dots, r 0.9, x 12, y 34 / 38.5 / 43 / 47.5, blueprint-line at 55%
```

**The back plate and its tab are one path.** They were two, and the overlap painted at
double alpha and showed as a seam. Do not split them again.

### The nodes

Three lit discs at `GraphThumbnail`'s own ratios — halo 1.77× the core, ring 1.27× — so a
node in the logo and a node in a schematic are the same object.

| | centre | core | ring | halo | colour |
| --- | --- | --- | --- | --- | --- |
| trigger | 21, 40 | r3 @90% | r3.8 @50%, sw 0.8 | r5.3 @12% | `--color-cyan-bright` |
| planner | 35, 36 | r3 @90% | r3.8 @50%, sw 0.8 | r5.3 @12% | `--color-cyan` |
| ship | 47, 44 | r3 @90% | r3.8 @50%, sw 0.8 | r5.3 @12% | `--color-emerald` |

### The edges — compute them, never type them

Each edge runs along the line between two centres, trimmed at **both** ends by `ring + gap`
(5 units at full size), `stroke-linecap="round"`, `stroke-width` 1.2, blueprint-line at 70%.
Same rule `GraphThumbnail` applies with `PORT_R = RING_R + FLOW.edge.gap`.

```
edge(a, b, port):  d = b - a ;  u = d / |d| ;  M (a + u·port) L (b - u·port)
```

At full size that yields `M25.81 38.63 L30.19 37.37` and `M39.16 38.77 L42.84 41.23`.
Hand-typed constants are how the first draft shipped a horizontal edge between two nodes at
different heights — it connected nothing.

### The reduction ladder

The mark **sheds nodes rather than shrinking them**. Three 3-unit cores land near 1.5px at
32, under the site's legibility floor, so the third node leaves.

| Size | Discs | Edges | Back plate + tab | Stroke |
| --- | --- | --- | --- | --- |
| 64 | 3 (with halo) | 2 | yes | 1.8 |
| 32 | 2 (solid, r3.6) | 1 | yes | 2.4 |
| 24 | 2 (solid, r4) | 1 | yes | 3 |
| 16 (favicon) | 2 (solid, r5) | 1 | **no** | 4.5 |

At 24 and below the discs are solid: no halo, no ring.

## Implementation

One component, `components/site/Logo.tsx`, taking `size` and `ground` props and switching on
the ladder. Colours as `currentColor` or CSS variables, never hex. Export a static
`app/icon.svg` for the favicon from the 16px rung.

Two grounds: **dark** (blueprint-line folder on `--color-surface`, discs in their kind
colours) and **cyanotype** (one ink — folder and discs in `--color-blueprint-ink`, flap
filled `--color-blueprint`, over `.bp-grid`). The hero uses the dark pole.

In the 64px header row, use the 24px rung beside the 18px type. The mark never replaces the
wordmark.

## The entrance

`Wordmark.tsx` runs a four-beat timeline and the mark should join it rather than sit still
while the name arrives. Suggested: `data-mark="logo"`, faded and scaled in with the `aura`
(which already runs `opacity 0→1, scale 0.62→1` over 1400ms from 0), so the mark resolves
under the letters as they draw.

It must be **visible with no JS**: `useReveal`'s `static` phase covers the server, JS-off
and reduced-motion, and in that phase nothing in the timeline runs.

---

# 2 · The reproducibility beat, rewritten around scores

`components/home/SectionSameRun.tsx` is beat 2 of the landing — the one that argues rather
than shows, and answers "why not just a prompt?". Its claim is right and its figure was not
carrying it: the headline promised a comparison of runs and each panel drew a single graph,
the two sides had different amounts of work in them, and the colour did the arguing.

## The argument now, in order

1. A prompt **does not model the steps**. The harness invents them, so every run is a
   different run and every score it earns is a one-off.
2. A blueprint **fixes the steps**, which makes a rerun the same run.
3. That is what makes a score an instrument: when a harness runs the graph, you can **test a
   step, swap it for another version, or take it out**, and the change in the number belongs
   to the thing you moved.

## Copy — verbatim

**h2** (unchanged, it is the beat's name): `The same run twice`

**lead**: "A prompt does not model the steps. Your harness invents them, so every run is a
different run and every score it earns is a one-off. A blueprint fixes the steps, which makes
a rerun the same run — and that is what turns a score into an instrument you can act on."

**left panel** — label `from a prompt`, rail `the steps are not yours to choose · three
scores, nothing to credit`, caption "Three runs of one goal. Different steps each time, so
the three numbers cannot be compared to each other and none of them can be traced to a
decision."

**right panel** — label `from a blueprint, run by a harness`, rail `one step touched per run
· the harness runs the rest identically`, caption "Four runs of one blueprint. Swap a step
for a new version, or take a step out: the rest is byte-identical, so each move owns its
delta. Iteration 3 dropped `rank` and lost 0.05, which is why it stays in — a negative
result is attributable too."

**closing**: "A harness can only tell you what a change did if everything else held still.
Pinning the steps is what buys that: you can test one step on its own, replace it, or remove
it, and read the score afterwards knowing the difference belongs to the thing you moved."

## The left figure

A 400×210 sheet on `.bp-grid`, one lit `goal` node at (58,40), and **three runs that fan out
to three different endings**, each drawing in turn and staying until the loop clears (7.2s;
`dpRun` draws the stroke, `dpHold` reveals the nodes it passes).

The intermediate nodes are **deliberately unnamed** — that is the point of the panel: the
steps are not modelled, so there is nothing to label. Each run ends on its own node with its
own score: `0.62`, `0.81`, `0.55`.

Glyph geometry from `components/viz/flow.ts`, not eyeballed: core `node.r` 7 at `node.core`
0.94, ring `ringRadius(r)` 11.9 at `ringOpacity` 0.55, halo `schematicHaloRadius(r)` 12.38 at
`halo.schematic.opacity` 0.12, routes at `edge.pulse` 2.1, arrowheads at `edge.arrowOpacity`
0.7 trimmed back by the ring radius. Lit nodes apply `node.litBoost` 2.4 to the halo and
`litRingOpacity` 0.9 to the ring.

## The right figure

Four rows, one per iteration, on the same `.bp-grid` sheet. Each row: an `iter N` label, the
three-step chain `retrieve → rank → draft` as pills, then a score and a delta.

| | retrieve | rank | draft | score | delta |
| --- | --- | --- | --- | --- | --- |
| iter 1 | `@v1` | `@v1` | `@v1` | 0.62 | base |
| iter 2 | **`@v2`** | `@v1` | `@v1` | 0.71 | +0.09 |
| iter 3 | `@v2` | **removed** | `@v1` | 0.66 | −0.05 |
| iter 4 | `@v2` | `@v1` | **`@v2`** | 0.86 | +0.15 |

- The **changed** pill is amber (`--color-amber` border, 8% fill, `--color-amber-bright` ink).
  Everything else is blueprint-line on `VIZ_KNOCKOUT`.
- The **removed** step keeps its slot as a dashed box carrying `ABSENT_GLYPH` `◌` from
  `components/viz/FlowGlyphs.tsx` — the character the tables and the ledger already use for
  an absent row. `VIZ.dash.absent` is `"6 5"`.
- Gains in `--color-emerald`, the loss in `--color-signal`. Iteration 3 is a real finding,
  not an error state: it is why `rank` stays in the graph.
- Pills are 112×39 (`VIZ.node`'s 132:46 aspect) with `box-sizing: border-box` and a 1.4px
  border (`VIZ.stroke.base`). The score is a fixed 44px right-aligned column and the delta a
  fixed 40px one, so the four numbers line up down the page — that vertical read is the
  figure's whole argument.

## ⚠ One decision before this ships

**The scores are illustrative.** DarkPrint does not run anybody's graph, so there is no
per-run performance number anywhere in the product, and `0.62 → 0.86` is a worked example.
The site's honesty rules (`components/site/honesty.test.ts`) do not let that pass silently
in a figure that looks like a readout.

Recommended: a `.label`-tier line under the right panel reading **"illustrative — DarkPrint
does not run your graph"**, and an honesty-ledger row recording that beat 2 draws scores the
product does not produce. Alternative: relabel the columns as an example explicitly ("if your
harness scores runs, then…"). Either is fine; shipping the numbers bare is not.

The existing `docs/superpowers/specs/2026-08-10-landing-reproducibility-beat-design.md`
carries the beat's argument and honesty position — update it in the same commit.

---

# 3 · `/towards-a-dark-factory` — give the stop its section list

## What is already true

The route **is already Learn stop 05**. `components/spec/sequence.ts` lists it in
`LEARN_PRACTICE` with a docblock recording that it left for one pass and the author asked it
back. `LearnShell` is mounted in `app/layout.tsx` and wraps every page, so this route already
gets the `Learn` rail, its own row marked `active`, the `In practice · 2 of 2` meta and the
`SpecPager`. **No move, no new chrome.**

## What is missing

`sections: []`. `LearnShell` maps `page.sections` into `SideRailItem.sections`, and
`SideRail` renders them **indented under the active row only**. An empty array is why this is
the one stop whose rail row goes nowhere.

## The fix

```ts
// components/spec/sequence.ts — LEARN_PRACTICE, the /towards-a-dark-factory entry
sections: [
  { id: "levels",  label: "The ladder" },
  { id: "the-gap", label: "The gap" },
  { id: "sources", label: "Where this framing comes from" },
],
```

Then two ids in `components/home/SectionLevels.tsx`:

- `#levels` **already exists** — `<section id="levels" className="scroll-mt-24 …">`.
- `#the-gap` is new, on the cyan panel carrying "The gap between level 2 and level 4 is
  architectural and organisational" — doc 2 §1's hook, the loudest sentence on the section
  and currently unaddressable.
- `#sources` is new, on the sources block. It is already headed ("Where this framing comes
  from") and has no anchor.

Add `scroll-mt-24` to the two new anchors, matching `#levels`.

## Two things not to do

**There is no `#autonomy` section.** The two-scales panel was deleted on 2026-08-07;
`SectionLevels.tsx` carries the removal note where the markup was, and `levels.test.ts`'s
assertions moved onto this page's deck. Do not restore it.

**Do not touch the four level sheets.** They were rebuilt on 2026-08-08 as "one frame, four
times" and they are correct: same stations, same positions, only the actors change. The mock
reproduces them from source geometry so the section list can be judged against real content.

## Also in scope, one line

`components/site/SiteHeader.tsx`'s `NAV` carries
`{ href: "/towards-a-dark-factory", label: "Towards a Dark Factory", group: "guides" }`.
`guides` is not one of the rendered groups (`browse`, `build`, `action`, `docs`) nor one of
`MOBILE_GROUPS`, so the row draws nothing — the route reaches the header through `LEARN`.
Delete it, so Learn is its only home. `components/site/nav.test.ts` reads this table; check
its label-completeness assertions still pass.

## Optional

The mock also shows a `PageContents` panel in the header (3 sections, `desktopColumns={3}`).
That is **not** required by the ask — the rail's indented list is the deliverable — and
`sequence.ts` notes this page "never had one". Ship it only if you want the sections
addressable above the fold too.

---

# 4 · `/skill` — three numbered steps

Today: the goal box (`CreateEntry`), then `SkillSetup`'s three panels, then "Not built yet".

## The fix

**A numbered spine, install first**, in the register `/mcp` already uses ("1. Configure your
client"). `SkillSetup`'s three `StepHeading` panels become three numbered `h2`s:

1. **Install it** — `SKILL_INSTALL_COMMAND` from `lib/skill.ts`
   (`npx skills@latest add Brotherhood94/darkprint`) with its `CopyButton`, and the sentence
   about nothing being sent anywhere.
2. **Answer its questions** — the interview paragraph and the five `QUESTIONS`, verbatim from
   `components/skill/SkillSetup.tsx`.
3. **See what you end up holding** — the new figure below.

The ordinal lives in the `h2` now, so drop `StepHeading`'s `.label` index — otherwise the
number is said twice.

## The new figure

The brand mark at 192px beside `SkillSetup`'s own `FileListing` rows. File names come from
`lib/content/bundle-export.ts` — `TOPOLOGY_DOT` `blueprint.dot`, `BUNDLE_CARDS_DIR` `cards`,
`BUNDLE_README` `README.md`, `BUNDLE_AGENTS` `AGENTS.md`. **Import the constants; do not
retype the names.** The three descriptions are the ones already in the component.

This is the one place on the site where the logo is also a diagram: the folder in the mark
holds exactly the files the step is listing. Same geometry as §1, no glow.

## ⚠ `CreateEntry` is removed (author's call)

The goal box and its brief-writing textarea leave `/skill` entirely. Consequences to settle
before building:

- `#create-entry-title` disappears. It is a live anchor that `components/spec/sequence.ts`
  used to list under `/build`; grep for remaining references.
- `components/build/CreateEntry.tsx` becomes unmounted, and `briefFor()` loses its only
  caller. Delete both, or leave them for a future route — but do not leave a component
  mounted nowhere without a note saying why.
- Nothing a reader can run is lost: `CreateEntry` duplicated the install command, and that is
  step 1.

## Unchanged

The "Not built yet" section keeps both panels and all their copy —
`components/site/honesty.test.ts` pins strings in both, and reorganising the steps above is
not a reason for either to soften. No `.route-box` on this page; that ruling stands
(`components/ui/OnwardRoutes.tsx` records it).

---

# 5 · `/mcp` — a design proposal, not a setup page

`lib/mcp.ts` says it plainly: there is no MCP server behind the registry and no `darkprint`
package on npm. The page is nevertheless shaped like a setup page — a numbered configure
step, a tab strip, and `McpJourney`, which has a connect button and an example search.

## The fix

Re-register it. Eyebrow becomes **`Design proposal`**, the `ComingSoonBadge` moves up beside
the `h1`, and the lead ends on the truth: "There is no server behind this page, so what
follows is the contract being proposed rather than one you can call."

Three sections, in this order:

1. **Connect a client** — the tab strip and one snippet from `components/mcp/clients.ts`,
   **at the top**, where a reader looks for it, captioned so nobody runs it expecting a
   server. It answers "how would I use this" before the page spends two sections on what
   "this" is.
2. **What the server would expose** — a four-row contract table:

   | operation | takes | returns | status |
   | --- | --- | --- | --- |
   | search | the work in front of the agent, in its own words | blueprints and cards, each with its artifact kind, author and digest | not built |
   | read a card | a card id | the YAML as published: phase, kind, ports, and what must never reach it | not built |
   | inspect provenance | a blueprint slug | who published it, what it was forked from, and every release digest | not built |
   | fetch a release | a slug and an exact digest | the bundle: `blueprint.dot`, `cards/*.yaml`, `README.md`, `AGENTS.md` | not built |

   The operations are the ones the page's own `metadata.description` already claims; the
   returned fields are the ones `McpJourney` already showed. **No invented tool names** — no
   `search_blueprints(...)` signatures, because none has been designed.

   Closing note: the digest is the load-bearing part. Fetching by slug gets whatever the
   registry holds today; fetching by digest gets the bytes the agent was tested against.
3. **Still to decide** — the four open questions from the current footer note, promoted to
   four panels: ranking, excerpt shape, authorization, cards versus releases. The
   authorization panel says the true thing: there are no accounts, so everything is public
   today.

Then one closing band, **What exists today instead**, pointing at the gallery, the cards
index and `/skill` — which does run.

## ⚠ `McpJourney` is removed

It is a simulation of a connection: a connect button that sets local state, a search button
that reveals three real blueprints as if they had been retrieved. On a page that now says
plainly nothing is built, a working-looking transcript is the one element arguing the
opposite. `components/mcp/` loses its only client component.

The three blueprints it displayed are real and one click away in the gallery, so nothing true
is lost — but this is a deletion, and it should be recorded as one.

If it should stay instead: relabel it a **mock transcript**, and make the connect button stop
pretending to connect.

---

# Build order

1. **§1 the logo**, then stop for review. It is one new component and one insertion, and
   everything after it is independent.
2. **§3 `/towards-a-dark-factory`** — smallest change on the list: one array in
   `sequence.ts`, two ids, one deleted nav row.
3. **§5 `/mcp`** and **§4 `/skill`** — both are page rewrites with one deletion each.
4. **§2 the beat** last, because it needs the honesty decision settled first.

## Tests to keep green

- `components/home/beats.test.ts` — renders the beats the way the server does; fails any beat
  shipping `opacity-0`, and holds the Download panel to naming the real bundle files.
- `components/spec/spec-routes.test.ts` — reads `/towards-a-dark-factory`'s position and its
  `title=` prop out of the page source.
- `components/site/nav.test.ts` — one label per route; knows about the `LEARN` and
  `ACCOUNT_MENU` exceptions. Touched by the `guides` deletion.
- `components/site/honesty.test.ts` — pins the "Not built yet" strings on `/skill` and the
  MCP sentence on `/mcp`. Both rewrites must keep saying, in words and not only in a badge,
  what is not built.
- `components/home/levels.test.ts` — holds two claims on the ladder's copy and its sources.
- `components/viz/flow.test.ts` — fails a hex literal in a scene, and fails any `rect` under
  `components/graph/`.
- `components/viz/scene-labels.test.ts` — fails a box edge drawn through a word.
- `components/hero/Wordmark.test.ts` — if the lockup work touches the hero.
- `components/mcp/mcp.test.ts` — pins `MCP_CLIENTS[0]` as Claude Code.

## Tokens used

`--color-void #05060d` · `--color-surface #0a0c16` · `--color-surface-2 #0f121e` ·
`--color-surface-3 #151928` · `--color-line #222739` · `--color-line-bright #333a54` ·
`--color-fg #e9ebf5` · `--color-muted #9aa1ba` · `--color-dim #828aa3` ·
`--color-blueprint #0b2f7a` · `--color-blueprint-deep #061c52` ·
`--color-blueprint-line #74b4ff` · `--color-blueprint-ink #cfe2ff` · `--color-cyan #38bdf8` ·
`--color-cyan-bright #7dd3fc` · `--color-violet #a78bfa` · `--color-emerald #34d399` ·
`--color-amber #ffb020` · `--color-amber-bright #ffcb5c` · `--color-signal #ff5470`

## Files in this bundle

- `README.md` — this document
- `CLAUDE_CODE_PROMPT.md` — the prompt to hand Claude Code
- the five `.dc.html` mocks at the project root

## Still open, not designed

**The landing never shows a real blueprint.** Nine parsed, scored, downloadable bundles, and
a cold visitor meets only illustrations of concepts before being asked to choose a path. A
short strip of real `ContentCard`s before the doors is the strongest argument the site has,
and the one it currently withholds. Raised, not designed.
