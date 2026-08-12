import type { CardRef } from "@/lib/core";
import type { Author, Blueprint } from "@/lib/types";
import type {
  BundleFile,
  HistoryEntry,
  OwnedBundle,
  Release,
  UpstreamMoved,
} from "@/lib/data/bundles";
import { bundleVocabulary, getBlueprintBySlug } from "@/lib/content";
import {
  BUNDLE_AGENTS,
  BUNDLE_CARDS_DIR,
  BUNDLE_README,
  BUNDLE_VOCABULARY,
  FACTORY_DOT,
  TOPOLOGY_DOT,
  bundleDownloadCommand,
  bundleFilePaths,
  bundleHref,
} from "@/lib/content/bundle-export";
import { OWNED_BUNDLES } from "@/lib/data/bundles";
import { getAuthor } from "@/lib/data";
import { profileFor } from "@/lib/data/profiles";

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

export interface BundleView {
  bundle: OwnedBundle;
  owner: Author;
  /** Present exactly when this bundle is published in `content/`. */
  blueprint?: Blueprint;
  title: string;
  summary: string;
  version: string;
  /** What the version row prints beside the selector. */
  versions: number;
  changes: number;
  autonomy: string;
  files: readonly BundleFile[];
  /** Where a file row points, for a bundle whose folder is on disk. */
  hrefFor?: (file: BundleFile) => string | undefined;
  readmeHref?: string;
  fileFootnote: string;
  lastChange: { author: string; message: string; digest: string; at: string };
  history: readonly HistoryEntry[];
  releases: readonly Release[];
  upstreamMoved?: UpstreamMoved;
  /** The download command, for a bundle that has a folder. */
  clone?: { command: string; cliCommand: string };
  /** Seeded community support, for a published bundle only. */
  support?: number;
  watchers: number;
  /** Seeded facts, for a bundle the engine has never resolved. */
  facts?: {
    digest: string;
    nodes: number;
    pinnedCards: number;
    ontologyDeclared: string;
    scoredUnder: string;
    resolves: boolean;
  };
}

/** Every `/u/<owner>/<slug>` this build produces. */
export function ownedBundleParams(): Array<{ username: string; slug: string }> {
  return OWNED_BUNDLES.map((b) => ({ username: b.owner, slug: b.slug }));
}

/** The listing a published folder really has, `cards/` folded into one row. */
function publishedFiles(blueprint: Blueprint, at: string): BundleFile[] {
  const cardRefs = blueprint.cardRefs as readonly CardRef[];
  const paths = bundleFilePaths({
    cardRefs,
    vocabulary: bundleVocabulary(blueprint.slug) !== undefined,
  });
  const distinct = new Set(cardRefs).size;

  const files: BundleFile[] = [];
  for (const path of paths) {
    if (path.startsWith(`${BUNDLE_CARDS_DIR}/`)) continue;
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
    change: `${distinct} pinned card${distinct === 1 ? "" : "s"}, one document each`,
    state: "pinned",
    at,
  });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return files;
}

/**
 * The half of a bundle page that a published bundle can answer from the archive alone.
 *
 * Both routes read it: `/u/<owner>/<slug>` for the two bundles the account holds that are
 * also published, and `/blueprints/<slug>` for all nine. One function rather than two, so
 * the listing, the history and the releases cannot say different things on the two pages
 * about the same folder.
 */
