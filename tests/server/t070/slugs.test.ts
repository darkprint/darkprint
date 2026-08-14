/* ============================================================
   T070 — bundle slugs: AC1, AC2, AC3

   AC1  each reserved slug is refused as a bundle name
   AC2  two owners may both hold `frontline-triage`
   AC3  one owner may not hold it twice

   ── the one reading this suite could not settle ──
   `checkSlug` is published as `Promise<Availability>` and is ALSO
   the operation named in two of the four admissible message forms
   (`SlugTakenError`, `ReservedSlugError`). Both cannot be the whole
   story: if it throws on those two paths, `available` can only ever
   be `true` and the declared return type is dead.

   Reported to the orchestrator rather than resolved here. What both
   readings agree on is that the name is REFUSED, so `refusalOf`
   asserts that unconditionally and then pins the published message
   on whichever shape arrived. Neither branch is empty — this is not
   the conditional-assertion hazard, where a check exists only when
   the subject supplies the shape it keys on and silently vanishes
   otherwise.

   ── the bundle rows ──
   Creating a bundle is T100's, and §T070 puts it out of scope
   explicitly, so `fixtures.ts` inserts the `(owner_id, slug)` rows
   through `lib/db`'s schema directly. `bundle_owner_slug_key` is the
   unique index the criteria are about, and it is T000's, merged.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { RESERVED_PROFILE_SEGMENTS } from "@/components/profile/tabs";

import {
  asAvailability,
  bind,
  expectSealedError,
  refusalOf,
  reservedSlugMessage,
  slugTakenMessage,
} from "./contract";
import {
  type TestDb,
  clean,
  createAccount,
  createBundle,
  db,
  freeSlug,
  openDatabase,
} from "./fixtures";

let t: TestDb;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
/* The explicit timeouts are not padding. vitest's default `hookTimeout` is 10s, and this
   repository shares one Postgres on 5432 across every worktree with no owner — under that
   load a `DROP DATABASE` crossed 10s and all four database files here reported
   `Hook timed out in 10000ms`. Two consequences, and the second is the one that matters: a
   failed hook runs no test, so it adds NOTHING to the failed-test column and a handoff
   reading the total would call a red run green (backend.md, "read the exit code and the
   failed-file count, never the test total"); and a teardown that times out never drops its
   scratch database, so the harness itself becomes the residue. `testTimeout` is already 20s
   for the same reason one level up. */
afterAll(async () => {
  await t?.drop();
}, 60_000);
beforeEach(async () => {
  await clean(t);
}, 60_000);

/* ============================================================
   AC1
   ============================================================ */

describe("AC1: each reserved slug is refused as a bundle name", () => {
  /* Quantified over `RESERVED_PROFILE_SEGMENTS` by construction. §T070 asks for exactly that —
     "read them from that module rather than restating the list, so the profile tabs and this
     guard cannot drift" — so a fifth tab is covered by this loop the day it is added. */
  for (const segment of RESERVED_PROFILE_SEGMENTS) {
    it(`refuses \`${segment}\` to an owner with no bundles at all`, async () => {
      const check = await bind("checkSlug");
      const owner = await createAccount(t);

      const refusal = await refusalOf(
        () => check(db(t), owner, segment),
        `checkSlug(db, owner, "${segment}")`,
      );
      if (refusal.kind === "threw") {
        expectSealedError(refusal.error, `checkSlug(db, owner, "${segment}")`, {
          expectedMessage: reservedSlugMessage(segment),
        });
      }
    });
  }

  it("refuses a reserved slug even when a different owner already has a bundle called that", async () => {
    /* The reservation is a route collision, not a uniqueness one: `/u/<handle>/saved` resolves
       to the tab for *every* handle. A guard that only fires when the name is otherwise free,
       or that reads the reserved list after the per-owner query rather than before it, gets
       this wrong and no criterion phrased as "each reserved slug is refused" would notice. */
    const check = await bind("checkSlug");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    const reserved = RESERVED_PROFILE_SEGMENTS[0];
    await createBundle(t, first, reserved);

    await refusalOf(() => check(db(t), second, reserved), "checkSlug(db, second, reserved)");
  });

  it("does not refuse `overview`, whose tab has no segment of its own", async () => {
    /* The half of AC1 the criterion does not state, and the one that has teeth against an
       over-broad guard: the overview tab is the profile index, so nothing occupies
       `/u/<handle>/overview` and a bundle may be called that. An implementation reserving the
       tab *ids* rather than their *segments* takes a name the product never claimed. */
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    const answer = asAvailability(
      await check(db(t), owner, "overview"),
      'checkSlug(db, owner, "overview")',
    );
    expect(answer.available).toBe(true);
  });

  it("does not refuse an ordinary slug", async () => {
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    const answer = asAvailability(await check(db(t), owner, freeSlug()), "checkSlug");
    expect(answer.available).toBe(true);
  });
});

