# Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four visual changes — a segmented autonomy gauge on blueprint cards, a
full-card cyanotype grid, a site-wide monospace font swap, and a "wiring draw" entrance
for the hero wordmark.

**Architecture:** Each of the four pieces is an isolated, independently-shippable change
to existing components; nothing here introduces new data flow or new runtime
dependencies except one devDependency (`opentype.js`) used only by a one-time generation
script, not at runtime.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4 (`app/globals.css`'s `@theme`
tokens), anime.js v4.5 (`animejs`), vitest (`environment: "node"`, tests render via
`react-dom/server`'s `renderToStaticMarkup` and assert on the markup string — there is no
jsdom/testing-library in this repo).

## Global Constraints

- **No autonomy ordinal on any user-facing surface** is the project's own stated rule
  (`PROJECT.md:36`, doc 2 §1.1) — Task 2 of this plan is a **deliberate, documented
  exception** to it, not a violation to hide. Every place that states the rule gets a
  dated amendment note pointing at this plan (see Task 4). Nothing else in this codebase
  may start treating the rule as void.
- The alarm/signal color (`--color-signal` / `text-signal`) must never render near the
  human-presence glyph (`⏸`) — enforced by `components/ui/autonomy-surfaces.test.ts`.
  None of this plan's new code uses that color; running the full test suite after each
  task is how this stays true.
- SSR / no-JS / `prefers-reduced-motion: reduce` readers always get the finished,
  static page with zero animation runtime (`components/viz/useReveal.tsx`'s `static`
  phase). Nothing in Task 6 may change this invariant.
- `npm test` (vitest), `npm run typecheck` (tsc --noEmit), and `npm run build` must all
  pass after every task.

---

### Task 1: Site-wide monospace font swap (Geist Mono → JetBrains Mono)

**Files:**
- Modify: `app/layout.tsx:2,14-17,67`
- Modify: `app/globals.css:50`
- Modify: `components/viz/label-boxes.ts:58-69` (the `ADVANCE` constant — see below, this
  is the load-bearing part of this task, not a side detail)
- Modify: `PROJECT.md:188-194` (the ADVANCE derivation is documented there too)
- Test: existing `components/home/graph.test.ts`, `components/home/roles-labels.test.ts`,
  `components/viz/scene-labels.test.ts` (no new test file — these three already cover
  every luminous figure on the site, 16 drawers / 27 frames, and are the regression
  suite this task must keep green)

**Why `ADVANCE` is part of this task, not a follow-up:** `label-boxes.ts:60-69` documents
that the constant `0.62` was derived from **Geist Mono specifically** — `next/font`
generates a local-font fallback with a computed `size-adjust` percentage tuned to the
real font's metrics, and that computed value (`134.59%`) times Arial's mean advance
(`0.4458em`) is what produces the `0.600` measurement the `0.62` margin sits on. Swapping
the font changes that computed `size-adjust` (JetBrains Mono has different real metrics
than Geist Mono), which can silently invalidate the constant every SVG label
collision-detection test in the repo depends on. This must be re-measured, not assumed.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `--font-mono` now resolves to JetBrains Mono everywhere `font-mono` is used
  (unaffected by later tasks). `ADVANCE` in `label-boxes.ts` — later tasks don't touch it.

- [ ] **Step 1: Swap the font import and CSS binding**

In `app/layout.tsx`, change:

```ts
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
```
to:
```ts
import { Geist, JetBrains_Mono, Space_Grotesk } from "next/font/google";
```

Replace the `geistMono` declaration:
```ts
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```
with:
```ts
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});
```

Update the body `className` at line 67 from
`` `${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased` ``
to
`` `${geistSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased` ``.

In `app/globals.css:50`, change:
```css
--font-mono: var(--font-geist-mono);
```
to:
```css
--font-mono: var(--font-jetbrains-mono);
```

- [ ] **Step 2: Build once and extract JetBrains Mono's real fallback metrics**

Run:
```bash
npm run build
```

