/* ============================================================
   T131 — `validated` is a COUNT over run reports (D-130-01,
   D-131-06)

   `lib/data/profiles.ts:47-56`: "how many OTHER accounts'
   blueprints this handle downloaded, ran, and submitted a run
   report for that made it onto that blueprint's own
   evidence layer."

   D-131-06 rules all four points that were open at dispatch, and
   each one is a different number, so each gets its own fixture:

     (1) GRAIN: DISTINCT BUNDLES. Two reports on one blueprint
         count once.
     (2) THE JOIN: `run_report.release_digest` -> `release` rows ->
         their bundles; distinct bundles whose `owner_id` DIFFERS
         from the reporting account. A digest is deliberately not a
         foreign key (D-05-01) and one digest can reach several
         bundles, because an unchanged T110 fork shares its
         upstream's digest — so a self-owned bundle at a shared
         digest **neither counts nor subtracts**.
     (3) VISIBILITY: PUBLIC bundles only, ACTOR-INDEPENDENT. The
         subject bundles are third parties', so no actor widening
         applies, and a count that moved with a private bundle's
         existence would be an existence oracle through a number
         (B-13).
     (4) THE READER: a narrow direct read of `schema.runReport`
         from `lib/server/profiles/**`, granted for exactly this
         derivation.

   ── why this file needed no schema from T131 ──
   It is the one figure that was fully drivable in the blind
   position. `run_report` is MERGED (T005) and carries `account_id`
   — added under D-05-07 for exactly this, its comment reading "a
   report on one's own blueprint is accepted and aggregated but
   must not count toward T130's `validated`, which needs an account
   to filter on". So every row here goes in through plain SQL, no
   module is entered to plant one, and a stored counter is
   separated from a derived count by construction rather than by a
   special cell.

   ── one honest bound, stated ──
   The fixture's sentence has a clause nothing in this repository
   can express: "that made it onto that blueprint's own evidence
   layer". There is no evidence-layer acceptance state anywhere —
   `EvidenceLayers` reads "no verified runs" on every blueprint and
   nothing runs anything — so a row in `run_report` IS an accepted
   submission and there is nothing further to filter on. Recorded
   here rather than asserted, because a cell about a state the
   schema cannot hold would be a cell about my reading of a
   docblock.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  account,
  anonymous,
  asProfileRecord,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertRunReport,
  mark,
  operator,
  scratchDatabase,
  type AccountFixture,
  type Scratch,
} from "./contract";

let s: Scratch;

async function person(tag: string): Promise<AccountFixture> {
  return insertAccount(s, { handle: mark(`t131-validated-${tag}`).toLowerCase() });
}

/** A card owned by one fixture account, for the one cell that needs a second release to carry. */
async function insertCardFor(owner: AccountFixture, slug: string) {
  return insertCard(s, {
    id: `${owner.handle}/${slug}`,
    ownerId: owner.id,
    authorHandle: owner.handle,
  });
}

/** `validated` as an uninvolved reader sees it. (3) makes every actor's answer this one. */
async function validatedOf(handle: string, actor: unknown = anonymous): Promise<number> {
  const getProfile = await bind("getProfile");
  return asProfileRecord(
    await getProfile(s.db, actor, handle),
    `getProfile(db, actor, "${handle}")`,
  ).validated;
}

beforeAll(async () => {
  s = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("the floor: `validated` counts a report at all", () => {
  it("is 0 for an account that has reported nothing, and 1 after one report", async () => {
    /* The saturating end, and it is not decoration. Every cell below asserts that some fixture
       does NOT raise the number, and a `validated` hardwired to 0 satisfies all of them. This is
       what makes the zeros mean something. */
    const reporter = await person("floor-reporter");
    const author = await person("floor-author");
    const bundle = await insertBundle(s, { owner: author, slug: "floor", cards: [] });

    expect(await validatedOf(reporter.handle)).toBe(0);
    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: bundle.digest });
    expect(
      await validatedOf(reporter.handle),
      "one report on one other account's public blueprint is one. The row was planted with " +
        "plain SQL and no module ran, so this figure is DERIVED or it is wrong.",
    ).toBe(1);
  });
});

