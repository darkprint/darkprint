# Handoff: the logo, and the landing's ending

## Overview

Two changes, independent of each other and of the accounts work in
`design_handoff_accounts/`:

1. **A brand mark** — a folder holding a graph, drawn in the site's own register.
   DarkPrint has a wordmark and no mark today.
2. **The landing ends once instead of twice** — `SectionLifecycle` stops selling and
   `SectionDoors` closes the page alone.

Both are drawn in `DarkPrint Logo and Homepage.dc.html`, screens **09** (logo) and
**10** (landing ending).

## About the design files

The HTML in this bundle is a **design reference** — a prototype showing intended shape,
colour and copy. It is not production code to copy. Recreate it inside the existing
codebase: **Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 (CSS-first theme)**.

The mark is the exception: its SVG geometry **is** the deliverable and should be lifted
verbatim into a component, because the coordinates carry the reduction ladder. Everything
else — grounds, captions, comparison columns — is presentation for this document only.

Fidelity: **high**. Colours, geometry and copy are final.

---

# Part 1 — The logo

## Where it came from

The brief was a reference image: a neon folder containing a boxes-and-lines flowchart on
black. **The idea is right and it is already canon in the codebase** —
`components/home/lifecycle/Folder.tsx` draws a folder in `--color-blueprint-line` that
opens to show `blueprint.dot`, `cards/*.yaml`, `README.md · AGENTS.md`. "A blueprint is a
folder of text" is the site's own sentence, and a folder holding a graph states both of the
product's claims in one mark.

What the reference could not keep, and why:

| Kept | Dropped | Because |
| --- | --- | --- |
| The folder holding a graph | — | It is the product's own sentence |
| The perforation dots down the left | — | Reads as sheet perforation; free technical-drawing vocabulary |
| Blue | Neon on black | `Button.tsx` rejects zero-offset coloured halos: a glow "says this element is emitting light, which is decoration" |
| Nodes | Squares and diamonds | `GraphThumbnail.tsx` replaced rounded rectangles with lit discs because the site was "saying what a node is in two languages one click apart", and `flow.test.ts` now fails on **any** rect element under `components/graph/` |
| — | A body painted in `--color-cyan` | Cyan is the interactive semantic; a mark entirely in it says *click me* |
| — | Ten interior elements | Nothing legible survives at 24px |

## Geometry

The silhouette is `Folder.tsx`'s own, halved into a 64×64 box. That component draws a
**104×76** back plate at `blueprint-line/30` with radii `2px 8px 8px 8px`, a **34×9** tab
sitting above its **top-left** — a separate block, not an angled cut — and a front flap at
`4px 8px 8px 8px`. Halved: a 52×38 plate with a 17×4.5 tab and radii 1/4/4/4 and 2/4/4/4.

**The back plate and its tab are one path.** They were two, and their overlap painted at
double alpha and showed as a seam. Do not split them again.

```
back + tab   M8 14h13a2 2 0 0 1 2 2v4h31a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V16a2 2 0 0 1 2-2z
             fill --color-blueprint-line at 30%

front flap   M8 26h46a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V28a2 2 0 0 1 2-2z
             fill --color-blueprint-deep, stroke --color-blueprint-line

perforation  4 dots, r 0.9, x 12, y 34 / 38.5 / 43 / 47.5, blueprint-line at 55%
```

### The nodes

Three lit discs, at `GraphThumbnail`'s own ratios — **halo 1.77× the core, ring 1.27×** —
so a node in the logo and a node in a schematic are the same object:

| | centre | core | ring | halo | colour |
| --- | --- | --- | --- | --- | --- |
| trigger | 21, 40 | r3 @90% | r3.8 @50%, sw 0.8 | r5.3 @12% | `--color-cyan-bright` |
| planner | 35, 36 | r3 @90% | r3.8 @50%, sw 0.8 | r5.3 @12% | `--color-cyan` |
| ship | 47, 44 | r3 @90% | r3.8 @50%, sw 0.8 | r5.3 @12% | `--color-emerald` |

### The edges — compute them, never type them

This is the one thing that must not be hand-authored. Each edge runs along the line
between two centres, trimmed at **both** ends by `ring + gap` (5 units at full size), with
`stroke-linecap="round"`, `stroke-width` 1.2, `--color-blueprint-line` at 70%. That is the
same rule `GraphThumbnail` applies with its `PORT_R = RING_R + FLOW.edge.gap`.

```
edge(a, b, port):
  d = b - a ;  u = d / |d|
  M (a + u·port) L (b - u·port)
```

At full size that yields `M25.81 38.63 L30.19 37.37` and `M39.16 38.77 L42.84 41.23`.
Hand-typed constants are how the first draft shipped a horizontal edge between two nodes
at different heights — it connected nothing.

### The reduction ladder

The mark **sheds nodes rather than shrinking them**. Three 3-unit cores land near 1.5px at
32, under the site's own legibility floor, so the third node leaves.

| Size | Discs | Edges | Back plate + tab | Stroke |
| --- | --- | --- | --- | --- |
| 64 | 3 (with halo) | 2 | yes | 1.8 |
| 32 | 2 (solid, r3.6) | 1 | yes | 2.4 |
| 24 | 2 (solid, r4) | 1 | yes | 3 |
| 16 (favicon) | 2 (solid, r5) | 1 | **no** | 4.5 |

