/* ============================================================
   DarkPrint — the ontology term card, and the flat grid of them
   One presentation for one vocabulary entry, shared by the flat
   grid below and by the grouped forest in `TermTree.tsx`, so a
   term looks the same wherever the page happens to arrange it.
   Doc 1 §6 (the vocabulary), doc 3 §1 (the three dimensions a node
   declares).

   ── Why this is a card and not a row ──
   It was a row: label, id, a usage count pushed to the right edge,
   and a description under all three, stacked in a `divide-y` list.
   The author, on the node-type section: the four roots, their
   descriptions and their subtypes "are too mixed visually", and
   the same on risk markers, data types and tool capabilities. A
   flat stack of rows separated by hairlines gives a root and its
   child identical weight, so the one relation the vocabulary
   exists to carry was the one thing the layout hid.

   A card has an edge, so a group of terms is one object on the
   page and a subterm drawn inside its parent's edge is visibly
   inside it.

   ── The usage counts are gone ──
   "if on the right of each field, the numbers refer to the number
   of blueprint where those components are used, delete them". They
   did, and they are. `termUsageIndex` stays and is still exported,
   because each term's own page answers "who uses it" in full and
   the `/ontology` copy still counts how many cards spell a
   deprecated id.

   Server components. `Registry`, `OntologyTerm` and
   `DARKPRINT_CONFIG` are the engine's own and carry no
   filesystem, so the whole module is isomorphic — it just has no
   reason to be a client one.
   ============================================================ */

import Link from "next/link";
import type { OntologyTerm, Registry, TermKind } from "@/lib/core";
import { DARKPRINT_CONFIG } from "@/lib/core";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/format";
import { termHref } from "@/lib/href";

/* --------------------- the five kinds --------------------- */

/**
 * Presentation for each `TermKind`. Every entry carries a glyph *and* a word, so
 * the accent colour is decoration and a reader who cannot see it loses nothing.
 *
 * Five entries, not four: `phase` is one of the three dimensions a node card describes
 * itself with, alongside `node-type` and `risk-marker`. `data-type` and `tool` are the
 * two doc 1 needs for typed ports (§2 rule 3) and `tools[]` (§3.2).
 */
export const TERM_KIND_META: Record<
  TermKind,
  { label: string; plural: string; glyph: string; color: string }
> = {
  phase: {
    label: "Phase",
    plural: "Phases",
    glyph: "▷",
    color: "var(--color-violet)",
  },
  "node-type": {
    label: "Node type",
    plural: "Node types",
    glyph: "◫",
    color: "var(--color-amber)",
  },
  "risk-marker": {
    label: "Risk marker",
    plural: "Risk markers",
    glyph: "▲",
    color: "var(--color-signal)",
  },
  "data-type": {
    label: "Data type",
    plural: "Data types",
    glyph: "◇",
    color: "var(--color-cyan)",
  },
  tool: {
    label: "Tool capability",
    plural: "Tool capabilities",
    glyph: "⚙",
    color: "var(--color-emerald)",
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
  const drafts = new Map<string, UsageDraft>();

  const cards = registry.cards();
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
 * marker is worth `security.unknownMarkerWeight` and does not move a score — a fact worth
 * saying in words rather than rendering as "0.00", which reads like a priced marker.
 */
export function markerWeight(term: OntologyTerm): number | undefined {
  if (term.kind !== "risk-marker") return undefined;
  return CONFIGURED_WEIGHTS[term.id] ?? term.defaultWeight;
}

/** The doc 3 §5 penalty a risk marker carries, in points off a starting score of 4. */
export function WeightChip({ weight }: { weight: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
      <span className="text-dim">weight</span>
      <span className="tabular-nums text-fg">{formatWeight(weight)}</span>
    </span>
  );
}

/**
 * §6.2 made visible: a deprecated term is never removed, it is signposted. The arrow
 * is decorative, the successor is a real link with a real accessible name.
 */
export function DeprecationMark({ term }: { term: OntologyTerm }) {
  const replacedBy = term.deprecated?.replacedBy;
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber">
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

/* --------------------- the card --------------------- */

/**
 * One vocabulary entry: what it is called, what it is spelled, whether it is still the
 * current spelling, what it costs if anything, and what it means.
 *
 * `subterms` is what the term subsumes, rendered inside this card's own border. Nesting
 * is the `broader` relation and nothing else carries it, so a card with children reads as
 * one group and a reader never has to work out whether two adjacent entries are siblings.
 */
export function TermCard({
  term,
  showWeight = false,
  subterms,
  className,
}: {
  term: OntologyTerm;
  /** Show the doc 3 §5 weight. Only risk markers carry one, and only a priced one shows. */
  showWeight?: boolean;
  subterms?: React.ReactNode;
  className?: string;
}) {
  const weight = showWeight ? markerWeight(term) : undefined;
  return (
    <li
      className={cx(
        "flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2/50 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <Link
          href={termHref(term.id)}
          className="font-display text-[15px] font-semibold leading-snug text-fg transition-colors hover:text-cyan"
        >
          {term.label}
        </Link>
        <code className="font-mono text-[11px] text-dim">{term.id}</code>
        {term.deprecated !== undefined && <DeprecationMark term={term} />}
        {weight !== undefined && (
          <span className="ml-auto">
            <WeightChip weight={weight} />
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted">{term.description}</p>
      {subterms}
    </li>
  );
}

/* --------------------- the flat grid --------------------- */

/**
 * A list of terms with no hierarchy worth drawing: the five phases, which doc 3 §2 keeps
 * flat and closed. The kinds that *are* deep (node types, risk markers, data types, tool
 * capabilities) get `TermTree`, which groups them by `broader`.
 *
 * `terms` is taken as given rather than re-sorted: the phases have to read in doc 3 §2's
 * lifecycle order, which is not the alphabetical order `byKind` returns.
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
    <ul className={cx("grid gap-3 sm:grid-cols-2", className)}>
      {terms.map((term) => (
        <TermCard key={term.id} term={term} showWeight={showWeight} />
      ))}
    </ul>
  );
}
