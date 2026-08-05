---
target: the node card library index (/nodes)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-04T21-27-10Z
slug: app-nodes-page-tsx
---
Method: dual-agent (A: design review, isolated · B: detector + browser evidence, isolated)

Both ran in parallel and could not see each other. A drove the surface as a user would — typed in the search, changed all three selects, toggled both chips, switched sorts, reached the empty state, followed a tile through and pressed Back. B injected the overlay in three states: at rest, filtered to 11 of 53, and driven to zero.

Scope note: `app/nodes/page.tsx`, `components/nodes/NodeBrowser.tsx` and `components/nodes/NodeCardSummary.tsx` are all uncommitted working-tree changes, so this scores work in progress, not a shipped state.

Inspection caveat: CDP screenshots are broken on this machine; nobody saw a rendered pixel. Every number is measured off the live DOM at 2044×1200 and at a genuine 378×714 viewport.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The count strip works, but there are **zero live regions on the page** (`[aria-live],[role=status],[role=alert]` → `[]`), and the URL never changes, so the browser's own status surface is permanently wrong. |
| 2 | Match System / Real World | 4 | The best axis: "Not in a named phase" over "missing phase", lifecycle ordering, `assemble-stage@1.0.0` is exactly what a blueprint pins. |
| 3 | User Control and Freedom | 1 | Filter to `1 of 53`, open a card, press Back → `53 of 53`, all five filters gone, scroll 0. Five `useState` calls, no URL sync. |
| 4 | Consistency and Standards | 2 | Type badge, phase chip and tool pill are three semantics rendered as one visual object. Grouping exists under 1 sort of 4 with no signal it will appear. |
| 5 | Error Prevention | 1 | Both chips together = **0 results, always**. Every count in both selects is computed over `nodes`, never `results`, so the moment a second filter is on, every number in both dropdowns is wrong. |
| 6 | Recognition Rather Than Recall | 2 | The control bar is `position: static`. Once scrolled, the active filter set is invisible — 6000px up at desktop, 14000px on mobile. |
| 7 | Flexibility and Efficiency | 1 | The `/` glyph mimics press-slash-to-search with no keybinding attached. No URL params, no shareable view, no multi-select. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm grid, well-proportioned tiles. But under the default sort the type badge is pure redundancy, and six roles share 11px. |
| 9 | Error Recovery | 3 | The empty state names the specific escape ("drop the node type or the phase") and offers a reset. It does not say which filter caused it, does not move focus, and is silent to assistive tech. |
| 10 | Help and Documentation | 3 | The unphased panel is exemplary contextual help. But a comment says the vocabulary "is one click away on /ontology" and the page never links there. |
| **Total** | | **22/40** | **55% — Acceptable, significant improvements needed** |

All ten heuristics apply; none scored `n/a`.

## Design Specificity Verdict

**LLM assessment. Stock chassis, bespoke wiring.**

The composition is the default registry catalog: search left, three selects right, boolean chips below, count strip, card grid. npm, Hugging Face, the Terraform registry and the shadcn registry all ship this arrangement. Nothing about the layout says "factory with a lifecycle."

What is genuinely authored is the semantics *inside* the controls. The phase select is ordered planning→deployment while the type select is alphabetical, and the code argues about why two dropdowns in one bar obey different rules. "Not in a named phase (16)" is a first-class filter with a prose panel behind it. `phaseRank` takes the earliest declared phase and reasons about grouping versus ranking.

But those comments are almost entirely about the *data model* and almost none about the *reader's path through 53 tiles*. That asymmetry is the whole finding: the ontology got designed, the browsing did not. The clearest proof is that filter state lives nowhere but React memory — the one thing every real registry index has, a URL you can share, is the one thing this does not.

**Deterministic scan.** Static pass is **completely clean**: `[]` at exit 0 on all three target files, on their transitive imports, and across `components/site/` and `components/ui/`. No `.impeccable/config.json` exists and no `impeccable-disable` comment appears anywhere in scope, so nothing is suppressed. Proven live by a repo-wide run: exit 2, one finding, `codex-grid-background` on `.bp-grid` — the sanctioned graticule.

