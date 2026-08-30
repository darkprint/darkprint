/* ============================================================
   T190 AC1 and AC2 — the fork event, at its granted source

   ── the two criteria are one mechanism seen from two sides ──
   AC1: "a private fork produces no email UNDER ANY PREFERENCE."
   AC2: "a public fork produces exactly one, ONLY when the
   preference is on."

   D-190-04 puts the emission at ONE granted call site inside
   `forkBundle`, on the public path only. So this file drives
   `forkBundle` — T110's merged, separately authored verb — and
   asks the QUEUE what happened. It never calls `enqueue` for a
   fork itself: a cell that reached past `forkBundle` to `enqueue`
   would be testing a call site of its own invention and would stay
   green the day the real one leaked.

   ── a zero is a claim about an instrument ──
   Every AC1 cell asserts that NOTHING was written. That assertion
   is satisfied just as well by a module that never enqueues
   anything at all, by a fixture whose fork silently failed, and by
   a query pointed at an empty database. So each zero here is paired
   with a POSITIVE control in the same file and against the same
   fixtures: the public fork must produce the row the private one
   must not. Without that pair, AC1 is a cell that cannot fail.

   ── why the preference is driven on BOTH settings for AC1 ──
   "Under any preference" is the whole of AC1's strength. Under
   D-190-02(1) the preference check lives at `enqueue`, so a
   delivery-side filter and a source-side filter are now BOTH
   invisible when the preference is off — the row is absent either
   way. The `fork: true` case is therefore the one that
   discriminates, and it is the default, which is exactly why the
   `fork: false` case has to be driven too rather than assumed to
   be the harder one.

   ── D-190-04's other clause, asserted rather than trusted ──
   "Visibility must never travel in `subject`." A subject carrying
   `public`/`private` would digest differently before and after a
   fork was published, which defeats the collision D-190-02(4)
   requires. The subject of every row this file produces is read and
   checked for it.

   ── the fork fixtures are T110's ──
   Imported rather than rebuilt: they publish a real upstream
   through T100 rather than guessing at rows, they were written by
   another author against another criterion, and a fork this file
   assembled by hand would prove nothing about the call site
   D-190-04 granted.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { forkBundle } from "@/lib/server/lineage";
import {
  publishBundle,
  resolvingCorpus,
  seedAccount,
  type Account,
  type Corpus,
  type Published,
} from "../t110/fixtures";
import {
  EVENT_KINDS,
  type Scratch,
  bind,
  deferred,
  deliveredCountFor,
  dropScratchDatabases,
  mark,
  queueRows,
  recordingDelivery,
  scratchDatabase,
  setPreferencesColumn,
  subjectDigest,
} from "./contract";

interface ForkWorld {
  scratch: Scratch;
  /** The upstream's author — the account AC1 protects and AC2 notifies. */
  author: Account;
  forker: Account;
  upstream: Published;
  corpus: Corpus;
}

const setup = deferred<ForkWorld>(async () => {
  const scratch = await scratchDatabase("fork");
  /* No ontology version is seeded. `publish` used to open a view for whatever the manifest
     named and refuse an unpublished version, which was a foreign rejection that did not even
     look like a T190 failure; `openView` merges over `CORE_ONTOLOGY` now. */
  const corpus = resolvingCorpus();
  const author = await seedAccount(scratch, mark("up").toLowerCase());
  const forker = await seedAccount(scratch, mark("fk").toLowerCase());
  const upstream = await publishBundle(scratch, author, corpus, "t190-upstream", "1.0.0", "public");
  return { scratch, author, forker, upstream, corpus };
});

afterAll(async () => {
  await dropScratchDatabases();
});

/** Every value of every subject on every row, so a visibility word cannot hide in one. */
function subjectValues(rows: { subject: Record<string, string> }[]): string[] {
  return rows.flatMap((row) => Object.values(row.subject ?? {}).map(String));
}

async function takeFork(
  world: ForkWorld,
  slug: string,
  visibility: "public" | "private",
): Promise<{ id: string }> {
  return (await forkBundle(
    world.scratch.db,
    world.forker.actor,
    {
      ownerHandle: world.author.handle,
      slug: world.upstream.slug,
      version: world.upstream.version,
    },
    { slug, visibility },
  )) as { id: string };
}

