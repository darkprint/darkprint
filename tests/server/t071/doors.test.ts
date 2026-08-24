/* ============================================================
   T071 AC1 — BOTH doors, at the 32/33 boundary

     "(1) a 32-character handle is available and allocatable; a
      33-character one answers `illegal` from `checkHandle` **and**
      is refused by `allocateHandle` — both doors, since a check that
      only guards the query lets the write through"

   ── why the write door is the load-bearing half ──
   The criterion says it outright and this file is arranged around
   it. `checkHandle` is a query: a bound enforced there and nowhere
   else turns a sign-up form amber and admits the row anyway, and
   every cell driving only the query stays green while it happens.
   So the 33 case is driven through `allocateHandle` in a cell of its
   own, and that cell asserts what the writer LEFT BEHIND rather than
   only that it threw — a mutation that inserts the row and *then*
   throws satisfies every `rejects.toThrow()` a reviewer would write.

   ── and why the 32 case asserts the stored KEY, not the promise ──
   `allocateHandle` publishes `Promise<void>`, so "it resolved" is
   the whole of what the return value can say. A bound implemented as
   `handle.slice(0, MAX_HANDLE_LENGTH)` resolves exactly as a correct
   module does — and writes a primary key the caller never asked for.
   The row is read back and its length compared, so truncation reds
   here rather than reaching whoever later looks their own handle up
   and cannot find it.

   ── the boundary is at 33 because 33 is where nothing else refuses ──
   Postgres stores and indexes a 33-character text value without
   complaint. A green in this file can only come from the module's
   own bound. That is the same argument §T070's length suite makes
   for 256 against a btree tuple, arriving one bound lower.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  availableNow,
  bind,
  expectNoCausePassed,
  invalidNamePrefix,
  rejects,
  unavailable,
} from "./contract";
import {
  MAX_HANDLE_LENGTH,
  allReservedHandles,
  clean,
  closeDatabase,
  createAccount,
  db,
  distinctNameOfLength,
  nameOfLength,
  openDatabase,
  reservationsFor,
} from "./fixtures";

/** One past the product bound. Derived from the literal, so the two can never disagree. */
const OVER = MAX_HANDLE_LENGTH + 1;

beforeAll(openDatabase, 60_000);
afterAll(closeDatabase, 60_000);
beforeEach(clean, 60_000);

describe(`a handle of exactly ${MAX_HANDLE_LENGTH} characters is a handle`, () => {
  it(`checkHandle answers \`available\` at ${MAX_HANDLE_LENGTH} characters`, async () => {
    const handle = distinctNameOfLength(MAX_HANDLE_LENGTH);
    /* The module is bound LAST, after the name exists. An early bind reds before the fixture
       runs and masks everything below it while being perfectly correct about its own subject. */
    const check = await bind("checkHandle");
    await availableNow(
      () => check(db(), handle),
      `checkHandle(db, ${MAX_HANDLE_LENGTH} chars) — at the bound, not past it`,
    );
  });

  it(`allocateHandle stores a handle of ${MAX_HANDLE_LENGTH} characters, at full length`, async () => {
    const handle = distinctNameOfLength(MAX_HANDLE_LENGTH);
    const account = await createAccount();
    const allocate = await bind("allocateHandle");

    await expect(allocate(db(), account, handle)).resolves.toBeUndefined();

    const rows = await reservationsFor(handle);
    expect(rows.length, "the row is really there, under the name the caller asked for").toBe(1);
    expect(
      rows[0].handle.length,
      `the stored primary key is ${MAX_HANDLE_LENGTH} characters. A bound implemented by ` +
        `TRUNCATION resolves this call exactly as a correct module does and stores a different ` +
        `key from the one the caller asked for — \`Promise<void>\` cannot tell the two apart, ` +
        `so the row is what is read.`,
    ).toBe(MAX_HANDLE_LENGTH);
    expect(rows[0].accountId, "and it is held by the account that asked for it").toBe(account);
    expect(rows[0].status).toBe("active");
  });

  it(`and the ${MAX_HANDLE_LENGTH}-character handle reads back as taken once allocated`, async () => {
    /* Round-trip through both halves. A bound applied on write and not on read, or a name
       truncated on the way in, shows up here as a handle the module just stored and cannot
       find — while both single-sided cells above stay green. */
    const handle = distinctNameOfLength(MAX_HANDLE_LENGTH);
    const account = await createAccount();
    const allocate = await bind("allocateHandle");
    const check = await bind("checkHandle");

    await allocate(db(), account, handle);
    await unavailable(
      () => check(db(), handle),
      `checkHandle(db, ${MAX_HANDLE_LENGTH} chars, taken)`,
      "taken",
    );
  });
});

