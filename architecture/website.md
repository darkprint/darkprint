# The website

Next.js 16 App Router, **SSG only** — `generateStaticParams` + `dynamicParams = false`, typed
`PageProps<"/route/[param]">`. 19 route files prerender to **136 pages**. React 19, Tailwind v4,
TypeScript strict.

> `AGENTS.md` is not boilerplate: this is Next.js 16 with real breaking changes. Read
> `node_modules/next/dist/docs/` before touching a route or the config.

---

## Routes

> **This section is a 2026-07-29 snapshot that has drifted, and the drift is named here
> rather than left for a reader to discover.** The authoritative sitemap is
> [`docs/architecture/routes.md`](../docs/architecture/routes.md), which is re-derived
> against the tree and carries the API routes as well. What is wrong below, measured
> 2026-09-04: the header's "SSG only, 19 route files prerender to 136 pages" describes a
> build that no longer exists — the T260/T261 cutovers made every registry-reading page
> render per request, and the tree holds **28** `page.tsx` routes of which **14** prerender.
> Four routes are missing from the tables (`/capabilities`, `/tutorial`, `/new`,
> `/welcome`), `/install` is listed as a route and has been a 308 to `/skill` since the
> split, and `/towards-a-dark-factory/which-tasks` and `/the-climb` are listed as routes and
> were folded into their parent. The per-route page counts (9, 53, 50, 6) were instance
> counts from `generateStaticParams`, which nothing uses any more.
>
> `TBD:` whether this file keeps a route table at all. Two documents describing the same
> sitemap is how one of them goes quietly wrong, which is what happened here; the rows that
> earn their place are the ones saying what a page is FOR, and those are not in
> `routes.md`. Nobody has ruled on it, and this wave corrected only the rows its own change
> made false rather than settling the question.
>
> **Corrected again 2026-09-05, and the question above is a little sharper for it.** The
> `/blueprints/[owner]/[slug]` row named the Attractor compatibility verdict and used `Forks`
> to explain its own grid mechanism; both components were deleted that day (§11.0 Q30). The
> `/install` row printed the skill install command with no note that it fails for every
> reader but the owner (§11.0 Q8). The redirect section said `ScoringModel` "still" owns
> `id="weights"`; it was deleted the same day (§11.0 Q13). **Three rows, three separate
> deletions, none of which this file would have noticed** — no test reads it and
> `scripts/check-docs-drift.mjs` walks `docs/architecture/` only.

### The registry — what the site holds

| route | pages | what it is |
|---|---|---|
| `/blueprints` | 1 | the shelf. Download / compose / upload moved to the landing (lifecycle-scoring pass); this index is the grid and nothing under it |
| `/blueprints/[owner]/[slug]` | 9 | one blueprint: schematic, the `topology.dot` scroll walk at full width, `ForkAction` + download buttons, download panel, tool scopes, community notes. **Two of the sections in that list are gone, on the owner's instruction, and the page keeps a comment at each position saying so** (`blueprintSections`, `app/blueprints/[owner]/[slug]/page.tsx:131-166`): `#use-this-blueprint`, labelled *Exact release*, which held `ForkAction`, the full digest and the download — the download did not leave with it and is the `Code` control on the file list's own header row now — and `#blueprint-source`, the `topology.dot` breakdown, whose figure `/spec/topology` still draws over the same file. So the rail is FIVE rows (`Files`, `Readme`, `Graph and cards`, `History`, `Community notes`) and four for a bundle with no `README.md`. **The whole scoring reading came off on 2026-09-04** on the owner's instruction — the Score card, the ballot, the header autonomy meter, the explainability panel and the evidence layers — so the right column is the ownership controls now, not a reading. **On 2026-09-05 the owner asked `Bundle` and `Releases` off it as well, and that empties it for everyone but the owner**: the aside's only remaining child is the owner-only `VisibilitySwitch`, so a visitor gets no aside content at all and the sticky column above `lg` is empty for them. Two things `Bundle` carried, tracked rather than assumed — the DIGEST survives in the rendered `README.md`'s identity block, and the validation DIAGNOSTICS do not survive on this route at all, since this panel was the only surface here that drew them and eight of the nine shipped bundles carry `analysis/criteria-leak-unanchored`. `/upload` still shows them, for a different reader at a different moment. `History` still lists what changed and when, so the page has not stopped saying a blueprint has versions; what left with `Releases` is the per-release row and the owner's Publish door, and `/upload` is still reachable from the chrome. **The Attractor compatibility verdict came off with them and its component was DELETED on 2026-09-05** (`docs/ARCHITECTURE.md` §11.0 Q30), so this row named it for a day after nothing rendered it; the limit it stated is still stated on `/spec/topology`. The grid mechanism survives and serves what is left: the aside is still `display: contents` below `lg` so its children become items of the body grid, with `lg:row-span-2` + `order-1` doing the placing. **That sentence used to justify itself with "without it Bundle and Forks would land between the graph and Tool scopes on a narrow screen", and `Forks` was deleted from `components/bundle/Aside.tsx` on 2026-09-05 too** — the placement argument outlived its own subject: `Bundle` went on 2026-09-05 too, so the mechanism now places the ownership controls and nothing else |
| `/nodes` | 1 | the card library |
| `/nodes/[...id]` | 53 | one card in full: interfaces, params, `mcp`, `skill`, `cannot`, risk markers, version history, raw YAML |
| `/ontology` | 1 | the vocabulary |
| `/ontology/[...term]` | 50 | one term: meaning, where it sits in the lattice, who uses it |
| `/u/[username]` | 6 | an author's shelf |

