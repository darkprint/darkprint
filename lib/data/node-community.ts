/* ============================================================
   DarkPrint — per-card download counts, the node-card half of §5
   `lib/data/community.ts` is the blueprint half of the mutable index:
   downloads, votes, comments, keyed by slug. A node card has no row
   there — only a blueprint does — so a card page had no download
   figure to show at all. This module is the smallest addition that
   fits the same pattern for the other kind of thing the archive
   serves: one number, keyed by card id, seeded exactly like every
   other count on this site before there is a real backend behind it.
   ============================================================ */

/**
 * Downloads per node card, keyed by the card's own id — the same id
 * `nodeHref`/`record.ref` (before the `@version`) already use, e.g.
 * `pr-intake`. Covers every card in `content/cards/`.
 *
 * Seeded, same as `lib/data/community.ts`'s own figures: nobody has
 * downloaded a card through a counter that exists, so these are rows
 * in a table, not a tally. An id with no row here reads as a card
 * nobody has downloaded yet, which `downloadsFor` returns as `0`.
 */
export const NODE_DOWNLOADS: Record<string, number> = {
  "acceptance-tester": 137,
  "acceptance-verifier": 1319,
  "assemble-stage": 389,
  "blast-radius-check": 96,
  "bounded-retry": 199,
  "claim-verifier": 503,
  "code-builder": 759,
  "code-index-search": 1553,
  "confidence-escalation": 296,
  "conservative-solver": 190,
  "dataset-publisher": 689,
  "delta-extractor": 256,
  "delta-intake": 849,
  "diff-triager": 2100,
  "document-intake": 2381,
  "episodic-memory": 178,
  "event-intake": 196,
  "evidence-synthesizer": 1187,
  "exploratory-solver": 222,
  "field-extractor": 1758,
  "field-normalizer": 1192,
  "ingest-stage": 167,
  "intent-router": 2005,
  "job-intake": 365,
  "kb-resolver": 1141,
  "maintainer-approval": 285,
  "merge-executor": 370,
  "pr-intake": 335,
  "question-intake": 1910,
  "record-repairer": 1976,
  "record-store": 738,
  "release-gate": 1466,
  "reply-dispatch": 332,
  "reply-qa-check": 1555,
  "report-delivery": 910,
  "resolution-composer": 2817,
  "result-delivery": 947,
  "retrieval-planner": 998,
  "review-drafter": 414,
  "runbook-executor": 913,
  "runbook-resolver": 1631,
  "schema-gate": 2122,
  "spec-planner": 339,
  "stage-planner": 1561,
  "targeted-debugger": 300,
  "task-decomposer": 319,
  "task-intake": 237,
  "test-runner": 1250,
  "transform-stage": 1183,
  "vector-recall": 2846,
  "warehouse-publisher": 3061,
  "web-retriever": 3108,
  "weighted-vote": 1030,
};

/** The download count for a card id, or `0` — a card nobody has a row for yet. */
export function downloadsFor(id: string): number {
  return NODE_DOWNLOADS[id] ?? 0;
}
