---
target: the blueprint gallery index (/blueprints)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-04T22-20-46Z
slug: app-blueprints-page-tsx
---
Method: dual-agent (A: design review, isolated · B: detector + browser evidence, isolated)

Index only; `/blueprints/[slug]` was out of scope. Both agents drove the surface — search, every facet, the tag chips, sort, the empty state, and the filter → open → Back loop. Neither was told the other's findings.

Scope note: `app/blueprints/page.tsx` and `components/gallery/GalleryBrowser.tsx` are uncommitted working-tree changes, so this scores work in progress.

Inspection caveat: CDP screenshots are broken here; nobody saw a rendered pixel. Every number is measured off the live DOM at 2044×1160 and against a 378×714 offline clone.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The count is a bare `<span>` (`GalleryBrowser.tsx:412`); the twin browser renders the identical line as `role="status" aria-live="polite"`. The URL is never written, so the address bar reads `/blueprints` whatever the grid shows. |
| 2 | Match System / Real World | 2 | `autonomy class`, `Conditional`/`Closed-loop`, `dark factory` and `seeded` are all house vocabulary with no gloss at the point of use. The code's own comment concedes what the dark-factory checkbox selects "became a real question on 2026-08-04". |
| 3 | User Control and Freedom | 1 | Measured: `schema` → `2 of 9` → open a blueprint → Back → `9 of 9`, input empty. Eight `useState` calls and nowhere else. |
| 4 | Consistency and Standards | 2 | Four divergences from the sibling browser in the same repo: no URL state, no live region, no `w-full sm:w-auto` on the selects, no counts on the chips. |
| 5 | Error Prevention | 3 | Genuinely good — facet options are derived from loaded data, so no select option can return zero, and `TagFromQuery` discards a `?tag=` no blueprint carries. |
| 6 | Recognition Rather Than Recall | 2 | The default sort is "Recently updated" and no tile prints a date. The two sorts whose key *is* printed are the two the interface itself labels `seeded`. |
| 7 | Flexibility and Efficiency | 1 | No linkable filtered view, no bookmark, no Back. A decorative `/` glyph advertises a focus shortcut that does not exist. Tags are single-select, so `#RAG` + `#grounding` is inexpressible. |
| 8 | Aesthetic and Minimalist Design | 3 | The strongest axis: a 25-word lead on one line, 5 visible controls before the shelf at rest, first card at y=502. |
| 9 | Error Recovery | 2 | The empty state is calm and generic. Reached with a query and no tag set, it advised "drop a tag". |
| 10 | Help and Documentation | 3 | `What a blueprint is →` sits in the lead; both seeded sorts self-label. Nothing explains `autonomy class` or `dark factory` where they are offered. |
| **Total** | | **21/40** | **53% — Acceptable, significant improvements needed** |

## Design Specificity Verdict

**LLM assessment. The tile is authored for this product; the browser wrapped around it is the stock catalog template.**

`ContentCard` could not be lifted from anywhere: a per-blueprint SVG schematic on cyanotype ground carrying 28–50 distinct shapes across the nine tiles, an `AutonomyMeter` that names a class and refuses to draw a number, a `◐` marker admitting both index figures are seeded.

`GalleryBrowser` is not. Strip the palette and it is the shape every registry ships, and every knob is sized for thousands of items and applied to **nine**. Verified against `content/blueprints/*/blueprint.yaml`: 30 distinct tags, of which **24 match exactly one blueprint, 6 match two, and none matches three**. Four-fifths of the tag row is a one-item lookup wearing a facet's clothes — and the file's own comment says so before rendering all 30 anyway.

The bespoke work is on the object. The container was not designed, it was assumed.

**Deterministic scan.** Static pass **completely clean**: `[]` at exit 0 across the page, `components/gallery/`, and the full import closure (`SectionHeading`, `ContentCard`, `PhaseCoverage`, `Avatar`, `Badge`, `AutonomyMeter`, `FavoriteStar`, `TagPill`, `GraphThumbnail`, `layout`). No config file and no `impeccable-disable` anywhere, so nothing is suppressed. Proven live by a repo-wide run: exit 2, one finding, the known `.bp-grid` graticule. Browser overlay: 76 findings at rest, 27 filtered, 43 at zero results.

**Where the two agree.** No live region anywhere on the page — both derived `[]` independently. The URL never written. The `N active` badge at 10px. The tag chips at 22.5px. Contrast healthy throughout, worst case **5.28:1** on an avatar gradient.

**Where the detector caught what the review missed.** That the `text-occlusion` count *rises* from 4 to 33 in the zero-results state, all 33 resolving to elements inside a `<details>` with `open === false` — Chrome keeps stale layout boxes under `content-visibility`, so the detector samples geometry for content that is neither painted nor focusable. Also that the tag chips are genuinely out of the tab order when closed (`checkVisibility` false, `focus()` does not land), which is what makes the "36 controls" figure stale.