Then find the generated fallback `size-adjust` for JetBrains Mono (Next.js writes the
`@font-face` fallback declaration into the build's emitted CSS):
```bash
grep -r "size-adjust" .next/static/css/*.css
```

Note the `size-adjust` percentage next to the JetBrains Mono fallback (the one whose
`font-family` looks like `'jetbrains mono Fallback'` or similar — distinguish it from
the Geist/Space Grotesk fallback rules also present). Compute the new measured advance
the same way the existing comment does: `0.4458 × <new size-adjust ratio>`.

- [ ] **Step 3: Decide whether `ADVANCE` needs to change, and update it either way**

In `components/viz/label-boxes.ts`, the constant and its comment (lines 57-69) currently
read:

```ts
/**
 * Advance width of one character as a fraction of the font size.
 *
 * The shipped mono face advances at exactly 0.6 em: `app/layout.tsx` loads `Geist_Mono`
 * through `next/font`, whose generated fallback is `local(Arial)` at `size-adjust: 134.59%`,
 * and Arial's mean advance of 0.4458 em times that is 0.600. So 0.6 is the *measurement*
 * and carries no margin at all — two labels one rounding error apart would be reported
 * clear. 0.62 is the top of the range any mono face this site can land on, which is the
 * end a guard against collision has to take, and it is the constant
 * `components/home/graph.test.ts` was already written against; that file imports this one
 * rather than keeping a second copy, so the two cannot drift again.
 */
export const ADVANCE = 0.62;
```

If Step 2's computed value for JetBrains Mono is **less than or equal to 0.600**, `0.62`
is still a safe upper bound — update only the comment to record both fonts' measurements
(so the next reader isn't misled into thinking `0.62` is Geist-specific):

```ts
/**
 * Advance width of one character as a fraction of the font size.
 *
 * Geist Mono measured 0.600 em (next/font's fallback `size-adjust: 134.59%` × Arial's
 * mean advance 0.4458 em). JetBrains Mono measured <VALUE> em by the same method, after
 * the 2026-07-29 font swap (`app/layout.tsx`). 0.62 stays the guard's margin: it is the
 * top of the range any mono face this site has landed on, not a number tied to one font,
 * and `components/home/graph.test.ts` imports this constant rather than keeping a second
 * copy, so the two cannot drift.
 */
export const ADVANCE = 0.62;
```

If the computed value **exceeds 0.62**, raise `ADVANCE` to that new measurement plus the
same proportional margin the original derivation used (`0.62 / 0.600 ≈ 1.0333`, i.e.
~3.33% headroom over the raw measurement), and update the comment accordingly, e.g. for a
hypothetical measurement of 0.64: `0.64 × 1.0333 ≈ 0.6613`, so `ADVANCE = 0.6613`.

Also update `PROJECT.md`'s matching note (around line 191, "The shipped mono face
measures 0.600 exactly...") with the same correction, so the two documents don't
disagree.

- [ ] **Step 4: Run the full label-collision regression suite**

```bash
npx vitest run components/home/graph.test.ts components/home/roles-labels.test.ts components/viz/scene-labels.test.ts
```

Expected: all pass, with zero entries reported by `clippedLabels`, `collidingLabels`, or
`labelsOverBoxEdges` for any of the 27 frames. If any figure now reports a collision or
clip, the actual fix belongs in that figure's own layout (its own file, not
`label-boxes.ts`) — do not loosen the constant to make a real collision disappear.

- [ ] **Step 5: Run the full suite and typecheck**

```bash
npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css components/viz/label-boxes.ts PROJECT.md
git commit -m "Swap Geist Mono for JetBrains Mono site-wide, re-verify label ADVANCE metric"
```

---

### Task 2: `AutonomyBar` component

**Files:**
- Create: `components/ui/AutonomyBar.tsx`
- Test: `components/ui/AutonomyBar.test.ts` (note the `.ts` extension, not `.tsx` — this
  repo's `vitest.config.ts` only collects `components/**/*.test.ts`, and existing tests
  that render JSX from a `.test.ts` file use `createElement` rather than JSX syntax for
  exactly this reason; see `components/ui/scorecard-glance.test.ts`)

**Interfaces:**
- Consumes: `AutonomyLevel` type from `@/lib/types` (already `1 | 2 | 3 | 4`).
- Produces: `AutonomyBar({ level, label, className? })` — a React component. Deliberately
  typed against the two primitive fields (`level: AutonomyLevel`, `label: string`) rather
  than against `AutonomyInfo` or `AutonomyResult` directly, because Task 3 calls it with
  an `AutonomyInfo` (`item.autonomy` in `ContentCard.tsx`) and the Group B plan's `/build`
  task calls it with an `AutonomyResult` (`ScorePanel.tsx`) — both types carry `level` and
  `label` fields of the same shape, so this component works with either without importing
  either type.

- [ ] **Step 1: Write the failing test**

```ts
// components/ui/AutonomyBar.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AutonomyBar } from "@/components/ui/AutonomyBar";
import { plainText } from "@/components/ui/visible-text";

const LEVEL_COLOR = {
  1: "--color-violet",
  2: "--color-amber",
  3: "--color-cyan",
  4: "--color-emerald",
} as const;

function render(level: 1 | 2 | 3 | 4, label: string): string {
  return renderToStaticMarkup(createElement(AutonomyBar, { level, label }));
}

describe("AutonomyBar", () => {
  it("names the class and the level in its accessible text", () => {
    const html = render(3, "Conditional");
    expect(plainText(html)).toContain("Conditional");
    expect(html).toContain('aria-label="Autonomy class Conditional, level 3 of 4"');
  });

  it("fills exactly the segments up to and including the level, each in its own color", () => {
    const html = render(3, "Conditional");
    // Segments 1-3 (violet, amber, cyan) are filled; segment 4 (emerald) is not.
    expect(html).toContain(LEVEL_COLOR[1]);
    expect(html).toContain(LEVEL_COLOR[2]);
    expect(html).toContain(LEVEL_COLOR[3]);
    expect(html).not.toContain(LEVEL_COLOR[4]);
  });

  it("fills only the first segment at level 1", () => {
    const html = render(1, "Assisted");
    expect(html).toContain(LEVEL_COLOR[1]);
    expect(html).not.toContain(LEVEL_COLOR[2]);
    expect(html).not.toContain(LEVEL_COLOR[3]);
    expect(html).not.toContain(LEVEL_COLOR[4]);
  });

  it("fills all four segments at level 4", () => {
    const html = render(4, "Closed-loop");
    expect(html).toContain(LEVEL_COLOR[1]);
    expect(html).toContain(LEVEL_COLOR[2]);
    expect(html).toContain(LEVEL_COLOR[3]);
    expect(html).toContain(LEVEL_COLOR[4]);
  });

  it("never renders the alarm/signal color", () => {
    for (const level of [1, 2, 3, 4] as const) {
      const html = render(level, "x");
      expect(html).not.toContain("--color-signal");
      expect(html).not.toContain("text-signal");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/AutonomyBar.test.ts`
Expected: FAIL — `Cannot find module '@/components/ui/AutonomyBar'` (the component
doesn't exist yet).

- [ ] **Step 3: Write the component**

```tsx
// components/ui/AutonomyBar.tsx
import type { AutonomyLevel } from "@/lib/types";
import { cx } from "@/lib/format";

/* ============================================================
   The segmented autonomy gauge — a deliberate, documented exception
   to "no autonomy ordinal on any user-facing surface" (PROJECT.md,
   doc 2 §1.1). See docs/superpowers/specs/2026-07-29-visual-polish-design.md
   §1 for the full reasoning and docs/superpowers/plans/2026-07-29-visual-polish.md
   Task 4 for where the rest of the codebase notes this amendment.

   AutonomyMeter.tsx's inline row is untouched and keeps the
   no-ordinal behavior; this is a separate, additive element.
   ============================================================ */

const SEGMENT_COUNT = 4;

/** One color per level, fixed — segment N is always this color when filled, regardless
    of which level the blueprint actually reached. */
const LEVEL_COLOR: Record<AutonomyLevel, string> = {
  1: "var(--color-violet)",
  2: "var(--color-amber)",
  3: "var(--color-cyan)",
  4: "var(--color-emerald)",
};

const SEGMENTS = [1, 2, 3, 4] as const satisfies readonly AutonomyLevel[];

export interface AutonomyBarProps {
  /** 1-4. Segments 1..level render filled; the rest render dim/neutral. */
  level: AutonomyLevel;
  /** The class name in title case, e.g. "Closed-loop" — for the accessible name only. */
  label: string;
  className?: string;
}

/** A thin, 4-segment gauge for the card top: which segments are filled says the level. */
export function AutonomyBar({ level, label, className }: AutonomyBarProps) {
  const accessibleName = `Autonomy class ${label}, level ${level} of ${SEGMENT_COUNT}`;

  return (
    <div
      role="img"
      aria-label={accessibleName}
      title={accessibleName}
      className={cx("flex gap-0.5", className)}
    >
      {SEGMENTS.map((segment) => (
        <span
          key={segment}
          aria-hidden
          className="h-1.5 flex-1 first:rounded-l-sm last:rounded-r-sm"
          style={{
            background: segment <= level ? LEVEL_COLOR[segment] : "var(--color-line)",
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/ui/AutonomyBar.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite and typecheck**

```bash
npm test && npm run typecheck
```

Expected: all pass — in particular `components/ui/autonomy-surfaces.test.ts`'s "found the
pages" count check still passes (this new file only increases the count).

- [ ] **Step 6: Commit**

```bash
git add components/ui/AutonomyBar.tsx components/ui/AutonomyBar.test.ts
git commit -m "Add AutonomyBar, a segmented autonomy gauge for card and panel surfaces"
```

---

### Task 3: Wire `AutonomyBar` into `ContentCard`, extend the cyanotype grid to the full card

**Files:**
- Modify: `components/ui/ContentCard.tsx:44-56` (the outer `Link` and the preview `div`)
- Test: no new test file; existing `components/ui/scorecard-glance.test.ts` and
  `components/ui/autonomy-surfaces.test.ts` must stay green (they render/scan
  `ContentCard`'s neighbors and siblings; nothing in this task changes `AutonomyMeter`
  call sites, so the "passes contributions at every call site" rule is unaffected)

**Interfaces:**
- Consumes: `AutonomyBar` from Task 2 (`{ level, label }` props).
- Produces: nothing new consumed by later tasks in this plan; the Group B plan's `/build`
  task consumes `AutonomyBar` from Task 2 directly, not from this task.

- [ ] **Step 1: Add a rendering smoke-check to lock in the expected markup shape**

There's no existing `ContentCard.test.ts`, and this repo's convention (per
`scorecard-glance.test.ts`) is to test cross-cutting concerns against the real content
archive rather than a fabricated fixture. Add a small check to
`components/ui/autonomy-surfaces.test.ts` — it already scans every `.tsx` file in `app/`
and `components/`, so add one more targeted assertion there rather than a new file:

In `components/ui/autonomy-surfaces.test.ts`, after the existing `"the file tree renders
something"` block, add:

```ts
describe("the card's autonomy bar sits above the thumbnail, not inside AutonomyMeter", () => {
  it("ContentCard renders AutonomyBar and AutonomyMeter as siblings, not nested", () => {
    const card = STRIPPED.find((f) => f.path === "components/ui/ContentCard.tsx");
    expect(card).toBeDefined();
    expect(card!.text).toContain("<AutonomyBar");
    expect(card!.text).toContain("<AutonomyMeter");
    // AutonomyBar must not be inside AutonomyMeter.tsx itself — the two surfaces stay
    // separate (see the visual-polish spec §1: additive, not a replacement).
    const meter = STRIPPED.find((f) => f.path === "components/ui/AutonomyMeter.tsx");
    expect(meter).toBeDefined();
    expect(meter!.text).not.toContain("<AutonomyBar");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/autonomy-surfaces.test.ts`
Expected: FAIL — `ContentCard.tsx` does not yet contain `<AutonomyBar`.

- [ ] **Step 3: Wire it in**

In `components/ui/ContentCard.tsx`, add the import:

```ts
import { AutonomyBar } from "./AutonomyBar";
```

Change the outer `Link` (currently):
```tsx
    <Link
      href={contentHref(item)}
      className={cx(
        "group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--color-cyan)]",
        className,
      )}
    >
```
to add `bp-grid` so the faint grid texture covers the whole card, not just the preview:
```tsx
    <Link
      href={contentHref(item)}
      className={cx(
        "group flex flex-col overflow-hidden rounded-lg border border-line bg-surface bp-grid transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--color-cyan)]",
        className,
      )}
    >
```

Change the preview `div` (currently):
```tsx
      {/* preview */}
      <div className="relative h-40 overflow-hidden border-b border-line bg-blueprint-deep/40 bp-grid">
        <GraphThumbnail
```
to add the bar as the first child:
```tsx
      {/* preview */}
      <div className="relative h-40 overflow-hidden border-b border-line bg-blueprint-deep/40 bp-grid">
        <AutonomyBar
          level={item.autonomy.level}
          label={item.autonomy.label}
          className="absolute inset-x-0 top-0 z-10"
        />
        <GraphThumbnail
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/ui/autonomy-surfaces.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite, typecheck, and build**

```bash
npm test && npm run typecheck && npm run build
```

Expected: all pass. The build also re-runs `scripts/generate-bundles.ts`
(`prebuild`), which is unrelated to this change but must still succeed.

- [ ] **Step 6: Visual check**

```bash
npm run dev
```

Open `/blueprints` in a browser. Confirm: every card shows a thin 4-segment bar at its
very top edge, colored per its autonomy level (check at least one card of each level —
cross-reference each card's autonomy label against `content/blueprints/*.yaml` if needed
to find one of each level), and the card body now shows a faint grid texture across its
whole surface, not just the thumbnail.

- [ ] **Step 7: Commit**

```bash
git add components/ui/ContentCard.tsx components/ui/autonomy-surfaces.test.ts
git commit -m "Show AutonomyBar on every card top, extend the cyanotype grid to the full card"
```

---

### Task 4: Annotate the no-ordinal rule reversal in place

**Files:**
- Modify: `PROJECT.md:36`
- Modify: `architecture/engine.md:63`
- Modify: `components/ui/AutonomyMeter.tsx` (module comment, currently lines ~1-29)

**Interfaces:**
- Consumes: nothing (docs-only task).
- Produces: nothing consumed by later tasks.

This task has no test — it's prose. Do it as one step per file.

- [ ] **Step 1: `PROJECT.md`**

Find this line (currently line 36):
```markdown
- **no autonomy ordinal on any user-facing surface** — the class name is what a reader sees;
```

Change it to:
```markdown
- **no autonomy ordinal on any user-facing surface** — the class name is what a reader
  sees, **except** the segmented gauge on the top edge of a blueprint card and the
  `/build` score panel (`components/ui/AutonomyBar.tsx`), added 2026-07-29 as a
  deliberate, informed exception — see `docs/superpowers/specs/2026-07-29-visual-polish-design.md`
  §1 for why. Nowhere else on the site may add a second one without the same review;
```

- [ ] **Step 2: `architecture/engine.md`**

Find this line (currently line 63):
```markdown
ranking, no badge. Doc 2 §1.1 is enforced by tests here: no ordinal on any surface, no
```

The full sentence currently reads (lines 62-64):
```markdown
A graph one gate short of it is not "nearly" anything. It is a supervised graph, which is a
legitimate thing to be. Doc 2 §1.1 is enforced by tests here: no ordinal on any surface, no
ranking, no badge.
```

Add a note directly after it:
```markdown
A graph one gate short of it is not "nearly" anything. It is a supervised graph, which is a
legitimate thing to be. Doc 2 §1.1 is enforced by tests here: no ordinal on any surface, no
ranking, no badge.

**Amended 2026-07-29:** `components/ui/AutonomyBar.tsx` is a deliberate, documented
exception — a segmented gauge on the blueprint card top and the `/build` score panel.
See `docs/superpowers/specs/2026-07-29-visual-polish-design.md` §1. The rule above still
holds everywhere else; this is the one named exception, not a repeal.
```

- [ ] **Step 3: `components/ui/AutonomyMeter.tsx`**

In the module comment (the block starting `/**` at the top of the file, which currently
ends around line 29 with `*/`), add a paragraph before the closing `*/`:

```ts
 * ── The one named exception ──
 * Added 2026-07-29: `components/ui/AutonomyBar.tsx` renders a *separate* component — a
 * segmented gauge on the blueprint card's top edge and the `/build` score panel — that
 * deliberately does show level as a filled/empty 4-segment bar. It is not rendered by
 * this file and does not change anything below: this component's own row (the class
 * label, the dark-factory token, "N nodes wait for a person") keeps the no-ordinal
 * behavior described above, unchanged. See
 * `docs/superpowers/specs/2026-07-29-visual-polish-design.md` §1 for the reasoning.
 */
```

- [ ] **Step 4: Run the full suite and typecheck**

```bash
npm test && npm run typecheck
```

Expected: all pass (prose-only change; confirms nothing was broken by editing near code).

- [ ] **Step 5: Commit**

```bash
git add PROJECT.md architecture/engine.md components/ui/AutonomyMeter.tsx
git commit -m "Document the AutonomyBar exception to the no-ordinal rule in place"
```

---

### Task 5: Generate hero wordmark letter path data

**Files:**
- Create: `scripts/generate-wordmark-paths.ts`
- Create: `components/hero/wordmark-paths.ts` (generated output, committed)
- Modify: `package.json` (devDependencies + a new script)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `WORDMARK_LETTER_PATHS: readonly { char: string; d: string; advance: number }[]`
  exported from `components/hero/wordmark-paths.ts` — one entry per character of
  "DarkPrint", `d` is an SVG path string in a 100-unit-tall em box, `advance` is the
  horizontal distance (same units) to the next letter's origin. Task 6 consumes this
  directly.

**Setup — a font file is required and is not fetched by the script:**

`next/font/google` downloads Space Grotesk automatically at build time but does not
leave a plain font file on disk anywhere in this repo, so the generation script needs one
provided manually, once. Download the Space Grotesk static family from
<https://fonts.google.com/specimen/Space+Grotesk> ("Get font" → the family ships static
weight files, e.g. `SpaceGrotesk-SemiBold.ttf`), unzip it locally, and note the path to
the SemiBold (600) file — that's the weight `Wordmark.tsx` renders at (`font-semibold`).

- [ ] **Step 1: Add the devDependency**

```bash
npm install --save-dev opentype.js@^1.3.5 @types/opentype.js@^1.3.10
```

`opentype.js` 1.x is pinned deliberately: `@types/opentype.js` is versioned against the
1.x API, and opentype.js 2.0.0 is a separate major that the types package does not cover.

- [ ] **Step 2: Write the generation script**

```ts
// scripts/generate-wordmark-paths.ts

/* ============================================================
   One-time generator for the hero wordmark's letter outline paths.

   Run manually (not part of `npm run build`) whenever MARK below
   changes, or whenever the display font changes away from Space
   Grotesk Semibold (600):

     WORDMARK_FONT_PATH=/path/to/SpaceGrotesk-SemiBold.ttf \
       node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
       scripts/generate-wordmark-paths.ts

   Output is committed as components/hero/wordmark-paths.ts — no font-parsing
   dependency exists at runtime or at `next build` time, only in this script.
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as opentype from "opentype.js";

/** `components/hero/Wordmark.tsx`'s `MARK` constant. Keep the two in sync by hand. */
const MARK = "DarkPrint";

/** The em-square height the generated paths are scaled to; `Wordmark.tsx`'s overlay SVG
    sizes its viewBox to match. Arbitrary but must match on both sides. */
const UNITS_PER_EM_SIZE = 100;

const fontPath = process.env.WORDMARK_FONT_PATH;
if (fontPath === undefined || fontPath === "") {
  throw new Error(
    "Set WORDMARK_FONT_PATH to a local Space Grotesk SemiBold (600) .ttf/.otf file. " +
      "Download the static family from https://fonts.google.com/specimen/Space+Grotesk",
  );
}

const buffer = readFileSync(fontPath);
const arrayBuffer = buffer.buffer.slice(
  buffer.byteOffset,
  buffer.byteOffset + buffer.byteLength,
);
const font = opentype.parse(arrayBuffer as ArrayBuffer);

interface WordmarkLetterPath {
  char: string;
  /** SVG path `d` attribute, in a `UNITS_PER_EM_SIZE`-tall em box, drawn from x=0. */
  d: string;
  /** Horizontal advance to the next letter's origin, same units. */
  advance: number;
}

const letters: WordmarkLetterPath[] = [];
for (const char of MARK) {
  const glyph = font.charToGlyph(char);
  const path = glyph.getPath(0, 0, UNITS_PER_EM_SIZE);
  const advance = (glyph.advanceWidth * UNITS_PER_EM_SIZE) / font.unitsPerEm;
  letters.push({ char, d: path.toPathData(2), advance });
}

const output = `/* ============================================================
   Generated by scripts/generate-wordmark-paths.ts — do not hand-edit.
   Regenerate if MARK in components/hero/Wordmark.tsx changes, or if
   the display font changes away from Space Grotesk Semibold (600).
   ============================================================ */

export interface WordmarkLetterPath {
  char: string;
  d: string;
  advance: number;
}

/** One entry per character of "${MARK}", in a ${UNITS_PER_EM_SIZE}-unit-tall em box. */
export const WORDMARK_LETTER_PATHS: readonly WordmarkLetterPath[] = ${JSON.stringify(letters, null, 2)} as const;
`;

const outPath = fileURLToPath(new URL("../components/hero/wordmark-paths.ts", import.meta.url));
writeFileSync(outPath, output);
console.log(`Wrote ${letters.length} letter paths to components/hero/wordmark-paths.ts`);
```

Add the run script to `package.json`'s `"scripts"` block, alongside `prebuild`:
```json
    "generate:wordmark": "node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generate-wordmark-paths.ts",
```

- [ ] **Step 3: Run it**

```bash
WORDMARK_FONT_PATH=/path/to/SpaceGrotesk-SemiBold.ttf npm run generate:wordmark
```

Expected output: `Wrote 9 letter paths to components/hero/wordmark-paths.ts`.

- [ ] **Step 4: Verify the output's shape**

```bash
node -e "
const { WORDMARK_LETTER_PATHS } = require('./components/hero/wordmark-paths.ts');
" 2>/dev/null || npx tsx -e "
import { WORDMARK_LETTER_PATHS } from './components/hero/wordmark-paths.ts';
console.log(WORDMARK_LETTER_PATHS.length, WORDMARK_LETTER_PATHS.map(l => l.char).join(''));
console.log(WORDMARK_LETTER_PATHS.every(l => l.d.length > 0 && l.advance > 0));
"
```

Expected: `9 DarkPrint` and `true` (every letter has non-empty path data and positive
advance — a space or an unsupported glyph would produce an empty `d`, which would mean
the font file doesn't cover a character and needs checking).

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: PASS. If `opentype.js`'s 1.x types don't line up exactly with the `parse`/
`charToGlyph`/`getPath`/`toPathData` call shapes used above, fix the script's usage to
match what `@types/opentype.js` actually declares (check
`node_modules/@types/opentype.js/index.d.ts`) rather than suppressing the error.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-wordmark-paths.ts components/hero/wordmark-paths.ts package.json package-lock.json
git commit -m "Generate hero wordmark letter outline paths for the wiring-draw entrance"
```

---

### Task 6: Wordmark entrance — draw then instantiate

**Files:**
- Modify: `components/hero/Wordmark.tsx` (beat 1 only — `AT.letters`, lines ~117-145,
  ~130 for the initial `utils.set`)
- Test: `components/hero/Wordmark.test.ts` (new)

**Interfaces:**
- Consumes: `WORDMARK_LETTER_PATHS` from Task 5 (`components/hero/wordmark-paths.ts`).
- Produces: nothing consumed elsewhere in either plan.

- [ ] **Step 1: Write the failing test for the static/no-JS invariant**

This is the one property that must survive this change and is testable without a
browser: a server render (which is what a no-JS reader and a `prefers-reduced-motion`
reader both get, per `useReveal`'s `static` phase) must still show "DarkPrint" as plain,
findable text, and the new trace overlay must not be visible in that state.

```ts
// components/hero/Wordmark.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wordmark } from "@/components/hero/Wordmark";
import { plainText } from "@/components/ui/visible-text";

describe("Wordmark", () => {
  it("renders the finished name and claim as real text with no client JS", () => {
    const html = renderToStaticMarkup(createElement(Wordmark));
    const text = plainText(html);
    expect(text).toContain("DarkPrint");
    expect(text).toContain("Specifications go in. Software comes out.");
  });

  it("does not cut the heading into per-letter spans on the server", () => {
    // `useReveal`'s `static` phase never runs the layout effect, so `splitText` never
    // executes server-side and `data-mark="mark"` stays one plain text node.
    const html = renderToStaticMarkup(createElement(Wordmark));
    expect(html).not.toContain("dp-char");
  });

  it("renders the letter-trace overlay invisible by default", () => {
    // The trace overlay is a JS-only entrance effect; a reader who never runs the
    // animation must never see a half-drawn letter outline.
    const html = renderToStaticMarkup(createElement(Wordmark));
    expect(html).toContain('data-mark="trace"');
    expect(html).toMatch(/data-mark="trace"[^>]*class="[^"]*opacity-0/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails on the third assertion**

Run: `npx vitest run components/hero/Wordmark.test.ts`
Expected: the first two PASS already (nothing about them changes in this task); the
third FAILS because `data-mark="trace"` doesn't exist yet.

- [ ] **Step 3: Add the trace overlay markup**

In `components/hero/Wordmark.tsx`, add the import:

```ts
import { WORDMARK_LETTER_PATHS } from "./wordmark-paths";
```

Compute cumulative x-offsets once, near the top of the file (module scope, alongside
`RULE`):

```ts
/** Cumulative x-offset of each letter, and the overlay's total width, in the same
    100-unit em box `scripts/generate-wordmark-paths.ts` generated the paths in. */
const WORDMARK_LAYOUT = (() => {
  let x = 0;
  const offsets = WORDMARK_LETTER_PATHS.map((letter) => {
    const at = x;
    x += letter.advance;
    return at;
  });
  return { offsets, totalWidth: x };
})();
```

In the JSX, immediately after the `<span data-mark="mark" ...>{MARK}</span>` element and
still inside the `<h1>`, add the overlay:

```tsx
        {/* The wiring-draw overlay. Invisible by default (`opacity-0`, no JS needed) —
            a reader with no JS or reduced motion never sees a half-drawn letter, only
            the finished `data-mark="mark"` text above. JS-only readers get this faded
            in for the draw beat and back out again once the real letters take over. */}
        <svg
          aria-hidden
          data-mark="trace"
          viewBox={`0 0 ${WORDMARK_LAYOUT.totalWidth} 100`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          fill="none"
          stroke="var(--color-cyan-bright)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {WORDMARK_LETTER_PATHS.map((letter, i) => (
            <g key={`${letter.char}-${i}`} transform={`translate(${WORDMARK_LAYOUT.offsets[i]}, 0)`}>
              <path data-mark="trace-letter" d={letter.d} />
            </g>
          ))}
        </svg>
