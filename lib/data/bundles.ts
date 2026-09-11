/* ============================================================
   DarkPrint data — what an account holds, seeded

   An account holds **blueprints**. Each one is public or private,
   and some of them happen to have an upstream. That is the whole
   model, and the shape of this file is the argument for it: there is
   no `Fork` type, no `forks` array and no second list. `forkedFrom`
   is one optional field on the same row every other bundle uses.

   ── The one rule about what may be seeded here ──
   **A seeded bundle is always private.** A public bundle is a claim
   about the registry — that a reader can open it, resolve it, and
   check the score against the graph — and a row in this file cannot
   make that true. So the public rows below are the bundles this
   handle really has published in `content/`, named by slug and read
   off the archive at render time, and everything invented is private:
   yours, unpublished, and claiming nothing anybody could go and
   falsify.

   That is also why `draft` carries the title, version, digest and
   autonomy class for the unpublished rows and nothing for the
   published ones. A published row has an archive to read those off,
   and a second hand-written copy of a digest is a copy that can
   drift from the bytes it names.

   Nothing here persists. `/u/[username]` renders these rows with the
   owner controls switched off and says so above them.
   ============================================================ */

/** Where a bundle came from, when it came from somewhere. A field, not a type. */
export interface Lineage {
  owner: string;
  slug: string;
  /** The upstream release this copy was taken at. */
  version: string;
}

/**
 * What comparing this bundle's pinned cards against the upstream's current release says.
 *
 * `ok` is emerald and `moved` is amber, which is the one amber on this surface: it is a
 * "there is something here you have not seen" marker on a thing that genuinely exists.
 * `blocked` is the bundle's own problem rather than the upstream's, so it says what is
 * wrong with this bundle and never frames it as falling behind.
 */
export interface Drift {
  tone: "ok" | "moved" | "blocked";
  note: string;
}

/**
 * One entry in a bundle's file listing.
 *
 * `path` is a name `lib/content/bundle-export.ts` really generates, or one of the two
 * local files a working copy carries and a published folder never does.
 * `components/bundle/files.test.ts` holds every path below against `bundleFilePaths`, so a
 * rename in the exporter fails there rather than shipping a listing of files nobody would
 * find in the folder they downloaded.
 */
export interface BundleFile {
  path: string;
  /** Which glyph the row draws. `dir` is the one entry that is not a file. */
  kind: "dot" | "dir" | "yaml" | "doc";
  /** What changed in it, in the author's words. */
  change: string;
  /**
   * `changed` is the author's edit, `generated` is written by the exporter, `verbatim`
   * came from the upstream untouched, and `local` never leaves the working copy.
   *
   * `source` and `pinned` describe a published folder instead, where nothing has changed
   * relative to anything: the DOT is what the author wrote and `cards/` is what the graph
   * pins. Six words rather than two vocabularies, so one legend covers both listings.
   */
  state: "changed" | "generated" | "verbatim" | "local" | "source" | "pinned";
  at: string;
}

/**
 * One published snapshot.
 *
 * Not a commit. There is no repository behind a bundle, so an entry is an identity — a
 * digest over the DOT and every card version it pinned — rather than a patch against the
 * one below it. The UI says that where the list renders, because a column of versions with
 * messages beside them reads as a commit log to everybody who has ever seen one.
 */
export interface HistoryEntry {
  version: string;
  /** Short form. The full digest only exists for a bundle the archive carries. */
  digest: string;
  tag?: "latest" | "fork point" | "upstream";
  message: string;
  /** Handle, so the row can draw the avatar and link the profile. */
  author: string;
  at: string;
}

/** The folder as it stood at one version, kept at its digest. */
export interface Release {
  version: string;
  at: string;
  files: number;
  /** Human size, e.g. "41 kB". Seeded: nothing has measured a folder that does not exist. */
  size: string;
  latest?: boolean;
}

/** A card the upstream repinned after this copy was taken. */
export interface UpstreamMoved {
  /** Card id, which is also the route: `/nodes/<card>`. */
  card: string;
  from: string;
  to: string;
  at: string;
}