### Learn — what it means

| route | what it is |
|---|---|
| `/` | the landing: five beats, ~370 visible words |
| `/what-a-blueprint-is` | what a blueprint is for, the three parts, one worked bundle, and the words that travel with the subject. Stop 00 of the spec sequence and the door onto its three children; `/spec` and `/concepts` 308 here |
| `/spec/topology` | layer 1, the DOT graph |
| `/spec/card` | layer 2, the node card + the scroll-annotated card |
| `/spec/ontology` | layer 3, the vocabulary |
| `/towards-a-dark-factory` | the 1–5 organisational ladder |
| `/towards-a-dark-factory/which-tasks` | which tasks a dark factory can take |
| `/towards-a-dark-factory/the-climb` | the four phases, holdouts, progressive disclosure |

### Do

| route | what it is |
|---|---|
| `/build` | "Design a blueprint": a workspace with one graph as the stage, three simultaneous choices, five tabs, two co-equal exits over 80 pre-resolved combinations |
| `/upload` | "Upload blueprint": validates and scores a bundle **in the tab**, and stops there |
| `/install` | "Install" (a 308 to `/skill` since 2026-08-08): the DarkPrint skill tutorial (`SkillSetup`) above a rule, `npx skills@latest add Brotherhood94/darkprint` — **which does not run for anybody but the owner, because that repository is private, and all six surfaces that print it have said so since 2026-09-05** (§11.0 Q8) — and what the interview writes; under the rule, publishing/accounts/live push and the per-client MCP preview (`InstallTabs`), both badged, no server exists yet |

### Redirects — `next.config.ts`

All permanent (308). `docs/architecture/routes.md` carries the authoritative table, fourteen
rows, and this list is the shape rather than the register:
`/gallery → /blueprints`, `/parts → /nodes`, `/ontologies → /ontology`,
`/which-tasks → /towards-a-dark-factory`,
`/how-to-build-a-dark-factory → /towards-a-dark-factory`,
`/spec → /what-a-blueprint-is`, `/concepts → /what-a-blueprint-is`,
`/install → /skill`, and since 2026-09-04
`/reading-the-radar → /build` with `/spec/scoring` REPOINTED onto `/build` beside it.

**Repointed and not chained.** `/spec/scoring` used to land on `/reading-the-radar`, and
leaving it there would have made it a 308 to a 308, which costs every link written before
§4.2 two hops — the cost `next.config.ts` records twice and the precedent it set at
`/how-to-build-a-dark-factory`.

