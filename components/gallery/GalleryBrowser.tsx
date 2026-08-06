"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryState } from "@/components/ui/useQueryState";
import type { AutonomyClass, Blueprint } from "@/lib/types";
import { cx } from "@/lib/format";
import { ContentCard } from "@/components/ui/ContentCard";
import { PHASE_ORDER, phaseLabel } from "@/components/ui/PhaseCoverage";

/**
 * How the grid is ordered.
 *
 * Autonomy is deliberately absent, and it used to be the default. Doc 2 §1.1: in the
 * gallery autonomy is "un **filtro**, non un ordinamento di merito. Nessuna classifica
 * implicita in cui 4 sta sopra 1." Ordering the registry by band put every blueprint
 * with a person in it at the bottom of the page — a ranking nobody wrote down, applied
 * before the reader had chosen anything. It is a filter now, further down this file.
 *
 * The dark factory classification is absent from this list for the same reason and one
 * more: it is the classification doc 2 §1.1 guards most tightly, and a "dark factories
 * first" option would be the leaderboard the principle exists to keep off the page.
 *
 * The default is recency, which orders by when something happened rather than by how
 * good anything is. Downloads and votes stay available because doc 2 §1.1 endorses
 * reputation earned "sulla qualità e sull'uso" — they are just no longer the only way
 * in, and none of them is imposed.
 *
 * Both of those say `seeded` in the option itself. Doc 2 §0.4 and the honesty rule the
 * rest of the site keeps: there is no ballot and no download counter, the figures are
 * rows in `lib/data/community.ts`, and `/how-to-build-a-dark-factory` states in as many
 * words that there are "no accounts, no votes and no telemetry". A control offering to
 * order the shelf by a number it does not have has to say so where the offer is made,
 * not in a footer two screens down.
 */
type SortKey = "recent" | "downloads" | "votes";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently updated" },
  { value: "downloads", label: "Most downloaded · seeded" },
  { value: "votes", label: "Most upvoted · seeded" },
];

/**
 * One field shape, for every control in this bar.
 *
 * There were two. The search box was `py-2 pl-8 pr-3 text-sm` — 38px tall, 14px Geist —
 * and the four selects were `px-3 py-2 font-mono text-xs` — 35.5px tall, 12px JetBrains —
 * sitting in one `sm:items-center` row. Two heights 2.5px apart and two typefaces is not
 * a distinction a reader can read as intent; at that distance it reads as nobody having
 * looked. `h-10` fixes the height at the canonical control size rather than deriving it
 * from padding plus whatever the font happens to be.
 *
 * `w-full … sm:w-auto` comes from the twin bar in `components/nodes/NodeBrowser.tsx`,
 * which grew it and never had it copied across: without it a phone gets four controls at
 * four ragged widths (measured 147, 219, 198 and 190px) stacked down a panel.
 *
 * No `outline-none`. It was dead code — the global `:focus-visible` rule in
 * `app/globals.css` is unlayered and wins outright — and all it did was state the
 * opposite of what the page does, which is the worst thing a dead declaration can do.
 *
 * ── The two browsers ──
 * This string and the sticky disclosure below are now near-duplicates of
 * `NodeBrowser`'s. The right long-term home is a shared `components/ui/RegistryFilterBar`
 * that both browsers and a future `/ontology` one mount. It is deliberately NOT extracted
 * here: that refactor has to move both files at once, and this pass owns only one of them.
 */
const fieldClass =
  "h-10 rounded-md border border-line bg-surface-2 px-3 font-mono text-xs text-fg transition-colors focus:border-cyan";

/** The shape plus the responsive width. The search box takes `fieldClass` and stays
    full-width at every size, because it lives in the row's `flex-1` cell. */
const controlClass = `${fieldClass} w-full sm:w-auto`;

/**
 * The blueprint the landing draws, the folder every download link on the site points at,
 * and tile 1 of 9 with nothing to say so. See the lead cell at the foot of this file.
 */
const STARTER_SLUG = "starter-software-factory";

