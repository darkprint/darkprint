/* ============================================================
   DarkPrint backend — seed: the import plan
   T250 AC1. `planImport` is pure over the content tree and takes
   no `Db`, so "each of the nine bundles hashes to the digest the
   site prints today" is answerable before anything is written and
   without a partial import to unwind.

   ── This module composes and decides almost nothing ──
   Every identity below is READ off the merged loader rather than
   recomputed: the bundle digest is the ENGINE's, taken as
   `ResolvedBlueprint.digest` during resolution; each card's is
   `ResolvedNode.digest`, which is `cardDigest` over the parsed
   document. Recomputing either here would be a second opinion
   about the identity `publish` and `addRelease` will store, and a
   plan that disagrees with the write it describes is worse than
   no plan.
   ============================================================ */

import { contentCardLibrary, readContent } from "@/lib/content/read";

/**
 * The one handle every imported bundle and card is owned by.
 *
 * The archive's blueprints and cards are generated examples, and every `author:` line in
 * `content/` names this same handle, so the account that owns the rows is also the one
 * the documents credit.
 */
export const REGISTRY_HANDLE = "autogen";

/**
 * The version every seeded release lands under.
 *
 * `BundleManifest` has no `version` field and no `blueprint.yaml` carries one, so `addRelease`
 * takes it from here rather than from the archive, and the plan and the write cannot come to
 * disagree about it. It moved past `1.0.0` when the manifests' descriptions and author lines
 * changed, so a registry still holding the earlier rows refuses them as an older version
 * instead of as a conflict.
 *
 * Bare semver, never `v1.1.0`: `parseSemver` refuses a `v` prefix by name in its own doc
 * comment, and `lib/data/bundles.ts` spells its fixture versions that way, which is the
 * string somebody reaching for a precedent would find.
 */
export const SEED_RELEASE_VERSION = "1.1.0";

export interface ImportPlan {
  bundles: readonly { slug: string; digest: string; releases: number }[];
  cards: readonly { cardId: string; version: string; digest: string; visibility: "public" | "private" }[];
  /* `ontologyVersion: string` WAS HERE (D-250-01's four-member shape) AND IS GONE. It named
     the vocabulary version every release this import would be scored under. The registry
     keeps one vocabulary now, the Attractor spec language's, so the member reported a
     constant rather than a property of the plan -- and its source, `CORE_ONTOLOGY.version`,
     no longer exists. `tests/server/t250/contract.ts` and `surface.test.ts` were the two
     places that named it from outside; both were amended in the same pass that dropped it. */
  registryHandle: string;
}

/**
 * What an import of the archive would create, computed without a database.
 *
 * **No `root` parameter (D-250-01).** `lib/content/read.ts` is by its own header the only
 * module in the repo that touches the filesystem, its content directory is fixed to
 * `process.cwd()/content`, and it memoizes at module scope — so a second root would return
 * the first root's answer regardless. Honouring one would mean a second filesystem walk
 * inside this module re-deriving three decisions `lib/content` already owns: how the
 * ontology overlay is layered, the card library's version-chain sweep, and that broken
 * content fails rather than ships.
 *
 * **The plan carries IDENTITY, never CONTENT.** `runImport` reads the bytes back through
 * the same loader rather than off the plan, because a plan carrying bytes would be a second
 * copy of the content tree with its own staleness.
 *
 * `async` although nothing here awaits: the published signature is `Promise<ImportPlan>`,
 * and a caller written against it must not have to care that today's implementation is
 * synchronous.
 */
export async function planImport(): Promise<ImportPlan> {
  const loaded = readContent();

  const bundles = loaded.map((b) => ({
    slug: b.slug,
    digest: b.blueprint.digest,
    /* One per bundle, and it is a count rather than a list because the plan names no
       version: the archive holds one folder per slug, so an import creates exactly one
       release for each (D-250-03). */
    releases: 1,
  }));

  /* The LIBRARY, which is one entry per file in `content/cards/`, pinned or not. Walking
     `blueprint.nodes` instead was complete only while every file happened to be pinned: a
     card published on its own has no node to walk to, and an enumeration through the graph
     would read as complete while missing it.

     `allNodeCards()` is NOT the source either. Its own doc says it returns the newest
     version of every distinct card id, and four ids here carry two versions.

     The identity is still READ rather than computed here: `contentCardLibrary()` carries
     the digest `lib/content/read.ts` took when it parsed the document, which is the module
     that already held it. No dedup is needed — one file is one entry. */
  const cards = contentCardLibrary()
    .map((entry) => ({
      cardId: entry.card.id,
      version: entry.card.version,
      digest: entry.digest,
      /* Public, every one of them, and it is a property of where the document lives
         rather than a default this module picked. `content/` is what the site reads at
         build time and treats as published; `lib/data/cards.ts`'s own header argues that
         a private row there would be a contradiction in terms. AC6's two private cards
         were withdrawn for that reason among four (D-250-02). */
      visibility: "public" as const,
    }))
    .sort((a, b) =>
      a.cardId === b.cardId ? compare(a.version, b.version) : compare(a.cardId, b.cardId),
    );

  return {
    bundles,
    cards,
    registryHandle: REGISTRY_HANDLE,
  };
}

/** Code-unit order, so the plan does not depend on the host locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
