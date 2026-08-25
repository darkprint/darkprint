# Frontline Triage, for an agent

You are being handed a DarkPrint blueprint: a pattern for classifies inbound tickets,
auto-resolves the simple ones with a kb lookup, qas its own reply, and escalates only when
confidence drops.

Everything below is read off `topology.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `ticket`: change the payload it admits
- `ticket`: admit a record that repeats one inside the dedupe window
- `classify`: change the payload it routes
- `classify`: leave an event unrouted
- `autoresolve`: fill a gap from memory when no reference arrived
- `autoresolve`: present its draft as approved
- `kb`: edit the article it returns
- `qa`: copy a customer identifier into the score it emits
- `send`: edit a reply that has already been cleared
- `send`: report a deferral as a success
- `escalate`: decide a parked case itself

## The nodes

### `ticket` — Event Intake

Accept an inbound event from the ticket queue or the alert bus, stamp it with a correlation id, and drop anything that repeats inside the dedupe window.

type `tool`

Emits: `event`: `json`

### `classify` — Intent Router

Classify the inbound event against the label set and dispatch it down the matching lane, falling through to the default lane whenever confidence sits below the threshold.

type `decision`

Takes: `event`: `json`

Emits: `lane`: `status`, `routed`: `json`

### `autoresolve` — Resolution Composer

Draft a candidate resolution for the routed request, grounding every claim in the reference document when one was retrieved and marking the gap when it was not.

type `agent` · phase `implementation` · model `claude-sonnet-5`

Takes: `request`: `json`, `reference`: `markdown`

Emits: `draft`: `json`

### `kb` — KB Resolver

Retrieve the k nearest knowledge-base articles for the routed request and return the best match as Markdown, with its article id and last-reviewed date in the front matter.

type `tool` · tools `vector-store`

Takes: `query`: `json`

Emits: `article`: `markdown`

### `qa` — Reply QA Check

Grade the drafted reply against the tone, accuracy and completeness rubric, release it only above the confidence threshold, and emit the score the escalation path branches on.

type `validation` · phase `testing` · model `claude-sonnet-5`

Takes: `draft`: `json`

Emits: `approved`: `json`, `confidence`: `status`

### `send` — Reply Dispatch

Post the approved reply to the channel the ticket arrived on and return the provider's receipt, leaving the thread in whatever state that channel reports.

type `tool` · phase `deployment` · tools `messaging`, `http-fetch`

Takes: `approved`: `json`

Emits: `receipt`: `status`

### `escalate` — Confidence Escalation

Let anything at or above the confidence threshold through untouched and park the rest for a person, with the full context pack attached and an SLA on the clock.

type `human-gate` · tools `human-review`, `messaging` · **a person acts here**

Takes: `verdict`: `status`, `context`: `json`

Emits: `escalated`: `json`, `accepted`: `json`

## The wiring

```
ticket -> classify   json
classify -> autoresolve   json
classify -> kb   json
kb -> autoresolve   markdown
autoresolve -> qa   json
qa -> send   json
qa -> escalate   status
```

An edge that is absent is as much a part of this pattern as one that is present. Before adding
a connection the graph does not have, check it against the prohibitions above.

## What this file does not tell you

Where this pattern belongs in the codebase, what to look for before wiring it in, and when not
to use it at all. Those depend on the code, and nothing in this folder has seen it. Read the
graph, read the cards, then read the code.

`README.md` covers running the pattern as it stands, including the command and the digest that
confirms these files are the ones the registry read.
