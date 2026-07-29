# The engine

30 modules under `lib/core`. Everything the site claims about a graph is computed here.

**Hard constraint: `lib/core/**` is isomorphic.** No `node:fs`, `node:path`, `node:crypto`, no
`Buffer`, no `Date.now()`, no `Math.random()`. It runs unchanged in the browser, which is what
lets `/upload` validate and score a bundle with no server.

```
lib/core/
  config.ts        every tunable number, deliberately in ONE file
  diagnostics.ts   the code table
  dot/             lexer, recursive-descent parser, graph model
  card/            schema, parse, validate, iteration-cap
  ontology/        types, the 49 curated terms, resolve + isA + partitionTerms
  bundle/          types, resolve
  analysis/        autonomy, security, phase-coverage, similarity, analyze
  hash/            pure-TS sha256, canonical JSON, digest
  version/         semver, bump
  archive/         store, registry
  attractor/       reserved, lint, emit
```

---

## The pipeline

```
folder ──► parse DOT ──► load + validate cards ──► resolve ──► analyse ──► view model
                                                      │
                                                      └─► any ERROR ⇒ does not resolve
```

`lib/content/read.ts` throws on an error-severity diagnostic, so a broken bundle **fails the
build** rather than shipping. `lib/content/view.ts` is the only bridge from engine output to
UI shapes, and it decides nothing — it translates.

---

## Autonomy

`lib/core/analysis/autonomy.ts`.

Two separate outputs, and the difference matters:

**`autonomyClass`** — the *share* of nodes that run unattended, bucketed and named:

| class | share |
|---|---|
| `closed-loop` | > 0.90 |
| `conditional` | > 0.70 |
| `supervised` | > 0.50 |
| `assisted` | otherwise |

Thresholds live in `config.ts`. The ordinal band exists internally for sorting; **no surface
ever prints it.**

**`isDarkFactory`** — `totalNodes > 0 && autonomousNodes === totalNodes`. A literal
**zero-human-node** test, not a threshold. This matters: an eleven-node graph clears 0.90 with
a person still standing in it, so the fraction cannot carry that claim.

A graph one gate short of it is not "nearly" anything. It is a supervised graph, which is a
legitimate thing to be. Doc 2 §1.1 is enforced by tests here: no ordinal on any surface, no
ranking, no badge.

---

## Security

`lib/core/analysis/security.ts`. Starts at a clean **4** and subtracts weighted penalties for
risk markers, then clamps.

| marker | weight |
|---|---|
| `arbitrary-code-execution` | 2.0 |
| `criteria-leak` | 2.0 |
| `unbounded-loop` | 1.5 |
| `irreversible-action` | 1.5 |
| `unvalidated-external-access` | 1.0 |
| `unchecked-write` | 1.0 |
| `secret-access` | 1.0 |
| *unrecognised* | **0** — shown, never silently scored |

**Open calibration item:** four of nine blueprints floor at security 1. Either the weights are
too harsh or the scale is too short. Doc 3 §9 left this for tuning against real data; see
`../PROJECT.md` §3.3. Changing any weight is a PATCH of the ontology version.

---

## Criteria leak — the site's central check

The argument DarkPrint exists to make is that **isolation is a property of the graph**, and it
is checked two independent ways.

### 1. Topological + similarity — `analysis/`

Does the acceptance criteria reach a node that produces work? The check has two halves,
because isolation is not only a missing arrow:

- **topological** — is there a path carrying `acceptance-criteria` into a producing node?
- **similarity** — does a card's `spec` *paraphrase* the criteria? Jaccard over 3-gram
  shingles, threshold **0.35** (`config.ts`). A card isolated on the diagram and quoting the
  criteria in its prose is leaking in practice.

Measured example: `code-builder@1.0.0` against `spec-planner@1.0.0` scores **0.0356**.

Diagnostics: `criteria-leak-suspected`, `criteria-relayed-through-judge`,
`criteria-out-of-band`, `criteria-leak-unanchored`.

