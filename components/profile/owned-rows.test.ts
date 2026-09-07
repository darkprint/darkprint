import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import type { OwnedBundleSummary } from "@/lib/server/registry";

import { ownedRowsFor } from "./owned-rows";

/* The archive credits each blueprint to the person who wrote it while the registry owner of
   all of them is one handle. The shelf has to pair by slug, or the owner's profile draws no
   graph at all. */

const ARCHIVE = allBlueprints();
const OWNER = "darkprint";

function live(slug: string): OwnedBundleSummary {
  return {
    slug,
    visibility: "public",
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    releaseCount: 1,
  };
}

describe("ownedRowsFor", () => {
  it("premise: the archive credits authors other than the registry owner", () => {
    const authors = new Set(ARCHIVE.map((b) => b.author.username));
    expect(authors.size, "the fixture no longer discriminates author from owner").toBeGreaterThan(1);
    expect([...authors].some((a) => a !== OWNER)).toBe(true);
  });

  it("pairs every live row whose slug the archive carries, whoever wrote it", () => {
    const rows = ownedRowsFor(OWNER, ARCHIVE.map((b) => live(b.slug)), ARCHIVE);
    expect(rows.length).toBe(ARCHIVE.length);
    for (const row of rows) {
      expect(row.blueprint, `${row.summary.slug} has no graph to draw`).toBeDefined();
      expect(row.blueprint?.slug).toBe(row.summary.slug);
    }
  });

  it("links a paired row at the owner in the URL, not at the archive author", () => {
    const credited = ARCHIVE.find((b) => b.author.username !== OWNER);
    expect(credited).toBeDefined();
    const [row] = ownedRowsFor(OWNER, [live(credited!.slug)], ARCHIVE);
    expect(row.blueprint?.ownerHandle).toBe(OWNER);
    // Attribution is untouched: the byline still names who wrote it.
    expect(row.blueprint?.author.username).toBe(credited!.author.username);
  });

  it("leaves a row the archive has never heard of as a summary alone", () => {
    const [row] = ownedRowsFor(OWNER, [live("published-through-the-site")], ARCHIVE);
    expect(row.blueprint).toBeUndefined();
    expect(row.summary.slug).toBe("published-through-the-site");
  });
});
