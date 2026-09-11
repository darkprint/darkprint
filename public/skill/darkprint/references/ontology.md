<!--
  GENERATED FILE. Do not edit by hand.
  Rendered from lib/core/ontology/core.ts and lib/core/config.ts by scripts/skill-refs.ts.
  Regenerate with: npm run generate:skill-refs
  scripts/generate-skill-refs.test.ts fails the suite if this file drifts.
-->

# DarkPrint core vocabulary

54 terms. The vocabulary carries no version of its own: it names what an
Attractor node IS, and Attractor fixes those shapes in its own spec.

Every card field that names a term is resolved against this list. A term that is not
here is `card/unknown-term` (error). A term of the wrong kind, a `data-type` in the
`tools` list or a `tool` in `type`, is `card/wrong-term-kind` (error).

A card names no vocabulary version either. There is one vocabulary and every card is
read against it, so writing `ontology_version:` on a card is `card/retired-field`
(warning).

## phase: the five, closed

Optional and repeatable. A card may declare none, one, or several. `phase: []`, or the
field omitted entirely, is a **complete and correct answer**, and the validator emits
nothing at all about it: an intake step, a retrieval step and a memory store sit in none
of the five. Phase coverage is descriptive and nothing scores off it, so never invent a
phase to fill a strip.

This is the one dimension that is never namespaced: `me/triage` as a phase is
`card/namespaced-phase` (error). Listed in lifecycle order, which is the order coverage
reports in.

| id | label | meaning |
| --- | --- | --- |
| `planning` | Planning | From the request to a plan and the acceptance criteria. |
| `implementation` | Implementation | From the plan to the artefact. |
| `testing` | Testing | Runs the checks and produces the evidence. |
| `debugging` | Debugging | From failure evidence to a targeted fix. |
| `deployment` | Deployment | Release, publication, delivery. |

## node-type: what does the job

Exactly one per card, in `type`. Three of these are **abstract categories** and a node
should not be typed with one: they exist so the metrics can ask a subsumption question.

`human-gate` and `human-input` are subsumed by `human-in-the-loop` and carry
`impliesHuman`. Declaring one of them is the whole of how a card says a person acts at
the node: there is no second field beside `type` to set, and nothing else on the card
can say otherwise.

The `orchestration` branch is control flow: `parallel` splits the run, `parallel.fan-in`
joins it back, `manager-loop` supervises a sub-run and decides whether it repeats. The
three are named after the Attractor handlers they compile to, so a bundle's `topology.dot`
reads the same on both sides.

Autonomy is read twice off `type` and the weaker reading is the one that lands in a band.
How much runs alone: the share of nodes whose `type` is *not* subsumed by
`human-in-the-loop`. How much of the deciding runs alone: the same share taken over the
**control points** only, which are the nodes under `evaluative` or `orchestration` plus
`human-gate`, and it decides a band only from 2 control points up. Bands: > 0.9 closed-loop, ≥ 0.7 conditional, ≥ 0.5 supervised, below that assisted.

| id | label | broader | implies human | governs flow | meaning |
| --- | --- | --- | --- | --- | --- |
| `agent` | Agent | — | no | no | A model that reasons and produces non-deterministic output. |
| `decision` | Decision | `evaluative` | no | yes | A conditional switch that evaluates and routes without producing artefacts. |
| `evaluative` | Evaluative | — | no | yes | The abstract category of nodes that judge or route rather than produce an artefact. |
| `human-gate` | Human gate | `human-in-the-loop` | yes | yes | A point where a person must approve or reject. |
| `human-in-the-loop` | Human in the loop | — | no | no | The abstract category of nodes at which a person acts, and the one the autonomy metric interrogates. |
| `human-input` | Human input | `human-in-the-loop` | yes | no | A point where a person must supply data or content. |
| `manager-loop` | Manager loop | `orchestration` | no | yes | Supervises a sub-run, polling the work and deciding whether to act on it and whether to go round again until its stop condition holds. |
| `orchestration` | Orchestration | — | no | yes | The abstract category of nodes that shape the run itself: how many copies of a step exist, when they converge, whether the whole thing repeats. |
| `parallel` | Parallel | `orchestration` | no | yes | Splits the run into branches that proceed at the same time, producing nothing itself and deciding only how many copies of the work exist. |
| `parallel.fan-in` | Parallel fan-in | `orchestration` | no | yes | Waits for the branches a parallel node opened and joins them back into one line, deciding when the run continues rather than what it continues with. |
| `shell-tool` | Shell tool | `tool` | no | no | A tool node whose instruction is a shell command the runner executes directly. |
| `tool` | Tool | — | no | no | A deterministic operation: running tests, compiling, formatting, calling an API. |
| `validation` | Validation | `evaluative` | no | yes | Compares an artefact against criteria and produces a verdict with evidence. |

