/* ============================================================
   T131 / D-131-10 — `setFollow` and `setSupport`

       setFollow(db, actor, handle, following: boolean)
         -> { watchers: number; followedByCaller: boolean }
       setSupport(db, actor, handle, supporting: boolean)
         -> { support: number; supportedByCaller: boolean }

   ── why these exist, because it decides what is worth asserting ──
   D-131-07's A6 published route idempotence and ratified a
   MECHANISM for it: "the route reads current state and calls the
   module only when a flip is needed". That mechanism is
   unbuildable. No published reader answers per-caller follow state
   BEFORE a write — `followedByCaller` arrives only after a flip and
   `getProfile` carries no per-caller flag — so the honest interim
   was flip, read, and flip back on disagreement: two writes per
   idempotent POST, and **a real window in which a concurrent
   `getProfile` reads `watchers` one lower than it was before and
   after**.

   The set-verbs remove the window rather than disclose it. The
   fourth parameter is the whole repair: **a verb that is told the
   DESTINATION state can be one statement, and a verb that is only
   told to flip cannot be.** So the properties worth holding here
   are the ones the toggles structurally cannot have —

     * a second identical call is a NO-OP, not a rewrite;
     * the state is never transiently absent while being set to
       the value it already has.

   ── the toggles are NOT superseded and nothing here duplicates
      them ──
   `toggleFollow`/`toggleSupport` stay published unchanged, and
   every toggle cell in `follow.test.ts` and `support.test.ts`
   stands. What this file adds is the pair of claims that separate
   the two shapes; re-asserting "it follows" here would be a second
   copy of a cell that already exists one file over.

   ── an honest limit, stated once and referred to below ──
   The no-window cell is a DETECTOR WITH A MISS RATE, not an
   oracle. The defect is transient by construction, so a clean run
   means *no sample landed inside a window* and never *there is no
   window*. It is worth running because the alternative is no
   coverage at all of the property this ruling exists to guarantee,
   and because the interim mechanism it hunts writes twice per call
   — which widens the target rather than narrowing it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PUBLISHED,
  account,
  anonymous,
  asFollowAnswer,
  asSupportAnswer,
  bind,
  dropScratchDatabases,
  followRowCount,
  followRowIdentity,
  insertAccount,
  mark,
  operator,
  sampleDuring,
  scratchDatabase,
  supportRowCount,
  supportRowIdentity,
  warmPool,
  type AccountFixture,
  type RowIdentity,
  type Scratch,
} from "./contract";

let s: Scratch;

async function person(tag: string): Promise<AccountFixture> {
  return insertAccount(s, { handle: mark(`t131-set-${tag}`).toLowerCase() });
}

/**
 * The two verbs, described so the shared properties are driven once against each.
 *
 * A table rather than two hand-written copies: `follow` and `account_support` are different
 * tables behind different unique pairs, and a module can get one right and the other wrong, so
 * every property below runs against both. The per-verb readers are what differ.
 */
const VERBS = [
  {
    verb: "setFollow" as const,
    toggle: "toggleFollow" as const,
    flag: "followedByCaller" as const,
    count: "watchers" as const,
    rows: (subject: AccountFixture) => followRowCount(s, subject.id),
    identity: (actorAccount: AccountFixture, subject: AccountFixture) =>
      followRowIdentity(s, { followerId: actorAccount.id, followedId: subject.id }),
    /* Rebuilt member by member rather than cast. `asFollowAnswer` still does the validating —
       a cast would have compiled whatever it was handed and proved nothing about the shape. */
    read: (v: unknown, where: string): Record<string, unknown> => {
      const a = asFollowAnswer(v, where);
      return { watchers: a.watchers, followedByCaller: a.followedByCaller };
    },
  },
  {
    verb: "setSupport" as const,
    toggle: "toggleSupport" as const,
    flag: "supportedByCaller" as const,
    count: "support" as const,
    rows: (subject: AccountFixture) => supportRowCount(s, subject.id),
    identity: (actorAccount: AccountFixture, subject: AccountFixture) =>
      supportRowIdentity(s, { supporterId: actorAccount.id, supportedId: subject.id }),
    read: (v: unknown, where: string): Record<string, unknown> => {
      const a = asSupportAnswer(v, where);
      return { support: a.support, supportedByCaller: a.supportedByCaller };
    },
  },
];

