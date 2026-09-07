# The engine

33 modules under `lib/core`. Everything the site claims about a graph is computed here.

**Hard constraint: `lib/core/**` is isomorphic.** No `node:fs`, `node:path`, `node:crypto`, no
`Buffer`, no `Date.now()`, no `Math.random()`. It runs unchanged in the browser, which is what
lets `/upload` validate and score a bundle before anything is sent to a server.

```
lib/core/
  config.ts        every tunable number, deliberately in ONE file
  diagnostics.ts   the code table
  gate.ts          which codes block storage and which block a release
  dot/             lexer, recursive-descent parser, graph model
  card/            schema, parse, validate, iteration-cap
  ontology/        types, the 54 curated terms, resolve + isA + partitionTerms
  bundle/          types, resolve
  analysis/        autonomy, security, phase-coverage, similarity, analyze
  hash/            pure-TS sha256, canonical JSON, digest
  version/         semver, bump
  archive/         store, registry
  attractor/       reserved, lint, emit, import, condition
```

---

## The pipeline

```
folder -> parse DOT -> load + validate cards -> resolve -> analyse -> view model
                                                   |
                                                   +-> any ERROR => does not resolve
```

`lib/content/read.ts` throws on an error-severity diagnostic, so a broken bundle under
`content/` fails the build rather than shipping. `lib/server/engine` runs the same pass behind
`POST /api/validate/*`, and `lib/server/publish` refuses a release the pass reports errors on.

---

## Autonomy

`lib/core/analysis/autonomy.ts`.

Two separate outputs, and the difference matters:

**`autonomyClass`** is the share of nodes that run unattended, bucketed and named:

| class | share |
|---|---|
| `closed-loop` | above 0.90 |
| `conditional` | at least 0.70 |
| `supervised` | at least 0.50 |
| `assisted` | otherwise |

Thresholds live in `config.ts`. When a graph declares at least `minControlPoints` (2) control
points, the share of those that run unattended can lower the band. The numeric level exists
internally for sorting; **no surface ever prints it**, and no surface ranks or grades a class.

**`isDarkFactory`** is `autonomousNodes === totalNodes` and every one of the five phases
covered. A literal test, not a threshold: an eleven-node graph clears 0.90 with a person still
standing in it, so the fraction cannot carry that claim. A graph one gate short of it is a
supervised graph, which is a legitimate thing to be.

---

## Security

`lib/core/analysis/security.ts`. Starts at a clean **4**, subtracts the weight of every risk
marker found, rounds and clamps to 1..4.

| marker | weight |
|---|---|
| `arbitrary-code-execution` | 2.0 |
| `criteria-leak` | 2.0 |
| `unbounded-loop` | 1.5 |
| `irreversible-action` | 1.5 |
| `unvalidated-external-access` | 1.0 |
| `unchecked-write` | 1.0 |
| `secret-access` | 1.0 |
| *unrecognised* | **0**, shown and never silently scored |

The weights live in `DARKPRINT_CONFIG.security.weights` and nothing versions them: changing one
re-scores every release the next time it is analysed, and stored scores on old releases keep
the numbers they were computed with.

---

## Criteria leak, the site's central check

The argument DarkPrint exists to make is that **isolation is a property of the graph**, and it
is checked two independent ways.

### 1. Topological plus similarity, in `analysis/`

Does the acceptance criteria reach a node that produces work? The check has two halves,
because isolation is not only a missing arrow:

- **topological**: is there a path carrying `acceptance-criteria` into a producing node?
- **similarity**: does a card's `spec` paraphrase the criteria? Jaccard over 3-gram shingles,
  threshold **0.35** (`config.ts`). Above it the engine warns; `similarityFiresMarker` is off, so
  the text half never moves the score on its own. A card isolated on the diagram and quoting
  the criteria in its prose is leaking in practice.

Measured example: `code-builder@1.0.0` against `spec-planner@1.0.0` scores **0.0356**.

Diagnostics: `criteria-leak-suspected`, `criteria-relayed-through-judge`,
`criteria-out-of-band`, `criteria-leak-unanchored`.

