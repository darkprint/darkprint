/* ============================================================
   T250 — the instruments, measured before they are used

   Every cell in this file is about THIS SUITE, not about
   `lib/server/seed`. Nothing here imports the module under test, so
   every cell is green in the blind position and stays green after
   the hand-off. That is the point: an all-green suite is a claim
   about an instrument too, and the standards the rest of the suite
   measures against have to be shown to work before a red anywhere
   else can be read as the implementer's.

   Three of these are near-misses rather than assertions of fact:
   they exist to show that the oracle beside them DISCRIMINATES,
   because zero errors alone is resolution and green-against-red on
   two shapes differing by one member is discrimination.
   ============================================================ */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cardDigest } from "@/lib/core";
import { allBlueprints, allNodeCards, nodeCardVersions } from "@/lib/content";
import { COMMUNITY } from "@/lib/data/community";

import {
  EXPECTED_AUTHORS,
  EXPECTED_BUNDLES,
  EXPECTED_CARD_FILES,
  EXPECTED_CARD_IDS,
  OVERLAY_TERM,
  REPO_ROOT,
  bundleSlugs,
  cardFiles,
  cardIds,
  inventedAuthors,
  printedDigests,
} from "./contract";

/** The bundles `lib/data/community.ts` seeds figures for: the archive as it stood when that fixture was written. */
const SEEDED_FIGURE_BUNDLES = 9;

/** Every card version in the archive, all 61 of them. See the enumeration cell for why not `allNodeCards`. */
function allCardVersions(): { id: string; version: string; card: Record<string, unknown> }[] {
  const out: { id: string; version: string; card: Record<string, unknown> }[] = [];
  for (const id of cardIds()) {
    for (const record of nodeCardVersions(id)) {
      const card = (record as { card?: unknown }).card ?? record;
      out.push({
        id: (card as { id: string }).id,
        version: (card as { version: string }).version,
        card: card as Record<string, unknown>,
      });
    }
  }
  return out;
}