beforeAll(async () => {
  s = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

for (const V of VERBS) {
  describe(`D-131-10: \`${V.verb}\` is idempotent BY CONSTRUCTION`, () => {
    it(`sets the state on, and reports the count and the caller's own flag`, async () => {
      const subject = await person(`${V.verb}-on-subject`);
      const caller = await person(`${V.verb}-on-caller`);
      const set = await bind(V.verb);

      const answer = V.read(
        await set(s.db, account(caller.id, caller.handle), subject.handle, true),
        `${V.verb}(db, caller, "${subject.handle}", true)`,
      );
      expect(answer, PUBLISHED[V.verb]).toEqual({ [V.count]: 1, [V.flag]: true });
      expect(await V.rows(subject)).toBe(1);
    });

    it(`a second identical call is a NO-OP at the ROW, not a rewrite`, async () => {
      /* THE CELL THAT SEPARATES THIS VERB FROM THE TOGGLE, and a row COUNT cannot see it.

         An insert-on-conflict-do-nothing, an upsert that rewrites the row, and a
         delete-then-insert all leave exactly one row and all answer `{ count: 1, flag: true }`.
         What tells them apart is whether the row was TOUCHED, so the assertion is on the row's
         physical identity: `ctid` is the tuple's location and changes on any UPDATE or
         delete/insert, because Postgres writes a new tuple version rather than editing in place.
         `created_at` travels with it as a second axis, read as `::text` so the column's
         microseconds survive — two writes inside one millisecond are exactly what this drives,
         and a `Date` round trip would round them together.

         This is "assert what the writer LEFT BEHIND" at its sharpest: the observable outcome of
         the correct module and of a rewriting one are identical, and only the residue differs. */
      const subject = await person(`${V.verb}-noop-subject`);
      const caller = await person(`${V.verb}-noop-caller`);
      const actor = account(caller.id, caller.handle);
      const set = await bind(V.verb);

      await set(s.db, actor, subject.handle, true);
      const before = await V.identity(caller, subject);
      expect(
        before,
        "the premise: the first call left a row to be a no-op ABOUT. Without it the comparison " +
          "below is between two absences.",
      ).not.toBeUndefined();

      const answer = V.read(
        await set(s.db, actor, subject.handle, true),
        `${V.verb}(db, caller, "${subject.handle}", true) a second time`,
      );
      expect(answer, "the second call answers the same state, not a flipped one").toEqual({
        [V.count]: 1,
        [V.flag]: true,
      });

      const after = await V.identity(caller, subject);
      expect(
        after,
        `\`${V.verb}(..., true)\` against a state already on must not rewrite the row. A changed ` +
          `\`ctid\` means the tuple was replaced — an upsert that updates, or a delete followed ` +
          `by an insert — which is the double write D-131-10 removed, and it is invisible to a ` +
          `row count and to the returned answer alike.`,
      ).toEqual(before as RowIdentity);
    });

    it(`sets the state off, and a second identical call leaves it off`, async () => {
      const subject = await person(`${V.verb}-off-subject`);
      const caller = await person(`${V.verb}-off-caller`);
      const actor = account(caller.id, caller.handle);
      const set = await bind(V.verb);

      await set(s.db, actor, subject.handle, true);
      expect(await V.rows(subject)).toBe(1);

      const off = V.read(
        await set(s.db, actor, subject.handle, false),
        `${V.verb}(db, caller, "${subject.handle}", false)`,
      );
      expect(off).toEqual({ [V.count]: 0, [V.flag]: false });

      const again = V.read(
        await set(s.db, actor, subject.handle, false),
        `${V.verb}(db, caller, "${subject.handle}", false) a second time`,
      );
      expect(
        again,
        "a second `false` is a no-op and NOT a re-follow. This is the assertion a toggle " +
          "structurally cannot satisfy, and the reason two POSTs to the route were unsafe " +
          "before these verbs existed.",
      ).toEqual({ [V.count]: 0, [V.flag]: false });
      expect(await V.rows(subject)).toBe(0);
    });

    it(`setting off a state that was never on is a no-op and not an error`, async () => {
      /* The other end of idempotence, and the end a `DELETE ... WHERE` gets right for free while
         a read-then-branch can get wrong by refusing. Nothing published says this refuses, and a
         verb told a destination state has no reason to. */
      const subject = await person(`${V.verb}-never-subject`);
      const caller = await person(`${V.verb}-never-caller`);
      const set = await bind(V.verb);

      const answer = V.read(
        await set(s.db, account(caller.id, caller.handle), subject.handle, false),
        `${V.verb}(db, a caller who never set it, "${subject.handle}", false)`,
      );
      expect(answer).toEqual({ [V.count]: 0, [V.flag]: false });
      expect(await V.rows(subject)).toBe(0);
    });

    it(`agrees with \`${V.toggle}\`, which stays published and unchanged`, async () => {
      /* Two published verbs over one fact. D-131-10 keeps the toggles ("the UI's own semantics"),
         so the pair can now disagree in a way neither verb alone can report — a module holding
         set-state and toggle-state in different places passes every cell in this file and every
         cell in the toggle file. */
      const subject = await person(`${V.verb}-agree-subject`);
      const caller = await person(`${V.verb}-agree-caller`);
      const actor = account(caller.id, caller.handle);
      const set = await bind(V.verb);
      const toggle = await bind(V.toggle);

      await set(s.db, actor, subject.handle, true);
      const toggled = V.read(
        await toggle(s.db, actor, subject.handle),
        `${V.toggle} after ${V.verb}(..., true)`,
      );
      expect(
        toggled,
        `the toggle must see the state the setter left. If it reads its own bookkeeping it ` +
          `answers ${JSON.stringify({ [V.count]: 1, [V.flag]: true })} here, having "turned on" ` +
          `something that was already on.`,
      ).toEqual({ [V.count]: 0, [V.flag]: false });
      expect(await V.rows(subject)).toBe(0);
    });

    it(`refuses to move anything for a caller with no identity`, async () => {
      const subject = await person(`${V.verb}-anon-subject`);
      const set = await bind(V.verb);
      let outcome: string;
      try {
        outcome = `resolved with ${JSON.stringify(await set(s.db, anonymous, subject.handle, true))}`;
      } catch {
        outcome = "rejected";
      }
      expect(
        await V.rows(subject),
        `an anonymous \`${V.verb}\` ${outcome}; there is no account for the row to belong to. ` +
          `Read at the ROWS, because a module that wrote and then threw satisfies any ` +
          `\`rejects.toThrow()\`.`,
      ).toBe(0);
    });

    it(`lets a genuine operator set the state, and attributes the row to the operator`, async () => {
      /* D-131-07's "cells drive all three actor kinds on the writes", carried onto the new verbs
         rather than left behind on the old ones — the same gap Z3 was, one ruling later. */
      const subject = await person(`${V.verb}-op-subject`);
      const op = await person(`${V.verb}-op-actor`);
      const set = await bind(V.verb);

      const answer = V.read(
        await set(s.db, operator(op.id), subject.handle, true),
        `${V.verb}(db, operator, "${subject.handle}", true)`,
      );
      expect(answer).toEqual({ [V.count]: 1, [V.flag]: true });
      expect(
        await V.identity(op, subject),
        "the row names the OPERATOR's own account. A module writing the subject's id answers " +
          "the same count and has attributed the act to the wrong person.",
      ).not.toBeUndefined();
    });

    it(`never passes through a stateless moment while setting a state it already holds`, async () => {
      /* THE NO-WINDOW PROPERTY, and it is why these verbs exist at all.

         D-131-10 priced the mechanism it replaced: flip, read, flip back on disagreement, which
         means `setFollow(true)` against an existing follow DELETES the row and re-inserts it,
         and a concurrent reader in between sees the count one lower than it was before and
         after. A before/after pair cannot see that — both ends read 1 — so the state is sampled
         continuously WHILE the call runs.

         DETECTOR WITH A MISS RATE, registered as such: a clean run means no sample landed inside
         a window, never that there is no window. It is worth running because the shape it hunts
         writes twice per call, which widens the target, and because the alternative is no
         coverage of the property the ruling exists to guarantee. The pool is warmed first, since
         a reader that cannot get a second connection cannot observe anything mid-call — the same
         proof `follow.test.ts` takes before its race cells. */
      const subject = await person(`${V.verb}-window-subject`);
      const caller = await person(`${V.verb}-window-caller`);
      const actor = account(caller.id, caller.handle);
      const set = await bind(V.verb);
      await warmPool(s);

      await set(s.db, actor, subject.handle, true);
      expect(
        await V.rows(subject),
        "the premise: the state is ON before the call under observation, so a zero observed " +
          "below is a transient absence and not a starting condition",
      ).toBe(1);

      const { observed, failed } = await sampleDuring(
        () => V.rows(subject),
        () => Promise.resolve(set(s.db, actor, subject.handle, true)),
      );

      expect(failed, "the call under observation must itself succeed").toBeUndefined();
      expect(
        observed.length,
        "the sampler observed nothing at all, so this cell measured nothing. That is an " +
          "instrument failure and not a pass.",
      ).toBeGreaterThan(0);
      expect(
        observed.filter((n) => n !== 1),
        `a concurrent reader saw the count leave 1 while \`${V.verb}(..., true)\` ran against a ` +
          `state that was already on. ${observed.length} samples taken. That is the transient ` +
          `window D-131-10 removed: idempotent by construction means ONE statement, so there is ` +
          `no moment at which the row is absent.`,
      ).toEqual([]);
    });
  });
}
