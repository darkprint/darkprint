# DarkPrint

*Recap written 2026-07-29, at commit `340931e` on `feat/core-engine-ontology-v0.1`.*

For the durable structural reference — how a blueprint, a node and the ontology are
defined — see [`architecture/`](./architecture/README.md). This file is the short version:
what the project is for, where it stands, and what to do next.

---

## 1. The vision

**A registry where people publish, read, fork and run the graphs that make agents build
software.**

The claim the site is built on is that the useful artefact is not a prompt and not a model.
It is the **shape of the work**: which agents exist, what each one is handed, what each one
is kept away from, and where the run stops for a person. That shape is a directed graph.
DarkPrint stores it as text, scores it, and hands it back as a folder you can run.

A graph in which **no node waits for a person** is *classed* a **dark factory**. Everything
on the site is arranged around that motif.

### The one rule that constrains everything

**Autonomy is descriptive, never a verdict.** (Doc 2 §1.1.)

A dark factory is a *description of a shape*, the way *acyclic* describes a shape. It is not
an award, not a score to maximise, not a rank. A blueprint that holds for a person before it
releases is a first-class blueprint whose author decided where a person belongs, and it is
shelved beside the rest.

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

All gates green from a clean tree, verified at `340931e`:

```
npm run build     135 pages, 9 downloadable bundles
npx tsc --noEmit  clean
npm run lint      clean
npm test          3045 tests, 60 files
```

| | |
|---|---|
| engine | 30 modules under `lib/core`, isomorphic (no `node:*`, no `Date.now`, no `Math.random`) |
| content | 9 blueprints, 57 card files (53 distinct nodes, 4 with two versions) |
| ontology | v0.1.0, 49 curated terms + namespaced local extensions |
| routes | 18 route files → 135 prerendered pages, SSG only |
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

Ordered by my read of the value. Nothing here is started.

### 3.1 Finish the length pass (small, and already diagnosed)

The redesign cut the landing 79% and `/build` by up to 66% per step. Two pages did not follow:

| page | now | note |
|---|---|---|
| `/what-it-isnt` | ~13.1 viewport-heights | fell 13.8%; was asked to absorb two more sections |
| `/towards-a-dark-factory/the-climb` | ~13.6 | fell 4.3%; a fourth route was declined as out-of-spec |
| `/nodes` | ~17.0 | never in scope |
| `/ontology` | ~13.7 | never in scope |

`/nodes` is now the longest page on the site. If "short pages" is meant site-wide, start there.

### 3.2 Apply the label guard to every scene

`components/home/roles-labels.test.ts` renders a figure, resolves each `<text>` through its
translations, and fails on overlapping or clipped labels. It caught four defects the
size-only check could not see. **It currently covers the roles figure alone.** Every other
scene — the landing beats, the levels, the lifecycle panels, the dezoom, the spec figures — is
unguarded, and the fixer's own notes flag the lifecycle panel's labels as "tight". Generalise
the helper and point it at all of them.

### 3.3 Calibrate the weights (needs a decision, not code)

`lib/core/config.ts` holds every tunable number, deliberately in one file. Two are visibly
mis-set against real content:

- **four of nine blueprints floor at security 1.** Either the weights are too harsh or the
  scale is too short. Doc 3 §9 left this open for calibration against real data.
- **doc 2 §5.6's slider moves one metric where the doc implies four.**

Changing any of these is a PATCH of the ontology version, because it re-scores every blueprint.

### 3.4 Give the scoring model a home

The security weights table and the telemetry design are documented nowhere a reader can reach.
A `/how-it-scores` page under `/spec` would close it, and `/spec` is already the four-page
sequence that would host it.

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
