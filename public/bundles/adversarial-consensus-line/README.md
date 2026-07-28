# Adversarial Consensus Line

Two agents solve the same task from opposite temperatures, then a consensus node negotiates a single answer — re-opening the debate when they clash.

```
blueprint      adversarial-consensus-line
bundle digest  sha256:644482b6a7c7d2fb1169097a819f5c29a17c4d6214cb5ff20042f4d2c1a5590f
ontology       v0.1.0
nodes          8
cards pinned   8
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

8 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this factory from, and writing the documents is yours to do.

```
task      skills/task-intake.md
plan      skills/task-decomposer.md
solverA   skills/conservative-solver.md
solverB   skills/exploratory-solver.md
vote      skills/weighted-vote.md
verify    skills/acceptance-verifier.md
reopen    skills/bounded-retry.md
deliver   skills/result-delivery.md
```

Nothing here needs them to run. Every node in `factory.dot` carries its card's `spec` inline
as the prompt its agent receives, so a runner given this folder and nothing else has the whole
instruction for every node. A skill document adds a capability to one agent; what the
blueprint decides is who is wired to whom.

## The nodes

| node | card | phase |
| --- | --- | --- |
| `task` | `task-intake@1.0.0` | none declared |
| `plan` | `task-decomposer@1.0.0` | planning |
| `solverA` | `conservative-solver@1.0.0` | implementation |
| `solverB` | `exploratory-solver@1.0.0` | implementation |
| `vote` | `weighted-vote@1.0.0` | implementation |
| `verify` | `acceptance-verifier@1.1.0` | testing |
| `reopen` | `bounded-retry@1.0.0` | debugging |
| `deliver` | `result-delivery@1.0.0` | deployment |

## What DarkPrint computed

Autonomy: Closed-loop.

> 8 of 8 nodes run unattended, none have a person in the loop — 1.00 > 0.90 → Closed-loop.

Security level 4.

> 4 − 0.00 (no risk marker present across 8 nodes) → 4

Both readings come from the topology and the cards, with nothing executed. These are the files
that produced them, so the same arithmetic on your side gives the same class and the same
security level.

The autonomy class says what this factory automates and where a person stands in it.
Nothing here is a grade.

## What gets reported back

Nothing. No file in this folder calls home, and DarkPrint watches no run.

Cost and runtime on the blueprint page are labelled *reported* for that reason: whoever runs a
blueprint on their own hardware is the only party that can measure them. Sending a report
would be something you opt into. It is designed and not built, so there is no account, no
endpoint and no client for it in this bundle or on the site.

---

Exported from https://darkprint.io/blueprints/adversarial-consensus-line
