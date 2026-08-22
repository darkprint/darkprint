/* ============================================================
   T100 — AC4, AC7, AC8, and the closed set of refusal kinds

   AC4: "publishing a fork leaves the upstream's bytes, digest and
        releases untouched"
   AC7: "a non-owner publishing to an existing (owner, slug) is
        refused"
   AC8: "a declared semver lower than the previous release is
        refused"

   Two owners, one scratch database: every criterion here is about
   one account acting on another's namespace, so they share a
   fixture rather than each standing up a database to seed the same
   two rows.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MESSAGE_FORMS, REFUSAL_KINDS, boundPublish, refusalFrom, resultOf } from "./contract";
import {
  RecordedSetup,
  describeAdded,
  resolvingCorpus,
  revisionOf,
  rowsAdded,
  scratchDatabase,
  seedOwner,
  snapshotRows,
  totalRowsAdded,
  type Corpus,
  type Owner,
  type Scratch,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  alice: Owner;
  bob: Owner;
  /** An owner whose account default is `private`, for the visibility fallback. */
  priv: Owner;
  base: Corpus;
  revision: Corpus;
}

const setup = new RecordedSetup<Env>("The ownership scratch database and two owners");

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("ownership");
    const base = resolvingCorpus();
    return {
      scratch,
      alice: await seedOwner(scratch, "alice"),
      bob: await seedOwner(scratch, "bob"),
      priv: await seedOwner(scratch, "quietly", "private"),
      base,
      revision: revisionOf(base),
    };
  });
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

/* --------------------- AC7 --------------------- */

