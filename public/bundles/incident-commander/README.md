# Incident Commander

Triages alerts, routes to the right runbook, drafts a mitigation, QAs it against blast-radius rules, and escalates to on-call when risk is high.

```
blueprint      incident-commander
bundle digest  sha256:3d4f8283a30709ab26ea45e6007e35dcc03a7939fb7dcc29345d8187ad48904f
ontology       v0.1.0
nodes          7
cards pinned   7
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

2 of the 7 nodes name the model they run on, in their card's own `model` field. Read it off
`cards/<ref>.yaml`; whether your harness honours it is yours to decide.

## What is in the folder

```
topology.dot   the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/         the pinned cards, byte for byte as the registry stores them
README.md      this file
```

6 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this blueprint from, and writing the documents is yours to do.

```
ticket        skills/event-intake.md
classify      skills/intent-router.md
autoresolve   skills/resolution-composer.md
kb            skills/runbook-resolver.md
qa            skills/blast-radius-check.md
send          skills/runbook-executor.md
```

Nothing here needs them to run. Every card carries its own `spec` inline, which is the whole
instruction for that node whatever harness compiles this topology into a running pipeline. A
skill document adds a capability to one agent; what the blueprint decides is who is wired to
whom.

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

Autonomy: Supervised.

> 6 of 7 nodes run unattended, 1 has a person in the loop. 2 of 3 control points run unattended. 0.6667 ≥ 0.50 → Supervised.

Where a person acts:

- `escalate` (Confidence Escalation): Let anything at or above the confidence threshold through untouched and park the rest for a person, with the full context pack attached and an SLA on the clock (type: human-gate). A person acts here.

Security level 1.

> 4 − 2.00 (arbitrary-code-execution) − 1.00 (secret-access) − 1.00 (unvalidated-external-access) → 1

What was charged:

- Node "Runbook Executor" (send) declares the risk marker `arbitrary-code-execution` (Arbitrary code execution).
- Node "Runbook Executor" (send) declares the risk marker `secret-access` (Secret access).
- Node "Blast Radius Check" (qa) reaches outside the graph (tool "http-fetch") and hands its output straight to "escalate" and "send" with no validation node in between.

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

Exported from https://darkprint.io/blueprints/incident-commander