**The trap.** `tool`'s own description names running tests, which invites typing the
test runner `tool`. The `criteria-leak` check defines its generator set as the
predecessors of nodes typed `validation`; type the judge `tool` and that set is empty,
the check does not run, and the blueprint scores 4 on security because nothing was
asked, not because nothing was found. The engine says so with
`analysis/criteria-leak-unanchored` (warning). Whatever decides the run is finished is
`validation`.

## risk-marker: what it costs

Declared in `risk_markers`. The security score starts at 4 and each distinct marker
present anywhere in the blueprint is charged **once**, however many nodes carry it:
`clamp(round(4 − Σ weights), 1, 4)`. Weights are read from `lib/core/config.ts`; a locally
namespaced marker with no weight counts 0
and does not move the score.

Three markers are **inferred** from the graph whether or not any card declares them.
Declaring one the engine would have inferred anyway changes nothing; failing to declare
one does not hide it.

| id | weight | how it arrives | broader | meaning |
| --- | --- | --- | --- | --- |
| `arbitrary-code-execution` | −2.0 | declared | `execution-risk` | The node can run code or shell commands that were not decided in advance. |
| `criteria-leak` | −2.0 | inferred | `isolation-breach` | The node can see the acceptance criteria its own output will be judged against. |
| `execution-risk` | — | category | — | The abstract category for markers about running code the blueprint did not fix in advance. |
| `irreversible-action` | −1.5 | declared | — | The node takes actions that cannot be undone: publishing, sending, deleting. |
| `isolation-breach` | — | category | — | The abstract category for markers where information or state crosses a boundary the topology was meant to hold. |
| `secret-access` | −1.0 | declared | — | The node handles credentials, keys or tokens. |
| `unbounded-loop` | −1.5 | inferred | — | The node sits in a cycle with no iteration cap and no exit condition. |
| `unchecked-write` | −1.0 | declared | `isolation-breach` | The node writes to disk, a database or a repository with no check upstream. |
| `unvalidated-external-access` | −1.0 | inferred | — | The node reaches the network, an API or an external resource with no validation node upstream. |

How the three inferred ones are found:

- `unbounded-loop`: every strongly connected component in the graph, unless some card
  in it declares an iteration cap. The cap is a **top-level** key of `params`, one of
  `max_iterations`, `maxIterations`, `max_retries`, holding a non-negative
  integer (`0` counts). Nested inside another object it is not read, and the cycle takes
  the charge on every member with no obvious cause.
- `unvalidated-external-access`: a node whose `tools` include anything subsumed by
  `web-search`, `http-fetch`, `sql` or `ci`, which has at least one successor, and at
  least one of those successors is not a `validation` node. `messaging`, `git`,
  `vector-store`, `file-io`, `shell` and `python-sandbox` are deliberately excluded.
- `criteria-leak`: see below. This is the one the whole design is built around.

### criteria-leak, precisely

Two sets are computed first. **Producers** are nodes declaring an output port whose type
is subsumed by `acceptance-criteria`. **Judges** are nodes typed `validation`, and
**generators** are the predecessors of any judge, closed upward through non-judge nodes.
The marker fires, at −2.0, when:

- **topological**: walking forward from a producer, absorbing at judges, reaches a
  generator. The criteria reach the node whose work is being judged.
- **declarative**: one node emits both an `acceptance-criteria` port *and* another port
  a directly connected judge reads as the artefact under judgement. One node writing the
  criteria and the work is structurally illegal, off the declarations alone.

And it warns without charging when:

- **content**: the 3-gram Jaccard similarity between a generator's `spec` and a producer's
  exceeds 0.35
  (`analysis/criteria-leak-suspected`). An absent edge with the criteria paraphrased into
  the prose is a false isolation, and this is the half that catches it. Specs under three
  words are excluded from the comparison entirely.
- **relayed**: reachable only by walking *through* a judge
  (`analysis/criteria-relayed-through-judge`). The engine cannot tell an endorsed
  `judge → fixer → judge` loop from a forbidden `judge → builder → judge` one, so it
  declines to decide and says which it saw.
- **out of band**: a `params` key matching `/criteri/i` naming something nothing in the
  graph produces (`analysis/criteria-out-of-band`). Isolation has stopped being a property
  of the topology for that node.