describe("the archive this task imports", () => {
  /**
   * The completeness guard, and it is a cell rather than a check inside `printedDigests`.
   *
   * `it.each(printedDigests())` lets the SCAN decide how many cells exist, so a scan that found
   * three would be three green cells and six that were never written, with nothing in the
   * numbers to say so. A throw inside the scan function would land in whichever hook called it
   * first and produce SKIPS, which is quieter still.
   */
  it("prints ten bundle digests, so AC1's per-bundle cell list is ten long", () => {
    expect(printedDigests().map((b) => b.slug)).toEqual([...bundleSlugs()]);
    expect(printedDigests()).toHaveLength(EXPECTED_BUNDLES);
  });

  it("carries 61 card files across 57 distinct ids, and ten bundles", () => {
    expect(cardFiles()).toHaveLength(EXPECTED_CARD_FILES);
    expect(cardIds()).toHaveLength(EXPECTED_CARD_IDS);
    expect(bundleSlugs()).toHaveLength(EXPECTED_BUNDLES);
  });

  /**
   * D-250-13's second half, pinned rather than merely avoided.
   *
   * `allNodeCards()` is "the newest version of every distinct card id" and answers 53 where the
   * archive holds 57. A suite enumerating card files through it tests 53 of 57 and reads as full
   * coverage. Both numbers are asserted, so the day that helper changes its mind the red says
   * which of the two moved.
   */
  it("needs nodeCardVersions to reach all 61: allNodeCards answers 57", () => {
    expect(allNodeCards()).toHaveLength(EXPECTED_CARD_IDS);
    expect(allCardVersions()).toHaveLength(EXPECTED_CARD_FILES);
  });

  it("names exactly six invented authors", () => {
    expect(inventedAuthors()).toEqual([
      "hachi",
      "k0bra",
      "lupo",
      "mara-veil",
      "orin",
      "sol-antczak",
    ]);
    expect(inventedAuthors()).toHaveLength(EXPECTED_AUTHORS);
  });

  it("carries one overlay term, and its id sits in an invented namespace (D-250-06)", () => {
    const text = readFileSync(`${REPO_ROOT}content/ontology/extensions.yaml`, "utf8");
    const ids = [...text.matchAll(/^\s*-\s+id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
    expect(ids).toEqual([OVERLAY_TERM]);
    expect(OVERLAY_TERM.split("/")[0]).toBe("lupo");
    expect(inventedAuthors()).toContain("lupo");
  });
});

describe("AC1's oracle: the digest the site prints today", () => {
  /**
   * `public/bundles/<slug>/README.md` line 7 prints the digest. Those are committed generated
   * bytes written by `scripts/generate-bundles.ts` out of `lib/content`, which is this task's
   * FORBIDDEN, so the standard and the thing measured against it have different authors.
   *
   * This cell is what licenses using either one: it shows the two agree today, so a later
   * disagreement between the plan and the README is a claim about the plan rather than about
   * which of two oracles was picked.
   */
  it("agrees with lib/content on all ten, element-wise", () => {
    const printed = Object.fromEntries(printedDigests().map((b) => [b.slug, b.digest]));
    const fromContent = Object.fromEntries(
      allBlueprints().map((b) => [b.slug, (b as { digest?: string }).digest]),
    );
    expect(fromContent).toEqual(printed);
  });

  /**
   * The near-miss. Flipping ONE hex character of ONE of the nine has to red the comparison
   * above, or that comparison is resolving rather than discriminating.
   */
  it("discriminates: one hex character of one of the ten is enough to disagree", () => {
    const printed = Object.fromEntries(printedDigests().map((b) => [b.slug, b.digest]));
    const perturbed = { ...printed };
    const first = printedDigests()[0];
    perturbed[first.slug] = `${first.digest.slice(0, -1)}${first.digest.endsWith("0") ? "1" : "0"}`;
    expect(perturbed).not.toEqual(printed);
    expect(perturbed[first.slug]).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("re-attribution is digest-safe, measured rather than read", () => {
  /**
   * The block's "digest-safe by construction" claim, driven over the whole archive.
   *
   * `lib/core/hash/digest.ts` excludes `author` and `provenance` from `cardDigest`, and
   * `bundleDigest` takes `{dot, cardDigests}` only, so the manifest that carries `author` is
   * outside a bundle's identity as well. That is the reason AC1 and AC4 can both hold.
   */
  it("cardDigest is unchanged by re-attribution, across all 61 card versions", () => {
    const moved = allCardVersions()
      .filter(({ card }) => cardDigest(card as never) !== cardDigest({ ...card, author: "darkprint" } as never))
      .map(({ id, version }) => `${id}@${version}`);
    expect(moved).toEqual([]);
  });

  /**
   * The near-miss, and it is in the opposite direction from the one above: the cell above says
   * a digest does NOT move, so on its own it is satisfied by a `cardDigest` that always returns
   * the same string. Perturbing a field that IS in the identity has to move all 57.
   */
  it("discriminates: a field inside the identity moves every one of the 61", () => {
    const moved = allCardVersions()
      .filter(({ card }) => cardDigest(card as never) !== cardDigest({ ...card, name: `${String(card.name)}!` } as never))
      .map(({ id, version }) => `${id}@${version}`);
    expect(moved).toHaveLength(EXPECTED_CARD_FILES);
  });
});

describe("AC3's second axis: there were numbers to import", () => {
  /**
   * D-250-10 ratified the construction and this is its far half.
   *
   * "All imported counters read zero" is a negative satisfied by writing nothing, so a green
   * AC3 cell says something only if the figures it refused to import actually exist. They are
   * in `lib/data/community.ts`, which is this task's FORBIDDEN and therefore a source the
   * implementer cannot have written.
   */
  it("lib/data seeds non-zero downloads and votes for every archive bundle", () => {
    const slugs = [...bundleSlugs()];
    const seeded = slugs.map((slug) => COMMUNITY[slug]).filter((s) => s !== undefined);
    expect(seeded.length).toBeGreaterThan(0);

    /* `> 0` on a number, not truthiness: a seeded `"0"` is truthy and would pass a check that
       only asked whether a figure was there. */
    for (const signals of seeded) {
      expect(typeof signals.downloads).toBe("number");
      expect(signals.downloads).toBeGreaterThan(0);
      expect(typeof signals.votes).toBe("number");
      expect(signals.votes).toBeGreaterThan(0);
    }
  });

  /** The contract quotes this figure by name, so it is pinned by name. */
  it("carries the 8,940 the contract names as the failure it guards against", () => {
    const downloads = Object.values(COMMUNITY).map((s) => s.downloads);
    expect(downloads).toContain(8940);
  });

  /**
   * AC3 IS A LIVE HAZARD, NOT A THEORETICAL ONE, and this is the cell that says so.
   *
   * D-250-01 rules that `runImport` obtains its bytes through `readContent()`. The record that
   * loader hands back for a blueprint carries `downloads` and `votes` INLINE, on the same object
   * as `digest` and `cardRefs` — so the numbers are not somewhere the import has to go looking
   * for, they are in its hand the moment it reads the thing it actually needs.
   *
   * That is what makes "no counted figure is written as a stored counter" a discipline rather
   * than an accident. A record copied wholesale imports the figures; only a record read field by
   * field does not.
   */
  it("hands the seeded figures back on the same object as the digest", () => {
    const records = allBlueprints() as unknown as {
      slug: string;
      digest?: string;
      downloads?: unknown;
      votes?: unknown;
    }[];
    expect(records).toHaveLength(EXPECTED_BUNDLES);

    /* Nine, not every bundle: `lib/data/community.ts` seeds figures for the bundles that were
       in the archive when it was written, and `pipeline-observability` came later with no row,
       so the index zero-fills it. The discipline this cell guards is that no seeded figure is
       stored as a counter, and a bundle that seeds nothing cannot break it either way. */
    const withFigures = records.filter(
      (b) => typeof b.downloads === "number" && (b.downloads as number) > 0,
    );
    expect(withFigures).toHaveLength(SEEDED_FIGURE_BUNDLES);
    expect(withFigures.map((b) => b.slug)).not.toContain("pipeline-observability");

    /* The one the contract names, on the same object as its digest. */
    const loud = records.find((b) => b.downloads === 8940);
    expect(loud?.slug).toBe("starter-software-factory");
    expect(loud?.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  /**
   * The twelve seeded notes of §T250's `Open`, counted rather than recalled.
   *
   * No criterion covers them and this suite writes no note cell. The count is asserted so the
   * open question has a measured number attached to it: the notes travel on the same records as
   * everything else, and they are written in the six invented voices D-250-11 rules out of
   * existence as accounts.
   */
  it("carries twelve seeded community notes across the ten bundles", () => {
    const comments = (allBlueprints() as unknown as { comments?: unknown[] }[]).map(
      (b) => (Array.isArray(b.comments) ? b.comments.length : 0),
    );
    expect(comments.reduce((a, b) => a + b, 0)).toBe(12);
  });
});

describe("D-250-13: the prefix traps, checked rather than assumed", () => {
  /**
   * The negative, over every set this suite treats as holding distinct members. Zero pairs is
   * the answer today, and the cell exists so that a tenth bundle or a fifty-eighth card whose
   * identifier contains another's is loud rather than a silently collapsed cell.
   */
  it("no identifier inside content/** contains another", () => {
    const sets: Record<string, readonly string[]> = {
      slugs: bundleSlugs(),
      cardIds: cardIds(),
      cardRefs: cardFiles().map((f) => f.replace(/\.yaml$/, "")),
      authors: inventedAuthors(),
    };
    const pairs: string[] = [];
    for (const [name, values] of Object.entries(sets)) {
      for (const a of values) {
        for (const b of values) {
          if (a !== b && b.includes(a)) pairs.push(`${name}: ${a} inside ${b}`);
        }
      }
    }
    expect(pairs).toEqual([]);
  });

  /**
   * And the positive, which is the half worth writing down. All three private bundle slugs in
   * `lib/data/bundles.ts` strictly CONTAIN a real archive slug, so any cell anywhere in this
   * suite that matched a slug by substring would collapse the public row into the private one.
   * Pinned so the hazard is a fact this suite asserts rather than a habit it happens to keep.
   */
  it("every private fixture slug strictly contains an archive slug", () => {
    const source = readFileSync(`${REPO_ROOT}lib/data/bundles.ts`, "utf8");
    const owned = [...source.matchAll(/^\s*slug: "([^"]+)",\s*$/gm)].map((m) => m[1]);
    const archive = new Set(bundleSlugs());
    const containing = owned.filter((s) => !archive.has(s) && [...archive].some((a) => s.includes(a)));
    expect(containing.sort()).toEqual([
      "frontline-triage-eu",
      "guarded-merge-bot-hardened",
      "incident-commander-draft",
    ]);
  });
});
