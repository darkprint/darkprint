/* ============================================================
   DarkPrint — the ontology term row, and the flat list of them
   One presentation for one vocabulary entry, shared by the flat
   list below and by the grouped forest in `TermTree.tsx`, so a
   term looks the same wherever the page happens to arrange it.
   Doc 1 §6 (the vocabulary), doc 3 §1 (the three dimensions a node
   declares).

   ── Why this is a row on shared column tracks ──
   Two presentations came before it and each failed the same fact
   from a different side.

   It was a flat `divide-y` stack of rows. The author, on the
   node-type section: the four roots, their descriptions and their
   subtypes "are too mixed visually". True — hairline rows gave a
   root and its child identical weight, so the one relation the
   vocabulary exists to carry was the one thing the layout hid.

   So it became a card, and subterms were drawn inside the parent
   card's border, two cards to a row. That fixed grouping and broke
   everything else. The author: the elements "are not aligned and
   not structurally separated". Also true, and measurably: a
   two-column grid of cards shares no column track, so every
   description began at a different x and every weight chip floated
   to its own card's right edge; card heights differed, so nothing
   lined up across a row; and a subsumption tree reads *down* while
   a two-column grid reads left, right, left.

   The row is the third answer and it keeps both facts. Every row
   in a tree — root or leaf, depth 0 or depth 2 — lays out on the
   same `grid-template-columns`, so descriptions share one left
   edge and weights share one right edge and can be compared by
   running the eye down a column. Depth is spent inside the first
   cell as padding, never on the row, which is why a nested list
   can indent without knocking the later columns out of true. That
   constraint is load-bearing and `TermTree` depends on it: the
   nested `<ul>`s it builds carry no horizontal padding of their
   own.

   Grouping, which the cards did carry, is now proximity and a
   drawn spine rather than a border — see `TermTree`. Nothing here
   nests a bordered box inside a bordered box.

   ── The usage counts are gone ──
   "if on the right of each field, the numbers refer to the number
   of blueprint where those components are used, delete them". They
   did, and they are. `termUsageIndex` stays and is still exported,
   because each term's own page answers "who uses it" in full and
   the vocabulary listing still counts how many cards spell a
   deprecated id.

   Server components. `Registry`, `OntologyTerm` and
   `DARKPRINT_CONFIG` are the engine's own and carry no
   filesystem, so the whole module is isomorphic — it just has no
   reason to be a client one.
   ============================================================ */

import Link from "next/link";
import type { NodeCard, OntologyTerm, Registry, TermKind } from "@/lib/core";
import { DARKPRINT_CONFIG } from "@/lib/core";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/format";
import { termHref } from "@/lib/href";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-17): GET /api/ontology/usage

/* --------------------- the five kinds --------------------- */

/**
 * Presentation for each `TermKind`. Every entry carries a glyph *and* a word, so
 * the accent colour is decoration and a reader who cannot see it loses nothing.
 *
 * Five entries, not four: `phase` is one of the three dimensions a node card describes
 * itself with, alongside `node-type` and `risk-marker`. `data-type` and `tool` are the
 * two doc 1 needs for typed ports (§2 rule 3) and `tools[]` (§3.2).
 *
 * ── Why none of these five is a semantic colour any more ──
 * This table needed five distinguishable colours and reached into the accent palette,
 * because that is where the colours are. It cost three of them their meaning.
 * `components/viz/tokens.ts` says in writing that `--color-signal` "exists for the one
 * drawing that has a defect to show … nothing else should reach for it", and it was
 * painting ten dictionary entries: `execution-risk`, `secret-access` and the rest are a
 * *description* of what a node may do, declared on a card on purpose, not a fault the
 * site found. `--color-violet` is "where a person acts", and it was also "phase", so it
 * meant two things on one page. `--color-amber` is reserved for exactly two jobs —
 * "not built yet" and "this box leaves the page" — and it was also "node type".
 *
 * The five below come off the blueprint pole instead, which is the site's drawing-ink
 * register and carries no status at all. They read as a legend and spend nothing. They
 * are ordered so the two closest pairs (blueprint-line/the cyan mix, and muted/dim) are
 * never adjacent as the page scrolls: measured with CIEDE2000 against the panel ground,
 * every neighbouring pair in the catalog is ≥16 ΔE apart, and the tightest pair anywhere
 * in the set is 7.3. Every one of the five clears 5.4:1 on `--color-surface-2`, which no
 * glyph here strictly needs — each is `aria-hidden` beside its own word — but a legend a
 * low-vision reader cannot read is a legend that is not doing its job.
 */
