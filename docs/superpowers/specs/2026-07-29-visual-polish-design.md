# Visual polish — design spec

Date: 2026-07-29
Status: approved, ready for implementation planning

Scope: four independent visual changes, grouped because they're all "look and feel"
rather than new functionality or content.

1. Blueprint card — autonomy segment bar (top of card)
2. Blueprint card — background transparency (cyanotype grid across the card body)
3. Site-wide monospace font swap (Geist Mono → JetBrains Mono)
4. Hero wordmark — wiring/draw entrance animation

Related spec: `2026-07-29-content-cli-design.md` (Group B). A third group (semantic search
on the blueprint/node listing pages) was brainstormed and then deliberately deferred —
no spec was written for it; revisit from scratch when it's picked back up.

---

## 1. Blueprint card — autonomy segment bar

### The rule this reverses

The project has a deliberate, previously-tested, five-times-documented principle:
**no autonomy ordinal on any user-facing surface.** Sources:

- `PROJECT.md:36` — "no autonomy ordinal on any user-facing surface"
- `architecture/engine.md:63` — "Doc 2 §1.1 is enforced by tests here: no ordinal on any surface"
- `files/darkprint-ontology-v0.1.md:125` (source spec, Italian) — "mai come *N su 4* con
  barra di progresso" ("never as *N out of 4* with a progress bar")
- `components/ui/AutonomyMeter.tsx` module comment — explicitly names "a four-segment
  gauge... no fill, no greyed remainder" as the rejected pattern, and "every class now
  renders identically" (no class → color ramp)
- `files/darkprint-onboarding-positioning.md:236` — a human-in-the-loop choice "must not
  look like a penalty"

This is a **deliberate, informed reversal**, not an oversight. The reasoning for the
original rule stays valid (autonomy is descriptive, not a grade; a blueprint with a human
gate is not a worse blueprint) — but the card is getting a segmented, filled, per-level
colored gauge anyway, because that's what was asked for. The reversal is scoped
**narrowly**: it adds one new visual element to the card. It does not touch:

- `AutonomyMeter.tsx`'s existing row (class label, dark-factory token, "N nodes wait for a
  person") — unchanged.
- The tested rule that the alarm/signal color (`--color-signal` / `text-signal`) may never
  sit near the human-presence glyph (`autonomy-surfaces.test.ts`, "the indicator's colour"
  block) — none of the 4 segment colors is signal red, so this test is unaffected and
  must keep passing.
- Sorting/filtering — the gallery still never sorts by autonomy (only filters), per
  `GalleryBrowser.tsx`'s existing behavior.

### What to build

A thin (≈4–6px) horizontal bar spanning the full width of the card, at the very top edge
(above the existing `h-40` thumbnail preview panel in `components/ui/ContentCard.tsx`),
divided into 4 equal segments with a small gap (≈2px) between them, rounded to match the
card's `rounded-lg` top corners.

Segment coloring, one color per level, keyed off `AutonomyResult.level` (1–4) /
`autonomyClass`:

| Level | Class | Color | Token |
|---|---|---|---|
| 1 | assisted | violet | `--color-violet` `#a78bfa` |
| 2 | supervised | amber | `--color-amber` `#ffb020` |
| 3 | conditional | cyan | `--color-cyan` `#38bdf8` |
| 4 | closed-loop | emerald | `--color-emerald` `#34d399` |

Segments `1..level` render filled in their respective color; segments beyond `level` stay
dim/neutral (`--color-line`, matching the card's existing border tone). E.g. a
"Conditional" (level 3) blueprint shows violet, amber, cyan filled, and the 4th segment
dim.

This is a genuine gauge — closer to the exact pattern the source spec named as rejected
(color ramp from dim/cool to warm to "pass" colors) than a purely categorical alternative
would have been. That trade-off was discussed explicitly with the project owner and
chosen deliberately over a non-ordinal alternative (a single flat color chip with no
segments/fill).

### Accessibility

Keep an `aria-label` / `sr-only` text on the bar mirroring what `AutonomyMeter` already
computes (e.g. "Autonomy class: Conditional (level 3 of 4)"), and a `title` attribute for
a mouse user, matching the pattern `AutonomyMeter` already uses (`title={full}`). The bar
is decorative-primary (conveys real information) rather than purely decorative, so it needs
a real accessible name, not `aria-hidden`.

### New component

Add a small new component (e.g. `components/ui/AutonomyBar.tsx`) rather than folding this
into `AutonomyMeter.tsx`, since it's visually and structurally a different element (card
top strip vs. inline row) with a different job. `ContentCard.tsx` renders it above the
`h-40` thumbnail div.

### Documentation to update as part of implementation

Don't delete the old rationale — annotate the reversal in place, dated, so there's a paper
trail:

- `PROJECT.md:36` — note that the top-of-card gauge is an intentional, dated exception to
  the no-ordinal rule, and why (see this spec).
- `architecture/engine.md:63` — same note, pointing at the new component.
- `components/ui/AutonomyMeter.tsx` module comment — add a note that a *separate* component
  (`AutonomyBar`) now renders a segmented gauge on the card top, and that this file's own
  "no ordinal" behavior is intentionally kept for the inline row.
