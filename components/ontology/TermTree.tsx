/* ============================================================
   DarkPrint — the subsumption tree
   The same term rows as `TermTable`, arranged by `broader` instead
   of listed flat. Doc 1 §6.1 is the whole reason the vocabulary is
   worth having — `human-input` is a kind of `human-in-the-loop`,
   so the autonomy metric catches it without ever naming it (doc 3
   §3) — and a flat list is exactly the shape that hides that.

   ── The grouping rule ──
   The four kinds this draws have four different shapes, and one
   rule covers all of them: **a lone root becomes the caption and
   its children become the grid; several roots are the grid.**

     node-type    4 roots, 2 with children  → 4 cards
     risk-marker  6 roots, 2 with children  → 6 cards
     data-type    1 root (`any`), 4 groups  → caption + 4 cards
     tool         1 root, 11 flat children  → caption + 11 cards

   Without it, `any` and `tool-capability` would each be a single
   card holding the entire kind, which is the flat stack the author
   asked off the page wearing a border.

   A **forest, not a tree**. Ontology v0.1 draws exactly the edges
   doc 3 §3 and §4 draw and no more, so inventing a common root
   would assert a relation the contract does not.

   Server component. Takes the `OntologyView` itself rather than a
   pre-walked tree: the view is the only thing that knows the
   `broader` graph, and it is cycle-safe by construction.
   ============================================================ */

import Link from "next/link";

import type { OntologyTerm, OntologyView, TermKind } from "@/lib/core";
import { cx } from "@/lib/format";
import { termHref } from "@/lib/href";
import { TermCard, WeightChip, markerWeight } from "./TermTable";

/** One term plus everything narrower than it, already resolved. */
interface Branch {
  term: OntologyTerm;
  children: Branch[];
}

/**
 * The `broader` forest for one kind.
 *
 * A term is a root when it declares no parent, or when its parent is missing or of
 * another kind — a dangling `broader` is an error the ontology's own `validate()`
 * reports, and hiding the term entirely would be a worse way to find out.
 *
 * `seen` is the cycle guard. A `broader` loop is structurally invalid, but a local
 * namespaced extension can introduce one and a page must not hang because of it.
 * Children are sorted by id, the same locale-independent order `byKind` uses.
 */
function forest(ontology: OntologyView, kind: TermKind): Branch[] {
  const terms = ontology.byKind(kind);
  const seen = new Set<string>();

  function branch(term: OntologyTerm): Branch {
    seen.add(term.id);
    const children = ontology
      .children(term.id)
      .filter((child) => child.kind === kind && !seen.has(child.id))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(branch);
    return { term, children };
  }

  return terms
    .filter((term) => {
      if (term.broader === undefined) return true;
      const parent = ontology.get(term.broader);
      return parent === undefined || parent.kind !== kind;
    })
    .map(branch);
}

/**
 * The ids of one kind's roots, in the order the tree draws them.
 *
 * Exported so the copy beside a tree can say how many roots there are without
 * re-deriving "what is a root" and getting a different answer from the picture.
 */
export function termRootIds(ontology: OntologyView, kind: TermKind): string[] {
  return forest(ontology, kind).map((branch) => branch.term.id);
}

/**
 * A subterm, drawn inside its parent's card.
 *
 * Deliberately quieter than the card's own heading and set behind a rule: the eye should
 * read the group first and the members second. Deeper levels recurse, so a three-level
 * kind indents twice rather than flattening.
 */
function SubTerm({
  branch,
  showWeight,
}: {
  branch: Branch;
  showWeight: boolean;
}) {
  const weight = showWeight ? markerWeight(branch.term) : undefined;
  return (
    <li className="flex flex-col gap-1 border-l border-line-bright pl-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Link
          href={termHref(branch.term.id)}
          className="font-display text-sm font-semibold leading-snug text-fg transition-colors hover:text-cyan"
        >
          {branch.term.label}
        </Link>
        <code className="font-mono text-[11px] text-dim">{branch.term.id}</code>
        {weight !== undefined && (
          <span className="ml-auto">
            <WeightChip weight={weight} />
          </span>
        )}
      </div>
      <p className="text-[13px] leading-snug text-muted">{branch.term.description}</p>
      {branch.children.length > 0 && (
        <SubTermList branches={branch.children} showWeight={showWeight} />
      )}
    </li>
  );
}

