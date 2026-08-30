# Starter Software Factory

The canonical five-node factory, plan, build, test, debug, release, and the one edge it deliberately does not have: nothing carries the acceptance criteria to the builder.

```
blueprint      starter-software-factory
bundle digest  sha256:a1141199e8a69a94a661144e5a2a634f362cca3ebf5ae6c30a4f21491a90e718
ontology       v0.1.0
nodes          5
cards pinned   5
```

The digest is taken over `topology.dot` and the digest of every card version pinned in it.
Recompute it to confirm these files are the ones DarkPrint read. One changed byte gives a
different digest.

## Run it

This runs on your machine. DarkPrint hands out the files and analyses them statically. It
executes nothing and holds none of your provider keys.

This folder carries the topology and its pinned cards, nothing compiled. `topology.dot` names
every node, every edge and the card version pinned on it. Each card under `cards/` carries the
`spec` that becomes that node's prompt.

To compile these two into a pipeline a graph runner takes, run `darkprint export <dir>
--attractor`. It writes Attractor DOT to stdout, and that file opens with a list of everything
a DarkPrint blueprint had no way to express, so you can see what the runner falls back to its
own defaults for. Adapting the result, or building the run yourself from these files instead,
is your own harness's job.

4 of the 5 nodes name the model they run on, in their card's own `model` field. Read it off
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
planner    skills/spec-planner.md
builder    skills/code-builder.md
tester     skills/acceptance-tester.md
debugger   skills/targeted-debugger.md
deployer   skills/release-gate.md
```

Nothing here needs them to run. Every card carries its own `spec` inline, which is the whole
instruction for that node whatever harness compiles this topology into a running pipeline. A
skill document adds a capability to one agent; what the blueprint decides is who is wired to
whom.

## The nodes

| node | card | phase |
| --- | --- | --- |
| `planner` | `spec-planner@1.0.0` | planning |
| `builder` | `code-builder@1.0.0` | implementation |
| `tester` | `acceptance-tester@1.0.0` | testing |
| `debugger` | `targeted-debugger@1.0.0` | debugging |
| `deployer` | `release-gate@1.0.0` | deployment |

## What DarkPrint computed

Autonomy: Closed-loop.

> 5 of 5 nodes run unattended, none have a person in the loop. The graph declares 1 control point, which is one reading rather than a share. 1.00 > 0.90 → Closed-loop.

Security level 4.

> 4 − 0.00 (no risk marker present across 5 nodes) → 4

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

Exported from https://darkprint.io/blueprints/starter-software-factory