export function GalleryBrowser({
  blueprints,
  categories,
}: {
  /* Readonly throughout: these arrive frozen from the registry, and nothing here
     needs to write to them. */
  blueprints: readonly Blueprint[];
  categories: readonly string[];
}) {
  const { params, set: setParam, clear } = useQueryState();

  /* Every filter is read from the address bar rather than mirrored into React state, so
     there is one source of truth and Back cannot disagree with the shelf. `?tag=` used
     to be read once at mount and never written, which left `Clear filters` showing all
     nine blueprints under a URL still reading `?tag=RAG`. */
  const tag = params.get("tag");
  const category = params.get("cat");
  const phase = params.get("phase");
  const rawAutonomy = params.get("autonomy");
  const autonomy = (rawAutonomy as AutonomyClass | null) ?? null;

  /* The search box is the one control that does not write on every keystroke: `draft`
     is what has been typed since the last write, `null` means "follow the URL", and the
     write is debounced because Safari throttles `replaceState`. */
  const [draft, setDraft] = useState<string | null>(null);
  const search = draft ?? (params.get("q") ?? "");

  useEffect(() => {
    if (draft === null) return;
    const timer = setTimeout(
      () => setParam("q", draft.trim() === "" ? null : draft),
      250,
    );
    return () => clearTimeout(timer);
  }, [draft, setParam]);
  /* Doc 2 §1.1 permits autonomy as a way in and forbids it as a ranking, and this is the
     same shape: a filter, never a sort, and the tiles still hide the token itself
     (`showDarkFactory={false}` in `ContentCard`). What it selects became a real question
     on 2026-08-04, when `isDarkFactory` started requiring all five lifecycle phases as
     well as an unattended graph. Before that it meant "nobody stands in this graph",
     which the autonomy class beside it already said. */
  const darkFactory = params.get("df") === "1";
  const rawSort = params.get("sort");
  const sort: SortKey = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? (rawSort as SortKey)
    : "recent";
  /* The disclosure below is open when a filter inside it is set, so a reader can never
     have an active filter they cannot see. `TagFromQuery` sets one from `?tag=`, which is
     exactly that case. */
  const [narrowOpen, setNarrowOpen] = useState(false);

  /** Open on mobile, where the whole panel is behind a disclosure. Ignored from `sm` up. */
  const [filtersOpen, setFiltersOpen] = useState(false);

  /*
   * Doc 2 §1.1 — autonomy as a way in, and never as a league table. The list offers only
   * the classes the registry actually holds: picking `Supervised` narrows the gallery to
   * the factories that keep a person on the critical move, exactly as picking a category
   * narrows it to a category. Nothing here sorts, scores or compares one class against
   * another.
   *
   * The option says the class and stops. The band it came from used to be printed in
   * front of it, which put a 1-to-4 scale in a select where every other option is a name,
   * and a reader had no way to tell it from the 1-to-5 organisational ladder the landing
   * teaches. `level` survives only as the key this list is ordered on, which the engine
   * keeps for exactly that: an ordinal is what gives a menu a stable order, and the
   * spec allows it there and nowhere a reader can see.
   */
  const classes = useMemo(() => {
    const byClass = new Map<AutonomyClass, { label: string; level: number }>();
    for (const bp of blueprints) {
      byClass.set(bp.autonomy.autonomyClass, {
        label: bp.autonomy.label,
        level: bp.autonomy.level,
      });
    }
    return [...byClass.entries()].sort((a, b) => a[1].level - b[1].level);
  }, [blueprints]);

  /*
   * Doc 2 §8 — phase coverage as a way in. Only the phases some blueprint actually
   * covers are offered, so no option in the list can return nothing, and they are
   * offered in lifecycle order rather than sorted: the order is the shape of a
   * factory. This is a filter and only a filter (doc 2 §1.1) — picking `debugging`
   * narrows the gallery to the factories that debug, it does not rank anything, and
   * nothing here counts phases or compares one blueprint's coverage to another's.
   *
   * `covered` is the union of what the nodes declare, and a node declaring no phase
   * adds nothing to it — which is why the gallery must never grow an option for
   * "covers all five" or a sort by how many. A factory covering three phases is three
   * ways into this list, not two short of anything.
   */
  const phases = useMemo(() => {
    const covered = new Set<string>();
    for (const bp of blueprints) {
      for (const id of bp.analysis.phaseCoverage.covered) covered.add(id);
    }
    return PHASE_ORDER.filter((id) => covered.has(id));
  }, [blueprints]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = blueprints.filter((bp) => {
      if (category && bp.category !== category) return false;
      if (phase && !bp.analysis.phaseCoverage.covered.includes(phase)) return false;
      if (autonomy !== null && bp.autonomy.autonomyClass !== autonomy) return false;
      if (darkFactory && !bp.autonomy.isDarkFactory) return false;
      if (tag && !bp.tags.includes(tag)) return false;
      if (q) {
        const haystack =
          bp.title.toLowerCase() +
          " " +
          bp.summary.toLowerCase() +
          " " +
          bp.tags.join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        // Dates are stored as `YYYY-MM-DD`, so a string compare is a date compare.
        // Title breaks the tie, which keeps a batch published on one day in a stable
        // order instead of shuffling on every render.
        case "recent": {
          const at = a.updatedAt || a.createdAt;
          const bt = b.updatedAt || b.createdAt;
          return bt.localeCompare(at) || a.title.localeCompare(b.title);
        }
        case "downloads":
          return b.downloads - a.downloads;
        case "votes":
          return b.votes - a.votes;
        default:
          return 0;
      }
    });
    return sorted;
  }, [blueprints, search, tag, category, phase, autonomy, darkFactory, sort]);

  /** How many of the filters behind the disclosure are set. Printed on the summary. */
  const narrowCount =
    (tag !== null ? 1 : 0) +
    (phase !== null ? 1 : 0) +
    (autonomy !== null ? 1 : 0) +
    (darkFactory ? 1 : 0);

  const hasFilters =
    search.trim() !== "" ||
    tag !== null ||
    category !== null ||
    phase !== null ||
    autonomy !== null ||
    darkFactory;

  /** The filters actually on, named the way the reader set them, for the empty state. */
  const activeFilters = [
    search.trim() !== "" && `“${search.trim()}”`,
    category !== null && category,
    tag !== null && `#${tag}`,
    phase !== null && phase,
    autonomy !== null && autonomy,
    darkFactory && "dark factory",
  ].filter((label): label is string => typeof label === "string");

  /**
   * The lead cell, or `null` when the shelf is not in the state that earns one.
   *
   * A perfectly regular 3×3 of identical tiles says that all nine are equally good ways
   * in, and that is false: `starter-software-factory` is the graph the landing draws
   * across five beats, the one `/spec/topology` reads, and the folder every download link
   * on the site points at. A reader arriving from the landing's argument met it as tile 1
   * of 9 with nothing distinguishing it from `Nightly Data Janitor`.
   *
   * ── Why it is gated so tightly ──
   * A shelf that reorders itself under a reader's own instruction is worse than a flat
   * shelf. So the lead cell exists only when nothing has been asked of the grid: no
   * search, no category, no facet — and, one step stricter than the brief, only under the
   * default recency sort. Picking `Most downloaded` is an instruction about order, and a
   * featured cell jumping that queue would contradict the control the reader just used.
   * Under recency the starter is already first (it is the most recently updated of the
   * nine), so in the state that shows it, the lead cell reorders nothing at all — it only
   * widens what was already tile 1.
   */
  const leadBlueprint =
    !hasFilters && sort === "recent"
      ? (results.find((bp) => bp.slug === STARTER_SLUG) ?? null)
      : null;
  const gridBlueprints =
    leadBlueprint === null ? results : results.filter((bp) => bp !== leadBlueprint);

  /* The sort survives a reset: it is how the reader chose to read the shelf, not a
     narrowing of it. One write, so one history entry rather than six. */
  const clearFilters = useCallback(() => {
    setDraft("");
    clear(["q", "tag", "cat", "phase", "autonomy", "df"]);
  }, [clear]);

  return (
    /* `gap-5`, the canonical card tier. `gap-6` is 24px and 24 is not on the vertical
       scale at all — it was the one number between the panel, the count row and the grid
       that nobody had chosen. */
    <div className="flex flex-col gap-5">
      {/* The mobile disclosure.
          ------------------------------------------------------------
          Ported from the twin bar in `components/nodes/NodeBrowser.tsx`, which grew it
          and never had it brought across. At 390px this panel is 117px of static form
          standing between a reader and the shelf they came for, and it is `static`, so
          changing a filter after scrolling nine tiles meant scrolling all the way back.

          One panel, not two. A second copy behind a media query would duplicate every
          input, every label and every tab stop, which is worse for a screen reader than
          the problem it solves. So the panel below is hidden by state under `sm` and
          forced visible from `sm` up, and this button — which only exists under `sm` —
          toggles it and carries both counts: how many filters are on, and how much of
          the shelf is left.

          `z-40` is the page-chrome rung of the site's z ladder (header 50 · page chrome
          40 · section chrome 30 · card furniture 20 · card hit target 10). */}
      <div className="sticky top-16 z-40 -mx-1 bg-void/95 px-1 py-2 backdrop-blur-sm sm:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="blueprint-filters"
          /* `scale-[0.99]`, the >200px band: this bar runs the full width of the phone,
             and 0.97 on a 342px element travels 10px sideways, which reads as a wobble
             rather than as a press. `scale` is named in the property list beside
             `transform` because Tailwind v4 compiles `scale-[…]` to the standalone
             `scale` property, and a list naming only `transform` leaves the press
             untransitioned. */
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5 font-mono text-xs text-fg transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-line-bright hoverable:active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-cyan">
              {filtersOpen ? "▾" : "▸"}
            </span>
            Filter
            {activeFilters.length > 0 && (
              <span className="rounded-full bg-cyan/15 px-2 py-0.5 tabular-nums text-cyan">
                {activeFilters.length}
              </span>
            )}
          </span>
          <span className="tabular-nums text-dim">
            {results.length}/{blueprints.length}
          </span>
        </button>
      </div>

      {/* ---------------- control bar ----------------

          It carried **37 interactive controls before the first of 9 blueprints**, 30 of
          them tag pills. Measured against the archive: 24 of those 30 tags match exactly
          one blueprint and none matches more than two, so four fifths of the row was a
          one-item lookup wearing a facet's clothes. A shelf of nine does not need
          faceting sized for thousands, and the reader arriving from the landing's
          argument met a wall instead of the work.

          Three controls stay in the open, because they are the three questions somebody
          browsing nine things actually asks: what is it called, what kind is it, what
          order do I want them in. Everything else moves behind one disclosure that says
          how many filters are active, so nothing is hidden and nothing is lost.

          `role="search"`, because it is one: without it the landmark list on this page
          was HEADER / NAV / MAIN / FOOTER, and the thing the page is for had no name in
          it. The sibling browser already carried this; it was never brought across.

          `px-4 py-3`, not `p-4`: the horizontal padding is the element tier and the
          vertical is the tight tier, because what sits inside is one row of 40px
          controls, not a paragraph. */}
      <div
        id="blueprint-filters"
        role="search"
        aria-label="Filter blueprints"
        className={cx(
          "panel flex-col gap-4 px-4 py-3 sm:flex",
          filtersOpen ? "flex" : "hidden",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-[14rem] flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-dim"
            >
              /
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search blueprints, summaries, tags…"
              aria-label="Search blueprints"
              /* `text-dim` (5.43:1), not `text-faint` (1.83:1). The twin control in
                 `components/nodes/NodeBrowser.tsx` already carried this fix and a comment
                 explaining it; it was never applied to this file. A placeholder is the
                 only hint of what the field accepts.

                 One shape with the selects beside it — see `controlClass` — plus `pl-8`,
                 which is the only thing that differs, and only because this field has a
                 `/` glyph standing in its left gutter. */
              className={cx(fieldClass, "w-full pl-8 placeholder:text-dim")}
            />
          </div>

          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by category</span>
            <select
              value={category ?? ""}
              onChange={(e) => setParam("cat", e.target.value || null)}
              aria-label="Filter by category"
              className={controlClass}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">Sort blueprints</span>
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value === "recent" ? null : e.target.value)}
              aria-label="Sort blueprints"
              className={controlClass}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Controlled rather than a bare `<details>`: `TagFromQuery` can set a tag from a
            deep link, and a filter the reader did not choose and cannot see is worse than
            the row this replaced. */}
        <details
          open={narrowOpen || narrowCount > 0}
          onToggle={(e) => setNarrowOpen(e.currentTarget.open)}
          className="group/narrow border-t border-line pt-3"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-xs text-muted transition-colors hoverable:hover:text-fg">
            <span aria-hidden className="transition-transform group-open/narrow:rotate-90">
              ▸
            </span>
            Narrow further
            {narrowCount > 0 && (
              <span className="rounded-full border border-cyan/50 bg-cyan/10 px-2 py-0.5 text-[11px] text-cyan">
                {narrowCount} active
              </span>
            )}
          </summary>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="flex items-center gap-2">
                <span className="sr-only">Filter by phase covered</span>
                <select
                  value={phase ?? ""}
                  onChange={(e) => setParam("phase", e.target.value || null)}
                  aria-label="Filter by phase covered"
                  className={controlClass}
                >
                  <option value="">All phases</option>
                  {phases.map((id) => (
                    <option key={id} value={id}>
                      Covers {phaseLabel(id).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>

              {/* Doc 2 §1.1: the class picks a subset, it never orders the page. */}
              <label className="flex items-center gap-2">
                <span className="sr-only">Filter by autonomy class</span>
                <select
                  value={autonomy ?? ""}
                  onChange={(e) => setParam("autonomy", e.target.value || null)}
                  aria-label="Filter by autonomy class"
                  className={controlClass}
                >
                  <option value="">All autonomy classes</option>
                  {classes.map(([value, { label }]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Same 40px shell as the selects it stands beside — it is a control in
                  that row, and a control 6px shorter than its neighbours reads as a
                  mistake rather than as a different kind of thing. */}
              <label
                className={cx(
                  "flex h-10 w-full cursor-pointer select-none items-center gap-2 rounded-md border px-3 font-mono text-xs transition-colors sm:w-auto",
                  darkFactory
                    ? "border-line-bright bg-surface-3 text-fg"
                    : "border-line bg-surface-2 text-muted hoverable:hover:text-fg",
                )}
              >
                <input
                  type="checkbox"
                  checked={darkFactory}
                  onChange={(e) => setParam("df", e.target.checked ? "1" : null)}
                  className="h-3.5 w-3.5 accent-cyan"
                />
                <span aria-hidden>◼</span>
                dark factory
              </label>
            </div>

            {/* One removable chip, not thirty.
                ------------------------------------------------------------
                The row rendered every tag in the archive, alphabetically, uncounted.
                Measured against every `blueprint.yaml` in the archive: of 30 tags, **24
                match exactly one blueprint and 6 match two — none matches three**. The
                best narrowing any chip could deliver was 9 → 2, on a shelf a reader
                scrolls past in one screen. That is a hyperlink with extra steps, and
                every one of those hyperlinks is already printed on the tile it points
                at and on the detail page it opens.

                It also cost the most: 308px tall at phone width, thirteen wrapped rows,
                43% of a 714px viewport — and the disclosure auto-opens on the `?tag=`
                path that every blueprint detail page links through, so the wall sat on
                the busiest road into this page. The chips were single-select behaving
                as thirty `aria-pressed` toggles, so pressing one silently unpressed
                another with nothing announced.

                What remains is the part that was load-bearing: the deep link stays
                legible and removable. Tags are still reachable — the search box matches
                `tags.join(" ")`, and every tile prints its own. */}
            {tag !== null && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-dim">Tag</span>
                <button
                  type="button"
                  onClick={() => setParam("tag", null)}
                  aria-label={`Remove the ${tag} tag filter`}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-cyan/60 bg-cyan/10 px-2.5 py-1 font-mono text-[11px] text-cyan transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-cyan hoverable:active:scale-[0.97]"
                >
                  #{tag}
                  <span aria-hidden>×</span>
                </button>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* result count + reset.
          `role="status"` so the number is announced when it changes. Every filter here
          swapped the grid in silence: a reader using a screen reader typed a query and
          had no way to tell whether it matched nine, one, or none. The sibling browser
          already carried this fix; it was never brought across. */}
      <div className="flex items-center justify-between gap-3 font-mono text-xs text-dim">
        <p role="status" aria-live="polite" aria-atomic="true">
          <span className="text-fg">{results.length}</span> of{" "}
          {blueprints.length} blueprint{blueprints.length === 1 ? "" : "s"}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="cursor-pointer text-muted underline-offset-4 transition-colors hoverable:hover:text-cyan hoverable:hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* grid / empty state */}
      {results.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* The lead cell.
              ------------------------------------------------------------
              Two columns wide, so the row it opens is not nine equal cells claiming nine
              equal entry points, and a marker in the site's own panel-title tier —
              `.label-lead`, which `app/globals.css` defines as "the thing a reader starts
              at". No new colour and no new shape: cyan is already spent on this page's
              one `.eyebrow`, and amber is under contract for exactly two jobs
              (`ComingSoonBadge` and `.route-box`), neither of which this is.

              The marker sits above the tile rather than on it. Inside, `ContentCard`
              stacks a full-bleed `<Link>` at `z-10` and the star at `z-20`, and a badge
              dropped into that would have to out-rank the card's own hit target to be
              seen — card furniture is capped at 20 by the z ladder for good reason. A
              label in normal flow above the card owes nothing to that stack, and a screen
              reader reaches it immediately before the tile it describes.

              What is NOT here, deliberately: a taller preview frame with node names
              switched on. `ContentCard` owns its own 112px frame and hard-codes
              `nodeLabels={false}`, and reaching into another component's internals from a
              `className` — `[&_.h-28]:h-44` and friends — buys a bigger drawing at the
              price of a silent break the next time that file is touched. It wants a prop
              on `ContentCard`, which is not this file.

              The arithmetic, seen and accepted: two slots for the lead plus eight tiles is
              ten, and ten does not divide by three, so the last row on a wide screen
              carries one tile and two gaps where nine tiles used to close a perfect 3×3.
              That squareness was an accident of the archive holding exactly nine — the
              tenth blueprint breaks it either way — and a shelf that ends unevenly is what
              every shelf does. It is not worth buying back by leaving all nine equal. */}
          {leadBlueprint !== null && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <p className="label-lead">Start here</p>
              <ContentCard item={leadBlueprint} className="flex-1" />
            </div>
          )}
          {gridBlueprints.map((bp) => (
            <ContentCard key={bp.slug} item={bp} />
          ))}
        </div>
      ) : (
        <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
          {/* An `h2`, so the outline does not run `h1` straight to the footer's `h3`
              when the nine tile headings unmount with the last result. */}
          <h2 className="font-display text-lg font-semibold text-fg">
            No blueprints match
          </h2>
          {/* Names the filters that are actually on, rather than guessing. The line
              read "Try a broader query or drop a tag" to a reader who had typed a query
              and set no tag — advice for a filter they did not have, while the one they
              did have went unmentioned. */}
          <p className="max-w-md text-sm text-muted">
            Nothing in the registry matches{" "}
            {activeFilters.length === 0 ? (
              <>these filters</>
            ) : (
              activeFilters.map((f, i) => (
                <span key={f}>
                  {i > 0 && (i === activeFilters.length - 1 ? " and " : ", ")}
                  <span className="text-fg">{f}</span>
                </span>
              ))
            )}
            .
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 cursor-pointer font-mono text-xs text-cyan underline-offset-4 hoverable:hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
