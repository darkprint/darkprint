/* ============================================================
   T220 — inspect provenance

   `/mcp` publishes it as *"who published it, what it was forked
   from, every release digest"*, and the block types the answer
   `Provenance { publishedBy; forkedFrom?; releases }`.

   ── what these cells assert and what they refuse to ──
   `releases` and `forkedFrom`'s PRESENCE are unambiguous and are
   asserted. Two things are not, and both are charged rather than
   guessed:

   Both were charged as unruled before these cells were written and
   both were ruled at D-220-05, so both are now pinned exactly:
   `publishedBy` is the OWNER's handle — `darkprint` for every seeded
   blueprint after T250 — and NOT `manifest.author`, which names one
   of six handles holding no account and which T250 deliberately left
   in place (D-250-18: re-attribution moved OWNERSHIP, not
   AUTHORSHIP, and both facts are true). `forkedFrom` resolves
   `lineage.ownerId` — a UUID in the store — to a handle.

   The seeded blueprints make the two readings DISAGREE rather than
   coincide, which is what lets these cells discriminate: every one
   of the nine is owned by `darkprint` and carries a manifest author
   that is not.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { verb } from "./contract";
import { anonymous, dropScratchDatabases, seededWorld } from "./fixtures";

const world = seededWorld();

interface Provenance {
  publishedBy?: unknown;
  forkedFrom?: { owner?: unknown; slug?: unknown; version?: unknown };
  releases?: readonly { version?: unknown; digest?: unknown }[];
}

afterAll(async () => {
  await dropScratchDatabases();
});

describe("T220 — inspect provenance", () => {
  it("lists EVERY release digest, not only the current one", async () => {
    const w = await world();
    /* The premise this cell exists for. A bundle with one release cannot distinguish "every
       release" from "the current release", so the fixture publishes a second one and the
       two digests are asserted distinct before anything is bound. */
    expect(w.first.digest).not.toBe(w.second.digest);

    const provenance = await verb("mcpProvenance");
    const got = (await provenance(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
    )) as Provenance;

    const digests = (got.releases ?? []).map((r) => r.digest);
    expect(
      digests,
      "`inspect provenance` returns every release digest. A bundle at two releases that " +
        "answers one is answering the CURRENT release, which is the reference `/mcp` calls " +
        "the moving one.",
    ).toContain(w.first.digest);
    expect(digests).toContain(w.second.digest);
    expect(digests).toHaveLength(2);
  });

  it("names what the bundle was forked from", async () => {
    const w = await world();
    /* The fixture published this one with `lineage`, so a `forkedFrom` is owed. */
    expect(w.fork.slug).not.toBe(w.twice);

    const provenance = await verb("mcpProvenance");
    const got = (await provenance(
      w.scratch.db,
      anonymous,
      w.fork.ownerHandle,
      w.fork.slug,
    )) as Provenance;

    expect(got.forkedFrom, "this bundle was published with a lineage").toBeDefined();
    expect(got.forkedFrom?.slug).toBe(w.twice);
    expect(got.forkedFrom?.version).toBe("1.0.0");
    /* D-220-05 settled charge 2: `forkedFrom` resolves `lineage.ownerId` — a UUID in the
       store — to a HANDLE. Pinned exactly now, and the uuid is excluded by name rather than
       merely admitting the handle: `toBeTruthy()` would pass on the uuid, which is the
       reading that makes the field unusable for the agent this surface exists for. */
    expect(got.forkedFrom?.owner).toBe(w.registry.handle);
    expect(got.forkedFrom?.owner).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("omits `forkedFrom` for a bundle that is not a fork", async () => {
    const w = await world();
    /* The disagreeing control. Without it, a module that never populates `forkedFrom`
       passes nothing above, but a module that populates it ALWAYS — with the bundle's own
       key, say — passes the cell above and is wrong about every original in the registry. */
    const provenance = await verb("mcpProvenance");
    const got = (await provenance(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
    )) as Provenance;

    expect(
      got.forkedFrom,
      "`forkedFrom` is optional and this bundle was published with no lineage. A value here " +
        "means the field is being filled unconditionally.",
    ).toBeUndefined();
  });

  it("says who published it", async () => {
    const w = await world();
    const provenance = await verb("mcpProvenance");
    const got = (await provenance(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
    )) as Provenance;

    /* D-220-05 settled charge 1: `publishedBy` is the OWNER's handle. Pinned exactly, and
       the six manifest handles are excluded by name — those are the stale claims T250
       deliberately left in place (D-250-18), and an agent cannot act on a handle that holds
       no account. This blueprint's manifest carries one of them, so the two readings really
       do disagree here rather than coinciding. */
    expect(got.publishedBy).toBe(w.registry.handle);
    expect(
      ["hachi", "k0bra", "lupo", "mara-veil", "orin", "sol-antczak"],
      "`publishedBy` carried the manifest's author rather than the owner. Re-attribution " +
        "moved OWNERSHIP, not AUTHORSHIP (D-250-18) — both facts are true and this field " +
        "is the ownership one.",
    ).not.toContain(got.publishedBy);
  });
});