describe(`${OVER} characters is not a handle, at BOTH doors`, () => {
  it(`the query door: checkHandle answers \`illegal\` at ${OVER} characters`, async () => {
    /* `unavailable` carries D-70-18's forbidden half, so this cell also holds AC2 in passing.
       AC2 gets its own file anyway — this one would pass against a module that answered
       `illegal` for every input, and that file is where the discrimination lives. */
    const handle = distinctNameOfLength(OVER);
    const check = await bind("checkHandle");
    await unavailable(
      () => check(db(), handle),
      `checkHandle(db, ${OVER} chars) — one past the product bound`,
      "illegal",
    );
  });

  it(`the WRITE door: allocateHandle refuses ${OVER} characters`, async () => {
    /* The criterion's own sentence: "a check that only guards the query lets the write
       through". Everything asserted below the rejection is there because a module that inserts
       and then throws satisfies the rejection alone. */
    const handle = distinctNameOfLength(OVER);
    const account = await createAccount();
    const where = `allocateHandle(db, id, ${OVER} chars)`;
    const allocate = await bind("allocateHandle");

    const err = await rejects(() => allocate(db(), account, handle), where, {
      expectedPrefix: invalidNamePrefix("allocateHandle", handle),
    });

    /* A handle refused for its LENGTH is refused before any statement is sent, so no driver
       error exists to be carried. The descriptor is the discriminator — a constructor calling
       `super(message, { cause })` unconditionally passes every rendering check while carrying
       nothing. */
    expectNoCausePassed(err, where);
  });

  it(`and the refused ${OVER}-character handle left NOTHING behind — not even truncated`, async () => {
    const handle = distinctNameOfLength(OVER);
    const truncated = handle.slice(0, MAX_HANDLE_LENGTH);
    const account = await createAccount();
    const allocate = await bind("allocateHandle");

    await rejects(() => allocate(db(), account, handle), `allocateHandle(db, id, ${OVER} chars)`);

    expect(await reservationsFor(handle), "no row under the name the caller asked for").toEqual([]);

    /* The row count above cannot see this, and it is the concrete bad output the header names:
       a bound implemented as `handle.slice(0, MAX_HANDLE_LENGTH)` refuses NOTHING, writes a
       name the caller never asked for, and leaves the query for the name the caller DID ask
       for returning zero rows exactly as a correct refusal would. The assertion has to exclude
       that output rather than merely admit the good one. */
    expect(
      await reservationsFor(truncated),
      `a handle one character too long was refused and \`${truncated}\` — its first ` +
        `${MAX_HANDLE_LENGTH} characters — appeared in its place. That is a name nobody asked ` +
        `for, holding the primary key, under an account that requested something else.`,
    ).toEqual([]);

    /* And the total, so a write under any THIRD name — a normalisation, a hash, a lowercased
       variant — is caught too. The two queries above each name one string; this one names none
       and is the only thing here that could not be satisfied by guessing wrong. */
    expect(
      await allReservedHandles(),
      `\`handle_reservation\` is not empty after a refused allocation. Nothing else in this ` +
        `cell writes to it, so whatever is there was written by the call that was supposed to ` +
        `refuse.`,
    ).toEqual([]);
  });

  it(`the far case: ${OVER} is refused for the BOUND, and ${MAX_HANDLE_LENGTH + 200} for the same reason`, async () => {
    /* Labelled as the weaker of the two rather than dressed up as a second measurement. A very
       long handle is refused by any module with a bound, by a module with only §T070's 255, and
       eventually by Postgres itself — so it discriminates nothing about THIS bound. What it can
       still show is that the two are the same path: one `illegal`, one refusal, no driver
       message leaking out of a length comparison that never reached a statement. The cell above
       at exactly ${OVER} is the one that measures the bound. */
    const far = nameOfLength(MAX_HANDLE_LENGTH + 200);
    const account = await createAccount();
    const check = await bind("checkHandle");
    const allocate = await bind("allocateHandle");

    await unavailable(
      () => check(db(), far),
      `checkHandle(db, ${far.length} chars) — WEAK on the bound: §T070's 255 refuses this too`,
      "illegal",
    );
    const err = await rejects(
      () => allocate(db(), account, far),
      `allocateHandle(db, id, ${far.length} chars) — WEAK on the bound, real on the path`,
      { expectedPrefix: invalidNamePrefix("allocateHandle", far) },
    );
    expectNoCausePassed(err, `allocateHandle(db, id, ${far.length} chars)`);
  });
});
