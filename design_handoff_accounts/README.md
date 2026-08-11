# Handoff: Accounts, profiles, settings, and the bundle-as-repository

## Overview

DarkPrint currently has no accounts. This handoff covers the account model and every surface
it touches:

- **Public profile** (`/u/[username]`) — exists today, gains identity chrome and pinned items.
- **Your own profile** (`/u/[me]`) — new signed-in view: one list of your blueprints, public
  and private, with owner controls.
- **Settings** (`/settings`) — new, seven sections on a documentation rail.
- **A bundle you own** (`/u/[username]/[slug]`) — new: a blueprint handled the way a repository
  is handled, with breadcrumb, lineage, version selector, file tree and history.
- **A published blueprint** (`/blueprints/[slug]`) — existing page, restructured onto the same
  shell as the owned bundle.
- **Navigation** (`SiteHeader`) — reorganised from seven targets to five, plus an account menu.
- **The shelf** (`/blueprints`) — the tile gains an owner line; the gallery gains a stance on forks.
- **Learn** (`SPEC_SEQUENCE`, `LearnShell`) — the sequence split into two named runs.

The organising idea, which the author stated directly: **the bundle should be handled the way
GitHub handles a repository** — owner/name identity, public or private visibility, forks with
lineage, stars, a file listing, a version history. With one deliberate limit, stated below.

### The one thing that is borrowed but not copied

DarkPrint has no repository behind a bundle. There is no history to pull, nothing to check out,
no remote. So the model is borrowed and the vocabulary is honest about where it stops:

- "History" is a list of **published snapshots addressed by their own digest**, not a chain of
  patches. The UI says so in place.
- "Get the folder" copies files over HTTP. It is **a snapshot, not a clone**. The word `git`
  must not appear — `components/site/honesty.test.ts` asserts its absence, and
  `lib/content/bundle-export.test.ts` asserts it over every generated command.
- A `darkprint clone` CLI is drawn behind `ComingSoonBadge` because it does not exist.

### A fork is not a category

This was corrected explicitly during the design and matters throughout: **a fork is a fact about
a bundle, not a kind of bundle.** Your account holds *blueprints*; each is public or private; some
of them happen to have an upstream. There is no "Forks" tab, no "Your forks" menu row, and no
separate model. Lineage is a field (`forkedFrom`) rendered as a line, and `forked` is a pill that
sits *beside* the slug, never in place of it.

---

## About the design files

`DarkPrint Accounts.dc.html` in this bundle is a **design reference written in HTML** — a
prototype showing intended layout, colour, type and copy. It is not production code to copy.
The task is to recreate these designs inside the existing DarkPrint codebase using its own
patterns: **Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 (CSS-first theme)**.

Concretely, that means:

- Use the Tailwind tokens defined in `app/globals.css`, never the hex values below. The hex
  values are given so you can verify a match, not so you can type them.
- Reuse the existing primitives — `Button`/`ButtonLink`, `Badge`/`KindBadge`, `Avatar`/`AuthorChip`,
  `Stat`, `ContentCard`, `SideRail`, `SectionHeading`/`PanelHeading`, `ComingSoonBadge`,
  `TagPill`, `More`, `CopyButton`, `GraphThumbnail`. The mock recreates all of them by hand;
  the implementation should not.
- Follow the vertical scale, the z ladder and the radius ladder written at the top of
  `app/globals.css`. Every spacing value in the mock is on that scale.

The mock is **high fidelity**. Colours, type, spacing and copy are final. Recreate it closely.

---

## Decisions already made

These were settled with the author and are not open questions.

| # | Decision |
| --- | --- |
| 1 | `/ontology` is renamed **Vocabulary** in the nav and rail. Learn stop 03 keeps the name **Ontology**. The routes do not move. This avoids `nav.test.ts` failing on one label across two routes. |
| 2 | The gallery's fork control defaults to **rolled up**: a fork does not take its own tile, it lists under its parent. `all` and `originals` are the other two settings. |
| 3 | **"Towards a Dark Factory" leaves `SPEC_SEQUENCE`.** The route stays; it loses its step number, its rail row and its pager position, and is linked from the landing as an essay. |
| 4 | **`/build` (the sandbox) loses its step number** and becomes an unnumbered worked example hanging under stop 03. An optional stop is not a stop. |
| 5 | **The account model is being implemented for real** — accounts, profiles, settings, public/private bundles, forks and stars all get storage. Downloads, reputation and the three community metrics stay seeded: there is still no runner and no ballot. |

