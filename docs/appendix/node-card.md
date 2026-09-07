# How a node is defined

One node = one **card**. A card is a YAML document (JSON is accepted) describing what a single
agent, tool, gate or check is, what it needs, what it produces, and what it must never see.

**Source of truth:** `lib/core/card/schema.ts` (the type), `lib/core/card/validate.ts` (what is
checked), `lib/core/card/parse.ts` (wire format to type).
**Examples:** `content/cards/*.yaml`, 57 files, 53 distinct ids.
**Rendered:** `/nodes/<id>` shows every field of every version, with a YAML download.
**Published:** a `card_version` row per `(id, version)`, body and source kept verbatim.

---

## The reference card

`content/cards/code-builder@1.0.0.yaml` is the one to read first. It carries the isolation
contract the entire site argues for:

```yaml
id: code-builder
name: Code Builder
type: agent
phase: implementation

action: >-
  Work through the build brief and emit the source it describes, adding nothing the brief does
  not ask for.
spec: >-
  A build brief arrives with the run: an ordered list of steps... The brief is all you get,
  and that is the point: do not go looking for a test suite, do not reason about how the
  result will be checked, and do not tune anything toward a check you imagine exists.

model: claude-sonnet-5
agent: Builder
tools: []
mcp:
  - filesystem
skill: skills/code-builder.md

inputs:
  - name: brief
    type: plan
    description: The ordered build steps the run was instantiated with, the only thing this node sees.
outputs:
  - name: build
    type: code
    description: One complete, compiling change implementing the brief, with no commentary attached.

dependencies: []
cannot:
  - acceptance-criteria
will_not:
  - read the checks the work will be run against

risk_markers: []
version: 1.0.0
author: orin
```

---

## Every field

Wire keys are `snake_case`; the parsed type is `camelCase`. `CARD_KNOWN_KEYS` in `validate.ts`
is the list of accepted keys, and the skill's `references/card-schema.md` is generated from it.

### Identity

| field | type | notes |
|---|---|---|
| `id` | `string` | Stable across versions. May carry one namespace segment (`berti/solver-a`). A graph pins `id@version`. |
| `name` | `string` | Human-facing. |
| `type` | `string` | **Ontology `node-type` term.** Checked. Whether the node needs a person is derived from it. |
| `phase` / `phases` | `string[]` | **Ontology `phase` terms.** Optional and repeatable: a node may sit in several phases or none. |
| `version` | semver | Archived side by side, never edited in place. |
| `author`, `provenance` | `string?` | Excluded from the digest. |

`requires_human` and `ontology_version` are retired keys. A card carrying either still loads
and raises `card/retired-field` at warning, because cards published before the change carry
them and refusing them would turn a schema change into an archive-wide outage.

### What it does

| field | type | notes |
|---|---|---|
| `action` | `string` | One line. What this node does, for a reader. |
| `spec` | `string` | **The instruction handed to the agent.** Compiled into Attractor's `prompt`. This is the field that actually runs. |
| `notes` | `string?` | Prose for a reader; not checked, not run. |

`spec` is held to a minimum substance by `card/spec-too-thin`, and it is one of the two halves
of the criteria-leak check: a spec that paraphrases the acceptance criteria leaks them even
when the graph shows no edge. See [`engine.md`](./engine.md).

### What it runs on

| field | type | notes |
|---|---|---|
| `model` | `string?` | Emitted as Attractor's reserved `llm_model`. Absent emits nothing, so the runner's own stylesheet fills it in; present, it outranks the sheet. |
| `agent` | `string?` | Role name. |
| `tools` | `string[]` | **Ontology `tool` terms.** Capabilities, checked. |
| `mcp` | `string[]` | Concrete MCP server names. Free text, deliberately separate from `tools`: they answer different questions. |
| `skill` | `string?` | Path to the document defining behaviour, e.g. `skills/code-builder.md`. DarkPrint stores the pointer and reads nothing at the other end; no skill document travels in a bundle, and the bundle README says so. |
| `params` | `Record<string, JsonValue>` | Free-form, and two keys are read on the way out. The iteration cap (`max_retries`, also accepted as `max_iterations` or `maxIterations`) becomes Attractor's `max_retries`; `tool_command` is the command a `shell-tool` node runs. Nesting is capped at depth 100. |

