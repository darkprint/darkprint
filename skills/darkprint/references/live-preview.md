# The live preview

An optional window on the interview. When the author opts in, the blueprint-writing skill
posts the draft to darkprint.io after every phase, and the page at
`https://www.darkprint.io/tutorial/live/<token>` draws the graph as it takes shape, in the
same panel a published blueprint page uses. The site runs nothing: it keeps the last draft it
received and shows it. Every field below is transcribed from `lib/core/tutorial/live.ts`, the
one contract the skill, the routes and the page share.

## The three endpoints

| call | body | answers |
|---|---|---|
| `POST https://www.darkprint.io/api/tutorial/live` | `{}` | `{ token, url, expiresAt }` |
| `GET https://www.darkprint.io/api/tutorial/live/<token>` | none | `{ token, revision, updatedAt, expiresAt, draft }`, with `ETag: "<revision>"` and a 304 on `If-None-Match` |
| `PUT https://www.darkprint.io/api/tutorial/live/<token>` | a `LiveDraft` | `{ revision, updatedAt, expiresAt }` |

The token is 32 URL-safe characters, `[A-Za-z0-9_-]{32}`, and anything else is refused
before the store is asked. A page lives 24 hours from the moment it was opened, and every
accepted PUT refreshes that. The contract caps one draft at 512 KiB of JSON. A 400 names the
field that is wrong in one sentence; fix the payload and send again. The page polls the GET
itself, so the skill never calls it.

Open once, and keep the token in the shell:

```
curl -fsS -X POST https://www.darkprint.io/api/tutorial/live \
  -H "content-type: application/json" --data '{}'
export DARKPRINT_LIVE_TOKEN=<the token from the answer>
```

When the author arrived with the URL already, `DARKPRINT_LIVE_TOKEN` is its last path segment
and the POST is skipped. Then, at each boundary, the JSON goes on stdin, so nothing is written
to disk before the author has said yes to the files:

```
curl -fsS -X PUT "https://www.darkprint.io/api/tutorial/live/$DARKPRINT_LIVE_TOKEN" \
  -H "content-type: application/json" --data-binary @- <<'JSON'
{ "phase": "nodes", "task": "...", "bundle": { "manifest": { ... }, "dot": "...", "cardFiles": { ... } }, "ledger": { ... } }
JSON
```

A failed PUT, whether the network is down or the answer is a 400, is one line to the author,
and the interview goes on. The folder is the deliverable; the page is a window on it.

## `LiveDraft`, field by field

| field | required | what |
|---|---|---|
| `phase` | yes | one of `need`, `reuse`, `nodes`, `ports`, `guards`, `risk`, `written`, `enriched`, `published` |
| `task` | no | the author's one-sentence answer to Q0.1 |
| `bundle.manifest` | yes | `slug`, `title`, `summary` as strings and `tags` as an array of strings; `description` and `category` ride along once Q5.3 derives them |
| `bundle.dot` | yes | the DOT so far; `""` before any node has a name |
| `bundle.cardFiles` | yes | an object keyed `cards/<id>@<version>.yaml` whose values are the YAML text; `{}` before any card is drafted |
| `ledger` | no | `settled`, `open`, `blocked`: the three lists of posture rule 4, each an array of strings |
| `hits` | no | every registry hit considered, each `{ kind, ref, title, score }`: `kind` is `blueprint` or `card`, `ref` is `owner/slug` or `id@version`, `score` is the search module's own number |
| `publishedRef` | no | `owner/slug` once the author has published, so the page can link to it |

`hits` comes straight off the search answer. A blueprint hit already carries `ref`, `title`
and `score`; a card hit carries `name` where the draft wants `title`, so copy `name` into it.
Send every hit shown to the author, including the ones recommended against; the page is
meant to show the search happening.

**Before Q5.3 has derived the manifest**, send provisional values, because the PUT refuses a
draft without them: `title` is Q0.1 as a title, `summary` is the Q0.1 sentence, `slug` is the
title in card-id grammar (`^[a-z0-9]+(-[a-z0-9]+)*$`), `tags` is `[]`. Replace them with the
derived ones at `risk`.

**The bundle may be partial.** The PUT checks the shape of the JSON and nothing else: a draft
that `darkprint validate` would refuse with `bundle/port-mismatch` is still accepted, and the
page draws what the engine can resolve and lists the rest as still to settle. Send the DOT as
soon as the nodes have names, and each card as soon as it exists in memory. The files on the
author's disk are written when SKILL.md says and not before; the draft is a copy of what is
settled so far, never a copy of the folder.

## The phases, and when to send each

| `phase` | send it | the page's label, and what the draft carries by then |
|---|---|---|
| `need` | after Q0.6, before searching | "The need": the task sentence and no graph yet |
| `reuse` | after Phase 1, whether or not anything fit | "Reuse before drawing": the hits considered, with their scores |
| `nodes` | after Phase 2, once the split is agreed | "The nodes": a DOT with named nodes and no edges |
| `ports` | after Q3.6, when the ledger closes | "Ports and edges": the derived edges, and the ports still unmatched in `ledger.open` |
| `guards` | after Q4.7 | "Isolation and guards": the `cannot` entries and the condition on every fork |
| `risk` | after the show-back, before writing | "Risk and identity": the manifest as derived, the risk markers, the names |
| `written` | after the files are written and validated | "Folder written": the whole bundle, as it sits on disk |
| `enriched` | after an enrich merge | "Enriched from the registry": the grown graph, and the hits that fed it |
| `published` | after the author publishes, with `publishedRef` | "Published to an account": a link to the blueprint's page |

The quoted words are `LIVE_PHASE_LABELS` from the contract, the heading the page prints for
each phase. What follows each is what the draft carries at that point; the page draws
whatever of it resolves, and a draft sent twice under the same phase replaces the earlier one.