### Two refactors this work implies

- **`RegistryFilterBar`.** `GalleryBrowser.tsx` already documents this: its `fieldClass` and
  sticky disclosure are near-duplicates of `NodeBrowser.tsx`'s, and it says the right home is a
  shared component "that both browsers and a future `/ontology` one mount", deliberately not
  extracted because that pass owned one file. With Vocabulary getting a browser there are three
  consumers. Extract it.
- **The `/nodes` tile owner line.** `NodeCardSummary` should take the same owner/slug treatment
  as `ContentCard` (below). This is described here but not drawn in the mock.

---

## The honesty rule, which governs every surface here

`README.md`, doc 2 §0.4 and roughly forty comments across the codebase enforce one rule:
**nothing may be described as working that is not built, and every figure says where it came
from.** The three markers, used consistently:

| Marker | Colour | Means |
| --- | --- | --- |
| `✓ counted` | `--color-emerald` | Read off the archive at build time |
| `◐ seeded` | `--color-amber` | A row in `lib/data/`, illustrative only |
| `Coming soon` (`ComingSoonBadge`) | `--color-amber` | Designed, not built |

**Amber is under contract.** `app/globals.css` states it is spent on exactly two things —
`ComingSoonBadge` and `.route-box` — and nothing else. Do not reach for it. Since decision 5
makes accounts real, most of the amber in earlier drafts of this design is gone: what remains
amber is validator status (needs a ballot), the seeded figures, and the upstream-drift panel's
warning.

---

## Screens

### 01 · Public profile — `/u/[username]`

**Purpose:** what one builder has published, as a visitor sees it.

**Layout:** `container-page` (max 1200px, `padding-inline: 1.5rem`), `py-12`.

1. **`ProfileHeader`** — existing component, unchanged except for two additions. Panel:
   `rounded-xl border border-line bg-surface p-8`, with `.tech-grid` at `opacity-40` absolutely
   positioned behind, `aria-hidden`. Row: `Avatar size="xl"` (64px, validator ring
   `ring-2 ring-cyan/70 ring-offset-2 ring-offset-void`), then a column with `h1`
   (`font-display text-3xl font-semibold tracking-tight`), the `✦ Validator` badge, `@handle`
   in `font-mono text-sm text-muted`, and the bio (`max-w-xl text-sm leading-relaxed text-muted`).
   - **New:** a summary line — `3 blueprints · 12 cards · 8 starred`, `font-mono text-[11px] text-dim`
     with the counts in `text-fg`.
   - **New:** a right-hand action group — `Watch` as `Button variant="outline"`, beside the seeded
     community-support pill, with `Joined Feb 2026` in `font-mono text-[11px] text-dim` under them.
2. **Tab strip** — `border-b border-line`, tabs `px-3.5 py-3 text-sm`, active
   `text-cyan border-b-2 border-cyan -mb-px`, inactive `text-muted border-b-2 border-transparent`.
   Counts are `font-mono text-[11px]` in a `rounded-full border border-line px-1.5` pill.
   Tabs: **Overview · Blueprints 3 · Cards 12 · Saved 8 · Vocabulary terms 4**.
   At the right end, `font-mono text-[11px] text-dim`: "Private blueprints are not listed here".
   There is **no Forks tab** (see "a fork is not a category").
3. **Pinned** — `mt-10`. Heading is the existing `SectionTitle` pattern (2px dot, label,
   count in `font-mono text-sm text-dim`), with `✓ counted` at the right. Two-column grid,
   `gap-5`. Each pinned item is a `panel-lead` card (`border-line-bright`,
   `bg-surface-2/70`, `p-5`) carrying the owner/slug line, the title, the summary, tags, and
   a footer with the autonomy class, the human-presence line and the star count.
4. **Published here / Preview signals** — **unchanged from the current page.** Grid
   `lg:grid-cols-[1.2fr_0.8fr]`, `gap-5`. Left panel `rounded-xl border-line bg-surface-2 p-5`
   with three `Stat`s (Total, Blueprints in cyan, Node cards in copper) and `✓ counted`. Right
   panel `border-amber/25 bg-amber/5` with two `Stat`s (Downloads emerald, Reputation violet)
   and `◐ seeded`. Keep both explanatory sentences verbatim.
