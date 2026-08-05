---
target: the node card detail page (/nodes/[...id])
total_score: 22
max_score: 36
na_heuristics: 9
p0_count: 2
p1_count: 2
timestamp: 2026-08-04T20-02-59Z
slug: app-nodes-id-page-tsx
---
Method: dual-agent (A: design review, isolated · B: detector + browser evidence, isolated)

Both assessments ran in parallel and could not see each other. Measured on four structurally different cards: `code-builder` (agent, 0 risks), `merge-executor` (tool, 2 risk markers), `maintainer-approval` (human-gate, free-text prohibitions), `intent-router` (decision, 2 versions).

Inspection caveat: CDP screenshot capture is broken on this machine, so nobody saw a rendered pixel. Every number below is measured off the live DOM — `getBoundingClientRect`, `getComputedStyle`, computed contrast, accessibility trees — at desktop and at a genuine 378px mobile viewport. Colour-as-composed and spacing-as-felt were not judged.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Panel `meta` values sit 425–558px from their own `<h2>` in the same header bar. At 390px all five are clipped off-screen. |
| 2 | Match System / Real World | 3 | `Comments.tsx:57` renders "this **blueprint** has none" on all 53 *node* pages. `◌ free text` / `⊘ enforced` is invented notation with no legend. |
| 3 | User Control and Freedom | 3 | No TOC or jump links on a 4316px page. The two in-page anchors that exist (`#download`, `#card-source`) are linked from nowhere. |
| 4 | Consistency and Standards | 2 | Three heading treatments for one level: 7× 11px mono, `Card source` at 16px Geist, `Community notes` at 20px Space Grotesk. |
| 5 | Error Prevention | 2 | Cannot prevent the one error it exists to prevent — a bad reuse decision — because `card.spec` never renders. The page contradicts its own source. |
| 6 | Recognition Rather Than Recall | 2 | `sha256` appears 4× per page in 3 renderings; version strings 12×. The full digest exists only in a `title` attribute. |
| 7 | Flexibility and Efficiency | 2 | 14 focusables; the one accelerator is `copy` (44×23px), which copies the whole file. No per-field copy, no collapse, no TOC. |
| 8 | Aesthetic and Minimalist Design | 2 | 1239 words on `intent-router`, 496 of them (40.0%) inside `#card-source` — a raw YAML dump restating every field above it. |
| 9 | Error Recovery | n/a | `dynamicParams = false` makes an unknown id a build-time 404; there is no error state on this route. |
| 10 | Help and Documentation | 3 | The page's best quality — every empty state is a designed sentence. Deducted because the node's actual documentation (`spec`) is the one thing absent. |
| **Total** | | **22/36** | **61% — Acceptable, significant improvements needed** |

## Design Specificity Verdict

**LLM assessment.** Authored at the component level, generic at the page level.

The components could not be lifted into another product. `Cannot receive` renders the *negative* half of an interface, splitting prohibitions into enforced (`⊘`, resolvable to a data type) versus free text (`◌`, addressed to a human) and naming the exact diagnostic. `VersionHistory` derives the bump level from `inferBump(previous.card, next.card)` rather than trusting a changelog. Every empty state is a written sentence — "Outside the five", "The ordinary case", "It reaches no server." No `—`, `N/A` or `null` renders anywhere on the page.

The composition is the generic package-registry template: title → chip row → provenance strip → 2/3 main + sticky 1/3 aside → full-width comments. npm, PyPI and a HuggingFace model card use it unchanged. The page inherited that skeleton without asking whether "decide whether to reuse this node" wants it — and the skeleton is what produces both P0s: a raw source dump at the end because registries have one, and risk in a sidebar because registries put metadata there.

Brand lives in the panel contents. It has not yet reached the page's shape.

**Deterministic scan.** The static TSX pass has **zero signal** for this page: `app/nodes/[...id]/page.tsx` and all 12 directly-imported components return `[]` at exit 0, unchanged under `--no-config`. The only repo-wide hit is `codex-grid-background` (advisory) on `app/globals.css:102`, a known false positive. Every real finding came from the browser overlay: 37 findings at desktop, 44 and 41 at 378px.

**Where the two agree.** The mobile overflow, reproduced independently with different numbers from different viewports and isolated to the same line by two separate experiments. Sub-11px type. Nested bordered boxes in "Model, skill and servers".

