"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { useTaskQuery, useTaskSearch } from "@/components/gallery/useTaskSearch";
import { TaskSearchResults } from "@/components/gallery/TaskSearchResults";
import { GroupSpine, type GroupSpineItem } from "@/components/ui/GroupSpine";
import {
  CONTROL_CLASS,
  RegistryFilterBar,
  SearchField,
} from "@/components/ui/RegistryFilterBar";
import { PHASE_ORDER } from "@/components/ui/PhaseCoverage";
import { NodeCardSummary, type NodeSummary } from "./NodeCardSummary";

type SortKey = "used" | "name" | "type" | "phase" | "newest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [

  { value: "newest", label: "Newest first" },
  { value: "used", label: "Most used" },
  { value: "name", label: "Name A–Z" },

  { value: "type", label: "By card type" },
  // Lifecycle order, not alphabetical — see `phaseRank` below.
  { value: "phase", label: "By phase" },
];

const DEFAULT_SORT: SortKey = "type";

const SPINE_CLEARANCE = 124;

const controlClass = CONTROL_CLASS;

function byNewest(a: NodeSummary, b: NodeSummary): number {
  if (a.createdAt === b.createdAt) return 0;
  if (a.createdAt === undefined) return 1;
  if (b.createdAt === undefined) return -1;
  return b.createdAt.localeCompare(a.createdAt);
}

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface NodeTypeTerm {
  id: string;
  label: string;

  description?: string;
}

function phaseRank(phases: readonly { id: string }[]): number {
  let rank = PHASE_ORDER.length;
  for (const phase of phases) {
    const i = PHASE_ORDER.indexOf(phase.id);
    if (i !== -1 && i < rank) rank = i;
  }
  return rank;
}

interface Filters {
  type: string | null;
  human: boolean;
  risk: boolean;
}

type Dimension = keyof Filters;

function passes(node: NodeSummary, f: Filters, skip?: Dimension): boolean {
  if (skip !== "type" && f.type !== null && node.type !== f.type) return false;

  if (skip !== "human" && f.human && !node.requiresHuman) return false;
  if (skip !== "risk" && f.risk && node.riskMarkers.length === 0) return false;

  return true;
}

function FilterChip({
  label,
  glyph,
  count,
  active,
  onClick,
  deadReason,
  allowEmpty = false,
}: {
  label: string;
  glyph: string;
  allowEmpty?: boolean;

  count: number;
  active: boolean;
  onClick: () => void;

  deadReason: string;
}) {

  const dead = count === 0 && !active && !allowEmpty;
  return (
    <button
      type="button"
      onClick={dead ? undefined : onClick}

      aria-disabled={dead || undefined}
      title={dead ? deadReason : undefined}
      aria-pressed={active}

      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",

        dead && "cursor-not-allowed border-line text-dim opacity-70",

        active
          ? "border-cyan bg-blue-paper text-cyan"
          : !dead && "border-line text-muted hoverable:hover:border-line-bright hoverable:hover:text-fg",
      )}
    >
      <span aria-hidden>{glyph}</span>
      {label}

      <span className={cx("tabular-nums", active ? "text-cyan" : "text-dim")}>
        {count}
      </span>
    </button>
  );
}

