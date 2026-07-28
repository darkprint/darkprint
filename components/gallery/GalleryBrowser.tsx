"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

/** Interactive tag chip — mirrors TagPill styling but toggles on click. */
function TagChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex cursor-pointer items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
        active
          ? "border-cyan/60 bg-cyan/10 text-cyan"
          : "border-line text-muted hover:border-line-bright hover:text-fg",
      )}
    >
      #{label}
    </button>
  );
}

/**
 * Applies the `?tag=` deep link (a blueprint page links here with one of its tags).
 *
 * `useSearchParams` cannot be called while prerendering, so it lives in this leaf
 * behind its own Suspense boundary: the bail-out to client rendering stops at that
 * boundary and the browser above — controls, counts, card grid — still ships as
 * static HTML. Renders nothing; it only seeds state.
 */
function TagFromQuery({
  tags,
  onTag,
}: {
  tags: readonly string[];
  onTag: (tag: string) => void;
}) {
  const raw = useSearchParams().get("tag");

  useEffect(() => {
    // Ignore a tag that no blueprint carries, so a stale link cannot render an
    // empty gallery with a filter the user never chose.
    if (raw !== null && tags.includes(raw)) onTag(raw);
  }, [raw, tags, onTag]);

  return null;
}

export function GalleryBrowser({
  blueprints,
  tags,
  categories,
}: {
  /* Readonly throughout: these arrive frozen from the registry, and nothing here
     needs to write to them. */
  blueprints: readonly Blueprint[];
  tags: readonly string[];
  categories: readonly string[];
}) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [autonomy, setAutonomy] = useState<AutonomyClass | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");

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
  }, [blueprints, search, tag, category, phase, autonomy, sort]);

  const hasFilters =
    search.trim() !== "" ||
    tag !== null ||
    category !== null ||
    phase !== null ||
    autonomy !== null;

  function clearFilters() {
    setSearch("");
    setTag(null);
    setCategory(null);
    setPhase(null);
    setAutonomy(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <TagFromQuery tags={tags} onTag={setTag} />
      </Suspense>

      {/* control bar */}
      <div className="panel flex flex-col gap-4 p-4">
        {/* Four controls now, so the row wraps rather than crushing the selects. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blueprints, summaries, tags…"
              aria-label="Search blueprints"
              className="w-full rounded-md border border-line bg-surface-2 py-2 pl-8 pr-3 text-sm text-fg placeholder:text-faint outline-none transition-colors focus:border-line-bright"
            />
          </div>

          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by category</span>
            <select
              value={category ?? ""}
              onChange={(e) => setCategory(e.target.value || null)}
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
              onChange={(e) => setPhase(e.target.value || null)}
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
              onChange={(e) =>
                setAutonomy(
                  e.target.value === "" ? null : (e.target.value as AutonomyClass),
                )
              }
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

          <label className="flex items-center gap-2">
            <span className="sr-only">Sort blueprints</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
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

        {/* tag chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <TagChip
              key={t}
              label={t}
              active={tag === t}
              onClick={() => setTag((prev) => (prev === t ? null : t))}
            />
          ))}
        </div>

        {/* The same marker `/u/` and the blueprint scorecard already use, at the one
            control that offers to order the shelf by a figure nobody counted. Glyph and
            word, never colour alone. */}
        <p className="border-t border-line pt-3 text-xs leading-relaxed text-dim">
          <span className="font-mono text-amber" aria-hidden>
            ◐
          </span>{" "}
          <span className="font-mono uppercase tracking-[0.12em] text-amber">seeded</span>.
          The download and vote counts on every tile are rows in the index. There is no
          ballot and no counter behind them, and the two orderings above sort those rows.
        </p>
      </div>

      {/* result count + reset */}
      <div className="flex items-center justify-between gap-3 font-mono text-xs text-dim">
        <span>
          <span className="text-fg">{results.length}</span> of{" "}
          {blueprints.length} blueprint{blueprints.length === 1 ? "" : "s"}
        </span>
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
          <p className="font-display text-lg font-semibold text-fg">
            No blueprints match
          </p>
          <p className="max-w-md text-sm text-muted">
            Nothing in the registry matches these filters. Try a broader query
            or drop a tag.
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
