/* ============================================================
   T070 — bundle slugs: AC1, AC2, AC3, and the `reason`

   AC1  each reserved slug is refused as a bundle name
   AC2  two owners may both hold `frontline-triage`
   AC3  one owner may not hold it twice

   ── the reading round 1 reported is now ruled ──
   **D-70-01: `checkSlug` is a query and returns; `SlugTakenError`
   and `ReservedSlugError` are struck.** "A query asked 'is this
   available' answers, and one that throws to say 'no' makes its own
   return type meaningless."

   So round 1's tolerance — assert the refusal, pin the form on
   whichever shape arrived — is gone. `unavailable()` requires a
   returned `{ available: false }` and a throw here is a red. Keeping
   the tolerance would be a suite carrying a withdrawn clause, which
   is the failure recorded at "Resolving `backend.md`".

   ── and the `reason` is the point of the ruling ──
   The two classes were struck *and* `Availability` gained `reason`
   in the same breath, "since a caller that can no longer catch a
   class needs the discriminator in the value". A `checkSlug` that
   answers `{ available: false }` with no reason has implemented half
   of D-70-01 — the half that removes the caller's information —
   and every test that only asserts `available === false` passes it.
   All three members are reachable here and all three are asserted.

   ── the bundle rows ──
   Creating a bundle is T100's, and §T070 puts it out of scope
   explicitly, so `fixtures.ts` inserts the `(owner_id, slug)` rows
   directly. `bundle_owner_slug_key` is T000's, merged.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { RESERVED_PROFILE_SEGMENTS } from "@/components/profile/tabs";

import { availableNow, bind, unavailable } from "./contract";
import {
  type Scratch,
  clean,
  closeDatabase,
  createAccount,
  createBundle,
  db,
  freeSlug,
  openDatabase,
} from "./fixtures";

let t: Scratch;

beforeAll(async () => {
  t = await openDatabase();
}, 60_000);
afterAll(async () => {
  await closeDatabase();
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
    it(`refuses \`${segment}\` with reason "reserved", to an owner with no bundles at all`, async () => {
      const check = await bind("checkSlug");
      const owner = await createAccount(t);
      await unavailable(
        () => check(db(t), owner, segment),
        `checkSlug(db, owner, "${segment}")`,
        "reserved",
      );
    });
  }

  it("refuses a reserved slug even when a different owner already has a bundle called that", async () => {
    /* The reservation is a route collision, not a uniqueness one: `/u/<handle>/saved` resolves
       to the tab for *every* handle. A guard that only fires when the name is otherwise free,
       or that reads the reserved list after the per-owner query rather than before it, gets
       this wrong — and the reason is what shows it, since a module answering `"taken"` here has
       refused for the wrong cause and would answer `available` for the owner who has no bundle. */
    const check = await bind("checkSlug");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    const reserved = RESERVED_PROFILE_SEGMENTS[0];
    await createBundle(t, first, reserved);

    await unavailable(
      () => check(db(t), second, reserved),
      "checkSlug(db, second, reserved)",
      "reserved",
    );
  });

  it("does not refuse `blueprints`, whose tab has no segment of its own", async () => {
    /* The half of AC1 the criterion does not state, and the one with teeth against an
       over-broad guard: blueprints is the profile index as of T280, so nothing occupies
       `/u/<handle>/blueprints` and a bundle may be called that. An implementation reserving
       the tab *ids* rather than their *segments* takes a name the product never claimed. */
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    await availableNow(() => check(db(t), owner, "blueprints"), 'checkSlug(db, owner, "blueprints")');
  });

  it("does not refuse an ordinary slug, and gives it no reason", async () => {
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    const answer = await availableNow(() => check(db(t), owner, freeSlug()), "checkSlug");
    expect(answer.reason, "a name that was not refused has nothing to explain").toBeUndefined();
  });
});

/* ============================================================
   AC2
   ============================================================ */

