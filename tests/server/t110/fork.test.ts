/* ============================================================
   T110 AC1 — a fork is owned by the forker and names what it took

   ── the shared upstream, and why it has TWO releases ──
   Every cell here forks from `1.0.0` while the upstream's latest is
   `2.0.0`. That is the state the block singles out: "AC1 records the
   release taken, not the bundle. A fork copies the upstream
   release's bytes and lineage carries `version`, so a fork of a
   bundle that later publishes again still names what it actually
   took." An implementation that stores the upstream's LATEST version
   — or the bundle without a version at all — is indistinguishable
   from a correct one over an upstream with a single release, which
   is the state a fixture reaches by default.

   ── which path each cell exercises ──
   Named per cell. A falsification can get the verdict right and the
   code path wrong: T100's delegation cell produced exactly the
   predicted red while every row took the CREATE path when the
   criterion was about the APPEND path, and it read identically in
   the summary.

   ── the module is bound LAST in every cell ──
   After the premises and after the planting. See `contract.ts`.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getBundle } from "@/lib/server/archive";

import {
  MESSAGE_FORMS,
  PUBLISHED,
  RULINGS,
  RecordedSetup,
  boundForkBundle,
  bundleRecordOf,
  refusalFrom,
} from "./contract";
import {
  type Account,
  type Corpus,
  type Published,
  type Scratch,
  describeAdded,
  publishBundle,
  releasesOf,
  resolvingCorpus,
  revisionOf,
  rowsAdded,
  scratchDatabase,
  seedAccount,
  snapshotRows,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  /** The upstream's author. Never the forker. */
  author: Account;
  forker: Account;
  /** Identical to `forker` except that their account default is `private`. D-110-09's discriminator. */
  privateByDefault: Account;
  corpus: Corpus;
  /** Published public at `1.0.0`, then revised and published again at `2.0.0`. */
  upstream: Published;
  latestVersion: string;
}

const setup = new RecordedSetup<Env>("the T110 fork fixture");

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("fork");
    const author = await seedAccount(scratch, "t110-author");
    const forker = await seedAccount(scratch, "t110-forker", "public");
    const privateByDefault = await seedAccount(scratch, "t110-forker-priv", "private");
    const corpus = resolvingCorpus();

    const upstream = await publishBundle(
      scratch,
      author,
      corpus,
      "t110-upstream",
      "1.0.0",
      "public",
    );
    /* The second release, so every cell below forks at a version that is NOT the latest. */
    await publishBundle(
      scratch,
      author,
      revisionOf(corpus, "the upstream moved on after the fork was taken"),
      "t110-upstream",
      "2.0.0",
      "public",
    );

    return {
      scratch,
      author,
      forker,
      privateByDefault,
      corpus,
      upstream,
      latestVersion: "2.0.0",
    };
  });
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

