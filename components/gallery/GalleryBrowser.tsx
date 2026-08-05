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

const controlClass =
  "rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg outline-none transition-colors focus:border-line-bright";


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

  /* The sort survives a reset: it is how the reader chose to read the shelf, not a
     narrowing of it. One write, so one history entry rather than six. */
  const clearFilters = useCallback(() => {
    setDraft("");
    clear(["q", "tag", "cat", "phase", "autonomy", "df"]);
  }, [clear]);

  return (
    <div className="flex flex-col gap-6">
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
          how many filters are active, so nothing is hidden and nothing is lost. */}
      <div className="panel flex flex-col gap-4 p-4">
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
                 only hint of what the field accepts. */
              className="w-full rounded-md border border-line bg-surface-2 py-2 pl-8 pr-3 text-sm text-fg placeholder:text-dim outline-none transition-colors focus:border-line-bright"
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
          <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-xs text-muted transition-colors hover:text-fg">
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

              <label
                className={cx(
                  "flex cursor-pointer select-none items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs transition-colors",
                  darkFactory
                    ? "border-line-bright bg-surface-3 text-fg"
                    : "border-line bg-surface-2 text-muted hover:text-fg",
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
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-cyan/60 bg-cyan/10 px-2.5 py-1 font-mono text-[11px] text-cyan transition-colors hover:border-cyan"
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
            className="cursor-pointer text-muted underline-offset-4 transition-colors hover:text-cyan hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* grid / empty state */}
      {results.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((bp) => (
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
              className="mt-1 cursor-pointer font-mono text-xs text-cyan underline-offset-4 hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
