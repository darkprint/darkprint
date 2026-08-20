/* ============================================================
   T130 AC4 — a follow toggles, and the watcher count is the
   follower count

   "AC4's 'watcher count equals the follower count' is a
   consistency criterion between two things that could drift, so
   the count is derived from the follow rows rather than
   incremented alongside them — same rule as `counts`, and the same
   reason."

   ── what this file can and cannot measure, stated up front ──
   `counts` has a discriminating cell for derived-versus-stored,
   because rows can be seeded with plain SQL and the module is
   never entered in between (`counts.test.ts`). `watchers` has no
   such cell available here, and the reason is structural rather
   than an omission: **no table in `lib/db/schema.ts` holds a
   follow** — `grep -in "follow\|watcher" lib/db/schema.ts` returns
   nothing, and `target_actor_kind` is `["star","note_vote"]` — so
   this suite cannot write a follow behind the module's back the
   way it writes a bundle. With `toggleFollow` the only publisher
   of follow state, an incremented counter and a derived count are
   hard to tell apart from outside.

   **The claim is narrowed to what it can carry**, because
   "by construction" is the shape nothing reds on when it is wrong.
   What is true is: an incremented counter and a derived count
   agree across every SEQUENTIAL sequence of `toggleFollow` calls,
   which is all this file drives. Two cases are NOT covered by that
   sentence and are named rather than folded into it:

     * concurrent toggles, where a counter written beside a row can
       drift and a derived count cannot;
     * a FOLLOWER's `account` row deleted behind the module's back —
       the `counts.test.ts` move, and the one discriminating cell
       that might actually be available here. It is not driven
       because its outcome depends on a foreign key on a table
       nobody has published: with `on delete cascade` a derived
       count drops and a counter does not, without one the delete
       raises 23503, and a cell whose two outcomes mean opposite
       things is not a measurement.

   Both are owed to a round that has a follow table to look at. A
   witness for DERIVED needs a reader of the follow rows and there
   is no table for one, which is reported as a finding rather than
   faked here.

   ── what IS measured ──
   Everything that separates a correct count from a plausible one:
   toggling returns, per-caller bookkeeping, distinctness across
   followers, isolation across followed handles, and agreement
   between the two published readers of one number.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  account,
  anonymous,
  asProfileRecord,
  bind,
  dropScratchDatabases,
  insertAccount,
  mark,
  scratchDatabase,
  type AccountFixture,
  type Scratch,
} from "./contract";

let s: Scratch;

interface Follow {
  watchers: number;
  followedByCaller: boolean;
}

async function toggle(actor: unknown, handle: string): Promise<Follow> {
  const toggleFollow = await bind("toggleFollow");
  const answer = await toggleFollow(s.db, actor, handle);
  if (answer === null || typeof answer !== "object") {
    throw new Error(
      `toggleFollow answered ${String(answer)}; the block publishes ` +
        `\`Promise<{ watchers: number; followedByCaller: boolean }>\`.`,
    );
  }
  const a = answer as Record<string, unknown>;
  if (typeof a.watchers !== "number" || typeof a.followedByCaller !== "boolean") {
    throw new Error(
      `toggleFollow answered ${JSON.stringify(answer)}; the block publishes ` +
        `\`{ watchers: number; followedByCaller: boolean }\`.`,
    );
  }
  return { watchers: a.watchers, followedByCaller: a.followedByCaller };
}

async function watchersOf(handle: string): Promise<number> {
  const getProfile = await bind("getProfile");
  return asProfileRecord(
    await getProfile(s.db, anonymous, handle),
    `getProfile(db, anonymous, "${handle}")`,
  ).watchers;
}

async function person(tag: string): Promise<AccountFixture> {
  return insertAccount(s, { handle: mark(`t130-follow-${tag}`).toLowerCase() });
}

beforeAll(async () => {
  s = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC4: a follow toggles", () => {
  it("goes on and then off, and the count follows it in both directions", async () => {
    const subject = await person("subject");
    const follower = await person("follower");
    const actor = account(follower.id, follower.handle);

    expect(await watchersOf(subject.handle)).toBe(0);

    const on = await toggle(actor, subject.handle);
    expect(on).toEqual({ watchers: 1, followedByCaller: true });

    const off = await toggle(actor, subject.handle);
    expect(
      off,
      `"a follow TOGGLES" — a second call from the same account is the unfollow, not a second ` +
        `follow. An implementation that only ever adds passes the first assertion and fails ` +
        `this one.`,
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
    /* Six calls, and the count is back where it started. A `watchers = watchers + 1` counter
       reaches 6 here; nothing in a single on/off pair separates it from a correct one. */
    expect(await watchersOf(subject.handle)).toBe(0);
  });

  it("agrees with `getProfile`'s `watchers` after every step", async () => {
    /* Two published readers of one number. A module that keeps them in different places is
       exactly the drift AC4 calls "a consistency criterion between two things that could
       drift", and neither reader alone can report it. */
    const subject = await person("agree-subject");
    const a = await person("agree-a");
    const b = await person("agree-b");

    const steps: Follow[] = [
      await toggle(account(a.id, a.handle), subject.handle),
      await toggle(account(b.id, b.handle), subject.handle),
      await toggle(account(a.id, a.handle), subject.handle),
    ];
    const expected = [1, 2, 1];
    for (const [i, step] of steps.entries()) {
      expect(step.watchers, `after step ${i + 1}`).toBe(expected[i]);
    }
    expect(await watchersOf(subject.handle)).toBe(steps[steps.length - 1]!.watchers);
  });
});