describe("T100 AC7 — a non-owner is refused", () => {
  it("refuses bob publishing onto alice's existing (owner, slug)", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    await publish(env.scratch.db, env.alice.actor, {
      ownerHandle: env.alice.handle,
      slug: "alices-bundle",
      version: "1.0.0",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.bob.actor, {
        ownerHandle: env.alice.handle,
        slug: "alices-bundle",
        version: "2.0.0",
        manifest: env.revision.manifest,
        dot: env.revision.dot,
        cardFiles: env.revision.cardFiles,
      }),
      "AC7",
    );

    expect(
      refusal.kind,
      `AC7: bob appending to alice's bundle came back as ${JSON.stringify(refusal.kind)}.\n` +
        `  Message: ${refusal.message}`,
    ).toBe("not-owner");

    expect(
      MESSAGE_FORMS["not-owner"].exec(refusal.message),
      `AC7: the message is not the admissible form.\n` +
        `  Expected: publish: not-owner — not this bundle's owner.\n` +
        `  Actual:   ${refusal.message}`,
    ).not.toBeNull();
  });

  it("refuses bob CREATING a new slug under alice's handle", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    /* D-100-01 S4: the create path, where there is no bundle yet to not-own. AC7 as written
       covers only "an existing (owner, slug)", and the ruling closed the gap without adding a
       sixth kind — this is `not-owner` too. It is the security-relevant half: without it, any
       signed-in account could plant bundles in anybody's namespace as long as it picked a slug
       nobody had taken. */
    const refusal = await refusalFrom(
      publish(env.scratch.db, env.bob.actor, {
        ownerHandle: env.alice.handle,
        slug: "slug-alice-never-took",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "AC7 create path",
    );

    expect(
      refusal.kind,
      `AC7 create path: bob creating a bundle under alice's handle came back as ` +
        `${JSON.stringify(refusal.kind)}.\n  Message: ${refusal.message}`,
    ).toBe("not-owner");
  });

  it("leaves nothing behind, and no bundle appears in alice's namespace", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const before = await snapshotRows(env.scratch);
    await refusalFrom(
      publish(env.scratch.db, env.bob.actor, {
        ownerHandle: env.alice.handle,
        slug: "not-owner-leaves-nothing",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "AC7",
    );
    const added = rowsAdded(before, await snapshotRows(env.scratch));

    expect(
      totalRowsAdded(added),
      `AC7: the refused publish left rows behind (${describeAdded(added)}).\n` +
        `  A refusal that still wrote the cards has handed a stranger a foothold in the store.`,
    ).toBe(0);

    const { getBundle } = await import("@/lib/server/archive");
    expect(
      await getBundle(env.scratch.db, env.alice.accountId, "not-owner-leaves-nothing"),
      "AC7: a bundle now exists in alice's namespace that alice never published.",
    ).toBeUndefined();
  });
});

/* --------------------- AC8 --------------------- */

describe("T100 AC8 — a semver not higher than the previous release is refused", () => {
  it("refuses a lower version", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    await publish(env.scratch.db, env.alice.actor, {
      ownerHandle: env.alice.handle,
      slug: "versioned-bundle",
      version: "2.0.0",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.alice.actor, {
        ownerHandle: env.alice.handle,
        slug: "versioned-bundle",
        version: "1.0.0",
        /* Different bytes, so the digest conflict is NOT available and the version comparison
           is the only refusal left. Without this the cell would pass on an implementation that
           only ever checks digests. */
        manifest: env.revision.manifest,
        dot: env.revision.dot,
        cardFiles: env.revision.cardFiles,
      }),
      "AC8",
    );

    expect(
      refusal.kind,
      `AC8: 1.0.0 against a stored 2.0.0 came back as ${JSON.stringify(refusal.kind)}.\n` +
        `  Message: ${refusal.message}`,
    ).toBe("version-not-higher");

    const match = MESSAGE_FORMS["version-not-higher"].exec(refusal.message);
    expect(
      match,
      `AC8: the message is not the admissible form.\n` +
        `  Expected: publish: version-not-higher — \`<declared>\` is not higher than \`<previous>\`.\n` +
        `  Actual:   ${refusal.message}`,
    ).not.toBeNull();

    /* Declared first, previous second — in that order. A message with the two transposed reads
       as a complaint about the release the author already published. */
    expect(
      [match?.[1], match?.[2]],
      `AC8: the sentence names \`${match?.[1]}\` and \`${match?.[2]}\`; the caller declared ` +
        `1.0.0 and the previous release is 2.0.0.`,
    ).toEqual(["1.0.0", "2.0.0"]);
  });

  it("refuses an EQUAL version — \"not higher\" admits equal", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    await publish(env.scratch.db, env.alice.actor, {
      ownerHandle: env.alice.handle,
      slug: "equal-version-bundle",
      version: "1.0.0",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    /* Same version, different bytes. D-100-01: "not higher" admits equal, so the version is
       refused here before the unique index could ever see it, and an implementation that let
       this through would surface T010's store error to a caller instead of one of the five
       kinds.

       **Sequentially.** D-100-03 corrected the over-general form of that sentence, and this
       cell does not assert it: `publish` reads the existing releases BEFORE it opens its
       transaction, so two callers racing past this check with the same declared version both
       pass the read and the unique index raises `ArchiveConflictError("release-version")` from
       inside the write. That class is reachable through publish under a race — it is mapped to
       409 at the route — and nothing here claims otherwise. What this cell asserts is the
       sequential behaviour, which is what a single caller sees. */
    const refusal = await refusalFrom(
      publish(env.scratch.db, env.alice.actor, {
        ownerHandle: env.alice.handle,
        slug: "equal-version-bundle",
        version: "1.0.0",
        manifest: env.revision.manifest,
        dot: env.revision.dot,
        cardFiles: env.revision.cardFiles,
      }),
      "AC8 equal",
    );

    expect(
      refusal.kind,
      `AC8: republishing at the same version with different bytes came back as ` +
        `${JSON.stringify(refusal.kind)}.\n  Message: ${refusal.message}`,
    ).toBe("version-not-higher");
  });

  it("takes \"previous\" as the HIGHEST semver, not the most recent by createdAt", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { addRelease, createBundle } = await import("@/lib/server/archive");

    /* **Planted through T010 rather than through publish, and that is the only way to reach
       this state.** `publish` refuses anything not higher than the previous release, so a
       bundle driven only through it can never hold releases whose semver order and creation
       order disagree. Writing 3.0.0 first and 1.0.0 second makes the two readings diverge:
       highest semver is 3.0.0, most recent by `createdAt` is 1.0.0.

       The state is legitimate rather than contrived — `listReleases` orders by `createdAt` and
       T010 imposes no semver ordering of its own, so any importer or backfill can produce it. */
    const bundle = await createBundle(env.scratch.db, {
      ownerId: env.alice.accountId,
      slug: "out-of-order-bundle",
      visibility: "public",
    });
    const blueprint = (await import("./fixtures")).validate(env.base).blueprint;
    if (blueprint === undefined) throw new Error("AC8 premise: the corpus does not resolve.");

    for (const version of ["3.0.0", "1.0.0"]) {
      await addRelease(env.scratch.db, {
        bundleId: bundle.id,
        version,
        dot: `${env.base.dot}\n// ${version}\n`,
        manifest: env.base.manifest,
        cardRefs: blueprint.nodes.map((n) => n.ref),
        cardDigests: blueprint.nodes.map((n) => n.digest),
      });
    }

    /* 2.0.0 is higher than the most recently created release (1.0.0) and lower than the
       highest (3.0.0). An implementation reading "previous" off `listReleases`' last row
       accepts it; the contract says it must be refused. */
    const refusal = await refusalFrom(
      publish(env.scratch.db, env.alice.actor, {
        ownerHandle: env.alice.handle,
        slug: "out-of-order-bundle",
        version: "2.0.0",
        manifest: env.revision.manifest,
        dot: env.revision.dot,
        cardFiles: env.revision.cardFiles,
      }),
      "AC8 previous",
    );

    expect(
      refusal.kind,
      `AC8: with releases 3.0.0 and 1.0.0 stored in that creation order, 2.0.0 came back as ` +
        `${JSON.stringify(refusal.kind)}.\n` +
        `  D-100-01: "previous" is the HIGHEST semver (3.0.0), not the most recent by ` +
        `\`createdAt\` (1.0.0). Reading the last row of \`listReleases\` accepts this publish.\n` +
        `  Message: ${refusal.message}`,
    ).toBe("version-not-higher");

    const match = MESSAGE_FORMS["version-not-higher"].exec(refusal.message);
    expect(
      match?.[2],
      `AC8: the refusal names \`${match?.[2]}\` as the previous release; the highest stored ` +
        `semver is 3.0.0.`,
    ).toBe("3.0.0");
  });
});