describe("T110 AC1: forking a public bundle", () => {
  /**
   * The whole of AC1 in one call, over the CREATE path — the forker holds no bundle at this slug,
   * so `forkBundle` writes a new `bundle` row rather than touching one that exists.
   */
  it("produces a bundle owned by the forker at the slug they asked for", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const record = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "ac1-owned", visibility: "private" },
      ),
      "AC1",
    );

    expect(
      record.ownerId,
      `AC1: the fork is owned by ${JSON.stringify(record.ownerId)} and the forker is ` +
        `${env.forker.accountId} (@${env.forker.handle}). A fork is an OWNERSHIP CHANGE — ` +
        `"let an account copy somebody else's bundle" — so a copy still owned by the upstream's ` +
        `author (${env.author.accountId}) is the one outcome AC1 forbids outright.`,
    ).toBe(env.forker.accountId);
    expect(record.slug, "AC1: the fork carries the slug the caller asked for.").toBe("ac1-owned");
    expect(
      record.visibility,
      "AC1: `to.visibility` was given explicitly as `private`, which the contract publishes as " +
        `part of \`to\`: ${PUBLISHED.forkBundle}`,
    ).toBe("private");
  });

  /**
   * The lineage's three members, over the same CREATE path.
   *
   * `ownerId` and not `owner`: `BundleRecord.lineage` is `{ ownerId; slug; version }`
   * (`lib/server/archive/types.ts`), read off `lineage_owner_id uuid references account(id)`.
   * The block said `{ owner, slug, version }` until it was corrected at dispatch; that is
   * `lib/data/bundles.ts`'s frontend type, where `owner` is a handle.
   */
  it("records lineage naming the upstream's owner id, slug and release", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const record = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "ac1-lineage", visibility: "private" },
      ),
      "AC1",
    );

    expect(
      record.lineage,
      `AC1: the fork carries no lineage at all.\n` +
        `  ${PUBLISHED.lineage}\n` +
        `  "forking a public bundle produces one owned by the forker WITH LINEAGE naming owner, ` +
        `slug and release" — a copy that records nothing about where it came from is the ` +
        `criterion's negative, and every drift cell in this suite reads this field.`,
    ).toBeDefined();

    expect(record.lineage).toEqual({
      ownerId: env.author.accountId,
      slug: env.upstream.slug,
      version: "1.0.0",
    });
  });

  /**
   * The discriminating half of AC1: the RELEASE taken, not the bundle's latest.
   *
   * Stated as its own cell rather than folded into the `toEqual` above, because the two fail for
   * different reasons and a reader of the summary should be able to tell them apart. This one
   * fails when lineage names `2.0.0` — an implementation that read the upstream's newest release
   * instead of the one it was handed — and its message says so in those words.
   */
  it("names the release it took, not the release the upstream has since published", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const record = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "ac1-release-taken", visibility: "private" },
      ),
      "AC1",
    );

    expect(
      record.lineage?.version,
      `AC1: the fork was taken at \`1.0.0\` and its lineage names ` +
        `${JSON.stringify(record.lineage?.version)}. The upstream's latest release is ` +
        `\`${env.latestVersion}\`.\n` +
        `  "AC1 records the release taken, not the bundle ... so a fork of a bundle that later ` +
        `publishes again still names what it actually took." An implementation that stores the ` +
        `upstream's newest version is indistinguishable from a correct one over an upstream with ` +
        `one release, which is why this fixture publishes two.`,
    ).toBe("1.0.0");
  });

  /**
   * The fork is a ROW, not only a return value.
   *
   * Read back through T010's published reader rather than through `forksOf`: `forksOf` is the
   * thing AC2 is about and filters by visibility, so a private fork is invisible there by design.
   * `getBundle` answers whether the write happened at all.
   */
  it("leaves the fork readable through the archive's own reader", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const returned = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "ac1-persisted", visibility: "private" },
      ),
      "AC1",
    );

    const stored = await getBundle(env.scratch.db, env.forker.accountId, "ac1-persisted");
    expect(
      stored,
      "AC1: `forkBundle` returned a BundleRecord and `getBundle(db, forker, slug)` finds no row " +
        "at that (owner, slug). A record that is not a row is a fork nothing can open, and the " +
        "return value alone cannot tell the two apart.",
    ).toBeDefined();
    expect(stored?.id).toBe(returned.id);

    /* Checked BEFORE the two lineages are compared, and the order is the point: `toEqual` over
       two `undefined`s passes, so a comparison alone would report "the row agrees with the
       return value" about a fork that recorded no lineage at all — an assertion that admits
       exactly the output the cell above exists to forbid. */
    expect(
      stored?.lineage,
      "AC1: the stored row carries no lineage. `toEqual(returned.lineage)` on its own would " +
        "have passed here, because the returned record has none either.",
    ).toBeDefined();
    expect(stored?.lineage).toEqual(returned.lineage);
  });

  /**
   * "A fork copies the upstream release's bytes" — the Contract line, asserted as bytes.
   *
   * The digest is the strong form and it is the one this repository already argues for: a release
   * is "the folder as it stood, kept at its digest", and two releases carrying the same bytes have
   * the same digest by construction (`bundleDigest` over the DOT and one card digest per node).
   * So a copy whose digest differs from the release it names did not copy those bytes, whatever
   * else it did.
   *
   * **The VERSION is deliberately not asserted.** "does a fork's semver continue the upstream's
   * numbering or reset" is the block's own Open item, shared with T025, and a cell that pinned it
   * would settle in a test file a question the contract left open. What is asserted is that the
   * fork has a release at all and that its bytes are the upstream's — neither of which the open
   * question touches.
   */
  it("copies the upstream release's bytes", async () => {
    const env = setup.require();

    const upstreamReleases = await releasesOf(env.scratch, env.upstream.bundleId);
    const taken = upstreamReleases.find((r) => r.version === "1.0.0");
    if (taken === undefined) {
      throw new Error(
        `AC1 premise: the fixture published \`${env.upstream.slug}@1.0.0\` and listReleases ` +
          `reports ${upstreamReleases.map((r) => r.version).join(", ") || "(nothing)"}.`,
      );
    }

    const forkBundle = await boundForkBundle();
    const fork = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "ac1-bytes", visibility: "private" },
      ),
      "AC1 bytes",
    );

    const copied = await releasesOf(env.scratch, fork.id);
    expect(
      copied.length,
      `AC1: the fork holds ${copied.length} releases. "A fork copies the upstream release's ` +
        `bytes" — a fork with no release copied nothing, and the block's own Open item ("does a ` +
        `fork's semver continue the upstream's numbering or reset") presupposes there is a ` +
        `release to number.`,
    ).toBeGreaterThan(0);

    const first = copied[0];
    expect(
      first.digest,
      `AC1: the fork's release is at digest ${first.digest} and the upstream release it names ` +
        `(\`${env.upstream.slug}@1.0.0\`) is at ${taken.digest}.\n` +
        `  Two releases carrying the same bytes have the same digest by construction — ` +
        `\`bundleDigest\` over the DOT source and one card digest per node — so a difference ` +
        `here is a difference in the bytes, not in how they were hashed. The upstream's SECOND ` +
        `release (2.0.0) is at a different digest again, so a fork that copied the latest ` +
        `instead of the one it was asked for reds here too.`,
    ).toBe(taken.digest);
    expect(first.dot, "AC1: and the DOT is the upstream release's, unaltered.").toBe(taken.dot);
    expect([...first.cardRefs], "AC1: and the same pins, in the same order.").toEqual([
      ...taken.cardRefs,
    ]);
  });

  /**
   * D-110-09: an OMITTED `to.visibility` is the FORKER's own `default_visibility`.
   *
   * **Two accounts differing only in their account default, and that is what makes the cell
   * discriminate.** Asked of one account alone, this criterion is satisfied by a module constant
   * that happens to match. Asked of both:
   *   - the account default (correct) gives `public` to one and `private` to the other;
   *   - a constant `"public"` reds on the private-default account;
   *   - a constant `"private"` reds on the public-default account;
   *   - inheriting the UPSTREAM's visibility — which is `public` here — reds on the private one.
   * No single-account cell separates those four.
   *
   * The stakes are AC2's, not a style question: a constant `"public"` would defeat the whole
   * invisible-fork property at the default path while every explicit-value cell below stayed
   * green, which is precisely the shape D-100-01 refused for `publish`.
   */
  it("falls back to the forker's own account default when `to.visibility` is omitted", async () => {
    const env = setup.require();

    /* The premise: the two accounts really do differ on the column the ruling names. Read off the
       row rather than off `seedAccount`'s argument, so a schema default that silently overrode it
       is a broken fixture here and not a T110 defect three assertions later. */
    const defaults = await env.scratch.pool.query<{ handle: string; default_visibility: string }>(
      "select handle, default_visibility from account where handle = any($1) order by handle",
      [[env.forker.handle, env.privateByDefault.handle]],
    );
    expect(
      defaults.rows,
      "D-110-09 premise: the two forkers must differ on `default_visibility`, or this cell " +
        "cannot tell an account default from a module constant.",
    ).toEqual([
      { handle: env.forker.handle, default_visibility: "public" },
      { handle: env.privateByDefault.handle, default_visibility: "private" },
    ]);

    const forkBundle = await boundForkBundle();

    const byPublicDefault = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "ac1-default-public" },
      ),
      "D-110-09, a forker whose default is public",
    );
    const byPrivateDefault = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.privateByDefault.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "ac1-default-private" },
      ),
      "D-110-09, a forker whose default is private",
    );

    expect(
      { public: byPublicDefault.visibility, private: byPrivateDefault.visibility },
      `D-110-09: \`to.visibility\` was omitted by both callers. @${env.forker.handle} has ` +
        `\`default_visibility = public\` and their fork came back ` +
        `${JSON.stringify(byPublicDefault.visibility)}; @${env.privateByDefault.handle} has ` +
        `\`private\` and theirs came back ${JSON.stringify(byPrivateDefault.visibility)}.\n` +
        `  ${RULINGS.D110_09_defaultVisibility}.\n` +
        `  Both answering \`public\` is a module constant, or the upstream's own visibility ` +
        `inherited — and either one defeats AC2 at the default path while every explicit-value ` +
        `cell in this file stays green. Both answering \`private\` is the other constant.`,
    ).toEqual({ public: "public", private: "private" });
  });

  /** `to.visibility` is honoured in the other direction too, so neither value is a default. */
  it("honours an explicit public visibility", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const record = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "ac1-public", visibility: "public" },
      ),
      "AC1",
    );
    expect(
      record.visibility,
      "AC1: `to.visibility` was `public` and the fork came back " +
        `${JSON.stringify(record.visibility)}. Asserted in both directions on purpose: a cell ` +
        `that only ever asks for \`private\` passes against an implementation that ignores the ` +
        `field and hard-codes one value.`,
    ).toBe("public");
  });
});

