"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AutonomyLevel, Blueprint } from "@/lib/types";
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
 * The default is recency, which orders by when something happened rather than by how
 * good anything is. Downloads and votes stay available because doc 2 §1.1 endorses
 * reputation earned "sulla qualità e sull'uso" — they are just no longer the only way
 * in, and none of them is imposed.
 */
type SortKey = "recent" | "downloads" | "votes";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently updated" },
  { value: "downloads", label: "Most downloaded" },
  { value: "votes", label: "Most upvoted" },
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
  const [level, setLevel] = useState<AutonomyLevel | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");

  /*
   * Doc 2 §1.1 — autonomy as a way in, not as a league table. The list offers only the
   * bands the registry actually holds, in numeric order because that is the order of
   * the labels and not an order of merit: picking `level 2 · Supervised` narrows the
   * gallery to the factories that keep a person on the critical move, exactly as
   * picking a category narrows it to a category. Nothing here sorts, scores or
   * compares one band against another.
   */
  const levels = useMemo(() => {
    const byLevel = new Map<AutonomyLevel, string>();
    for (const bp of blueprints) byLevel.set(bp.autonomy.level, bp.autonomy.label);
    return [...byLevel.entries()].sort((a, b) => a[0] - b[0]);
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
      if (level !== null && bp.autonomy.level !== level) return false;
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
  }, [blueprints, search, tag, category, phase, level, sort]);

  const hasFilters =
    search.trim() !== "" ||
    tag !== null ||
    category !== null ||
    phase !== null ||
    level !== null;

  function clearFilters() {
    setSearch("");
    setTag(null);
    setCategory(null);
    setPhase(null);
    setLevel(null);
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

          {/* Doc 2 §1.1: the band picks a subset, it never orders the page. */}
          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by autonomy level</span>
            <select
              value={level === null ? "" : String(level)}
              onChange={(e) =>
                setLevel(
                  e.target.value === ""
                    ? null
                    : (Number(e.target.value) as AutonomyLevel),
                )
              }
              aria-label="Filter by autonomy level"
              className={controlClass}
            >
              <option value="">All autonomy levels</option>
              {levels.map(([value, label]) => (
                <option key={value} value={value}>
                  level {value} · {label}
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