describe("D-131-06 (1): the grain is DISTINCT BUNDLES", () => {
  it("counts two reports on one blueprint once", async () => {
    const reporter = await person("grain-reporter");
    const author = await person("grain-author");
    const bundle = await insertBundle(s, { owner: author, slug: "grain", cards: [] });

    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: bundle.digest });
    await insertRunReport(s, {
      reporterId: reporter.id,
      releaseDigest: bundle.digest,
      model: "second-model",
      reportedAt: new Date("2026-06-02T12:00:00.000Z"),
    });

    expect(
      await validatedOf(reporter.handle),
      `D-131-06(1): the fixture's words are "how many other accounts' BLUEPRINTS this handle ` +
        `reported on", so two reports on one blueprint count ONCE. A count of \`run_report\` ` +
        `ROWS answers 2 here and answers correctly everywhere else in this file.`,
    ).toBe(1);
  });

  it("counts reports on two different blueprints as two", async () => {
    /* The control for the cell above: a `validated` that answered `1` by capping rather than by
       de-duplicating passes it and fails this. */
    const reporter = await person("two-reporter");
    const author = await person("two-author");
    const a = await insertBundle(s, { owner: author, slug: "two-a", cards: [] });
    const b = await insertBundle(s, { owner: author, slug: "two-b", cards: [] });

    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: a.digest });
    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: b.digest });

    expect(await validatedOf(reporter.handle)).toBe(2);
  });

  it("counts two releases of one blueprint once", async () => {
    /* The grain is the BUNDLE and a bundle has many releases, each with its own digest. Reporting
       on 1.0.0 and then on 2.0.0 of one blueprint is one blueprint. A count keyed on the DIGEST
       — the obvious thing to write, since the digest is what the report carries — answers 2. */
    const reporter = await person("release-reporter");
    const author = await person("release-author");
    const card = await insertCardFor(author, "v-card");
    const first = await insertBundle(s, { owner: author, slug: "versions", cards: [] });
    const [second] = await s.query(
      "insert into release (bundle_id, version, digest, dot, manifest, card_refs, card_digests) " +
        "values ($1, '2.0.0', $2, $3, $4, $5, $6) returning digest",
      [
        first.id,
        `${first.digest}-v2`,
        "digraph fixture {\n}\n",
        JSON.stringify({ slug: "versions" }),
        [card.ref],
        [card.digest],
      ],
    );
    const secondDigest = String(second?.digest);

    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: first.digest });
    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: secondDigest });

    expect(
      await validatedOf(reporter.handle),
      "D-131-06(1)/(2): the join goes digest -> release -> BUNDLE and the count is over " +
        "distinct bundles. Two releases of one blueprint are one blueprint; a count of distinct " +
        "DIGESTS answers 2.",
    ).toBe(1);
  });
});

