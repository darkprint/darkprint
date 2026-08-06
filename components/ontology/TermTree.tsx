/* ============================================================
   DarkPrint — the subsumption tree
   The same term rows as `TermTable`, arranged by `broader` instead
   of listed flat. Doc 1 §6.1 is the whole reason the vocabulary is
   worth having — `human-input` is a kind of `human-in-the-loop`,
   so the autonomy metric catches it without ever naming it (doc 3
   §3) — and a flat list is exactly the shape that hides that.

   ── One column, and why the nested lists carry no padding ──
   This drew a two-column grid of cards, subterms nested inside
   their parent card's border. The author: the elements "are not
   aligned and not structurally separated."

   Both halves are fixable at once, and the fix is a single
   constraint. Every row in this tree — root or leaf, depth 0 or
   depth 2 — lays out on `TermTable`'s shared column tracks, so
   descriptions share one left edge and weights share one right
   edge down the whole kind. That only survives nesting because the
   `<ul>`s below carry **no horizontal padding of their own**:
   depth is spent as padding *inside the first cell*, never on the
   row, so indenting a subterm cannot drag the later columns with
   it. Change that and the alignment goes, quietly.

   Separation is then proximity and a drawn rail rather than a
   border: root groups are parted by a hairline and a generous gap,
   subterms hang off a spine with an elbow. No bordered box inside
   a bordered box anywhere, which is what the cards had.

   Reading order matters as much as alignment here. A subsumption
   tree reads *down*; a two-column grid reads left, right, left,
   which is orthogonal to the relation being drawn, and no amount
   of styling inside a card repairs that.

   ── The lone root is drawn, not captioned ──
   The card version had a special case: a kind with a single root
   (`any`, `tool-capability`) put that root in a caption above the
   grid, because the alternative was one card holding an entire
   kind. A tree has no such problem, so the special case is gone
   and every kind is drawn as the forest it actually is. `any` is
   the top of the data-type lattice and now looks like it.

   A **forest, not a tree**. Ontology v0.1 draws exactly the edges
   doc 3 §3 and §4 draw and no more, so inventing a common root
   would assert a relation the contract does not.

   Server component. Takes the `OntologyView` itself rather than a
   pre-walked tree: the view is the only thing that knows the
   `broader` graph, and it is cycle-safe by construction.
   ============================================================ */

import type { OntologyTerm, OntologyView, TermKind } from "@/lib/core";
import { cx } from "@/lib/format";
import {
  TERM_INDENT_STEP_REM,
  TermColumnHeader,
  TermRow,
  markerWeight,
  termIndent,
} from "./TermTable";