Browser overlay found 133 flat findings at rest, 37 filtered, 15 empty.

**Where the two agree.** No live regions in any state. The `FilterChip` at 22.5–23px against WCAG 2.2's 24px floor. The mobile page at ~20 viewport heights. Contrast passes everywhere — B evaluated all six avatar gradients against **every** colour stop and found a worst case of 5.28:1 against a 4.5 requirement.

**Where the detector caught what the review missed.** Three things. A `skipped-heading` that fires **only in the empty state**: once the five group `<h2>`s unmount, the outline collapses from `h1` straight to the footer's `h3`, because the empty panel's "No node cards match" is a `<p>`. The avatar initials at **8.64px, rendered 53 times**, not `aria-hidden` — a size finding whose weight comes entirely from repetition. And a 4px horizontal overflow at 378px traced to the sticky group heading's `-mx-1`, masked by `overflow-x: hidden`, with nothing unreachable.

**Where the review caught what no detector can see.** Every behavioural defect: the Back button destroying filter state, the facet counts that lie under any second filter, the search that does not match what it appears to match, the type badge that carries zero information in the default view.

**False positives, confirmed.** `codex-grid-background` on `.bp-grid`; `overused-font` (three families intentional); `text-occlusion` ×4 on nav links — verified directly this time rather than relayed, since the page's only `<details>` reports `{open: false}` and its seven links are not tabbable, so the detector is measuring layout boxes of a closed menu.

**One correction to the standing false-positive list.** `ai-color-palette` fires 30 times at rest, and only **5** are the sanctioned `.text-cyan` brand accent. The other **25** are "Cyan/violet gradient background" on Avatar tiles, from `avatarGradient()` — a different element from the documented exemption. They measure clean on contrast, so they are not defects, but they are not covered by the waiver either.

## Overall Impression

This page is two products. The filter *semantics* were designed by someone who thought hard about what a phase means and whether an absent one is a blank or an answer. The filter *mechanics* are whatever `useState` and `<select>` give you for free.

The single biggest opportunity is the URL. Filter state in the address bar fixes the P0, restores scroll for free, makes every filtered view linkable from `/blueprints` and `/ontology`, and is the precondition for the page ever being cited rather than merely browsed.

## What's Working

1. **The unphased affordance.** Most catalogs let you filter *to* each value and never *to the absence of one*. Sixteen of 53 cards — 30% of the library — live there and would otherwise be reachable only by scrolling past everything else. The explanatory panel renders only when that filter is active, so it costs every other reader nothing.
2. **Two lists ordered by two different rules, on purpose.** Types alphabetical, phases in lifecycle order. Planning→Deployment reads as a process; Debugging→Testing would read as noise. Recognising that two dropdowns in the same bar are different *kinds* of list is the mark of someone who looked.
3. **Honest empty-value rendering on the tile.** The footer prints "no risk markers" rather than omitting the row, and dot plus count plus word means colour is the last carrier rather than the only one. A card with no phases prints no chip rather than an empty slot. Both cost more code than the default; both make the grid scannable.

Worth recording: no `.route-box` misuse and no `text-faint` misuse on this page. The search placeholder comment shows the `--color-faint` rule was reasoned about and deliberately rejected.

## Priority Issues

### [P0] Filter state exists only in React memory; Back and reload destroy it

**What.** `NodeBrowser.tsx:94-100` — five `useState` calls, no `useSearchParams` or `router.replace`. Verified end to end: type=validation plus q="schema" gives `1 of 53`; click through to `/nodes/schema-gate`; `history.back()` returns `53 of 53`, search `""`, type `""`, scrollY 0. The URL stayed `/nodes` under every filter combination tested.

