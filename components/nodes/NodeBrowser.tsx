"use client";

import { useMemo, useState } from "react";
import { cx } from "@/lib/format";
import { PHASE_ORDER } from "@/components/ui/PhaseCoverage";
import { NodeCardSummary, type NodeSummary } from "./NodeCardSummary";

type SortKey = "used" | "name" | "type" | "phase";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "used", label: "Most used" },
  { value: "name", label: "Name A–Z" },
  { value: "type", label: "By node type" },
  // Lifecycle order, not alphabetical — see `byPhaseOrder` below.
  { value: "phase", label: "By phase" },
];

const controlClass =
  "rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg outline-none transition-colors focus:border-line-bright";

/** Code-unit order, so the grid reads the same wherever it is rendered. */
function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Doc 3 §2's lifecycle order for the phase sort. Sorting the grid alphabetically would
 * open the library on debugging and close it on testing, which is not how a factory
 * runs; a phase outside the closed five sorts after the five, by id.
 */
function byPhaseOrder(a: string, b: string): number {
  const ia = PHASE_ORDER.indexOf(a);
  const ib = PHASE_ORDER.indexOf(b);
  if (ia === -1 || ib === -1) return (ia === -1 ? 1 : 0) - (ib === -1 ? 1 : 0) || byText(a, b);
  return ia - ib;
}

/** A boolean filter as a toggle chip. Sibling of the gallery's tag chips. */
function FilterChip({
  label,
  glyph,
  active,
  onClick,
}: {
  label: string;
  glyph: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
        active
          ? "border-cyan/60 bg-cyan/10 text-cyan"
          : "border-line text-muted hover:border-line-bright hover:text-fg",
      )}
    >
      <span aria-hidden>{glyph}</span>
      {label}
    </button>
  );
}

/**
 * The node-card library, filtered in the browser. Everything it needs arrives as
 * plain props from the server — the whole library is a few dozen rows, so there is
 * nothing to fetch and nothing to page.
 */
export function NodeBrowser({ nodes }: { nodes: readonly NodeSummary[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [humanOnly, setHumanOnly] = useState(false);
  const [riskOnly, setRiskOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("used");

  /* Only the types actually in the library: an option that can never match is a
     dead end, and the vocabulary itself is one click away on /ontology. */
  const types = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; count: number }>();
    for (const node of nodes) {
      const found = byId.get(node.type);
      if (found === undefined) {
        byId.set(node.type, { id: node.type, label: node.typeLabel, count: 1 });
      } else {
        found.count += 1;
      }
    }
    return [...byId.values()].sort((a, b) => byText(a.label, b.label));
  }, [nodes]);

  /*
   * The second dimension of doc 3 §1, filtered the same way — except for the order.
   * The type list is sorted alphabetically because nothing orders node types; the
   * phases are doc 3 §2's lifecycle and are offered in it, so the control reads
   * planning → deployment and not debugging → testing. A phase no card declares is
   * left out, and anything outside the closed five (which the validator rejects, so
   * normally nothing) is appended rather than dropped.
   */
  const phases = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; count: number }>();
    for (const node of nodes) {
      const found = byId.get(node.phase);
      if (found === undefined) {
        byId.set(node.phase, { id: node.phase, label: node.phaseLabel, count: 1 });
      } else {
        found.count += 1;
      }
    }
    const ordered = PHASE_ORDER.map((id) => byId.get(id)).filter((row) => row !== undefined);
    const rest = [...byId.values()]
      .filter((row) => !PHASE_ORDER.includes(row.id))
      .sort((a, b) => byText(a.label, b.label));
    return [...ordered, ...rest];
  }, [nodes]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = nodes.filter((node) => {
      if (type !== null && node.type !== type) return false;
      if (phase !== null && node.phase !== phase) return false;
      if (humanOnly && !node.requiresHuman) return false;
      if (riskOnly && node.riskMarkers.length === 0) return false;
      if (q) {
        const haystack = [node.id, node.name, node.action, node.tools.join(" ")]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "used":
          return b.usedIn - a.usedIn || byText(a.name, b.name);
        case "type":
          return byText(a.typeLabel, b.typeLabel) || byText(a.name, b.name);
        case "phase":
          return byPhaseOrder(a.phase, b.phase) || byText(a.name, b.name);
        case "name":
        default:
          return byText(a.name, b.name);
      }
    });
    return sorted;
  }, [nodes, search, type, phase, humanOnly, riskOnly, sort]);

  const hasFilters =
    search.trim() !== "" || type !== null || phase !== null || humanOnly || riskOnly;

  function clearFilters() {
    setSearch("");
    setType(null);
    setPhase(null);
    setHumanOnly(false);
    setRiskOnly(false);
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
              placeholder="Search ids, names, actions, tools…"
              aria-label="Search node cards"
              /* `text-dim` is the readable token (5.4:1 on surface-2); `text-faint` is
                 for decorative separators and would put the only hint of what this
                 field accepts at 1.8:1. */
              className="w-full rounded-md border border-line bg-surface-2 py-2 pl-8 pr-3 text-sm text-fg placeholder:text-dim outline-none transition-colors focus:border-line-bright"
            />
          </div>

          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by node type</span>
            <select
              value={type ?? ""}
              onChange={(e) => setType(e.target.value || null)}
              aria-label="Filter by node type"
              className={controlClass}
            >
              <option value="">All node types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.count})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by phase</span>
            <select
              value={phase ?? ""}
              onChange={(e) => setPhase(e.target.value || null)}
              aria-label="Filter by phase"
              className={controlClass}
            >
              <option value="">All phases</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.count})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">Sort node cards</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort node cards"
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

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="human in the loop"
            glyph="⏸"
            active={humanOnly}
            onClick={() => setHumanOnly((v) => !v)}
          />
          <FilterChip
            label="carries a risk marker"
            glyph="△"
            active={riskOnly}
            onClick={() => setRiskOnly((v) => !v)}
          />
        </div>
      </div>

      {/* result count + reset */}
      <div className="flex items-center justify-between gap-3 font-mono text-xs text-dim">
        <span>
          <span className="text-fg">{results.length}</span> of {nodes.length} node
          card{nodes.length === 1 ? "" : "s"}
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
          {results.map((node) => (
            <NodeCardSummary key={node.id} node={node} />
          ))}
        </div>
      ) : (
        <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="font-display text-lg font-semibold text-fg">
            No node cards match
          </p>
          <p className="max-w-md text-sm text-muted">
            Nothing in the library answers to these filters. Try a broader query,
            or drop the node type or the phase.
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
