"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cx } from "@/lib/format";
import { PHASE_ORDER } from "@/components/ui/PhaseCoverage";
import { NodeCardSummary, type NodeSummary } from "./NodeCardSummary";

type SortKey = "used" | "name" | "type" | "phase";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "used", label: "Most used" },
  { value: "name", label: "Name A–Z" },
  { value: "type", label: "By node type" },
  // Lifecycle order, not alphabetical — see `phaseRank` below.
  { value: "phase", label: "By phase" },
];

/** Grouping only happens under this one, so it is also what the page opens on. */
const DEFAULT_SORT: SortKey = "type";

const controlClass =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg outline-none transition-colors focus:border-line-bright sm:w-auto";

/** Code-unit order, so the grid reads the same wherever it is rendered. */
function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Where a card sits in the lifecycle sort, in doc 3 §2's order — sorting the grid
 * alphabetically would open the library on debugging and close it on testing, which is
 * not how a factory runs.
 *
 * The rank is the earliest phase the card declares, because a card standing in
 * implementation and debugging is first met at implementation.
 *
 * A card declaring none returns `PHASE_ORDER.length`, which groups those cards together
 * at the end of the sorted grid. That is a grouping and not a ranking: they are being
 * sorted on a dimension they do not speak to, so any position is arbitrary, and the end
 * is the one position that does not interleave them randomly through the five. Nothing
 * in the grid marks them, styles them differently, or counts them against anything.
 */
function phaseRank(phases: readonly { id: string }[]): number {
  let rank = PHASE_ORDER.length;
  for (const phase of phases) {
    const i = PHASE_ORDER.indexOf(phase.id);
    if (i !== -1 && i < rank) rank = i;
  }
  return rank;
}

/**
 * The value the phase `select` uses for "cards that declare no phase".
 *
 * Safe as a plain string: doc 3 §7 closes the phase vocabulary at the five ids of §2 and
 * a card naming anything else is a validation error, so no card can ever carry a phase
 * that collides with this.
 */
const UNPHASED = "unphased";

/* --------------------- the query string as a store --------------------- */

/**
 * The address bar, as an external store React can subscribe to.
 *
 * `history.replaceState` fires no event, so anything that writes the URL has to tell
 * subscribers itself; `emit` is that. `popstate` covers the back and forward buttons,
 * which the browser does announce.
 *
 * Why a store and not `useState` seeded in an effect: seeding state from the URL inside
 * `useEffect` is `react-hooks/set-state-in-effect`, and the rule is right — it is a
 * cascading render, and the correct shape is the one its message describes, "subscribe
 * for updates from some external system, calling setState in a callback". Why not a
 * lazy `useState` initialiser reading `window.location`: it renders something the
 * server did not, which is a hydration mismatch on every shared link.
 *
 * `useSyncExternalStore` is the primitive built for exactly this. Its server snapshot is
 * the empty query, so the prerendered HTML is the whole unfiltered shelf, and React
 * re-renders once after hydration if the real URL carries filters. That re-render is
 * documented behaviour, not an error.
 */
let queryListeners: Array<() => void> = [];

