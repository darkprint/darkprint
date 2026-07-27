/* ============================================================
   DarkPrint — the ontology term row, and the flat table of them
   One presentation for one vocabulary entry, shared by the flat
   table below and by the indented tree in `TermTree.tsx`, so a
   term looks the same wherever the page happens to arrange it.
   Doc 1 §6 (the vocabulary) and §7 (the usage counts), doc 3 §1
   (the three dimensions a node declares).

   Server components. `Registry`, `OntologyTerm` and
   `DARKPRINT_CONFIG` are the engine's own and carry no
   filesystem, so the whole module is isomorphic — it just has no
   reason to be a client one.
   ============================================================ */

import Link from "next/link";
import type { OntologyTerm, OntologyView, Registry, TermKind } from "@/lib/core";
import { DARKPRINT_CONFIG } from "@/lib/core";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/format";
import { termHref } from "@/lib/href";

/* --------------------- the five kinds --------------------- */

/**
 * Presentation for each `TermKind`. Every entry carries a glyph *and* a word, so
 * the accent colour is decoration and a reader who cannot see it loses nothing.
 *
 * Five entries, not four: doc 3 §1 makes `phase` one of the three dimensions every
 * node declares, alongside `node-type` and `risk-marker`. `data-type` and `tool` are
 * the two doc 1 needs for typed ports (§2 rule 3) and `tools[]` (§3.2).
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
 * `phase` is in the list because doc 3 §1 makes it a structural field like the others —
 * leaving it out left every one of the five phases reading "unused so far" on a page
 * where each of them is declared by most of the archive.
 */
export function termUsageIndex(registry: Registry): ReadonlyMap<string, TermUsage> {
  const drafts = new Map<string, UsageDraft>();

  const cards = registry.cards();
  for (const record of cards) {
    const { card } = record;
    const ids = [
      card.phase,
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

/**
 * "12 cards · 6 blueprints", or an explicit nobody-yet.
 *
 * `narrower` is the count of terms this one subsumes. A term with children and no cards
 * of its own is an abstract category — `human-in-the-loop`, `evaluative`,
 * `execution-risk`, `isolation-breach` — and no card ever declares one directly; that is
 * the point of it. Printing "unused" over such a row says the opposite of what is true,
 * since a rule written about the category catches every card under it.
 */
export function UsageMeta({
  usage,
  narrower = 0,
  className,
}: {
  usage: TermUsage;
  narrower?: number;
  className?: string;
}) {
  if (usage.cards.length === 0) {
    return (
      <span className={cx("font-mono text-[11px] text-dim", className)}>
        {narrower > 0
          ? `category · ${narrower} narrower`
          : "not declared in this archive"}
      </span>
    );
  }
  return (
    <span className={cx("font-mono text-[11px] tabular-nums text-dim", className)}>
      {usage.cards.length} card{usage.cards.length === 1 ? "" : "s"} ·{" "}
      {usage.blueprints.length} blueprint{usage.blueprints.length === 1 ? "" : "s"}
    </span>
  );
}

/* --------------------- the row --------------------- */

/**
 * One vocabulary entry: what it is called, what it is spelled, whether it is still
 * the current spelling, how much of the registry leans on it, and what it means.
 */
export function TermRow({
  term,
  usage,
  narrower = 0,
  showWeight = false,
  className,
}: {
  term: OntologyTerm;
  usage: TermUsage;
  /** How many terms this one subsumes — see `UsageMeta`. */
  narrower?: number;
  /** Show the doc 3 §5 weight. Only risk markers carry one, and only a priced one shows. */
  showWeight?: boolean;
  className?: string;
}) {
  const weight = showWeight ? markerWeight(term) : undefined;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <Link
          href={termHref(term.id)}
          className="font-display text-[15px] font-semibold leading-snug text-fg transition-colors hover:text-cyan"
        >
          {term.label}
        </Link>
        <code className="font-mono text-[11px] text-dim">{term.id}</code>
        {term.deprecated !== undefined && <DeprecationMark term={term} />}
        {weight !== undefined && <WeightChip weight={weight} />}
        <UsageMeta usage={usage} narrower={narrower} className="ml-auto" />
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-muted">{term.description}</p>
    </div>
  );
}

/* --------------------- the flat table --------------------- */

/**
 * A list of terms with no hierarchy worth drawing — the five phases, which doc 3 §2
 * keeps flat and closed, and the tool capabilities, which sit one level under a single
 * root. The kinds that *are* deep (node types, risk markers, data types) get `TermTree`.
 *
 * `terms` is taken as given rather than re-sorted: the phases have to read in doc 3 §2's
 * lifecycle order, which is not the alphabetical order `byKind` returns.
 *
 * `ontology` is optional and only used to count what each term subsumes, so an abstract
 * category is labelled as one instead of as an unused term.
 */
export function TermTable({
  terms,
  usage,
  ontology,
  showWeight = false,
  className,
}: {
  terms: readonly OntologyTerm[];
  usage: ReadonlyMap<string, TermUsage>;
  ontology?: OntologyView;
  showWeight?: boolean;
  className?: string;
}) {
  if (terms.length === 0) {
    return <p className="text-sm text-dim">This vocabulary declares no terms of that kind.</p>;
  }
  return (
    <ul className={cx("divide-y divide-line", className)}>
      {terms.map((term) => (
        <li key={term.id} className="py-3 first:pt-0 last:pb-0">
          <TermRow
            term={term}
            usage={usage.get(term.id) ?? NO_USAGE}
            narrower={
              ontology === undefined
                ? 0
                : ontology.children(term.id).filter((c) => c.kind === term.kind).length
            }
            showWeight={showWeight}
          />
        </li>
      ))}
    </ul>
  );
}