export const TERM_KIND_META: Record<
  TermKind,
  { label: string; plural: string; glyph: string; color: string }
> = {
  phase: {
    label: "Phase",
    plural: "Phases",
    glyph: "▷",
    color: "var(--color-blueprint-ink)",
  },
  "node-type": {
    label: "Node type",
    plural: "Node types",
    glyph: "◫",
    color: "var(--color-blueprint-line)",
  },
  "risk-marker": {
    label: "Risk marker",
    plural: "Risk markers",
    glyph: "▲",
    color: "var(--color-muted)",
  },
  "data-type": {
    label: "Data type",
    plural: "Data types",
    glyph: "◇",
    // The one mixed value: a cyan pulled most of the way to the neutral, so the data-type
    // legend keeps a hint of the ink the ports are drawn in without claiming the
    // interactive colour. Mixed from tokens, so it moves when they do.
    color: "color-mix(in oklab, var(--color-cyan-bright) 70%, var(--color-dim))",
  },
  tool: {
    label: "Tool capability",
    plural: "Tool capabilities",
    glyph: "⚙",
    color: "var(--color-dim)",
  },
};

/** Which structural field of a card the term is allowed to fill. */
export function TermKindBadge({ kind }: { kind: TermKind }) {
  const meta = TERM_KIND_META[kind];
  return <Badge color={meta.color}>{meta.label}</Badge>;
}

/* --------------------- §7 phase 1: usage --------------------- */

/**
 * How far one term has travelled: the three figures §7 phase 1 counts before a
 * local term is even considered for promotion. Every list is distinct and sorted.
 */
export interface TermUsage {
  /** Card ids naming the term in a structural field — `type`, a port, a tool, a marker. */
  cards: string[];
  /** Blueprint slugs pinning one of those cards. */
  blueprints: string[];
  /** Distinct card authors, which is the figure §7 leans on hardest. */
  authors: string[];
}

/** The reading for a term nothing references. Shared so an unused term is one object. */
export const NO_USAGE: TermUsage = Object.freeze({
  cards: [],
  blueprints: [],
  authors: [],
});

interface UsageDraft {
  cards: Set<string>;
  blueprints: Set<string>;
  authors: Set<string>;
}

/**
 * Every term the archive actually references, and by whom.
 *
 * Counted over *every published card version*, then deduplicated by card id: a term
 * a card dropped between 1.0.0 and 1.1.0 still shows the card, because the archive
 * still carries the version that names it (§4 — a published version is immutable).
 *
 * The id is credited **exactly as the card spells it**. A card naming a deprecated
 * term is counted against that term and not against its successor, which is the only
 * way the counts can answer "is anybody still writing the old spelling?".
 *
 * `phase` is in the list because it is a structural field like the others — leaving it
 * out left every one of the five phases reading "unused so far" on a page where each of
 * them is declared by most of the archive. It is spread rather than pushed: a card
 * declares zero, one or several phases, so a card outside the five credits none of them
 * and a card in two credits both. There is no bucket for "declared no phase" and there
 * must not be one — this index counts terms, and a card that names no phase has named
 * no term.
 */
export function termUsageIndex(registry: Registry): ReadonlyMap<string, TermUsage> {
  return termUsageOver(registry.cards());
}