function subscribeToQuery(onChange: () => void): () => void {
  queryListeners = [...queryListeners, onChange];
  window.addEventListener("popstate", onChange);
  return () => {
    queryListeners = queryListeners.filter((listener) => listener !== onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const readQuery = (): string => window.location.search;

/** The server has no address bar; an unfiltered shelf is what it can honestly render. */
const readServerQuery = (): string => "";

function writeQuery(next: string): void {
  const url = next === "" ? window.location.pathname : `${window.location.pathname}?${next}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  /* `replaceState`, not `pushState`: typing four characters into the search box should
     not cost four presses of Back to undo. Because it replaces, the entry a reader
     leaves behind when they open a card already carries their filters, so Back from
     that card restores them for free. */
  window.history.replaceState(null, "", url);
  for (const listener of queryListeners) listener();
}

/* --------------------- the filter set --------------------- */

interface Filters {
  q: string;
  type: string | null;
  phase: string | null;
  human: boolean;
  risk: boolean;
}

/** The dimension to ignore when testing a card, for counting a facet's own options. */
type Dimension = keyof Filters;

/**
 * Does this card survive the filters — optionally ignoring one dimension?
 *
 * `skip` is what makes the option counts honest. A facet's own count has to be taken
 * over the set narrowed by every *other* dimension, or it answers a question nobody
 * asked: before this, every count in both selects was computed over the whole library,
 * so "Human gate (2)" promised two cards while a phase filter was already excluding
 * both, and picking it landed on an empty grid. A count is a promise about what happens
 * when you click it.
 *
 * The search haystack covers what a reader can see on a tile. It used to be `id`,
 * `name`, `action` and `tools` only, so typing "validation" returned cards whose prose
 * happened to contain the word and *not* the cards whose type is `validation` — the one
 * result the word most obviously asks for.
 */
function passes(node: NodeSummary, f: Filters, skip?: Dimension): boolean {
  if (skip !== "type" && f.type !== null && node.type !== f.type) return false;

  if (skip !== "phase" && f.phase !== null) {
    if (f.phase === UNPHASED) {
      if (node.phases.length > 0) return false;
    } else if (!node.phases.some((p) => p.id === f.phase)) {
      return false;
    }
  }

  if (skip !== "human" && f.human && !node.requiresHuman) return false;
  if (skip !== "risk" && f.risk && node.riskMarkers.length === 0) return false;

  if (skip !== "q") {
    const q = f.q.trim().toLowerCase();
    if (q !== "") {
      const haystack = [
        node.id,
        node.name,
        node.action,
        node.typeLabel,
        node.tools.join(" "),
        node.phases.map((p) => p.label).join(" "),
        node.riskMarkers.join(" "),
        node.author?.displayName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
  }

  return true;
}

/** A boolean filter as a toggle chip, carrying the count it would leave behind. */
function FilterChip({
  label,
  glyph,
  count,
  active,
  onClick,
}: {
  label: string;
  glyph: string;
  /** How many cards remain if this chip is pressed, given every other filter. */
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  /* A chip that can only empty the grid is offered as unavailable rather than as a
     trap. Measured before this: `human in the loop` alone matched 2 and `carries a risk
     marker` alone matched 8, but pressing both matched 0 — every time, with nothing
     saying so. Two clicks from arrival to a guaranteed dead end. */
  const dead = count === 0 && !active;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={dead}
      aria-pressed={active}
      /* `py-1`, not `py-0.5`: at 22.5px these were standalone controls under the 24px
         floor of WCAG 2.2 SC 2.5.8, and a chip row is not a block of text, so the
         inline exception does not apply. */
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
        dead
          ? "cursor-not-allowed border-line text-faint"
          : "cursor-pointer",
        active
          ? "border-cyan/60 bg-cyan/10 text-cyan"
          : !dead && "border-line text-muted hover:border-line-bright hover:text-fg",
      )}
    >
      <span aria-hidden>{glyph}</span>
      {label}
      <span className={cx("tabular-nums", active ? "text-cyan/70" : "text-dim")}>
        {count}
      </span>
    </button>
  );
}

/**
 * The node-card library, filtered in the browser. Everything it needs arrives as
 * plain props from the server — the whole library is a few dozen rows, so there is
 * nothing to fetch and nothing to page.
 *
 * ── The filters live in the URL, written with history APIs ──
 * They used to live in five `useState` calls and nowhere else, which broke the one loop
 * this page exists for: filter, open a card, come back, open the next. Measured before
 * the change — narrow to `1 of 53`, open the card, press Back, and the grid returned
 * `53 of 53` with an empty query, no type, and scroll at 0. No filtered view could be
 * linked to from `/blueprints` or `/ontology`, bookmarked, or shared.
 *
 * **Not `useSearchParams`.** That is the framework's answer and it was tried first. The
 * Next docs require a `Suspense` boundary around it or the production build fails, and
 * then say why: the client tree up to that boundary becomes client-rendered. Measured
 * against `next start`, that shipped `/nodes` as 56KB containing **zero `<article>`
 * elements** — every one of the 53 cards left the prerendered HTML, on a static archive
 * whose whole claim is that it can be read. The URL here is being used as *storage*,
 * not as routing input, so the browser's own history API is the right size of tool and
 * costs the page nothing.
 *
 * `replaceState` rather than `pushState`, because typing four characters into the
 * search box should not cost four presses of Back to undo. Because it replaces, the
 * history entry a reader leaves when they open a card already carries their filters, so
 * Back restores them for free.
 *
 * The server renders the unfiltered shelf, so a reader arriving on a shared link sees
 * the full grid narrow to their selection once React hydrates. That is the price of
 * keeping all 53 cards in the static HTML, and it is the right way round.
 */
export function NodeBrowser({ nodes }: { nodes: readonly NodeSummary[] }) {
  const query = useSyncExternalStore(subscribeToQuery, readQuery, readServerQuery);
  const params = useMemo(() => new URLSearchParams(query), [query]);

  /* Every filter is read from the URL rather than mirrored into React state, so there
     is one source of truth and Back cannot disagree with the grid. */
  const type = params.get("type");
  const phase = params.get("phase");
  const humanOnly = params.get("human") === "1";
  const riskOnly = params.get("risk") === "1";
  const rawSort = params.get("sort");
  const sort: SortKey = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? (rawSort as SortKey)
    : DEFAULT_SORT;

  /**
   * The search box is the one control that does not write on every change.
   *
   * `draft` is what the reader has typed since the last write; `null` means "follow the
   * URL". Keystrokes update it immediately so the field never lags, and the URL catches
   * up on a timer — Safari throttles `replaceState` to roughly a hundred calls per
   * thirty seconds, which a fast typist would otherwise reach.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const search = draft ?? (params.get("q") ?? "");

  const setParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    writeQuery(next.toString());
  }, []);

  /* Debounced write for the typed query only. Setting state from a subscription
     callback is the pattern the effect rule asks for, so `draft` is released back to
     the URL there rather than here. */
  useEffect(() => {
    if (draft === null) return;
    const timer = setTimeout(() => setParam("q", draft.trim() === "" ? null : draft), 250);
    return () => clearTimeout(timer);
  }, [draft, setParam]);

  /** Open on mobile, where the panel is behind a disclosure. Ignored from `sm` up. */
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters: Filters = useMemo(
    () => ({ q: search, type, phase, human: humanOnly, risk: riskOnly }),
    [search, type, phase, humanOnly, riskOnly],
  );


  /* Only the types actually in the library: an option that can never match is a
     dead end, and the vocabulary itself is one click away on /ontology. Counted
     against every filter but this one — see `passes`. */
  const types = useMemo(() => {
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

  /*
   * The phase dimension, counted the same way as the type — except for the order.
   * The type list is sorted alphabetically because nothing orders node types; the
   * phases are doc 3 §2's lifecycle and are offered in it, so the control reads
   * planning → deployment and not debugging → testing. A phase no card declares is
   * left out, and anything outside the closed five (which the validator rejects, so
   * normally nothing) is appended rather than dropped.
   *
   * A card may declare several phases and is counted under each of them, so these
   * counts cover the selection without partitioning it and do not add up to the number
   * of cards. Nothing displays them as a total.
   */
  const phases = useMemo(() => {
    const pool = nodes.filter((node) => passes(node, filters, "phase"));
    const byId = new Map<string, { id: string; label: string; count: number }>();
    for (const node of nodes) {
      for (const p of node.phases) {
        if (!byId.has(p.id)) byId.set(p.id, { id: p.id, label: p.label, count: 0 });
      }
    }
    for (const node of pool) {
      for (const p of node.phases) {
        const found = byId.get(p.id);
        if (found !== undefined) found.count += 1;
      }
    }
    const ordered = PHASE_ORDER.map((id) => byId.get(id)).filter((row) => row !== undefined);
    const rest = [...byId.values()]
      .filter((row) => !PHASE_ORDER.includes(row.id))
      .sort((a, b) => byText(a.label, b.label));
    return [...ordered, ...rest];
  }, [nodes, filters]);

  /*
   * The cards that declare no phase, findable.
   *
   * Without this the library had no route to a third of itself: the five options each
   * narrow the grid to a phase, and a card outside them could only be reached by
   * scrolling past everything else. Offering it as an option is what makes "no phase"
   * a state of the library a reader can ask about rather than an absence they have to
   * infer, and the wording is what keeps it from reading as a defect list — "not in a
   * named phase" is where the node stands, "missing a phase" would be what the author
   * failed to write.
   */
  const unphasedCount = useMemo(
    () =>
      nodes.filter((node) => node.phases.length === 0 && passes(node, filters, "phase"))
        .length,
    [nodes, filters],
  );

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

  const results = useMemo(() => {
    const filtered = nodes.filter((node) => passes(node, filters));
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
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

  /**
   * The results in labelled groups, or `null` when the reader has asked for a flat order.
   *
   * The library ships 53 cards and rendered them as 53 sibling `<article>`s under 53
   * sibling `<h2>`s, with nothing between them: 18.5 viewport heights of undifferentiated
   * grid on a phone, and no way to tell where one kind of node ended and the next began.
   * The five node types are already the shape of the answer, and the browser already had
   * a "By node type" sort, so the only thing missing was the headings that make a sort
   * legible as structure.
   *
   * Grouping only under the `type` sort, which is now the default. Picking `Name A–Z` or
   * `Most used` is asking for one ordered run of cards, and chopping that into five
   * alphabetical runs would answer a question nobody asked.
   */
  const groups = useMemo(() => {
    if (sort !== "type") return null;
    const out: { id: string; label: string; nodes: NodeSummary[] }[] = [];
    for (const node of results) {
      const last = out[out.length - 1];
      if (last !== undefined && last.id === node.type) last.nodes.push(node);
      else out.push({ id: node.type, label: node.typeLabel, nodes: [node] });
    }
    return out;
  }, [results, sort]);

  const activeCount =
    (search.trim() !== "" ? 1 : 0) +
    (type !== null ? 1 : 0) +
    (phase !== null ? 1 : 0) +
    (humanOnly ? 1 : 0) +
    (riskOnly ? 1 : 0);
  const hasFilters = activeCount > 0;

  /* The sort survives a reset. It is how the reader chose to read the shelf, not a
     narrowing of it, and clearing a search should not also re-sort the page. */
  const clearFilters = useCallback(() => {
    setDraft("");
    const next = new URLSearchParams(window.location.search);
    for (const key of ["q", "type", "phase", "human", "risk"]) next.delete(key);
    writeQuery(next.toString());
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* The mobile disclosure.
          ------------------------------------------------------------
          At 378px the control panel is 282px tall and the first card began at y=715,
          one pixel past a 714px viewport: a reader who asked for a library met a form
          and had to scroll to learn the library existed. The panel is also `static`, so
          changing a filter after scrolling into the 24-card Tool group meant scrolling
          6000px back up.

          One panel, not two. A second copy behind a media query would duplicate every
          input, every id and every tab stop, which is worse for a screen reader than
          the problem it solves. So the body below is hidden by state on small screens
          and forced visible from `sm` up, and this button — which only exists below
          `sm` — toggles it and carries the count of what is currently on. */}
      <div className="sticky top-16 z-20 -mx-1 bg-void/95 px-1 py-2 backdrop-blur-sm sm:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="node-filters"
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5 font-mono text-xs text-fg transition-colors hover:border-line-bright"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-cyan">
              {filtersOpen ? "▾" : "▸"}
            </span>
            Filter
            {activeCount > 0 && (
              <span className="rounded-full bg-cyan/15 px-2 py-0.5 tabular-nums text-cyan">
                {activeCount}
              </span>
            )}
          </span>
          <span className="tabular-nums text-dim">
            {results.length}/{nodes.length}
          </span>
        </button>
      </div>

      {/* control bar. `role="search"` because it is one: without it the landmark list
          on this page was HEADER / NAV / MAIN / FOOTER, and the thing the page is for
          had no name in it. */}
      <div
        id="node-filters"
        role="search"
        aria-label="Filter node cards"
        className={cx("panel flex-col gap-4 p-4 sm:flex", filtersOpen ? "flex" : "hidden")}
      >
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
              onChange={(e) => setDraft(e.target.value)}
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
              onChange={(e) => setParam("type", e.target.value || null)}
              aria-label="Filter by node type"
              className={controlClass}
            >
              <option value="">All node types</option>
              {types.map((t) => (
                /* Disabled rather than hidden: a reader who has narrowed to one phase
                   should be able to see that `human-gate` exists and simply has nothing
                   left in it, which is a different fact from it not existing. */
                <option key={t.id} value={t.id} disabled={t.count === 0}>
                  {t.label} ({t.count})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">Filter by phase</span>
            <select
              value={phase ?? ""}
              onChange={(e) => setParam("phase", e.target.value || null)}
              aria-label="Filter by phase"
              className={controlClass}
            >
              <option value="">All phases</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id} disabled={p.count === 0}>
                  {p.label} ({p.count})
                </option>
              ))}
              {/* Last in the list because the five above are a sequence and this is
                  not a sixth step in it. Named for where the node stands, not for
                  what its card leaves out. */}
              {unphasedCount > 0 && (
                <option value={UNPHASED}>
                  Not in a named phase ({unphasedCount})
                </option>
              )}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">Sort node cards</span>
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value === DEFAULT_SORT ? null : e.target.value)}
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
            count={humanCount}
            active={humanOnly}
            onClick={() => setParam("human", humanOnly ? null : "1")}
          />
          <FilterChip
            label="carries a risk marker"
            glyph="△"
            count={riskCount}
            active={riskOnly}
            onClick={() => setParam("risk", riskOnly ? null : "1")}
          />
        </div>
      </div>

      {/* result count + reset.
          `role="status"` so the number is announced when it changes. Every filter on
          this page swapped the grid silently before: a reader using a screen reader
          typed a query and had no way to tell whether it had matched fifty cards, one,
          or none. Phrased as a sentence for the same reason — "11 of 53 node cards"
          reads as an announcement, where a bare pair of numerals does not. */}
      <div className="flex items-center justify-between gap-3 font-mono text-xs text-dim">
        <p role="status" aria-live="polite" aria-atomic="true">
          <span className="text-fg">{results.length}</span> of {nodes.length} node
          card{nodes.length === 1 ? "" : "s"}
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

      {/* What the reader is looking at when they pick the last option in the phase
          list — said here rather than on each tile, because it is one fact about the
          selection and not a stamp on thirty cards. It is also the one place in the
          library where the ruling itself is worth writing down: the reader who picks
          this filter is the reader wondering which of the five an intake node was
          supposed to claim. */}
      {phase === UNPHASED && (
        <p className="border-l border-line-bright pl-4 text-sm leading-relaxed text-muted">
          These cards name no phase, and that is a complete answer. The five phases
          describe the shape of a blueprint, not every node inside one, intake,
          retrieval, routing and hand-off are real work that none of the five names.
        </p>
      )}

      {/* grid / empty state */}
      {results.length > 0 ? (
        groups === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((node) => (
              <NodeCardSummary key={node.id} node={node} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {groups.map((group) => (
              <section key={group.id} className="flex flex-col gap-4">
                {/* Sticky, so the answer to "what am I looking at" survives a scroll
                    through twenty-four tools. `top-15` clears the 65px header exactly;
                    `top-16` left a 1px sliver of grid above it.

                    `aria-label` carries the pair a reader sees — the human label and the
                    count — without the raw term id between them, which announced as
                    "Agent agent 18". The id stays visible, because on a page about a
                    controlled vocabulary the spelling is worth showing. */}
                <h2
                  aria-label={`${group.label}, ${group.nodes.length} card${group.nodes.length === 1 ? "" : "s"}`}
                  className="sticky top-15 z-10 -mx-1 flex items-baseline gap-2.5 bg-void/95 px-1 py-2 backdrop-blur-sm"
                >
                  <span className="font-display text-xl font-semibold text-fg">
                    {group.label}
                  </span>
                  <code aria-hidden className="font-mono text-[11px] text-dim">
                    {group.id}
                  </code>
                  <span
                    aria-hidden
                    className="ml-auto font-mono text-[11px] tabular-nums text-dim"
                  >
                    {group.nodes.length}
                  </span>
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.nodes.map((node) => (
                    /* The type is the heading above this run, so repeating it on all
                       24 tiles spends the loudest chip on the one fact the reader
                       already has. */
                    <NodeCardSummary key={node.id} node={node} showType={false} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
          {/* An `h2`, not a `p`. Under the grouped default the five group headings are
              the page's only `h2`s, so when they unmount with the last result the
              outline collapsed from `h1` straight to the footer's `h3` — the one state
              where a reader most needs to know where they are had no heading at all. */}
          <h2 className="font-display text-lg font-semibold text-fg">
            No node cards match
          </h2>
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