/** Everything the bundle page needs that no archive can answer for an unpublished bundle. */
export interface DraftDetail {
  /** The strip above the file listing: who changed what, last. */
  lastChange: { author: string; message: string; digest: string; at: string };
  files: readonly BundleFile[];
  history: readonly HistoryEntry[];
  releases: readonly Release[];
  /** The summary rows for a bundle the engine has resolved. */
  facts: {
    nodes: number;
    pinnedCards: number;
    ontologyDeclared: string;
    scoredUnder: string;
  };
  upstreamMoved?: UpstreamMoved;
  /** What the version row prints beside the selector. */
  changes: number;
}

/** Everything an unpublished row has to carry, because there is no archive behind it. */
export interface Draft {
  title: string;
  summary: string;
  version: string;
  /**
   * Short digest, or a plain sentence when the bundle does not resolve. A bundle carrying
   * an undescribed node has no digest at all — the engine hashes the DOT and every card
   * version, and it cannot hash a card that is not there — so inventing one would be the
   * one lie a content-addressed archive cannot afford.
   */
  digest: string;
  /** The class name. Never an ordinal: doc 2 §1.1 keeps that off every surface. */
  autonomy: string;
  /** ISO date of the last edit. */
  editedAt: string;
  /** What `/u/<owner>/<slug>` needs. Absent on a row nothing links to a page. */
  detail: DraftDetail;
}

export interface OwnedBundle {
  owner: string;
  slug: string;
  visibility: "public" | "private";
  forkedFrom?: Lineage;
  drift?: Drift;
  /** Absent exactly when `slug` is a published bundle in `content/`. See the header. */
  draft?: Draft;
}

/**
 * The signed-in account's blueprints: two published, three private.
 *
 * The two public rows are Mara's real archive bundles. The three private ones are the
 * design's, re-pointed at upstreams that exist: `guarded-merge-bot` is Sol's and
 * `frontline-triage` is Hana's in `content/`, so the lineage lines resolve to profiles and
 * blueprints a reader can actually open.
 *
 * The last row has no upstream on purpose. A list where every private bundle is a fork
 * reads as though private and forked were the same idea, and they are not: a draft of your
 * own work is the commonest private bundle there is.
 */
