"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { useQueryState } from "@/components/ui/useQueryState";
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
  /* First, because "what arrived since I last looked" is the question a shelf that grows
     gets asked most, and it is the only one of these the reader cannot answer by scanning. */
  { value: "newest", label: "Newest first" },
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

/**
 * How much pinned chrome sits above a panel when the reader lands on one, in CSS pixels.
 *
 * Two bars, both measured on the built page at 1440 x 950 rather than reasoned about:
 *
 *   page header   65   `position: sticky; top: 0`, and the spine pins to its underside
 *   the spine     51   `py-3` (24) + a 26px pill + its own 1px bottom rule
 *   air            8   so the panel's top hairline is not welded to the spine's
 *
 * It is one constant with two consumers, which is the only reason it is a constant. It is
 * the panels' `scrollMarginTop`, so a `#type-tool` jump puts the header under the spine
 * rather than behind it; and it is the observer's top `rootMargin`, so the group the spine
 * calls current is the one under that same line rather than the one merely on screen. Split
 * into a Tailwind class and a number, the two would drift and only the jump would show it.
 *
 * A style attribute rather than `scroll-mt-[124px]` for that reason, and it is still
 * `scroll-margin-top` — the app forbids `scrollIntoView`, not the property that makes a
 * plain anchor land correctly.
 *
 * The spine's 51 holds at every width because it is one line at every width: the pills
 * scroll sideways rather than wrapping. That is what makes a single number honest here —
 * see `GroupSpine`'s note on the scroller.
 */
const SPINE_CLEARANCE = 124;

/* The shape moved to `components/ui/RegistryFilterBar.tsx` with the disclosure below it:
   this file and the gallery each carried a copy, and they had already drifted — the
   placeholder-contrast fix was made here and never brought across. Aliased because
   `controlClass` is this file's own word for it. */
const controlClass = CONTROL_CLASS;

/**
 * Newest published version first, and a card with NO date last.
 *
 * A tile built from the content registry carries no `createdAt` — those are read off files,
 * which have no publish timestamp — so the comparison has to answer for an absent date rather
 * than coerce one. Absent sorts after every real date, in both directions of the pair, which
 * is what keeps the order total: returning 0 for two absent dates hands them to the name
 * tiebreak instead of leaving them in whatever order they arrived.
 */
function byNewest(a: NodeSummary, b: NodeSummary): number {
  if (a.createdAt === b.createdAt) return 0;
  if (a.createdAt === undefined) return 1;
  if (b.createdAt === undefined) return -1;
  return b.createdAt.localeCompare(a.createdAt);
}

/** Code-unit order, so the grid reads the same wherever it is rendered. */
function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * One node type as the vocabulary defines it, which is a different thing from one node type
 * as the card library uses it.
 *
 * `app/nodes/page.tsx` reads these off the ontology view and passes all eight down. The
 * browser derives its own facet counts from the cards (see `typeFacets`) and takes nothing
 * but words and order from here — so the two can never disagree about a number, because only
 * one of them holds numbers.
 */