function SubTermList({
  branches,
  showWeight,
}: {
  branches: readonly Branch[];
  showWeight: boolean;
}) {
  const ordered = showWeight ? [...branches].sort(byWeight) : branches;
  return (
    <ul className="mt-2 flex flex-col gap-2.5 border-t border-line pt-3 first:mt-0">
      {ordered.map((child) => (
        <SubTerm key={child.term.id} branch={child} showWeight={showWeight} />
      ))}
    </ul>
  );
}

/**
 * The heaviest weight anywhere in a branch, for ordering risk markers.
 *
 * A category carries no weight of its own (`execution-risk` and `isolation-breach` are
 * the two), so ordering it by its own price would sink it below every marker it contains.
 * It is ranked by its heaviest member instead.
 */
function branchWeight(branch: Branch): number {
  return Math.max(
    markerWeight(branch.term) ?? 0,
    ...branch.children.map(branchWeight),
    0,
  );
}

/**
 * Heaviest first, then by id.
 *
 * The flat list this replaced was ordered that way and the affordance is worth keeping:
 * grouping answers "what kind of risk is this", weight answers "which ones matter", and a
 * reader wants both at once.
 */
function byWeight(a: Branch, b: Branch): number {
  const diff = branchWeight(b) - branchWeight(a);
  if (diff !== 0) return diff;
  return a.term.id < b.term.id ? -1 : a.term.id > b.term.id ? 1 : 0;
}

/** One card per branch, in a grid. */
function Cards({
  branches,
  showWeight,
}: {
  branches: readonly Branch[];
  showWeight: boolean;
}) {
  const ordered = showWeight ? [...branches].sort(byWeight) : branches;
  return (
    <ul className="grid items-start gap-3 sm:grid-cols-2">
      {ordered.map((branch) => (
        <TermCard
          key={branch.term.id}
          term={branch.term}
          showWeight={showWeight}
          subterms={
            branch.children.length > 0 ? (
              <SubTermList branches={branch.children} showWeight={showWeight} />
            ) : undefined
          }
        />
      ))}
    </ul>
  );
}

/**
 * Every term of one kind, grouped under the term it specialises.
 *
 * See the grouping rule in this file's header: a kind with one root puts that root in a
 * caption above the grid instead of wrapping the whole vocabulary in a single card.
 */
export function TermTree({
  kind,
  ontology,
  showWeight = false,
  className,
}: {
  kind: TermKind;
  ontology: OntologyView;
  /** Show the doc 3 §5 weight on each term. Only risk markers carry one. */
  showWeight?: boolean;
  className?: string;
}) {
  const branches = forest(ontology, kind);
  if (branches.length === 0) {
    return <p className="text-sm text-dim">This vocabulary declares no terms of that kind.</p>;
  }

  const sole = branches.length === 1 ? branches[0] : undefined;
  if (sole !== undefined && sole.children.length > 0) {
    return (
      <div className={cx("flex flex-col gap-3", className)}>
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm leading-relaxed text-muted">
          <Link
            href={termHref(sole.term.id)}
            className="font-display text-[15px] font-semibold text-fg transition-colors hover:text-cyan"
          >
            {sole.term.label}
          </Link>
          <code className="font-mono text-[11px] text-dim">{sole.term.id}</code>
          <span className="w-full sm:w-auto">{sole.term.description}</span>
        </p>
        <Cards branches={sole.children} showWeight={showWeight} />
      </div>
    );
  }

  return (
    <div className={className}>
      <Cards branches={branches} showWeight={showWeight} />
    </div>
  );
}
