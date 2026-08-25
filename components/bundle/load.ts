import type { BundleFile } from "@/lib/data/bundles";
import {
  BUNDLE_AGENTS,
  BUNDLE_CARDS_DIR,
  BUNDLE_README,
  BUNDLE_VOCABULARY,
  FACTORY_DOT,
  TOPOLOGY_DOT,
} from "@/lib/content/bundle-export";
import { SITE_ORIGIN } from "@/lib/content/bundle-export";
import { blueprintFileHref, cardFileHref } from "@/lib/href";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-66) (cited at line 141): folded into SEAM-65

/* ============================================================
   One bundle page's data, from whichever of the two sources can answer.

   SERVER ONLY: `@/lib/content` reaches the filesystem at build time.

   A published bundle answers everything off the archive — the digest the engine computed,
   the file list the generator wrote, the class it read off the graph. A private one
   answers off `lib/data/bundles.ts` and nothing else, and the page marks every panel that
   comes from there. The seam is `blueprint === undefined`, and it is the only conditional
   in the page worth understanding.

   ── The file listing of a published bundle is derived, not written ──
   `bundleFilePaths` is the same function `bundleDownloadCommand` builds its URL list from,
   and `lib/content/bundle-export.test.ts` holds that command to the files the generator
   actually writes. So the listing on this page, the command in the menu above it and the
   folder on disk are three renderings of one array. The per-file sentence is the only
   thing written here, and it describes what the file *is* rather than what changed in it,
   because nothing changed: a published bundle is one snapshot.
   ============================================================ */

/** What each generated file is, in one line. Keyed by the exporter's own constants. */
const PUBLISHED_FILE_NOTE: Record<string, { kind: BundleFile["kind"]; note: string }> = {
  [TOPOLOGY_DOT]: { kind: "dot", note: "the topology, as the author wrote it" },
  [FACTORY_DOT]: { kind: "dot", note: "the same graph, emitted for Attractor" },
  [BUNDLE_README]: { kind: "doc", note: "identity, digest and the download command" },
  [BUNDLE_AGENTS]: {
    kind: "doc",
    note: "how to fit this pattern into your own repository",
  },
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
 * A one-character stand-in used only to take `blueprintFileHref`'s prefix.
 *
 * The brace expansion has to be appended to the release's base URL, and that base is
 * `blueprintFileHref`'s to spell. Asking it for a known path and cutting the path back off
 * keeps ONE author for the shape — rebuilding the prefix here would be the second spelling
 * that drifts the day the route moves. A single unreserved character, so nothing is
 * percent-encoded into a different length on the way through.
 */
const PATH_PROBE = "x";

/**
 * The whole folder in one `curl`, at the release's immutable digest address.
 *
 * This replaces `bundleDownloadCommand`, whose URLs point into `public/bundles/<slug>/` —
 * the mirror `scripts/generate-bundles.ts` writes from `content/` before a build. A
 * blueprint published since the last deploy has no folder there at all, so AC3 and AC4
 * could not both hold on it (D-261-04). The mirror is untouched and out of this task's
 * reach; the page stops linking it.
 *
 * The digest and not the version, because a command a reader pastes into a terminal
 * tomorrow must fetch the folder the page was describing today — the immutable promise
 * `/mcp` already calls load-bearing.
 *
 * Brace expansion and `-o "<slug>/#1"` are kept verbatim from the command this replaces:
 * `#1` is `curl`'s own back-reference to the expansion, so each file lands under its own
 * name inside a folder that resolves as a bundle, and `--fail-early` means a folder is
 * never written half-fetched. It lives here rather than in `lib/href.ts` because a shell
 * command is not an href, and because `SITE_ORIGIN` would otherwise pull `lib/content`
 * into every client bundle that imports a link builder.
 */
export function releaseDownloadCommand(
  ownerHandle: string,
  slug: string,
  release: { digest: string },
  files: readonly string[],
): string {
  const base = `${SITE_ORIGIN}${blueprintFileHref(ownerHandle, slug, release, PATH_PROBE)}`.slice(
    0,
    -PATH_PROBE.length,
  );
  return `curl --fail-early -fsSL --create-dirs -o "${slug}/#1" "${base}{${files.join(",")}}"`;
}

/**
 * One card document in one command, at its registry address.
 *
 * The card half of `releaseDownloadCommand`, replacing `cardDownloadCommand`'s
 * `public/cards/<ref>.yaml` for the same reason (D-261-04): the static mirror is a build
 * artefact of `content/` and a card published since the last deploy is not in it.
 *
 * No braces, no `#1` and no `--create-dirs`: one URL, one file, landing in the working
 * directory under its own name, which is what `-O` means and the one case where `-O` is the
 * right flag. `--fail-early` has nothing to be early about with a single URL and is left
 * off rather than carried as decoration — the shipped command's own reasoning, kept.
 */
export function cardFileDownloadCommand(ref: string): string {
  return `curl -fsSL -O "${SITE_ORIGIN}${cardFileHref(ref)}"`;
}