> Three bypasses were found and closed in this project by attacking the check's own design:
> absorption at *any* validation node (which made the engine's own remediation hint a recipe
> for hiding the leak), `tester → builder` reporting clean, and the check going silent when no
> node was typed `validation`.

### 2. Declared prohibition — `bundle/resolve.ts`

A card's `cannot` entry naming an ontology data type is a rule. An incoming edge carrying that
type raises **`bundle/prohibition-violated`**, an *error*, so the bundle does not resolve.

### The two together, on the starter

| | class | dark factory | security | resolves |
|---|---|---|---|---|
| as shipped | closed-loop | yes | **4** | yes |
| add `planner -> builder` | closed-loop | yes | **2** | **no — `bundle/prohibition-violated`** |

Same conclusion from two directions. This is what `/what-it-isnt` and the `/build` switch
demonstrate live, and both surfaces must report the **refusal before the score** — a bundle
that does not resolve is not a bundle with a low number.

---

## Phase coverage

`analysis/phase-coverage.ts`. Reports which of the five phases a graph touches.
**Descriptive only** — it never scores a graph for missing one, because a card's `phase` is
optional and repeatable and phases describe the factory rather than every node.

---

## Diagnostics

`lib/core/diagnostics.ts`. Codes are `namespace/kebab-case` and carry a severity. Any **error**
means the bundle does not resolve.

| namespace | covers | examples |
|---|---|---|
| `card/` | one card in isolation | `missing-field`, `bad-version`, `unknown-term`, `spec-too-thin`, `human-type-inconsistent`, `version-bump-too-small` |
| `bundle/` | the graph and its cards together | **`prohibition-violated`**, `port-mismatch`, `port-ambiguous`, `type-mismatch`, `unpinned-card`, `orphan-card`, `unreachable-node`, `no-entry`, `no-exit`, `digest-mismatch`, `ontology-mismatch` |
| `analysis/` | what the analyzers found | `criteria-leak-suspected`, `criteria-relayed-through-judge`, `criteria-out-of-band`, `unresolved-node`, `empty-graph` |
| `attractor/` | interop lint | `reserved-attribute`, `bad-node-id`, `quoted-node-id`, `strict-graph`, `undirected-graph`, `hash-comment` |

Every code should carry a **hint** that names the fix. The `version-bump-too-small` hint, for
instance, lists every reason the bump was required — which is what makes the build failure
actionable rather than annoying.

---

## The archive

`lib/core/archive/`. Content-addressed: canonical JSON → pure-TS sha256 → digest. Card versions
are **archived side by side**, never edited in place, which is what lets a figure quote
`targeted-debugger@1.0.0`'s `max_iterations: 3` and know it cannot drift.

---

## Config — one file, on purpose

`lib/core/config.ts`, deep-frozen. Doc 1 §11, taken literally: every threshold and weight that
real data will later move lives here and nowhere else, because scattered constants make
calibration a treasure hunt.

```
ontologyVersion  0.1.0
autonomy         level4 0.90   level3 0.70   level2 0.50
security         the weights table above, unknownMarkerWeight 0
criteriaLeak     similarityThreshold 0.35   similarityFiresMarker false
promotion        distinctAuthors 3   distinctBlueprints 5      (unused — no backend)
telemetry        minRuns 5   outlierZScore 3                   (unused — no backend)
```

The last two blocks describe features that **do not exist**. They are design, not behaviour;
do not let a surface imply otherwise.

---

## What breaks if you change this

| change | what goes stale |
|---|---|
| **a weight or threshold** | every score on the site, all 9 READMEs, the "4 to 2" demonstration, and the ontology version (PATCH) |
| **an autonomy band** | every class shown in the gallery and on every blueprint page |
| **a diagnostic code** | the tables on `/spec`, any page quoting it, and the fixtures asserting it |
| **the leak check** | `/what-it-isnt`, the `/build` switch, and the starter's claim to be the reference clean result |
| **anything in `lib/core`** | check the isomorphism constraint first — a `node:` import breaks `/upload` at runtime and not at build time |

**When you change a check, attack it before trusting it.** Every bypass listed above was found
by asking "how would I get past this?" rather than by running the suite, and each one passed
every test at the time.
