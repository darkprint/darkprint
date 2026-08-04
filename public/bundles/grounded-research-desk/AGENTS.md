# Grounded Research Desk, for an agent

You are being handed a DarkPrint blueprint: a pattern for fans a question across web, vector
and code search, synthesizes one answer, and loops back through a fact-checker until every
claim is grounded.

Everything below is read off `blueprint.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `question`: answer the question it opens the run with
- `question`: retrieve anything
- `plan`: phrase a strand in terms of what another is expected to find
- `web`: summarise or rank a page for truth
- `web`: drop a page it disbelieves
- `vectors`: write this run's own text back into the store
- `code`: check anything out of the repositories it searches
- `code`: write to the index
- `synth`: read the rule the fact-checker judges its citations by
- `synth`: assert anything the retrieved pool will not carry
- `factcheck`: edit a sentence to make it pass
- `factcheck`: supply a citation of its own
- `report`: edit the report it delivers
- `report`: publish before the reference list has arrived

## The nodes

### `question` — Question Intake

Open a research run from an inbound question, carrying the asker's scope and deadline with it so every downstream strand knows what it is allowed to go looking for.

type `tool`

Emits: `question`: `text`

### `plan` — Retrieval Planner

Split the question into at most `max_strands` retrieval strands, one per corpus, and emit each as a query plan the strand can run on its own without asking the planner anything further.

type `agent` · phase `planning` · model `claude-opus-5`

Takes: `question`: `text`

Emits: `strands`: `plan`

### `web` — Web Retriever

Run the strand's query against public search, fetch the pages worth reading, and return each one as a passage stamped with its source URL and the time it was retrieved.

type `tool` · tools `web-search`, `http-fetch`

Takes: `query`: `plan`

Emits: `passages`: `json`

### `vectors` — Vector Recall

Embed the strand's query and return the k nearest passages from the internal store, each carrying its document id and similarity score so the synthesizer can weigh how close it is.

type `tool` · tools `vector-store`

Takes: `query`: `plan`

Emits: `passages`: `json`

### `code` — Code Index Search

Search the indexed repositories for the symbols and snippets the strand names, and return each hit as a passage pinned to its file path, line range and commit.

type `tool` · tools `git`

Takes: `query`: `plan`

Emits: `passages`: `json`

### `synth` — Evidence Synthesizer

Draft a single answer from the fanned-in passages, citing the passage behind every claim, and on a return pass rewrite only the claims the fact-checker sent back as unsupported.

type `agent` · phase `implementation`, `debugging` · model `claude-opus-5`

Takes: `passages`: `json`, `gaps`: `status`

Emits: `draft`: `report`

### `factcheck` — Claim Verifier

Check every claim in the draft against the passages it cites, release only the ones that hold, and return the rest as a gap list the synthesizer can answer on another pass.

type `validation` · phase `testing` · model `claude-opus-5`

Takes: `draft`: `report`

Emits: `grounded`: `report`, `gaps`: `status`

### `report` — Report Delivery

Publish the grounded report to its reader with the citation trail intact, so every claim in it can be walked back to the passage that supports it.

type `tool` · phase `deployment`

Takes: `report`: `report`

## The wiring

```
question -> plan   text
plan -> web   plan
plan -> vectors   plan
plan -> code   plan
web -> synth   json
vectors -> synth   json
code -> synth   json
synth -> factcheck   report
factcheck -> synth   status
factcheck -> report   report
```

An edge that is absent is as much a part of this pattern as one that is present. Before adding
a connection the graph does not have, check it against the prohibitions above.

## What this file does not tell you

Where this pattern belongs in the codebase, what to look for before wiring it in, and when not
to use it at all. Those depend on the code, and nothing in this folder has seen it. Read the
graph, read the cards, then read the code.

`README.md` covers running the pattern as it stands, including the command and the digest that
confirms these files are the ones the registry read.
