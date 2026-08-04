# DarkPrint

**A registry of blueprints: reusable patterns for getting work done by agents.**
*Autonomy you can read as a graph.*

DarkPrint is a concept build for `darkprint.io` — a place where builders share the
**blueprints** they use to put agents to work. This repository is a fully static front-end
plus the engine behind it: a real archive of blueprint bundles under `content/`, parsed,
resolved and scored at build time by `lib/core`. There is no backend — no auth, no uploads,
no voting, no telemetry — and the site says so on every surface where it matters.

## What's a blueprint?

A **pattern for achieving a goal**, written down as a directed graph of automations. Each
node is a versioned card saying what runs there, which model it uses, what it may reach,
and what must never reach it. The graph says how they connect — and, just as importantly,
how they must not.

The loop it is built for:

1. **Download** a blueprint from the registry.
2. **Compose** — hand it to Claude Code, Gemini or Codex, which adapts it into your codebase
   and can combine it with other blueprints. *This happens on your machine. DarkPrint runs
   nothing and holds none of your keys.*
3. **Share** the result back as a new blueprint.

## What's a dark factory?

One badge a blueprint can earn, not the point of the site. A plant so automated it needs no
lights — no operators, only machines running themselves. Applied here: a blueprint whose
five lifecycle phases (planning, implementation, testing, debugging, deployment) are all
present and all unattended. Most useful patterns are not dark factories.

- **Decision autonomy** — no human-approval checkpoints; it makes judgement calls on its own.
- **Closed loop** — agents plan → execute → verify → ship, instead of following a fixed script.
- **Spec over code** — the engineer writes specs and acceptance criteria, not code line by line.

## What's real and what isn't

This is the distinction the whole build is organised around, so it is worth stating up
front rather than in a footnote:

| | |
| --- | --- |
| **Real** | The 8 blueprint bundles and 52 node-card documents under `content/`, parsed and validated by `lib/core`. The 54-term core ontology. The **Autonomy** and **Security** scores, computed from each resolved graph at build time with their full rationale. Every count on the homepage that comes off the archive. The upload wizard's steps 1–3, which run the real validator in your browser. |
| **Seeded** | Downloads, votes, comments, the author table, and the four non-computed metrics (Efficacy, Reliability, Transparency, Cost / time). These live in `lib/data/community.ts` and `lib/data/users.ts` and are labelled as seeded wherever they render. |
| **Not built** | Execution, run telemetry, voting, reputation, publishing, and the ontology promotion workflow. All designed, none wired up; the UI says so in place rather than implying otherwise. |

## The engine — `lib/core`

Dependency-light, isomorphic TypeScript (no React, no Next runtime), so the same code
runs at build time on the server and inside the upload wizard in the browser.

- **DOT parser** — the topology of a blueprint, with node/edge attributes and locations.
- **Card layer** — parses and validates node cards (YAML/JSON), versioned `id@version`,
  content-addressed with a `sha256:` digest that excludes provenance fields.
- **Ontology** — one curated core vocabulary (node types, data types, tools, risk
  markers) with a `broader` subsumption hierarchy, deprecation pointers, and a resolver
  that supports namespaced local extensions.
- **Bundle loader** — joins a DOT to the cards it pins, type-checks every edge against
  the data-type lattice, and reports `Diagnostic`s with severity, code, hint and location.
- **Analysis** — Autonomy (§8.1: the share of nodes that run unattended, bucketed 1–4)
  and Security (§8.2: a clean 4 minus weighted risk-pattern penalties). Every tunable
  number lives in one frozen `DEFAULT_ANALYSIS_CONFIG`, which the marketing copy reads
  from rather than restating.
- **Registry** — the index over every loaded bundle: cards by id and version, who uses
  what, term usage counts.

`lib/content` is the server-only bridge: it reads `content/` off the filesystem, runs
the engine over it, and produces the view models the UI consumes. `lib/content/layout.ts`
is the one client-safe piece (the graph layout), so the wizard can draw a schematic too.

## Surfaces

- **The hero** — a scroll-driven wordmark that morphs `DarkPrint → DarkFactory`
  (over a procedural 3D factory that reveals in the dark), and flips up to `BluePrint`
  (a cyanotype background with an animated technical drawing).
