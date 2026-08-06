# The ontology

The controlled vocabulary the DOT and the cards both draw from. Version **0.1.0**.

**Source of truth:** `lib/core/ontology/core.ts` (the terms), `types.ts` (the shapes),
`resolve.ts` (lookup, the lattice, `isA`, `partitionTerms`).
**Local additions:** `content/ontology/extensions.yaml`.
**Rendered:** `/ontology` and `/ontology/<term>` (50 pages), and `/spec/ontology`.
**Specification:** `files/darkprint-ontology-v0.1.md` (doc 3).

To re-derive the counts below:

```bash
node --experimental-strip-types -e 'import("./lib/core/ontology/core.ts").then(m => {
  const by = {}; for (const t of Object.values(m.CORE_ONTOLOGY.terms ?? m.CORE_ONTOLOGY))
    (by[t.kind] ??= []).push(t.id);
  for (const [k, v] of Object.entries(by)) console.log(k, v.length);
})'
```

---

## The 49 curated terms

### `phase` — 5, and the list is closed

```
planning   implementation   testing   debugging   deployment
```

**Phases describe the factory, not every node.** A card's `phase` is optional and repeatable:
a node may sit in several or in none. Phase coverage is *descriptive* — it reports which
phases a graph touches and never scores a graph for missing one.

Note the collision hazard: these five words are nearly the same as the five **roles** the site
names on `/spec/topology` (planner, builder, tester, debugger, deployer). A role is the job a
node does in a graph; a phase is a field on a card drawn from this closed list. The site states
the distinction wherever both appear.

### `node-type` — 8

```
human-in-the-loop   evaluative        (categories)
agent   tool   human-gate   human-input   decision   validation
```

`human-gate` and `human-input` are under `human-in-the-loop`, which is what
`requires_human` must agree with and what `isDarkFactory` counts.

### `risk-marker` — 9

```
execution-risk   isolation-breach                    (categories)
arbitrary-code-execution   unvalidated-external-access   unbounded-loop
unchecked-write            criteria-leak                 secret-access
irreversible-action
```

The seven leaves carry weights in `lib/core/config.ts` and drive the security reading.
An unrecognised marker weighs **0** — it is shown but never silently scored.

### `data-type` — 15, and they form a lattice

```
any
├── text ── markdown, code
├── structured ── json, table, plan, acceptance-criteria, report
├── binary ── artifact
└── signal ── event, status
```

The lattice is what makes port compatibility and `cannot` work. `isA` is **reflexive and
one-directional**: `json` satisfies a port typed `structured`; `structured` does not satisfy
one typed `json`.

`acceptance-criteria` is the term the whole site turns on — it is what `code-builder@1.0.0`
declares it `cannot` receive.

### `tool` — 12

```
tool-capability                                      (category)
web-search   http-fetch   shell   python-sandbox   file-io   sql
vector-store   git   ci   messaging   human-review
```

These are *capabilities*. A card's `mcp` field names concrete servers and is deliberately
separate: they answer different questions.

---

## Local extensions

A bundle may add terms without touching the core, by namespacing them:

```yaml
# content/ontology/extensions.yaml
terms:
  - id: lupo/pii-handling
    kind: risk-marker
    broader: isolation-breach
    defaultWeight: 0.5
```

Rules:

- **A local term must be namespaced** (`owner/term`). An un-namespaced unknown term is
  `card/unknown-term`, an error.
- It must declare `broader`, pointing at a curated term, so it inherits a place in the lattice.
- `partitionTerms()` in `resolve.ts` is the one place that splits curated from local. Use it
  rather than counting terms yourself — a page that counted the overlay into the core is
  exactly how the old `/spec` came to print "50 terms" when the core has 49.
- **Extensions travel with the bundle.** `ontology/extensions.yaml` is exported into any
  bundle that uses local terms, or the download cannot reproduce its own scores.

---

## Versioning the ontology

Doc 3 §8. The version is stamped on every card (`ontology_version`) and every bundle.

| change | bump |
|---|---|
| add a term | **minor** |
| remove or rename a term | **major** |
| change a weight or threshold in `lib/core/config.ts` | **patch** |

The last one is easy to under-rate: moving a number re-scores every blueprint that already
exists, which is why it is a version change at all and why every tunable lives in that one
file rather than scattered through the analyzers.

---

## What breaks if you change this

| change | what goes stale |
|---|---|
| **add a term** | `/ontology/<term>` page count, the `partitionTerms` total printed on `/what-a-blueprint-is`'s vocabulary band, and the ontology version on every card |
| **remove or rename a term** | every card using it (`card/unknown-term`), every port typed with it, every `cannot` naming it, and every bundle's scores |
| **change the lattice** (`broader`) | port compatibility across all 9 bundles, and `cannot` enforcement — a widened parent can make a prohibition fire where it did not |
| **change a weight in `config.ts`** | every security reading on the site and all 9 bundle READMEs. The `/what-it-isnt` demonstration that quoted "4 to 2" is gone with that route; `components/explain/starter-isolation.ts` still derives the figure for `/spec/card` |
| **add a term to the closed `phase` list** | doc 3 calls this list closed; phase coverage, the phase chips, and `/spec/ontology` all assume five |

**Before changing a weight, check the open calibration item** in `../PROJECT.md` §3.3: four of
nine blueprints currently floor at security 1, which suggests the weights or the scale need
tuning against real data rather than another ad-hoc nudge.