/** One term plus everything narrower than it, already resolved. */
export interface Branch {
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
export function termForest(ontology: OntologyView, kind: TermKind): Branch[] {
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
  return termForest(ontology, kind).map((branch) => branch.term.id);
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

/* --------------------- the rail --------------------- */

/**
 * Where a subterm's rail is drawn, relative to its own `<li>`.
 *
 * `--term-indent` is where the first cell's text begins, so the vertical sits one rem
 * left of it and the elbow closes the gap but for a hair, which keeps the glyph off the
 * text. Both are `calc` against the same custom property the row pads itself with, so a
 * change to `TERM_INDENT_STEP_REM` moves the text and the rail together.
 */
const RAIL_X = `calc(var(--term-indent) - ${TERM_INDENT_STEP_REM - 0.5}rem)`;
const RAIL_ELBOW_W = `${TERM_INDENT_STEP_REM - 0.75}rem`;

/**
 * The vertical centre of a subterm's label: `TermRow` pins the name cell to a 20px line
 * box and pads the row by `py-2.5`, so the label's middle sits at 10 + 10 = 20px on every
 * row of every kind. The elbow meets the name there rather than at the row's own middle,
 * which drifts down as soon as a description wraps to a second line.
 *
 * This is arithmetic against two values in `TermTable`, not a number tuned by eye. If
 * either moves, this moves with it.
 */
const RAIL_ELBOW_Y_REM = 1.25;

/** The gap a separated subterm opens above itself, in the same rem the elbow counts in. */
const RAIL_SEPARATION_REM = 0.75;

/**
 * One level of hierarchy, drawn.
 *
 * The vertical runs the full height of its `<li>` — which includes that item's own
 * subtree, so the rail passes behind a nested group and reaches the next sibling — and
 * stops at the elbow on the last child, which is what closes a group visually. Decoration
 * for a relation the nesting already carries, so it is hidden from assistive technology.
 *
 * `offset` is the item's own top padding. Both marks are positioned from the top of the
 * `<li>`, so an item that opens a gap above itself has to push the elbow down by exactly
 * that gap or it lands above the label it is supposed to point at.
 */
function Rail({ last, offset }: { last: boolean; offset: number }) {
  const elbowY = `${RAIL_ELBOW_Y_REM + offset}rem`;
  return (
    <span aria-hidden>
      <span
        className="absolute w-px bg-line-bright"
        style={{ left: RAIL_X, top: 0, height: last ? elbowY : "100%" }}
      />
      <span
        className="absolute h-px bg-line-bright"
        style={{ left: RAIL_X, top: elbowY, width: RAIL_ELBOW_W }}
      />
    </span>
  );
}

/* --------------------- the branches --------------------- */

function BranchItem({
  branch,
  depth,
  last,
  separated,
  showWeight,
}: {
  branch: Branch;
  depth: number;
  last: boolean;
  /** Open a gap above this item: it starts a new group rather than continuing a run. */
  separated: boolean;
  showWeight: boolean;
}) {
  const root = depth === 0;
  return (
    <li
      className={cx(
        "relative",
        // A rule between root groups, space alone between deeper ones. A hairline at
        // depth would cut the rail it sits beside, and severing the line that says
        // "these hang off the same parent" costs more than the separation buys.
        separated && (root ? "mt-4 border-t border-line pt-4" : "pt-3"),
      )}
      style={{ "--term-indent": termIndent(depth) } as React.CSSProperties}
    >
      {depth > 0 && (
        <Rail last={last} offset={separated ? RAIL_SEPARATION_REM : 0} />
      )}
      <TermRow term={branch.term} showWeight={showWeight} root={root} />
      {branch.children.length > 0 && (
        <BranchList branches={branch.children} depth={depth + 1} showWeight={showWeight} />
      )}
    </li>
  );
}

/**
 * One rank of siblings.
 *
 * No padding, margin or `gap` on the list itself: see this file's header. Every unit of
 * horizontal space here would come off the description column of every row below it.
 */
function BranchList({
  branches,
  depth,
  showWeight,
}: {
  branches: readonly Branch[];
  depth: number;
  showWeight: boolean;
}) {
  const ordered = showWeight ? [...branches].sort(byWeight) : branches;
  return (
    <ul>
      {ordered.map((branch, i) => (
        <BranchItem
          key={branch.term.id}
          branch={branch}
          depth={depth}
          last={i === ordered.length - 1}
          // Roots are always their own group. Deeper down, a run of leaves is one list
          // and wants no gaps inside it, but an item that carries a subtree — or follows
          // one — is a group boundary and gets air.
          separated={
            i > 0 &&
            (depth === 0 ||
              branch.children.length > 0 ||
              (ordered[i - 1]?.children.length ?? 0) > 0)
          }
          showWeight={showWeight}
        />
      ))}
    </ul>
  );
}

/**
 * Every term of one kind, arranged under the term it specialises.
 *
 * No width of its own, and the reason is worth writing down because it used to have one.
 * This carried `max-w-4xl` with a comment about reading measure. The measure was real;
 * the place was not. Capping the *tree* to protect the *description column* left the tree
 * ending 235px inside its own panel border, so the panel border, the section header rule,
 * the grid and the prose were four different right edges in one box. The measure now sits
 * on the description paragraph in `TermRow`, where a measure belongs, and the tree fills
 * whatever column it is mounted in.
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
  const branches = termForest(ontology, kind);
  if (branches.length === 0) {
    return <p className="text-sm text-dim">This vocabulary declares no terms of that kind.</p>;
  }

  return (
    <div className={className}>
      <TermColumnHeader showWeight={showWeight} />
      <BranchList branches={branches} depth={0} showWeight={showWeight} />
    </div>
  );
}
