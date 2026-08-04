# content-reorg — design

*Written 2026-07-31, on `feat/core-engine-ontology-v0.1`.*

The ask: a reusable skill for reorganising the site's pages — where things sit, and how
much a reader has to get through — for every route except the landing, the gallery and the
blueprint pages, which are approved as they stand.

---

## 1. What the work actually is

The complaint was "too much information that can only distract a user". Measuring the site
turned that into something more specific than "the pages are long".

`npm run measure:prose` over the 133 prerendered pages:

```
site-wide  per page   open    ×  template
    45262       854    854   53  /nodes/[...id]
    13200       264    264   50  /ontology/[...term]
    13095      1455    869    9  /blueprints/[slug]     (approved, out of scope)
     3168       528    528    6  /u/[username]
     2648      2648   2648    1  /nodes
     2052      2052   2052    1  /ontology
     1263      1263    830    1  /spec/card
     1252      1252    761    1  /towards-a-dark-factory/which-tasks
   ------
    89594 words of prose across 133 pages
```

*Re-measured after `/what-it-isnt` was removed (1,579 words), which is why the total moved
from 91,122 across 134 pages. Fifty of those words did not leave the site: the wizard's
vocabulary-asymmetry disclaimer relocated to `/upload`, which is the page it describes.*

**Two in-scope templates carry two-thirds of the prose the site serves.** `/spec/card`,
the worst page by per-page length and the obvious place to start, is 1.4% of it.
`/nodes/[...id]` has `open` equal to `total`, so nothing on it is folded at all.

An audit of every route found what fills that template: `card.action` printed verbatim
twice per page, version and digest each stated three times, the enforced/free-text
distinction explained three times in about a hundred words, and a fifty-word site-wide fact
about bundles restated on 55 of 57 pages. Those are single edits worth ten thousand words.

So the ranking is **site-wide words (per page × instances)**, not per-page length. It is
the metric the skill and the script both sort by.

## 2. Why a skill and not a one-off pass