**Where the detector caught what the review missed.** The design review measured contrast across "every visible text/background combination", reported a 5.43:1 minimum, and concluded the site-wide badge-contrast failures were *not* on this page. That was wrong. `components/ui/Avatar.tsx:32` puts `text-white` over `avatarGradient(author.avatarHue)` and computes **3.3:1** on `code-builder` and **2.5:1** on the other two — against a 4.5:1 requirement at 11.52px. It is hue-derived, so it varies per author and some are worse. This is exactly the failure the site-wide audit flagged, and it does recur here.

**Where the review caught what the detector missed.** `card.spec` never rendering; the wrong noun in the comments empty state; risk markers absent from the header; the heading-hierarchy collapse; the 40% source dump.

**False positives, four, all recurring — do not "fix" them.**
- `codex-grid-background` on `.bp-grid` — the deliberate cyanotype graticule.
- `ai-color-palette` ×12–14/page — the site's brand cyan and violet.
- `overused-font` — three families are intentional (`globals.css:50-52`).
- `text-occlusion` ×2 — both carry `isHidden: true`; the detector sampling an open `<details>` nav menu.

One near-miss worth recording: `body text touching viewport edge` first read as a false positive because the offset was negative. Negative means the element extends *past* the edge. It is a true positive and corroborates P0-1.

## Overall Impression

This page writes better than almost anything else on the site and is shaped worse. The prose is genuinely excellent — an empty field never reads as an author's oversight, which is the single hardest thing to get right on a registry. Then the page hands a mobile reader a silently mutilated layout, and never once prints the field that says what the node actually does.

The single biggest opportunity is not more cutting. It is that **the page renders the wiring and withholds the work.** `spec` is the payload handed to the agent; the page shows every port, tool and marker around it and leaves the instruction itself inside a 309px scroll window onto raw YAML, at tab stop 14 of 14.

## What's Working

1. **Empty states are designed sentences, not placeholders.** `phases.length === 0` renders "Outside the five. The phases describe a blueprint's shape, not every node in one… Declaring none is an answer, not a blank." Same for `cannot`, `mcp`, `params`, `agent`. On a reference surface an empty field is ambiguous between *not applicable* and *author forgot*, and that ambiguity is what makes a reader distrust a registry. Each of these resolves it in one sentence.
2. **Colour never carries meaning alone.** `✓ required` / `○ optional`, `⊘ enforced` / `◌ free text`, `⏸ human in the loop` / `▸ runs unattended`, `▲ major / ▴ minor / ▪ patch` — glyph *and* word in every pair. Brand chips measure violet 7.46:1, cyan 9.44:1, emerald 10.52:1, amber 11.06:1.
3. **`VersionHistory` derives the diff instead of trusting a changelog.** `inferBump()` reads both documents and produces the level plus the reasons. The one thing a reuser fears is a silent breaking change, and a derived diff structurally cannot drift from the artifact.

## Priority Issues

### [P0] 440–476px of every node page is clipped and unreachable on mobile

**What.** `app/nodes/[...id]/page.tsx:400` — `<div className="flex flex-col gap-8 lg:col-span-2">` is a grid child with the default `min-width: auto`, so it cannot shrink below min-content. At a 378px viewport the single-column track resolves to **783px inside a 367px container**. `app/globals.css:72` (`body { overflow-x: hidden }`) then clips it, and `scrollTo(400,0)` leaves `scrollX === 0`.

Both assessments isolated this independently: `scrollWidth` 843/807/807 against `clientWidth` 367 on the three pages; 22 leaf elements fully off-screen on `maintainer-approval`, including **all four `<dd>` values in the Identity panel** (labels render, values amputated), the entire Description column of both port tables, all five panel `meta` values, and the `copy` button.

**Why it matters.** No error, no scrollbar, no clue anything is missing. The Identity panel is worse than useless: four labels and no values.

**Fix.** Add `min-w-0` to the `lg:col-span-2` div. Verified live twice: setting `min-width: 0` on that one element dropped `scrollWidth` 807 → 367, overflow fully eliminated, `#card-source` still rendered. Hiding the source panel alone reaches 554px and zeroing the table `min-width` alone reaches 425px — neither is sufficient. Audit the `<aside>` for the same, and treat `body{overflow-x:hidden}` as the masker it is.

**Suggested command:** `/impeccable adapt`

### [P0] `card.spec` — the node's actual instruction — is never rendered

**What.** `lib/core/card/schema.ts:57-64` documents `spec` as "the payload delivered to Claude Code… when the graph is instantiated, so it must be self-sufficient." It appears exactly once in the whole `app/` + `components/` tree, and only to count itself: `components/panes/build.ts:172` renders `${words(card.spec)} words, handed to the agent`. The text is never printed anywhere on the site.

