# Schema Forge ETL

Extracts, normalizes and schema-validates messy documents, repairing anything that fails validation before it ever reaches the store.

```
blueprint      schema-forge-etl
bundle digest  sha256:64f0945937832de62684f905ed3f35aec7a6d21f6e11105dde839e6006a4ab0d
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
| `raw` | `document-intake@1.0.0` | none declared |
| `extract` | `field-extractor@1.0.0` | implementation |
| `normalize` | `field-normalizer@1.0.0` | implementation |
| `validate` | `schema-gate@1.1.0` | testing |
| `repair` | `record-repairer@1.0.0` | debugging |
| `store` | `record-store@1.0.0` | deployment |
| `publish` | `dataset-publisher@1.0.0` | deployment |

## What DarkPrint computed

Autonomy level 4.

> 7 of 7 nodes run unattended, none have a person in the loop — 1.00 > 0.90 → level 4 (Closed-loop).

Security level 1.

> 4 − 1.50 (irreversible-action) − 1.00 (unchecked-write) − 1.00 (unvalidated-external-access) → 1

What was charged:

- Node "Dataset Publisher" (publish) declares the risk marker `irreversible-action` (Irreversible action).
- Node "Record Store" (store) declares the risk marker `unchecked-write` (Unchecked write).
- Node "Record Store" (store) reaches outside the graph (tool "sql") and hands its output straight to "publish" with no validation node in between.

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

Exported from https://darkprint.io/blueprints/schema-forge-etl
