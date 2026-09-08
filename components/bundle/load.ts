import type { BundleFile } from "@/lib/data/bundles";
import {
  BUNDLE_CARDS_DIR,
  BUNDLE_README,
  BUNDLE_VOCABULARY,
  TOPOLOGY_DOT,
} from "@/lib/content/bundle-export";

/* ============================================================
   One bundle page's data, from whichever of the two sources can answer.

   SERVER ONLY: `@/lib/content` reaches the filesystem at build time.

   A published bundle answers everything off the archive — the digest the engine computed,
   the file list the generator wrote, the class it read off the graph. A private one
   answers off `lib/data/bundles.ts` and nothing else, and the page marks every panel that
   comes from there. The seam is `blueprint === undefined`, and it is the only conditional
   in the page worth understanding.

   ── The file listing of a published bundle is derived, not written ──
   `bundleFilePaths` names the files the generator writes, and
   `lib/content/bundle-export.test.ts` holds the generator to that set. So the listing on
   this page and the folder on disk are two renderings of one array. The per-file sentence
   is the only thing written here, and it describes what the file *is* rather than what
   changed in it, because nothing changed: a published bundle is one snapshot.
   ============================================================ */

/** What each generated file is, in one line. Keyed by the exporter's own constants. */
const PUBLISHED_FILE_NOTE: Record<string, { kind: BundleFile["kind"]; note: string }> = {
  [TOPOLOGY_DOT]: { kind: "dot", note: "the topology, as the author wrote it" },
  [BUNDLE_README]: { kind: "doc", note: "what this blueprint is, its digest, and how to run it" },
  [BUNDLE_VOCABULARY]: { kind: "yaml", note: "the local terms this bundle's cards use" },
};

/* The bundle-view cluster (`BundleView`, `ownedBundleParams`, `publishedFiles`,
   `publishedBundleSections`, `bundleView`) was DELETED here under D-261-16: a closed
   cluster with no external entry point once `/u/[username]/[slug]` became a pure
   redirector, still carrying the pre-B-09 `darkprint clone ${slug}` spelling. The
   deletion is the ruled disposal; `tests/server/t261/honesty-direction.test.ts`
   held the spelling unreachable until it landed and self-retires on it. */

/* --------------------- the registry path --------------------- */

/**
 * The listing a release really has, from the paths the export module reports.
 *
 * `publishedFiles` above answers the same question off the archive; this answers it off
 * `releaseFiles`, and the per-file sentences come from the one `PUBLISHED_FILE_NOTE` table
 * so the two cannot describe one folder differently. Split out rather than duplicated for
 * the reason D-260-07 split `termUsageOver` out of `termUsageIndex`: two corpora, one
 * computation.
 */
export function filesFromPaths(paths: readonly string[], at: string): BundleFile[] {
  const files: BundleFile[] = [];
  let cards = 0;
  for (const path of paths) {
    if (path.startsWith(`${BUNDLE_CARDS_DIR}/`)) {
      cards += 1;
      continue;
    }
    const meta = PUBLISHED_FILE_NOTE[path];
    if (meta === undefined) continue;
    files.push({
      path,
      kind: meta.kind,
      change: meta.note,
      state: path === TOPOLOGY_DOT ? "source" : path === BUNDLE_VOCABULARY ? "verbatim" : "generated",
      at,
    });
  }
  files.push({
    path: `${BUNDLE_CARDS_DIR}/`,
    kind: "dir",
    change: `${cards} pinned card${cards === 1 ? "" : "s"}, one document each`,
    state: "pinned",
    at,
  });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return files;
}

/**
 * The rows INSIDE `cards/`, for the listing's second level.
 *
 * `filesFromPaths` above counts these and collapses them into one `dir` row, which is the
 * right shape for a folder view and throws the names away. This is the same corpus read the
 * other way, so the two cannot disagree about what is in the folder: both walk `paths`, and
 * the count the `dir` row prints is the length of what this returns.
 *
 * Every entry is a card the release PINS, so `pinned` is the state for all of them — there
 * is no per-card variation to carry. `PUBLISHED_FILE_NOTE` is not consulted: it names the
 * fixed top-level files a bundle always has, and a card file's name is the card's.
 */
export function cardFilesFromPaths(paths: readonly string[], at: string): BundleFile[] {
  return paths
    .filter((path) => path.startsWith(`${BUNDLE_CARDS_DIR}/`))
    .map((path) => ({
      path,
      kind: "yaml" as const,
      change: "one card document, pinned at the version the graph names",
      state: "pinned" as const,
      at,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