**Where the review caught what no detector can.** That the thumbnail's declared 11px labels render at **7.1 effective pixels**, because a 570×220 viewBox is scaled 0.647 into a 369×158 frame — a number no static scan and no naive font-size query produces. And every behavioural defect: Back destroying state, the address bar lying after `Clear filters`, the empty state naming a filter that was never set.

**False positives, confirmed.** `codex-grid-background` on `.bp-grid`; `ai-color-palette` on `.text-cyan` (5 of 11); `overused-font` (three families measured by character count: Geist 3226, JetBrains Mono 2039, Space Grotesk 213); `text-occlusion` (all inside closed `<details>`); `nested-cards ×9`, all landing on the `border-y` preview band, with an independent container audit finding **zero** genuinely nested bordered boxes.

**Correction to the standing waiver, for the second surface running.** 6 of 11 `ai-color-palette` hits are Avatar **gradients**, not `.text-cyan`. Different element, different trigger, not covered by the documented exemption. They pass contrast, so they are not defects — but the waiver should not be read as covering them.

**One near-miss worth recording.** B initially measured the active tag chip as muted grey despite its cyan classes. `getAnimations()` showed six transitions stuck at `currentTime: 0` because the tab was occluded, which freezes the timeline and makes `getComputedStyle` return start values. Not a styling bug — an environment artefact. All contrast numbers were taken after flushing animations.

## Overall Impression

This page is a shelf of nine objects behind a machine built for thousands. The objects are excellent and the machine is generic, and the machine is where every defect lives.

The single biggest opportunity is that **the page is prerendered so its nine cards live in static HTML — an explicit, well-argued trade — while the filters that make those cards findable live in memory that Back erases.** A static shelf nobody can link to a filtered view of is not getting the benefit it paid for.

## What's Working

1. **The disclosure is the right call, correctly built.** `open={narrowOpen || narrowCount > 0}` with a live badge means a filter set by a deep link cannot arrive invisibly, and the shelf at rest costs a reader 5 controls instead of 38.
2. **Filters cannot produce a dead option.** Phases are the union of what nodes actually declare, ordered by lifecycle rather than alphabetically; classes are derived from the loaded blueprints; an unknown `?tag=` is dropped. Error prevention at the data layer rather than papered over with a message.
3. **The honesty markers are load-bearing and consistent.** `Most downloaded · seeded` in the option text itself, `◐` plus a title plus an `sr-only` gloss on every tile. And it correctly refuses to offer autonomy as a sort key — the leaderboard the product is designed not to have.

Design-system compliance is clean: no `.route-box` misuse, no `--color-faint` on text, and the placeholder fix is present and commented.

## Priority Issues

### [P0] Filter state exists only in React memory, and the address bar lies

**What.** Eight `useState` calls at `GalleryBrowser.tsx:110-126`; no `replaceState`, no `pushState`, no router write anywhere in the file. Measured: `schema` → `2 of 9` → open a blueprint → Back → `9 of 9`, input empty.

Compounding, and worse than the same defect on `/nodes`: `?tag=` is **read** once at mount and never written, so after `Clear filters` the URL still reads `?tag=RAG` while the grid shows all nine. A reload resurrects a filter the reader deleted.

**Why it matters.** Filter → open → Back → open the next is the entire purpose of a gallery. No filtered view can be linked from `/ontology`, `/nodes` or a message; nothing can be bookmarked; Back is a trapdoor. A page that reads a deep link but cannot produce one is worse than one that does neither, because the read path implies the write path exists.

**Fix.** The sibling browser already solves this. Extract its mechanism — `useSyncExternalStore` over `history.replaceState`, with an empty server snapshot so the nine `<article>`s stay in the prerendered HTML — into a shared hook and use it on both surfaces. `TagFromQuery` and its Suspense boundary are subsumed.

**Suggested command:** `/impeccable harden`

### [P0] The result count is not announced

**What.** `<span>{results.length} of {blueprints.length} blueprints</span>` at `:412`. Both agents independently derived `[aria-live],[role=status],[role=alert],output` → **`[]` for the entire page**. Driving the grid to zero announced nothing.

**Why it matters.** A screen-reader user types into search and cannot tell whether they matched nine, one, or none. The sibling browser fixed exactly this, with a comment naming the failure.

**Fix.** `role="status" aria-live="polite" aria-atomic="true"` on the count, phrased as a sentence, and the same treatment on the empty state so the transition to zero is spoken.

**Suggested command:** `/impeccable audit`

### [P1] Thirty tag chips: a facet row that cannot facet

**What.** 30 buttons, alphabetical, uncounted, in a bare `<div>` with no `role` and no accessible name. Verified against content: **24 return exactly one blueprint, 6 return two, none returns three.** Measured 308px tall at phone content width — 13 wrapped rows, 43% of a 714px viewport — at 22.5px per chip. Single-select semantics dressed as 30 independent `aria-pressed` toggles, so pressing `#data` after `#RAG` silently unpresses `#RAG`.

And the disclosure auto-opens on the `?tag=` path that **every blueprint detail page links through**, so the wall sits on the highest-traffic inbound road.