5. **Blueprints** — `mt-14`, `SectionTitle` + a sort control, then
   `grid gap-5 sm:grid-cols-2 lg:grid-cols-3` of `ContentCard`s (see screen 07 for the tile change).
6. **Node cards** — `NodeCardTile` as it exists today (`used in N blueprints`, and `⏸ human in the
   loop` in `HUMAN_PRESENCE_MARK` violet when the card declares it), plus a "See all 12 cards →"
   link. **Addition:** the mock adds a seeded community-support pill to the footer — the same
   pill `FavoriteStar` renders for its `count`/`seeded` branch. That tile has no support count
   today; it is new work, not existing behaviour.

### 02 · Your own profile — `/u/[me]`

Everything from 01, plus:

- **Account menu** hanging from the header avatar: `w-72 rounded-lg border border-line-bright
  bg-surface-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.85)]`, using the existing
  `details[open] > .menu-panel` `@starting-style` animation. Rows: Your profile · Your blueprints ·
  Your cards · Saved · — · Settings · Sign out. A footer strip states what stays seeded.
  **No "Your forks" row.**
- **Owner chrome** in the header: `Edit profile` (outline) and `New blueprint` (primary).
  A `This is you` pill in `font-mono text-[11px] uppercase tracking-[0.12em] text-dim`.
- **Tabs:** Overview · **Blueprints 5** (active) · Cards 9 · Saved 17 · Vocabulary terms 2.
  The count includes private bundles; the visitor's view counts only public ones.
- **Toolbar:** a search field, `Visibility: all ▾`, `Sort: updated ▾`, and `New blueprint`.
  All controls `h-10`, `rounded-md`, `border-line`, `bg-surface-2`, `font-mono text-xs`.
- **Your blueprints** — one list, `2 public · 3 private`. Each row:
  - Name as a `font-display text-lg` link in cyan, a visibility pill, a version pill.
  - `forked from <owner> / <slug>` in `font-mono text-[11px] text-dim` — **only when there is an
    upstream**.
  - A one-line note, then a meta row: autonomy class, digest, `edited <when>`, and a drift
    statement (`✓ in step with upstream` in emerald, `▲ upstream repinned 1 card` in amber).
  - Right column: `Publish` (private rows only), an overflow `⋯`, and
    `only you can see this` (private rows only).
- **Saved** — the bookmark list, keyed by path, with `✓ on your account`. Copy must keep the two
  apart: a save is a private bookmark; the star count beside a blueprint is seeded community support.

### 03 · Settings — `/settings`

**Layout:** `SideRail` (see below) + a content column, `flex flex-col gap-10`.

Rail rows: 01 Public profile · 02 Account & handle · 03 Email & notifications ·
04 Fork visibility · 05 Validator status · 06 Appearance · 07 Danger zone (in
`--color-signal`), then a rule and `← Back to your profile`.

Page head: `SectionHeading as="h1"` with eyebrow `Account`, title `Settings`, and the lead
"What the registry knows about you, and what it will never keep."

| § | Panel | Contents |
| --- | --- | --- |
| 01 | `panel-lead` | Display name (text), Bio (textarea + `94 / 160` counter), Avatar hue (range, `accent-color: --color-cyan`), and a live preview card showing the generated gradient avatar. State that **no image is ever uploaded** — `avatarGradient(hue)` derives it from one number. |
| 02 | `panel` | Handle, prefixed `darkprint.io/u/` inside the field. Copy must state that a rename keeps the old handle reserved, because every published card carries `author:`. Below, a summary of what is authored under it. |
| 03 | `panel` | Email (never shown publicly) and four notification rows with toggles. Defaults: repin of a pinned card **on**, a public fork of your work **on**, deprecation of a term you authored **on**, weekly digest **off**. |
| 04 | `panel` | Rail row reads **Default visibility**. Two radio cards, **Private** (recommended) and **Public**. Copy speaks about *bundles*, not forks; lineage is mentioned only where it is genuinely fork-specific. |
| 05 | `border-amber/25 bg-amber/5` + `ComingSoonBadge` | The `✦ Validator` badge with its grant date and `weight ×3`. Still a preview: validator voting is not built. |
| 06 | `panel` | Three cards — Dark · factory (current), Blueprint · cyanotype, Reduce motion (follows the system). This browser only. |
| 07 | `border-signal/35 bg-signal/[0.04]` | Delete account (handle reserved, private bundles destroyed, published work stays — a pinned card cannot be withdrawn) and Transfer a blueprint (the digest does not change; only the author line moves). |

