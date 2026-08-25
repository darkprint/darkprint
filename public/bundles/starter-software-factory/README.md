# Starter Software Factory

The canonical five-node factory, plan, build, test, debug, release, and the one edge it deliberately does not have: nothing carries the acceptance criteria to the builder.

```
blueprint      starter-software-factory
bundle digest  sha256:945448e03d7997e279f30ccb0f020ce0575cb2fa7cebed510c7b84f5e68e39af
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

4 of the 5 nodes name the model they run on, and carry it as `llm_model`. That is Attractor's
own attribute for it, so the run uses those models as they stand and your provider has to
serve them. A node attribute outranks a graph-level `model_stylesheet`, so edit the line to
run a node on something else, and delete the attribute to hand the choice back to your own
configuration.

## What is in the folder

```
factory.dot    the pipeline Attractor runs, each card's spec inlined as a prompt
topology.dot   the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/         the pinned cards, byte for byte as the registry stores them
README.md      this file
AGENTS.md      the same folder addressed to an agent adapting it, generated from the cards
```

Two DOT files, because they answer different questions. `topology.dot` is what the registry
stores and scores. `factory.dot` is that same graph prepared for a runner: a synthesised
`__start` and `__exit` node, and the prompts inlined. Delete those two nodes and their edges
and you are back to the topology.

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

Nothing here needs them to run. Every node in `factory.dot` carries its card's `spec` inline
as the prompt its agent receives, so a runner given this folder and nothing else has the whole
instruction for every node. A skill document adds a capability to one agent; what the
blueprint decides is who is wired to whom.

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

> 5 of 5 nodes run unattended, none have a person in the loop. 1.00 > 0.90 → Closed-loop.

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