/* --------------------- AC4 --------------------- */

describe("T100 AC4 — publishing a fork leaves the upstream untouched", () => {
  it("changes neither the upstream's digest, its release list, nor its bytes", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { getBundle, listReleases } = await import("@/lib/server/archive");

    const upstream = resultOf(
      await publish(env.scratch.db, env.alice.actor, {
        ownerHandle: env.alice.handle,
        slug: "upstream",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "AC4",
    );

    /* Captured BEFORE, compared AFTER. "AC4 is a non-effect and non-effects are the ones that
       go untested" — the criterion is asserted by comparing the upstream's own state across
       the fork, not by observing that no error came back. */
    const before = {
      digest: upstream.digest,
      releases: (await listReleases(env.scratch.db, upstream.bundleId)).map((r) => ({
        version: r.version,
        digest: r.digest,
        dot: r.dot,
      })),
      bundle: await getBundle(env.scratch.db, env.alice.accountId, "upstream"),
    };

    const fork = resultOf(
      await publish(env.scratch.db, env.bob.actor, {
        ownerHandle: env.bob.handle,
        slug: "downstream",
        version: "1.0.0",
        manifest: env.revision.manifest,
        dot: env.revision.dot,
        cardFiles: env.revision.cardFiles,
        lineage: { ownerHandle: env.alice.handle, slug: "upstream", version: "1.0.0" },
      }),
      "AC4",
    );

    const after = {
      releases: (await listReleases(env.scratch.db, upstream.bundleId)).map((r) => ({
        version: r.version,
        digest: r.digest,
        dot: r.dot,
      })),
      bundle: await getBundle(env.scratch.db, env.alice.accountId, "upstream"),
    };

    expect(
      after.releases,
      "AC4: the fork changed the upstream's releases. \"It does not touch the upstream and the " +
        "lineage line stays.\"",
    ).toEqual(before.releases);

    expect(
      after.releases.map((r) => r.digest),
      `AC4: the upstream's stored digest moved when the fork was published.`,
    ).toEqual([before.digest]);

    expect(
      after.bundle?.updatedAt,
      "AC4: the fork touched the upstream bundle row — its `updatedAt` moved, so something " +
        "wrote to it.",
    ).toEqual(before.bundle?.updatedAt);

    /* And the fork is genuinely a separate bundle rather than a release on the upstream. */
    expect(
      fork.bundleId,
      "AC4: the fork landed on the upstream's own bundle id, so it is a release of the " +
        "upstream rather than a fork of it.",
    ).not.toBe(upstream.bundleId);
  });

  it("records the lineage on the fork", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { getBundle } = await import("@/lib/server/archive");

    await publish(env.scratch.db, env.alice.actor, {
      ownerHandle: env.alice.handle,
      slug: "lineage-upstream",
      version: "1.0.0",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    await publish(env.scratch.db, env.bob.actor, {
      ownerHandle: env.bob.handle,
      slug: "lineage-fork",
      version: "1.0.0",
      manifest: env.revision.manifest,
      dot: env.revision.dot,
      cardFiles: env.revision.cardFiles,
      lineage: { ownerHandle: env.alice.handle, slug: "lineage-upstream", version: "1.0.0" },
    });

    const forked = await getBundle(env.scratch.db, env.bob.accountId, "lineage-fork");

    /* `PublishInput.lineage` carries an `ownerHandle` and `CreateBundleInput.lineage` carries an
       `ownerId`, so this also asserts the resolution D-100-01 published `resolveOwner` for: a
       lineage recorded against the handle string, or against nothing, loses the link the moment
       alice renames. */
    expect(
      forked?.lineage,
      `AC4: the fork's lineage is ${JSON.stringify(forked?.lineage)}.\n` +
        `  "the lineage line stays" (components/bundle/Aside.tsx:92-95), and it is stored ` +
        `against alice's account id (${env.alice.accountId}) rather than her handle.`,
    ).toEqual({ ownerId: env.alice.accountId, slug: "lineage-upstream", version: "1.0.0" });
  });
});

/* --------------------- visibility --------------------- */

describe("T100 — an omitted visibility falls back to the owner's default", () => {
  it("stores a private bundle for an owner whose default is private", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { getBundle } = await import("@/lib/server/archive");

    await publish(env.scratch.db, env.priv.actor, {
      ownerHandle: env.priv.handle,
      slug: "quiet-bundle",
      version: "1.0.0",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    /* D-100-01: the fallback is the owner's `defaultVisibility`, "never `\"public\"`". A
       hard-coded default publishes an account's work to the world the one time it most wanted
       the opposite, and reads as correct against every owner whose default happens to be
       public — which is every owner this suite would otherwise have seeded. */
    expect(
      (await getBundle(env.scratch.db, env.priv.accountId, "quiet-bundle"))?.visibility,
      "An omitted `visibility` fell back to something other than the owner's account default " +
        "of `private`.",
    ).toBe("private");
  });
});

/* --------------------- the closed set --------------------- */

describe("T100 — the refusal kinds are a closed set of five", () => {
  it("answers every refusal path with one of the published kinds", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { inErrorVariant, unfinishedVariant } = await import("./fixtures");

    await publish(env.scratch.db, env.alice.actor, {
      ownerHandle: env.alice.handle,
      slug: "whitelist-bundle",
      version: "1.0.0",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    const unfinished = unfinishedVariant(env.base, 2);
    const inError = inErrorVariant(env.base);

    const paths: { name: string; input: Parameters<typeof publish>[2] }[] = [
      {
        name: "unfinished",
        input: {
          ownerHandle: env.alice.handle,
          slug: "whitelist-unfinished",
          version: "1.0.0",
          manifest: unfinished.manifest,
          dot: unfinished.dot,
          cardFiles: unfinished.cardFiles,
        },
      },
      {
        name: "in error",
        input: {
          ownerHandle: env.alice.handle,
          slug: "whitelist-in-error",
          version: "1.0.0",
          manifest: inError.manifest,
          dot: inError.dot,
          cardFiles: inError.cardFiles,
        },
      },
      {
        name: "republished bytes",
        input: {
          ownerHandle: env.alice.handle,
          slug: "whitelist-bundle",
          version: "2.0.0",
          manifest: env.base.manifest,
          dot: env.base.dot,
          cardFiles: env.base.cardFiles,
        },
      },
      {
        name: "version not higher",
        input: {
          ownerHandle: env.alice.handle,
          slug: "whitelist-bundle",
          version: "0.9.0",
          manifest: env.revision.manifest,
          dot: env.revision.dot,
          cardFiles: env.revision.cardFiles,
        },
      },
      {
        name: "not owner",
        input: {
          ownerHandle: env.alice.handle,
          slug: "whitelist-bundle",
          version: "3.0.0",
          manifest: env.revision.manifest,
          dot: env.revision.dot,
          cardFiles: env.revision.cardFiles,
        },
      },
    ];

    const seen: Record<string, unknown> = {};
    for (const path of paths) {
      const actor = path.name === "not owner" ? env.bob.actor : env.alice.actor;
      const refusal = await refusalFrom(
        publish(env.scratch.db, actor, path.input),
        `whitelist/${path.name}`,
      );
      seen[path.name] = refusal.kind;
    }

    /* D-100-01: five kinds, and no sixth was added for the create path. A kind outside this set
       is a sentence the UI has no branch for, which is the whole reason the discriminator is a
       closed union rather than free text. */
    const outside = Object.entries(seen).filter(
      ([, kind]) => !(REFUSAL_KINDS as readonly unknown[]).includes(kind),
    );
    expect(
      outside,
      `A refusal came back with a kind outside the published five ` +
        `(${REFUSAL_KINDS.join(", ")}): ${JSON.stringify(seen)}`,
    ).toEqual([]);

    /* And they are actually distinct, so the whitelist is not being satisfied by one kind
       answering everything. */
    expect(
      new Set(Object.values(seen)).size,
      `The five refusal paths produced ${new Set(Object.values(seen)).size} distinct kinds: ` +
        `${JSON.stringify(seen)}. Each names a different sentence the UI writes.`,
    ).toBe(5);
  });

  it("keeps `kind` readable directly, whether or not it is enumerable", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.bob.actor, {
        ownerHandle: env.alice.handle,
        slug: "enumerability",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "kind readability",
    );

    /* D-100-01 warns that `kind` will be NON-ENUMERABLE, and that expecting it in
       `Object.keys` or `JSON.stringify` would red a correct implementation —
       `ArchiveConflictError` shipped that exact bug once. So this asserts the property a caller
       actually needs, direct readability, and asserts nothing about enumerability in either
       direction. A route branching on `err.kind` works under both. */
    expect(
      refusal.kind,
      "`kind` is not readable as a property on the thrown error, so no caller can branch on it.",
    ).toBe("not-owner");
  });
});
