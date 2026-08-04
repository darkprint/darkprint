# Frontline Triage

Classifies inbound tickets, auto-resolves the simple ones with a KB lookup, QAs its own reply, and escalates only when confidence drops.

```
blueprint      frontline-triage
bundle digest  sha256:b0d2a966deafbacbad41714f4eff55cbb030e8ad09d0e5344362a8b8b25726fa
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

2 of the 7 nodes name the model they run on, and carry it as `llm_model`. That is Attractor's
own attribute for it, so the run uses those models as they stand and your provider has to
serve them. A node attribute outranks a graph-level `model_stylesheet`, so edit the line to
run a node on something else, and delete the attribute to hand the choice back to your own
configuration.

## What is in the folder

```
factory.dot                the pipeline Attractor runs, each card's spec inlined as a prompt
blueprint.dot              the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/                     the pinned cards, byte for byte as the registry stores them
ontology/extensions.yaml   the local terms these cards declare, and the weights that price them
README.md                  this file
AGENTS.md                  the same folder addressed to an agent adapting it, generated from the cards
```

Two DOT files, because they answer different questions. `blueprint.dot` is what the registry
stores and scores. `factory.dot` is that same graph prepared for a runner: a synthesised
`__start` and `__exit` node, and the prompts inlined. Delete those two nodes and their edges
and you are back to the topology.

6 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this blueprint from, and writing the documents is yours to do.

```
ticket        skills/event-intake.md
classify      skills/intent-router.md
autoresolve   skills/resolution-composer.md
kb            skills/kb-resolver.md
qa            skills/reply-qa-check.md
send          skills/reply-dispatch.md
```

Nothing here needs them to run. Every node in `factory.dot` carries its card's `spec` inline
as the prompt its agent receives, so a runner given this folder and nothing else has the whole
instruction for every node. A skill document adds a capability to one agent; what the
blueprint decides is who is wired to whom.

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

Autonomy: Conditional.

> 6 of 7 nodes run unattended, 1 has a person in the loop. 0.8571 ≥ 0.70 → Conditional.

Where a person acts:

- `escalate` (Confidence Escalation): Let anything at or above the confidence threshold through untouched and park the rest for a person, with the full context pack attached and an SLA on the clock (type: human-gate). A person acts here.

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

Exported from https://darkprint.io/blueprints/frontline-triage