describe("AC4: the count is the number of distinct accounts currently following", () => {
  it("counts four distinct followers as four, and each unfollow as one fewer", async () => {
    const subject = await person("many-subject");
    const followers = await Promise.all([
      person("many-1"),
      person("many-2"),
      person("many-3"),
      person("many-4"),
    ]);

    for (const [i, f] of followers.entries()) {
      const answer = await toggle(account(f.id, f.handle), subject.handle);
      expect(answer).toEqual({ watchers: i + 1, followedByCaller: true });
    }
    expect(await watchersOf(subject.handle)).toBe(followers.length);

    for (const [i, f] of followers.entries()) {
      const answer = await toggle(account(f.id, f.handle), subject.handle);
      expect(answer).toEqual({
        watchers: followers.length - i - 1,
        followedByCaller: false,
      });
    }
    expect(await watchersOf(subject.handle)).toBe(0);
  });

  it("tracks each follower separately", async () => {
    /* `followedByCaller` is about the CALLER. The chain below is the only way to observe that
       through the published surface, because the flag is on the write and `getProfile` does
       not carry one: B's unfollow must leave A's follow standing, and A must then still have
       one to give up. A module keying follow state on the SUBJECT alone reports
       `followedByCaller: false` for A's third call at a count of 1, or 0 at the second. */
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
});

describe("a caller with no identity does not become a watcher", () => {
  it("an anonymous toggle leaves the count where it was", async () => {
    /* DERIVED and labelled: T130 publishes no refusal for this. B-13's two subjects are an
       owner and an operator, T060 rules that "possession of a discriminant is not authority",
       and a follow is a per-account fact with no account behind it here. So nothing is pinned
       about HOW it refuses — only that the count does not move.

       Two factors, because "the count did not move" is also what a `toggleFollow` that does
       nothing produces: an identified account's toggle immediately after must move it. */
    const subject = await person("anon-subject");
    const follower = await person("anon-follower");

    const before = await watchersOf(subject.handle);
    expect(before).toBe(0);

    let outcome: string;
    try {
      const answer = await toggle(anonymous, subject.handle);
      outcome = `resolved with ${JSON.stringify(answer)}`;
    } catch {
      outcome = "rejected";
    }

    expect(
      await watchersOf(subject.handle),
      `an anonymous \`toggleFollow\` ${outcome}; either way there is no account for the ` +
        `follow row to belong to, so the count cannot have moved.`,
    ).toBe(before);

    /* The control. */
    await toggle(account(follower.id, follower.handle), subject.handle);
    expect(await watchersOf(subject.handle)).toBe(1);
  });
});
