# Architecture

The structural reference for DarkPrint: what the pieces are, how they fit, and where the
truth actually lives.

*Written 2026-07-29 at commit `340931e`.* For the vision, the current state and the next
steps, see [`../PROJECT.md`](../PROJECT.md).

| document | subject |
|---|---|
| [`website.md`](./website.md) | every route, what it is for, and what moved where |
| [`blueprint.md`](./blueprint.md) | what a blueprint is: the DOT, the manifest, the bundle |
| [`node-card.md`](./node-card.md) | what a node is: every field on a card and what checks it |
| [`ontology.md`](./ontology.md) | the controlled vocabulary, v0.1.0, all 54 terms |
| [`engine.md`](./engine.md) | the analysis pipeline, the diagnostics, the tunable numbers |

---

## How to use these documents

**Every fact here is derived from code, and every section names the file it came from.**
When the two disagree, the code is right and the document is stale — fix the document.

These are not specifications. The specifications are in `files/` (doc 1 design, doc 2
onboarding and positioning, doc 3 ontology v0.1), and the code cites them by section
throughout. These documents describe **what was built**, so that a change can be made without
re-deriving the whole system first.

## Keeping them consistent

The reason this folder exists is that the project has three layers that must agree, and a
change to any one of them silently invalidates the others:

```
        the ontology            the vocabulary the other two draw from
             │
      ┌──────┴──────┐
   the card      the DOT        one node's contract  /  which nodes exist and what flows
      └──────┬──────┘
          the bundle            what a reader downloads and Attractor runs
```

Before changing any of them, check the table in the relevant document under **"What breaks if
you change this"**. Each one lists the specific things that go stale.

Two mechanical rules that already hold and are worth not breaking:

1. **The ontology version is part of every card and every bundle.** Adding a term is a MINOR
   bump; removing or renaming one is MAJOR; moving a number in `lib/core/config.ts` is a
   PATCH, because it re-scores every blueprint that already exists.

   > **Superseded 2026-09-05 by D-131 (`docs/DECISIONS.md`), and there is no replacement
   > rule.** The vocabulary carries no version, so none of the three bumps has a number to
   > move. The half of this that survives is the *what goes stale* half: removing or
   > renaming a term still breaks every card using it, and moving a weight still moves every
   > security reading on the site. Both are in each document's own "What breaks if you change
   > this" table. Kept verbatim as the record of what was specified.
2. **Nothing in `lib/core/**` may touch the host.** No `node:fs`, `node:path`, `node:crypto`,
   no `Buffer`, no `Date.now()`, no `Math.random()`. The engine runs unchanged in the browser
   on `/upload`, and that is what lets the site validate a bundle without a server.

## The shortest path to understanding the system

Read one bundle end to end. It is five files and it contains every concept:

```
content/blueprints/starter-software-factory/   the source
public/bundles/starter-software-factory/       what a reader downloads
```

Then read `content/cards/code-builder@1.0.0.yaml`, which carries the isolation contract the
whole site argues for, and follow `cannot: [acceptance-criteria]` into
`lib/core/bundle/resolve.ts` to see it enforced.
