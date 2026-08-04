# Adversarial Consensus Line, for an agent

You are being handed a DarkPrint blueprint: a pattern for two agents solve the same task from
opposite temperatures, then a consensus node negotiates a single answer, re-opening the debate
when they clash.

Everything below is read off `blueprint.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `task`: forward a request that failed the schema check
- `plan`: decompose the same brief two different ways
- `solverA`: add a requirement the brief does not state
- `solverB`: manufacture a departure the brief does not admit
- `vote`: report the winner without the tally
- `verify`: pass a candidate that missed a criterion
- `verify`: use `conflict` as a second failure exit
- `reopen`: retry past the declared cap
- `reopen`: swallow the error from the final attempt
- `deliver`: alter the result it was handed

## The nodes

### `task` — Task Intake

Accept an inbound task request, stamp it with a run id and the acceptance criteria it will be judged against, and hand it to the line as a single self-contained brief.

type `tool`

Emits: `request`: `json`

### `plan` — Task Decomposer

Break the request into an ordered set of sub-tasks small enough for one solver pass each, and carry the acceptance criteria down onto every one of them.

type `agent` · phase `planning` · model `claude-opus-5`

Takes: `request`: `json`

Emits: `subtasks`: `plan`

### `solverA` — Conservative Solver

Work the brief the safe way, the reading of the sub-tasks with the fewest assumptions, and emit one proposal with the evidence for every choice it made.

type `agent` · phase `implementation`

Takes: `brief`: `plan`

Emits: `proposal`: `json`

### `solverB` — Exploratory Solver

Work the same brief from the least obvious angle, and emit one proposal that states where it departs from the conservative reading and why that departure is worth the risk.

type `agent` · phase `implementation`

Takes: `brief`: `plan`

Emits: `proposal`: `json`

### `vote` — Weighted Vote

Score every competing proposal under the weighting rule and emit the winner together with the full tally, so the choice is auditable rather than a black box.

type `decision` · phase `implementation`

Takes: `proposals`: `json`, `rubric`: `text`

Emits: `chosen`: `json`, `tally`: `json`

### `verify` — Acceptance Verifier

Check the candidate against every acceptance criterion and pass it on only once all of them clear, raising a conflict signal instead when the failure is a genuine disagreement rather than a defect.

type `validation` · phase `testing` · model `claude-opus-5`

Takes: `candidate`: `json`, `evidence`: `json`

Emits: `accepted`: `json`, `conflict`: `status`

### `reopen` — Bounded Retry

Re-fire the wrapped step with exponential backoff until it succeeds or the attempt cap is spent, then emit the last error rather than keep going round.

type `tool` · phase `debugging`

Takes: `failure`: `status`

Emits: `attempt`: `json`, `last_error`: `status`

### `deliver` — Result Delivery

Hand the accepted result to its destination and close the run, carrying the decision trace with it so the delivery can be reconstructed later.

type `tool` · phase `deployment`

Takes: `result`: `json`

## The wiring

```
task -> plan   json
plan -> solverA   plan
plan -> solverB   plan
solverA -> vote   json
solverB -> vote   json
vote -> verify   json
verify -> deliver   json
verify -> reopen   status
reopen -> vote   json
```

An edge that is absent is as much a part of this pattern as one that is present. Before adding
a connection the graph does not have, check it against the prohibitions above.

## What this file does not tell you

Where this pattern belongs in the codebase, what to look for before wiring it in, and when not
to use it at all. Those depend on the code, and nothing in this folder has seen it. Read the
graph, read the cards, then read the code.

`README.md` covers running the pattern as it stands, including the command and the digest that
confirms these files are the ones the registry read.
