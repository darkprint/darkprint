/* ============================================================
   A file listing that names files the download does not contain.

   `/u/<owner>/<slug>` draws a folder. For a published bundle that
   listing is derived from `bundleFilePaths`, which is the same array
   `bundleDownloadCommand` builds its URLs from, so the page and the
   folder cannot disagree. For a private one it is written by hand in
   `lib/data/bundles.ts`, and a hand-written listing is exactly the
   thing that goes stale the day somebody renames a constant in
   `lib/content/bundle-export.ts`.

   The failure it would produce is quiet and bad: a reader takes the
   folder, opens it, and it does not match the page they took it
   from. So every path in every seeded listing is held here against
   the names the exporter really generates, plus the one local file a
   working copy carries and a published folder never does.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { allBlueprints, nodeCardVersions } from "@/lib/content";
import {
  BUNDLE_CARDS_DIR,
  BUNDLE_README,
  BUNDLE_VOCABULARY,
  TOPOLOGY_DOT,
} from "@/lib/content/bundle-export";
import { OWNED_BUNDLES } from "@/lib/data/bundles";

/**
 * Every name a bundle page may print.
 *
 * The first three come from the exporter's own constants, so a rename there fails here.
 * `cards/` is the directory row the listing folds the card documents into, and `NOTES.md`
 * is the local file the design puts in a working copy — `exportBundle` never writes it,
 * which is the whole point of the `local` state beside it.
 *
 * `factory.dot` and `AGENTS.md` were in this set until the owner instructed both out of
 * every published folder (2026-08-25) and then authorised this pin's removal. They were
 * admitted here as names the exporter generated, and it stopped generating either — so
 * leaving them listed let a seeded listing advertise a file no download contains, which
 * is the exact failure the banner above describes. Their absence is now checked rather
 * than allowed: neither name is in this set, so a listing that prints one is a stray.
 */
const ALLOWED = new Set<string>([
  TOPOLOGY_DOT,
  BUNDLE_README,
  BUNDLE_VOCABULARY,
  `${BUNDLE_CARDS_DIR}/`,
  "NOTES.md",
]);

const DRAFTS = OWNED_BUNDLES.filter((b) => b.draft !== undefined);

describe("the seeded file listings", () => {
  it("has drafts to check", () => {
    // A filter that matched nothing passes every case below.
    expect(DRAFTS.length).toBeGreaterThan(0);
  });

  it("names only files the exporter generates, plus the local ones", () => {
    const strays: string[] = [];
    for (const bundle of DRAFTS) {
      for (const file of bundle.draft?.detail.files ?? []) {
        if (!ALLOWED.has(file.path)) strays.push(`${bundle.slug}: ${file.path}`);
      }
    }
    expect(strays).toEqual([]);
  });

  it("marks the local file local, and nothing else", () => {
    const wrong: string[] = [];
    for (const bundle of DRAFTS) {
      for (const file of bundle.draft?.detail.files ?? []) {
        const isLocal = file.path === "NOTES.md";
        if (isLocal !== (file.state === "local")) {
          wrong.push(`${bundle.slug}: ${file.path} is ${file.state}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * A vocabulary file ships only with a bundle whose cards declare a local term
   * (doc 3 §7), and `exportBundle` writes it under exactly that condition. A fork listing
   * one has to have forked from a bundle that carries one, or the folder it describes
   * could not resolve the terms its cards name.
   */
  it("carries a vocabulary file only where the upstream has one", () => {
    const wrong: string[] = [];
    for (const bundle of DRAFTS) {
      const declares = (bundle.draft?.detail.files ?? []).some(
        (f) => f.path === BUNDLE_VOCABULARY,
      );
      if (!declares) continue;
      const upstream = bundle.forkedFrom;
      if (upstream === undefined) {
        wrong.push(`${bundle.slug} declares a vocabulary and has no upstream`);
        continue;
      }
      const published = allBlueprints().find((b) => b.slug === upstream.slug);
      if (published === undefined) wrong.push(`${bundle.slug}: ${upstream.slug} is not published`);
    }
    expect(wrong).toEqual([]);
  });
});

describe("the seeded history", () => {
  /**
   * The tags mean one thing each, and two of them may appear at most once: there is one
   * newest snapshot and one point at which a copy was taken. `upstream` is the release the
   * fork came from, drawn as the end of the list.
   */
  it("uses latest and fork point at most once per bundle", () => {
    const wrong: string[] = [];
    for (const bundle of DRAFTS) {
      const tags = (bundle.draft?.detail.history ?? []).map((entry) => entry.tag);
      for (const tag of ["latest", "fork point"] as const) {
        const n = tags.filter((t) => t === tag).length;
        if (n > 1) wrong.push(`${bundle.slug}: ${n} × ${tag}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  /** A bundle with no upstream cannot have a fork point or an upstream row. */
  it("tags lineage only on a bundle that has an upstream", () => {
    const wrong: string[] = [];
    for (const bundle of DRAFTS) {
      if (bundle.forkedFrom !== undefined) continue;
      const lineage = (bundle.draft?.detail.history ?? []).filter(
        (entry) => entry.tag === "fork point" || entry.tag === "upstream",
      );
      if (lineage.length > 0) wrong.push(`${bundle.slug} has ${lineage.length} lineage rows`);
    }
    expect(wrong).toEqual([]);
  });

  /**
   * A bundle that does not resolve has no digest, so it cannot have a release: a release
   * is the folder kept AT its digest. The blocked draft is the case, and this is what
   * stops a later edit from quietly giving it one.
   */
  it("gives no release to a bundle that does not resolve", () => {
    const wrong: string[] = [];
    for (const bundle of DRAFTS) {
      if (bundle.drift?.tone !== "blocked") continue;
      const releases = bundle.draft?.detail.releases ?? [];
      if (releases.length > 0) wrong.push(`${bundle.slug} has ${releases.length} releases`);
    }
    expect(wrong).toEqual([]);
  });
});

describe("the upstream-moved panel", () => {
  /**
   * The panel names a card and two versions and links the card's page. Both versions have
   * to exist there, or `Review the change` sends a reader to a page that does not show the
   * change. Held against the archive rather than against a list.
   */
  it("names a repin a reader can go and read", () => {
    const wrong: string[] = [];
    for (const bundle of DRAFTS) {
      const moved = bundle.draft?.detail.upstreamMoved;
      if (moved === undefined) continue;
      // `allNodeCards()` is one record per id, newest first. A repin is a claim about two
      // versions of one card, so the check has to walk that card's own history.
      const versions = new Set(nodeCardVersions(moved.card).map((record) => record.version));
      for (const version of [moved.from, moved.to]) {
        if (!versions.has(version)) {
          wrong.push(`${bundle.slug}: ${moved.card}@${version} is not in the archive`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