- Leave the historical spec text in `files/*.md` untouched (those are frozen source docs);
  the amendment lives in `PROJECT.md`/`architecture/` and code comments, not by editing
  history.

---

## 2. Blueprint card — background transparency

Extend the existing `.bp-grid` utility class (already defined in `app/globals.css`,
currently used only on the `h-40` thumbnail panel at 22%/10%/6% blueprint-line opacity) to
the full card, applied on top of the existing `bg-surface` background — not the
`bg-blueprint-deep/40` tint wash that the thumbnail panel also has, just the grid-line
texture. The intent: the whole card reads as "a sheet of the blueprint" rather than only
its preview window looking that way. Opacity stays as defined in `.bp-grid` today (it's
already subtle); no legibility regression expected for card body text since the pattern
is line-only, not a fill.

Implementation: add the `bp-grid` class to the outer card container (or the body `<div>`)
in `components/ui/ContentCard.tsx`, removing the redundancy of it being scoped only to the
preview panel.

---

## 3. Site-wide monospace font swap

Replace **Geist Mono** with **JetBrains Mono** as the site's `--font-mono`.

- `app/layout.tsx` — swap the `next/font/google` import from Geist Mono to JetBrains Mono
  (available on Google Fonts, so no new hosting/licensing setup needed), keep the same
  weight range currently loaded.
- `app/globals.css`'s `@theme inline` block — `--font-mono` binds to the new font's CSS
  variable, same as today's `var(--font-geist-mono)` pattern.

This is a global swap: every current mono use is affected — term/ID labels (the `Id`
component in `components/spec/parts.tsx`, which is what renders things like
`acceptance-criteria`), `.eyebrow` labels, edge labels in graph figures, nav, metadata
rows, etc. No visual redesign of *where* mono is used — only which typeface renders it.

---

## 4. Hero wordmark — wiring/draw entrance animation

### Current behavior (baseline, unchanged except where noted)

`components/hero/Wordmark.tsx` runs a 4-beat anime.js timeline once the hero scrolls into
view (`useReveal`, `phase === "shown"`):

1. letters arrive (`splitText` + `stagger`, opacity/translateY/scale, center-out, 58ms
   stagger, 880ms `outExpo`) — **this is the beat being replaced**
2. a rule is drawn under the name (`svg.createDrawable` + `draw` prop)
3. the name settles (spring overshoot)
4. one pass of light crosses the letters (opacity flicker stagger)

The file's existing invariant is preserved untouched: SSR, no-JS, and reduced-motion
readers always get the finished heading with no animation runtime at all
(`useReveal`'s `static` phase short-circuits before any of this runs). Nothing about that
gating changes.

### What changes

Only beat 1 (`AT.letters`). Instead of a plain opacity/translateY/scale fade-in, each
letter:

1. **Draws** — appears as a stroke-only outline of its own glyph shape, tracing itself in
   like a circuit/schematic line being sketched (`stroke-dashoffset` animated 1 → 0, the
   same drawing mechanic `svg.createDrawable` already uses for the rule under the
   wordmark — this reuses an established technique rather than introducing a new one).
2. **Instantiates** — once a letter's outline finishes drawing, it cross-fades: the
   stroke-only outline fades out while the real, solid DOM letter (today's final look —
   solid fill, cyan/blue glow) fades in.

Stagger timing follows the existing pattern (center-out, similar ~58ms per-letter offset),
sized so the whole beat still finishes before `AT.settle` (900ms) — beats 2–4 keep their
current timing untouched.

### Implementation approach

The word "DarkPrint" is fixed, so letter outline paths are **precomputed once**, not
generated at runtime:

- A one-time generation step (a small script using a font-outline library against the
  actual Space Grotesk Semibold font file) produces SVG path data for each of the 9
  letters, at the sizes/weights the wordmark uses.
- That path data is committed as a static TS constant (e.g. in `components/hero/`), not
  regenerated on every build or in the browser — no runtime font-parsing dependency.
- An absolutely-positioned SVG overlay, sized/positioned to exactly match the real `<h1>`
  span's box, renders these paths during the animated phase only. The real DOM text
  (`data-mark="mark"`) stays the source of truth throughout, exactly as it is today
  (`text.splitText` still cuts the real heading for the entrance; the SVG overlay is
  purely the "how it arrives" layer on top).
- Maintenance cost: if the display font or the word "DarkPrint" itself ever changes, the
  precomputed path data needs regenerating via the same script. This is called out
  explicitly as the trade-off for the more literal "wiring" effect, vs. a cheaper
  CSS-only wipe/flicker alternative that was considered and not chosen (less literal, but
  zero font-outline dependency).

### Accessibility / performance

No change to the accessible-name handling `splitText` already does (visually-hidden full
copy inserted, generated spans marked `aria-hidden`). No change to the "real DOM text at
SSR" invariant. The SVG overlay is `aria-hidden` throughout, same as the existing drawn
rule.