Footer: `Save changes` (primary), `Discard` (ghost), and a note that changes apply to the account,
not to anything published.

### 04 · A bundle you own — `/u/[username]/[slug]`

**Header band** — `border-b border-line bg-surface`, inside `container-page`:

- Breadcrumb identity: 24px avatar, `mara-veil` (cyan, links to the profile), a `/` in
  `text-faint`, `guarded-merge-bot-hardened` in `text-fg`, then a `Private` pill and a `forked`
  pill. All `font-display text-xl`, the slug at `font-semibold`.
- Lineage: `forked from sol-antczak / guarded-merge-bot at v1.3.0 · upstream repinned 1 card since`,
  `font-mono text-[11px] text-dim`, the warning clause in amber.
- A one-line description.
- Actions, right-aligned: `Watch 1` · `Save` (the bookmark) · `Fork 0` · **`Get the folder ▾`** (primary,
  opening the existing `CloneMenu`). Under them, `a snapshot over HTTP, not a clone` in
  `font-mono text-[11px] text-dim`.

**Body** — `SideRail` + main + a 320px aside.

Rail: 01 Overview · **02 Files** · 03 Graph and cards · 04 Evidence · 05 History ·
06 Use this release · 07 Source · — Owner — 08 Settings.

Main column:

- **Version row** — `version v1.4.0-hardened ▾` (a branch-like selector), `3 versions · 6 changes`,
  and `Compare with upstream` at the right.
- **File tree** — `rounded-lg border-line bg-surface`. Header strip (`bg-surface-2`) carries the
  last change: avatar, handle, message, digest, when. Rows: a kind glyph, the filename in
  `font-mono text-[13px] text-fg`, the change in `text-dim` (truncated), a state word, and a date.
  The files are exactly what `lib/content/bundle-export.ts` generates:
  `blueprint.dot`, `factory.dot`, `cards/`, `ontology/extensions.yaml`, `README.md`, `AGENTS.md`
  — plus `NOTES.md`, a local file never published with the bundle.
- **History** — a rail of dots and connectors. Each entry: version, short digest in a pill, an
  optional tag (`latest` emerald, `fork point` violet, `upstream` dim), the message, author and
  date, and `Diff` / `Take` buttons. The last entry is the **upstream release the fork came from**,
  drawn in the dimmest tone, so the lineage is visible as the end of your own history.
  Closing note: there is no repository behind a bundle; each row is a published snapshot addressed
  by its own digest, so "history" is a list of identities rather than a chain of patches.

Aside:

- A neutral panel stating what the page does **not** hold: no run, no key, no telemetry.
- **Visibility** — a two-segment control, Public / Private, owner only, with copy explaining that
  publishing runs the validator and gives the fork its own scorecard without changing the upstream.
- **Bundle** — the existing `BundlePanel`, unchanged: digest with a copy button, the
  "hashed over the DOT source and every card version" sentence, then Nodes, Pinned cards,
  Ontology declared, Scores computed under, and the comparability note.
- **Upstream moved** — a `.route-box`-styled amber panel naming the repinned card
  (`criteria-judge@2.1.0 → 2.2.0`), why the two bundles now hash differently, and `Review the change`.
- **Releases** — latest with a `latest` pill, size and file count, then older ones.

### 05 · A published blueprint — `/blueprints/[slug]`

The same shell as 04, applied to the existing page. **This is a restructure, not a rewrite.**

- The header band gains the owner/slug breadcrumb, the `Public` pill, the action row and the
  version selector. The existing `h1`, summary, `KindBadge`, `AutonomyMeter` and `TagPill`s stay.
- The `SideRail` ("On this blueprint") stays and grows to eight rows: Overview · **Files** ·
  Graph and cards · Evidence · History · Use this release · Source · Community notes.