describe("T190 AC1: a private fork produces no email under ANY preference", () => {
  it.each([true, false])(
    "with the upstream author's `fork` preference set to %s, a private fork queues nothing",
    async (preference) => {
      const world = await setup.require();
      await setPreferencesColumn(world.scratch, world.author.accountId, { fork: preference });

      const before = await queueRows(world.scratch, world.author.accountId);
      const everythingBefore = await queueRows(world.scratch);
      const slug = mark("ac1").toLowerCase();

      await takeFork(world, slug, "private");

      const after = await queueRows(world.scratch, world.author.accountId);
      const added = after.slice(before.length);

      expect(
        added,
        `AC1: taking a PRIVATE fork of \`${world.upstream.slug}\` queued ${added.length} row(s) ` +
          `for the upstream's author, with \`fork\` set to ${String(preference)}.\n` +
          `  ${added.map((r) => `${r.kind} ${JSON.stringify(r.subject)}`).join("\n  ")}\n` +
          `  §T190: "a private fork is never announced to the upstream author", and it must ` +
          `hold under EVERY preference — which is why D-190-04 puts the check at the granted ` +
          `call site inside \`forkBundle\` and not in the sender. A delivery-side filter passes ` +
          `the sequential test and leaks the moment a second sender exists.\n` +
          `  The positive control for this zero is the public-fork cell below: it must queue ` +
          `exactly one row from the same fixtures, or this assertion is one no implementation ` +
          `could fail.`,
      ).toEqual([]);

      /* And the same zero over the WHOLE queue, because the one above is SCOPED to the
         author's own rows and a scoped zero is a claim about its scope. A row addressed to a
         third party — a watcher, an operator digest, an audit-shaped announcement — that names
         this private fork is invisible to a query filtered by `account_id`, and AC1's promise
         is that the fork is invisible upstream "in every direction". The slug is this run's
         own, so a hit cannot be another cell's fork. */
      const everythingAfter = await queueRows(world.scratch);
      const naming = everythingAfter
        .slice(everythingBefore.length)
        .filter((row) => Object.values(row.subject ?? {}).some((v) => String(v).includes(slug)));

      expect(
        naming.map((r) => `${r.kind} -> ${r.accountId}: ${JSON.stringify(r.subject)}`),
        `AC1: a PRIVATE fork put its slug \`${slug}\` into ${naming.length} queue row(s) ` +
          `addressed to somebody.\n` +
          `  The cell above is scoped to the upstream author and cannot see a row addressed to ` +
          `a third party. T110's merged AC3 cell catches a row carrying the author's ID; this ` +
          `catches one carrying the private fork's NAME, which is the other direction and the ` +
          `one no merged guard is watching.`,
      ).toEqual([]);
    },
  );

  /**
   * The forker is not notified either, whichever way the fork went.
   *
   * Not an acceptance criterion — recorded as the narrower claim it is. The `fork` event is
   * "someone forks a blueprint YOU published", so a row addressed to the person who did the
   * forking is an event announcing something to the one party that already knows.
   */
  it("a public fork queues nothing for the FORKER's own account", async () => {
    const world = await setup.require();
    await setPreferencesColumn(world.scratch, world.forker.accountId, { fork: true });

    const before = await queueRows(world.scratch, world.forker.accountId);
    await takeFork(world, mark("ac1-self").toLowerCase(), "public");
    const after = await queueRows(world.scratch, world.forker.accountId);

    expect(
      after.slice(before.length),
      "the account that TOOK the fork was queued an event about its own action. The `fork` " +
        "event is `someone forks a blueprint you published`.",
    ).toEqual([]);
  });
});

