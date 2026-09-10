import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import type { OwnedBundleSummary } from "@/lib/server/registry";
import { blueprintRecordHref } from "@/lib/href";

import { ownedRowsFor } from "./owned-rows";

/* A shelf owner and the author an archive entry credits are two different facts: a fork or a
   bundle published through the site sits on a shelf whose owner wrote none of it. The shelf
   has to pair by slug, or such a profile draws no graph at all. The real archive credits its
   owner everywhere now, so the fixture below credits somebody else on purpose, to keep the two
   facts apart where the pairing rule is measured. */

const OWNER = "autogen";
const CREDITED = "someone-else";
const ARCHIVE = allBlueprints().map((b) => ({ ...b, author: { ...b.author, username: CREDITED } }));

function live(slug: string): OwnedBundleSummary {
  return {
    slug,
    visibility: "public",
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    releaseCount: 1,
  };
}

describe("ownedRowsFor", () => {
  it("premise: the fixture credits an author other than the shelf owner", () => {
    const authors = new Set(ARCHIVE.map((b) => b.author.username));
    expect([...authors]).toEqual([CREDITED]);
    expect(CREDITED).not.toBe(OWNER);
    expect(ARCHIVE.length).toBeGreaterThan(0);
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

  it("links every paired row at the canonical two-part address", () => {
    /* The shelf's row builds its href from the record it is handed, and a record without
       an owner falls back to the one-segment address, a 404 for any slug two accounts hold. */
    const rows = ownedRowsFor(OWNER, ARCHIVE.map((b) => live(b.slug)), ARCHIVE);
    for (const row of rows) {
      expect(blueprintRecordHref(row.blueprint!)).toBe(`/blueprints/${OWNER}/${row.summary.slug}`);
    }
  });

  it("leaves a row the archive has never heard of as a summary alone", () => {
    const [row] = ownedRowsFor(OWNER, [live("published-through-the-site")], ARCHIVE);
    expect(row.blueprint).toBeUndefined();
    expect(row.summary.slug).toBe("published-through-the-site");
  });
});
