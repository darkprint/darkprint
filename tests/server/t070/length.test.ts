/* ============================================================
   T070 — D-70-15's length bound

     "**D-70-15 stays open and is the owner's.** 255 is a *storage*
      bound and the test is what makes it safe rather than the
      number: it allocates a name of exactly `MAX_NAME_LENGTH`
      through the published surface, so raising the constant past
      what a btree tuple holds reds there instead of reaching a user.
      Deliberately not 2692, which is a property of this server's
      8 KB `BLCKSZ` and would ceiling near 1300 on a 4 KB build. The
      **product** bound is a different question and nobody owns it:
      the longest handle in the archive is 11 characters."

   ── the number is read from the ruling, never from the module ──
   `MAX_NAME_LENGTH` is not in the Published signatures block, so
   there is nothing to bind by name — and that is the right shape
   rather than a limitation. A boundary test that imports the
   constant it is bounding asserts "does the module agree with
   itself" and stays green while the constant moves, which is the
   same defect as an expected message reconstructed from the
   module's own template. `fixtures.ts` carries the 255 with the
   ruling quoted beside it.

   ── what the bound has to be OBSERVABLE as ──
   The ruling names the discriminating direction: the allocation at
   exactly the bound is what makes a raised constant red *here*
   rather than in production. So both sides are asserted, and the
   one at the bound is asserted through `allocateHandle` — the
   published surface that actually writes a btree key — and not
   through `checkHandle`, which reads and would stay green on a
   bound nothing enforces.

   ── and the trap this block is written around ──
   A test asserting that a 100 000-character name is refused is
   satisfied by a module with no bound at all, because Postgres
   raises `index row size … exceeds btree version 4 maximum` on its
   own. That is T-03's species with a new column type, and this
   suite has now met it four times. So the far case is labelled as
   what it is, and the *near* case — one character past the bound,
   which Postgres stores without complaint — is the one that
   discriminates.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  assertNoDriverLeak,
  availableNow,
  bind,
  expectNoCausePassed,
  invalidNamePrefix,
  rejects,
  unavailable,
} from "./contract";
import {
  MAX_NAME_LENGTH,
  type Scratch,
  clean,
  closeDatabase,
  createAccount,
  db,
  nameOfLength,
  openDatabase,
  reservationsFor,
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
   RETIRED BY T071 / D-071-02 — THE THREE HANDLE CELLS, AND WHY THIS
   IS A DELIBERATE RETIREMENT RATHER THAN A DELETION

   This block held four cells. Three drove the HANDLE door at
   `MAX_NAME_LENGTH` — `allocateHandle` storing a 255-character
   handle, `checkHandle` answering `available` for one, and the
   round trip between them. T071 adds `MAX_HANDLE_LENGTH = 32`
   (D-70-15), a PRODUCT bound narrower than the storage bound and
   enforced at both handle doors, so all three now assert the
   opposite of what the module is required to do. They MUST red
   under a correct T071; that was reported before a line of it was
   written and is ruled at D-071-01(5).

   **They are not re-pointed at `checkSlug`, and the reason is this
   suite's own header.** It states the discriminating direction: the
   cell at the bound is asserted "through `allocateHandle` — the
   published surface that actually writes a btree key — and not
   through `checkHandle`, which reads and would stay green on a
   bound nothing enforces". Slugs have no allocate door; `checkSlug`
   is a query. Substituting it would keep the title and lose the
   only property the cell had.

   **So the consequence is priced, not hidden: after T071 no
   published door writes a 255-character btree key, and the storage
   bound is no longer exercised AT the bound through any product
   door.** That is what a product bound narrower than a storage
   bound means, and it is by design. `MAX_NAME_LENGTH` keeps its
   constant and keeps its surface pin — `t070/surface.test.ts`
   still compares it against a literal 255, so raising it past what
   a tuple holds still reds there. What is gone is the end-to-end
   write at the bound, and the merge records it in section 11.

   The slug cell below is untouched: a 255-character SLUG is still
   legal (AC3), and `isNameSegment` is deliberately left unbounded
   so that stays true.
   ============================================================ */
