---
name: content-reorg
description: Use when a darkprint.io page feels too long, too dense, or overwhelming to read - when reorganizing where things sit on a route, cutting page length, reducing word count, deciding what to move behind a disclosure, or acting on feedback that a page distracts or discourages readers.
---

# Reorganising a darkprint page

## Overview

This site's pages are reorganised by **moving, cutting and folding blocks** — not by
rewriting sentences. The author's voice is the asset; the arrangement is the problem.

Two things make this different from a generic length pass, and both are load-bearing:

1. **Length is measured, never estimated.** `npm run measure:prose` reports the real
   numbers off the prerendered HTML. An audit that estimated every route from source put
   `/build` at 1,800 words against the 440 a visitor is served.
2. **This site has limit statements that may not go quiet.** Cutting for pace is how they
   leave. Two have gone missing from this site that way and been caught in review; in a
   baseline run of this task, agents proposed it again on the first page they were given.
   See Guardrails — it is the part of this skill that is not advice.

## The two verbs

**`audit`** — measure, diagnose, propose. Writes specs. Changes no page.
**`apply`** — execute an approved spec for one route, then prove it with the gates.

Never run `apply` on a spec the author has not approved. An audit that ends with edits
already made has removed the checkpoint the author asked for.

## Measure first, always

```bash
npm run build                       # ONCE, before any auditing. See the warning below.
npm run measure:prose               # every template, ranked site-wide
npm run measure:prose -- /spec/card # one route, section by section
```

**Build once, yourself, before fanning out.** `npm run build` writes `.next` *and*
regenerates `public/bundles`, which is checked in. Parallel agents each running a build in
the same working directory race on both. Auditing agents measure; they never build.

Two numbers come back per page and **both** matter:

- `total` — every prose word.
- `open` — what reads **without opening a disclosure**.

A pass that moves `total` and leaves `open` alone has not cut anything a reader
experiences. Read `references/measuring.md` before interpreting a run — it covers what the
script deliberately cannot see, and the listing trap that a `<pre>` filter misses.

**Rank by site-wide words, not per-page length.** A 66-word note on a template that ships
50 times is 3,300 words. The two biggest in-scope targets are templates, and `/spec/card`,
the page that looks worst by per-page length, is 1.4% of the prose served. The script's
default output is already ranked this way.

## Guardrails

**Read `references/guardrails.md` in full before proposing a single edit.** These are not
style preferences. `components/site/honesty.test.ts` and `components/build/path.test.ts`
fail the build, and the failure they exist to catch is exactly the one a length pass
produces.

The short form:

- A claim tagged **`open`** in the honesty ledger must stay readable **verbatim, outside
  any closed `<details>`**. Not paraphrased. Not summarised into a `<summary>`. Not
  replaced by a figure that "says the same thing".
- Never edit, relax, or add to a guard so that a proposed cut passes.
- A `◐ seeded` marker, a `ComingSoonBadge` sentence, and any "not built" statement stay
  where a reader meets the thing they qualify.
- Never introduce a forbidden phrasing or an autonomy ordinal (`references/guardrails.md`
  has the list).

## Choosing a lever

Apply in this order. The first that fits wins.

| The text is… | Lever | What it means here |
|---|---|---|
| said elsewhere on the site | **cut** | delete, leave a link to the place that owns it |
| real, but not needed for the decision this page exists to support | **relocate** | move to the page that owns the subject; leave one line |
| needed by some readers only | **collapse** | `components/ui/More.tsx`, subject to Guardrails |
| needed by everyone, but bloated | **compress** | last resort — it touches the author's sentences, so flag it for review rather than deciding it |

**Cut beats collapse.** Collapsing is how this site's limit statements went quiet, and a
folded block still costs the reader a decision. Reach for `More` when the content is
genuinely reference depth, not when you want a smaller number.

## What an audit produces

One file per route at `docs/content-reorg/<date>/<route>.md`, containing exactly these
parts, in this order:

1. **Measured baseline** — total and open, per section, from `measure:prose`.
2. **Diagnosis** — what makes this page hard to read, in concrete terms. Name sections and
   quote text. "Too dense" is not a diagnosis.
3. **Proposed outline** — the new section order, top to bottom.
4. **Edits** — one row per edit: the target, the lever, the verbatim text affected, and
   why. Text you cannot quote is text you have not found.
5. **Guardrail check** — every ledger claim on this surface, each marked as untouched, and
   every limit statement the edits come near.
6. **Target** — total and open after, stated as numbers.

Plus `INDEX.md` ranking routes by site-wide words at stake.

### Running it

For one or two routes, do it inline. For more, run the fan-out — duplication is found
across all routes at once, before any per-route proposal is written, because that is the
only way it is visible:

```
Workflow({
  scriptPath: '.claude/skills/content-reorg/workflows/audit.js',
  args: ['/nodes/[...id]', '/ontology/[...term]'],   // omit for the full in-scope set
})
```

Each proposal is then attacked by an adversarial guardrail pass that defaults to UNSAFE.
Write the returned specs to disk yourself; the workflow returns them, it does not save
them.

## Red flags — STOP

You are rationalising if you catch yourself writing any of these:

- "Nothing is lost — it stays in the prerendered HTML / find-in-page reaches it"
- "The claim survives elsewhere" (on another page, in a caption, in a `title` attribute,
  inside a `<summary>`, or in a figure)
- "This is a paraphrase, the substance is preserved"
- "Add it to the honesty ledger in the same commit" / "relax this assertion"
- "That protective comment is stale"
- "Saves N words" offered as the reason for touching a limit statement

**Every one of these appeared in real baseline runs on this repo, and every one of them
preceded a limit statement going quiet.** If you have written one, the edit is wrong —
find a different block to cut.

## Applying

One route at a time. Then, without exception:

```bash
npm run build && npm test && npx tsc --noEmit && npm run lint
npm run measure:prose -- <route>     # the real delta, not the predicted one
```

Report the measured before/after and the gate output. **Do not report a reduction you have
not measured, or a pass you have not run.** PROJECT.md §4 records builds reported green
while the engine was red; the claim is the command output, not your summary.

If a cut deliberately removes a limit statement, the ledger entry comes out **in the same
commit**, with the reason in the message — the repo's own rule. That is not a licence to
remove entries to make room for a cut; it is what to do when the statement itself is no
longer true.

## Reference files

- `references/measuring.md` — what the numbers mean, and what they cannot see
- `references/guardrails.md` — the ledger, the forbidden list, how to check each
- `references/reading.md` — how a reader meets a page; browser pass; published sources
