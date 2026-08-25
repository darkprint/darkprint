# Nightly Data Janitor, for an agent

You are being handed a DarkPrint blueprint: a pattern for an unattended overnight cleanup
line: extract deltas, normalize, validate against schema, and publish, repairing dirty rows in
place.

Everything below is read off `topology.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `raw`: clip the window when the watermark is older than it
- `extract`: write anything back to the warehouse
- `extract`: reshape the rows it returns
- `normalize`: invent a value to fill a gap
- `validate`: edit a record to make it conform
- `repair`: emit a partial record
- `repair`: blank a field out to clear a violation
- `store`: skip past a batch that failed to commit
- `publish`: advance the watermark before the views have refreshed

## The nodes

### `raw` — Delta Intake

Open the nightly run on the window since the last successful watermark and hand that window downstream, so a missed night widens the next run rather than losing a day.

type `tool`

Emits: `window`: `json`

### `extract` — Delta Extractor

Query the warehouse for every row changed inside the window and return them as a table, paging at the row cap so one runaway night cannot pull the whole history.

type `tool` · tools `sql`

Takes: `window`: `json`

Emits: `rows`: `table`

### `normalize` — Field Normalizer

Coerce the extracted fields onto the target shape, units, dates, casing, null spellings, and emit one canonical record per input row, re-folding anything the repair pass has sent back.

type `agent` · phase `implementation` · model `claude-haiku-4-5`

Takes: `fields`: `structured`, `repaired`: `json`

Emits: `record`: `json`

### `validate` — Schema Gate

Check the candidate record against the registered schema, pass only what conforms, and emit the violation list for everything that does not.

type `validation` · phase `testing` · model `claude-haiku-4-5`

Takes: `candidate`: `json`

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

### `publish` — Warehouse Publisher

Advance the watermark to the end of the swept window, refresh the downstream views, and post the night's counts, rows cleaned, rows repaired, rows quarantined, to the ops channel.

type `tool` · phase `deployment` · tools `messaging`

Takes: `dataset`: `json`

## The wiring

```
raw -> extract   json
extract -> normalize   table
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
