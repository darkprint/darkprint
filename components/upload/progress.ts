/* ============================================================
   Half-written is not broken.
   ------------------------------------------------------------
   The wizard had two readings of a bundle: it resolves, or it was
   rejected. That was the right pair while the only person dropping
   a folder here was somebody with a finished blueprint in hand —
   an archive download, or an export from `/build`.

   The DarkPrint skill changes who arrives. It writes the registry
   shape into a working directory a node at a time, so the normal
   visitor now has a `blueprint.dot` with eight nodes in it and
   three cards written. `resolveBundle` reports each of the other
   five as `bundle/missing-card`, which is an ERROR — correctly, the
   reference does not resolve — and every surface downstream then
   said "bundle rejected", "No schematic and no scores" and "blocked
   by 5 errors" at an author who was simply not finished. Doc 2 §1.1
   is about exactly this reading: the site must never make somebody
   feel penalised for the state their graph is honestly in.

   Nothing here softens what the engine found. The severities are
   the engine's and they are printed unchanged; the diagnostics list
   still names all five. What this adds is the one distinction the
   copy needs and the diagnostic list cannot make on its own —
   whether EVERY error is "this node has no card yet", which is the
   shape of an unfinished folder, or whether something in the bundle
   is actually wrong.

   ── Why this is a module and not a `useMemo` in the report ──
   Four surfaces read it: the verdict strip and the withheld-score
   panel in `ValidationReport.tsx`, and the publish note and the
   step counter in `UploadFlow.tsx`. Two of them are in a different
   file from the other two, and a predicate spelled twice is a
   predicate that disagrees with itself on the day one copy is
   edited. It is plain TypeScript with no React in it so
   `progress.test.ts` can hold it over real bundles.
   ============================================================ */

import { hasErrors, type Diagnostic, type LoadBundleResult, type ResolvedBlueprint } from "@/lib/core";

/**
 * The two resolution errors that mean "not written yet" rather than "wrong".
 *
 * Both are raised per DOT node statement and both say the same thing about the author's
 * state: the graph names a node, and the card behind it is not in the folder — either
 * because no file carries that ref (`bundle/missing-card`) or because the pointer is not
 * yet a pinned `id@version` (`bundle/unpinned-card`). Everything else `resolveBundle`
 * raises is a contradiction between two things the author *did* write: a port that does
 * not exist, a type that cannot flow, a digest that does not match, a prohibition the
 * graph breaks. Those are defects at any stage of writing and are framed as defects.
 *
 * `lib/core/bundle/resolve.ts` emits at most one of these per node — `referenceFor`
 * returns after pushing one, and the entry lookup pushes one — which is what makes the
 * count below a count of nodes rather than a count of complaints.
 */
const AWAITING_CARD: ReadonlySet<string> = new Set([
  "bundle/missing-card",
  "bundle/unpinned-card",
]);

/**
 * Whether an error is the *shadow* of a card that is not written yet, rather than a fact
 * about the bundle in its own right.
 *
 * There is exactly one such code and finding it cost a test. `bundle/missing-dependency`
 * fires on a card that IS in the folder: it declares `dependencies: [spec-planner]`, and
 * the resolver looks for an incoming edge from a node holding that card. When the
 * predecessor's own card has not been written, that predecessor is deliberately left out
 * of the supply list (`resolve.ts` skips it so one broken pointer is not reported twice)
 * — so the dependency reads as unmet purely because the file on the other end of the edge
 * does not exist yet. Truncate a real archive bundle to two of its five cards and two of
 * the five errors are these.
 *
 * Decided from the graph rather than from the message. The diagnostic carries
 * `location.nodeId` — the dependent node — so the question "could an unwritten card have
 * caused this?" is answered by asking whether that node has a predecessor with no card.
 * A bundle where every node has its card can never take this branch, which is what keeps
 * a genuine unmet dependency an error in a finished blueprint.
 */
function shadowsAnUnwrittenCard(
  diagnostic: Diagnostic,
  blueprint: ResolvedBlueprint,
  carded: ReadonlySet<string>,
): boolean {
  if (diagnostic.code !== "bundle/missing-dependency") return false;
  const nodeId = diagnostic.location?.nodeId;
  if (nodeId === undefined) return false;
  return blueprint.graph.predecessors(nodeId).some((id) => !carded.has(id));
}

/** Which of three states a dropped bundle is in, and how far the graph got. */
export interface BundleProgress {
  /**
   * `resolves` — every reference checked, both computed readings available.
   * `unfinished` — the topology parsed, at least one node has no card yet, and every
   *   error is either that fact or a direct consequence of it. Work in progress, and the
   *   page says so in those words.
   * `rejected` — the DOT did not parse, or something the author wrote contradicts
   *   something else they wrote.
   */
  state: "resolves" | "unfinished" | "rejected";
  /** DOT nodes joined to a card in this bundle. */
  placed: number;
  /**
   * Nodes the topology declares, card or no card.
   *
   * `graph.ids`, not `nodes`: resolution degrades, so `blueprint.nodes` holds only the
   * ones that resolved while the graph keeps every id the DOT wrote. The difference
   * between the two numbers is the whole point of this module.
   */
  total: number;
  /** `total - placed`. The nodes an author still has cards to write for. */
  waiting: number;
}

/**
 * Read the state of a dropped bundle off what the engine returned.
 *
 * `resolves` mirrors `ValidationReport`'s own `usable` exactly — blueprint, analysis and
 * no error — because the two must never disagree about whether a score is shown.
 */
export function bundleProgress(result: LoadBundleResult): BundleProgress {
  const { blueprint, analysis } = result;
  const total = blueprint?.graph.ids.length ?? 0;
  const placed = blueprint?.nodes.length ?? 0;
  const waiting = total - placed;

  if (blueprint !== undefined && analysis !== undefined && !hasErrors(result.diagnostics)) {
    return { state: "resolves", placed, total, waiting };
  }

  const errors = result.diagnostics.filter((d) => d.severity === "error");
  const carded = new Set(blueprint?.nodes.map((node) => node.nodeId) ?? []);
  const unfinished =
    blueprint !== undefined &&
    waiting > 0 &&
    errors.length > 0 &&
    errors.every(
      (d) => AWAITING_CARD.has(d.code) || shadowsAnUnwrittenCard(d, blueprint, carded),
    );

  return { state: unfinished ? "unfinished" : "rejected", placed, total, waiting };
}