describe("T190 AC2: a public fork produces exactly one, only when the preference is on", () => {
  /**
   * The positive control AC1's zeros rest on, and AC2's own first half.
   *
   * Asserted as EXACTLY one and not as at-least-one: "exactly one" is the criterion's word,
   * and a fan-out that queued a row per release or per card would satisfy a `toBeGreaterThan`.
   */
  it("with `fork` ON, one public fork queues exactly one row for the upstream's author", async () => {
    const world = await setup.require();
    await setPreferencesColumn(world.scratch, world.author.accountId, { fork: true });

    const before = await queueRows(world.scratch, world.author.accountId);
    const slug = mark("ac2-on").toLowerCase();

    const forked = await takeFork(world, slug, "public");

    const after = await queueRows(world.scratch, world.author.accountId);
    const added = after.slice(before.length);

    expect(
      added.length,
      `AC2: a PUBLIC fork of \`${world.upstream.slug}\` queued ${added.length} row(s) for its ` +
        `author with \`fork\` ON; the criterion is EXACTLY one.\n` +
        `  ${added.map((r) => `${r.kind} ${JSON.stringify(r.subject)}`).join("\n  ")}\n` +
        `  A zero here also invalidates every AC1 cell in this file: those assert that nothing ` +
        `was written, and if nothing is ever written they cannot fail.`,
    ).toBe(1);

    const row = added[0]!;
    expect(row.kind, `the queued row's kind is \`${row.kind}\`, not \`fork\``).toBe("fork");
    expect(row.accountId).toBe(world.author.accountId);
    expect(
      row.subjectDigest,
      "`subject_digest` does not match `contentDigest(canonicalJson(subject))` over the row's " +
        "own subject (D-190-02(4)), so the unique key is not keyed on the subject it stores.",
    ).toBe(subjectDigest(row.subject));
    expect(
      row.deliveredAt,
      "a freshly queued row already carries a `delivered_at`, so the drain cursor cannot tell " +
        "it from one that has been sent (D-190-02(3)).",
    ).toBeNull();

    expect(
      row.subject,
      `D-190-07 (amended) publishes the fork subject as ` +
        `\`{ slug: <upstream slug>, fork: <forking bundle's id> }\`, and the row carries ` +
        `${JSON.stringify(row.subject)}.`,
    ).toEqual({ slug: world.upstream.slug, fork: forked.id });

    /* D-190-04: visibility must never travel in `subject`. */
    expect(
      subjectValues(added).filter((v) => v === "public" || v === "private"),
      `the fork event's subject carries a visibility word: ${JSON.stringify(row.subject)}.\n` +
        `  D-190-04 refuses \`enqueue\`-side guessing "for the blind author's digest-pollution ` +
        `argument (visibility must never travel in subject)": a subject carrying it digests ` +
        `differently before and after publication, so the same fork would occupy two rows and ` +
        `the collision D-190-02(4) requires would never happen.`,
    ).toEqual([]);
  });

  /**
   * D-190-02(1), and the cell that would have been written backwards without it.
   *
   * Under the withdrawn reading the row is always queued and the sender filters, so this cell
   * would assert 1 and red against a correct implementation.
   */
  it("with `fork` OFF, a public fork queues NOTHING", async () => {
    const world = await setup.require();
    await setPreferencesColumn(world.scratch, world.author.accountId, { fork: false });

    const before = await queueRows(world.scratch, world.author.accountId);
    await takeFork(world, mark("ac2-off").toLowerCase(), "public");
    const after = await queueRows(world.scratch, world.author.accountId);

    expect(
      after.slice(before.length),
      `AC2: a public fork queued a row for an author whose \`fork\` preference is OFF.\n` +
        `  D-190-02(1): "the preference check lives at \`enqueue\` — a kind that is OFF for the ` +
        `account writes NO ROW", because "the queue must not fill with rows for people who ` +
        `opted out". The reading where the row is always written and the sender filters was ` +
        `considered and WITHDRAWN.`,
    ).toEqual([]);
  });

  /** And "exactly one" is a claim about the EMAIL, so the queued row has to reach the seam. */
  it("the one queued row delivers exactly one message", async () => {
    const world = await setup.require();
    await setPreferencesColumn(world.scratch, world.author.accountId, { fork: true });

    const before = await queueRows(world.scratch, world.author.accountId);
    await takeFork(world, mark("ac2-deliver").toLowerCase(), "public");
    const added = (await queueRows(world.scratch, world.author.accountId)).slice(before.length);
    expect(added, "no row to deliver; see the `exactly one` cell above").toHaveLength(1);
    const row = added[0]!;

    const recorder = recordingDelivery();
    const deliverPending = await bind("deliverPending");
    await deliverPending(world.scratch.db, recorder.delivery);

    expect(
      deliveredCountFor(recorder, "fork", row.subject),
      `AC2: the queued fork event reached the delivery seam ` +
        `${deliveredCountFor(recorder, "fork", row.subject)} time(s); the criterion is ` +
        `exactly one.\n` +
        `  delivered: ${JSON.stringify(recorder.delivered)}`,
    ).toBe(1);

    const message = recorder.delivered.find(
      (m) => m.kind === "fork" && subjectDigest(m.subject) === row.subjectDigest,
    );
    expect(message?.accountId, "the message was addressed to another account").toBe(
      world.author.accountId,
    );
    expect(
      typeof message?.unsubscribeToken === "string" && message.unsubscribeToken.length > 0,
      `AC6: "every email carries a working unsubscribe". The delivered message carries ` +
        `${JSON.stringify(message?.unsubscribeToken)}.\n` +
        `  D-190-03: \`enqueue\` ensures a token row per (account_id, kind) and the delivery ` +
        `message carries it.`,
    ).toBe(true);
    expect(
      EVENT_KINDS as readonly string[],
      "the delivered message's kind is outside the published union",
    ).toContain(message?.kind);
  });
});

