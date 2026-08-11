/* ============================================================
   The four names the profile tabs took out of the bundle namespace.

   A bundle a reader owns lives at `/u/<handle>/<slug>`, and the tab
   routes are static siblings of that dynamic segment. Next resolves
   a static segment first, so a bundle called `saved` would be a page
   nobody could ever open: no error, no 404, just the wrong page
   forever. Nothing in `tsc`, `eslint` or a build notices.

   So the collision is checked here, over both populations that can
   produce a slug — the published archive and the seeded owner list.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { allBlueprints, allNodeCards } from "@/lib/content";
import { OWNED_BUNDLES } from "@/lib/data/bundles";
import { PROFILES } from "@/lib/data/profiles";
import { AUTHOR_LIST } from "@/lib/data/users";
import { PROFILE_TABS, RESERVED_PROFILE_SEGMENTS, profileTabHref } from "./tabs";

describe("the profile tabs", () => {
  it("reserves a segment for every tab but the overview", () => {
    // A walk that found nothing would pass every collision case below.
    expect(RESERVED_PROFILE_SEGMENTS.length).toBe(PROFILE_TABS.length - 1);
    expect(RESERVED_PROFILE_SEGMENTS).toContain("saved");
  });

  it("puts the overview at the profile root", () => {
    const overview = PROFILE_TABS.find((tab) => tab.id === "overview");
    expect(overview).toBeDefined();
    expect(profileTabHref("mara-veil", overview!)).toBe("/u/mara-veil");
  });

  it("gives every other tab a route under the handle", () => {
    for (const tab of PROFILE_TABS.filter((t) => t.id !== "overview")) {
      expect(profileTabHref("mara-veil", tab)).toBe(`/u/mara-veil/${tab.segment}`);
    }
  });
});

describe("no bundle slug is shadowed by a tab", () => {
  it("holds every published slug clear of the reserved segments", () => {
    const published = allBlueprints().map((b) => b.slug);
    expect(published.length).toBeGreaterThan(0);
    expect(published.filter((slug) => RESERVED_PROFILE_SEGMENTS.includes(slug))).toEqual([]);
  });

  it("holds every owned bundle clear of them too", () => {
    const owned = OWNED_BUNDLES.map((b) => b.slug);
    expect(owned.length).toBeGreaterThan(0);
    expect(owned.filter((slug) => RESERVED_PROFILE_SEGMENTS.includes(slug))).toEqual([]);
  });
});

describe("the seeded owner list keeps its own rules", () => {
  /**
   * A public bundle is a claim about the registry: that a reader can open it, resolve it
   * and check the score against the graph. A row in `lib/data/bundles.ts` cannot make that
   * true, so a seeded row is private and a public row names a bundle the archive carries.
   */
  it("publishes nothing the archive does not carry", () => {
    const published = new Set(allBlueprints().map((b) => b.slug));
    const claimed = OWNED_BUNDLES.filter(
      (b) => b.visibility === "public" && !published.has(b.slug),
    ).map((b) => b.slug);
    expect(claimed).toEqual([]);
  });

  /** The mirror of the rule above: an archive-backed row must not carry a hand-written
      title, digest or version, because the archive has the real ones. */
  it("reads a published row off the archive rather than out of a fixture", () => {
    const published = new Set(allBlueprints().map((b) => b.slug));
    const duplicated = OWNED_BUNDLES.filter(
      (b) => published.has(b.slug) && b.draft !== undefined,
    ).map((b) => b.slug);
    expect(duplicated).toEqual([]);
  });

  /** And an unpublished row has to carry them, or it renders as a blank line. */
  it("gives every unpublished row the fields it has no archive for", () => {
    const published = new Set(allBlueprints().map((b) => b.slug));
    const bare = OWNED_BUNDLES.filter(
      (b) => !published.has(b.slug) && b.draft === undefined,
    ).map((b) => b.slug);
    expect(bare).toEqual([]);
  });

  /** Every lineage points at a bundle a reader can actually open. */
  it("points every upstream at a published blueprint", () => {
    const published = new Set(allBlueprints().map((b) => b.slug));
    const dangling = OWNED_BUNDLES.filter(
      (b) => b.forkedFrom !== undefined && !published.has(b.forkedFrom.slug),
    ).map((b) => `${b.slug} → ${b.forkedFrom?.slug}`);
    expect(dangling).toEqual([]);
  });
});

/**
 * A pin names something in the archive, which is what lets the Pinned section carry
 * `✓ counted`: the *selection* is seeded and everything drawn on the card is read off the
 * bundle. A pin at a slug or a card ref the archive does not carry renders nothing at all,
 * and a profile silently missing its first section is not a failure anybody would notice.
 */
describe("every pin resolves", () => {
  const slugs = new Set(allBlueprints().map((b) => b.slug));
  const refs = new Set(allNodeCards().map((record) => record.ref));

  it("has a profile row for every author in the table", () => {
    const missing = AUTHOR_LIST.filter((a) => PROFILES[a.username] === undefined).map(
      (a) => a.username,
    );
    expect(missing).toEqual([]);
  });

  it("pins only blueprints and cards the archive carries", () => {
    const dangling: string[] = [];
    for (const [username, profile] of Object.entries(PROFILES)) {
      for (const pin of profile.pinned) {
        const known = pin.kind === "blueprint" ? slugs.has(pin.slug) : refs.has(pin.ref);
        if (!known) dangling.push(`${username} → ${JSON.stringify(pin)}`);
      }
    }
    expect(dangling).toEqual([]);
  });
});
