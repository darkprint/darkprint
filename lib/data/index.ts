/* ============================================================
   DarkPrint data — the derived aggregates the marketing pages read
   The hand-written blueprint / part / ontology mocks are gone: every
   number below is counted off the real archive through `lib/content`,
   so the homepage cannot drift from what the engine actually resolved.

   SERVER ONLY — `@/lib/content` reaches the filesystem at build time.
   The two leaf modules beside this one, `./users` and `./community`,
   are plain data and stay importable from anywhere.
   ============================================================ */

import type { Blueprint } from "@/lib/types";
import { allBlueprints, allNodeCards, getOntologyView } from "@/lib/content";
import { AUTHOR_LIST, getAuthor } from "./users";

export { AUTHOR_LIST, getAuthor };

/** The two seed examples the note highlights, in archive order. */
export const SEED_BLUEPRINTS: Blueprint[] = allBlueprints().filter((b) => b.seed);

/** Curated picks for the gallery hero strip. */
export const FEATURED_BLUEPRINTS: Blueprint[] = allBlueprints().filter((b) => b.featured);

/**
 * The homepage counters. Every field counts a real thing:
 * blueprints resolved off disk, distinct node-card ids in the index, terms in the
 * core vocabulary, registered builders, and the downloads the index has recorded.
 */
export const PLATFORM_STATS = {
  blueprints: allBlueprints().length,
  nodes: allNodeCards().length,
  terms: getOntologyView().ontology.terms.length,
  builders: AUTHOR_LIST.length,
  downloads: allBlueprints().reduce((n, b) => n + b.downloads, 0),
};