export function publishedBundleSections(blueprint: Blueprint, ownerHandle: string): {
  files: readonly BundleFile[];
  hrefFor: (file: BundleFile) => string | undefined;
  readmeHref: string;
  fileFootnote: string;
  lastChange: { author: string; message: string; digest: string; at: string };
  history: readonly HistoryEntry[];
  releases: readonly Release[];
  clone: { command: string; cliCommand: string };
  shortDigest: string;
} {
  const slug = blueprint.slug;
  const cardRefs = blueprint.cardRefs as readonly CardRef[];
  const distinct = new Set(cardRefs).size;
  const files = publishedFiles(blueprint, blueprint.updatedAt);
  const digest = `${blueprint.digest.slice(0, 13)}…`;
  const paths = bundleFilePaths({
    cardRefs,
    vocabulary: bundleVocabulary(slug) !== undefined,
  });

  return {
    files,
    hrefFor: (file) => (file.kind === "dir" ? undefined : bundleHref(slug, file.path)),
    readmeHref: bundleHref(slug, BUNDLE_README),
    fileFootnote: `${files.length} entries · ${distinct} pinned card${distinct === 1 ? "" : "s"} inside ${BUNDLE_CARDS_DIR}/`,
    lastChange: {
      author: ownerHandle,
      message: blueprint.summary,
      digest,
      at: blueprint.updatedAt,
    },
    history: [
      {
        version: digest,
        digest,
        tag: "latest",
        message:
          "The published snapshot, addressed by the digest above. The archive holds one folder per bundle, so this is the whole history there is: no earlier snapshot of it was ever published.",
        author: ownerHandle,
        at: blueprint.updatedAt,
      },
    ],
    releases: [
      {
        version: digest,
        at: blueprint.updatedAt,
        files: paths.length,
        size: "on disk",
        latest: true,
      },
    ],
    clone: {
      command: bundleDownloadCommand(slug, paths),
      cliCommand: `darkprint clone ${slug}`,
    },
    shortDigest: digest,
  };
}

export function bundleView(username: string, slug: string): BundleView | undefined {
  const bundle = OWNED_BUNDLES.find((b) => b.owner === username && b.slug === slug);
  if (bundle === undefined) return undefined;
  const owner = getAuthor(username);
  if (owner === undefined) return undefined;

  const watchers = profileFor(username).watchers;
  const blueprint = getBlueprintBySlug(slug);

  if (blueprint !== undefined && bundle.draft === undefined) {
    const sections = publishedBundleSections(blueprint, username);

    return {
      bundle,
      owner,
      blueprint,
      title: blueprint.title,
      summary: blueprint.summary,
      version: sections.shortDigest,
      /* One. A published bundle is one folder at one digest: the archive holds no second
         snapshot of it, and printing a larger number would invent releases nobody can
         fetch. The version row says so by counting what is there. */
      versions: 1,
      changes: 0,
      autonomy: blueprint.autonomy.label,
      files: sections.files,
      hrefFor: sections.hrefFor,
      readmeHref: sections.readmeHref,
      fileFootnote: sections.fileFootnote,
      lastChange: sections.lastChange,
      history: sections.history,
      releases: sections.releases,
      clone: sections.clone,
      support: blueprint.votes,
      watchers,
    };
  }

  const draft = bundle.draft;
  if (draft === undefined) return undefined;
  const { detail } = draft;
  const cardsRow = detail.files.find((f) => f.kind === "dir");

  return {
    bundle,
    owner,
    title: draft.title,
    summary: draft.summary,
    version: draft.version,
    versions: detail.releases.length === 0 ? 1 : detail.releases.length,
    changes: detail.changes,
    autonomy: draft.autonomy,
    files: detail.files,
    fileFootnote:
      cardsRow === undefined
        ? `${detail.files.length} entries`
        : `${detail.files.length} entries · ${cardsRow.change}`,
    lastChange: detail.lastChange,
    history: detail.history,
    releases: detail.releases,
    ...(detail.upstreamMoved === undefined
      ? {}
      : { upstreamMoved: detail.upstreamMoved }),
    watchers,
    facts: {
      digest: draft.digest,
      nodes: detail.facts.nodes,
      pinnedCards: detail.facts.pinnedCards,
      ontologyDeclared: detail.facts.ontologyDeclared,
      scoredUnder: detail.facts.scoredUnder,
      resolves: bundle.drift?.tone !== "blocked",
    },
  };
}
