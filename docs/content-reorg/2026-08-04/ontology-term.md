# `/ontology/[...term]` — audit

*2026-08-04. Measured against the build at `68b4402`.*

## 1. Measured baseline

`/ontology/arbitrary-code-execution`, a risk-marker page (the longest kind):

```
  341 prose words, 341 readable without opening a disclosure

    total    open  section
       10      10  (before the first heading)
       18      18  Arbitrary code execution
       46      46  Where it sits
      154     154  What it costs
       19      19  Who uses it
       17      17  Term
       77      77  Adoption
```

**Site-wide: 13,200 words across 50 pages, 264 a page.** Second-largest template.

## 2. Diagnosis

**No within-page duplication anywhere.** Scanning all 50 rendered pages for a repeated
block of six words or more returns **zero**. Whatever makes this template large, it is not
a page repeating itself.

**Cross-page boilerplate: 4,577 words, and almost none of it is cuttable.**

| Words | Pages | Site-wide | Text |
|---|---|---|---|
| 69 | 49 | **3,381** | "These are the three figures the first phase of promotion watches for… The counting works; the workflow that would read it does not exist, no threshold has been calibrated, and no term has ever been promoted…" |
| 21 | 44 | 924 | "Read left to right as 'is a kind of', backwards. A rule written about any term in this chain also catches `<term>`." |
| 8 | 34 | 272 | "— it is a leaf of its branch." |

## 3. Proposed outline

Unchanged.

## 4. Edits

**None.** Every candidate fails a guardrail or fails on its merits, and the reasons matter
more than the absence:

**The 3,381-word block is a limit statement.** *"The counting works; the workflow that
would read it does not exist, no threshold has been calibrated, and no term has ever been
promoted."* That is guardrails §2 outright: a sentence saying a thing is not built. It
qualifies the three figures printed immediately above it — Cards, Blueprints, Distinct
authors — which without it read as inputs to a process that runs.

§2's rule is explicit: *"These qualify something printed beside them. Moving the qualifier
away from the qualified thing is the same defect as folding it, whatever the word count
says."* So it may not be relocated to `/spec/ontology`, may not go behind a `More`, and may
not be shortened to reach a number. "Saves 3,381 words" is on the skill's own red-flag list
as a reason to touch a limit statement, so it is not one.

**The 924-word chain legend is short and load-bearing.** Each term page is linked directly
from every card that declares the term, so any of the 50 can be a reader's first arrival.
Cutting the legend leaves the broader chain unexplained for exactly that reader. Compressing
it is the `compress` lever, which this skill flags for the author rather than deciding.

**The 272-word leaf sentence is an empty state**, not padding. "Nothing specialises X" with
nothing after it reads as a missing panel.

## 5. Guardrail check

| Guardrail | Status |
|---|---|
| Honesty ledger | No entry names this surface. |
| Limit statements (§2) | **One, and it is the largest block on the template.** Untouched, verbatim, in the open, beside the figures it qualifies. It is the reason this audit proposes nothing. |
| Autonomy copy (§3) | Not touched; no edit proposed. |
| Em-dash rule (§4) | No new copy written. |
| Structural (§5) | Nothing moved. |

## 6. Target

**Unchanged: 264 words a page, 13,200 site-wide.**

The template is not bloated. It is 50 short, mostly tabular pages, and the one large block
they share is the sentence that stops three counters reading as a live promotion pipeline.
A pass that cut it would have shown a 3,381-word win and taken a not-built statement off 49
pages to get it.