export interface NodeTypeTerm {
  id: string;
  label: string;
  /** The term's own `description`, verbatim. Absent when the term carries none. */
  description?: string;
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
        /* The pressed state, in the card register. Amber since 2026-09-06: this is the
           shelf of node cards and its loudest object was the blueprint's cyan. #ffb020 on
           `--color-surface` reads 10.66:1 against cyan's 9.10:1, and the 60% edge
           composites to 4.35:1 where the cyan one sat at 3.87:1. */
        active
          ? "border-amber/60 bg-amber/10 text-amber"
          : !dead && "border-line text-muted hover:border-line-bright hover:text-fg",
      )}
    >
      <span aria-hidden>{glyph}</span>
      {label}
      {/* `amber/70` and not `/60`: `app/globals.css` puts amber's floor for TEXT at 70%
          (5.4:1) and calls 60% a non-text boundary. */}
      <span className={cx("tabular-nums", active ? "text-amber/70" : "text-dim")}>
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
export function NodeBrowser({
  nodes,
  types,
}: {
  nodes: readonly NodeSummary[];
  /** The vocabulary's node types, all of them. See `NodeTypeTerm`. */
  types: readonly NodeTypeTerm[];
}) {
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

  const filters: Filters = useMemo(
    () => ({ q: search, type, phase, human: humanOnly, risk: riskOnly }),
    [search, type, phase, humanOnly, riskOnly],
  );


  /* Only the types actually in the library: an option that can never match is a
     dead end, and the vocabulary itself is one click away on /ontology. Counted
     against every filter but this one — see `passes`.

     Renamed from `types` when the `types` PROP arrived, and the two are deliberately
     different sets. This one is the FILTER's list, and the ruling above is a filter's
     ruling: offering `evaluative` in a select that would return nothing whatever else the
     reader does is a dead end. The prop is the vocabulary, which the group header needs for
     an index and a definition. Counts only ever come from here. */
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
    /* `own !== …` on these two as well, which the docblock always claimed and the code did
       not need until the spine started calling this. A spine row is a TYPE, and its count
       is taken with `skip: "type"` — so the type filter cannot be what emptied it, and
       naming it would send the reader to undo the one control that is not responsible. The
       two boolean chips never passed "type" or "phase", so this changes nothing they say. */
    if (own !== "type" && type !== null) {
      parts.push(`the node type “${typeFacets.find((t) => t.id === type)?.label ?? type}”`);
    }
    if (own !== "phase" && phase !== null) {
      parts.push(
        phase === UNPHASED
          ? "the phase filter “Not in a named phase”"
          : `the phase “${phases.find((p) => p.id === phase)?.label ?? phase}”`,
      );
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

  /**
   * Each type's place among the types that have cards, and its one-line definition, by id.
   *
   * Sorted by label HERE rather than on the server: `results` is ordered by the same
   * comparator and `groups` walks it in that order, so the index a header prints and the
   * order the grid draws are one rule. The index counts only types with at least one card,
   * because a reader who sees 01, 02, 04 looks for the missing sections; a type with none
   * gets a label and a definition and no number.
   */
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

  /**
   * Which panel the reader is inside, from one observer over all of them.
   *
   * `null` until an observation lands, and the render below falls back to the first group —
   * so the server's HTML and the first client frame both mark the top of the shelf, which is
   * where the reader is, rather than marking nothing.
   *
   * ── Why a Set and a `find`, rather than the entry with the smallest `boundingClientRect.top` ──
   * "Topmost intersecting" is a question about DOM order, and `groups` already holds that
   * order. Reading geometry off the entries would answer it too, and would answer it from a
   * snapshot taken when the callback was queued rather than when it runs. The set is the
   * observer's own state; the order is React's.
   *
   * ── Why `rootMargin` and not a scroll listener ──
   * The top of the viewport is not where the shelf starts: 116px of pinned header and spine
   * sit over it. Shrinking the root by `SPINE_CLEARANCE` asks the question the reader is
   * actually asking — which panel is under the spine — and asks it without a listener firing
   * on every frame of a 53-card scroll.
   *
   * Keyed on the group ids rather than on `groups`, so typing in the search box re-runs this
   * only when a whole type appears or disappears. `groups` is a fresh array on every
   * keystroke; the observed elements are not, because `key={group.id}` keeps them mounted.
   */
  const panelRefs = useRef(new Map<string, HTMLElement>());
  const [observed, setObserved] = useState<string | null>(null);
  /* The separator below is a NUL, written as the escape and never as the raw byte. I typed
     the raw one and `source-hygiene.test.ts` caught it, which is what that test is for: a
     NUL is invisible in every editor and makes git treat the whole file as binary — no
     diff, no blame, no review. The runtime string is identical either way.

     A NUL and not a space, because this key exists so the effect re-subscribes when the SET
     of groups changes rather than on every keystroke, and a separator a value could contain
     would make two different sets look like one. A term id carries a `/` when it is
     namespaced, and a local overlay may mint ids this file has never seen. */
  const groupKey = (groups ?? []).map((g) => g.id).join("\u0000");

  useEffect(() => {
    const ids = groupKey === "" ? [] : groupKey.split("\u0000");
    /* No `setObserved(null)` here, and the rule that forbade it was right: this effect
       SUBSCRIBES, and the only place it may write state is the observer's own callback.
       What that leaves behind is a stale id when a filter empties the shelf — resolved
       where it belongs, at render, by `activeGroup` checking the id still names a group. */
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

  /**
   * The spine's rows: every type the vocabulary defines, in the grid's own order.
   *
   * **The order is the grid's and is not negotiable.** `typeChrome` is built by sorting the
   * prop with the same `byText(label)` that `results` is sorted by and `groups` walks, so a
   * reader reading the spine left to right is reading the shelf top to bottom. A jump list
   * ordered by size — the obvious "improvement" — sends somebody looking for the third band
   * to the sixth.
   *
   * All eight, and the three with no cards anywhere in the library are the interesting case.
   * They come through as dead rows, which is the `<option disabled>` ruling from the type
   * select applied one surface over: a reader should be able to see that `human-input`
   * exists and that nothing in the archive is one. What the select does NOT do is offer them
   * at all, and the two are right to differ — a select is a filter, where an option that can
   * never match is a dead end, and this is a map of the vocabulary, where a type missing from
   * the map is a fact the reader cannot recover.
   *
   * Counts come from `typeFacets` and from nowhere else, defaulting to 0 for a type the
   * library has never held. Not memoized: eight rows off two arrays already in hand, and
   * `deadReason` is rebuilt every render anyway, so a memo would need every filter in its
   * dependency list to buy nothing.
   */
  const spineItems: GroupSpineItem[] = [...typeChrome.entries()]
    .map(([id, chrome]) => ({
      id,
      label: chrome.label,
      count: typeFacets.find((t) => t.id === id)?.count ?? 0,
      href: `#type-${id}`,
      deadReason: deadReason("type"),
    }))
    /* A zero pill is kept only while it is the active filter, so the reader can clear it. */
    .filter((item) => item.count > 0 || item.id === type);

  /**
   * Which row the spine fills, resolved at render rather than kept in sync by an effect.
   *
   * Two jobs in one expression. Before the observer has said anything — on the server, and
   * on the first client frame — the reader is at the top of the shelf, so the first group is
   * current; falling back to `null` would put eight rows with no mark on any of them in the
   * prerendered HTML, which is the state a reader with no script keeps for good.
   *
   * And it discards a stale id. When a filter empties a type the observed value can name a
   * group that is no longer rendered, and the effect may not write state to correct it — see
   * the note there. Checking membership here is both cheaper and more honest: there is one
   * answer, computed from what is actually on the page this render.
   */
  const activeGroup =
    (observed !== null && groups?.some((g) => g.id === observed) === true
      ? observed
      : groups?.[0]?.id) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* The disclosure, the panel and the control shape all live in
          `components/ui/RegistryFilterBar.tsx` now. What stays here is what only this
          browser knows: which filters exist and how they narrow the library. */}
      <RegistryFilterBar
        id="node-filters"
        label="Filter node cards"
        results={results.length}
        total={nodes.length}
        active={activeCount}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            value={search}
            onChange={setDraft}
            placeholder="Search ids, names, actions, tools…"
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
      </RegistryFilterBar>

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
            className="cursor-pointer text-muted underline-offset-4 transition-colors hover:text-amber hover:underline"
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
          These cards declare no lifecycle phase, and that is a valid answer: the five
          phases describe a blueprint&rsquo;s shape rather than every node in it. Intake,
          retrieval, routing and hand-off are real work that none of the five names.
        </p>
      )}

      {/* The spine, and only under the grouping sort.
          ------------------------------------------------------------
          `Name A–Z` and `Most used` ask for one ordered run of cards; there are no panels
          to jump to and the `groups === null` branch below is untouched. It also goes when
          the shelf is empty, because a jump list over nothing is eight dead rows and a
          heading that says "No node cards match" two lines under it.

          Placed here rather than inside `RegistryFilterBar` — the reasoning is in
          `GroupSpine`'s header, and the short version is that this is navigation and that
          bar is `role="search"` with a phone disclosure labelled "Filter". */}
      {groups !== null && groups.length > 0 && (
        <GroupSpine
          ariaLabel="Jump to a card type"
          items={spineItems}
          activeId={activeGroup}
          results={results.length}
          total={nodes.length}
          /* Copper, and it is the ONE accent on this shelf the 2026-09-06 pass could not
             move. The tiles, the filter chips and the reset link all went amber with the
             owner's ruling; this pill reads its colour out of `ACCENT` in
             `components/ui/GroupSpine.tsx`, which offers `cyan` and `copper` and no third
             entry, and that file is not this pass's to edit. Copper is still warm and still
             not the blueprint's cyan, so the shelf does not read as a blueprint in the
             meantime. TODO: add an `amber` entry to `GroupSpine`'s `ACCENT`
             (`border-amber bg-amber text-void`, 11.06:1 against `--color-void`) and pass it
             here, so one page stops carrying two card registers. */
          accent="copper"
        />
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
          /* `gap-5` between panels, where it was `gap-10` between runs of tiles.
             ------------------------------------------------------------
             The 40px was doing the dividing on its own and could not: scrolling the Tool
             group a reader got grid, then text on the page ground, then more grid, with
             nothing to cross. A panel divides by being a different surface, so the space
             between two of them only has to say "these are two things" — and 40px of void
             between two bounded boxes reads as a hole rather than as a boundary. */
          <div className="flex flex-col gap-5">
            {groups.map((group, i) => {
              const chrome = typeChrome.get(group.id);
              return (
                /* One bounded panel per type, with its own ground.
                   ------------------------------------------------------------
                   Two grounds and no more, alternating by position in the run rather than
                   by anything about the type — `blueprint-deep` at 22% and `surface-2` at
                   55%, which is the pair the mock draws. Both are barely there on
                   `--color-void`, which is the point: what a reader crosses is the hairline
                   and the change of value, not a colour that means something. Assigning a
                   ground PER TYPE would be inventing a fifth colour vocabulary on a page
                   that already has none for node types.

                   `overflow-hidden` so the header's bottom rule stops at the radius rather
                   than running out through the corner. */
                <section
                  key={group.id}
                  /* The anchor the spine jumps to, and it is a real one: `#type-tool` in the
                     address bar lands here with no script involved, which is what the app's
                     ban on `scrollIntoView` leaves you with and is the better mechanism
                     anyway — it survives a shared link, a middle-click and a reader who has
                     turned JavaScript off. */
                  id={`type-${group.id}`}
                  /* Read by the observer's callback off `entry.target`, so the effect never
                     has to keep a parallel array of ids in the same order as the entries. */
                  data-type-id={group.id}
                  /* The cleanup's braces are not style: React 19 types a ref callback's
                     return as `void | (() => void)`, and `Map.delete` answers `boolean`, so
                     the concise arrow does not typecheck. */
                  ref={(el) => {
                    const refs = panelRefs.current;
                    if (el === null) return;
                    refs.set(group.id, el);
                    return () => {
                      refs.delete(group.id);
                    };
                  }}
                  /* See `SPINE_CLEARANCE`: the header and the spine are both pinned above
                     this, and without the margin a jump lands with the panel's own heading
                     behind them. */
                  style={{ scrollMarginTop: SPINE_CLEARANCE }}
                  className={cx(
                    "overflow-hidden rounded-xl border border-line",
                    i % 2 === 0 ? "bg-blueprint-deep/22" : "bg-surface-2/55",
                  )}
                >
                  {/* Still an `h2`, and still carrying the same `aria-label`.
                      ------------------------------------------------------------
                      It was `sticky top-15 z-30` on `bg-void/95`, so the answer to "what
                      am I looking at" survived a scroll through two dozen tools. The spine
                      above the shelf answers that continuously now, and it answers the
                      question the pinned heading could not — what ELSE is there, and how
                      far through am I — so the heading goes back into the flow at the top
                      of its own panel. What the pinning cost is worth writing down: two
                      sticky bands in one scroll container, one of them competing with the
                      filter bar for the same 65px of screen.

                      `top-15` and `z-30` go with it. The 15 cleared the 65px header exactly
                      where `top-16` left a 1px sliver of grid above it; the 30 was section
                      chrome, one rung under the page's filter bar and above the tier a
                      card's furniture reaches, because at `z-10` three star chips floated
                      over this band mid-scroll. Neither is a live constraint on an element
                      that does not pin, and the z ladder's section-chrome rung is now spent
                      on the spine, which does.

                      `aria-label` carries the pair a reader sees — the human label and the
                      count — without the raw term id between them, which announced as
                      "Agent agent 18". It matters more here than it did: the header now
                      also holds an index and a sentence, and the accessible name is what
                      keeps the heading a heading rather than a paragraph.

                      `flex-wrap` with `gap-y-1`: at 768 the definition cannot share a line
                      with a 20px label, a code chip and a count, and the row it drops to is
                      still inside the same band. */}
                  <h2
                    aria-label={`${group.label}, ${group.nodes.length} card${group.nodes.length === 1 ? "" : "s"}`}
                    className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-line px-5 py-3.5"
                  >
                    {chrome !== undefined && (
                      /* The type's place in the vocabulary, not in the filtered grid. It
                         does not renumber when a filter empties the group above it —
                         `Tool` is `07` on a shelf showing all eight types and on a shelf
                         showing only Tool. `text-dim` and not `text-faint`: an index that
                         cannot be read is decoration, and this one is a fact. */
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
                    {/* The ontology term's own `description`, verbatim, and no line at all
                        when the term carries none. A placeholder here would be the page
                        inventing vocabulary on the one shelf whose subject is a controlled
                        one. */}
                    {chrome?.description !== undefined && (
                      <span className="min-w-0 text-sm text-muted">{chrome.description}</span>
                    )}
                    {/* `ms-auto`, and it needs `flex-wrap`'s permission: on a wrapped row
                        the count sits at the right end of whichever line it lands on, which
                        is where a reader looks for it either way. */}
                    <span
                      aria-hidden
                      className="ms-auto shrink-0 font-mono text-[11px] tracking-[0.06em] tabular-nums text-dim"
                    >
                      {group.nodes.length} card{group.nodes.length === 1 ? "" : "s"}
                    </span>
                  </h2>
                  {/* Three columns only when there are more than two cards to put in
                      them. `Decision` holds 2 and `Human gate` holds 2, and at a fixed
                      `lg:grid-cols-3` each of those groups drew two tiles and a third of a
                      row of nothing — an empty column that reads as a card that failed to
                      load. Two tiles across a wide row is a pair; two tiles in a
                      three-track grid is a gap.

                      Unchanged by the panel, and worth saying so: the tracks are measured
                      against the panel's inner width now rather than the page's, and the
                      rule is the same rule. */}
                  <div
                    className={cx(
                      "grid gap-5 p-5 sm:grid-cols-2",
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
              );
            })}
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
            Nothing in the registry answers to these filters. Try a broader query,
            or drop the node type or the phase.
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 cursor-pointer font-mono text-xs text-amber underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
