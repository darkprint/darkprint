# Schema Forge ETL

Extracts, normalizes and schema-validates messy documents, repairing anything that fails validation before it ever reaches the store.

```
blueprint      schema-forge-etl
bundle digest  sha256:c2f47c8fc73bb64b47b1dfac531177609328da9e01c511090296d1089c94f387
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

4 of the 7 nodes name the model they run on, in their card's own `model` field. Read it off
`cards/<ref>.yaml`; whether your harness honours it is yours to decide.

## What is in the folder

```
topology.dot   the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/         the pinned cards, byte for byte as the registry stores them
README.md      this file
```

7 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this blueprint from, and writing the documents is yours to do.

```
raw         skills/document-intake.md
extract     skills/field-extractor.md
normalize   skills/field-normalizer.md
validate    skills/schema-gate.md
repair      skills/record-repairer.md
store       skills/record-store.md
publish     skills/dataset-publisher.md
```

Nothing here needs them to run. Every card carries its own `spec` inline, which is the whole
instruction for that node whatever harness compiles this topology into a running pipeline. A
skill document adds a capability to one agent; what the blueprint decides is who is wired to
whom.

## The nodes

| node | card | phase |
| --- | --- | --- |
| `raw` | `document-intake@1.0.0` | none declared |
| `extract` | `field-extractor@1.0.0` | implementation |
| `normalize` | `field-normalizer@1.0.0` | implementation |
| `validate` | `schema-gate@1.1.0` | testing |
| `repair` | `record-repairer@1.0.0` | debugging |
| `store` | `record-store@1.0.0` | deployment |
| `publish` | `dataset-publisher@1.0.0` | deployment |

## What DarkPrint computed

Autonomy: Closed-loop.

> 7 of 7 nodes run unattended, none have a person in the loop. The graph declares 1 control point, which is one reading rather than a share. 1.00 > 0.90 → Closed-loop.

Security level 1.

> 4 − 1.50 (irreversible-action) − 1.00 (unchecked-write) − 1.00 (unvalidated-external-access) → 1

What was charged:

- Node "Dataset Publisher" (publish) declares the risk marker `irreversible-action` (Irreversible action).
- Node "Record Store" (store) declares the risk marker `unchecked-write` (Unchecked write).
- Node "Record Store" (store) reaches outside the graph (tool "sql") and hands its output straight to "publish" with no validation node in between.

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

Exported from https://darkprint.io/blueprints/schema-forge-etl