- **Files** and **History** are new sections, same markup as 04.
- **The six existing sections keep their scroll order and are not turned into tabs.** This was
  considered and rejected: they are one argument read top to bottom, and tabs would hide the
  explainability panel — the thing that makes a score checkable — behind a click.
- The aside carries the Scorecard, the Bundle panel, a **Forks** list (public forks only, with a
  note that a private fork is never announced there), and Releases.
- **Autonomy renders with no bar**, per doc 2 §1.1: a class is not a quantity. The other five
  metrics keep their source-coloured bar. This is existing `MetricBars` behaviour — preserve it.

### 06 · Navigation — `SiteHeader`

**Today:** Blueprints · Cards · Create · [Publish] · MCP · | · Learn ▾ — seven targets.

Three problems: *Create* and *Publish* read as one intent; *MCP* stands as a peer of the two
content types; and the vocabulary browser has no entry at all.

**Proposed:**

```
DarkPrint    Blueprints  Cards  Vocabulary  │  Build ▾  Learn ▾  │  [Publish]  (avatar ▾)
```

- **Browse:** Blueprints, Cards, Vocabulary.
- **Build ▾:** Create (the skill) · Customize the starter · MCP. Publishing is the button, not a
  row in the menu.
- **Learn ▾:** unchanged in mechanism; its contents follow `SPEC_SEQUENCE` (screen 08).
- **Publish** becomes `Button variant="primary" size="sm"`; the avatar menu sits last.
- **Mobile sheet** gains a fourth group, **You** (profile · stars · settings), and its three
  existing headings are renamed to match the desktop bar exactly.

`NAV` and `MOBILE_GROUPS` in `SiteHeader.tsx` are the only data that changes; `nav.test.ts`
already asserts one label per route, which is what forces decision 1.

### 07 · The shelf — `/blueprints`

**Tile change.** `ContentCard` gains an owner line above the title — an 24px `Avatar`,
`owner` in `text-muted`, `/` in `text-faint`, `slug` in `text-cyan`, all `font-mono text-xs`,
sharing the `pr-8` the star already forces. The author chip **leaves the footer** (one identity
per card, at the top), and the freed footer row carries `v1.3.0 · Jun 20 · 7 forks` beside the
existing `✓ resolved · N tools`. Everything else about the tile is unchanged: the name above the
drawing, three lines of summary before it, the 112px `bp-grid` frame with its 24px fade, the
autonomy class with no number, the star at `z-20` over the stretched link.

**Fork stance.** A new filter-bar control, `Forks: rolled up ▾`, defaulting to **rolled up**:

- *rolled up* — the parent keeps its tile; its published forks are a listing attached beneath it
  (owner/slug, a one-line note, a star count). One graph, one entry.
- *all* — each published fork gets its own tile, carrying the lineage line and a `forked` pill
  beside its slug.
- *originals* — forks are hidden.

**Do not sort or badge by fork count.** Doc 2 §1.1 keeps league tables off this shelf; the count
states a fact on a tile and never orders the page. The same rule already removed autonomy from
`SortKey`.

### 08 · Learn — `SPEC_SEQUENCE` / `LearnShell`

Today the rail is one flat run of seven stops. Stops 00–03 are a specification; 04–06 are a
sandbox, an explainer and an essay. The code already knows this (`LEARN_PRACTICE` is its own
constant) but the reader sees one 1-of-7 course.

**Proposed rail:**

```
Learn                     Specification · 3 of 4
── Specification ──
  00  What a blueprint is
  01  Topology
  02  Node card            ← active, sections indented under it
  03  Ontology                                    spec
      └ Customize the starter        worked example
── In practice ──
  04  How a blueprint is graded
```

- Two run labels; **one list**, one `specNeighbours()` walk. The grouping is presentational.
- The sandbox loses its step number (decision 4) and hangs under stop 03.
- "Towards a Dark Factory" leaves the sequence (decision 3).
- `SpecPager` prints the run name alongside the step: `Next · In practice 04 →`, so a reader
  stepping out of the specification is told they are leaving it.

---

## Interactions & behaviour

