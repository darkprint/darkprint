# The ontology

The controlled vocabulary the DOT and the cards both draw from. It has no version: `Ontology`
is `{ title, terms }`, and a term is retired by marking it `deprecated` in place with a pointer
to its successor.

**Source of truth:** `lib/core/ontology/core.ts` (the terms), `types.ts` (the shapes),
`resolve.ts` (lookup, the lattice, `isA`, `partitionTerms`).
**Local additions:** `content/ontology/extensions.yaml`.
**Rendered:** the vocabulary browser on `/spec/card` and one page per term at `/ontology/<term>`.
**Generated:** the skill's `references/ontology.md`, by `npm run generate:skill-refs`.

To re-derive the counts below:

```bash
node --experimental-strip-types --import ./scripts/module-hook.ts -e '
  const { CORE_ONTOLOGY } = await import("./lib/core/ontology/core.ts");
  const by = {};
  for (const t of CORE_ONTOLOGY.terms) (by[t.kind] ??= []).push(t.id);
  for (const [k, v] of Object.entries(by)) console.log(k, v.length);
'
```

---

## The 54 curated terms

### `phase`: 5, and the list is closed

```
planning   implementation   testing   debugging   deployment
```

**Phases describe the factory, not every node.** A card's `phase` is optional and repeatable:
a node may sit in several or in none. Phase coverage is *descriptive*: it reports which phases
a graph touches and never scores a graph for missing one.

Note the collision hazard: these five words are nearly the same as the five **roles** the site
names on `/spec/topology` (planner, builder, tester, debugger, deployer). A role is the job a
node does in a graph; a phase is a field on a card drawn from this closed list. The site states
the distinction wherever both appear.

### `node-type`: 13

```
human-in-the-loop   evaluative   orchestration      (categories)
agent   tool   shell-tool
human-gate   human-input                            (under human-in-the-loop)
decision   validation                               (under evaluative)
parallel   parallel.fan-in   manager-loop           (under orchestration)
```

`human-gate` and `human-input` are under `human-in-the-loop`, which is what `requiresHuman`
reads and what `isDarkFactory` counts: a node needs a person exactly when its type is under
that category. `shell-tool` is a `tool` whose `params.tool_command` is the command it runs.

### `risk-marker`: 9

```
execution-risk   isolation-breach                    (categories)
arbitrary-code-execution   unvalidated-external-access   unbounded-loop
unchecked-write            criteria-leak                 secret-access
irreversible-action
```

The seven leaves carry weights in `lib/core/config.ts` and drive the security reading.
An unrecognised marker weighs **0**: it is shown and never silently scored.

### `data-type`: 15, and they form a lattice

```
any
+-- text ........ markdown, code
+-- structured .. json, table, plan, acceptance-criteria, report
+-- binary ...... artifact
+-- signal ...... event, status
```

The lattice is what makes port compatibility and `cannot` work. `isA` is **reflexive and
one-directional**: `json` satisfies a port typed `structured`; `structured` does not satisfy
one typed `json`.

`acceptance-criteria` is the term the whole site turns on: it is what `code-builder@1.0.0`
declares it `cannot` receive.

### `tool`: 12

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
- A local risk marker declares a `defaultWeight`; absent, it weighs 0.
- `partitionTerms()` in `resolve.ts` is the one place that splits curated from local. Use it
  rather than counting terms yourself: a page that counted the overlay into the core is exactly
  how a spec page once printed a total the core did not have.
- **Extensions travel with the bundle.** `ontology/extensions.yaml` is exported into any
  bundle that uses local terms, or the download cannot reproduce its own scores. A published
  release stores the author's file byte for byte as its local vocabulary.

---

## Moving the vocabulary

There is no version to bump. Adding a term is a change to `core.ts` and to the generated
references. Retiring one means setting `deprecated: { since, replacedBy }` on it: a card that
names a deprecated term loads with `card/deprecated-term`, and the term page points at the
successor. Removing a term outright breaks every card that names it. A local term becomes a
candidate for the core when `DARKPRINT_CONFIG.promotion` is met (3 distinct authors across 5
distinct blueprints); `GET /api/ontology-usage/candidates` lists the counts and nothing
promotes automatically.

---

## What breaks if you change this

| change | what goes stale |
|---|---|
| **add a term** | the `/ontology/<term>` page count, the totals printed on `/what-a-blueprint-is` and `/spec/card`, and the skill's generated `references/ontology.md` (`scripts/generate-skill-refs.test.ts` reds until it is regenerated) |
| **remove or rename a term** | every card using it (`card/unknown-term`), every port typed with it, every `cannot` naming it, and every bundle's scores |
| **change the lattice** (`broader`) | port compatibility across all 10 bundles, and `cannot` enforcement: a widened parent can make a prohibition fire where it did not |
| **change a weight in `config.ts`** | every security reading on the site and all 10 bundle READMEs; `components/explain/starter-isolation.ts` derives the "4 to 2" figure for `/spec/card` |
| **add a term to the closed `phase` list** | phase coverage, the phase chips, `isDarkFactory` and every surface that assumes five |

Four of the ten archive blueprints floor at security 1 under the shipped weights. Before
changing a weight, treat that as the open calibration item it is: tune against real data rather
than with another ad-hoc nudge.
