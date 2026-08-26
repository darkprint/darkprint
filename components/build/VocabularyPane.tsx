"use client";

import Link from "next/link";

import type { NodeCard, OntologyView } from "@/lib/core";
import { termHref } from "@/lib/href";
import { cx } from "@/lib/format";

/* ============================================================
   The third component, which this page did not have.

   ── What was wrong ──
   `/what-a-blueprint-is` is the first item in the Learn menu and
   it teaches three parts: a graph, a card for every node, and one
   vocabulary both are written against. `/build` is the second
   item, and it showed **two** of them across four panes named by
   file format: a drawing, a card skeleton, a DOT listing and a
   card listing. The vocabulary, the part that makes a word in the
   DOT mean the same thing as that word in a card, was nowhere on
   the page whose subject is assembling those files.

   So a reader arriving from the page that said "three things"
   found four numbered panes, none of them called any of the
   three, and no way to see the third at all.

   ── What this draws ──
   Every ontology term the reader's own bundle currently uses,
   grouped by kind, against how many that kind holds. Read off the
   resolved cards rather than listed here, so a choice that adds a
   risk marker or changes a port type redraws it, which is the
   point: the vocabulary is not a static appendix, it is the set
   of words this blueprint has committed to.

   Every term links to `/ontology/<id>`, because the count answers
   "how many" and the term page answers "what does it mean".

   ── Why counts and not a list of everything ──
   A pane printing every term the vocabulary holds would be a copy
   of `/ontology`, which is a route away and better at it. What
   this pane knows and that page cannot is which of those terms
   *this* blueprint spends, and `n of m` is the fact a reader is
   actually after: five phases of five is complete lifecycle
   coverage, and a risk marker used is a blast radius priced.

   No total is written down here. `architecture/ontology.md`
   records that a written count goes stale the moment content
   lands, so every one of them is `view.byKind(kind).length`.
   ============================================================ */

/** The kinds a card can spend, in the order a reader meets them. */
const KINDS = [
  {
    kind: "phase" as const,
    label: "phase",
    note: "Which part of the lifecycle each node covers.",
  },
  {
    kind: "node-type" as const,
    label: "node type",
    note: "What kind of thing each node is.",
  },
  {
    kind: "data-type" as const,
    label: "data type",
    note: "What travels on the edges, and what a prohibition names.",
  },
  {
    kind: "risk-marker" as const,
    label: "risk marker",
    note: "What each node could break. Priced against security.",
  },
];

/** Term id to the node ids that spend it, in graph order, deduplicated. */
function spendersByTerm(
  nodes: readonly { nodeId: string; card: NodeCard }[],
  kind: string,
  view: OntologyView,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, nodeId: string) => {
    const term = view.get(id);
    if (term === undefined || term.kind !== kind) return;
    const seen = out.get(id);
    if (seen === undefined) out.set(id, [nodeId]);
    else if (!seen.includes(nodeId)) seen.push(nodeId);
  };
  for (const { nodeId, card } of nodes) {
    for (const p of card.phases) add(p, nodeId);
    add(card.type, nodeId);
    for (const port of [...card.inputs, ...card.outputs]) add(port.type, nodeId);
    /* A `cannot` entry naming a data type is a term the bundle spends: the resolver
       enforces it against every incoming edge. An entry naming anything else is a sentence
       and `view.get` returns nothing for it, which is the filter above. */
    for (const c of card.cannot) add(c, nodeId);
    for (const m of card.riskMarkers) add(m, nodeId);
  }
  return out;
}

export function VocabularyPane({
  nodes,
  view,
  version,
  selectedNodeId,
  className,
}: {
  nodes: readonly { nodeId: string; card: NodeCard }[];
  view: OntologyView;
  version: string;
  /** The pane selection, so a term used by the selected node is marked like every pane. */
  selectedNodeId?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] leading-relaxed text-muted">
          The terms your files are written against. Both the DOT and the cards resolve
          against this list, so the same word means the same thing in each.
        </p>
        <span className="shrink-0 font-mono text-[11px] text-dim">ontology {version}</span>
      </div>

      <dl className="flex flex-col">
        {KINDS.map(({ kind, label, note }) => {
          const spent = spendersByTerm(nodes, kind, view);
          const total = view.byKind(kind).length;
          const ids = [...spent.keys()].sort();
          return (
            <div key={kind} className="border-t border-line/70 py-3 first:border-t-0 first:pt-0">
              <dt className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[12px] text-cyan">{label}</span>
                <span className="font-mono text-[11px] tabular-nums text-dim">
                  {ids.length} of {total} used
                </span>
                <span className="text-[12px] leading-relaxed text-dim">{note}</span>
              </dt>
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {ids.length === 0 ? (
                  /* An empty kind is an answer, not a gap. The starter declares no risk
                     markers until a choice adds one, and a pane that drew a blank there
                     would read as something failing to load. */
                  <span className="font-mono text-[11px] text-dim">
                    none, so this blueprint spends no {label}
                  </span>
                ) : (
                  ids.map((id) => {
                    const spenders = spent.get(id) ?? [];
                    const onSelected =
                      selectedNodeId !== undefined && spenders.includes(selectedNodeId);
                    return (
                      <span
                        key={id}
                        className={cx(
                          "inline-flex items-baseline gap-1.5 rounded border px-2 py-1 font-mono text-[11px] transition-colors",
                          onSelected
                            ? "border-cyan/50 bg-cyan/10 text-fg"
                            : "border-line bg-surface-2 text-muted",
                        )}
                      >
                        <Link
                          href={termHref(id)}
                          className="underline decoration-line underline-offset-4 hover:text-cyan"
                        >
                          {id}
                        </Link>
                        {/* How many nodes spend it, which is the fact that makes this a
                            drawing of *this* blueprint rather than a copy of `/ontology`.

                            Plain text, not a control. The first draft made it a button
                            that moved the selection to the first spender, and a bare
                            numeral with no affordance, sitting inside a chip whose other
                            half is a link, is a worse offer than none: a reader either
                            never finds it or clicks the link by accident reaching for it.
                            The `title` says what the number counts, which is the part
                            that was genuinely unclear. */}
                        <span
                          className="tabular-nums text-dim"
                          title={`${spenders.length} ${spenders.length === 1 ? "node" : "nodes"}: ${spenders.join(", ")}`}
                        >
                          {spenders.length}
                        </span>
                      </span>
                    );
                  })
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
