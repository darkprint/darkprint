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

import { readContent } from "@/lib/content/read";

/**
 * The one handle every imported bundle and card is owned by (D-250-04).
 *
 * Not a `lib/data` author and not a fixture: the six names in the archive's manifests
 * stay written where they are, and none of them becomes an account (AC4, D-250-11).
 */
export const REGISTRY_HANDLE = "darkprint";

/**
 * The version every seeded release lands under (D-250-03).
 *
 * `BundleManifest` has no `version` field and none of the nine `blueprint.yaml` files
 * carries one — the site prints the DIGEST where a version would go. But `addRelease`
 * requires one, so it is ruled rather than derived, and it is ruled HERE rather than at
 * the call site so the plan and the write cannot come to disagree about it.
 *
 * Bare semver, never `v1.0.0`: `parseSemver` refuses a `v` prefix by name in its own doc
 * comment, and `lib/data/bundles.ts` spells its fixture versions that way, which is the
 * string somebody reaching for a precedent would find.
 */
export const SEED_RELEASE_VERSION = "1.0.0";

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

  /* Keyed by ref rather than by id: four ids in the library carry two versions, and a
     card is one immutable document per `(id, version)`. Seven refs are pinned by two
     bundles apiece — 64 nodes over 57 distinct refs — so the map is what turns the
     blueprint's node list into the card library without counting a shared card twice.

     `allNodeCards()` is NOT the source. Its own doc says it returns the newest version of
     every distinct card id, which is 53 of the 57 files, and an enumeration through it
     would read as complete while missing four. */
  const byRef = new Map<string, { cardId: string; version: string; digest: string; visibility: "public" | "private" }>();
  for (const bundle of loaded) {
    for (const node of bundle.blueprint.nodes) {
      /* The map KEY is the dedup, and there is no `if (has) continue` above this line. It
         was there and a mutation sweep reddened zero of nine cells removing it: setting an
         existing key to an equal value changes nothing, so the guard read as the dedup
         while the map did the work. Equal because the nine bundles carry no `cards/` folder
         of their own — every ref resolves out of the one shared `content/cards/` library,
         measured as 57 distinct refs over 57 files with no ref naming no file — so one ref
         names exactly one document and last-write-wins cannot pick between two. */
      byRef.set(node.ref, {
        cardId: node.card.id,
        version: node.card.version,
        digest: node.digest,
        /* Public, every one of them, and it is a property of where the document lives
           rather than a default this module picked. `content/` is what the site reads at
           build time and treats as published; `lib/data/cards.ts`'s own header argues that
           a private row there would be a contradiction in terms. AC6's two private cards
           were withdrawn for that reason among four (D-250-02). */
        visibility: "public",
      });
    }
  }
  const cards = [...byRef.values()].sort((a, b) =>
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