describe("a name of exactly MAX_NAME_LENGTH is a name", () => {
  it(`checkSlug answers \`available\` for a free slug of ${MAX_NAME_LENGTH} characters`, async () => {
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    await availableNow(
      () => check(db(t), owner, nameOfLength(MAX_NAME_LENGTH)),
      `checkSlug(db, owner, ${MAX_NAME_LENGTH} chars)`,
    );
  });
});

describe("one character past the bound is not a name", () => {
  const OVER = MAX_NAME_LENGTH + 1;

  it(`checkHandle answers \`illegal\` at ${OVER} characters`, async () => {
    /* The discriminating case. Postgres stores a 256-character text value without complaint and
       indexes it without complaint, so nothing below this module refuses it: a green here can
       only come from the module's own bound. Contrast the far case below. */
    const check = await bind("checkHandle");
    await unavailable(
      () => check(db(t), nameOfLength(OVER)),
      `checkHandle(db, ${OVER} chars)`,
      "illegal",
    );
  });

  it(`checkSlug answers \`illegal\` at ${OVER} characters`, async () => {
    const check = await bind("checkSlug");
    const owner = await createAccount(t);
    await unavailable(
      () => check(db(t), owner, nameOfLength(OVER)),
      `checkSlug(db, owner, ${OVER} chars)`,
      "illegal",
    );
  });

  it(`allocateHandle refuses ${OVER} characters, and stores nothing`, async () => {
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    const handle = nameOfLength(OVER);
    const where = `allocateHandle(db, id, ${OVER} chars)`;

    const err = await rejects(() => allocate(db(t), account, handle), where, {
      expectedPrefix: invalidNamePrefix("allocateHandle", handle),
    });
    /* Same class, same assertion: a name refused for its length is refused before any
       statement is sent, so no driver error exists to be carried. */
    expectNoCausePassed(err, where);
    expect(await reservationsFor(t, handle)).toEqual([]);

    /* And nothing was stored under a TRUNCATED key either, which the row count above cannot
       see: a bound implemented as `handle.slice(0, MAX)` refuses nothing, writes a name the
       caller never asked for, and leaves this query — for the name the caller DID ask for —
       returning zero rows exactly as a correct refusal would. */
    const truncated = await reservationsFor(t, nameOfLength(MAX_NAME_LENGTH));
    expect(
      truncated,
      "a name one character too long was refused and a truncated one appeared in its place",
    ).toEqual([]);
  });
});

describe("far past the bound, where the storage layer refuses on its own", () => {
  /* T-03's species, labelled rather than dressed up. A btree index key has a hard maximum of
     about 2704 bytes on an 8 KB `BLCKSZ` build, so a 100 000-character handle is refused by
     PostgreSQL whether or not this module has a bound at all — the same reason a surrogate test
     aimed at a `jsonb` column cannot distinguish a module that checks from one that does not.

     Kept anyway, and kept honest about what it is. What it CAN distinguish is the shape of the
     refusal: a module with no bound reaches the driver and has to seal whatever comes back,
     while a module with one refuses before any statement is sent. Both are required to answer
     `illegal` rather than to leak an `index row size` message, so this tests the seal on a path
     nothing else in this suite reaches. It does not test the bound. */

  const FAR = 100_000;

  it(`checkHandle answers \`illegal\` at ${FAR} characters rather than leaking a driver message`, async () => {
    const check = await bind("checkHandle");
    await unavailable(
      () => check(db(t), nameOfLength(FAR)),
      `checkHandle(db, ${FAR} chars) — WEAK: Postgres would refuse this key regardless`,
      "illegal",
    );
  }, 30_000);

  it(`allocateHandle refuses ${FAR} characters in the published form`, async () => {
    const allocate = await bind("allocateHandle");
    const account = await createAccount(t);
    const handle = nameOfLength(FAR);
    const where = `allocateHandle(db, id, ${FAR} chars) — WEAK on the bound, real on the seal`;
    const err = await rejects(() => allocate(db(t), account, handle), where);
    /* No message pin here, and the reason is worth stating rather than leaving as an omission:
       the published form interpolates `<value>`, and a module that declines to put a
       100 000-character string into an error message is being sensible rather than wrong. What
       is NOT optional is the seal — nothing PostgreSQL said about btree tuple sizes may reach
       any rendering — and that is derived from the driver error rather than listed. */
    assertNoDriverLeak(err, [account, handle], where);
  }, 30_000);
});
