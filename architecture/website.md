# The website

Next.js 16 App Router, **SSG only** — `generateStaticParams` + `dynamicParams = false`, typed
`PageProps<"/route/[param]">`. 20 route files prerender to **137 pages**. React 19, Tailwind v4,
TypeScript strict.

> `AGENTS.md` is not boilerplate: this is Next.js 16 with real breaking changes. Read
> `node_modules/next/dist/docs/` before touching a route or the config.

---

## Routes

### The registry — what the site holds

| route | pages | what it is |
|---|---|---|
| `/blueprints` | 1 | the shelf. Download / compose / upload moved to the landing (lifecycle-scoring pass); this index is the grid and nothing under it |
| `/blueprints/[slug]` | 9 | one blueprint: schematic, Score card (radar, right column on wide, right under the schematic on narrow — CSS grid `order`/`row-start`, not duplicated markup), explainability, `ForkAction` + download buttons, download panel |
| `/nodes` | 1 | the card library |
| `/nodes/[...id]` | 53 | one card in full: interfaces, params, `mcp`, `skill`, `cannot`, risk markers, version history, raw YAML |
| `/ontology` | 1 | the vocabulary |
| `/ontology/[...term]` | 50 | one term: meaning, where it sits in the lattice, who uses it |
| `/u/[username]` | 6 | an author's shelf |

### Learn — what it means

| route | what it is |
|---|---|
| `/` | the landing: five beats, ~370 visible words |
| `/spec` | the spec language: three layers, and what the engine checks |
| `/spec/topology` | layer 1, the DOT graph + the five-roles figure |
| `/spec/card` | layer 2, the node card + the scroll-annotated card |
| `/spec/ontology` | layer 3, the vocabulary |
| `/spec/scoring` | not a fourth layer — how all six radar axes are read, weights included, `id="scoring"` kept on `/spec` as the old anchor's landing spot |
| `/towards-a-dark-factory` | the 1–5 organisational ladder |
| `/towards-a-dark-factory/which-tasks` | which tasks a dark factory can take |
| `/towards-a-dark-factory/the-climb` | the four phases, holdouts, progressive disclosure |

### Do

| route | what it is |
|---|---|
| `/build` | a workspace: one graph as the stage, three simultaneous choices, five tabs, two co-equal exits over 80 pre-resolved combinations |
| `/upload` | validates and scores a bundle **in the tab**, and stops there |
| `/install` | previews per-client MCP setup behind tabs (`InstallTabs`); coming soon, no server exists yet |

### Redirects — `next.config.ts`

All permanent (308): `/gallery → /blueprints`, `/parts → /nodes`, `/ontologies → /ontology`,
`/which-tasks → /towards-a-dark-factory/which-tasks`,
`/how-to-build-a-dark-factory → /towards-a-dark-factory/the-climb`.

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
| the analyzer on a real bundle | `/spec` |

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
