/* ============================================================
   T131 AC4 — a follow toggles, and `watchers` is the follower
   count DERIVED rather than incremented

   "AC4's 'watcher count equals the follower count' is a consistency
   criterion between two things that could drift, so the count is
   derived from the follow rows rather than incremented alongside
   them — same rule as `counts`, and the same reason."

   ── the criterion T130 could not reach, and why it can be reached
      here ──
   T130's blind author wrote seven AC4 cells and then wrote down,
   in its own header, exactly what they could not measure: **no
   table held a follow**, so nothing could write follow state behind
   the module's back, and "with `toggleFollow` the only publisher of
   follow state, an incremented counter and a derived count are hard
   to tell apart from outside." It narrowed its claim to what it
   could carry — the two agree across every SEQUENTIAL sequence a
   suite can drive — and named the two cases that would separate
   them as owed to a round with a table to look at.

   This is that round — and the fix was the TABLE, not a cascade.
   D-131-08 bought `ON DELETE CASCADE` as "criterion
   observability"; **D-131-11 revoked it**, because T120 never
   deletes an account row (it tombstones, and D-120-01 rules the
   tombstone BECAUSE the structure refuses the delete), so a
   cascading key removes the very premise a merged ruling rests on.
   All five keys into `account` are `NO ACTION`.

   That revocation costs this file nothing, which is the tell that
   the cascade was never load-bearing: **the discriminator that
   carries AC4 is the DIRECT `follow` row delete** — plant or remove
   a row, touch no `account`, watch `watchers` move. No unreachable
   world is driven and no cascade is needed. The account-deletion
   cell has been retargeted rather than withdrawn: it now asserts
   the REFUSAL, which is D-120-01's structural fact arriving at this
   table. It is no longer a derived-versus-stored discriminator and
   is labelled so, because one cell now carries that criterion
   alone.

   ── the wire spelling is NOT this file's ──
   The module answers `followedByCaller` and the WIRE answers
   `watching` (D-131-04(c): both published, the route maps). Nothing
   here touches the route; `routes.test.ts` holds that seam, and
   `asFollowAnswer` refuses `watching` at the module so the two
   cannot be conflated by a validator that accepts either.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PUBLISHED,
  account,
  anonymous,
  asFollowAnswer,
  asProfileRecord,
  bind,
  dropScratchDatabases,
  followRowCount,
  insertAccount,
  insertFollow,
  mark,
  operator,
  sqlstateOf,
  proveInterleaving,
  race,
  scratchDatabase,
  socialSchemaPresent,
  warmPool,
  type AccountFixture,
  type FollowAnswer,
  type Scratch,
} from "./contract";

let s: Scratch;

async function person(tag: string): Promise<AccountFixture> {
  return insertAccount(s, { handle: mark(`t131-follow-${tag}`).toLowerCase() });
}

async function toggle(actor: unknown, handle: string): Promise<FollowAnswer> {
  const toggleFollow = await bind("toggleFollow");
  return asFollowAnswer(
    await toggleFollow(s.db, actor, handle),
    `toggleFollow(db, actor, "${handle}")`,
  );
}

/** `watchers` as the READER answers it, for an actor with no stake in the subject. */
async function watchersOf(handle: string): Promise<number> {
  const getProfile = await bind("getProfile");
  return asProfileRecord(
    await getProfile(s.db, anonymous, handle),
    `getProfile(db, anonymous, "${handle}")`,
  ).watchers;
}

