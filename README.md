# DarkPrint

**The blueprint registry for autonomous AI factories.** *Autonomy you can read as a graph.*

DarkPrint is a concept build for `darkprint.io` — a place where builders share the
**blueprints** of their AI *dark factories*: autonomous agent pipelines that plan,
execute, verify and ship without a human in the loop. This repository is a polished,
deployable **front-end showcase** driven entirely by mock data (no backend yet) that
demonstrates the whole product.

## What's a dark factory?

A plant so automated it needs no lights — no operators, only machines running
themselves. Applied to AI agents: a closed-loop pipeline where autonomous agents
orchestrate the entire process. What sets it apart from ordinary automation:

- **Decision autonomy** — no human-approval checkpoints; it makes judgement calls on its own.
- **Closed loop** — agents plan → execute → verify → ship, instead of following a fixed script.
- **Spec over code** — the engineer writes specs and acceptance criteria, not code line by line.

## Features

- **The hero** — a scroll-driven wordmark that morphs `DarkPrint → DarkFactory`
  (over a procedural 3D factory that reveals in the dark), and flips up to `BluePrint`
  (a cyanotype background with an animated technical drawing).
- **Gallery** — browse blueprints with search, tag/category filters and sorting.
- **Blueprint detail** — the interactive pipeline schematic (React Flow), the 6-metric
  scorecard (radar + source-coded bars), DOT source, requirements and community notes.
- **Parts & Ontologies** — reusable sub-graphs (npm-like) and typed graph vocabularies.
- **Upload** — a 4-step wizard (upload → details → live preview → publish) — UI only.
- **Profiles** — validator badges, reputation, and published content.

### The 6-metric scorecard

Every blueprint carries the same card, colour-coded by how each number is produced:

| Metric | Source |
| --- | --- |
| Autonomy (1–4), Security | **Static analysis** of the graph (auto) |
| Cost / time | **Measured** on a real run |
| Efficacy, Reliability, Transparency | **Community** vote |

## Stack

- [Next.js 16](https://nextjs.org) (App Router) · React 19 · TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) (CSS-first theme)
- [React Three Fiber](https://r3f.docs.pmnd.rs/) + [drei](https://github.com/pmndrs/drei) — the procedural 3D factory
- [Framer Motion](https://motion.dev) — scroll-driven morph & transitions
- [React Flow](https://reactflow.dev) (`@xyflow/react`) — the pipeline schematics

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build    # production build (fully static / SSG)
npm run start    # serve the production build
npm run lint     # eslint
```

## Project structure

```
app/                     routes (home, gallery, blueprints/[slug], parts, ontologies, upload, u/[username])
components/
  hero/                  scroll-morph hero, procedural 3D factory, blueprint drawing
  home/                  homepage narrative sections
  gallery/ blueprint/ parts/ ontology/ upload/ profile/   per-surface UI
  graph/                 React Flow schematic, SVG thumbnail, DOT viewer
  ui/                    design-system primitives (Button, Card, ScoreRadar, MetricBars, …)
  site/                  header + footer
lib/
  types.ts               domain model
  data/                  mock blueprints, parts, ontologies, users, graphs
  format.ts href.ts      helpers
```

## Note

All content is **mock data** and the app has **no backend** — auth, uploads, voting and
telemetry are illustrated in the UI but nothing is persisted. It's a design-complete
prototype of the product described in `darkprint-io-note.md`.
