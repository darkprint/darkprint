/* ============================================================
   DarkPrint — the subsumption tree
   The same term rows as `TermTable`, arranged by `broader` instead
   of listed flat. Doc 1 §6.1 is the whole reason the vocabulary is
   worth having — `human-input` is a kind of `human-in-the-loop`,
   so the autonomy metric catches it without ever naming it (doc 3
   §3) — and a flat list is exactly the shape that hides that.

   A **forest, not a tree**. Ontology v0.1 draws exactly the edges
   doc 3 §3 and §4 draw and no more, so `node-type` has four roots
   (`agent`, `tool`, and the two abstract categories) and
   `risk-marker` has six. Inventing a common root would assert a
   relation the contract does not, so every kind is rendered as
   however many roots it actually has.

   Server component. Takes the `OntologyView` itself rather than a
   pre-walked tree: the view is the only thing that knows the
   `broader` graph, and it is cycle-safe by construction.
   ============================================================ */

import type { OntologyTerm, OntologyView, TermKind } from "@/lib/core";
import { cx } from "@/lib/format";
import { NO_USAGE, TermRow, type TermUsage } from "./TermTable";

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

/** One level of the tree. The nesting is the hierarchy — no ARIA needed on top of it. */
function Level({
  branches,
  usage,
  showWeight,
  depth,
}: {
  branches: readonly Branch[];
  usage: ReadonlyMap<string, TermUsage>;
  showWeight: boolean;
  depth: number;
}) {
  return (
    <ul
      className={cx(
        "flex flex-col gap-4",
        depth > 0 && "mt-4 ml-1 border-l border-line pl-4 sm:ml-2 sm:pl-5",
      )}
    >
      {branches.map((node) => (
        <li key={node.term.id}>
          <TermRow
            term={node.term}
            usage={usage.get(node.term.id) ?? NO_USAGE}
            // A branch with children and no cards of its own is an abstract category, not
            // an unused term: doc 3 §3's `human-in-the-loop` is never written on a card,
            // and being asked about rather than declared is its whole job.
            narrower={node.children.length}
            showWeight={showWeight}
          />
          {node.children.length > 0 && (
            <Level
              branches={node.children}
              usage={usage}
              showWeight={showWeight}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Every term of one kind, indented under the term it specialises. Indentation is
 * the only thing carrying the relation, so the section that renders this owes the
 * reader one line saying so — including how many roots there are, since v0.1 gives
 * most kinds several.
 */
export function TermTree({
  kind,
  ontology,
  usage,
  showWeight = false,
  className,
}: {
  kind: TermKind;
  ontology: OntologyView;
  usage: ReadonlyMap<string, TermUsage>;
  /** Show the doc 3 §5 weight on each row. Only risk markers carry one. */
  showWeight?: boolean;
  className?: string;
}) {
  const branches = forest(ontology, kind);
  if (branches.length === 0) {
    return <p className="text-sm text-dim">This vocabulary declares no terms of that kind.</p>;
  }
  return (
    <div className={className}>
      <Level branches={branches} usage={usage} showWeight={showWeight} depth={0} />
    </div>
  );
}