**Why it matters.** The core loop of any registry index is filter → open → back → open the next. That loop is broken. No filtered view can be bookmarked, shared, or linked to from another page. On mobile the reader pays 20 viewport heights of scrolling for state that one tap annihilates.

**Fix.** Sync all five filters plus the sort to `?q=&type=&phase=&human=&risk=&sort=` via `useSearchParams` and `router.replace(url, { scroll: false })`, hydrating initial state from the params. Scroll restoration follows for free once the URL carries the state.

**Suggested command:** `/impeccable harden`

### [P1] Both chips together is a guaranteed dead end, and facet counts lie under any second filter

**What.** Measured: human-in-the-loop alone = 2; risk marker alone = 8; **both = 0, always**. The chips carry no counts while both selects do. Separately, "Human gate (2)" plus "Planning (5)" gives 0. Every count derives from `nodes`, never from `results` (`NodeBrowser.tsx:104-146`).

**Why it matters.** A count is a promise. "Human gate (2)" reads as "two cards await me"; the reader picks it and gets an empty page. Two clicks from arrival to a guaranteed zero, with no signal at all.

**Fix.** Recompute each dimension's counts against the set filtered by all *other* dimensions; disable or grey zero-count options; put counts on the chips too.

**Suggested command:** `/impeccable harden`

### [P1] Nothing is announced, and every tile says its name twice

**What.** `[aria-live],[role=status],[role=alert]` returns `[]` in all three states. The count strip, the empty state and the unphased note all swap silently. Tile accessible text reads `"Assemble Stage | Agent | implementation | assemble-stage@1.0.0 | Assemble Stage | Assemble the transformed…"` — the `sr-only` span at `NodeCardSummary.tsx:85` plus the `<h3>`, on all 53 tiles. The control bar is a bare `<div>`; there is no `role="search"`. And in the empty state the heading outline skips from `h1` to the footer's `h3`.

**Why it matters.** A reader using a screen reader types "schema", hears nothing, and cannot tell whether the filter fired, matched one, or matched none. The empty state is entirely invisible.

**Fix.** `role="status" aria-live="polite" aria-atomic="true"` on the count strip, phrased as a sentence. Replace the `sr-only` span with `aria-labelledby` on the stretched link pointing at the `h3`'s id. Wrap the control bar in `<search>` with a label. Give the empty state an `h2` so the outline does not collapse.

**Suggested command:** `/impeccable audit`

### [P1] Mobile: 715px of controls before one card, and grouping made the page taller than the problem it fixed

**What.** At 378×714 the panel is 319×282 and the first `<article>` starts at **y=715** — one pixel past the fold, so zero cards are visible on arrival. `documentElement.scrollHeight` is **14,258px = 19.97 viewport-heights**. The Tool group alone spans y=6028→11684, 7.9 viewports in one unbroken run. The control bar is `position: static`, so changing a filter after scrolling into Tool means scrolling 6000px back. The three selects keep intrinsic widths of 147 / 226 / 133 inside a 319px column, giving a ragged three-width stack.

**Why it matters.** The comment at `NodeBrowser.tsx:203-213` states that grouping was introduced to fix *"18.5 viewport heights of undifferentiated grid on a phone."* The page now measures **20**. The intervention added real structure — grouping is one of this page's genuine strengths — and made the stated symptom worse, because it addressed the missing headings rather than the decision to render all 53 cards at every width.

**Fix.** Below `40rem`, collapse the filters into a sticky "Filter (2)" disclosure showing the active count. `w-full` on the stacked selects. Consider capping each group's initial render with a per-group "show all 24".

**Suggested command:** `/impeccable adapt`

### [P2] The type badge and the phase chip are the same object, and the badge is redundant in the default view

**What.** Measured: type badge "Agent" is bg `rgb(15,18,30)`, border `rgb(34,39,57)`, 65×23, `rounded-full`, 11px `text-muted`. Phase chip "implementation" is bg `rgb(15,18,30)`, border `rgb(34,39,57)`, 114×23, `rounded-full`, 11px `text-muted`. Identical background, border, height, radius, colour and size — separated only by a 6×6px amber dot and a font family. Meanwhile the default sort is `type`, so all 18 Agent tiles carry an "Agent" badge under a sticky heading reading Agent, and all 24 Tool tiles carry "Tool".