```

Note: the overlay `<svg>` needs `position: relative` on its parent to size against; the
`<h1>` already has `className="mt-5 flex flex-col items-center gap-3 sm:gap-4"` with no
`position` set. Add `relative` to that `<h1>` className.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/hero/Wordmark.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Replace the entrance beat's animation logic**

In the `useIsomorphicLayoutEffect` body, find the letters' initial state (currently):

```ts
      utils.set(letters, { opacity: 0, translateY: "0.42em", scale: 0.92 });
```

Change to:
```ts
      // Letters no longer slide or scale in — they stay in their final position and
      // simply wait, invisible, for the trace overlay to draw and then cross-fade
      // into them.
      utils.set(letters, { opacity: 0 });
```

Add, in the same block where `rule`/`travelling` are queried (near
`const rule = svg.createDrawable(...)`):
```ts
      const traceLetters = root.querySelectorAll<SVGPathElement>(
        `${handle("trace")} [data-mark="trace-letter"]`,
      );
      const traceOverlay = root.querySelector<SVGSVGElement>(handle("trace"));
      const traceDrawable = svg.createDrawable(traceLetters);
```

Add initial state for the trace, alongside the other `utils.set` calls:
```ts
      utils.set(traceDrawable, { draw: "0 0" });
```

Now replace the letters' arrival beat. Currently:
```ts
        .add(
          letters,
          { opacity: 1, translateY: 0, scale: 1, duration: 880, ease: "outExpo" },
          stagger(58, { from: "center", start: AT.letters }),
        )