/**
 * One published card version, reduced to the three fields a usage index reads.
 *
 * Structural rather than either concrete record, because there are now two archives and
 * both answer this question: `lib/core`'s `CardVersionRecord` from the build-time index,
 * and `lib/server/registry`'s `CardSummary` from the database. They agree on `id` and
 * `card` and differ on the third — the build-time index carries blueprint SLUGS, the
 * registry carries `{ownerHandle, slug}` pairs, because B-09 made a slug ambiguous across
 * owners.
 *
 * So `usedIn` is whatever spelling of a blueprint's IDENTITY the caller can supply, and it
 * reaches `TermUsage.blueprints` unchanged. The set is deduplicated on it, which is the
 * only property this index needs of it, and a caller passing an ambiguous spelling gets an
 * under-count rather than a wrong one — a reason to pass `owner/slug` where it exists.
 */
export interface UsageSource {
  id: string;
  card: NodeCard;
  usedIn: readonly string[];
}

/**
 * `termUsageIndex`'s computation, over any card corpus.
 *
 * Added rather than folded into the function above, and the function above DELEGATES to it,
 * because two Forbidden routes call `termUsageIndex(registry)` and D-260-01 freezes that
 * signature: a second implementation for the database path would be the same rule written
 * down twice, and the two would agree exactly until the day one of them was fixed.
 */
export function termUsageOver(cards: readonly UsageSource[]): ReadonlyMap<string, TermUsage> {
  const drafts = new Map<string, UsageDraft>();

  for (const record of cards) {
    const { card } = record;
    const ids = [
      ...card.phases,
      card.type,
      ...card.riskMarkers,
      ...card.tools,
      ...card.inputs.map((port) => port.type),
      ...card.outputs.map((port) => port.type),
    ];
    for (const id of ids) {
      let draft = drafts.get(id);
      if (draft === undefined) {
        draft = { cards: new Set(), blueprints: new Set(), authors: new Set() };
        drafts.set(id, draft);
      }
      draft.cards.add(record.id);
      for (const slug of record.usedIn) draft.blueprints.add(slug);
      if (card.author !== undefined && card.author !== "") draft.authors.add(card.author);
    }
  }

  const usage = new Map<string, TermUsage>();
  for (const [id, draft] of drafts) {
    // Default `sort` compares UTF-16 code units, which is the locale-independent
    // order the engine's own indexes use — the lists must not move between hosts.
    usage.set(id, {
      cards: [...draft.cards].sort(),
      blueprints: [...draft.blueprints].sort(),
      authors: [...draft.authors].sort(),
    });
  }
  return usage;
}

/* --------------------- pieces of a row --------------------- */

/** "2.00" — weights are quarter-points, so two decimals never lie by rounding. */
export function formatWeight(weight: number): string {
  return weight.toFixed(2);
}

/**
 * The configured weights, read through an index signature that admits `undefined` —
 * the same widening `lib/core/ontology/resolve.ts` does, for the same reason:
 * `Readonly<Record<string, number>>` claims every string is a key.
 */
const CONFIGURED_WEIGHTS: Readonly<Partial<Record<string, number>>> =
  DARKPRINT_CONFIG.security.weights;

/**
 * What a risk marker subtracts, or `undefined` when nobody has priced it.
 *
 * Doc 3 §4 moved the seven core weights out of the vocabulary and into
 * `DARKPRINT_CONFIG.security.weights`, so a core marker's `defaultWeight` is now always
 * unset and reading it alone would print no weight for any of them. This is the engine's
 * own lookup order (doc 3 §7): the configuration first, then the term's own
 * `defaultWeight`, which survives for locally namespaced markers. `undefined` means the
 * marker is worth `security.unknownMarkerWeight` and does not move the security level — a fact worth
 * saying in words rather than rendering as "0.00", which reads like a priced marker.
 */
export function markerWeight(term: OntologyTerm): number | undefined {
  if (term.kind !== "risk-marker") return undefined;
  return CONFIGURED_WEIGHTS[term.id] ?? term.defaultWeight;
}