| Element | Behaviour |
| --- | --- |
| Account menu | `<details>` + `.menu-panel`, using the existing `@starting-style` transition (`opacity`, `scale(0.97)→1`, `transform-origin: top right`, `--dur-fast` 160ms). Escape closes and returns focus. Coordinate with other menus via `components/ui/menu-group.ts`. |
| Version selector | Same disclosure pattern. Selecting a version reloads the file tree and digest panel. |
| Visibility switch | Optimistic segment flip, then persist. Publishing a private bundle runs the validator; a bundle with diagnostics of `error` severity must not publish. |
| Tabs | Real routes, not client state — the profile is prerendered per tab. |
| Fork rollup control | Writes `?forks=rolled|all|originals` through `useQueryState`, like every other gallery filter. Never mirrored into React state. |
| Save (the bookmark) | Existing `FavoriteStar` — a **bookmark**, not a star: a bookmark glyph, `text-dim` when unset and `text-amber` when set, `rounded-full border-line bg-surface-2/90 p-1.5`, `hoverable:active:scale-[0.94]`, kept at `z-20` above the card's stretched link with `preventDefault` + `stopPropagation`. Today it is a `localStorage` key; under decision 5 it moves to the account. |
| Copy digest | Existing `CopyButton` / `BundlePanel` behaviour: 1400ms confirmation, silent no-op when the clipboard is unavailable. |
| Press | Site-wide bands from `Button.tsx`: ≤40px → `scale-0.94`; 40–200px → `0.97`; >200px → `0.99`. Always `duration-[120ms]` with `--ease-out`, always an explicit `transition-[…]` list that **includes `scale`** (Tailwind v4 compiles `scale-[0.97]` to the standalone `scale` property). Never `transition-all`, never bare `transition`. |
| Hover | Every hover gated behind the `hoverable` variant (`@media (hover: hover) and (pointer: fine)`). |
| Focus | The unlayered global `:focus-visible` rule wins. Do not add `outline-none`, do not transition the ring. |

## State

- `session` — the signed-in account, or none. Drives the header's right end and every owner-only control.
- `bundle.visibility` — `"public" | "private"`, per bundle, defaulted from the account setting.
- `bundle.forkedFrom` — `{ owner, slug, version }` or absent. A field, not a type.
- `bundle.upstreamDrift` — computed by comparing pinned card versions against the upstream's
  current release. Drives the amber panel on screen 04.
- `saves` — the bookmark set, account-scoped, replacing the current `darkprint:favorites` `localStorage` key. Private to its owner.
- **Stars are a different thing and must not be merged with saves.** `FavoriteStar`'s optional `count`/`seeded` props render a *community support* figure in its own bordered pill beside the bookmark — `border-line bg-surface font-mono text-[11px] text-muted`, a star outline, and an amber `◐` when seeded. `app/blueprints/[slug]/page.tsx` passes `count={bp.votes} seeded`, so that count is the seeded community vote from `lib/data/community.ts`. It stays seeded: there is no ballot. No scorecard reads either.
- Gallery filters — all in the URL via `useQueryState`, including the new `forks` key.
- These pages **cannot** be statically prerendered per-user the way the rest of the site is.
  Everything public (`/blueprints`, `/nodes`, `/ontology`, a public profile) must stay static;
  only the signed-in views become dynamic.

## Design tokens

All defined in `app/globals.css`. Use the token, not the hex.

**Dark pole** — `void #05060d` · `surface #0a0c16` · `surface-2 #0f121e` · `surface-3 #151928` ·
`line #222739` · `line-bright #333a54`
**Foreground** — `fg #e9ebf5` · `muted #9aa1ba` · `dim #828aa3` · `faint #3b4058`
(**decorative separators only — never live text; it reads 1.83:1**)
**Blueprint pole** — `blueprint #0b2f7a` · `blueprint-deep #061c52` · `blueprint-line #74b4ff` ·
`blueprint-ink #cfe2ff`
**Copper pole** (the node card, and nothing else) — `copper #5e2b07` · `copper-deep #3a1c06` ·
`copper-line #ff8a4d` · `copper-ink #f8d9c4`
**Accents, one meaning each** — `cyan #38bdf8` interactive · `cyan-bright #7dd3fc` ·
`amber #ffb020` **reserved** · `violet #a78bfa` where a person acts · `emerald #34d399` read off
the engine · `signal #ff5470` a defect