- **unanchored**: one of the two legs is missing: producers with no generators, or
  generators with no producers (`analysis/criteria-leak-unanchored`). **The check did not
  run.** A 4 in this state is silence, not a pass. Both sets empty is silent by design.

## data-type: what an edge carries

Every port declares one, in `type`. Compatibility along an edge is directional: a source
port fits a target port when the types are equal, when either side is `any`, or when the
**source is narrower** than the target. Never the other way. `code → text` carries;
`text → code` is `bundle/type-mismatch` (error).

**Do not reach for `any`.** It matches everything, which means every edge passes, no
`cannot` prohibition can be violated, and the criteria check has nothing to anchor on. A
bundle typed `any` throughout loads perfectly and checks nothing.

`acceptance-criteria` is load-bearing: it is the port type the entire `criteria-leak`
machinery anchors on. Criteria typed `text` or `structured` are criteria the engine
cannot see.

| id | label | broader | meaning |
| --- | --- | --- | --- |
| `acceptance-criteria` | Acceptance criteria | `structured` | The conditions an artefact must satisfy, produced in planning and used to judge the result. |
| `any` | Any | — | The top of the data lattice, which accepts anything and asserts nothing. |
| `artifact` | Artifact | `binary` | A build output or file bundle produced by the run. |
| `binary` | Binary | `any` | Opaque bytes the graph moves without reading. |
| `code` | Code | `text` | Source code in some language, meant to be run or reviewed rather than read as prose. |
| `event` | Event | `signal` | A notice that something happened, with a name and a time. |
| `json` | JSON | `structured` | A JSON value, self-describing and machine-parsable. |
| `markdown` | Markdown | `text` | Text carrying Markdown structure: headings, lists, emphasis. |
| `plan` | Plan | `structured` | An ordered set of steps a downstream node is expected to carry out. |
| `report` | Report | `structured` | A finished write-up of what happened or what was found, meant to be read. |
| `signal` | Signal | `any` | A lightweight message that carries coordination rather than content. |
| `status` | Status | `signal` | The outcome of a step, in a form the graph can branch on. |
| `structured` | Structured | `any` | Data with a shape the receiving node can count on. |
| `table` | Table | `structured` | Rows over a fixed set of columns. |
| `text` | Text | `any` | Free-form prose with no structure the next node can rely on. |

The lattice, as `broader` draws it:

```
any
  binary
    artifact
  signal
    event
    status
  structured
    acceptance-criteria
    json
    plan
    report
    table
  text
    code
    markdown
```

## tool: what a node is permitted to do

Declared in `tools`. Note the deliberate id collision: `tool` is both a `node-type` and
the *kind* of these terms. The field a term appears in decides which is meant, so there
is no ambiguity to resolve: `type: tool` is the node type and `tools: [shell]` is a
capability.

`tools` says what the node is permitted to do. `mcp` says which installed server supplies
it, is free text, and is checked against nothing, because an MCP server is a process somebody
installed and the vocabulary has no term for one. A node can carry either without the other.

| id | label | broader | meaning |
| --- | --- | --- | --- |
| `ci` | CI | `tool-capability` | Triggers or inspects a continuous-integration pipeline. |
| `file-io` | File I/O | `tool-capability` | Reads and writes files on the local filesystem. |
| `git` | Git | `tool-capability` | Reads and writes a Git repository: branches, commits, diffs. |
| `http-fetch` | HTTP fetch | `tool-capability` | Fetches a URL over HTTP and hands back the response. |
| `human-review` | Human review | `tool-capability` | Routes the work to a person and waits for their verdict. |
| `messaging` | Messaging | `tool-capability` | Sends messages to a chat or notification channel. |
| `python-sandbox` | Python sandbox | `tool-capability` | Executes Python in an isolated interpreter. |
| `shell` | Shell | `tool-capability` | Runs shell commands on the host. |
| `sql` | SQL | `tool-capability` | Issues SQL statements against a database. |
| `tool-capability` | Tool capability | — | The root of the tool vocabulary, a capability a node needs from its host. |
| `vector-store` | Vector store | `tool-capability` | Embeds, stores and retrieves vectors for semantic recall. |
| `web-search` | Web search | `tool-capability` | Queries a search engine and returns ranked results. |

## Local terms

`node-type`, `risk-marker`, `data-type` and `tool` accept a locally namespaced term
(`me/my-term`), which must be rooted in an `extensions.yaml` carried by the bundle.
`phase` never accepts one.

**Do not emit local terms unless the author asks for one and writes the extension.** An
unrooted local term is silently ignored, which is the worst outcome available: the card
loads, the field reads as declared, and nothing enforces it.