**Why it matters.** The tile's most prominent chip carries zero information in the default view, while the phase — which the heading does *not* state — is styled as its exact equal.

**Fix.** Pass a `showType` prop from the grouped branch and drop the badge inside type groups. Restyle the phase chip so it stops reading as the badge's sibling.

**Suggested command:** `/impeccable distill`

## Persona Red Flags

**Sam (screen reader + keyboard)** — bites hardest. Types "schema": silence, no live regions, no way to confirm the filter did anything. Drives to empty: the grid is replaced silently and `document.activeElement` stays `BODY`. **202 tab stops, 159 of them inside tiles** (three per tile × 53); the only in-page link is "Skip to content", which lands *before* the grid, so there is no way past it. Every tile announces its name twice. Group headings read "Agent **agent** 18" — the raw ontology id spoken between the label and the count. Credit where due: the focus ring is correct, the chips use `aria-pressed` properly, and the favourite star is labelled.

**Casey (mobile)** — zero cards on the arrival screen. To change a filter after scrolling into the Tool group, scroll 6000px back. Chips are 23px tall, roughly half a 44px target and under even the 24px floor; **112 of 165 interactive targets on the page are under 44px**. Three selects at three different widths in a 319px column.

**Riley (stress tester)** — reaches a guaranteed-empty result two ways, and the copy answers "Try a broader query" to a reader who typed no query. Changing sort at scrollY 3500 holds the pixel but jumps the document 6415 → 5789 and unmounts all five group headings: same position, entirely different content, no landmark. And **search matches only `[id, name, action, tools]`** — typing "validation" returns cards whose prose contains the word, not the seven validation-type cards.

## Minor Observations

- The sticky group `h2` is `top-16` (64px) under a 65px header — a 1px sliver, hidden by z-order, but off by one.
- The `/` glyph in the search field is decoration wearing the costume of a keyboard affordance.
- Tile heights are ragged by 10px within a row (239 vs 249) depending on whether the author row renders.
- Phase select counts sum to 54 across 53 cards, because cards declare multiple phases. The code knows this; the UI never says it.
- `Decision (2)` and `Human gate (2)` each occupy a full group with `gap-10` spacing designed for 24 tiles, so they read as a stutter.
- `cramped-padding` ×16 traces to `TagPill`'s `py-0.5` plus an inner span flush to the border; the phase chips use a bare text node and do not trip it.
- The page has no onward route of any kind after the last tile.
- Avatar initials render at 8.64px on all 53 tiles and are not `aria-hidden`. A prior pass reasoned about their *contrast* and left the *size*; at one instance on a detail page that was defensible, at 53 it is the page's most repeated finding.

## Questions to Consider

1. Grouping exists only under the `type` sort, and `type` became the default *because* grouping was the fix. Is "what kind of step is this" the question readers arrive with, or just the sort that happened to have labels ready? The site's spine is the lifecycle. What would grouped-by-phase look like?
2. Thirty percent of the library declares no phase, and the browser handles that beautifully. But if a third of the nodes fall outside the closed five-term vocabulary, is the vocabulary describing the library, or is the library reporting that the vocabulary is short a term?
3. Grouping was added because 53 tiles was 18.5 viewport heights on a phone. It is now 20. Was the problem the missing headings, or the decision to render all 53 cards at all times? What is a 211px-tall tile earning on mobile that a 64px row would not?
4. Every tile prints `used in N blueprints`, and the default sort is not "Most used". If the number that most answers "should I use this" is usage, why is the front door sorted by taxonomy?
5. Every filter narrows. There is no way to ask "agent or tool", or "planning through testing". For 53 items across 5 types, is single-select the right primitive, or is it what `<select>` gives you for free?