A redirect cannot carry a fragment, but a browser re-applies the one it started with to a
`Location` that has none. So `/spec#topology|#card|#ontology` still land: the three bands
on `/what-a-blueprint-is` carry those ids with `scroll-mt-24`. **`#weights` no longer lands
anywhere**, and that is the visible cost of the 2026-09-04 removal. This paragraph said the
id "still" existed on an unmounted `ScoringModel`; **the component was deleted on 2026-09-05**
(`docs/ARCHITECTURE.md` §11.0 Q13), so nothing in the repository declares `id="weights"` now
and `/spec/scoring#weights` and `/reading-the-radar#weights` both arrive at the top of
`/build`. The outcome for a reader is identical either way, which is exactly why the change
was easy to miss. `/spec#scoring` never landed either: its compatibility door was on the page
deleted before that one.

---

## The landing

Five beats, almost no prose. Everything technical lives on the page whose subject it is.

| beat | shows | component |
|---|---|---|
| 1 | the animated **DarkPrint** wordmark | `components/hero/Wordmark.tsx` |
| 2 | a graph drawing itself | `SectionBlueprint.tsx` |
| 3 | one node lighting up and opening into its card | `SectionNodeIsCard.tsx` |
| 4 | what you can do with one: download, compose, upload | `SectionLifecycle.tsx` |
| 5 | two doors, with the archive counts | `SectionDoors.tsx` |

Beat 4 is the lifecycle-scoring pass's rewrite of the three-panel section that used to sit
below the `/blueprints` grid (download / **fork** / update). Fork is not one of its three
panels any more — it moved to the blueprint detail page as `ForkAction`, a real
interaction beside the graph it applies to, closer than a landing panel three clicks from
any one blueprint. The three panels here are download (unchanged), **compose** (new —
composing/wiring one graph into another is a property of the DOT format, true today, no
disclaimer needed), and **upload** (links to `/upload`, states plainly that publishing so
others can find it is not built). See `PROJECT.md` §4 for the honesty pattern this
established: describe the real interaction an ask maps to, never the account system it
was phrased in terms of.

The ~370-word figure is `HomePage` rendered through `renderToStaticMarkup`, tags stripped
and entities resolved, minus text a sighted reader never sees: `<style>` (CSS), `<desc>`
(the SVG accessible description), any `sr-only`-classed element, and the always-`display:
none` half of `SectionBlueprint`'s responsive narrow/wide drawing pair (both render at SSR; a
reader only ever sees one, per that file's own comment). A raw count with none of that
excluded reads 451 — the difference is invisible text, not added prose.

There used to be a fifth beat here — the lights going out across the starter graph
(`SectionLightsOut.tsx`), describing a blueprint with no human node. Cut from the landing
at the author's request; doc 2 §1.1's constraint that beat existed to guard (a graph with
a person in it is a first-class blueprint, never a shortfall) still binds every autonomy
reading on the site, just no longer illustrated here.

### Where the old landing went

The landing used to carry doc 2 §2.1's six rungs. They moved to the pages they belong to:

| what | now at |
|---|---|
| the annotated node card | `/spec/card` |
| the five roles + the absent edge | `/spec/topology` |
| the 1–5 ladder | `/towards-a-dark-factory` |
| the analyzer on a real bundle | `/what-a-blueprint-is` (was `/spec`, deleted) |

`app/page.tsx`'s header comment records this, so nobody "restores" the spine.

**Download / fork / update went to `/blueprints`, then came back.** The redesign moved it
there; the lifecycle-scoring pass moved it back to the landing (beat 4, above), rewritten
as download / compose / upload with fork relocated again — to the blueprint detail page,
as `ForkAction`, beside the graph it actually applies to. `/blueprints` carries none of it
now: the shelf, and nothing under it.

---

## The figure language: luminous flow

**Source of truth:** `components/viz/`.

The author rejected the earlier CAD-box register by name while keeping the blueprint grid. So:
a node is a **lit disc with a halo**, an edge is a **curve with a light travelling it**, an
absence is a dashed hairline, and the graticule is untouched.