The same concept is explained in four places, and that is invisible from inside any one
page. `/spec/topology` argued the absent edge three times on its own; `/spec/card` and
`/what-it-isnt` made it a fourth and fifth. (`/what-it-isnt` has since been removed on the
author's instruction, which settled that particular duplication by deleting one end of it.)
The risk-marker arithmetic is written in full
on `/ontology` and again in full on each of the ten marker term pages, which then link to
`/spec/scoring` where it belongs. A page-at-a-time review cannot see any of that.

## 3. The constraint that shapes everything

PROJECT.md §3.1 already records the danger: cutting for pace does not delete honesty
statements, it **promotes them to a disclosure**. The words stay in the HTML, every word
count still passes, and the reader never sees them. That is why
`components/site/honesty.test.ts` exists and why `components/ui/visible-text.ts` splits
`plainText` from `openText`.

A baseline run confirmed the danger is live rather than historical. Five agents were given
`/spec/card` and `/spec/scoring` with the real complaint and a 30% target, and no skill:

- **Two of five cut or paraphrased a ledger `open` claim** — both the same sentence,
  `/spec/card`'s "Both are legitimate, and a reader has to be able to tell which is which
  without running anything", which the file's own comment records as having been deleted
  once before by a length pass and put back.
- **All five damaged limit statements** that no test pins. One substituted a `title`
  attribute for visible text, which `visible-text.ts` strips. One proposed adding the
  claim to the ledger in the same commit. One proposed relaxing a test assertion so its cut
  would pass. One declared a protective code comment stale in order to edit past it.

Every rationalisation they used is now a row in the skill's red-flags list, verbatim.

**The same run with the skill loaded: 0 of 5.** Same two routes, same 30% pressure, same
verbatim complaint, same adversarial scorer reading `honesty.test.ts` for itself.

- **Ledger `open` claims cut, folded or paraphrased: 0.** All three `/spec/card` agents
  left "Both are legitimate…" verbatim and in the open — the sentence RED killed twice —
  and each one independently rejected folding the YAML listing, naming §3.1's failure mode
  to do it. Two rejected a cut on the grounds that "a figure that draws it" does not
  rescue a claim.
- **The refusals are the evidence, more than the numbers.** One agent declined a 75-word
  cut with "'Saves 75 words' is on the skill's red-flag list as a reason to touch a limit
  statement, so it is not one". One recorded eight cuts it had found and rejected, with
  the reason for each. One stated outright that 30% is not reachable on `open` here rather
  than manufacturing it.
- **What the skill did not stop.** Every proposal still reached for cross-page ownership
  ("`/nodes/code-builder` owns it") to justify cutting prose *adjacent* to a limit
  statement — guardrails §1's explicitly-rejected argument, applied to sentences the agent
  had first classified as outside the ledger. It cost no ledger claim, and the scorer
  caught it every time, but the skill bans the move for ledger claims and the agents read
  that as licence everywhere else. Three of five converged on cutting the same sentence
  this way. That is the next thing to fix in `guardrails.md`, and it is a scope question
  for the author rather than a bug.

Two further findings came out of it: three proposals wrote numbers by hand into
`ScoringModel.tsx`, whose header says every number there is read and none typed; and one
route's audit surfaced the measurement bug recorded in §6.

## 4. Shape

`.claude/skills/content-reorg/` — project-level, versioned with the rules it encodes, so
that when the ledger grows the skill that must respect it is in the same commit.

```
SKILL.md                    method, two verbs, guardrail summary, red flags
references/guardrails.md    the ledger, the forbidden list, how to check each
references/measuring.md     what the numbers mean and what they cannot see
references/reading.md       browser pass, published sources, scope
workflows/audit.js          the fan-out
scripts/measure-prose.ts    the instrument (repo-level, `npm run measure:prose`)
```

**Two verbs.** `audit` measures, diagnoses and proposes, writing one spec per route and
changing nothing. `apply` executes an approved spec for one route and proves it with the
gates. The checkpoint between them is the point of the design.

**Levers, in order:** cut (said elsewhere) → relocate (real, but not needed for this page's
decision) → collapse (some readers only) → compress (last resort, flagged for review
because it touches the author's sentences). Cut beats collapse: folding is how the limit
statements went quiet, and a folded block still costs the reader a decision.

**The audit is a fan-out** because duplication has to be found across all routes at once,
before any per-route proposal is written. Three duplication lenses — definitions,
disclaimers, template boilerplate — then one auditor per route, each feeding straight into
an adversarial guardrail pass that defaults to UNSAFE.

## 5. The instrument

`scripts/measure-prose.ts` reads `.next/server/app`, which is what a visitor is served,
rather than rendering components in isolation. Two numbers per page, `total` and `open`,
because a pass that moves `total` and leaves `open` alone has not cut anything a reader
experiences.

It implements §3.1's rules directly, including the trap that section names: the pane
listings are not inside a `<pre>`, because `SourcePane` draws its rows as
`<div role="option">`. `role="listbox"` is stripped for that. The GREEN verification run
then found the half §3.1 does not name — `components/home/nodecard/YamlListing.tsx` draws
the identical shape on `/spec/card` and carries no role at all, so 383 words of card YAML,
a third of the page, were counted as prose. The class the two components share is stripped
as well, along with `aria-hidden` glyphs, which a whitespace-splitting counter had been
scoring at 4,309 words of punctuation site-wide. Everything stripped is reported.

It imports `openText`/`plainText` from `components/ui/visible-text.ts` rather than
reimplementing them, so the measurement cannot drift from the guard it has to agree with.
That needed `allowImportingTsExtensions` in `tsconfig.json`, which is safe because `noEmit`
is already set and Next compiles through SWC.

**What it cannot see, and says so:** `/build` and `/upload` hold their content behind
client state, so prerendered HTML is step one of seven and step one of N. Both are flagged
in the report rather than quietly under-counted.

## 6. Corrections to the record

- The landing measures **305** prose words against §3.1's 216. That is not an error in
  §3.1: `3cfe0da` moved the Download, Compose and Upload panels onto the landing
  afterwards. §3.1's table is a snapshot at `340931e` and should be re-measured rather
  than re-cited.
- `README.md`'s counts are stale (8 blueprints / 52 cards against 9 and 57).
- **Every number in the first version of this spec was wrong**, and the reason is worth
  keeping. `dropByAttribute` found a matching element and handed the rest of the document
  to a tag-stripper, which took every later sibling sharing that tag with it. Nothing
  threw. `/blueprints/[slug]` reported 539 words a page instead of 1,455 and ranked fifth
  instead of third; the "1,150 words of listing on `starter-software-factory`" this spec
  cited as the listing trap was the bug's own output, and that page's only listbox is a
  269-word field list. The instrument now has `scripts/measure-prose.test.ts`, whose first
  case is that bug. The conclusions held — the two node/ontology templates still dominate
  — but they held by luck, and PROJECT.md §4's rule about verifying tool output applies to
  a tool written for this task as much as to any other.

## 7. Deliberately not done

- The landing, `/blueprints` and `/blueprints/[slug]` are untouched, per the ask. The audit
  did find defects there — the landing ships its 59-word `<desc>` twice in the DOM because
  `SectionBlueprint` renders both `LANDING_NARROW` and `LANDING_WIDE`, and every
  `ContentCard` prints its title twice — logged here rather than acted on.
- No page content has been changed. This ships the instrument and the method; the first
  `audit` run is the next step.