export function NodeBrowser({
  nodes,
  types,
}: {
  nodes: readonly NodeSummary[];

  types: readonly NodeTypeTerm[];
}) {
  const { params, setParam, clear, search, setDraft } = useTaskQuery();
  const task = useTaskSearch("cards", search, params);

  const type = params.get("type");
  const humanOnly = params.get("human") === "1";
  const riskOnly = params.get("risk") === "1";
  const rawSort = params.get("sort");
  const sort: SortKey = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? (rawSort as SortKey)
    : DEFAULT_SORT;

  const filters: Filters = useMemo(
    () => ({ type, human: humanOnly, risk: riskOnly }),
    [type, humanOnly, riskOnly],
  );

  const typeFacets = useMemo(() => {
    const pool = nodes.filter((node) => passes(node, filters, "type"));
    const byId = new Map<string, { id: string; label: string; count: number }>();
    for (const node of nodes) {
      if (!byId.has(node.type)) {
        byId.set(node.type, { id: node.type, label: node.typeLabel, count: 0 });
      }
    }
    for (const node of pool) {
      const found = byId.get(node.type);
      if (found !== undefined) found.count += 1;
    }
    return [...byId.values()].sort((a, b) => byText(a.label, b.label));
  }, [nodes, filters]);

  const humanCount = useMemo(
    () => nodes.filter((node) => node.requiresHuman && passes(node, filters, "human")).length,
    [nodes, filters],
  );
  const riskCount = useMemo(
    () =>
      nodes.filter((node) => node.riskMarkers.length > 0 && passes(node, filters, "risk"))
        .length,
    [nodes, filters],
  );

  function deadReason(own: Dimension): string {
    const parts: string[] = [];
    const q = search.trim();
    if (q !== "") parts.push(`the search “${q}”`);

    if (own !== "type" && type !== null) {
      parts.push(`the node type “${typeFacets.find((t) => t.id === type)?.label ?? type}”`);
    }
    if (own !== "human" && humanOnly) parts.push("“human in the loop”");
    if (own !== "risk" && riskOnly) parts.push("“carries a risk marker”");
    if (parts.length === 0) return "No node card in the registry carries this.";
    return `Nothing is left once this is combined with ${parts.join(" and ")}.`;
  }

  const results = useMemo(() => {
    const filtered = nodes.filter((node) => passes(node, filters));
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "newest":
          return byNewest(a, b) || byText(a.name, b.name);
        case "used":
          return b.usedIn - a.usedIn || byText(a.name, b.name);
        case "type":
          return byText(a.typeLabel, b.typeLabel) || byText(a.name, b.name);
        case "phase":
          return phaseRank(a.phases) - phaseRank(b.phases) || byText(a.name, b.name);
        case "name":
        default:
          return byText(a.name, b.name);
      }
    });
    return sorted;
  }, [nodes, filters, sort]);

  const groups = useMemo(() => {
    if (task.searching || sort !== "type") return null;
    const out: { id: string; label: string; nodes: NodeSummary[] }[] = [];
    for (const node of results) {
      const last = out[out.length - 1];
      if (last !== undefined && last.id === node.type) last.nodes.push(node);
      else out.push({ id: node.type, label: node.typeLabel, nodes: [node] });
    }
    return out;
  }, [results, sort, task.searching]);

  const typeChrome = useMemo(() => {
    const ordered = [...types].sort((a, b) => byText(a.label, b.label));
    const withCards = ordered.filter(
      (term) => (typeFacets.find((facet) => facet.id === term.id)?.count ?? 0) > 0,
    );
    return new Map(
      ordered.map((term) => {
        const position = withCards.indexOf(term);
        return [
          term.id,
          {
            index: position === -1 ? undefined : String(position + 1).padStart(2, "0"),
            label: term.label,
            description: term.description,
          },
        ];
      }),
    );
  }, [types, typeFacets]);

  const panelRefs = useRef(new Map<string, HTMLElement>());
  const [observed, setObserved] = useState<string | null>(null);

  const groupKey = (groups ?? []).map((g) => g.id).join("\u0000");

  useEffect(() => {
    const ids = groupKey === "" ? [] : groupKey.split("\u0000");

    if (ids.length === 0) return;
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.typeId;
          if (id === undefined) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        setObserved(ids.find((id) => visible.has(id)) ?? null);
      },
      { rootMargin: `-${SPINE_CLEARANCE}px 0px 0px 0px` },
    );
    for (const id of ids) {
      const el = panelRefs.current.get(id);
      if (el !== undefined) io.observe(el);
    }
    return () => io.disconnect();
  }, [groupKey]);

  const activeCount =
    (search.trim() !== "" ? 1 : 0) +
    (type !== null ? 1 : 0) +
    (humanOnly ? 1 : 0) +
    (riskOnly ? 1 : 0);
  const hasFilters = activeCount > 0;

  const clearFilters = useCallback(() => {
    clear(["q", "type", "phase", "human", "risk"]);
  }, [clear]);

  const spineItems: GroupSpineItem[] = [...typeChrome.entries()]
    .map(([id, chrome]) => ({
      id,
      label: chrome.label,
      count: typeFacets.find((t) => t.id === id)?.count ?? 0,
      href: `#type-${id}`,
      deadReason: deadReason("type"),
    }))

    .filter((item) => item.count > 0 || item.id === type);

  const activeGroup =
    (observed !== null && groups?.some((g) => g.id === observed) === true
      ? observed
      : groups?.[0]?.id) ?? null;

  return (
    <div className="flex flex-col gap-6">

      {task.searching && <p className="text-sm text-muted">Filter counts describe the browse library. Search applies filters before ranking.</p>}
      <RegistryFilterBar
        id="node-filters"
        label="Filter node cards"
        results={task.searching ? (task.state.status === "ready" ? task.state.data.hits.length : 0) : results.length}
        total={nodes.length}
        active={activeCount}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            value={search}
            onChange={setDraft}
            placeholder="Describe a task, tool, input, or constraint…"
            ariaLabel="Search node cards"
          />

          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by type</span>
            <select
              value={type ?? ""}
              onChange={(e) => setParam("type", e.target.value || null)}
              aria-label="Filter by type"
              className={controlClass}
            >
              <option value="">All types</option>
              {typeFacets.map((t) => (

                <option key={t.id} value={t.id} disabled={!task.searching && t.count === 0}>
                  {t.label} ({t.count})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">Sort node cards</span>
            <select
              value={task.searching ? "relevance" : sort}
              disabled={task.searching}
              onChange={(e) => setParam("sort", e.target.value === DEFAULT_SORT ? null : e.target.value)}
              aria-label="Sort node cards"
              className={controlClass}
            >
              {task.searching && <option value="relevance">Service relevance</option>}
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="human in the loop"
            glyph="⏸"
            count={humanCount}
            allowEmpty={task.searching}
            active={humanOnly}
            deadReason={deadReason("human")}
            onClick={() => setParam("human", humanOnly ? null : "1")}
          />
          <FilterChip
            label="carries a risk marker"
            glyph="△"
            count={riskCount}
            allowEmpty={task.searching}
            active={riskOnly}
            deadReason={deadReason("risk")}
            onClick={() => setParam("risk", riskOnly ? null : "1")}
          />
        </div>
      </RegistryFilterBar>

      <div className="flex items-center justify-between gap-3 font-mono text-xs text-dim">
        {!task.searching && (
          <p role="status" aria-live="polite" aria-atomic="true">
            <span className="text-fg">{results.length}</span> of {nodes.length} node
            card{nodes.length === 1 ? "" : "s"}
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

      {groups !== null && groups.length > 0 && (
        <GroupSpine
          ariaLabel="Jump to a card type"

          className="max-sm:static"
          items={spineItems}
          activeId={activeGroup}
          results={results.length}
          total={nodes.length}

          accent="copper"
        />
      )}

      {task.searching ? <TaskSearchResults state={task.state} retry={task.retry} /> : results.length > 0 ? (
        groups === null ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((node) => (
              <NodeCardSummary key={node.id} node={node} />
            ))}
          </div>
        ) : (

          <div className="flex flex-col gap-5">
            {groups.map((group, i) => {
              const chrome = typeChrome.get(group.id);
              return (

                <section
                  key={group.id}

                  id={`type-${group.id}`}

                  data-type-id={group.id}

                  ref={(el) => {
                    const refs = panelRefs.current;
                    if (el === null) return;
                    refs.set(group.id, el);
                    return () => {
                      refs.delete(group.id);
                    };
                  }}

                  style={{ scrollMarginTop: SPINE_CLEARANCE }}
                  className={cx(
                    "overflow-hidden rounded-xl border border-line",
                    i % 2 === 0 ? "bg-blueprint-deep/22" : "bg-surface-2/55",
                  )}
                >

                  <h2
                    aria-label={`${group.label}, ${group.nodes.length} card${group.nodes.length === 1 ? "" : "s"}`}
                    className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-line px-5 py-3.5"
                  >
                    {chrome !== undefined && (

                      <span
                        aria-hidden
                        className="shrink-0 font-mono text-[11px] tabular-nums text-dim"
                      >
                        {chrome.index}
                      </span>
                    )}
                    <span className="font-display text-xl font-semibold text-fg">
                      {group.label}
                    </span>
                    <code aria-hidden className="font-mono text-[11px] text-dim">
                      {group.id}
                    </code>

                    {chrome?.description !== undefined && (
                      <span className="min-w-0 text-sm text-muted">{chrome.description}</span>
                    )}

                    <span
                      aria-hidden
                      className="ms-auto shrink-0 font-mono text-[11px] tracking-[0.06em] tabular-nums text-dim"
                    >
                      {group.nodes.length} card{group.nodes.length === 1 ? "" : "s"}
                    </span>
                  </h2>

                  <div
                    className={cx(

                      "grid grid-cols-1 gap-5 p-5 sm:grid-cols-2",
                      group.nodes.length > 2 && "lg:grid-cols-3",
                    )}
                  >
                    {group.nodes.map((node) => (

                      <NodeCardSummary key={node.id} node={node} showType={false} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">

          <h2 className="font-display text-lg font-semibold text-fg">
            No node cards match
          </h2>
          <p className="max-w-md text-sm text-muted">
            Nothing in the registry answers to these filters. Try a broader task or remove a filter.
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