- **Blueprints** (`/blueprints`) — browse blueprints with search, tag/category filters and sorting.
- **Blueprint detail** (`/blueprints/[slug]`) — the interactive pipeline schematic (React
  Flow), the 6-metric scorecard, an **explainability** section that shows how both
  computed scores were reached (every node counted, every point subtracted, each finding
  clickable to highlight the node in the schematic), the bundle's digest and pinned
  cards, DOT source, requirements and community notes.
- **Nodes** (`/nodes`, `/nodes/[...id]`) — the node-card library. The reusable unit is a
  node, not a sub-graph: one card per page with its declared interface, behaviour,
  evaluation metadata, full version history with an inferred changelog, the blueprints
  that pin it, and the raw YAML.
- **Ontology** (`/ontology`, `/ontology/[...term]`) — the vocabulary browser: node types and
  data types as indented trees, risk markers by weight, and a page per term with its
  ancestry, narrower terms, deprecation status and usage across the registry.
- **Upload** (`/upload`) — a 4-step wizard. Steps 1–3 are real: files are read with
  `File.text()` in the tab, assembled into a `Bundle`, and run through `loadBundle` in
  the browser, producing the actual diagnostics, schematic and computed scores. Step 4
  (publish) is a mock and says so.
- **Profiles** (`/u/[username]`) — a builder's blueprints and node cards.

### The 6-metric scorecard

Every blueprint carries the same card, colour-coded by how each number is produced:

| Metric | Source | In this build |
| --- | --- | --- |
| Autonomy (1–4), Security | **Static analysis** of the graph (auto) | Computed |
| Cost / time | **Measured** on a real run | Seeded — no runner |
| Efficacy, Reliability, Transparency | **Community** vote | Seeded — no ballot |

## Stack

- [Next.js 16](https://nextjs.org) (App Router) · React 19 · TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) (CSS-first theme)
- [React Three Fiber](https://r3f.docs.pmnd.rs/) + [drei](https://github.com/pmndrs/drei) — the procedural 3D factory
- [Framer Motion](https://motion.dev) — scroll-driven morph & transitions
- [React Flow](https://reactflow.dev) (`@xyflow/react`) — the pipeline schematics
- [Vitest](https://vitest.dev) — the engine's test suite
- [`yaml`](https://eemeli.org/yaml/) — the only runtime dependency the engine takes

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # production build — every route prerendered
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm test           # vitest, the lib/ suite
npm run lint       # eslint
```

The site is fully static: every dynamic route has `generateStaticParams` and
`dynamicParams = false`, and nothing is fetched at request time.

## Project structure

```
content/                 the archive — 9 blueprint bundles + 57 node-card documents
                         (53 distinct card ids; the rest are older pinned versions)
  blueprints/<slug>/     blueprint.yaml + blueprint.dot
  cards/<id>@<ver>.yaml  the node-card library
app/                     routes: home, blueprints, blueprints/[slug], nodes, nodes/[...id],
                         ontology, ontology/[...term], upload, u/[username]
                         the two id segments are catch-alls: doc 3 §7 ids are namespaced
                         (`lupo/pii-handling`), and a `/` in an id is a path separator
components/
  hero/                  scroll-morph hero, procedural 3D factory, blueprint drawing
  home/                  homepage narrative sections
  gallery/ blueprint/ nodes/ ontology/ upload/ profile/   per-surface UI
  graph/                 React Flow schematic, SVG thumbnail, DOT viewer
  ui/                    design-system primitives (Button, Badge, ScoreRadar,
                         MetricBars, SourcePanel, DiagnosticList, …)
  site/                  header + footer
lib/
  core/                  the engine — DOT, cards, ontology, bundle, analysis, registry
  content/               server-only archive reader + view-model bridge (+ layout)
  data/                  the seeded index: community.ts, users.ts, index.ts
  types.ts               the UI's domain model
  format.ts href.ts      helpers
```

`/gallery`, `/parts` and `/ontologies` are permanent redirects to `/blueprints`,
`/nodes` and `/ontology`: the section is named **Blueprints**, the reusable unit was
renamed from a sub-graph to a node card, and the gallery of vocabularies became one
curated core ontology.

## Note

The product this prototypes is described in `darkprint-io-note.md`; the build order and
the specs behind `lib/core` are in `darkprint-design.md`.
