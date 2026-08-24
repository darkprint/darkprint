/* ============================================================
   T220 — inspect provenance

   `/mcp` publishes it as *"who published it, what it was forked
   from, every release digest"*, and the block types the answer
   `Provenance { publishedBy; forkedFrom?; releases }`.

   ── what these cells assert and what they refuse to ──
   `releases` and `forkedFrom`'s PRESENCE are unambiguous and are
   asserted. Two things are not, and both are charged rather than
   guessed:

   `publishedBy` — charge 1/2 in the T220 log. After T250's
   re-attribution the owner of all nine seeded blueprints is
   `darkprint`, while `manifest.author` names one of six handles
   holding no account (D-250-18: re-attribution moves OWNERSHIP, not
   AUTHORSHIP, and both facts are true). The block rules neither, so
   these cells hold it to being a non-empty string — which both
   readings satisfy and `undefined` does not.

   `forkedFrom.owner` — charge 2. `BundleRecord.lineage` stores
   `ownerId`, a uuid, while `PublishInput.lineage` takes
   `ownerHandle`. A uuid there is unusable by the agent this surface
   exists for, but the block does not say which, so `owner` is held
   to being a non-empty string and `slug` and `version` — which are
   unambiguous — are pinned exactly.
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
    /* Charge 2: `owner` is unruled between a handle and a uuid, so only its inhabitedness is
       pinned. If the ruling lands on a handle, this tightens to `w.registry.handle`. */
    expect(typeof got.forkedFrom?.owner).toBe("string");
    expect(got.forkedFrom?.owner).not.toBe("");
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

    /* Charge 1/2: held to being a non-empty string and no more. `darkprint` (the owner) and
       one of the six manifest handles are both admissible readings today and the block
       rules neither; `undefined` is what BOTH candidate sources' optional types permit and
       is what this excludes. */
    expect(typeof got.publishedBy).toBe("string");
    expect(got.publishedBy).not.toBe("");
  });
});
