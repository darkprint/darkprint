# Starter Software Factory, for an agent

You are being handed a DarkPrint blueprint: a pattern for the canonical five-node factory,
plan, build, test, debug, release, and the one edge it deliberately does not have: nothing
carries the acceptance criteria to the builder.

Everything below is read off `blueprint.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

These are enforced. Each names a data type the node must never be handed, and the resolver
fails the bundle if an incoming edge could carry it. Rewiring this pattern in a way that
breaks one of them does not produce a variant of the pattern; it produces a bundle that will
not resolve.

- `builder` must never receive `acceptance-criteria`.
- `debugger` must never receive `acceptance-criteria`.

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `planner`: write any of the code it plans
- `planner`: weaken a criterion to make it easier to meet
- `builder`: read the checks the work will be run against
- `tester`: quote a criterion in the evidence it emits
- `debugger`: special-case the literal values in a trace
- `deployer`: alter the artefact on the way through
- `deployer`: release work the tester did not sign off

## The nodes

### `planner` — Spec Planner

Turn the incoming request into two separate artefacts, an ordered build brief, and the acceptance criteria the finished work will be judged against.

type `agent` · phase `planning` · model `claude-opus-5`

Takes: `request`: `text`

Emits: `plan`: `plan`, `criteria`: `acceptance-criteria`

### `builder` — Code Builder

Work through the build brief and emit the source it describes, adding nothing the brief does not ask for.

type `agent` · phase `implementation` · model `claude-sonnet-5`

Takes: `brief`: `plan`

Emits: `build`: `code`

### `tester` — Acceptance Tester

Run every criterion against the submitted build and split the outcome: the build itself when all of them pass, the raw failure evidence when any of them does not.

type `validation` · phase `testing` · model `claude-sonnet-5`

Takes: `criteria`: `acceptance-criteria`, `build`: `code`

Emits: `evidence`: `report`, `approved`: `artifact`

### `debugger` — Targeted Debugger

Turn one run's failure evidence into the narrowest patch that addresses it, and stop once the attempt cap is spent or the evidence stops changing.

type `agent` · phase `debugging` · model `claude-opus-5`

Takes: `evidence`: `report`

Emits: `patch`: `code`

### `deployer` — Release Gate

Admit only a signed-off build, write it to the run's release target with its tag and digest, and close the run.

type `tool` · phase `deployment`

Takes: `release`: `artifact`

## The wiring

```
planner -> tester   acceptance-criteria
builder -> tester   code
tester -> debugger   report
debugger -> tester   code
tester -> deployer   artifact
```

An edge that is absent is as much a part of this pattern as one that is present. Before adding
a connection the graph does not have, check it against the prohibitions above.

2 nodes declare inputs that no edge in this graph feeds: `planner`, `builder`. That is not a
gap to fill. What they take arrives when the run is instantiated, and on some patterns the
absent edge is the design.

## What this file does not tell you

Where this pattern belongs in the codebase, what to look for before wiring it in, and when not
to use it at all. Those depend on the code, and nothing in this folder has seen it. Read the
graph, read the cards, then read the code.

`README.md` covers running the pattern as it stands, including the command and the digest that
confirms these files are the ones the registry read.