```
components/viz/
  flow.ts            metrics, tones, the stylesheet, geometry (flowRun, pointAtT)
  FlowGlyphs.tsx     FlowScene, FlowNode, HumanFlowNode, FlowEdge, FlowAbsence, FlowLift
  useLuminousFlow.ts the anime.js entrance
  useReveal.ts       the three-state motion gate
  useScrollProgress.ts
  Sheet.tsx          the blueprint sheet and its tick frame
  tokens.ts          colours, never a hex at a call site
```

### Four rules that are load-bearing

1. **`static` is the finished drawing.** `useReveal` returns `static | armed | shown`. `static`
   is the server, no-JS and `prefers-reduced-motion`, and in that state the markup is already
   complete. Animation is what gets *added*, never what reveals.

2. **Labels are never `display:none`.** They are real text at SSR, revealed by opacity. Hover
   is a reveal, not existence. `FLOW_CSS` hides them **only** inside
   `@media (hover:hover) and (pointer:fine) and (min-width:48rem) and (prefers-reduced-motion:no-preference)`
   — so touch, narrow viewports and reduced motion show every label unconditionally. Every
   node is focusable, so a keyboard reveals what a pointer reveals.

3. **`role="group"`, not `role="img"`.** An `img` role makes the subtree presentational, which
   would silence the focusable nodes inside it.

4. **Never animate an element that carries its own `transform` attribute.** anime.js writes
   `style.transform`, and a CSS transform *replaces* an SVG presentation attribute outright.
   That shipped once: beat 3's card was drawn at the SVG origin, half off-canvas, for everyone
   with motion enabled — and the prerendered HTML was correct, so no SSR test could see it.
   `FlowLift` is the anchor/inner-group pattern that fixes it, and `flow.test.ts` fails if any
   scene animates a transformed element.

### anime.js v4.5

The v3 default export **does not exist** in this package. What is used:
`animate`, `createTimeline`, `createScope` (React cleanup + media queries), `onScroll`,
`stagger`, `svg.createDrawable` (edges drawing), `svg.createMotionPath` (the pulse),
`text.splitText` (the wordmark), `createSeededRandom` (**never `Math.random`** — scenes render
on the server).

### Guards worth knowing about

| test | what it holds |
|---|---|
| `components/viz/flow.test.ts` | the absent edge clears WCAG 1.4.11 3:1; no rectangle nodes anywhere; no animated transformed element |
| `components/home/graph.test.ts` | labels render ≥10 CSS px on the narrowest phone frame |
| `components/home/roles-labels.test.ts` | **renders the figure and compares label boxes** — no overlap, nothing clipped |
| `components/ui/autonomy-surfaces.test.ts` | no alarm colour near the human-presence glyph; `contributions` passed at every call site |
| `components/build/workspace.test.ts` | doc 2 §2.5 copy rules, walked over `components/` trees, `app/**/page.tsx` and two named `lib/` files rather than a fixed count that would go stale; also every one of the 80 combinations resolving, exporting and passing `lintAttractor` |
| `components/build/stage-labels.test.ts` | **renders `/build`'s stage and compares label boxes**, at six widths — no node or edge name half-drawn |
| `components/panes/archive-labels.test.ts` | the same technique over all nine archive schematics — no block stranded in empty canvas |
| `components/site/nav.test.ts` | header and footer agree; every top-level route is in the nav |

`roles-labels.test.ts` **covers the roles figure only.** Generalising it is
`../PROJECT.md` §3.2, and it is the highest-value small task on the list — it caught four
defects the size-only check could not see.

---

## What breaks if you change this

| change | what goes stale |
|---|---|
| **add a route** | `SiteHeader`, `SiteFooter` and `nav.test.ts`, which fails until the route is in the header |
| **rename or remove a route** | add a redirect in `next.config.ts`; internal links; and grep the *comments* — stale route references have survived three passes |
| **move a section between pages** | `app/page.tsx`'s header comment, and any test naming the file |
| **add a figure** | point `roles-labels.test.ts`'s approach at it, or it ships unguarded |
| **touch autonomy rendering** | the ordinal must not reappear: `grep -rniE "autonomy (level\|score\|rank\|rating\|tier\|[0-9])" .next/server/app public/bundles` must return nothing |
