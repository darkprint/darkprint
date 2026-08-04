# `/nodes/[...id]` — audit

*2026-08-04. Measured with `npm run measure:prose` against the build at `37f27ca`.*

## 1. Measured baseline

`/nodes/code-builder`, representative of the template (53 instances):

```
  971 prose words, 971 readable without opening a disclosure
  not counted: 409w <pre>, 11w aria-hidden

    total    open  section
        4       4  (before the first heading)
       48      48  Code Builder
       78      78  Interfaces
      164     164  Cannot receive
      239     239  Model, skill and servers
      281     281  Behaviour
       55      55  Version history
       46      46  Card source
       38      38  Evaluation metadata
        6       6  Used in
       12      12  Identity
```

**Site-wide: 45,262 words across 53 pages.** The largest single lever on the site.
`open` equals `total`: nothing on this template is folded at all.

## 2. Diagnosis

**One exact duplication, and only one.** Scanning the rendered page for repeated blocks of
six words or more returns a single hit:

> "Work through the build brief and emit the source it describes, adding nothing the brief
> does not ask for."

`card.action`, printed twice: `app/nodes/[...id]/page.tsx:388` as the header lead, and
again at `:670` as the first paragraph of the Behaviour panel. 19 words × 53 pages =
**1,007 words site-wide**.

**A correction to the record.** The audit run before `scripts/measure-prose.ts` was fixed
claimed this template also stated version and digest three times each, and explained the
enforced/free-text distinction three times in about a hundred words. Neither survives
measurement: the repeat scan finds no other exact duplication at all, and the
enforced/free-text explanation is three *different* sentences doing three different jobs.
Two other figures from that same audit were already found wrong by roughly 4×. Treat
anything inherited from it as unverified.

**What is left is not duplication, it is length.** 971 words with nothing folded, and the
two largest sections are Behaviour (281) and Model, skill and servers (239). Reducing those
means judging what a reader of a card page needs, which is an author's call and not a
mechanical one. It is not proposed here.

## 3. Proposed outline

Unchanged. This is a single cut, not a reorganisation.

## 4. Edits

| # | Target | Lever | Verbatim text affected | Why |
|---|---|---|---|---|
| 1 | `app/nodes/[...id]/page.tsx:670`, the Behaviour panel's first paragraph | **cut** | `{card.action}` — on `code-builder`, "Work through the build brief and emit the source it describes, adding nothing the brief does not ask for." | The identical string is the page's header lead 280 words above, where a reader meets it first. The Behaviour panel keeps everything that is only its: the phases, the agent, and the `spec` handed to the model. |

The header copy is the one kept because it is the one a reader arrives at, and because
`metadata.description` is built from the same field (`:60`), so the sentence is already
what a search result and a shared link show.

## 5. Guardrail check

| Guardrail | Status |
|---|---|
| Honesty ledger | **No entry names this surface.** `grep 'surface:' components/site/honesty.test.ts` returns nothing for `/nodes`. |
| Limit statements (§2) | One on the page: the `◐ seeded` marker beside the downloads figure, `:310`. The edit is 360 lines away and does not touch it. It stays beside the number it qualifies, which is what its own comment requires. |
| Autonomy copy (§3) | No forbidden string, no ordinal. The edit deletes and writes no copy. |
| Em-dash rule (§4) | `app/nodes/` is in `APP_EXEMPT`, and no new copy is written either way. |
| Structural (§5) | No derived count, no anchor, no `<FlowScene>` roster entry. `ssr.test.ts` does not render this route. Nothing asserts `card.action` appears twice. |

## 6. Target

**Measured after the edit**, not predicted:

```
            before   after
per page       854     825
site-wide   45,262  43,725      -1,537 words
```

`/nodes/code-builder` itself: 971 → 952 total, `open` unchanged at equal to `total`,
because nothing on this template is folded and this edit folded nothing.

**The prediction was wrong, and low.** This section first said 1,007 words, extrapolated
from `code-builder`'s 19-word action. Across all 53 cards the field averages 29 words, so
the real saving is half again as large. Extrapolating a per-page figure from one page is
the same error the skill's own `measuring.md` records about `/build`; it happens to have
erred in the site's favour here, which is luck and not a method.

Gates on the applied edit: `npm test` 3,216 pass / 72 files, `tsc --noEmit` clean,
`npm run lint` clean, build clean.