**Vertical scale** — 8 inline · 12 tight · 16 element · 20 card · 40 block · 64 section · 80/112 band.
48, 56, 32 and 96 are banned as structural values.
**Radii** — `sm 5` · `md 8` · `lg 12` · `xl 18`. Rungs outside the ladder are switched off.
**Motion** — `--ease-out cubic-bezier(0.23,1,0.32,1)` (the default curve) · `--dur-press 120ms` ·
`--dur-fast 160ms` · `--dur-base 180ms` · `--dur-slow 420ms` · `--dur-reveal 520ms`.
**Type** — Geist (sans) · JetBrains Mono (mono) · Space Grotesk (display).
Three mono tiers and only three: `.eyebrow` 11px/0.22em cyan · `.label-lead` 14px/0.14em fg ·
`.label` 11px/0.18em dim. **11px is an absolute floor with no exceptions**, except step numbers,
which `SideRail` and `SiteHeader` both set at 10px.

## Components to reuse (do not rebuild)

`SideRail` — 16rem pane, `border-r border-line bg-surface/25`, nav `sticky top-16 px-4 py-6`,
header `border-b px-3 pb-4` with `.label-lead` and an optional mono meta line, rows
`grid items-baseline gap-2 rounded-md border-l-2 px-3 py-2.5` with a 10px tabular step and a
13px label, active `border-cyan bg-cyan/5 text-fg`, sections indented `ml-[1.4rem]` behind a
`border-l border-line`. Below `xl` the rail is not rendered at all.

`GraphThumbnail` — halo `r23 @12%`, core `r13 @90%`, ring `r16.5 @50% sw1`; edges `sw1.6 @70%`;
arrowheads 8 long, 3.6 half-width, tip on the target's rim at `PORT_R`. Edge variants: flow
(blueprint-line), control (violet, dashed), fallback (amber, dashed). `nodeLabels={false}` on
any tile.

`Avatar` — sizes are `sm 24 · md 32 · lg 44 · xl 64` with per-size initial ratios so initials
never fall below 11px. **Do not invent intermediate sizes**; `sm` is the size for a row.

`FavoriteStar` (read its header before touching it — it documents why it is a sibling of the
stretched link rather than nested inside it), `ContentCard`, `BundlePanel`, `CloneMenu`, `ForkAction`, `MetricBars`, `ScoreRadar`,
`DiagnosticList`, `ComingSoonBadge`, `Stat`, `TagPill`, `More`, `CopyButton`.

## Assets

None new. Avatars are generated from `avatarGradient(hue)` — a hue per author, no uploads.
The bookmark and star are inline SVG paths owned by `FavoriteStar`. The remaining glyphs are text
characters already used in the codebase: `✓ ◐ ▲ ⏸ ✦ ◈ ▤ ≡ └ ▾ ⌕`.
Fonts are the three already loaded via `next/font/google` in `app/layout.tsx`.

## Tests this work must not break

- `components/site/nav.test.ts` — one label per route (this is what decision 1 exists for).
- `components/site/honesty.test.ts` — the word `git` must not appear on the clone surfaces.
- `components/spec/spec-routes.test.ts` — walks `app/spec` against `SPEC_SEQUENCE`.
- `lib/content/bundle-export.test.ts` — the download command names exactly the generated files.
- `lib/format.test.ts` — no autonomy band ordinal reaches a rendered string.

## Files

- `DarkPrint Accounts.dc.html` — all eight screens, top to bottom in the order 08, 07, 06, 05,
  01, 02, 03, 04. Open it in a browser; it needs no build step. This is the authority: the
  screenshots below are renders of it.
- `screenshots/` — one PNG per screen, at the design width:
  - `01-public-profile.png` — `/u/[username]`, as a visitor sees it
  - `02-your-profile.png` — the signed-in owner view, with the account menu open beside the header
  - `03-settings.png` — the seven settings sections on their rail
  - `04-owned-bundle.png` — a bundle you own, handled as a repository
  - `05-published-blueprint.png` — `/blueprints/[slug]` on the same shell
  - `06-navigation.png` — the header today and proposed, both menus open, and the mobile sheet
  - `07-shelf.png` — the tile before and after, and the two fork treatments
  - `08-learn.png` — the Learn rail today and regrouped, with the pager

  Screens 06, 07 and 08 are **comparisons, not screens to build**: each shows the current state
  beside the proposal, with today's problems marked in `--color-signal` and the changes in
  `--color-emerald`. Build the right-hand side.
