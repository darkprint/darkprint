---
target: the node card detail page (/nodes/[...id])
total_score: 25
max_score: 36
na_heuristics: 9
p0_count: 2
p1_count: 2
timestamp: 2026-08-04T20-49-10Z
slug: app-nodes-id-page-tsx
---
Method: dual-agent (A: design review, isolated · B: detector + browser evidence, isolated)

Second run on this target. Both assessments ran in parallel, neither could see the other, and **neither was told the previous score, the previous findings, or that any work had been done** — they were given the target, the contract, and the environment workarounds only. Six cards assessed between them: `merge-executor` (tool, 2 risk markers), `maintainer-approval` (human-gate), `code-builder` (agent, the archive's only *enforced* prohibition), `intent-router` (decision, 2 versions), `acceptance-verifier` (validation, major bump), `confidence-escalation` (human-gate, no phase).

Inspection caveat: CDP screenshots remain broken, so nobody saw a rendered pixel. Every number is measured off the live DOM at desktop and at a genuine 378×714 viewport.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `page.tsx:294` reads `resolved?.term.defaultWeight`, which is `undefined` for every core marker, so the `weight` branch at `:1024` is dead on all 53 cards while the footnote at `:1041` explains the number it never prints. |
| 2 | Match System / Real World | 3 | `:961` heads the panel "Evaluation metadata" — schema jargon over the two facts a reader needs. `:750` prints "Phases" (plural) above "Outside the five." on all 12 phase-less cards. |
| 3 | User Control and Freedom | 3 | No in-page navigation on a document measuring 3424px desktop / 6481px mobile. Nine `section[id]` anchors are addressable but unlisted. |
| 4 | Consistency and Standards | 2 | Three sizes for one heading level: 12px (`SourcePanel.tsx:21`), 13px ×9 (`page.tsx:81`), 20px (`Comments.tsx:56`). `main h3` count is **0** — every sub-group is a `<span>`. |
| 5 | Error Prevention | 3 | The header risk chip is the right move. But on `acceptance-verifier` the `▲ MAJOR / breaks something a blueprint had pinned` badge sits 71% down the page with nothing in the header. |
| 6 | Recognition Rather Than Recall | 3 | On `merge-executor` the author's warning — "This is the node that holds the repo write token… Scope the token to the one repository" — sits ~2250px down, unlinked from the risk chip at y=260. |
| 7 | Flexibility and Efficiency | 2 | Two `ml-auto` groups (`:368`, `:457`) make tab order zig-zag ~900px twice. No ref-copy affordance though the digest got a full treatment. No version-to-version compare. |
| 8 | Aesthetic and Minimalist Design | 2 | On `merge-executor`, 42.8% of visible characters under 13px and 75.4% under 15px, across nine panels wearing one identical frame with no weighting. |
| 9 | Error Recovery | n/a | Static read surface: `dynamicParams = false`, no forms, no failing operations. |
| 10 | Help and Documentation | 4 | The page's genuine peak. Nearly every field states *where its authority stops* rather than what it does. Documentation of limits rather than features. |
| **Total** | | **25/36** | **69% — Acceptable, one point below the Good band** |

**Trend: 22/36 → 25/36.**

## Design Specificity Verdict

**LLM assessment.** Authored for this product, but the specificity lives in the content treatments rather than in the composition.

The vocabulary is unfakeable: enforced-versus-free-text prohibitions drawn as two different objects; a changelog *inferred from two documents* rather than trusted; `◐ seeded` on every unbacked figure; the `▸ runs unattended` / `⏸ a person acts here` pair that refuses a pass/fail grammar. No unrelated developer tool could wear this.

The layout is still the stock registry template: breadcrumb → 36px h1 → chip row → 2/3 main + 1/3 sticky aside → stacked equal-weight panels → comments. And the two most distinctive treatments are the two that fail — the `ReachList` figure breaks at mobile widths, and the elaborate enforced-prohibition card fires on **1 of 53 pages**, because `code-builder` is the only card in the archive whose `cannot` resolves to a data type.

**Deterministic scan.** The static pass is **completely clean**: `[]` at exit 0 on the page and on all 11 components it renders, unchanged under `--no-config`, with no config file present to suppress anything. A liveness check over the whole repo returned exit 2 with exactly one finding — `codex-grid-background` on `.bp-grid`, the known false positive, not on this route. The detector fires correctly; this surface is genuinely clean in static mode. Browser overlay found 28–30 per page, of which **11–12 are non-false-positive**.

**Where the two agree.** The mobile fix holds, and B proved it independently: `scrollWidth` **367** against `clientWidth` **367** on both pages measured, **0 of 124** and **0 of 196** text leaves off-screen. Port tables scroll inside their own container with reachability demonstrated (`scrollLeft` 0 → 235, max 235). Nested bordered boxes reach **depth 1, never 3**. Fragment links: **0 broken**. Readable text under 11px: **0** — the single 10px element is an `aria-hidden` caret. Heading outline has **no skipped levels and no duplicate announcement**. Avatar initials measure **7.16–13.43:1** against every gradient stop.

**Where the detector corrected the reviewer's instinct.** B flagged `dark-glow` on the Download button, then checked the source and withdrew it: `Button.tsx:16` is already `shadow-[0_6px_16px_-8px_var(--color-cyan)]`, an offset shadow. The rule appears to flag any coloured shadow on a dark ground.

**Where the reviewer caught what the detector cannot see.** The `ReachList` mobile failure produces **no overflow** — B's overflow metric reads clean — because the grid squeezes rather than spills. A measured the consequence: a **66px** gloss column holding 169 characters over 340px of height, roughly ten characters per line. A clean overflow number and an unreadable figure are not the same thing.

**False positives, five, all confirmed and none to be "fixed":** `codex-grid-background` on `.bp-grid`; `ai-color-palette` ×12–14/page on the brand cyan; `overused-font` (three families are intentional); `text-occlusion` ×2–4 (the detector sampling an open `<details>` nav menu); `dark-glow` (the offset fix it asks for is already in place).

## Overall Impression

The structural defects are gone and the measurements prove it rather than assert it. What remains is a different and harder problem: the page is now correct and still undifferentiated. Nine panels of equal weight, one frame, 42.8% of characters under 13px — a faithful field-by-field rendering of the schema, with no answer to the two questions a reader actually arrives with.

The single biggest opportunity is that **the risk story is still told in the wrong order and with a missing number.** On the archive's most dangerous card the panel is headed "Evaluation metadata", opens with a cyan sentence reading as good news, and promises a weight the code cannot produce.

## What's Working

1. **`VersionHistory` derives the diff.** `inferBump` reads both card documents and produces the level plus its reasons; `BUMP_META` is built so "the word carries the meaning; the colour only ranks it." It converts a trust claim into a mechanical one.
2. **The limit-stating gloss system.** "A pointer only: no skill document travels in a DarkPrint bundle." "A label the author chose. Nothing in the engine reads it." "The resolver does not hold the graph to it, which is not the same as nothing acting on it." A page that documents its own non-guarantees is the honest expression of "read rather than trust".
3. **The autonomy pair.** `▸` cyan for unattended, `⏸` violet for a person acts — glyph and word both, neither framed as reward or alarm. It refuses a value judgement the product does not want to make.

## Priority Issues

### [P0] `ReachList` has no mobile layout — the gloss collapses to a 66px ribbon

**What.** `components/ui/ReachList.tsx:62` sets `grid-cols-[minmax(0,10.5rem)_auto_minmax(0,1fr)]` with no breakpoint. Measured at 378px on two cards: cells of 168px / 35px / **66px**. The `skill` row puts 169 characters in the 66px column — 340px tall, about ten characters per line. The `runtime` panel measures **941px** to carry roughly 300 characters. `skills/merge-executor.md` is additionally `truncate`d in the field cell with no title or expansion.

This produces **no horizontal overflow**, which is why the deterministic pass reads clean here.

**Why it matters.** Three fields a reader must satisfy *before the node runs* are illegible on the viewport most readers use. The figure is shared, so `/concepts` and `/ontology` inherit it.

**Fix.** Stack below `sm`: field cell full width, connector dropped or rotated to a vertical rule, gloss full width beneath. Drop `truncate` at narrow widths and let the path wrap.

**Suggested command:** `/impeccable adapt`

### [P0] The risk panel promises a weight the code cannot produce, and reassures before it warns

**What.** Three defects on one panel, on the archive's most dangerous card.

`page.tsx:294` reads `resolved?.term.defaultWeight`. `lib/core/ontology/core.ts:171` states that no core term carries one, because doc 3 §4 keeps weights in `DARKPRINT_CONFIG.security.weights`. So `risk.weight` is `undefined` on all 53 cards, the `weight {formatWeight(...)}` branch at `:1024` never renders, and the footnote at `:1041` — "The vocabulary's default, subtracted from a clean 4" — explains a number that never appears. The correct lookup already exists and is already exported from the module this page imports `formatWeight` from: `markerWeight()` in `components/ontology/TermTable.tsx` reads the config first and falls back to the term's own weight for local markers.

The panel is headed **"Evaluation metadata"** (`:961`) — schema jargon where the reader wants "what can this reach".

It **opens with reassurance**: cyan `▸ Runs unattended. Nothing on this card asks for a person` sits directly above two amber risk markers. On a node holding a repository write token, "nothing stops here" is the alarming fact, rendered in the site's positive-interactive colour. On mobile the panel is at y=4702 of 6481.

**Why it matters.** This is the page a reader consults before wiring a write token into a graph. It reassures before it warns, and the one quantity that would let them compare this node against another is absent by defect rather than by decision.

**Fix.** Use `markerWeight()` so the configured cost renders, or delete the footnote that promises it. Rename the heading to what it answers. On risk-bearing cards move the autonomy line below the markers, and promote a compact risk block into the main column under Specification.

**Suggested command:** `/impeccable harden`

### [P1] Nine panels of equal weight; 42.8% of characters below 13px

**What.** On `merge-executor`: Specification 282px, Interfaces 474px, Cannot receive 251px, Model/skill/servers 297px, Behaviour 558px, Version history 201px, Card source 113px — all wearing the identical `.panel` frame. Font histogram: 11px 13.4%, 12px 29.3%, 13px 14.4%, 14px 18.3%, 15px 19.5%.

B corroborates from the other side: `first-viewport-column-overflow` fires once per page, with the main column at 204–275% of viewport height against a sidebar at 40–55%.

**Why it matters.** Nothing tells the reader that Specification answers the page's question while "Model, skill and servers" is a prerequisite checklist. Every scan costs the same, so nothing is scanned.

**Fix.** Give Specification a distinct treatment, demote Runtime and Identity to a lower-contrast register, raise the body floor to 12px minimum.

**Suggested command:** `/impeccable clarify`

### [P1] Three sizes at one heading level, and zero `h3`

**What.** `h2` renders at 12px (`SourcePanel.tsx:21`), 13px ×9 (`page.tsx:81`), and 20px (`Comments.tsx:56`). `main h3` count is **0**: Phase, Agent, Tools, Parameters, Notes, Inputs, Outputs, Dependencies and Risk markers are all `<span className={LABEL}>`. The `h1`→`h2` step is 36→13px.

**Why it matters.** A screen-reader user rotoring by heading gets 10 flat items for a 6481px document and cannot reach nine named sub-sections at all.

**Fix.** Promote the `LABEL` sub-groups to `<h3>` carrying the same visual class. Normalise the three `h2` renderings, or accept "Community notes" as a page-level sibling of the `h1` and re-level the panels consistently.

**Suggested command:** `/impeccable audit`

### [P2] Header affordances, focus order, and touch targets

**What.** On `maintainer-approval` four consecutive violet pills render at 154/161/147/147px — two are links, two are `<span>`, and the only cue is a `→` glyph. Two `ml-auto` groups break DOM order against visual order: tab goes author (x=441) → Fork (x=1345) → Download (x=1462) → type chip (x=514). B measured **8–11 targets under 24px in height** (14.5–22.5px), all at least 24px wide; the adjacent `download`+`copy` pair and the port-type chips are least likely to earn SC 2.5.8's spacing exception. Risk-marker links carry no `aria-label`, so their accessible names are 58 and 90 characters of card text. The breadcrumb `/` computes 1.98:1 and is **not** `aria-hidden`.

**Fix.** Distinguish link-pills from static pills. Reorder so `ml-auto` groups are DOM-last. Pad small targets to 24px min-height. Add `aria-label={risk.label}` and hide the description from the accessible name.

**Suggested command:** `/impeccable harden`

## Persona Red Flags

**Casey (mobile)** — 6481px on `merge-executor`, 7258px on `intent-router`, no TOC. The runtime panel renders three glosses in a 66px ribbon. Both port tables carry `min-w-[520px]` inside a 319px column: the Description column starts at x=301 and is off-screen with no scroll shadow, no swipe hint and no visible scrollbar — reachable, as B proved, but nothing says so. Risk markers at 72% page depth.

**Sam (screen reader + keyboard)** — zero `h3` in `main`, so nine named sub-sections are unreachable by heading navigation. Risk-marker links announce 58 and 90 characters. Focus order jumps x=441 → x=1345 → x=1462 → x=514 in the header, then after "Copy the YAML source" at y=2661 jumps back up to the risk cards at y=558 — the highest-stakes content is last in tab order and 2100px above where focus was. Panel `meta` strings sit outside the `aria-labelledby` heading and announce as loose text.

**Alex (power user)** — nothing in the header says `acceptance-verifier@2.0.0` was a major bump; that lives 71% down. No way to copy the ref, though the digest got a link, a selectable string and a gloss. No version-to-version compare. `Download card`'s href is a ~2.5KB inline `data:text/yaml` URI, so "copy link address" yields a percent-encoded blob rather than a fetchable path.

## Minor Observations

- Breadcrumb reads `← Nodes / Tool`, then the chip row repeats `type · Tool` 147px below — the same word twice, once inert and once linked.
- `used in 1 blueprint` is inert text on a page whose Version history lists that blueprint as a link 2400px below.
- The sticky aside holds 464px beside a 3190px main column on `intent-router` — a 363px × ~2700px empty right gutter for two-thirds of the desktop scroll.
- `scroll-mt-24` (96px) against a 65px sticky header leaves a 31px overshoot on every in-page anchor.
- `↓ 370 downloads ◐ seeded` uses `title` for "Seeded, no counter stands behind it" — unreachable by keyboard and touch, the same defect already fixed for the digest.
- `.route-box` is used nowhere on this page, though `globals.css:147-180` defines it precisely for boxes that send a reader elsewhere, and the page has no onward route at all.
- The `ReachRow` `→` computes 1.87:1 and is `aria-hidden`. The file calls it "the pointing" — the figure's semantic device, invisible to low-vision readers and to assistive technology simultaneously.
- Line length 119–128 characters on every paragraph lacking a max-width. The Specification body was **not** flagged: it carries `max-w-[68ch]`.
- `Card source` in its *opened* state at 378px is unmeasured — it is a JS disclosure and could not be opened in the script-stripped iframe. Collapsed it contributes nothing, but the opened narrow state is untested.

## Questions to Consider

1. The enforced-prohibition branch is the richest treatment on the page — 117px, violet, two explanatory paragraphs — and it fires on 1 of 53 cards. The other 52 get a 40px grey row. Is the design teaching the ontology's aspiration or describing the archive?
2. `merge-executor` merges pull requests with a repository write token, and the first thing its risk panel says is "Runs unattended. Nothing on this card asks for a person." Has the refusal to *grade* autonomy tipped into refusing to *warn*?
3. Nine panels, each a faithful rendering of one schema field group. `Card source` was collapsed because it re-printed every field the panels above already draw — but the panels above are themselves a field-by-field print. What would this page look like organised around "what does it do" and "what can it break" rather than around the card's field order?
4. The page ends on "posting is not built", with no onward route and zero `.route-box`. Where is a reader supposed to go after node 1 of 53?