describe("D-131-06 (2): the bundle's owner must differ from the reporter", () => {
  it("does not count a report on the reporter's own blueprint", async () => {
    /* `lib/db/schema.ts:510-514` put `account_id` on the table for this sentence: "a report on
       one's own blueprint is accepted and aggregated but must not count toward T130's
       `validated`, which needs an account to filter on". */
    const reporter = await person("self-reporter");
    const own = await insertBundle(s, { owner: reporter, slug: "my-own", cards: [] });

    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: own.digest });

    expect(
      await validatedOf(reporter.handle),
      "the figure is about OTHER accounts' blueprints. Self-reporting is the cheapest way to " +
        "inflate it and the column exists to make the filter possible.",
    ).toBe(0);
  });

  it("a self-owned bundle at a SHARED digest neither counts nor subtracts", async () => {
    /* THE CELL THE JOIN'S SHAPE MAKES NECESSARY, and the one nobody would write without
       D-131-06(2) spelling it out. `release_digest` is deliberately NOT a foreign key (D-05-01)
       because `bundleDigest({ dot, cardDigests })` reads neither owner nor slug, so an unchanged
       T110 FORK yields a second release at the same digest under a different owner. One digest
       therefore reaches several bundles, and a report at that digest is ambiguous about which
       bundle was run.

       Ruled: distinct bundles whose owner differs, and a self-owned bundle sharing the digest
       neither adds nor removes. Both wrong readings are reachable — an `exists(owner != me)`
       that also fires on the fork counts it, and a `not exists(owner == me)` suppresses the
       third party's bundle entirely — and they answer 1 and 0. This cell separates them. */
    const reporter = await person("fork-reporter");
    const author = await person("fork-author");
    const theirs = await insertBundle(s, { owner: author, slug: "upstream", cards: [] });

    /* The reporter's own fork: a different bundle row, same bytes, therefore the same digest. */
    const [mine] = await s.query(
      "insert into bundle (owner_id, slug, visibility) values ($1, 'upstream', 'public') " +
        "returning id",
      [reporter.id],
    );
    await s.query(
      "insert into release (bundle_id, version, digest, dot, manifest, card_refs, card_digests) " +
        "values ($1, '1.0.0', $2, $3, $4, $5, $6)",
      [
        String(mine?.id),
        theirs.digest,
        "digraph fixture {\n}\n",
        JSON.stringify({ slug: "upstream" }),
        [],
        [],
      ],
    );

    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: theirs.digest });

    expect(
      await validatedOf(reporter.handle),
      "D-131-06(2): the third party's bundle counts, and the reporter's own bundle at the same " +
        "digest neither counts nor subtracts. A reading that suppressed the report because ONE " +
        "of the digest's bundles is the reporter's own answers 0.",
    ).toBe(1);
  });

  it("counts one blueprint once even when two other accounts share its digest", async () => {
    /* The other side of the same ambiguity, and it is the one that inflates rather than
       suppresses. Two THIRD-PARTY bundles at one digest are two rows the join reaches, and the
       grain is distinct bundles, so a report there counts... two. That is what "distinct
       bundles whose owner differs" says, and it is worth an explicit cell precisely because it
       reads surprising: the reporter ran one set of bytes and gets two.

       Written as the ruling's arithmetic rather than as an opinion about it. If the owner meant
       "one report, one blueprint", the divergence surfaces HERE at the merge rather than in a
       number nobody re-derives. */
    const reporter = await person("share-reporter");
    const a = await person("share-a");
    const b = await person("share-b");
    const first = await insertBundle(s, { owner: a, slug: "shared-bytes", cards: [] });

    const [secondBundle] = await s.query(
      "insert into bundle (owner_id, slug, visibility) values ($1, 'shared-bytes', 'public') " +
        "returning id",
      [b.id],
    );
    await s.query(
      "insert into release (bundle_id, version, digest, dot, manifest, card_refs, card_digests) " +
        "values ($1, '1.0.0', $2, $3, $4, $5, $6)",
      [
        String(secondBundle?.id),
        first.digest,
        "digraph fixture {\n}\n",
        JSON.stringify({ slug: "shared-bytes" }),
        [],
        [],
      ],
    );

    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: first.digest });

    expect(
      await validatedOf(reporter.handle),
      "D-131-06(2), read literally: the count is DISTINCT BUNDLES whose owner differs from the " +
        "reporter, and one digest reaches two such bundles here. If the intended answer is 1, " +
        "this cell is where that divergence is visible instead of buried in a join.",
    ).toBe(2);
  });
});

