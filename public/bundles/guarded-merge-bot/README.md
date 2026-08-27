# Guarded Merge Bot

An agent line triages the PR and drafts the review, iterating with the test runner until the suite is green. A maintainer approves before the merge lands.

```
blueprint      guarded-merge-bot
bundle digest  sha256:3e12918b0be5bfb932011edc8b5f3ff96d448cab3620d87f4c4a36869d3484fa
ontology       v0.1.0
nodes          6
cards pinned   6
```

The digest is taken over `topology.dot` and the digest of every card version pinned in it.
Recompute it to confirm these files are the ones DarkPrint read. One changed byte gives a
different digest.

## Run it

This runs on your machine. DarkPrint hands out the files and analyses them statically. It
executes nothing and holds none of your provider keys.

This folder carries the topology and its pinned cards, nothing compiled. `topology.dot` names
every node, every edge and the card version pinned on it. Each card under `cards/` carries the
`spec` that becomes that node's prompt. Turning the two into a running pipeline is your own
harness's job; DarkPrint does not compile or execute one.

3 of the 6 nodes name the model they run on, in their card's own `model` field. Read it off
`cards/<ref>.yaml`; whether your harness honours it is yours to decide.

## What is in the folder

```
topology.dot   the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/         the pinned cards, byte for byte as the registry stores them
README.md      this file
```

5 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this blueprint from, and writing the documents is yours to do.

```
pr       skills/pr-intake.md
triage   skills/diff-triager.md
draft    skills/review-drafter.md
tests    skills/test-runner.md
merge    skills/merge-executor.md
```

Nothing here needs them to run. Every card carries its own `spec` inline, which is the whole
instruction for that node whatever harness compiles this topology into a running pipeline. A
skill document adds a capability to one agent; what the blueprint decides is who is wired to
whom.

## The nodes

| node | card | phase |
| --- | --- | --- |
| `pr` | `pr-intake@1.0.0` | none declared |
| `triage` | `diff-triager@1.0.0` | planning |
| `draft` | `review-drafter@1.0.0` | implementation |
| `tests` | `test-runner@1.0.0` | testing |
| `gate` | `maintainer-approval@1.0.0` | deployment |
| `merge` | `merge-executor@1.0.0` | deployment |

## What DarkPrint computed

Autonomy: Conditional.

> 5 of 6 nodes run unattended, 1 has a person in the loop. 0.8333 ≥ 0.70 → Conditional.

Where a person acts:

- `gate` (Maintainer Approval): Hold the run at the merge boundary until a maintainer with write rights reads the green test report and approves, and emit their verdict as the only thing the merge step will act on (type: human-gate). A person acts here.

Security level 1.

> 4 − 1.00 (secret-access) − 1.00 (unchecked-write) − 1.00 (unvalidated-external-access) → 1

What was charged:

- Node "Merge Executor" (merge) declares the risk marker `secret-access` (Secret access).
- Node "Merge Executor" (merge) declares the risk marker `unchecked-write` (Unchecked write).
- Node "Test Runner" (tests) reaches outside the graph (tool "ci") and hands its output straight to "draft" and "gate" with no validation node in between.

Both readings come from the topology and the cards, with nothing executed. These are the files
that produced them, so the same arithmetic on your side gives the same class and the same
security level.

The autonomy class says what this blueprint automates and where a person stands in it.
Nothing here is a grade.

## What gets reported back

Nothing. No file in this folder calls home, and DarkPrint watches no run.

Cost and runtime on the blueprint page are labelled *reported* for that reason: whoever runs a
blueprint on their own hardware is the only party that can measure them. Sending a report
would be something you opt into. It is designed and not built, so there is no account, no
endpoint and no client for it in this bundle or on the site.

---

Exported from https://darkprint.io/blueprints/guarded-merge-bot
