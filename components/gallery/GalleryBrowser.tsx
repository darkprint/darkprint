"use client";

import { useMemo, useState } from "react";
import type { Blueprint } from "@/lib/types";
import { cx } from "@/lib/format";
import { ContentCard } from "@/components/ui/ContentCard";

type SortKey = "autonomy" | "downloads" | "votes";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "autonomy", label: "Autonomy level" },
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

export function GalleryBrowser({
  blueprints,
  tags,
  categories,
}: {
  blueprints: Blueprint[];
  tags: string[];
  categories: string[];
}) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("autonomy");

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = blueprints.filter((bp) => {
      if (category && bp.category !== category) return false;
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
        case "autonomy":
          return (
            b.autonomy.level - a.autonomy.level || b.downloads - a.downloads
          );
        case "downloads":
          return b.downloads - a.downloads;
        case "votes":
          return b.votes - a.votes;
        default:
          return 0;
      }
    });
    return sorted;
  }, [blueprints, search, tag, category, sort]);

  const hasFilters = search.trim() !== "" || tag !== null || category !== null;

  function clearFilters() {
    setSearch("");
    setTag(null);
    setCategory(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* control bar */}
      <div className="panel flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
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
