"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cx } from "@/lib/format";
import { useQueryState } from "@/components/ui/useQueryState";
import { PHASE_ORDER } from "@/components/ui/PhaseCoverage";
import { NodeCardSummary, type NodeSummary } from "./NodeCardSummary";

type SortKey = "used" | "name" | "type" | "phase";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "used", label: "Most used" },
  { value: "name", label: "Name A–Z" },
  /* "By card type", not "By node type", on the author's instruction 2026-08-08 and for the
     reason the shelf itself was renamed: this page lists CARDS, one per node, and the header
     calls it Cards. The `sr-only` label and the `aria-label` below follow it, so what a
     screen reader hears is what the control says. */
  { value: "type", label: "By card type" },
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
  deadReason,
}: {
  label: string;
  glyph: string;
  /** How many cards remain if this chip is pressed, given every other filter. */
  count: number;
  active: boolean;
  onClick: () => void;
  /**
   * What has already narrowed the grid far enough that this chip can only empty it.
   *
   * Only shown when the chip is dead, and it is the whole point of the dead state: a
   * control that has gone quiet without saying which of the four other filters silenced
   * it is a dead end the reader has to solve by trial.
   */
  deadReason: string;
}) {
  /* A chip that can only empty the grid is offered as unavailable rather than as a
     trap. Measured before this: `human in the loop` alone matched 2 and `carries a risk
     marker` alone matched 8, but pressing both matched 0 — every time, with nothing
     saying so. Two clicks from arrival to a guaranteed dead end. */
  const dead = count === 0 && !active;
  return (
    <button
      type="button"
      onClick={dead ? undefined : onClick}
      /* `aria-disabled`, not `disabled`.
         ------------------------------------------------------------
         `disabled` takes the chip out of the tab order and, in every engine, out of
         pointer events too — which would have made the `title` below dead markup: a
         browser does not raise a tooltip for a control it is not sending hover to, and
         a keyboard reader could not reach the explanation at all. `aria-disabled` is
         still announced as unavailable, keeps the chip reachable, and lets the one
         sentence that says *why* actually arrive. The click is neutralised above.
         `app/globals.css` already excludes `[aria-disabled="true"]` from the global
         `cursor: pointer`, so `cursor-not-allowed` wins here. */
      aria-disabled={dead || undefined}
      title={dead ? deadReason : undefined}
      aria-pressed={active}
      /* `py-1`, not `py-0.5`: at 22.5px these were standalone controls under the 24px
         floor of WCAG 2.2 SC 2.5.8, and a chip row is not a block of text, so the
         inline exception does not apply. */
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
        /* `text-dim` at 70%, not `text-faint`. `--color-faint` measures 1.91:1 on the
           page ground and is declared for decorative separators only — and the thing it
           was greying out here is the chip's `0`, which is the entire reason the chip
           went dead. A disabled control whose own explanation is illegible is not
           offering the reader a state, it is hiding one. `text-dim` (5.68:1) at 70%
           composites to 3.32:1: unmistakably off, still readable.
           `cursor-pointer` is no longer spelled on the live branch — `app/globals.css`
           now sets it on every enabled `<button>`. */
        dead && "cursor-not-allowed border-line text-dim opacity-70",
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
 * ── The filters live in the URL ──
 * They used to live in five `useState` calls and nowhere else, which broke the one loop
 * this page exists for: filter, open a card, come back, open the next. Measured before
 * the change — narrow to `1 of 53`, open the card, press Back, and the grid returned
 * `53 of 53` with an empty query, no type, and scroll at 0.
 *
 * `useQueryState` holds the mechanism and the reasoning, including why this is not
 * `useSearchParams`. It is shared with `GalleryBrowser`, which had the same defect in a
 * worse form. Two registry browsers solving one problem two ways was itself the bug
 * under the bug.
 *
 * The server renders the unfiltered shelf, so a reader arriving on a shared link sees
 * the full grid narrow to their selection once React hydrates. That is the price of
 * keeping all 53 cards in the static HTML, and it is the right way round.
 */
export function NodeBrowser({ nodes }: { nodes: readonly NodeSummary[] }) {
  const { params, set: setParam, clear } = useQueryState();

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

  /**
   * The sentence a dead chip carries: which of the other filters emptied it.
   *
   * A chip goes dead because of the *rest* of the control panel, never because of
   * itself, so its own dimension is left out of the list. When nothing else is on, the
   * answer is the other one — the library simply holds no card with that property, and
   * saying so is a different fact from "your filters collided".
   *
   * Plain text in a `title` rather than a line of prose under the row: it is an answer
   * to a question only the reader looking at that one greyed chip is asking.
   */
  function deadReason(own: Dimension): string {
    const parts: string[] = [];
    const q = search.trim();
    if (q !== "") parts.push(`the search “${q}”`);
    if (type !== null) {
      parts.push(`the node type “${types.find((t) => t.id === type)?.label ?? type}”`);
    }
    if (phase !== null) {
      parts.push(
        phase === UNPHASED
          ? "the phase filter “Not in a named phase”"
          : `the phase “${phases.find((p) => p.id === phase)?.label ?? phase}”`,
      );
    }
    if (own !== "human" && humanOnly) parts.push("“human in the loop”");
    if (own !== "risk" && riskOnly) parts.push("“carries a risk marker”");
    if (parts.length === 0) return "No node card in the library carries this.";
    return `Nothing is left once this is combined with ${parts.join(" and ")}.`;
  }

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
    clear(["q", "type", "phase", "human", "risk"]);
  }, [clear]);

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
      {/* `z-40` — page chrome on the site's one z ladder (header 50 · page chrome 40 ·
          section chrome 30 · card furniture 20 · a card's stretched hit target 10).
          It was `z-20`, which is the tier a card's own furniture sits on, and a card
          `<article>` is `relative` with `z-index: auto` — so it opens no stacking
          context and its `z-20` children compete with this bar directly, winning on DOM
          order because they come later. Measured: a `FavoriteStar` covering the `/53` of
          the result count, and an author avatar punching through this bar's lower
          border. The bar a reader steers by cannot be the thing the grid scrolls over. */}
      <div className="sticky top-16 z-40 -mx-1 bg-void/95 px-1 py-2 backdrop-blur-sm sm:hidden">
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
            <span className="sr-only">Filter by card type</span>
            <select
              value={type ?? ""}
              onChange={(e) => setParam("type", e.target.value || null)}
              aria-label="Filter by card type"
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
            deadReason={deadReason("human")}
            onClick={() => setParam("human", humanOnly ? null : "1")}
          />
          <FilterChip
            label="carries a risk marker"
            glyph="△"
            count={riskCount}
            active={riskOnly}
            deadReason={deadReason("risk")}
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
                    controlled vocabulary the spelling is worth showing.

                    `z-30` — section chrome, one rung under the page's own filter bar and
                    above the tier a card's furniture may reach. At `z-10` three star
                    chips floated over this band mid-scroll through the Tool group. */}
                <h2
                  aria-label={`${group.label}, ${group.nodes.length} card${group.nodes.length === 1 ? "" : "s"}`}
                  className="sticky top-15 z-30 -mx-1 flex items-baseline gap-2.5 bg-void/95 px-1 py-2 backdrop-blur-sm"
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
                {/* Three columns only when there are more than two cards to put in
                    them. `Decision` holds 2 and `Human gate` holds 2, and at a fixed
                    `lg:grid-cols-3` each of those groups drew two tiles and a third of a
                    row of nothing — an empty column that reads as a card that failed to
                    load. Two tiles across a wide row is a pair; two tiles in a
                    three-track grid is a gap. */}
                <div
                  className={cx(
                    "grid gap-5 sm:grid-cols-2",
                    group.nodes.length > 2 && "lg:grid-cols-3",
                  )}
                >
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
