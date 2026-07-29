# Content & CLI — design spec

Date: 2026-07-29
Status: approved, ready for implementation planning

Scope: four content/positioning changes, grouped because they're all about explaining
what the site lets you *do* rather than visual styling or new interactive functionality.

1. Landing page — "what you can do with a blueprint/node" usage framing
2. `npx darkprint setup` CLI callout (marked coming soon)
3. New `/install` page (context7.com/install-style, marked coming soon)
4. `/build` page — live "dark factory" classification during the guided path

Related spec: `2026-07-29-visual-polish-design.md` (Group A, introduces `AutonomyBar`,
reused here in item 4). A third group (semantic search) was brainstormed and then
deliberately deferred — no spec was written for it.

---

## Scope decision: no real MCP server yet

The original ask included "access blueprints and nodes via MCP." The site currently states
explicitly (`app/towards-a-dark-factory/the-climb/page.tsx:412`): *"there are no accounts,
no votes and no telemetry, and there is no MCP server to point a client at yet."* Building
an actual MCP server + published `darkprint` CLI package is a substantial, separate
engineering project (hosting, protocol implementation, a package to publish) — explicitly
**out of scope** for this spec. This document covers only the marketing/positioning
surface (CLI callout + `/install` page), both honestly framed as upcoming. If/when the
real server is built, it gets its own design spec.

This framing is required by an existing project rule, not just prudence: `ContentCard.tsx`
cites **doc 2 §0.4** — "nothing may be described as working that is not built" — and
`SectionDoors.tsx`'s own comment applies the same rule to its one "build your own" line.
Every new surface in this spec must say plainly that MCP access isn't live yet, everywhere
the question arises (the same standard `SectionDoors` already holds itself to).

---

## 1. Landing page — usage framing

No new sections, no new paragraphs. The landing is deliberately minimal by an explicit,
recent, documented editorial pass (`SectionBlueprint.tsx`, `SectionNodeIsCard.tsx`
comments: "the copy is one sentence and stops," "suggestive and atmospheric, almost no
text," prior paragraphs moved to `/spec/topology` and `/spec/card`). Adding new blocks
would undo that work.

Instead, adjust the single `lead` sentence in each section's `SectionHeading` to pivot
from pure "what it is" toward "what you do with it," while staying one sentence:

- `SectionBlueprint.tsx` (`components/home/SectionBlueprint.tsx:127`) — current lead:
  "Which agents run, and what each one hands to the next." Add the usage angle to the
  same sentence (exact wording finalized at implementation time, e.g. closing on
  "...and it's yours to run as-is" or similar) — the point being a reader leaves knowing
  they can take this blueprint and run it, not just look at it.
- `SectionNodeIsCard.tsx` (`components/home/SectionNodeIsCard.tsx:272`) — current lead:
  "Open one and it says which model runs it and what must never reach it." Add the reuse
  angle (a card someone else published is pinnable into your own blueprint by
  `id@version`, the same mechanic the card drawing already shows).

No new links are added; the existing single link under each figure ("Open this
blueprint" / "Read this card") stays as the sole CTA, consistent with the one-link
pattern both sections already use.

---

## 2. `npx darkprint setup` CLI callout

Merged into the existing `SectionDoors` component (`components/home/SectionDoors.tsx`),
the landing's final "Read one, or build one" section — not a new standalone section.

- The existing two doors (`Browse the blueprints`, `Build your own`) and the three
  build-time counts (`PLATFORM_STATS`) are untouched.
- Add a third block within the same section: a visually prominent terminal-mockup panel
  showing `npx darkprint setup`, styled consistently with the section's existing
  `bg-blueprint-deep` / `bp-grid` chrome. This is intentionally more visually weighty than
  the section's current restrained prose (a deliberate trade-off, chosen over a minimal
  teaser line, because the CLI moment is worth making concrete even before it's live).
  Include a short (1-2 line) simulated preview of what the command will do once live
  (e.g. connecting to the registry, making blueprints/nodes available to an agent) —
  clearly distinguished as a preview, not live output.
- A clear "coming soon" label sits directly on the block (not just implied by context),
  and it links to `/install` for the full story. This satisfies doc 2 §0.4 the same way
  `SectionDoors`'s existing "nowhere to publish yet" line already does — state the
  limitation exactly where the capability is first suggested.

---

## 3. New `/install` page

New route, `app/install/page.tsx`, mirroring context7.com/install's structure:

- Tabs per MCP-capable client (Claude Code, Cursor, VS Code, etc.), each showing the
  config snippet that client will need once the server exists.
- A short explanation of what will be exposed: blueprints and node cards as MCP
  resources/tools an agent can pull directly, rather than browsing the gallery by hand.
- Every tab and the page header carry a clear, unavoidable "coming soon — not live yet"
  treatment. This is the one page on the site entirely *about* something unbuilt, so it
  has to be the clearest about that fact, not the least clear.
- No signup/waitlist form — there's no backend to collect it against (doc 2 §0.4 /
  PROJECT.md's "no accounts" stance). Instead, a link back to `/blueprints` and to the
  project's GitHub (if a public repo link already exists sitewide — reuse whatever the nav
  already links to, don't invent a new external link).
- Add to primary nav / footer wherever `/blueprints` and `/nodes` are already linked, so
  it's discoverable the same way those are.

---

## 4. `/build` — live "dark factory" classification

`components/build/ScorePanel.tsx` (the sticky panel that stays visible through all 7
steps, per doc 2 §5.7) and its narrow-viewport counterpart `ScoreStrip` already show the
autonomy class live as the reader's choices change it (`autonomy.label`, e.g. "Supervised"
→ "Closed-loop"). This is the same reversal decision made in Group A, applied to a second
surface — not a new decision.

- Reuse `AutonomyBar` (introduced in the visual-polish spec, Group A) inside
  `ScorePanel`/`ScoreStrip`, next to the existing class label, driven by the same
  `AutonomyResult` (`level`, `autonomyClass`) already flowing into these components today.
  All 80 combinations are pre-verified through the real engine at build time
  (`path.test.ts`'s `ALL_COMBINATIONS` walk), so no new client-side analysis logic is
  needed — this is wiring, not new computation.
- When the reader's choices land on zero human-in-the-loop nodes, the bar fills fully
  (level 4 / emerald) and reads the same way a published blueprint card's bar would,
  making the "dark factory" designation visible live rather than only discoverable after
  download.
- `ScorePanel.tsx`'s module comment is a sixth place (alongside the five listed in the
  visual-polish spec) that documents the no-ordinal rule and needs the same dated
  exception note pointing at this spec and the visual-polish spec.
- No change to `Was`, `Rationale`, security scoring, or any other part of the panel — this
  spec only adds the bar next to the existing autonomy label.