describe("T190 AC2: a SECOND forker is announced too — D-190-07's load-bearing key", () => {
  /**
   * The cell D-190-07 names, and the defect it was ruled to prevent:
   *
   *   "the unique key is `(kind, account_id, subject_digest)`, so a subject naming only the
   *    upstream would announce the FIRST forker and silently swallow every one after — AC2
   *    satisfied-looking while the second fork produced nothing."
   *
   * Both forks are of ONE upstream, by ONE forker, to ONE recipient — so `kind` and
   * `account_id` are identical and the whole weight falls on `subject_digest`. That is the
   * only arrangement in which the missing key is visible: vary the forker as well and a
   * subject carrying nothing but the upstream slug would still be caught by nothing, because
   * the recipient is the upstream's author either way.
   *
   * Asserted as two DISTINCT digests, not merely as two rows: two rows with one digest cannot
   * exist under the unique key, so a count alone would be reporting the constraint rather than
   * the subject.
   */
  it("two public forks of one upstream queue two rows for its author", async () => {
    const world = await setup.require();
    await setPreferencesColumn(world.scratch, world.author.accountId, { fork: true });

    const before = await queueRows(world.scratch, world.author.accountId);

    const firstSlug = mark("ac2-two-a").toLowerCase();
    const secondSlug = mark("ac2-two-b").toLowerCase();
    const first = await takeFork(world, firstSlug, "public");
    const second = await takeFork(world, secondSlug, "public");

    const added = (await queueRows(world.scratch, world.author.accountId)).slice(before.length);

    expect(
      added.map((r) => JSON.stringify(r.subject)),
      `AC2: two public forks of \`${world.upstream.slug}\` queued ${added.length} row(s) for ` +
        `its author.\n` +
        `  D-190-07: a subject naming only the upstream announces the FIRST forker and ` +
        `swallows every one after, because the unique key would see one ` +
        `\`(fork, author, digest)\` for both. The second author never hears that their work ` +
        `was forked, and every count-based cell reads as satisfied.`,
    ).toHaveLength(2);

    expect(
      new Set(added.map((r) => r.subjectDigest)).size,
      "the two rows share one `subject_digest`, which the unique key forbids — so this cell " +
        "is reporting something other than two distinguishable subjects.",
    ).toBe(2);

    expect(
      added.map((r) => r.subject.fork).sort(),
      `the queued subjects do not name the two forking bundles. D-190-07 puts the forking ` +
        `bundle's id in the subject for exactly this reason.`,
    ).toEqual([first.id, second.id].sort());
  });
});