```

Replace with three beats — the trace overlay fades in, each letter's outline draws, then
each letter cross-fades into its real, solid final form:

```ts
        // The trace overlay becomes visible for the whole draw beat, then fades out
        // once every letter has instantiated (below).
        .add(traceOverlay, { opacity: 1, duration: 200 }, AT.letters)
        // Each letter's outline draws in, center-out, like a circuit trace being
        // sketched — the same `svg.createDrawable` mechanic the rule under the name
        // already uses.
        .add(
          traceDrawable,
          { draw: "0 1", duration: 260, ease: "inOutQuad" },
          stagger(58, { from: "center", start: AT.letters }),
        )
        // Once a letter's outline finishes, it "instantiates": the stroke-only trace
        // for that letter fades out while the real, solid DOM letter fades in, in
        // place. `AT.letters + 260` is the trace's own draw duration, so the
        // cross-fade starts exactly as the first letter finishes drawing.
        .add(
          letters,
          { opacity: 1, duration: 220, ease: "outQuad" },
          stagger(58, { from: "center", start: AT.letters + 260 }),
        )
        .add(traceOverlay, { opacity: 0, duration: 200 }, AT.settle - 200)
```

The whole beat now finishes at `AT.letters + 260 + 58*4 + 220 ≈ 240 + 260 + 232 + 220 =
952`ms in the worst case (the outermost staggered letter) — close to but slightly past
the existing `AT.settle = 900`. Move `AT.settle` and every beat after it back to make
room: in the `AT` constant, change:

```ts
const AT = {
  eyebrow: 120,
  letters: 240,
  settle: 900,
  rule: 820,
  light: 1180,
  claim: 1320,
  cue: 1900,
} as const;
```
to:
```ts
const AT = {
  eyebrow: 120,
  letters: 240,
  settle: 980,
  rule: 900,
  light: 1260,
  claim: 1400,
  cue: 1980,
} as const;
```

(Each of `settle`, `rule`, `light`, `claim`, `cue` shifted by the same +80ms so their
relative spacing to each other is unchanged — only their offset from `letters` grew, to
absorb the new beat's extra length.)

- [ ] **Step 6: Update the one existing test this new markup conflicts with**

`components/home/beats.test.ts` has a cross-beat check —
`` it.each(BEATS...)("%s renders at full opacity with no script", ...) `` — asserting
that **no** beat's static markup contains the literal string `"opacity-0"`, because up
to now every occurrence would have meant something a static/no-JS/reduced-motion reader
should see was hidden by mistake. Beat 1 is `Hero` (which renders `Wordmark`), so the
trace overlay's `opacity-0` class (Step 3, deliberate — the overlay's own finished/resting
state is invisible, since the trace has already faded once the entrance settles) trips
this check. Run the suite now and confirm this is the only failure:

```bash
npx vitest run components/home/beats.test.ts
```

Expected: FAIL, exactly the `"1 the wordmark" renders at full opacity with no script`
case, nothing else.

Fix the test itself with a narrow, documented exception — do not remove the check or
weaken it for the other four beats. In `components/home/beats.test.ts`, change:

```ts
  it.each(BEATS.map(([name]) => name))("%s renders at full opacity with no script", (name) => {
    // `useReveal`'s `static` phase covers the server, a reader with JS off and a reader
    // who asked for reduced motion. A scene that shipped `opacity-0` in the HTML would be
    // invisible to all three.
    expect(beat(name)).not.toContain("opacity-0");
  });