describe("AC2: two owners may both hold `frontline-triage`", () => {
  it("answers `available` to a second owner for a slug the first already has", async () => {
    /* B-09: slugs are unique **per owner**, and the public route carries the owner —
       `/blueprints/{owner}/{slug}`. The index is `bundle_owner_slug_key` on `(owner_id, slug)`,
       so the database permits this; what this discriminates is a module that queries on `slug`
       alone and refuses a name it had no business refusing. */
    const check = await bind("checkSlug");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    await createBundle(t, first, "frontline-triage");

    await availableNow(
      () => check(db(t), second, "frontline-triage"),
      "checkSlug(db, second, slug)",
    );
  });

  it("answers `available` to a second owner even when the first holds several", async () => {
    const check = await bind("checkSlug");
    const [first, second] = [await createAccount(t), await createAccount(t)];
    const shared = freeSlug();
    for (const slug of [freeSlug(), shared, freeSlug()]) await createBundle(t, first, slug);

    await availableNow(() => check(db(t), second, shared), "checkSlug(db, second, slug)");
  });
});

/* ============================================================
   AC3
   ============================================================ */

describe("AC3: one owner may not hold `frontline-triage` twice", () => {
  it('refuses the owner who already has a bundle at that slug, with reason "taken"', async () => {
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    await createBundle(t, owner, "frontline-triage");

    await unavailable(
      () => check(db(t), owner, "frontline-triage"),
      "checkSlug(db, owner, slug)",
      "taken",
    );
  });

  it("offers a suggestion that is free, and never one of the four the tabs occupy", async () => {
    /* AC6's promise is over "a taken name", not over handles alone. A slug suggestion is held
       to the same standard, plus one this module can get wrong in a way the handle side cannot:
       suggesting a name `checkSlug` itself reserves. */
    const check = await bind("checkSlug");
    const isReserved = await bind("isReservedSlug");
    const owner = await createAccount(t);
    await createBundle(t, owner, "frontline-triage");

    const answer = await unavailable(
      () => check(db(t), owner, "frontline-triage"),
      "checkSlug(taken)",
      "taken",
    );
    const suggestion = answer.suggestion;
    expect(
      suggestion,
      "AC6 is a criterion, and a module that never suggests leaves it nothing to observe",
    ).toBeTypeOf("string");
    expect(suggestion, "a suggestion equal to the taken name suggests nothing").not.toBe(
      "frontline-triage",
    );
    expect(isReserved(suggestion), `suggested the reserved slug \`${suggestion}\``).toBe(false);
    await availableNow(
      () => check(db(t), owner, suggestion as string),
      "checkSlug(db, owner, suggestion)",
    );
  });

  it("refuses only the exact slug, not one that merely starts with it", async () => {
    /* A query written with `like` or `startsWith` — or one that folds the plural — refuses
       names the owner is entitled to, and AC3 as stated cannot see it: every case AC3 names is
       one where the answer must be "no". */
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    await createBundle(t, owner, "frontline-triage");

    for (const slug of ["frontline-triage-2", "frontline", "frontline-triages", "rontline-triage"]) {
      await availableNow(
        () => check(db(t), owner, slug),
        `checkSlug(db, owner, "${slug}") — a different slug from \`frontline-triage\``,
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

    await unavailable(() => check(db(t), first, slug), "checkSlug(db, first, slug)", "taken");
    await availableNow(() => check(db(t), second, slug), "checkSlug(db, second, slug)");
  });
});

/* ============================================================
   D-70-04's grammar, reached through the slug side
   ============================================================ */

describe('checkSlug answers reason "illegal" for a name the grammar refuses', () => {
  /* D-70-04: one grammar for handles, slugs and namespaces. The reason a slug needs one at all
     is stated there and is not tidiness: "a slug with no grammar lets an unpaired surrogate
     reach a `SELECT` as U+FFFD, so `checkSlug` would answer about a name nobody typed."

     That is the discriminating case in this block and it is why the surrogate is here rather
     than only in the pure-function file: `pg` sends `text` as UTF-8, an unpaired surrogate has
     no UTF-8 encoding, and the driver replaces it with U+FFFD. The query then asks about a
     DIFFERENT name and answers truthfully about it. A module with no slug grammar returns
     `{ available: true }` and the caller has been told about a name it did not name. */

  const ILLEGAL: ReadonlyArray<readonly [string, string]> = [
    ["", "empty"],
    ["Frontline-Triage", "uppercase"],
    ["frontline_triage", "an underscore"],
    ["-frontline", "a leading hyphen"],
    ["frontline-", "a trailing hyphen"],
    ["frontline triage", "interior whitespace"],
    [" frontline-triage", "a leading space, which `parseCardRef` would trim away"],
    ["frontline/triage", "a separator: a slug is one segment"],
    ["front\uD800line", "an unpaired surrogate, which `pg` would send as U+FFFD"],
  ];

  for (const [slug, why] of ILLEGAL) {
    it(`refuses ${JSON.stringify(slug)} — ${why}`, async () => {
      const check = await bind("checkSlug");
      const owner = await createAccount(t);
      await unavailable(
        () => check(db(t), owner, slug),
        `checkSlug(db, owner, ${JSON.stringify(slug)})`,
        "illegal",
      );
    });
  }

  it("answers `illegal` rather than `taken` when the trimmed form IS taken", async () => {
    /* The sharpest case the trimming defect produces, and neither half alone finds it. With no
       grammar and a trimming round-trip, `" frontline-triage"` becomes `frontline-triage`,
       which this owner does hold — so the module answers `{ available: false, reason: "taken" }`
       and looks entirely correct. The name it answered about is not the name it was asked
       about, and only the reason distinguishes the two. */
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    await createBundle(t, owner, "frontline-triage");

    await unavailable(
      () => check(db(t), owner, " frontline-triage"),
      'checkSlug(db, owner, " frontline-triage")',
      "illegal",
    );
  });
});

/* ============================================================
   D-70-18: which refusals carry a suggestion
   ============================================================ */

describe("D-70-18: a suggestion accompanies exactly the well-formed refusals", () => {
  /* `unavailable()` enforces this over every refusal in the suite, which is what makes it bind
     rather than depend on somebody remembering. These are the named cases, because a criterion
     nobody can point at in a test list is a criterion nobody reviews.

     The ruling's own reasoning is the part worth keeping: AC6 said *a suggestion returned for a
     taken name is itself free*, a conditional that a module returning no suggestion satisfies
     completely while observing nothing. A guard that cannot fail, inside an acceptance
     criterion, since the contract was written. */

  for (const segment of RESERVED_PROFILE_SEGMENTS) {
    it(`offers an alternative to the reserved \`${segment}\`, which is free and not itself reserved`, async () => {
      /* The half that was held by nothing before D-70-18. `reserved` is a refusal of a
         perfectly legal name — the tab occupies it, the grammar does not object — so an
         alternative can be offered, and AC6's freeness clause binds it once it is. */
      const check = await bind("checkSlug");
      const isReserved = await bind("isReservedSlug");
      const owner = await createAccount(t);

      const answer = await unavailable(
        () => check(db(t), owner, segment),
        `checkSlug(db, owner, "${segment}")`,
        "reserved",
      );
      const suggestion = answer.suggestion as string;
      expect(suggestion).not.toBe(segment);
      expect(isReserved(suggestion), `suggested \`${suggestion}\`, which is itself a tab`).toBe(
        false,
      );
      await availableNow(
        () => check(db(t), owner, suggestion),
        `checkSlug(db, owner, "${suggestion}")`,
      );
    });
  }

  it("offers nothing for an illegal slug", async () => {
    /* The direction a "suggestion is required" assertion PASSES rather than catches, which is
       why it is written out separately: substitution, not removal. You can only offer an
       alternative to a name that is itself legal, so a module that suggests here has answered a
       question the caller did not ask and put a name where the refusal needed to be. */
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    for (const slug of ["Not A Slug", "frontline/triage", " frontline-triage", ""]) {
      const answer = await unavailable(
        () => check(db(t), owner, slug),
        `checkSlug(db, owner, ${JSON.stringify(slug)})`,
        "illegal",
      );
      expect(answer.suggestion, `for ${JSON.stringify(slug)}`).toBeUndefined();
    }
  });

  it("offers nothing for an illegal handle either", async () => {
    const check = await bind("checkHandle");
    for (const handle of ["Not A Handle", "mara/veil", "-mara", ""]) {
      const answer = await unavailable(
        () => check(db(t), handle),
        `checkHandle(db, ${JSON.stringify(handle)})`,
        "illegal",
      );
      expect(answer.suggestion, `for ${JSON.stringify(handle)}`).toBeUndefined();
    }
  });
});
