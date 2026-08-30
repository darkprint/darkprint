# How a node is defined

One node = one **card**. A card is a YAML document (JSON is accepted) describing what a single
agent, tool, gate or check is, what it needs, what it produces, and what it must never see.

**Source of truth:** `lib/core/card/schema.ts` (the type), `lib/core/card/validate.ts` (what is
checked), `lib/core/card/parse.ts` (wire format → type).
**Examples:** `content/cards/*.yaml` — 57 files, 53 distinct ids.
**Rendered:** `/nodes/<id>` shows every field of every card.

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
  Work through the build brief and emit the source it describes, adding nothing the brief
  does not ask for.
spec: >-
  A build brief arrives with the run: an ordered list of steps... The brief is all you get,
  and that is the point — do not go looking for a test suite, do not reason about how the
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
    description: The ordered build steps the run was instantiated with.
outputs:
  - name: build
    type: code
    description: One complete, compiling change implementing the brief.

dependencies: []
cannot:
  - acceptance-criteria
  - read the checks the work will be run against

requires_human: false
risk_markers: []
version: 1.0.0
author: orin
ontology_version: 0.1.0
```

---

## Every field

Wire keys are `snake_case`; the parsed type is `camelCase`.

### Identity

| field | type | notes |
|---|---|---|
| `id` | `string` | Stable across versions. A graph pins `id@version`. |
| `name` | `string` | Human-facing. |
| `type` | `string` | **Ontology `node-type` term.** Checked. |
| `phase` / `phases` | `string[]` | **Ontology `phase` terms.** Optional and repeatable — a node may sit in several phases or none. |
| `version` | semver | Archived side by side, never edited in place. |
| `author`, `provenance` | `string?` | |
| `ontology_version` | `string` | Which vocabulary this card was written against. |

### What it does

| field | type | notes |
|---|---|---|
| `action` | `string` | One line. What this node does, for a reader. |
| `spec` | `string` | **The instruction handed to the agent.** Inlined into `factory.dot` as Attractor's `prompt`. This is the field that actually runs. |
| `notes` | `string?` | Prose for a reader; not checked, not run. |

`spec` is held to a minimum substance by `card/spec-too-thin`, and it is one of the two
halves of the criteria-leak check: a spec that *paraphrases* the acceptance criteria leaks
them even when the graph shows no edge. See [`engine.md`](./engine.md).

### What it runs on

| field | type | notes |
|---|---|---|
| `model` | `string?` | Emitted as Attractor's reserved `llm_model`. **Absent emits nothing** rather than an empty string, so the graph's `model_stylesheet` still decides. |
| `agent` | `string?` | Role name. |
| `tools` | `string[]` | **Ontology `tool` terms.** Capabilities, checked. |
| `mcp` | `string[]` | Concrete MCP server names. Free text, deliberately *not* merged with `tools` — they answer different questions. |
| `skill` | `string?` | Path to the document defining behaviour, e.g. `skills/code-builder.md`. **DarkPrint stores the pointer and reads nothing at the other end.** No skill document travels in a bundle, and the bundle README says so. |
| `params` | `Record<string, JsonValue>` | Free-form. `max_iterations` here becomes Attractor's `max_retries`. |

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
| `cannot` | `string[]` | **Enforced when the entry names an ontology data type.** |
| `requires_human` | `boolean` | Must agree with `type`; `card/human-type-inconsistent` otherwise. |

> **Superseded 2026-08-30 by D-92, D-110 (`docs/DECISIONS.md`).** `requires_human` no longer exists: a card's `type` is the whole answer, and the boolean is derived from it rather than stored, so the two can no longer disagree and there is no inconsistency left to validate. The text above is kept verbatim as the record of what was specified. The capability it implies — staffing a node whose type says nothing about people — was deliberately not restored.
| `risk_markers` | `string[]` | **Ontology `risk-marker` terms.** Drive the security reading. |

**`cannot` is the field that makes the site's argument checkable.** An entry naming an
ontology data type is a prohibition on *receiving* it. If an incoming edge carries that type,
the bundle fails with `bundle/prohibition-violated` — an error, so it does not resolve at all.

The test is `ontology.isA(carrier.type, prohibited.id)` (`lib/core/bundle/resolve.ts`), which
is reflexive and one-directional: `cannot: [structured]` fires against an edge carrying `json`,
and `cannot: [acceptance-criteria]` is silent against an edge carrying the broader `structured`.

Entries that name no ontology term — `"read the checks the work will be run against"` — are
**free text**: shown to a reader, checked by nothing. The card page and `/spec/card` both say
which is which, because that distinction is the site's whole claim.

---

## Versioning

`lib/core/version/bump.ts` derives the required bump from two cards. It is not advisory:
`resolveBundle` runs it over a bundle's version chain, and `lib/content/read.ts` runs it over
the whole library at build time, so a wrong number **fails the build**.

| change | bump |
|---|---|
| removing a port, changing a port's type, adding a required input | **major** |
| **declaring a `cannot` entry** — it narrows what the node accepts | **major** |
| changing `id` | **major** (these are different cards) |
| adding an optional input or an output | minor |
| adding a term to `tools` / `mcp` / `risk_markers` | minor |
| declaring or withdrawing a `phase` | minor |
| adding or changing `model` | **minor** — an overridable default, not a narrowing |
| descriptions, reordering, withdrawing a prohibition | patch |

---

## What breaks if you change this

| change | what goes stale |
|---|---|
| **add a field** | `schema.ts`, `parse.ts`, `validate.ts`, `bump.ts` (decide its bump level), `/nodes/<id>` rendering, `/spec/card`, the bundle export, and possibly `attractor/emit.ts` |
| **change a field's checking** | `validate.ts` and the diagnostic table in [`engine.md`](./engine.md) |
| **add a `cannot` entry to a shipped card** | it is a **major** bump; the library check fails the build until the version is right |
| **change `spec`** | it is inlined into `factory.dot`, so every bundle carrying that card changes digest |
| **rename a field** | the 57 content files, and the wire-format mapping in `parse.ts` |

The landing's annotated card and `/spec/card` read `code-builder@1.0.0` through
`cardSource()`, so they cannot drift from the archive. Keep it that way — do not replace it
with a transcription.
