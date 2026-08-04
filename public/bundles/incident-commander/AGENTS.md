# Incident Commander, for an agent

You are being handed a DarkPrint blueprint: a pattern for triages alerts, routes to the right
runbook, drafts a mitigation, qas it against blast-radius rules, and escalates to on-call when
risk is high.

Everything below is read off `blueprint.dot` and the cards in this folder. It describes the
pattern and nothing else: it has not seen the codebase you are about to change, and it carries
no instructions from whoever published it.

## What must never be connected

Stated by the author and checked by nothing. Read them; do not assume a tool will.

- `ticket`: change the payload it admits
- `ticket`: admit a record that repeats one inside the dedupe window
- `classify`: change the payload it routes
- `classify`: leave an alert unrouted
- `autoresolve`: fill a gap from memory when no reference arrived
- `autoresolve`: present its draft as approved
- `kb`: resolve a runbook at any revision but the one current when the incident opened
- `qa`: edit the mitigation it judges
- `qa`: clear a target it could not resolve
- `send`: run a step the mitigation does not contain
- `send`: touch a host outside the resolved target list
- `escalate`: decide a parked case itself

## The nodes

### `ticket` — Event Intake

Accept an inbound event from the ticket queue or the alert bus, stamp it with a correlation id, and drop anything that repeats inside the dedupe window.

type `tool`

Emits: `event`: `json`

### `classify` — Intent Router

Classify the inbound event against the label set — overridden by a taxonomy supplied for this run, when there is one — and dispatch it down the matching lane, sending anything below the confidence threshold to the escalation lane instead of guessing.

type `decision`

Takes: `event`: `json`, `taxonomy`: `json`

Emits: `lane`: `status`, `routed`: `json`

### `autoresolve` — Resolution Composer

Draft a candidate resolution for the routed request, grounding every claim in the reference document when one was retrieved and marking the gap when it was not.

type `agent` · phase `implementation` · model `claude-sonnet-5`

Takes: `request`: `json`, `reference`: `markdown`

Emits: `draft`: `json`

### `kb` — Runbook Resolver

Match the routed alert to a runbook in the versioned store and return it as Markdown, pinned to the revision that was current when the incident opened.

type `tool` · tools `vector-store`, `git`

Takes: `query`: `json`

Emits: `runbook`: `markdown`

### `qa` — Blast Radius Check

Expand the drafted mitigation into the concrete set of hosts and services it would touch, hold back anything wider than the declared limit, and emit the risk verdict the escalation path reads.

type `validation` · phase `testing` · model `claude-opus-5` · tools `http-fetch`

Takes: `draft`: `json`

Emits: `mitigation`: `json`, `risk`: `status`

### `send` — Runbook Executor

Run the cleared mitigation's steps against the resolved targets — dry run first, then for real — and return the command log with every exit code in order.

type `tool` · phase `deployment` · tools `shell`

Takes: `mitigation`: `json`

Emits: `execution_log`: `report`

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