### Its interface

| field | type | notes |
|---|---|---|
| `inputs` | `Port[]` | `{ name, type, description?, required? }` |
| `outputs` | `Port[]` | same shape |
| `dependencies` | `string[]` | Other card ids this one needs present. |

Port `type` is an **ontology `data-type` term**. Edge compatibility is checked against the
type lattice, so `json` satisfies a port typed `structured`.

### Its limits

| field | type | notes |
|---|---|---|
| `cannot` | `string[]` | **Ontology data types this node must never receive.** Enforced by the resolver. |
| `will_not` | `string[]` | Free-text promises about the node's own behaviour. Shown; the resolver never reads it. |
| `risk_markers` | `string[]` | **Ontology `risk-marker` terms.** Drive the security reading. |

**`cannot` is the field that makes the site's argument checkable.** An entry naming an ontology
data type is a prohibition on *receiving* it. If an incoming edge carries that type, the bundle
fails with `bundle/prohibition-violated`, an error, so it does not resolve at all. A `cannot`
entry the ontology does not know is `card/unknown-term`, and one naming a term of another kind
is `card/wrong-term-kind`; both are errors. The misfiling check runs the other way: a `will_not`
entry that resolves to a data type is `card/prohibition-misfiled`, a warning whose hint says to
move it to `cannot`, where the resolver enforces it.

The test is `ontology.isA(carrier.type, prohibited.id)` (`lib/core/bundle/resolve.ts`), which
is reflexive and one-directional: `cannot: [structured]` fires against an edge carrying `json`,
and `cannot: [acceptance-criteria]` is silent against an edge carrying the broader `structured`.

---

## Versioning

`lib/core/version/bump.ts` derives the required bump from two cards. It is not advisory:
`resolveBundle` runs it over a bundle's version chain, `lib/content/read.ts` runs it over the
whole library at build time, `publish()` refuses a version that is not higher than the last,
and `darkprint bump` prints the inference for a declared version.

| change | bump |
|---|---|
| removing a port, changing a port's type, adding a required input, making an input required | **major** |
| **declaring a `cannot` entry**, which narrows what the node accepts | **major** |
| changing `id` | **major** (these are different cards) |
| adding an optional input or an output | minor |
| adding a term to `tools` / `mcp` / `risk_markers` | minor |
| declaring or withdrawing a `phase` | minor |
| adding or changing `model` | minor (an overridable default) |
| withdrawing a `cannot` entry | minor (it widens what the node accepts) |
| descriptions, reordering, dropping a list member, relaxing a required input | patch |

---

## What breaks if you change this

| change | what goes stale |
|---|---|
| **add a field** | `schema.ts`, `parse.ts`, `validate.ts`, `bump.ts` (decide its bump level), `/nodes/<id>` rendering, `/spec/card`, the bundle export, the generated `references/card-schema.md`, and possibly `attractor/emit.ts` |
| **change a field's checking** | `validate.ts` and the diagnostic table in [`engine.md`](./engine.md) |
| **add a `cannot` entry to a shipped card** | it is a **major** bump; the library check fails the build until the version is right |
| **change `spec`** | it is compiled into the runner's `prompt`, and the card's digest and every release pinning it change |
| **rename a field** | the 57 content files, every stored `card_version.source`, and the wire-format mapping in `parse.ts` |

The landing's annotated card and `/spec/card` read `code-builder@1.0.0` through
`cardSource()`, so they cannot drift from the archive. Keep it that way; do not replace it
with a transcription.
