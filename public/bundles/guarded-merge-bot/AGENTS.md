# Guarded Merge Bot, for an agent

You are being handed a DarkPrint blueprint: a pattern for an agent line triages the pr and
drafts the review, iterating with the test runner until the suite is green. a maintainer
approves before the merge lands.

Everything below is read off `blueprint.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `pr`: read the repository beyond the two refs the event names
- `pr`: form an opinion about the change
- `triage`: push to the repository it reads
- `draft`: write about a file banded mechanical
- `tests`: edit the code under test
- `tests`: re-run a failing suite hoping for a different answer
- `gate`: summarise the change for the maintainer
- `gate`: recommend an outcome
- `merge`: resolve a merge conflict itself
- `merge`: push to any ref other than the base branch the approval names

## The nodes

### `pr` — PR Intake

Open a run for every pull request the repository webhook reports, packaging the diff, the base and head refs and the author's declared intent into one payload the rest of the line reads.

type `tool`

Emits: `pull_request`: `json`

### `triage` — Diff Triager

Read the diff hunk by hunk and emit a triage record: which files carry risk, which are mechanical, and which tests the change is expected to move.

type `agent` · phase `planning` · model `claude-sonnet-5` · tools `git`

Takes: `pull_request`: `json`

Emits: `triage`: `json`

### `draft` — Review Drafter

Turn the triage record into a review a maintainer can act on — one comment per finding, anchored to a file and a line — and fold the last test failure into the draft when the suite came back red.

type `agent` · phase `implementation` · model `claude-sonnet-5`

Takes: `triage`: `json`, `failures`: `status`

Emits: `review`: `markdown`

### `tests` — Test Runner

Run the suites the review calls for against the PR head and gate on the result: green releases the report to the maintainer, red hands the failing cases back to the drafter for another pass.

type `validation` · phase `testing` · model `claude-haiku-4-5` · tools `ci`, `git`

Takes: `review`: `markdown`

Emits: `result`: `status`, `report`: `report`

### `gate` — Maintainer Approval

Hold the run at the merge boundary until a maintainer with write rights reads the green test report and approves, and emit their verdict as the only thing the merge step will act on.

type `human-gate` · phase `deployment` · tools `human-review` · **a person acts here**

Takes: `test_report`: `report`, `review`: `markdown`

Emits: `approval`: `status`

### `merge` — Merge Executor

Merge the approved head into the base under the configured strategy and emit the resulting commit, refusing to act on anything but a maintainer approval.

type `tool` · phase `deployment` · tools `git`

Takes: `approval`: `status`

Emits: `merge_commit`: `json`

## The wiring

```
pr -> triage   json
triage -> draft   json
draft -> tests   markdown
tests -> draft   status
tests -> gate   report
gate -> merge   status
```

An edge that is absent is as much a part of this pattern as one that is present. Before adding
a connection the graph does not have, check it against the prohibitions above.

## What this file does not tell you

Where this pattern belongs in the codebase, what to look for before wiring it in, and when not
to use it at all. Those depend on the code, and nothing in this folder has seen it. Read the
graph, read the cards, then read the code.

`README.md` covers running the pattern as it stands, including the command and the digest that
confirms these files are the ones the registry read.
