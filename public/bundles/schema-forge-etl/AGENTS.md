# Schema Forge ETL, for an agent

You are being handed a DarkPrint blueprint: a pattern for extracts, normalizes and
schema-validates messy documents, repairing anything that fails validation before it ever
reaches the store.

Everything below is read off `blueprint.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `raw`: emit the same document in two batches
- `extract`: paraphrase a value it copies
- `extract`: invent a field the document does not state
- `normalize`: invent a value to fill a gap
- `validate`: edit a record to make it conform
- `repair`: emit a partial record
- `repair`: blank a field out to clear a violation
- `store`: skip past a batch that failed to commit
- `publish`: announce a version it has not cut
- `publish`: announce the same version twice

## The nodes

### `raw` — Document Intake

Open the run on a batch of unstructured source documents, stamp each one with its origin and content hash, and hand the batch downstream as the unit of work everything else is keyed to.

type `tool`

Emits: `documents`: `json`

### `extract` — Field Extractor

Read each source document and pull the target fields out of it verbatim, quoting the span each value came from so a downstream reviewer can check the extraction rather than trust it.

type `agent` · phase `implementation` · model `claude-haiku-4-5`

Takes: `documents`: `json`

Emits: `fields`: `json`

### `normalize` — Field Normalizer

Coerce the extracted fields onto the target shape, units, dates, casing, null spellings, and emit one canonical record per input row, re-folding anything the repair pass has sent back.

type `agent` · phase `implementation` · model `claude-haiku-4-5`

Takes: `fields`: `structured`, `repaired`: `json`

Emits: `record`: `json`

### `validate` — Schema Gate

Check the candidate record against the registered schema plus any assertions attached for this run, pass only what clears both, and emit the violation list for the rest.

type `validation` · phase `testing` · model `claude-haiku-4-5`

Takes: `candidate`: `json`, `assertions`: `json`

Emits: `accepted`: `json`, `violations`: `json`

### `repair` — Record Repairer

Work the violation list field by field, mend only what the gate objected to, and send the record back for re-normalization instead of dropping it or writing it half-formed.

type `agent` · phase `debugging` · model `claude-sonnet-5`

Takes: `violations`: `json`, `record`: `json`

Emits: `repaired`: `json`

### `store` — Record Store

Upsert the accepted records into the target store in batches keyed on the upsert key, and return the commit receipt, row counts, keys written, and the batch the run can resume from.

type `tool` · phase `deployment` · tools `sql`

Takes: `records`: `json`

Emits: `stored`: `json`

### `publish` — Dataset Publisher

Cut the committed batch into a dataset version, announce it on the release channel with its row count and schema reference, and close the run.

type `tool` · phase `deployment` · tools `messaging`

Takes: `dataset`: `json`

## The wiring

```
raw -> extract   json
extract -> normalize   json
normalize -> validate   json
validate -> repair   json
repair -> normalize   json
validate -> store   json
store -> publish   json
```

An edge that is absent is as much a part of this pattern as one that is present. Before adding
a connection the graph does not have, check it against the prohibitions above.

## What this file does not tell you

Where this pattern belongs in the codebase, what to look for before wiring it in, and when not
to use it at all. Those depend on the code, and nothing in this folder has seen it. Read the
graph, read the cards, then read the code.

`README.md` covers running the pattern as it stands, including the command and the digest that
confirms these files are the ones the registry read.