describe("D-131-06 (3): public bundles only, and the same number for every actor", () => {
  it("does not count a report on a PRIVATE blueprint", async () => {
    const reporter = await person("private-reporter");
    const author = await person("private-author");
    const sealed = await insertBundle(s, {
      owner: author,
      slug: "sealed",
      cards: [],
      visibility: "private",
    });

    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: sealed.digest });

    expect(
      await validatedOf(reporter.handle),
      "D-131-06(3): PUBLIC bundles only. A count that moved with a private bundle's existence " +
        "is an existence oracle through a number — B-13's leak arriving as arithmetic rather " +
        "than as a row.",
    ).toBe(0);
  });

  it("answers the same number to the subject, a visitor, an operator and an anonymous reader", async () => {
    /* ACTOR-INDEPENDENT, and this is the cell that would catch the natural mistake: `validated`
       sits beside `counts`, which is deliberately actor-DEPENDENT (AC2), so passing the actor
       into this derivation is the obvious thing to do. The ruling's reason is that the subject
       bundles are third parties', so no widening applies — and the owner reading their own
       profile is exactly the actor a widened filter would answer differently for. */
    const reporter = await person("actor-reporter");
    const author = await person("actor-author");
    const anOperator = await person("actor-operator");
    const visitor = await person("actor-visitor");
    const pub = await insertBundle(s, { owner: author, slug: "actor-public", cards: [] });
    const sealed = await insertBundle(s, {
      owner: author,
      slug: "actor-private",
      cards: [],
      visibility: "private",
    });
    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: pub.digest });
    await insertRunReport(s, { reporterId: reporter.id, releaseDigest: sealed.digest });

    const readings = {
      anonymous: await validatedOf(reporter.handle, anonymous),
      subject: await validatedOf(reporter.handle, account(reporter.id, reporter.handle)),
      author: await validatedOf(reporter.handle, account(author.id, author.handle)),
      visitor: await validatedOf(reporter.handle, account(visitor.id, visitor.handle)),
      operator: await validatedOf(reporter.handle, operator(anOperator.id)),
    };

    expect(
      readings,
      "D-131-06(3): actor-independent. The private bundle is in the fixture on purpose — it is " +
        "the one row an actor-widened filter would let the AUTHOR and an OPERATOR see, so a " +
        "reading of 2 for either of them is the widening this asserts against.",
    ).toEqual({ anonymous: 1, subject: 1, author: 1, visitor: 1, operator: 1 });
  });
});

describe("`validated` is DERIVED, and a report by somebody else does not move it", () => {
  it("does not count another account's report toward this handle", async () => {
    const subject = await person("attr-subject");
    const other = await person("attr-other");
    const author = await person("attr-author");
    const bundle = await insertBundle(s, { owner: author, slug: "attr", cards: [] });

    await insertRunReport(s, { reporterId: other.id, releaseDigest: bundle.digest });

    expect(
      await validatedOf(subject.handle),
      "the figure is keyed on `run_report.account_id`, the SUBMITTING account. A count over " +
        "reports at the digests a handle can see would answer 1 here for everybody.",
    ).toBe(0);
    expect(
      await validatedOf(other.handle),
      "and the control: the report does count for the account that made it, so the zero above " +
        "is attribution rather than a figure that never moves",
    ).toBe(1);
  });

  it("drops when the report row is deleted behind the module's back", async () => {
    const reporter = await person("delete-reporter");
    const author = await person("delete-author");
    const bundle = await insertBundle(s, { owner: author, slug: "deleted", cards: [] });
    const id = await insertRunReport(s, {
      reporterId: reporter.id,
      releaseDigest: bundle.digest,
    });
    expect(await validatedOf(reporter.handle)).toBe(1);

    await s.query("delete from run_report where id = $1", [id]);

    expect(
      await validatedOf(reporter.handle),
      "AC1's inherited clause: anything countable is counted, never stored. Nothing entered the " +
        "module between the two reads, so a stored counter still answers 1.",
    ).toBe(0);
  });
});