export const OWNED_BUNDLES: readonly OwnedBundle[] = [
  {
    owner: "mara-veil",
    slug: "adversarial-consensus-line",
    visibility: "public",
  },
  {
    owner: "mara-veil",
    slug: "incident-commander",
    visibility: "public",
  },
  {
    owner: "mara-veil",
    slug: "guarded-merge-bot-hardened",
    visibility: "private",
    forkedFrom: { owner: "sol-antczak", slug: "guarded-merge-bot", version: "v1.3.0" },
    drift: { tone: "ok", note: "✓ in step with upstream" },
    draft: {
      title: "Guarded Merge Bot, hardened",
      summary:
        "Maintainer gate replaced with a second judge; merge scoped to one repository.",
      version: "v1.4.0-hardened",
      digest: "sha256:4f1c9a",
      autonomy: "Closed-loop",
      editedAt: "2026-08-08",
      detail: {
        lastChange: {
          author: "mara-veil",
          message: "replace the maintainer gate with a second judge",
          digest: "sha256:4f1c9a",
          at: "2026-08-08",
        },
        files: [
          {
            path: "topology.dot",
            kind: "dot",
            change: "gate node replaced with a second verifier",
            state: "changed",
            at: "2026-08-08",
          },
          {
            path: "cards/",
            kind: "dir",
            change: "6 pinned cards, 1 replaced",
            state: "changed",
            at: "2026-08-08",
          },
          {
            path: "README.md",
            kind: "doc",
            change: "identity, digest and the download command",
            state: "generated",
            at: "2026-08-08",
          },
          {
            path: "NOTES.md",
            kind: "doc",
            change: "your own note, never published with the bundle",
            state: "local",
            at: "2026-08-07",
          },
        ],
        history: [
          {
            version: "v1.4.0-hardened",
            digest: "sha256:4f1c9a",
            tag: "latest",
            message:
              "Replace the maintainer gate with a second judge. The graph now covers all five phases with no node waiting for a person, so the class moves from Conditional to Closed-loop.",
            author: "mara-veil",
            at: "2026-08-08",
          },
          {
            version: "v1.3.1-hardened",
            digest: "sha256:c8e310",
            message:
              "Scope the merge tool to one repository. The security reading gains a point; nothing else moves.",
            author: "mara-veil",
            at: "2026-07-12",
          },
          {
            version: "v1.3.0-hardened",
            digest: "sha256:77b1ae",
            tag: "fork point",
            message:
              "Taken from sol-antczak/guarded-merge-bot v1.3.0, byte for byte. Same digest as the upstream at this point.",
            author: "mara-veil",
            at: "2026-06-28",
          },
          {
            version: "v1.3.0",
            digest: "sha256:77b1ae",
            tag: "upstream",
            message:
              "Guarded Merge Bot, as published by sol-antczak. Everything above this line is yours.",
            author: "sol-antczak",
            at: "2026-06-20",
          },
        ],
        releases: [
          {
            version: "v1.4.0-hardened",
            at: "2026-08-08",
            files: 12,
            size: "38 kB",
            latest: true,
          },
          { version: "v1.3.1-hardened", at: "2026-07-12", files: 12, size: "37 kB" },
          { version: "v1.3.0-hardened", at: "2026-06-28", files: 12, size: "36 kB" },
        ],
        facts: {
          nodes: 6,
          pinnedCards: 6,
          ontologyDeclared: "0.1.0",
          scoredUnder: "0.1.0",
        },
        changes: 6,
      },
    },
  },
  {
    owner: "mara-veil",
    slug: "frontline-triage-eu",
    visibility: "private",
    forkedFrom: { owner: "hachi", slug: "frontline-triage", version: "v1.0.0" },
    drift: { tone: "moved", note: "▲ upstream repinned 1 card" },
    draft: {
      title: "Frontline Triage, EU",
      summary:
        "PII handling swapped for the local lupo/ vocabulary; one node still waits for a person.",
      version: "v0.3.0",
      digest: "sha256:9c02de",
      autonomy: "Conditional",
      editedAt: "2026-07-28",
      detail: {
        lastChange: {
          author: "mara-veil",
          message: "declare pii-handling on the two nodes that read a customer record",
          digest: "sha256:9c02de",
          at: "2026-07-28",
        },
        files: [
          {
            path: "topology.dot",
            kind: "dot",
            change: "risk markers added to two nodes",
            state: "changed",
            at: "2026-07-28",
          },
          {
            path: "cards/",
            kind: "dir",
            change: "7 pinned cards, 2 edited",
            state: "changed",
            at: "2026-07-28",
          },
          {
            path: "ontology/extensions.yaml",
            kind: "yaml",
            change: "declares lupo/pii-handling",
            state: "verbatim",
            at: "2026-06-21",
          },
          {
            path: "README.md",
            kind: "doc",
            change: "identity, digest and the download command",
            state: "generated",
            at: "2026-07-28",
          },
        ],
        history: [
          {
            version: "v0.3.0",
            digest: "sha256:9c02de",
            tag: "latest",
            message:
              "Declare lupo/pii-handling on the intake and the reply check. The security reading falls by half a point, which is the marker doing its job rather than a regression.",
            author: "mara-veil",
            at: "2026-07-28",
          },
          {
            version: "v0.2.0",
            digest: "sha256:5ad114",
            message: "Route the escalation through the EU knowledge base only.",
            author: "mara-veil",
            at: "2026-07-02",
          },
          {
            version: "v0.1.0",
            digest: "sha256:2b9f40",
            tag: "fork point",
            message: "Taken from hachi/frontline-triage v1.0.0, byte for byte.",
            author: "mara-veil",
            at: "2026-06-21",
          },
          {
            version: "v1.0.0",
            digest: "sha256:2b9f40",
            tag: "upstream",
            message: "Frontline Triage, as published by hachi.",
            author: "hachi",
            at: "2026-06-14",
          },
        ],
        releases: [
          { version: "v0.3.0", at: "2026-07-28", files: 14, size: "44 kB", latest: true },
          { version: "v0.2.0", at: "2026-07-02", files: 14, size: "43 kB" },
          { version: "v0.1.0", at: "2026-06-21", files: 14, size: "43 kB" },
        ],
        facts: {
          nodes: 7,
          pinnedCards: 7,
          ontologyDeclared: "0.1.0",
          scoredUnder: "0.1.0",
        },
        /* Real on both sides: `intent-router` is a card in `content/cards/` with two
           published versions, and `frontline-triage` pins the first. So the amber panel
           names a repin a reader can go and read, on the card's own page, instead of a
           version nobody can check.

           Both versions moved a minor on 2026-09-05 (§11.0 Q17): the card was RENAMED
           1.0.0 -> 1.1.0 and 2.0.0 -> 2.1.0 to carry the `lane` emission, so the archive no
           longer holds either old number. Read off `content/cards/intent-router@*.yaml` and
           `content/blueprints/frontline-triage/topology.dot`, which pins `@1.1.0`. */
        upstreamMoved: {
          card: "intent-router",
          from: "1.1.0",
          to: "2.1.0",
          at: "2026-07-04",
        },
        changes: 9,
      },
    },
  },
  {
    owner: "mara-veil",
    slug: "incident-commander-draft",
    visibility: "private",
    drift: { tone: "blocked", note: "▲ 2 nodes have no card" },
    draft: {
      title: "Incident Commander, next",
      summary:
        "Unfinished: two nodes have no card in the bundle, so it will not resolve and cannot publish.",
      version: "v0.1.0",
      digest: "no digest: the bundle does not resolve",
      autonomy: "Assisted",
      editedAt: "2026-06-30",
      detail: {
        lastChange: {
          author: "mara-veil",
          message: "sketch the two nodes that replace the on-call escalation",
          digest: "no digest",
          at: "2026-06-30",
        },
        files: [
          {
            path: "topology.dot",
            kind: "dot",
            change: "two nodes drawn with no card pinned",
            state: "changed",
            at: "2026-06-30",
          },
          {
            path: "cards/",
            kind: "dir",
            change: "5 pinned cards, 2 nodes unpinned",
            state: "changed",
            at: "2026-06-30",
          },
          {
            path: "NOTES.md",
            kind: "doc",
            change: "what the two missing cards have to declare",
            state: "local",
            at: "2026-06-30",
          },
        ],
        /* One entry, and no release. A bundle that does not resolve has no digest, and a
           history here is a list of digests: there is nothing to list. */
        history: [
          {
            version: "v0.1.0",
            digest: "no digest",
            message:
              "Two nodes are drawn and neither has a card, so the loader refuses the bundle and no digest exists for it. Nothing here can be published or pinned until both are written.",
            author: "mara-veil",
            at: "2026-06-30",
          },
        ],
        releases: [],
        facts: {
          nodes: 7,
          pinnedCards: 5,
          ontologyDeclared: "0.1.0",
          scoredUnder: "not computed",
        },
        changes: 3,
      },
    },
  },
];

