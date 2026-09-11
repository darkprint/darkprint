/* ============================================================
   The criteria-leak demonstration, as data

   Written for `/what-it-isnt`, which drew the clean and leaked
   graphs side by side. That route is gone; `/spec/card` and
   `components/panes/absences.ts` still read this module, so it
   survives as the site's one derivation of the leak rather than as
   one page's helper.

   Doc 2 §3's claim is that isolation is a property of the
   topology. A claim about topology can be checked on a topology,
   so nothing here describes what the analyzer would say: it runs
   the analyzer on two bundles and quotes it.

   Bundle one is `starter-software-factory` exactly as the archive
   ships it. Bundle two is the same manifest and the same five
   cards with **one line added to the DOT**, assembled here at
   build time and put through `loadBundle`. It is never written to
   `content/`, never indexed, and has no page of its own — it
   exists for the length of a build so that the number on the page
   is the engine's number.

   SERVER ONLY, BUILD TIME ONLY, like everything that reaches into
   `lib/content`. Nothing here touches the filesystem: the DOT and
   the card documents come back from `bundleSource`, which is the
   loader's published surface, so this module adds no second reader
   of the archive.
   ============================================================ */

import type { Blueprint, BlueprintGraph } from "@/lib/types";
import type { Bundle, Diagnostic, SecurityResult } from "@/lib/core";
import { loadBundle } from "@/lib/core";
import {
  bundleSource,
  getBlueprintBySlug,
  getOntologyView,
  getRegistry,
} from "@/lib/content";
import { graphForBlueprint } from "@/lib/graph-seed";

/** The blueprint doc 2 §5.2 builds `/build`'s starter on, and the one this page reads. */
export const STARTER_SLUG = "starter-software-factory";

/**
 * The edge the starter does not have, and the whole lesson of the bundle.
 *
 * The planner's `criteria` port reaches the tester and nothing else. Doc 3 §4.1 reads
 * `criteria-leak` at node level rather than per port — any edge at all from the criteria
 * producer into a node whose work is judged establishes it — so this is the edge, whatever
 * it is labelled.
 *
 * Two checks answer for it, and the page quotes both. The builder's card declares
 * `cannot: [acceptance-criteria]`, so the edge is a `bundle/prohibition-violated` error
 * and the bundle is refused; and the security metric, run anyway, charges `criteria-leak`
 * against the same node. The first is a rule the card's author wrote and the engine
 * enforces, the second is what the analyzer reads off a topology nobody declared anything
 * about.
 */
export const ABSENT_EDGE = {
  source: "planner",
  target: "builder",
  label: "acceptance criteria",
} as const;

/** The one line added to the DOT, quoted on the page exactly as it is inserted. */
export const ADDED_DOT_LINE = `${ABSENT_EDGE.source} -> ${ABSENT_EDGE.target} [label="${ABSENT_EDGE.label}"];`;

/** One scored graph: what to draw, what it scored, and everything the engine said. */
export interface ScoredGraph {
  graph: BlueprintGraph;
  security: SecurityResult;
  diagnostics: readonly Diagnostic[];
}

/**
 * The error-severity half of what the engine said about a graph.
 *
 * Exists because the leaked variant stopped being a graph that merely scores badly.
 * `code-builder@1.0.0` declares `cannot: [acceptance-criteria]`, the added edge carries
 * that type, and `bundle/prohibition-violated` is an error: the bundle does not resolve.
 * `loadBundle` still returns an analysis, because doc 1 §2 resolves as far as it can and a
 * partial score with the missing pieces named is more use than nothing — but every other
 * surface on this site treats an error as the end of the matter. `/upload` refuses to put
 * a number on it, `lib/content/read.ts` throws on it, and the node page tells the reader
 * in as many words that an edge violating a prohibition means the bundle does not resolve.
 * A page arguing that isolation is checkable cannot be the one place that computes the
 * check and prints the score instead.
 */
export function errorsOf(scored: ScoredGraph): readonly Diagnostic[] {
  return scored.diagnostics.filter((d) => d.severity === "error");
}

export interface IsolationDemo {
  /** The bundle as the archive ships it. */
  published: Blueprint;
  /** The same bundle with `planner -> builder` added. Not in the archive. */
  leaked: ScoredGraph;
}

/* --------------------- one derivation, memoized --------------------- */

let cache: IsolationDemo | null | undefined;

/**
 * The two bundles, or `undefined` if the archive cannot supply the first one.
 *
 * Deliberately total. This page argues from a specific blueprint, and if that blueprint
 * ever leaves `content/` the honest outcome is a page that drops the figure rather than a
 * build that dies inside a React component, or worse, prose asserting a number nothing
 * computed.
 */
export function isolationDemo(): IsolationDemo | undefined {
  if (cache === undefined) cache = build() ?? null;
  return cache ?? undefined;
}

function build(): IsolationDemo | undefined {
  const published = getBlueprintBySlug(STARTER_SLUG);
  const record = getRegistry().blueprint(STARTER_SLUG);
  if (published === undefined || record === undefined) return undefined;

  const source = bundleSource(STARTER_SLUG);

  // `bundleSource` reports each card by the path an editor can open
  // (`content/cards/<ref>.yaml`); a `Bundle` is keyed by the bundle-relative name the
  // engine reports diagnostics against (`cards/<ref>.yaml`). If that ever stops holding,
  // the resolver would raise `bundle/missing-card` on all five nodes and score a graph
  // with no cards in it — which would still produce a number, and the number would be a
  // lie. So the rewrite is checked rather than assumed.
  const cardFiles: Record<string, string> = {};
  for (const card of source.cards) {
    const name = card.file.replace(/^content\//, "");
    if (!name.startsWith("cards/")) return undefined;
    cardFiles[name] = card.text;
  }
  if (Object.keys(cardFiles).length === 0) return undefined;

  // Inserted before the closing brace rather than spliced next to a sibling edge: the
  // position of an edge statement in a DOT file means nothing to the parser, and matching
  // on a neighbouring line would tie this page to that file's whitespace.
  const close = source.dot.lastIndexOf("}");
  if (close < 0) return undefined;
  const dot = `${source.dot.slice(0, close)}  ${ADDED_DOT_LINE}\n${source.dot.slice(close)}`;

  const bundle: Bundle = { manifest: record.manifest, dot, cardFiles };
  // The same vocabulary the archive was resolved against (doc 3 §8), so the two readings
  // this derivation produces are comparable with each other. The clause that had them
  // comparable with the blueprint page's too came out on 2026-09-05: that page prints no
  // reading now, so there is nothing there left to compare against.
  const result = loadBundle(bundle, { ontology: getOntologyView() });
  if (result.blueprint === undefined || result.analysis === undefined) return undefined;

  return {
    published,
    leaked: {
      graph: graphForBlueprint(result.blueprint),
      security: result.analysis.security,
      diagnostics: result.diagnostics,
    },
  };
}
