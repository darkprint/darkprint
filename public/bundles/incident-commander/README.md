# Incident Commander

Triages alerts, routes to the right runbook, drafts a mitigation, QAs it against blast-radius rules, and escalates to on-call when risk is high.

```
blueprint      incident-commander
bundle digest  sha256:0027d8911fdb6373b911f691a841b627f944c095355cf483fc1a60abf8b60976
ontology       v0.1.0
nodes          7
cards pinned   7
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

2 of the 7 nodes name the model they run on, and carry it as `llm_model`. That is Attractor's
own attribute for it, so the run uses those models as they stand and your provider has to
serve them. A node attribute outranks a graph-level `model_stylesheet`, so edit the line to
run a node on something else, and delete the attribute to hand the choice back to your own
configuration.

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

6 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this factory from, and writing the documents is yours to do.

```
ticket        skills/event-intake.md
classify      skills/intent-router.md
autoresolve   skills/resolution-composer.md
kb            skills/runbook-resolver.md
qa            skills/blast-radius-check.md
send          skills/runbook-executor.md
```

Nothing here needs them to run. Every node in `factory.dot` carries its card's `spec` inline
as the prompt its agent receives, so a runner given this folder and nothing else has the whole
instruction for every node. A skill document adds a capability to one agent; what the
blueprint decides is who is wired to whom.

## The nodes

| node | card | phase |
| --- | --- | --- |
| `ticket` | `event-intake@1.0.0` | none declared |
| `classify` | `intent-router@2.0.0` | none declared |
| `autoresolve` | `resolution-composer@1.0.0` | implementation |
| `kb` | `runbook-resolver@1.0.0` | none declared |
| `qa` | `blast-radius-check@1.0.0` | testing |
| `send` | `runbook-executor@1.0.0` | deployment |
| `escalate` | `confidence-escalation@1.0.0` | none declared |

## What DarkPrint computed

Autonomy: Conditional.

> 6 of 7 nodes run unattended, 1 has a person in the loop — 0.8571 ≥ 0.70 → Conditional.

Where a person acts:

- `escalate` (Confidence Escalation): Let anything at or above the confidence threshold through untouched and park the rest for a person, with the full context pack attached and an SLA on the clock (type: human-gate) — a person acts here.

Security level 1.

> 4 − 2.00 (arbitrary-code-execution) − 1.00 (secret-access) − 1.00 (unvalidated-external-access) → 1

What was charged:

- Node "Runbook Executor" (send) declares the risk marker `arbitrary-code-execution` (Arbitrary code execution).
- Node "Runbook Executor" (send) declares the risk marker `secret-access` (Secret access).
- Node "Blast Radius Check" (qa) reaches outside the graph (tool "http-fetch") and hands its output straight to "escalate" and "send" with no validation node in between.

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

Exported from https://darkprint.io/blueprints/incident-commander
