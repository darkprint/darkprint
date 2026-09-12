"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryState } from "@/components/ui/useQueryState";
import {
  CONTROL_CLASS,
  RegistryFilterBar,
  SearchField,
} from "@/components/ui/RegistryFilterBar";
import type { AutonomyClass, Blueprint } from "@/lib/types";
import { ContentRow } from "@/components/ui/ContentRow";
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
/* `fieldClass` is gone with the input it dressed: `SearchField` owns that shape now, in
   `components/ui/RegistryFilterBar.tsx`, which is where the note below has said it belongs
   since before there was a third consumer. `controlClass` stays as an alias because it is
   this file's own word for the shape its selects take. */
const controlClass = CONTROL_CLASS;

/**
 * The blueprint the landing draws, the folder every download link on the site points at,
 * and tile 1 of 9 with nothing to say so. See the lead cell at the foot of this file.
 */
const STARTER_SLUG = "starter-software-factory";

/** What the shelf may be ordered by. `newest` is what it has always done. */
type GallerySort = "newest" | "oldest" | "title";

const SORT_OPTIONS: { value: GallerySort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
];

const DEFAULT_GALLERY_SORT: GallerySort = "newest";

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

  /* The shelf has always ordered newest-first and never said so, which is fine until the
     archive is big enough that a reader wants the other end of it. A value outside the three
     falls back to the default rather than ordering by nothing. */
  const rawSort = params.get("sort");
  const sort: GallerySort = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? (rawSort as GallerySort)
    : DEFAULT_GALLERY_SORT;

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
  /* `narrowOpen` stood here, with a note saying the disclosure below "is open when a filter
     inside it is set, so a reader can never have an active filter they cannot see", and
     `TagFromQuery` setting one from `?tag=` was the case it named.
     ------------------------------------------------------------
     The disclosure is gone and so is the problem it was managing. Phase and autonomy are in
     the open row now, because the shelf DISPLAYS both — five coverage slots and the class on
     every row's shape line — and a filter whose answer is on screen should not be behind a
     toggle. The tag chip is in the open too, so the deep link that made this state necessary
     lands on something a reader can see and remove without opening anything.

     `narrowCount` went with it: it existed to print "N active" on the summary of a control
     that no longer exists. Nothing else read either of them. */

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
      if (tag && !bp.tags.includes(tag)) return false;
      if (q) {
        const haystack =
          [
            bp.title,
            bp.summary,
            bp.description,
            bp.category,
            ...bp.tags,
            ...bp.requiredAgents,
            ...bp.requiredTools,
            ...bp.cardRefs,
            ...bp.graph.nodes.map((node) => node.label),
          ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const at = a.updatedAt || a.createdAt;
      const bt = b.updatedAt || b.createdAt;
      /* A manifest may carry neither date, and `''` then sorts LAST under `newest` — which
         is where a blueprint with no date belongs — and FIRST under `oldest`, which is where
         it does not. So the empty case is answered before the direction is applied, and it
         lands last either way. */
      if (at === "" || bt === "") {
        if (at !== bt) return at === "" ? 1 : -1;
        return a.title.localeCompare(b.title);
      }
      const byDate = sort === "oldest" ? at.localeCompare(bt) : bt.localeCompare(at);
      return byDate || a.title.localeCompare(b.title);
    });
    return sorted;
  }, [blueprints, search, tag, category, phase, autonomy, sort]);

  const hasFilters =
    search.trim() !== "" ||
    tag !== null ||
    category !== null ||
    phase !== null ||
    autonomy !== null;

  /** The filters actually on, named the way the reader set them, for the empty state. */
  const activeFilters = [
    search.trim() !== "" && `“${search.trim()}”`,
    category !== null && category,
    tag !== null && `#${tag}`,
    phase !== null && phase,
    autonomy !== null && autonomy,
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
   * THE SORT GATE IS NOW WIRED, and it was not. This paragraph named "Most downloaded" as
   * the instruction a lead cell must not jump, from a control that had since been removed —
   * so the gate was prose with nothing reading it, and the cell led the shelf under every
   * order. Adding `Oldest first` made that visible: the starter sat at the top of a list the
   * reader had just asked to be shown the other way round. `sort === DEFAULT_GALLERY_SORT`
   * is that sentence, wired.
   *
   * ── What is no longer true, and is left as a decision rather than fixed here ──
   * "Under recency the starter is already first, so the lead cell reorders nothing at all."
   * That held at nine blueprints. The archive carries sixteen and six of them are dated
   * after the starter's 2026-07-28, so under `Newest first` the lead cell now LIFTS it over
   * newer work rather than widening what was already tile 1. It stays because the starter is
   * what every argument on the site points at, which is the other half of the case above —
   * but it is now an editorial choice with a cost, where it used to be free.
   */
  const leadBlueprint =
    !hasFilters && sort === DEFAULT_GALLERY_SORT
      ? (results.find((bp) => bp.slug === STARTER_SLUG) ?? null)
      : null;
  const gridBlueprints =
    leadBlueprint === null ? results : results.filter((bp) => bp !== leadBlueprint);

  /* The sort survives a reset: it is how the reader chose to read the shelf, not a
     narrowing of it. One write, so one history entry rather than five. */
  const clearFilters = useCallback(() => {
    setDraft("");
    clear(["q", "tag", "cat", "phase", "autonomy"]);
  }, [clear]);

  return (
    /* `gap-5`, the canonical card tier. `gap-6` is 24px and 24 is not on the vertical
       scale at all — it was the one number between the panel, the count row and the grid
       that nobody had chosen. */
    <div className="flex flex-col gap-5">
      {/* The disclosure, the panel and the two shapes above all live in
          `components/ui/RegistryFilterBar.tsx` now. What stays here is what only this
          browser knows: which filters exist, what they are called, and how they narrow the
          shelf. The component's own docblock carries the measurements that produced the
          disclosure. */}
      <RegistryFilterBar
        id="blueprint-filters"
        label="Filter blueprints"
        results={results.length}
        total={blueprints.length}
        active={activeFilters.length}
      >
        {/* Four questions about the blueprints, in one open row.
            ------------------------------------------------------------
            Phase and autonomy are in the open rather than behind a `Narrow further`
            disclosure because the shelf DISPLAYS both — the coverage strip is five slots
            down every row and the class is on the shape line — and a filter whose answer is
            already on screen should not cost a toggle to find.

            The fork stance is not one of them. `app/blueprints/page.tsx` asks the API for
            `forks: "all"` on the premise that this component applies `rolled` itself, and
            nothing in this file reads `forks`, so every published fork stands on the shelf
            as its own row. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            value={search}
            onChange={setDraft}
            placeholder="Describe a task, tool, input, or constraint…"
            ariaLabel="Search blueprints"
          />

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

          {/* The one control here that ORDERS rather than filters, so it does not join the
              `Clear filters` set below: clearing a filter is about what is on the shelf, and
              an order is about the shelf itself. */}
          <label className="flex items-center gap-2">
            <span className="sr-only">Order the blueprints</span>
            <select
              value={sort}
              onChange={(e) =>
                setParam("sort", e.target.value === DEFAULT_GALLERY_SORT ? null : e.target.value)
              }
              aria-label="Order the blueprints"
              className={controlClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
        </div>

        {/* One removable chip, not thirty.
            ------------------------------------------------------------
            It kept its place when the disclosure around it went, and its remove button with
            it. The row it replaced rendered every tag in the archive, alphabetically,
            uncounted: measured against every `blueprint.yaml`, of 30 tags **24 match exactly
            one blueprint and 6 match two — none matches three**. The best narrowing any chip
            could deliver was 9 → 2, on a shelf a reader scrolls past in one screen. That is
            a hyperlink with extra steps, and every one of those hyperlinks is already printed
            on the row it points at and on the detail page it opens.

            It also cost the most: 308px tall at phone width, thirteen wrapped rows, 43% of a
            714px viewport. The chips were single-select behaving as thirty `aria-pressed`
            toggles, so pressing one silently unpressed another with nothing announced.

            What remains is the part that was load-bearing: a deep link from a blueprint
            detail page stays legible and removable. Tags are still reachable — the search box
            matches `tags.join(" ")`, and every detail page prints its own.

            It no longer needs a disclosure to auto-open for it, which was the mechanism that
            put a wall of chips on the busiest road into this page. */}
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

      </RegistryFilterBar>

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

      {/* rows / empty state */}
      {results.length > 0 ? (
        /* A column of rows, `gap-3`, where this was a three-column grid of tiles.
           ------------------------------------------------------------
           The shelf offers phase coverage and autonomy class as ways in and no tile showed
           either of them: a reader filtered on two axes the grid never displayed, then had
           to open a blueprint to find out what they had just filtered for. A grid
           of nine posters is for browsing; choosing between nine is a comparison, and a
           comparison wants rows — each axis reads down a column now.

           `ContentRow` and not `ContentCard` with a prop: that file's own header says why,
           and the short version is that the two share a frame and almost no composition. */
        <div className="flex flex-col gap-3">
          {/* The lead row.
              ------------------------------------------------------------
              A full-width row rather than a two-column cell, and everything the gate's
              docblock argues still applies — it widens a row instead of a tile now.

              The marker is the site's own panel-title tier, `.label-lead`, which
              `app/globals.css` defines as "the thing a reader starts at". No new colour and
              no new shape: cyan is already spent on this page's one `.eyebrow`, and amber is
              under contract for exactly two jobs (`ComingSoonBadge` and `.route-box`),
              neither of which this is.

              It sits ABOVE the row rather than on it. Inside, the row stacks a full-bleed
              `<Link>` at `z-10` and the star at `z-20`, and a badge dropped into that would
              have to out-rank the row's own hit target to be seen — card furniture is capped
              at 20 by the z ladder for good reason. A label in normal flow above owes nothing
              to that stack, and a screen reader reaches it immediately before the row it
              describes.

              What the grid's version of this note worried about is now moot. It said a
              taller preview with node names switched on "wants a prop on `ContentCard`,
              which is not this file", and it recorded the 3x3 arithmetic that two lead slots
              broke. Rows have no columns to divide by, and the drawing got bigger for every
              bundle rather than for the lead alone — see `ContentRow`. */}
          {leadBlueprint !== null && (
            <div className="flex flex-col gap-2">
              <p className="label-lead">Start here: the five-node starter factory</p>
              <ContentRow item={leadBlueprint} />
            </div>
          )}
          {gridBlueprints.map((bp) => (
            <ContentRow key={`${bp.ownerHandle ?? ""}/${bp.slug}`} item={bp} />
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
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