/**
 * §6.2 made visible: a deprecated term is never removed, it is signposted. The arrow
 * is decorative, the successor is a real link with a real accessible name.
 */
export function DeprecationMark({ term }: { term: OntologyTerm }) {
  const replacedBy = term.deprecated?.replacedBy;
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
      deprecated
      {replacedBy !== undefined && (
        <>
          <span aria-hidden>→</span>
          <Link
            href={termHref(replacedBy)}
            aria-label={`Replaced by ${replacedBy}`}
            className="normal-case tracking-normal underline underline-offset-2 transition-colors hover:text-amber-bright"
          >
            {replacedBy}
          </Link>
        </>
      )}
    </span>
  );
}

/* --------------------- the shared column tracks --------------------- */

/**
 * The one `grid-template-columns` every term row lays out on.
 *
 * Both strings are written out in full rather than composed, because Tailwind's scanner
 * reads this file as text and a class assembled at runtime is a class it never emits.
 *
 * `md` and not `sm`: at 640px a 15rem name column leaves the description about 36
 * characters, which is under the measure the type floor asks for. Below `md` the row
 * stacks instead, and the indent moves from the first cell onto the row, so a subterm
 * still reads as indented when there are no columns left to align.
 *
 * Re-checked at the full container after the width caps came off (2026-09-05): only the
 * `1fr` track grows, from ~590px to ~848px inside a `container-page` panel, and the
 * longest description the core ships is 155 characters, so the widest a row gets is two
 * lines and most are one. The 15rem name track is what holds the grid legible and it does
 * not move, so nothing here needed re-tuning and no fourth column was invented to fill
 * space — a term row carries what it is called, what it means, and what it costs.
 */
export const TERM_COLUMNS = "md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]";
export const TERM_COLUMNS_WEIGHTED =
  "md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_4.5rem]";

export function termColumns(showWeight: boolean): string {
  return showWeight ? TERM_COLUMNS_WEIGHTED : TERM_COLUMNS;
}

/**
 * The width one level of subsumption is worth.
 *
 * Exported because `TermTree` positions its rails against the same number: the indent is
 * padding inside the first cell, and the rail is drawn a fixed distance to the left of
 * where that cell's text begins. Two files agreeing by arithmetic rather than by eye.
 */
export const TERM_INDENT_STEP_REM = 1.5;

/** Depth as a CSS length, for the custom property both files read. */
export function termIndent(depth: number): string {
  return `${depth * TERM_INDENT_STEP_REM}rem`;
}

/**
 * The strip naming the columns, drawn once above a list or a tree.
 *
 * It earns its line twice. It says what the bare number in the third column is, which the
 * chip reading `weight 2.00` used to have to repeat on every single row; and it puts a
 * real top edge on the grid, so the rows below read as one aligned object rather than as
 * a stack that happens to line up. Hidden below `md`, where there are no columns to name.
 */
export function TermColumnHeader({ showWeight = false }: { showWeight?: boolean }) {
  return (
    <div
      className={cx(
        "hidden gap-x-6 border-b border-line pb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dim md:grid",
        termColumns(showWeight),
      )}
    >
      <span>Term</span>
      <span>What it means</span>
      {showWeight && <span className="text-right">Weight</span>}
    </div>
  );
}

/* --------------------- the row --------------------- */

/**
 * One vocabulary entry: what it is called, what it is spelled, whether it is still the
 * current spelling, what it means, and what it costs if anything.
 *
 * The indent is read from `--term-indent`, which the caller sets on the element owning
 * this row. Above `md` it is padding on the *first cell*, so the description and weight
 * columns stay where they are however deep the term sits; below `md` it moves onto the
 * row, because a stacked row has no later columns to knock out of true.
 */
