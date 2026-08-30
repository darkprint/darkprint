# Grounded Research Desk

Fans a question across web, vector and code search, synthesizes one answer, and loops back through a fact-checker until every claim is grounded.

```
blueprint      grounded-research-desk
bundle digest  sha256:de8b1c0d1d19d1b17e17787ea567495cf41e5a39f1f8c6c3b07085503a607b00
ontology       v0.1.0
nodes          8
cards pinned   8
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

3 of the 8 nodes name the model they run on, in their card's own `model` field. Read it off
`cards/<ref>.yaml`; whether your harness honours it is yours to decide.

## What is in the folder

```
topology.dot   the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/         the pinned cards, byte for byte as the registry stores them
README.md      this file
```

8 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this blueprint from, and writing the documents is yours to do.

```
question    skills/question-intake.md
plan        skills/retrieval-planner.md
web         skills/web-retriever.md
vectors     skills/vector-recall.md
code        skills/code-index-search.md
synth       skills/evidence-synthesizer.md
factcheck   skills/claim-verifier.md
report      skills/report-delivery.md
```

Nothing here needs them to run. Every card carries its own `spec` inline, which is the whole
instruction for that node whatever harness compiles this topology into a running pipeline. A
skill document adds a capability to one agent; what the blueprint decides is who is wired to
whom.

## The nodes

| node | card | phase |
| --- | --- | --- |
| `question` | `question-intake@1.0.0` | none declared |
| `plan` | `retrieval-planner@1.0.0` | planning |
| `web` | `web-retriever@1.0.0` | none declared |
| `vectors` | `vector-recall@1.0.0` | none declared |
| `code` | `code-index-search@1.0.0` | none declared |
| `synth` | `evidence-synthesizer@1.0.0` | implementation, debugging |
| `factcheck` | `claim-verifier@1.0.0` | testing |
| `report` | `report-delivery@1.0.0` | deployment |

## What DarkPrint computed

Autonomy: Closed-loop.

> 8 of 8 nodes run unattended, none have a person in the loop. The graph declares 1 control point, which is one reading rather than a share. 1.00 > 0.90 → Closed-loop.

Security level 2.

> 4 − 1.50 (irreversible-action) − 1.00 (unvalidated-external-access) → 2

What was charged:

- Node "Report Delivery" (report) declares the risk marker `irreversible-action` (Irreversible action).
- Node "Web Retriever" (web) reaches outside the graph (tool "web-search", tool "http-fetch") and hands its output straight to "synth" with no validation node in between.

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

Exported from https://darkprint.io/blueprints/grounded-research-desk