describe("T110: a slug the forker already holds", () => {
  /**
   * The second admissible message form. The slug is the CALLER'S OWN submission in their own
   * namespace, which is why this sentence may name it where AC6's may not name anything.
   *
   * Exercises the collision path: the forker's own `bundle` row at this slug already exists
   * because they published it, so `forkBundle` reaches the collision check rather than the
   * upstream-read check.
   */
  it("is refused with the published sentence, naming the caller's own slug", async () => {
    const env = setup.require();

    await publishBundle(
      env.scratch,
      env.forker,
      revisionOf(env.corpus, "the forker's own bundle, so the slug is taken"),
      "already-mine",
      "1.0.0",
      "private",
    );

    const forkBundle = await boundForkBundle();
    const refusal = await refusalFrom(
      forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "already-mine" },
      ),
      "slug collision",
    );

    const match = MESSAGE_FORMS["slug-taken"].exec(refusal.message);
    expect(
      match,
      `The refusal's message is ${JSON.stringify(refusal.message)} and the contract publishes ` +
        `exactly one form for a slug collision: "forkBundle: \`<slug>\` is already yours."\n` +
        `  The pattern is anchored at both ends, which is deliberate: text appended after the ` +
        `admissible sentence is where an upstream's name gets into a message that must not carry ` +
        `one.`,
    ).not.toBeNull();
    expect(match?.[1], "The slug named is the caller's own submission.").toBe("already-mine");
  });

  /**
   * And the refusal left NOTHING behind.
   *
   * "Assert what the writer LEFT BEHIND, not only that it threw" — a mutation that inserts a row
   * and *then* throws satisfies every `rejects.toThrow()` a reviewer would write, and leaves the
   * row that makes the collision permanent. Nothing here names a table, so a write into one this
   * suite does not know about is caught the same way.
   */
  it("writes nothing at all when it refuses", async () => {
    const env = setup.require();

    await publishBundle(
      env.scratch,
      env.forker,
      revisionOf(env.corpus, "a second bundle of the forker's own, for the non-effect cell"),
      "also-mine",
      "1.0.0",
      "private",
    );

    const before = await snapshotRows(env.scratch);

    const forkBundle = await boundForkBundle();
    await refusalFrom(
      forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.upstream.slug, version: "1.0.0" },
        { slug: "also-mine" },
      ),
      "slug collision, non-effect",
    );

    const added = rowsAdded(before, await snapshotRows(env.scratch));
    const total = [...added.values()].reduce((sum, rows) => sum + rows.length, 0);
    expect(
      total,
      `A refused fork added ${total} row(s): ${describeAdded(added)}.\n` +
        `  ${[...added.entries()].map(([t, rows]) => `${t}: ${rows.join(" | ")}`).join("\n  ")}\n` +
        `  A refusal that has already written is a refusal a caller cannot retry, and it is ` +
        `invisible to any assertion that only checks that something was thrown.`,
    ).toBe(0);
  });
});
