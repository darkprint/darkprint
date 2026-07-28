# Guarded Merge Bot

Triages a PR, drafts a review, runs the tests, then stops at a maintainer approval gate before merging — a deliberately supervised line.

```
blueprint      guarded-merge-bot
bundle digest  sha256:a9cd0329f8a2abb4359e940edec108cef2f67b80a5507a799cdf4e6d673f8026
ontology       v0.1.0
nodes          6
cards pinned   6
```

The digest is taken over `blueprint.dot` and the digest of every card version pinned in it.
Recompute it to confirm these files are the ones DarkPrint read. One changed byte gives a
different digest.

## Run it

This runs on your machine. DarkPrint hands out the files and analyses them statically. It
executes nothing and holds none of your provider keys.

```
attractor run factory.dot
```

Check it first, without spending tokens:

```
attractor validate factory.dot
attractor run factory.dot --simulate
```

`factory.dot` is self-contained. Every node carries its card's `spec` as the `prompt` its
agent receives, so the runner needs no other file from this folder. Flags vary between
Attractor runners; `attractor run --help` is authoritative on yours.

## What is in the folder

```
factory.dot     the pipeline Attractor runs, each card's spec inlined as a prompt
blueprint.dot   the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/          the pinned cards, byte for byte as the registry stores them
README.md       this file
```

Two DOT files, because they answer different questions. `blueprint.dot` is what the registry
stores and scores. `factory.dot` is that same graph prepared for a runner: a synthesised
`__start` and `__exit` node, and the prompts inlined. Delete those two nodes and their edges
and you are back to the topology.

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

Autonomy level 3.

> 5 of 6 nodes run unattended, 1 has a person in the loop — 0.8333 ≥ 0.70 → level 3 (Conditional).

Where a person acts:

- `gate` (Maintainer Approval): Hold the run at the merge boundary until a maintainer with write rights reads the green test report and approves, and emit their verdict as the only thing the merge step will act on (type: human-gate) — a person acts here.

Security level 1.

> 4 − 1.00 (secret-access) − 1.00 (unchecked-write) − 1.00 (unvalidated-external-access) → 1

What was charged:

- Node "Merge Executor" (merge) declares the risk marker `secret-access` (Secret access).
- Node "Merge Executor" (merge) declares the risk marker `unchecked-write` (Unchecked write).
- Node "Test Runner" (tests) reaches outside the graph (tool "ci") and hands its output straight to "draft" and "gate" with no validation node in between.

Both numbers come from the topology and the cards, with nothing executed. These are the files
that produced them, so the same arithmetic on your side gives the same two numbers.

The autonomy level says what this factory automates and where a person stands in it.
Nothing here is a grade.

## What gets reported back

Nothing. No file in this folder calls home, and DarkPrint watches no run.

Cost and runtime on the blueprint page are labelled *reported* for that reason: whoever runs a
blueprint on their own hardware is the only party that can measure them. Sending a report
would be something you opt into. It is designed and not built, so there is no account, no
endpoint and no client for it in this bundle or on the site.

---

Exported from https://darkprint.io/blueprints/guarded-merge-bot
