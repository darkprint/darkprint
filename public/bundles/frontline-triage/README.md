# Frontline Triage

Classifies inbound tickets, auto-resolves the simple ones with a KB lookup, QAs its own reply, and escalates only when confidence drops.

```
blueprint      frontline-triage
bundle digest  sha256:f1113c0695b0e456b77c46b2d849d5459d9926e24f3800532f2c3d94c2a0da9a
ontology       v0.1.0
nodes          7
cards pinned   7
local terms    lupo/pii-handling
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
factory.dot                the pipeline Attractor runs, each card's spec inlined as a prompt
blueprint.dot              the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/                     the pinned cards, byte for byte as the registry stores them
ontology/extensions.yaml   the local terms these cards declare, and the weights that price them
README.md                  this file
```

Two DOT files, because they answer different questions. `blueprint.dot` is what the registry
stores and scores. `factory.dot` is that same graph prepared for a runner: a synthesised
`__start` and `__exit` node, and the prompts inlined. Delete those two nodes and their edges
and you are back to the topology.

## The nodes

| node | card | phase |
| --- | --- | --- |
| `ticket` | `event-intake@1.0.0` | none declared |
| `classify` | `intent-router@1.0.0` | none declared |
| `autoresolve` | `resolution-composer@1.0.0` | implementation |
| `kb` | `kb-resolver@1.0.0` | none declared |
| `qa` | `reply-qa-check@1.0.0` | testing |
| `send` | `reply-dispatch@1.0.0` | deployment |
| `escalate` | `confidence-escalation@1.0.0` | none declared |

## What DarkPrint computed

Autonomy level 3.

> 6 of 7 nodes run unattended, 1 has a person in the loop — 0.8571 ≥ 0.70 → level 3 (Conditional).

Where a person acts:

- `escalate` (Confidence Escalation): Let anything at or above the confidence threshold through untouched and park the rest for a person, with the full context pack attached and an SLA on the clock (type: human-gate) — a person acts here.

Security level 2.

> 4 − 1.50 (irreversible-action) − 0.50 (lupo/pii-handling) → 2

What was charged:

- Node "Reply Dispatch" (send) declares the risk marker `irreversible-action` (Irreversible action).
- Node "Reply QA Check" (qa) declares the risk marker `lupo/pii-handling` (PII handling).
- Node "Reply Dispatch" (send) declares the risk marker `lupo/pii-handling` (PII handling).

Both were read against ontology v0.1.0 and the local terms these cards declare:
`lupo/pii-handling`. Their definitions and the weights that price them are in
`ontology/extensions.yaml`, in this folder. Score the folder without that file and those ids
resolve against nothing, the cards carrying them are rejected with them, and both numbers
move.

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

Exported from https://darkprint.io/blueprints/frontline-triage