Three bypasses were found and closed by attacking the check's own design: absorption at any
validation node (which made the engine's own remediation hint a recipe for hiding the leak),
`tester -> builder` reporting clean, and the check going silent when no node was typed
`validation`.

### 2. Declared prohibition, in `bundle/resolve.ts`

A card's `cannot` entry naming an ontology data type is a rule. An incoming edge carrying that
type raises **`bundle/prohibition-violated`**, an error, so the bundle does not resolve.

### The two together, on the starter

| | class | security | resolves |
|---|---|---|---|
| as shipped | closed-loop | **4** | yes |
| add `planner -> builder` | closed-loop | **2** | **no: `bundle/prohibition-violated`** |

Same conclusion from two directions. Every surface reports the **refusal before the score**: a
bundle that does not resolve is not a bundle with a low number.

---

## Phase coverage

`analysis/phase-coverage.ts`. Reports which of the five phases a graph touches.
**Descriptive only**: it never scores a graph for missing one, because a card's `phase` is
optional and repeatable and phases describe the factory rather than every node.

---

## Diagnostics

`lib/core/diagnostics.ts`. Codes are `namespace/kebab-case` and carry a severity. Any **error**
means the bundle does not resolve; `gate.ts` says which codes also block storage.

| namespace | covers | examples |
|---|---|---|
| `card/` | one card in isolation | `missing-field`, `bad-version`, `unknown-term`, `wrong-term-kind`, `spec-too-thin`, `prohibition-misfiled`, `retired-field`, `version-bump-too-small` |
| `bundle/` | the graph and its cards together | **`prohibition-violated`**, `port-mismatch`, `port-ambiguous`, `type-mismatch`, `unpinned-card`, `orphan-card`, `unreachable-node`, `no-entry`, `no-exit`, `missing-dependency`, `undeclared-dependency`, `digest-mismatch` |
| `analysis/` | what the analyzers found | `criteria-leak-suspected`, `criteria-relayed-through-judge`, `criteria-out-of-band`, `criteria-leak-unanchored`, `unresolved-node`, `empty-graph` |
| `attractor/` | interop lint | `reserved-attribute`, `bad-node-id`, `quoted-node-id`, `strict-graph`, `undirected-graph`, `hash-comment`, `condition-syntax`, `multiple-graphs` |

Every code carries a **hint** that names the fix. The `version-bump-too-small` hint, for
instance, lists every reason the bump was required, which is what makes the failure actionable.

---

## The archive

`lib/core/archive/`. Content-addressed: canonical JSON, pure-TS sha256, digest. Card versions
are **archived side by side**, never edited in place, which is what lets a page quote
`targeted-debugger@1.1.0`'s `max_retries: 2` and know it cannot drift. When a card's meaning
has to change, its version moves rather than its file.

---

## Config, one file on purpose

`lib/core/config.ts`, deep-frozen. Every threshold and weight that real data will later move
lives here and nowhere else, because scattered constants make calibration a treasure hunt.

```
autonomy         level4 0.90   level3 0.70   level2 0.50   minControlPoints 2
security         the weights table above, unknownMarkerWeight 0
criteriaLeak     similarityThreshold 0.35   similarityFiresMarker false
promotion        distinctAuthors 3   distinctBlueprints 5   (read by the term candidates route)
telemetry        minRuns 5   outlierZScore 3               (read by the run-report aggregate)
```

There is no ontology version anywhere in the engine: the vocabulary is `{ title, terms }` and a
retired term is marked `deprecated` in place.

---

## What breaks if you change this

| change | what goes stale |
|---|---|
| **a weight or threshold** | every score computed from now on, the nine bundle READMEs under `public/bundles`, the stored scores on every release until it is re-analysed, and the "4 to 2" demonstration |
| **an autonomy band** | every class shown in the registry and on every blueprint page |
| **a diagnostic code** | the check tables on the `/spec/*` pages, any page quoting it, the skill's `references/preflight.md`, and the fixtures asserting it |
| **the leak check** | `/spec/card`'s quoted diagnostic and the starter's claim to be the reference clean result |
| **anything in `lib/core`** | check the isomorphism constraint first: a `node:` import breaks `/upload` at runtime and not at build time |

**When you change a check, attack it before trusting it.** Every bypass listed above was found
by asking "how would I get past this?" rather than by running the suite, and each one passed
every test at the time.