The contradiction this produces is concrete. On `maintainer-approval`, `Cannot receive` renders "summarise the change for the maintainer" with the gloss *"No data type by this name, so nothing checks it."* — while spec line 13, in the YAML immediately below, reads *"do not summarise the change for them and do not recommend an outcome."* The prohibition **is** carried; it is addressed to the agent, in the field the page refuses to show. The page states the opposite of its own source.

**Why it matters.** On an Operate/Read surface, "should I reuse this node" is answered by the spec more than by anything else. Every other panel describes the wiring; only `spec` describes the work.

**Fix.** Render `spec` as the lead of the `Behaviour` panel, above Phase/Agent/Tools/Parameters, line-clamped with an expand. Make the free-text prohibition gloss conditional: when the entry's words appear in `card.spec`, say "carried in the spec, addressed to the agent" rather than "nothing checks it." Once spec is on the page, `#card-source` collapses to a closed disclosure.

**Suggested command:** `/impeccable clarify`

### [P1] Risk markers never reach the header, and land ~3000px down on mobile

**What.** The header chip row renders type, phases, `human in the loop`, `cannot · N declared`, and the favourite star — but `riskInHeader === false`. On `merge-executor`, a node whose job is merging pull requests and which carries `secret-access` and `unchecked-write`, the header shows `Node · type ·Tool · phase ·Deployment · cannot ·2 declared` and no risk at all. Risk lives only in the aside; at 390px the aside is DOM-ordered after the entire main column, `asideTop = 3288px`.

Worse, the loudest sentence in that aside is `▸ Runs unattended. Nothing on this card asks for a person` — rendered cyan, reading as good news, sitting directly above two amber risk cards.

**Why it matters.** The header spends a chip on a *count of prohibitions*, a second-order fact, and none on the two markers that decide whether the node is safe to wire. The one page-state where the design should raise its voice is the one where it stays level.

**Fix.** Add an amber `N risk markers` chip to the header row, anchored to `#evaluation`, rendered only when `risks.length > 0` so the zero case stays quiet — consistent with the existing phases ruling. Below `lg`, reorder the grid children so `Evaluation metadata` precedes the main column.

**Suggested command:** `/impeccable shape`

### [P1] Legibility: three structural levels wear one 11px label, and an avatar sits at 2.5:1

**What.** Every panel `<h2>` is 11px JetBrains Mono, tracking 1.98px, `#828aa3`. So are seven non-heading sub-labels (`Phases`, `Agent`, `Tools`, `Parameters`, `Notes from the author`, `Risk markers`, `Before it can run`). So are the table group labels `Inputs`/`Outputs`/`Dependencies` at tracking 1.76px — a 0.22px difference, imperceptible. Meanwhile two H2s break the system entirely: `Card source` at 16px Geist (an `sr-only` real heading with `SourcePanel` drawing the visible title, so it is also announced twice) and `Community notes` at 20px Space Grotesk. H1 is 36px and the next step down is 11px, with nothing between. Eleven distinct font sizes render on one page; **65.3% of characters are ≤12px**.

Separately, 13 elements compute to 10px across 7 patterns (port-table headers ×7, the `free text`/`enforced` badges, two version badges), and `components/ui/Avatar.tsx:32` puts `text-white` over a hue-derived gradient at **3.3:1 / 2.5:1**.

**Why it matters.** On a 4300–5500px page the section label is the only wayfinding, and it is 11px and visually identical to seven things that are not sections. Scanning fails; the reader either reads linearly or leaves.

**Fix.** Give panel H2s their own step — 13px, `text-fg`, same mono and tracking — and leave sub-group labels at 11px `text-dim`. Delete the `sr-only` H2 and pass a `headingId` into `SourcePanel` so `Card source` is one heading at one size. Raise the 10px patterns to 11px. Darken the avatar gradient or switch initials to a fixed dark ink.

**Suggested command:** `/impeccable typeset`

### [P2] `Card source` is 40% of the page's words and restates everything above it

**What.** On `intent-router`: 1239 words total, **496 (40.0%) inside `#card-source`**. The YAML re-prints `name`, `type`, `phase`, `action` verbatim, `tools`, `params`, `inputs`, `outputs`, `dependencies`, `cannot`, `notes`, `version`, `author`. The digest appears a third time. The panel is a 309px window onto 1066px of content that scrolls in two axes — and its min-content width of 783px is the direct cause of P0-1.

For context, commit 8748852 cut the site from 860 → 605 words per page. This route is at 1090–1239.

**Fix.** Once `spec` is promoted, collapse `#card-source` to a closed `<details>` summarising `53 lines · intent-router@2.0.0.yaml` with copy and download inline. Move the free-text gloss — currently rendered verbatim once per row, twice per page, 60px apart — into the panel footnote that already exists.