**Why it matters.** The best outcome any chip can deliver is 9 → 2, on a shelf a reader scans in one scroll. It is a hyperlink with extra steps, and every one of those hyperlinks is already printed on the tile it points to.

**Fix.** Replace the row with a single removable chip showing the active tag, which keeps the `?tag=` deep link legible and costs no wall. If the row must survive, it needs a count per chip, a labelled `role="radiogroup"`, and suppression of single-match tags.

**Suggested command:** `/impeccable distill`

### [P1] Thumbnail labels render at 7.1 effective pixels, truncated

**What.** `ContentCard.tsx:86-93` gives the schematic a 160px frame; `GraphThumbnail` scales a 570×220 viewBox by **0.647**, so declared 11px node names render at **7.1 effective CSS px** and 10px role labels at **6.5px** — 5.8px and 5.2px on a phone. `GraphThumbnail.tsx:236` then clips at 15 characters plus an ellipsis.

**Why it matters.** The drawing is the most bespoke thing on the page and the reason a reader stops on a tile. Its text is currently a texture pretending to be information, and the ellipsis is the renderer asserting the text was meant to be read.

**Fix.** Drop node label text below a scale threshold and keep the kind glyphs and edge topology, which are legible at 0.647. The component already makes exactly this argument for edge labels in its own comment; apply it to node labels.

**Suggested command:** `/impeccable typeset`

### [P2] The empty state does not name what went wrong

**What.** `:436-453` renders "Try a broader query or drop a tag" verbatim — observed with a query active and **no tag set**. The only remedy offered is `Reset all filters`, and focus drops to `BODY` when the clear button unmounts itself.

**Fix.** Render the active filters as removable chips inside the panel so a reader removes the offending one rather than starting over, and move focus to the empty-state heading when results reach zero.

**Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Alex (power user)** — no purchase anywhere. Cannot link a filtered shelf, bookmark one, or Back into one. The `/` glyph advertises a focus shortcut that does not exist. Cannot combine two tags. Cannot see the key the default sort orders on. Alex's whole vocabulary — URL surgery, keyboard, composition — is absent from a page whose audience runs pipelines from a terminal.

**Sam (screen reader + keyboard)** — the grid changes in silence. The 30-chip row has no group name, so Sam tabs through "hash C I, toggle button, not pressed" thirty times with no idea what the region is, and the `aria-pressed` semantics are wrong besides. `<summary>` is missing from the focus-ring selector at `globals.css:269`, so the one control that opens the whole filter panel falls back to the UA ring while everything around it wears cyan. Each tile announces its blueprint name twice, once as a link and once as an `h3`. 65 tab stops with the disclosure open.

**Casey (mobile)** — 308px of tag pills, 43% of the viewport, opening automatically on the `?tag=` link Casey arrives through. Chips at 22.5px clear WCAG 2.2 only via the spacing exception and sit far under the 44px touch guidance. `controlClass` lacks `w-full sm:w-auto`, so where the sibling gives full-width controls, this gives three ragged boxes of 147px, 219px and 198px.

## Minor Observations

- **The disclosure's stated invariant does not hold.** The comment claims "a reader can never have an active filter they cannot see." Verified false: with `?tag=RAG` active, clicking the summary left it closed, because React's `open` prop was `true` before and after (`narrowCount > 0` masked `narrowOpen` going false), so React never rewrote the attribute and the browser's own toggle stood. React's model and the DOM are desynced.
- Four selects carry both an `sr-only` `<span>` and a duplicate `aria-label`; the label wins and the span becomes orphan text in browse mode.
- The card's stretched link sits over the summary text, so the sentence describing the blueprint cannot be selected or copied.
- `article` has no accessible name, and the stretched link's `sr-only` title means the name is announced twice per tile.
- The `sr-only` `h2` "The shelf" is the correct fix for the heading-outline problem it describes, but the four footer `h3`s then sit at the same level as the nine tiles beneath it, so the footer nests inside the shelf in the accessibility outline.
- The `--json` detector exit code is 2 even when the only finding is advisory, while text mode returns 0 for the same input. A tool inconsistency, not a surface defect.
- Default sort order verified correct against `updatedAt` across all nine YAML files.

## Questions to Consider

1. **Nine items. Why is there a filter panel at all?** The whole shelf is 2225px, one and a half screens. Search plus sort covers every real intent; category, phase, autonomy, dark-factory and thirty tags exist to make the page *look* like a registry. What does this page become if the panel is one search field and the shelf starts at y=380?
2. If a tag can only ever narrow nine to two, is it a filter or a label?
3. The site's proudest claim is that its numbers are seeded. Why can a reader sort by them and not by the one number that is real? Put the date on the card and the hierarchy inverts.
4. `◼ dark factory` is a checkbox whose selection criterion its own authors record as an open question, with no definition on this page. Should it exist?
5. The page is prerendered so the nine cards live in static HTML — an explicit, well-argued trade. What is a static shelf worth if nobody can link to a shelf of two?