At 24 and below the discs are solid: no halo, no ring.

### Two grounds

- **Dark pole** — `blueprint-line` folder on `--color-surface`, discs in their kind colours.
- **Cyanotype pole** — one ink. Folder and discs both in `--color-blueprint-ink`, front
  flap filled `--color-blueprint`, over `.bp-grid`. The kind colours drop out, which is
  what the rest of the site already does on that ground.

### Lockup

Mark to the left of the wordmark, wordmark unchanged: `font-display`, `font-semibold`,
`tracking-tight`, `Dark` in `--color-fg` and `Print` in `--color-cyan`, exactly as
`SiteHeader.tsx` writes it. The mark never replaces it.

The letterforms agree by construction: `scripts/generate-wordmark-paths.ts` traces the
hero's morphing wordmark out of **Space Grotesk SemiBold 600**, which `@theme inline` maps
to `--font-display` — the same family and weight the header sets in live type. One set of
letterforms, drawn as outlines in the hero and as text everywhere else.

In the 64px header row, use the 24px rung of the ladder beside 18px type.

### Implementation note

One component, `components/site/Logo.tsx`, taking `size` and `ground` props and switching
on the ladder. Colours as `currentColor` or CSS variables, never hex — `flow.test.ts`
already fails a hex literal in a scene and the same reasoning applies. Export a static
`app/icon.svg` for the favicon from the 16px rung.

---

# Part 2 — The landing's ending

## The defect

`SectionLifecycle` is headed **"One registry, two loops / Find and reuse, or create and
publish"** and renders five panels — Learn, Find, Create, Use, Publish — each with its own
CTA link. Immediately after it, `SectionDoors` is headed **"Start with the job in front of
you / Find a proven shape, or make the one you need"** with two primary buttons.

That is not merely two endings. It is **the same two-way choice, stated twice, one section
apart**, and the five panels already contain both doors' destinations: `/blueprints` under
Find, `/skill` under Create. Seven calls to action close the page.

## The fix

**`SectionLifecycle` becomes explanatory.**

- Drop the five per-panel CTA links (`{action.label} →`). Keep `index`, `title`, `text`
  and `image` exactly as they are.
- Retitle so it stops answering the question the doors are about to ask. The eyebrow
  "One registry, two loops" stays; the `title` becomes **"What the registry does with a
  blueprint"**.
- Keep the human-interface / agent-interface pair at the foot. That is the one thing on the
  section that neither the doors nor the panels say.

**`SectionDoors` closes the page alone.**

- The two buttons stop being twins: **Find a blueprint** stays `variant="primary"`,
  **Create a blueprint** becomes `variant="outline"` in `blueprint-ink`. A page that asks
  for everything equally asks for nothing, and finding is the more common intent.
- Both buttons go up to `size="lg"` at 48px, since they are now the page's only ask.
- Add one line under them linking **Towards a Dark Factory**: *"Not sure a pattern of yours
  belongs here?"* — a reader who has just been asked to choose between two paths and is not
  sure either applies to them is exactly that essay's audience.

## Why that link matters here

A separate decision removed "Towards a Dark Factory" from `SPEC_SEQUENCE` — it loses its
step number, its rail row and its pager position, and the route stays where it is. It
needed a home, and the doors band is it. If that decision is not being implemented, drop
this line and nothing else changes.

## Still open — not drawn

**The landing never shows a real blueprint.** Nine parsed, scored, downloadable bundles,
and a cold visitor meets only illustrations of concepts before being asked to choose a
path. A short strip of real `ContentCard`s before the doors is the strongest argument the
site has, and the one it currently withholds. Raised, not designed.

---

## Design tokens used

`--color-blueprint-line #74b4ff` · `--color-blueprint-deep #061c52` ·
`--color-blueprint #0b2f7a` · `--color-blueprint-ink #cfe2ff` · `--color-cyan #38bdf8` ·
`--color-cyan-bright #7dd3fc` · `--color-emerald #34d399` · `--color-surface #0a0c16` ·
`--color-line #222739` · `--color-fg #e9ebf5` · `--color-muted #9aa1ba` ·
`--color-dim #828aa3`

Use the token, never the hex. Radii from the four-step ladder (`sm 5 · md 8 · lg 12 ·
xl 18`); spacing from the seven-tier vertical scale in `app/globals.css`.

## Tests to keep green

- `components/home/beats.test.ts` — renders the beats the way the server does. It fails any
  beat shipping `opacity-0`, and it holds the Download panel to naming the real bundle files.
- `components/site/nav.test.ts` — one label per route.
- `components/hero/Wordmark.test.ts` — if the lockup work touches the hero.

## Files

- `DarkPrint Logo and Homepage.dc.html` — screens 09 and 10. Opens in a browser, no build step.
- `screenshots/09-logo.png` — the mark on both grounds, the lockup, and the reduction ladder.
- `screenshots/10-homepage-ending.png` — today's double ending beside the proposal.

Screen 10 is a **comparison**, not a screen to build: left is current, right is the
proposal. Build the right-hand side.