export function TermRow({
  term,
  showWeight = false,
  root = false,
  className,
}: {
  term: OntologyTerm;
  /** Show the doc 3 §5 weight. Only risk markers carry one. */
  showWeight?: boolean;
  /** A term nothing in its kind subsumes. Set a step heavier than what hangs off it. */
  root?: boolean;
  className?: string;
}) {
  const weight = showWeight ? markerWeight(term) : undefined;
  return (
    <div
      className={cx(
        "grid gap-x-6 gap-y-1 py-2.5 pl-[var(--term-indent,0px)] md:pl-0",
        termColumns(showWeight),
        className,
      )}
    >
      {/* `leading-[20px]` on the cell and not on the link, because a line box is at least
          as tall as its parent's strut: setting it on an inline `<a>` alone leaves the
          box at whatever the panel happens to inherit, which measured 25px and drifted
          the label 3px below where `TermTree` draws the elbow that points at it. Fixed
          here, the label's centre is `py` + 10px on every row, and the rail can be
          positioned by arithmetic. */}
      <div className="min-w-0 leading-[20px] md:pl-[var(--term-indent,0px)]">
        <Link
          href={termHref(term.id)}
          className={cx(
            "font-display text-fg transition-colors hover:text-cyan",
            root ? "text-[15px] font-semibold" : "text-[14px] font-medium",
          )}
        >
          {term.label}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <code className="font-mono text-[11px] text-dim">{term.id}</code>
          {term.deprecated !== undefined && <DeprecationMark term={term} />}
        </div>
      </div>

      {/* No measure on this cell. It has been through both wrong answers: `max-w-4xl` on
          the whole table, which capped the *object* to protect the *paragraph* and left
          the grid 235px short of its own panel border; then `.prose-lane` here, which
          fixed the right edge of the table and moved the ragged one onto the description
          column, where it sat under a full-width header rule.

          A column of a table is not body prose. It is read across from the term that owns
          it, one line at a time, and the thing that keeps it legible is the 15rem cap on
          the term column beside it, not a measure on itself. It fills its track, the
          track fills the panel, and the panel fills `container-page` (owner, 2026-09-05). */}
      <p className="min-w-0 text-[13px] leading-relaxed text-muted">
        {term.description}
      </p>

      {showWeight && (
        <div className="font-mono text-[12px] tabular-nums text-fg md:text-right">
          <span className="text-dim md:hidden">weight </span>
          {weight === undefined ? (
            <>
              <span aria-hidden className="text-dim">
                —
              </span>
              <span className="sr-only">
                No weight. It is a category a rule is written about, not a marker a card declares.
              </span>
            </>
          ) : (
            formatWeight(weight)
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------- the flat list --------------------- */

/**
 * A list of terms with no hierarchy worth drawing: the five phases, which doc 3 §2 keeps
 * flat and closed. The kinds that *are* deep (node types, risk markers, data types, tool
 * capabilities) get `TermTree`, which groups them by `broader`.
 *
 * A hairline between every entry and no extra space, which is the rhythm a flat kind
 * wants. The generous gaps `TermTree` opens are there to separate *groups*, and a kind
 * with no groups that borrowed them would be claiming a structure it does not have.
 *
 * `terms` is taken as given rather than re-sorted: the phases have to read in doc 3 §2's
 * lifecycle order, which is not the alphabetical order `byKind` returns.
 *
 * No width of its own, and no measure inside it either — see `TermRow`. It fills whatever
 * column it is mounted in, which is a panel filling `container-page` on the route that
 * mounts the catalog. That was `/ontology` until 2026-09-06 and is `/spec/ontology` now;
 * the number never depended on which.
 */
export function TermTable({
  terms,
  showWeight = false,
  className,
}: {
  terms: readonly OntologyTerm[];
  showWeight?: boolean;
  className?: string;
}) {
  if (terms.length === 0) {
    return <p className="text-sm text-dim">This vocabulary declares no terms of that kind.</p>;
  }
  return (
    <div className={className}>
      <TermColumnHeader showWeight={showWeight} />
      <ul className="divide-y divide-line">
        {terms.map((term) => (
          <li key={term.id}>
            <TermRow term={term} showWeight={showWeight} root />
          </li>
        ))}
      </ul>
    </div>
  );
}