beforeAll(async () => {
  s = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("which world this run happened in", () => {
  it("`0004_social` has landed, so the discriminators below mean what they say", async () => {
    /* AN UNSKIPPABLE CELL THAT SAYS WHICH WORLD RAN, and it is here because the alternative is a
       suite that is green in both. Every DISCRIMINATOR cell below plants a row directly; against
       a tree without the migration each of them reds with `follow does not exist`, which is
       correct and legible. What is NOT legible is a future run where the tables are present but
       empty of the columns these cells name — so the world is asserted once, by name, rather
       than inferred from whichever red happened to arrive first. */
    const present = await socialSchemaPresent(s);
    expect(
      present,
      "D-131-08 ratifies `0004_social` as follow / profile_pin / account_support. Until it " +
        "lands this suite is in the blind position and the two DISCRIMINATOR cells below — the " +
        "only cells that tell a DERIVED count from a stored counter — cannot run at all.",
    ).toEqual(["account_support", "follow", "profile_pin"]);
  });
});

describe("AC4: a follow toggles", () => {
  it("goes on and then off, and the count follows it in both directions", async () => {
    const subject = await person("subject");
    const follower = await person("follower");
    const actor = account(follower.id, follower.handle);

    expect(await watchersOf(subject.handle)).toBe(0);

    expect(await toggle(actor, subject.handle)).toEqual({ watchers: 1, followedByCaller: true });
    expect(
      await toggle(actor, subject.handle),
      `"a follow TOGGLES" — a second call from the same account is the unfollow, not a second ` +
        `follow. An implementation that only ever adds passes the first assertion and fails ` +
        `this one. ${PUBLISHED.toggleFollow}`,
    ).toEqual({ watchers: 0, followedByCaller: false });
  });

  it("does not accumulate under repeated toggling", async () => {
    const subject = await person("repeat-subject");
    const follower = await person("repeat-follower");
    const actor = account(follower.id, follower.handle);

    for (let i = 0; i < 3; i += 1) {
      expect(await toggle(actor, subject.handle)).toEqual({ watchers: 1, followedByCaller: true });
      expect(await toggle(actor, subject.handle)).toEqual({ watchers: 0, followedByCaller: false });
    }
    /* Six calls and the count is back where it started. A `watchers = watchers + 1` counter
       reaches 6 here; nothing in a single on/off pair separates it from a correct one. */
    expect(await watchersOf(subject.handle)).toBe(0);
    expect(
      await followRowCount(s, subject.id),
      "and the ROWS agree. A toggle that flipped a flag on a row it never deleted would answer " +
        "0 above with a row still standing.",
    ).toBe(0);
  });

  it("counts four distinct followers as four, and each unfollow as one fewer", async () => {
    const subject = await person("many-subject");
    const followers = await Promise.all([
      person("many-1"),
      person("many-2"),
      person("many-3"),
      person("many-4"),
    ]);

    for (const [i, f] of followers.entries()) {
      expect(await toggle(account(f.id, f.handle), subject.handle)).toEqual({
        watchers: i + 1,
        followedByCaller: true,
      });
    }
    expect(await watchersOf(subject.handle)).toBe(followers.length);

    for (const [i, f] of followers.entries()) {
      expect(await toggle(account(f.id, f.handle), subject.handle)).toEqual({
        watchers: followers.length - i - 1,
        followedByCaller: false,
      });
    }
    expect(await watchersOf(subject.handle)).toBe(0);
  });

  it("tracks each follower separately", async () => {
    /* `followedByCaller` is about the CALLER. The chain below is the only way to observe that
       through the published surface, because the flag rides on the write and `getProfile` does
       not carry one: B's unfollow must leave A's follow standing, and A must then still have one
       to give up. A module keying follow state on the SUBJECT alone reports
       `followedByCaller: false` for A's second call at a count of 1, or 0 at B's. */
    const subject = await person("each-subject");
    const a = await person("each-a");
    const b = await person("each-b");
    const actorA = account(a.id, a.handle);
    const actorB = account(b.id, b.handle);

    expect(await toggle(actorA, subject.handle)).toEqual({ watchers: 1, followedByCaller: true });
    expect(await toggle(actorB, subject.handle)).toEqual({ watchers: 2, followedByCaller: true });
    expect(await toggle(actorB, subject.handle)).toEqual({ watchers: 1, followedByCaller: false });
    expect(
      await toggle(actorA, subject.handle),
      "A never unfollowed, so A's next call is the unfollow and it leaves nobody watching",
    ).toEqual({ watchers: 0, followedByCaller: false });
  });

  it("does not move another handle's watcher count", async () => {
    const watched = await person("iso-watched");
    const bystander = await person("iso-bystander");
    const follower = await person("iso-follower");

    await toggle(account(follower.id, follower.handle), watched.handle);
    expect(await watchersOf(watched.handle)).toBe(1);
    expect(
      await watchersOf(bystander.handle),
      "a follow is keyed on the handle being followed, not on the follower's own page",
    ).toBe(0);
  });

  it("agrees with `getProfile`'s `watchers` after every step", async () => {
    /* Two published readers of one number. A module keeping them in different places is exactly
       the drift AC4 calls "a consistency criterion between two things that could drift", and
       neither reader alone can report it. */
    const subject = await person("agree-subject");
    const a = await person("agree-a");
    const b = await person("agree-b");

    const steps = [
      await toggle(account(a.id, a.handle), subject.handle),
      await toggle(account(b.id, b.handle), subject.handle),
      await toggle(account(a.id, a.handle), subject.handle),
    ];
    expect(steps.map((x) => x.watchers)).toEqual([1, 2, 1]);
    expect(await watchersOf(subject.handle)).toBe(steps[steps.length - 1]!.watchers);
  });

  it("a caller with no identity does not become a watcher", async () => {
    /* DERIVED and labelled: nothing published rules HOW an anonymous toggle refuses at the
       module. B-13's two subjects are an owner and an operator, T060 rules that "possession of a
       discriminant is not authority", and a follow is a per-account fact with no account behind
       it here. So nothing is pinned about the refusal — only that the count does not move.

       Two factors, because "the count did not move" is also what a `toggleFollow` that does
       nothing produces: an identified account's toggle immediately after must move it. */
    const subject = await person("anon-subject");
    const follower = await person("anon-follower");

    let outcome: string;
    try {
      const toggleFollow = await bind("toggleFollow");
      outcome = `resolved with ${JSON.stringify(await toggleFollow(s.db, anonymous, subject.handle))}`;
    } catch {
      outcome = "rejected";
    }

    expect(
      await followRowCount(s, subject.id),
      `an anonymous \`toggleFollow\` ${outcome}; either way there is no account for the follow ` +
        `row to belong to, so nothing can have been written. Read at the ROWS: a module that ` +
        `inserted a row and then threw satisfies every \`rejects.toThrow()\` a reviewer writes.`,
    ).toBe(0);

    /* The control. */
    await toggle(account(follower.id, follower.handle), subject.handle);
    expect(await watchersOf(subject.handle)).toBe(1);
  });
});

describe("AC4: `watchers` is DERIVED, not a stored counter (one DISCRIMINATOR, one structural)", () => {
  it("moves when a follow row is planted without the module being entered", async () => {
    /* THE FIRST OF THE TWO CELLS T130 WAS OWED. Every cell above is satisfied by a correct
       counter as well as by a derived count — that is the narrowing T130's author wrote down
       rather than papered over. This one is not: the row goes in through plain SQL, no published
       function runs, and a counter column cannot have been incremented by anybody.

       The premise first, so a zero answer below cannot be read as a pass over an empty world. */
    const subject = await person("derive-subject");
    const planter = await person("derive-planter");
    expect(
      await watchersOf(subject.handle),
      "the premise: nobody is watching yet, so the move below is the row and nothing else",
    ).toBe(0);

    await insertFollow(s, { followerId: planter.id, followedId: subject.id });

    expect(
      await watchersOf(subject.handle),
      "AC1's inherited clause, applied to `watchers`: anything countable is COUNTED, never " +
        "stored as a counter. A `watchers` column reads 0 here — the row exists and no code " +
        "incremented anything — and that is the drift AC4 exists to prevent.",
    ).toBe(1);
    expect(
      await followRowCount(s, subject.id),
      "and the reader's number is the ROW COUNT rather than a number that merely also moved",
    ).toBe(1);
  });

  it("REFUSES to delete a follower's account, which is D-120-01's premise reaching this table", async () => {
    /* RETARGETED, NOT WITHDRAWN (D-131-11), and it is no longer a discriminator — the cell above
       now carries AC4's derived-versus-stored criterion alone, which is said here so nobody
       counts this one toward it.

       T130's blind author named this experiment and declined to drive it, on the grounds that
       its outcome depended on a foreign key nobody had published and "a cell whose two outcomes
       mean opposite things is not a measurement". It was right, and the answer arrived from an
       unexpected direction: D-131-08 bought `ON DELETE CASCADE` to make the delete observable,
       and D-131-11 revoked it because **T120 never deletes an account row — it tombstones, and
       D-120-01 rules the tombstone BECAUSE the structure refuses the delete.** A cascading key
       removes the premise a merged ruling rests on.

       So the refusal IS the behaviour, and asserting it is this cell's honest content. The
       SQLSTATE is read off the driver rather than matched in prose: `foreign_key_violation` is
       `23503` whatever the wording, and pinning a message would pin a string nobody published. */
    const subject = await person("refuses-subject");
    const a = await person("refuses-a");
    const b = await person("refuses-b");

    await toggle(account(a.id, a.handle), subject.handle);
    await toggle(account(b.id, b.handle), subject.handle);
    expect(
      await watchersOf(subject.handle),
      "the premise: two real follows, so there is a referencing row for the key to protect",
    ).toBe(2);

    const code = await sqlstateOf(() => s.query("delete from account where id = $1", [a.id]));
    expect(
      code,
      `deleting an account referenced by a \`follow\` row must be REFUSED at the driver. ` +
        `D-131-11 puts all five keys into \`account\` at \`NO ACTION\`, and D-120-01 rules ` +
        `T120's tombstone BECAUSE the structure refuses this delete — a cascading key would ` +
        `silently satisfy the delete and take the merged ruling's premise with it.`,
    ).toBe("23503");

    /* And the refusal left nothing half-done. A statement that removed the follow row and THEN
       failed would satisfy the assertion above while having done exactly what the revocation
       forbids. */
    expect(await followRowCount(s, subject.id)).toBe(2);
    expect(await watchersOf(subject.handle)).toBe(2);
  });
});

describe("AC2's cache clause reaches `watchers` (B7)", () => {
  it("a second read after a foreign write answers the new number, not the first one", async () => {
    /* D-131-08: "watchers/support/pinned resolution are actor-dependent, so none may be memoised
       on handle alone". The leak that clause exists to prevent needs two actors to observe
       directly; what a single actor CAN observe is the weaker half — that the figure is not
       memoised per handle across calls at all — and that is what this cell holds. It reds
       against the process-level cache keyed on handle that B-13 names, which is the natural
       optimisation for a figure this expensive. */
    const subject = await person("cache-subject");
    const first = await person("cache-first");
    const second = await person("cache-second");

    await toggle(account(first.id, first.handle), subject.handle);
    expect(await watchersOf(subject.handle)).toBe(1);

    await insertFollow(s, { followerId: second.id, followedId: subject.id });

    expect(
      await watchersOf(subject.handle),
      "a value memoised on the handle answers 1 forever. AC2: `counts` cannot be cached across " +
        "callers, and B7 extends that clause to the three figures T131 adds.",
    ).toBe(2);
  });
});

describe("D-131-09(2): two concurrent callers, on a pool proven to interleave", () => {
  it("the pool really does run two statements at once, or nothing below is a race", async () => {
    /* THE SECOND AXIS, and it runs first. `pg` opens connections lazily, so two "concurrent"
       callers on a cold pool are handed one client in sequence: they serialise, the window never
       opens, and a race cell passes against a select-then-insert exactly as against a correct
       module. A green race cell is a claim about the POOL until something independent shows the
       pool can interleave.

       Distinct backend pids are not enough on their own — a pool can hand two clients out one
       after the other and still report two pids. The claim is distinct pids with OVERLAPPING
       windows, measured off the server's own `clock_timestamp()`. */
    await warmPool(s);
    const { pids, spans, overlapped } = await proveInterleaving(s);

    expect(new Set(pids).size, `two statements, backend pids ${pids.join(" and ")}`).toBe(2);

    /* THE CLOCK BEFORE THE CONCLUSION, and this ordering was bought with a false red.

       A serialising pool and a broken clock reading BOTH answer `overlapped: false`, and they
       are opposite findings: the first invalidates the four race cells, the second invalidates
       this measurement. The first version of this cell could not tell them apart and reported
       SERIALISATION on a pool that was interleaving perfectly — the spans had been collapsed to
       zero by a `String(Date)` round trip that drops milliseconds, so the overlap test was
       comparing an instant with itself.

       Each statement sleeps 150ms server-side, so a span far below that means the READING is
       wrong and nothing about the pool has been measured yet. */
    for (const [i, span] of spans.entries()) {
      expect(
        span,
        `statement ${i + 1} reports a server-side span of ${span}ms across a 150ms ` +
          `\`pg_sleep\`. That is a broken CLOCK READING, not a serialising pool — the two are ` +
          `distinguishable only here, and they invalidate different things. Fix the reading ` +
          `before drawing any conclusion about concurrency.`,
      ).toBeGreaterThan(100);
    }

    expect(
      overlapped,
      `backend pids ${pids.join(" and ")} with spans ${spans.join("ms, ")}ms did not overlap in ` +
        `time, so this pool SERIALISES and every race cell below is vacuous. The spans are ` +
        `sane, so this is the pool and not the instrument. Warm the pool harder or raise its ` +
        `max before reading any concurrency result in this file as evidence.`,
    ).toBe(true);
  });

  it("two different followers arriving at once both land, and the count is exactly two", async () => {
    /* The lost-update shape. Two distinct `(follower, followed)` pairs, so the unique index is
       not what is being tested here — what is being tested is that neither caller's work is
       dropped and that a count derived under concurrent writers is exact. */
    const subject = await person("race-subject");
    const a = await person("race-a");
    const b = await person("race-b");
    await warmPool(s);

    const toggleFollow = await bind("toggleFollow");
    const outcome = await race(
      () => toggleFollow(s.db, account(a.id, a.handle), subject.handle),
      () => toggleFollow(s.db, account(b.id, b.handle), subject.handle),
    );

    expect(
      { resolved: outcome.resolved, codes: outcome.codes },
      "two different followers do not contend for one row, so both calls must succeed. A raw " +
        "SQLSTATE here is a driver error reaching a caller.",
    ).toEqual({ resolved: 2, codes: [] });

    expect(await followRowCount(s, subject.id)).toBe(2);
    expect(
      await watchersOf(subject.handle),
      "and the derived count agrees. A read-modify-write on a counter column loses one of these " +
        "two increments and answers 1 — the exact failure AC5's shape names one task over.",
    ).toBe(2);
  });

  it("the same follower arriving twice at once never leaves two rows, and leaks no SQLSTATE", async () => {
    /* THE UNIQUE-PAIR RACE, and its criterion is narrower than it first looks — deliberately.

       T150's ruled clause is that "the unique index IS the idempotency guarantee, not an index on
       top of one ... a SELECT-then-INSERT passes every sequential test and loses under two
       callers", and D-131-08 gives `follow` its UNIQUE `(follower_id, followed_id)` for exactly
       that. But the verb here is a TOGGLE, and **two concurrent toggles from one account are
       non-deterministic by construction**: both callers may read "not following" and both insert
       (the index admits one, so one row), or one may insert while the other reads "following" and
       deletes (zero rows). Both are legitimate interleavings of a correct module, so this cell
       does NOT assert an on/off outcome — a cell that did would be a flake, and asserting a
       criterion its own API cannot make deterministic is how a suite acquires one.

       What IS deterministic is asserted, and it is what the index exists to guarantee:
         * the store never holds TWO rows for one pair;
         * no caller receives a raw unique-violation. A select-then-insert raises `23505` out to
           whichever caller lost, and that is invisible to any assertion that only counts rows. */
    const subject = await person("dup-subject");
    const follower = await person("dup-follower");
    const actor = account(follower.id, follower.handle);
    await warmPool(s);

    const toggleFollow = await bind("toggleFollow");
    const outcome = await race(
      () => toggleFollow(s.db, actor, subject.handle),
      () => toggleFollow(s.db, actor, subject.handle),
    );

    const rows = await followRowCount(s, subject.id);
    expect(
      rows,
      `two concurrent toggles from one account left ${rows} rows. Zero and one are both correct ` +
        `interleavings of a toggle; two is the unique pair failing, which is what ` +
        `\`follow_follower_followed_key\` exists to make impossible.`,
    ).toBeLessThanOrEqual(1);

    expect(
      outcome.codes.filter((c) => c === "23505"),
      "a unique violation reached a caller — raw, or sealed with the driver error on `cause`, " +
        "which `race()` walks on purpose. The index is the guarantee and CATCHING its conflict " +
        "is the module's job (T150: \"a single insert whose conflict is caught\"); a sealed " +
        "rethrow relabels a caller's duplicate as a failing store. A `SELECT`-then-`INSERT` " +
        "passes every sequential cell in this file and surfaces exactly this under two callers.",
    ).toEqual([]);

    expect(
      await watchersOf(subject.handle),
      "and whichever way it interleaved, the derived count agrees with the rows that survived",
    ).toBe(rows);
  });
});

describe("D-131-07: cells drive all three actor kinds on the writes", () => {
  it("a genuine operator may follow, and the follow is attributed to the operator's account", async () => {
    /* Z3, closed at D-131-09. I had registered "no operator through the toggles" as a declared
       gap; the ruling points out that D-131-07 already says cells drive all three actor kinds on
       the writes, so the gap contradicted the contract's own stated expectation rather than
       recording a silence in it.

       Two factors: an operator's toggle must move the count AND the row must name the operator's
       own account. A module that accepted the actor and wrote the SUBJECT's id would answer
       `{ watchers: 1 }` and be attributing the follow to the wrong person. */
    const subject = await person("op-subject");
    const op = await person("op-actor");

    expect(await toggle(operator(op.id), subject.handle)).toEqual({
      watchers: 1,
      followedByCaller: true,
    });

    const rows = await s.query("select follower_id from follow where followed_id = $1", [
      subject.id,
    ]);
    expect(
      rows.map((r) => String(r.follower_id)),
      "B-13's second subject is a break-glass operator, and the row names the operator's own " +
        "account rather than anybody else's.",
    ).toEqual([op.id]);
  });
});