```

to:

```ts
  it.each(BEATS.map(([name]) => name))("%s renders at full opacity with no script", (name) => {
    // `useReveal`'s `static` phase covers the server, a reader with JS off and a reader
    // who asked for reduced motion. A scene that shipped `opacity-0` in the HTML would be
    // invisible to all three.
    //
    // One deliberate exception, added 2026-07-29: beat 1's wordmark trace overlay
    // (`data-mark="trace"`, the wiring-draw entrance's letter-outline layer) is a
    // JS-only decorative effect whose own finished/resting state is invisible — the
    // trace has already faded out once the entrance settles, leaving only the solid
    // letters `data-mark="mark"` carries, which this same check still covers. Stripped
    // out before the check runs; every other element in every beat is still held to it.
    const html = beat(name).replace(/<svg[^>]*data-mark="trace"[\s\S]*?<\/svg>/, "");
    expect(html).not.toContain("opacity-0");
  });
```

Run it again to confirm the fix is narrow:

```bash
npx vitest run components/home/beats.test.ts
```

Expected: PASS, all cases — including the other four beats, which still fail this check
if any of them ever ships an accidental `opacity-0`.

- [ ] **Step 7: Run the full suite and typecheck**

```bash
npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Step 8: Visual check in a browser**

```bash
npm run dev
```

