"use client";

import { useCallback, useMemo } from "react";
import { useTaskQuery, useTaskSearch } from "./useTaskSearch";
import { TaskSearchResults } from "./TaskSearchResults";
import {
  CONTROL_CLASS,
  RegistryFilterBar,
  SearchField,
} from "@/components/ui/RegistryFilterBar";
import type { Blueprint } from "@/lib/types";
import { ContentRow } from "@/components/ui/ContentRow";

const controlClass = CONTROL_CLASS;

const STARTER_SLUG = "starter-software-factory";

type GallerySort = "newest" | "oldest" | "title";

const SORT_OPTIONS: { value: GallerySort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
];

const DEFAULT_GALLERY_SORT: GallerySort = "newest";

function GalleryRow({ blueprint }: { blueprint: Blueprint }) {
  return <ContentRow item={blueprint} />;
}

export function GalleryBrowser({
  blueprints,
  categories,
}: {

  blueprints: readonly Blueprint[];
  categories: readonly string[];
}) {
  const { params, setParam, clear, search, setDraft } = useTaskQuery();
  const task = useTaskSearch("blueprints", search, params);

  // The server read bypasses the API's rolled default, keeping published forks as separate rows.
  const tag = params.get("tag");
  const category = params.get("cat");

  const rawSort = params.get("sort");
  const sort: GallerySort = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? (rawSort as GallerySort)
    : DEFAULT_GALLERY_SORT;

  const results = useMemo(() => {
    const filtered = blueprints.filter((bp) => {
      if (category && bp.category !== category) return false;
      if (tag && !bp.tags.includes(tag)) return false;
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const at = a.updatedAt || a.createdAt;
      const bt = b.updatedAt || b.createdAt;

      if (at === "" || bt === "") {
        if (at !== bt) return at === "" ? 1 : -1;
        return a.title.localeCompare(b.title);
      }
      const byDate = sort === "oldest" ? at.localeCompare(bt) : bt.localeCompare(at);
      return byDate || a.title.localeCompare(b.title);
    });
    return sorted;
  }, [blueprints, tag, category, sort]);

  const hasFilters =
    search.trim() !== "" ||
    tag !== null ||
    category !== null;

  const activeFilters = [
    search.trim() !== "" && `“${search.trim()}”`,
    category !== null && category,
    tag !== null && `#${tag}`,
  ].filter((label): label is string => typeof label === "string");

  const leadBlueprint =
    !hasFilters && sort === DEFAULT_GALLERY_SORT
      ? (results.find((bp) => bp.slug === STARTER_SLUG) ?? null)
      : null;
  const gridBlueprints =
    leadBlueprint === null ? results : results.filter((bp) => bp !== leadBlueprint);

  const clearFilters = useCallback(() => {
    clear(["q", "tag", "cat", "phase", "autonomy"]);
  }, [clear]);

  return (

    <div className="flex flex-col gap-5">

      <RegistryFilterBar
        id="blueprint-filters"
        label="Filter blueprints"
        results={task.searching ? (task.state.status === "ready" ? task.state.data.hits.length : 0) : results.length}
        total={blueprints.length}
        active={activeFilters.length}
      >

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
            <span className="sr-only">Order the blueprints</span>
            <select
              value={task.searching ? "relevance" : sort}
              disabled={task.searching}
              onChange={(e) =>
                setParam("sort", e.target.value === DEFAULT_GALLERY_SORT ? null : e.target.value)
              }
              aria-label="Order the blueprints"
              className={controlClass}
            >
              {task.searching && <option value="relevance">Service relevance</option>}
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

        </div>

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

      <div className="flex items-center justify-between gap-3 font-mono text-xs text-dim">
        {!task.searching && (
          <p role="status" aria-live="polite" aria-atomic="true">
            <span className="text-fg">{results.length}</span> of{" "}
            {blueprints.length} blueprint{blueprints.length === 1 ? "" : "s"}
          </p>
        )}
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

      {task.searching ? <TaskSearchResults state={task.state} retry={task.retry} /> : results.length > 0 ? (

        <div className="flex flex-col gap-3">

          {leadBlueprint !== null && (
            <div className="flex flex-col gap-2">
              <p className="label-lead">Start here: the five-node starter factory</p>
              <GalleryRow blueprint={leadBlueprint} />
            </div>
          )}
          {gridBlueprints.map((bp) => (
            <GalleryRow key={`${bp.ownerHandle ?? ""}/${bp.slug}`} blueprint={bp} />
          ))}
        </div>
      ) : (
        <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">

          <h2 className="font-display text-lg font-semibold text-fg">
            No blueprints match
          </h2>

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