**Suggested command:** `/impeccable distill`

## Persona Red Flags

**Alex (power user)** — loses to his own terminal. No TOC or jump links on a 4316px page; the two anchors that exist are linked from nowhere. The only accelerator, `copy` at 44×23px, copies the entire file — no per-field copy for the digest, ref, or a port type. The full digest exists only in a `title` tooltip: unselectable, uncopyable. The values he scans first (`2 in · 2 out`, `2 versions published`) sit 425–558px from their labels. To read `spec` he must tab to item 14 of 14 and arrow through a 1066px nested scroller; `cat content/cards/intent-router@2.0.0.yaml` is strictly faster.

**Sam (screen reader + keyboard)** — `<h2 class="sr-only">Card source</h2>` sits directly above `SourcePanel`'s visible title, so the heading is announced twice. `NodeInterfaces.tsx:123` puts the port name in a `<td>`, not `<th scope="row">`, so tab order announces "Ontology data type: json" three identical times with nothing saying which port each belongs to. The `<aside>` has no accessible name. The full digest and "Seeded, no counter stands behind it" exist only in `title` — invisible to keyboard and touch. **8 of 15** interactive targets are under 24px tall (WCAG 2.2 SC 2.5.8). Credit where due: `<div role="group" tabIndex={0} aria-label="Card source, scrollable">` is correct and rare.

**Casey (mobile)** — the P0 in full: ~440px of every panel clipped with `scrollX` locked at 0, Identity showing four labels and zero values. H1 is `text-4xl` with no responsive step, so 36px at 390px. Page height 4847–5563px, 5.7–6.6 screens. `secret-access` / `unchecked-write` sit ~3000px down, below a raw YAML dump, and never appear in the header.

## Minor Observations

- `components/blueprint/Comments.tsx:57` hard-codes "this **blueprint** has none", the final sentence of all 53 node pages.
- `Interfaces` prints its counts twice ~40px apart: the meta `2 in · 2 out`, then `INPUTS 2` / `OUTPUTS 2`.
- `components/ui/Button.tsx:10` uses `shadow-[0_0_24px_-6px_var(--color-cyan)]` — a zero-offset coloured halo, which is decoration rather than depth. Fires on "Download card" on every page.
- Header chips use `py-0.5` (2px vertical) on an 11px font.
- Nested bordered boxes reach depth 2 (three border levels) in "Model, skill and servers": `.panel` → ReachList frame → per-field box.
- **`.route-box` is used nowhere on this page**, though `globals.css:147-201` states "every box whose job is to send a reader somewhere else wears this, and nothing else does." This page has ~8 outbound links and zero route-boxes.
- The `→` connector in `ReachList` computes 1.87:1 and is `aria-hidden`. The file calls it "the pointing" — the figure's central semantic device — so it is invisible to low-vision readers and to AT simultaneously.
- The aside is 629px on `merge-executor` with `lg:top-20`; under a 709px-tall viewport the bottom of `Identity` is unreachable while stuck.
- Three "seeded / not built" disclosures per page. Down from the site's ~30, but still three on one card.
- Confirmed **absent** on this page: the `doc N §X` spec citations flagged site-wide. All 10 `aria-label`s are clean prose. Heading outline has no skipped levels.

## Questions to Consider

1. If `spec` is "the payload delivered to Claude Code when the graph is instantiated", why is the page's largest region a scroll window onto the file rather than the page rendering `spec` as its Behaviour lead? Once spec is on the page, is download + digest not the entire remaining job of `Card source`?
2. The header spends a chip on `cannot · 2 declared`. Does someone deciding whether to wire `merge-executor` care more that it declares two prohibitions, or that it declares `secret-access` and `unchecked-write`?
3. `globals.css:147` says a box that sends a reader off the page wears `.route-box`, "and nothing else does." This page has eight exits and zero. Is the rule about boxes only — and if so, what is the labyrinth problem it was written to solve on a page this link-dense?
4. Commit 8748852 cut the site to 605 words per page. This route is at 1239, and 496 of those are a file the reader can download with the button already in the header. Was this route in scope, or does it get an exemption nobody wrote down?
5. `Cannot receive` says a free-text entry is "a sentence addressed to a person" that "nothing checks." But `spec` is also a sentence addressed to a reader — an agent — and it *is* what enforces those entries. Is the enforced/free-text distinction the page draws the one the engine draws, or is it "checkable by the resolver" versus "checkable by the model", rendered as "real" versus "decorative"?