Open `/` and watch the hero. Confirm: the name's letters appear to draw in as outlines
(a visible stroke tracing each letterform), then solidify into the final glowing text,
center-out, before the rest of the entrance (rule draw, settle, light pass) continues as
before. Then check the two invariants that can't be asserted by the vitest suite:

- With JS disabled (or via browser dev tools' "Disable JavaScript"), reload `/` and
  confirm the heading shows the finished "DarkPrint" immediately, no animation, no
  visible stroke overlay.
- With the OS/browser "reduce motion" setting on, reload `/` and confirm the same.

- [ ] **Step 9: Commit**

```bash
git add components/hero/Wordmark.tsx components/hero/Wordmark.test.ts components/home/beats.test.ts
git commit -m "Give the hero wordmark a wiring-draw entrance: trace each letter, then instantiate"
```

---

## Self-Review

**Spec coverage:** Task 2+3+4 cover visual-polish-design.md §1 (segment bar + reversal
documentation). Task 3 also covers §2 (background transparency). Task 1 covers §3 (font
swap), including the `ADVANCE` dependency the spec didn't originally call out by name but
which is a real correctness risk of that exact change. Tasks 5+6 cover §4 (hero
animation). All four spec sections have a task.

**Placeholder scan:** No TBD/TODO. Task 1's Step 3 has two branches (value ≤ 0.62 vs. >
0.62) because the actual measured number depends on running a real build, which this
document cannot execute — both branches are fully specified with real formulas, not "add
appropriate handling."

**Type consistency:** `AutonomyBar`'s `{ level, label }` props (Task 2) are used
identically in Task 3 (`item.autonomy.level`, `item.autonomy.label` — both fields exist
on `AutonomyInfo` per `lib/types.ts:64-89`). `WordmarkLetterPath` (Task 5's generated
type) is consumed in Task 6 with matching field names (`char`, `d`, `advance`).