/** Every bundle a handle holds, published and private, in one list. */
export function bundlesOwnedBy(username: string): OwnedBundle[] {
  return OWNED_BUNDLES.filter((b) => b.owner === username);
}

/**
 * One bookmark.
 *
 * A save is a private bookmark and it is not the star count beside a blueprint. The two
 * are kept apart everywhere they render, because merging them is the one mistake that
 * would turn a reader's private list into a public figure.
 */
export interface Save {
  /** Where it goes. A real route in every row below. */
  href: string;
  /** How it reads: `owner / name`, or the id of a card or a term. */
  path: string;
  summary: string;
  kind: "blueprint" | "node card" | "vocabulary term";
}

/**
 * The signed-in account's saves.
 *
 * Five rows, and the count a profile prints is this list's length rather than a seeded
 * total: a tab reading `Saved 17` over three visible rows is a number with nothing behind
 * it, which is exactly the thing the `◐` marker exists to prevent from happening quietly.
 *
 * `FavoriteStar` still writes to `localStorage` in this build, and it is a different set
 * from this one. The profile says so where the list renders.
 */
export const SAVES: readonly Save[] = [
  {
    href: "/blueprints/guarded-merge-bot",
    path: "sol-antczak / guarded-merge-bot",
    summary: "Agents review the PR; a maintainer makes the merge call.",
    kind: "blueprint",
  },
  {
    href: "/blueprints/starter-software-factory",
    path: "orin / starter-software-factory",
    summary: "Five nodes, and the interesting part is the arrow that is not drawn.",
    kind: "blueprint",
  },
  {
    href: "/ontology/lupo/pii-handling",
    path: "lupo / pii-handling",
    summary: "Risk marker for a node that may see personal data.",
    kind: "vocabulary term",
  },
  {
    href: "/nodes/bounded-retry",
    path: "k0bra / bounded-retry@2.0.0",
    summary: "Retries with a spend ceiling instead of a count.",
    kind: "node card",
  },
  {
    href: "/nodes/acceptance-verifier",
    path: "sol-antczak / acceptance-verifier@2.0.0",
    summary: "Scores a diff against the acceptance criteria and nothing else.",
    kind: "node card",
  },
];