/* ============================================================
   AC2
   ============================================================ */

describe("AC2: two owners may both hold `frontline-triage`", () => {
  it("answers `available` to a second owner for a slug the first already has", async () => {
    /* B-09: slugs are unique **per owner**, and the public route carries the owner —
       `/blueprints/{owner}/{slug}`. The index is `bundle_owner_slug_key` on `(owner_id, slug)`,
       so the database permits this; what this test discriminates is a module that queries on
       `slug` alone and refuses a name it had no business refusing. */
    const check = await bind("checkSlug");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    await createBundle(t, first, "frontline-triage");

    const answer = asAvailability(
      await check(db(t), second, "frontline-triage"),
      "checkSlug(db, second, slug)",
    );
    expect(answer.available).toBe(true);
  });

  it("answers `available` to a second owner even when the first holds several", async () => {
    const check = await bind("checkSlug");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    const shared = freeSlug();
    for (const slug of [freeSlug(), shared, freeSlug()]) await createBundle(t, first, slug);

    const answer = asAvailability(await check(db(t), second, shared), "checkSlug(db, second, slug)");
    expect(answer.available).toBe(true);
  });
});

/* ============================================================
   AC3
   ============================================================ */

describe("AC3: one owner may not hold `frontline-triage` twice", () => {
  it("refuses the owner who already has a bundle at that slug", async () => {
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    await createBundle(t, owner, "frontline-triage");

    const where = "checkSlug(db, owner, slug)";
    const refusal = await refusalOf(() => check(db(t), owner, "frontline-triage"), where);
    if (refusal.kind === "threw") {
      /* `<owner>` in the published form is read as the value the caller supplied, which is the
         `ownerId` argument — `checkSlug` has no handle without a join it was not given. The
         ambiguity is reported to the orchestrator; it is pinned here rather than left loose,
         because a form published before the implementation exists is the only kind of pin that
         is not tautological. */
      expectSealedError(refusal.error, where, {
        expectedMessage: slugTakenMessage(owner, "frontline-triage"),
      });
    } else if (refusal.availability.suggestion !== undefined) {
      /* Only reachable under the `Availability` reading. AC6's promise is over "a taken name",
         not over handles alone, so a suggestion offered here is held to the same standard: free
         at the moment it is returned, and never one of the four the profile tabs occupy. */
      const suggestion = refusal.availability.suggestion;
      expect(suggestion, "a suggestion equal to the taken name suggests nothing").not.toBe(
        "frontline-triage",
      );
      const isReserved = await bind("isReservedSlug");
      expect(isReserved(suggestion), `suggested the reserved slug \`${suggestion}\``).toBe(false);
      const second = asAvailability(
        await check(db(t), owner, suggestion),
        "checkSlug(db, owner, suggestion)",
      );
      expect(second.available, "a suggestion is free at the moment it is returned").toBe(true);
    }
  });

  it("refuses only the exact slug, not one that merely starts with it", async () => {
    /* A query written with `like` or `startsWith` — or one that folds the plural — refuses
       names the owner is entitled to, and AC3 as stated cannot see it: every case AC3 names is
       one where the answer must be "no". */
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    await createBundle(t, owner, "frontline-triage");

    for (const slug of ["frontline-triage-2", "frontline", "frontline-triages", "rontline-triage"]) {
      const answer = asAvailability(
        await check(db(t), owner, slug),
        `checkSlug(db, owner, "${slug}")`,
      );
      expect(answer.available, `\`${slug}\` is a different slug from \`frontline-triage\``).toBe(
        true,
      );
    }
  });

  it("keeps answering per owner when both owners are in the table", async () => {
    /* AC2 and AC3 in one call sequence, which is where an implementation that binds the owner
       parameter to the wrong position shows up: each criterion on its own passes with the
       arguments swapped as long as only one owner exists. */
    const check = await bind("checkSlug");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    const slug = freeSlug();
    await createBundle(t, first, slug);

    await refusalOf(() => check(db(t), first, slug), "checkSlug(db, first, slug)");
    expect(
      asAvailability(await check(db(t), second, slug), "checkSlug(db, second, slug)").available,
    ).toBe(true);
  });
});
