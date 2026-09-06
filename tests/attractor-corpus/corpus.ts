/* ============================================================
   The corpus the round-trip gate runs over, and every loss it is
   allowed to have.

   Not a test file — see `round-trip.ts` on why nothing here is
   collected by the vitest glob.

   ── why the pipelines are in the repository ──
   The gate is the witness for doc 1 §0.1.1's compatibility claim,
   so it has to run on every machine, offline, at the same commit,
   with the same bytes. Fetching a pipeline over the network would
   make the claim depend on somebody else's uptime and would make a
   red mean two different things. `tests/server/t300/egress.test.ts`
   watches the whole suite for foreign traffic for the same reason.

   The twelve files are hand-authored against the constructs the
   Attractor spec gives a handler or a reserved attribute to. They
   are NOT transcriptions of the spec's own examples: this
   repository does not vendor that document, and a file claiming to
   be a quotation of a text nobody here can open would be worse than
   one that says what it is. `minimal.dot` takes the shape §2.13's
   minimal examples take — one start, one unit of work, one exit,
   which is what the `start_node`, `terminal_node` and
   `reachability` rules together require — and every other file is
   that file plus one construct.

   ── what a `losses` entry is, and what it is not ──
   It is a difference in the Attractor half that the two formats
   IMPOSE, written out with the value it carries and the reason it
   is not a defect. The gate compares the declared list against the
   measured one in BOTH directions, so a loss that stops happening
   reds just as loudly as one that starts. That is the whole
   difference between an exception and a waiver: this list cannot
   quietly grow to cover a regression, because every entry has to
   name the exact attribute and the exact value.

   An empty list is the ordinary case, and ten of the twelve files
   have one.
   ============================================================ */

import type { DeclaredLoss } from "./round-trip";

/** One pipeline, what it is here to exercise, and what it is allowed to lose. */
export interface CorpusEntry {
  /** Filename inside this directory. */
  file: string;
  /** The construct this file adds to `minimal.dot`. One line, for a failure message. */
  exercises: string;
  /**
   * Differences in the Attractor half this round trip is expected to have.
   *
   * `class` is deliberately absent from every entry: the emitter adds one to every carded
   * node and the gate proves the value is derived from the type that survived, which is a
   * stronger statement than an exception would be. See `CLASS_IS_DERIVED` in the suite.
   */
  losses: readonly DeclaredLoss[];
}

export const CORPUS: readonly CorpusEntry[] = [
  {
    file: "minimal.dot",
    exercises: "the smallest pipeline the format admits",
    losses: [
      {
        scope: "graph",
        at: "",
        attribute: "label",
        kind: "added",
        to: "minimal",
        why:
          "A DarkPrint blueprint has a title and this pipeline declared no graph `label`, so the " +
          "import falls back to the graph's own name and the export writes it out. The value is " +
          "the name that was already in the file, so nothing is invented — but a graph `label` " +
          "appears where there was none, and that is a difference a runner can see.",
      },
    ],
  },
  {
    file: "chained-edges.dot",
    exercises: "`a -> b -> c` in one statement, and a `node [...]` defaults block",
    losses: [],
  },
  {
    file: "conditional-routing.dot",
    exercises: "a `diamond` conditional and the guarded edges leaving it",
    losses: [],
  },
  {
    file: "weights.dot",
    exercises: "edge `weight` as a bare integer, a bare float and a quoted string",
    losses: [],
  },
  {
    file: "parallel-fan-out.dot",
    exercises: "`shape=component`, with the `join_policy` and `max_parallel` DarkPrint cannot set",
    losses: [],
  },
  {
    file: "parallel-fan-in.dot",
    exercises: "`shape=tripleoctagon`, the other half of a fan-out",
    losses: [],
  },
  {
    file: "supervisor-loop.dot",
    exercises: "`shape=house` and the four `manager.*` controls, around a cycle with no sink",
    losses: [
      {
        scope: "edge",
        at: "supervise -> <exit>",
        attribute: "condition",
        kind: "dropped",
        from: "outcome=success",
        why:
          "The boundary is synthesised on export and dropped on import, so an edge that touches " +
          "it is not carried in the topology at all — `entryTargets` and `exitSources` derive the " +
          "wiring from in-degree and out-degree on the next export. The edge therefore comes back, " +
          "and its attributes do not. That is a real loss and it is the price of `emit.ts`'s " +
          "'synthesise, do not re-shape' decision: a guard on the way out of a pipeline has " +
          "nowhere in a DarkPrint topology to live.",
      },
    ],
  },
  {
    file: "human-gates.dot",
    exercises: "both `hexagon` types, which Attractor cannot tell apart",
    losses: [],
  },
  {
    file: "subgraph-classes.dot",
    exercises: "§2.10's subgraph-derived classes, which do not survive flattening",
    losses: [],
  },
  {
    file: "no-prompt.dot",
    exercises: "a node with no `prompt`, which Attractor allows and a DarkPrint card cannot",
    losses: [
      {
        scope: "node",
        at: "sign_off",
        attribute: "label",
        kind: "changed",
        from: "Sign off",
        to: "sign_off",
        why:
          "The card written for this node has an empty `spec`, so it does not load, so the node " +
          "arrives at the emitter with no card at all. A node with no card is labelled with its " +
          "own id, because there is nothing else honest to put there.",
      },
      {
        scope: "node",
        at: "sign_off",
        attribute: "shape",
        kind: "changed",
        from: "hexagon",
        to: "box",
        why:
          "Same cause: no card, so no type, so the fallback shape. The node keeps its place in " +
          "the graph and loses the handler it selected, which is why the import reports the " +
          "missing `prompt` rather than leaving it to be discovered here.",
      },
    ],
  },
  {
    file: "escapes.dot",
    exercises: "Attractor's four String escapes, which DarkPrint's Graphviz lexer does not apply",
    losses: [],
  },
  {
    file: "runner-only.dot",
    exercises: "every reserved name a DarkPrint blueprint has no field for, plus the `type` override",
    losses: [],
  },
];
