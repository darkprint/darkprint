# Checkpoint & Resume Runner, for an agent

You are being handed a DarkPrint blueprint: a pattern for a staged pipeline that snapshots
state after every stage, so a failure at stage 3 resumes from the last good checkpoint instead
of restarting the whole job.

Everything below is read off `topology.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `job`: begin any of the work the job describes
- `job`: open a second run for a job id already in flight
- `plan`: order a stage before one it depends on
- `stage1`: pull a source the stage does not name
- `stage2`: emit a partial set
- `stage3`: emit a half-built bundle
- `checkpoint`: rewrite or remove an entry
- `resume`: retry past the declared cap
- `resume`: restore past the last valid stage
- `verify`: pass a candidate that missed a criterion
- `ship`: alter the result it was handed

## The nodes

### `job` — Job Intake

Accept a long-running job submission, stamp it with a run id and the idempotency key the checkpoint log will be keyed on, and hand it to the planner.

type `tool`

Emits: `job`: `json`

### `plan` — Stage Planner

Break the job into an ordered set of stages small enough to be re-run on their own, and mark the checkpoint boundary after each one.

type `agent` · phase `planning` · model `claude-opus-5`

Takes: `job`: `json`

Emits: `stages`: `plan`

### `stage1` — Ingest Stage

Run the first stage of the plan: pull every source the job names, reject what the plan does not ask for, and emit the staged working set together with the manifest of what was read.

type `agent` · phase `implementation` · model `claude-haiku-4-5`

Takes: `stages`: `plan`

Emits: `staged`: `json`

### `stage2` — Transform Stage

Apply the plan's transformation to the staged working set, or to the snapshot the resume controller hands back, and emit the transformed set with the diff against what it started from.

type `agent` · phase `implementation` · model `claude-sonnet-5`

Takes: `staged`: `json`, `restore`: `json`

Emits: `transformed`: `json`

### `stage3` — Assemble Stage

Assemble the transformed set into the artefact the job asked for and attach the stage-by-stage trace, so the verifier judges the output and the path that produced it together.

type `agent` · phase `implementation` · model `claude-sonnet-5`

Takes: `transformed`: `json`

Emits: `artifact`: `json`

### `checkpoint` — Episodic Memory

Append each stage's inputs, outputs and decisions to the episode log as an immutable entry, and return the k most relevant episodes whenever a later step asks for context.

type `tool` · tools `vector-store`, `file-io`

Takes: `event`: `json`, `query`: `text`

Emits: `context`: `json`

### `resume` — Bounded Retry

Restore the most recent valid checkpoint and re-fire the failed stage from there, backing off between attempts until the cap is spent, then emit the last error.

type `tool` · phase `debugging`

Takes: `failure`: `status`, `checkpoint`: `json`

Emits: `attempt`: `json`, `last_error`: `status`

### `verify` — Acceptance Verifier

Check the candidate against every acceptance criterion and pass it on only once all of them clear, so nothing ships on a partial result.

type `validation` · phase `testing` · model `claude-sonnet-5`

Takes: `candidate`: `json`, `evidence`: `json`

Emits: `accepted`: `json`

### `ship` — Result Delivery

Hand the accepted result to its destination and close the run, carrying the decision trace with it so the delivery can be reconstructed later.

type `tool` · phase `deployment`

Takes: `result`: `json`

## The wiring

```
job -> plan   json
plan -> stage1   plan
stage1 -> stage2   json
stage2 -> stage3   json
stage3 -> verify   json
verify -> ship   json
stage1 -> checkpoint   json
stage2 -> checkpoint   json
checkpoint -> resume   json
resume -> stage2   json
```

An edge that is absent is as much a part of this pattern as one that is present. Before adding
a connection the graph does not have, check it against the prohibitions above.

## What this file does not tell you

Where this pattern belongs in the codebase, what to look for before wiring it in, and when not
to use it at all. Those depend on the code, and nothing in this folder has seen it. Read the
graph, read the cards, then read the code.

`README.md` covers running the pattern as it stands, including the command and the digest that
confirms these files are the ones the registry read.
