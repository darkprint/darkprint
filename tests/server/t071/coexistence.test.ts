/* ============================================================
   T071 AC3 — the two bounds coexist, and the new one did not leak

     "(3) `MAX_NAME_LENGTH` is unchanged at 255 and the SLUG half of
      T070's boundary suite still passes — a 200-character slug stays
      legal … the bound is on handles, not on names"

   ── this file is the must-NOT-change direction, and it needs three ──
   A flip needs controls in three directions: what must change, what
   must not, and proof the OLD answer is still producible IN THE SAME
   RUN. Without the third, a targeted bound on handles and a global
   bound on every name read identically from a file that only ever
   drives handles.

   So the pairing cell below asks BOTH doors about the SAME
   33-character string, in one cell, against one module load. The two
   answers must differ, and they must differ in the published
   direction. A cell that measured the handle door here and the slug
   door in another file would differ in the door, the worker, the
   scratch database and the module instance — four differences
   dressed as one.

   ── where the bound must NOT be, in the implementer's own words ──
   D-071-01(1): "The bound is a NEW handle-specific predicate
   exported from `grammar.ts` and consumed in `handles.ts` — NEVER
   inside `isNameSegment`, which is shared three ways and whose
   bounding would kill AC3 and reach the out-of-scope namespaces."
   Every cell in the second and third describes is that sentence
   made observable from outside.

   ── premises, measured rather than assumed ──
   Run against the PRE-T071 barrel at `66f502a`, before a cell here
   was written: `validateCardId` answered `[]` at 32, 33, 200, 255
   AND 256 — it carries no length bound at all — and
   `validateNamespace` answered `[]` through 255 and one
   `card/bad-id` error at 256. So every "still clean" assertion below
   was verified reachable, and the one "still refuses" assertion was
   verified to be the module's existing behaviour rather than a
   guess. An absence assertion for an answer that was never there is
   green before the change, green after a correct one, and green
   after a wrong one.

   Recorded and deliberately not repaired here: `t110/fixtures.ts:205`
   and `t120/fixtures.ts:210` both say T071 bounds
   `validateNamespace`. D-071-01 rules that prose wrong about where
   the bound lands. This file is what makes the correction checkable.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { asDiagnostics, availableNow, bind, errorsOf, unavailable } from "./contract";
import {
  MAX_HANDLE_LENGTH,
  MAX_NAME_LENGTH,
  clean,
  closeDatabase,
  createAccount,
  db,
  distinctNameOfLength,
  nameOfLength,
  openDatabase,
} from "./fixtures";

const OVER_HANDLE = MAX_HANDLE_LENGTH + 1;
const OVER_NAME = MAX_NAME_LENGTH + 1;

/** AC3's own number, and it is not 255 on purpose — the criterion names 200. */
const AC3_SLUG_LENGTH = 200;

beforeAll(openDatabase, 60_000);
afterAll(closeDatabase, 60_000);
beforeEach(clean, 60_000);

describe("the pairing: one string, both doors, one module load", () => {
  it(`${OVER_HANDLE} characters is \`illegal\` as a handle and \`available\` as a slug`, async () => {
    /* The whole of AC3 in one measurement, and the only shape that cannot be confounded. The
       two calls differ in the door and in nothing else: same string, same scratch database,
       same worker, same imported module. A bound placed in D-70-04's shared grammar makes both
       answers `illegal`; a bound that never landed makes both `available`; only a bound in the
       handle-specific predicate produces the pair below. */
    const name = distinctNameOfLength(OVER_HANDLE, "pair");
    const owner = await createAccount();
    const checkHandle = await bind("checkHandle");
    const checkSlug = await bind("checkSlug");

    await unavailable(
      () => checkHandle(db(), name),
      `checkHandle(db, "${name}") — ${OVER_HANDLE} chars, past the PRODUCT bound`,
      "illegal",
    );
    await availableNow(
      () => checkSlug(db(), owner, name),
      `checkSlug(db, owner, "${name}") — the SAME ${OVER_HANDLE} characters, as a slug`,
    );
  });
});

describe("the slug half of §T070's boundary suite, from this side", () => {
  /* D-071-02 retires the three HANDLE cells of `tests/server/t070/length.test.ts` and keeps its
     slug cells. These are not those cells and do not replace them — they are the same claims
     asserted from the suite that caused the retirement, so the criterion has a witness inside
     T071's own partition rather than only inside the suite T071 amended. */

  it(`checkSlug answers \`available\` at ${AC3_SLUG_LENGTH} characters — AC3's own number`, async () => {
    const owner = await createAccount();
    const check = await bind("checkSlug");
    await availableNow(
      () => check(db(), owner, nameOfLength(AC3_SLUG_LENGTH)),
      `checkSlug(db, owner, ${AC3_SLUG_LENGTH} chars)`,
    );
  });

  it(`checkSlug answers \`available\` at ${MAX_NAME_LENGTH} characters — at the storage bound`, async () => {
    const owner = await createAccount();
    const check = await bind("checkSlug");
    await availableNow(
      () => check(db(), owner, nameOfLength(MAX_NAME_LENGTH)),
      `checkSlug(db, owner, ${MAX_NAME_LENGTH} chars)`,
    );
  });

  it(`checkSlug still answers \`illegal\` at ${OVER_NAME} characters — the storage bound still bounds`, async () => {
    /* The direction the two cells above cannot cover. "The bound did not narrow" is satisfied by
       a module with no bound on slugs at all, and that module is wrong in the other direction:
       §T070's 255 is what keeps a name inside a btree tuple. Both edges, so a repair that
       widened instead of narrowing reds too. */
    const owner = await createAccount();
    const check = await bind("checkSlug");
    await unavailable(
      () => check(db(), owner, nameOfLength(OVER_NAME)),
      `checkSlug(db, owner, ${OVER_NAME} chars)`,
      "illegal",
    );
  });
});

describe("the pure grammar is untouched — `Out of scope`, asserted", () => {
  /* §T071: "**Out of scope:** any bound on slugs, card ids or term namespaces." Both functions
     are pure and take no `Db`, so these are the cheapest cells in the suite and the ones that
     red loudest if the bound went into `isNameSegment`. */

  for (const length of [MAX_HANDLE_LENGTH, OVER_HANDLE, AC3_SLUG_LENGTH, MAX_NAME_LENGTH]) {
    it(`validateCardId reports no error at ${length} characters`, async () => {
      const validate = await bind("validateCardId");
      const diagnostics = asDiagnostics(validate(nameOfLength(length)), "validateCardId");
      expect(
        errorsOf(diagnostics).map((d) => `${d.code}: ${d.message}`),
        `a card id of ${length} characters is refused. Measured on the pre-T071 barrel at ` +
          `\`66f502a\`, \`validateCardId\` carried NO length bound and answered \`[]\` at every ` +
          `length tried including ${OVER_NAME}. A card id is out of scope for this task by name.`,
      ).toEqual([]);
    });

    it(`validateNamespace reports no error at ${length} characters`, async () => {
      const validate = await bind("validateNamespace");
      const diagnostics = asDiagnostics(validate(nameOfLength(length)), "validateNamespace");
      expect(
        errorsOf(diagnostics).map((d) => `${d.code}: ${d.message}`),
        `a namespace of ${length} characters is refused. \`validateNamespace\` answered \`[]\` ` +
          `through ${MAX_NAME_LENGTH} on the pre-T071 barrel. Term namespaces are out of scope ` +
          `for this task by name, and D-071-01 records that \`t110/fixtures.ts:205\` and ` +
          `\`t120/fixtures.ts:210\` are wrong to say T071 bounds this function.`,
      ).toEqual([]);
    });
  }

  it(`validateNamespace still refuses ${OVER_NAME} characters — the bound it DOES have`, async () => {
    /* The control that keeps the four cells above from being a claim about a function with no
       bounds at all. This one error existed before T071 and must survive it. Measured, not
       recalled: `card/bad-id` at 256 on the pre-T071 barrel. */
    const validate = await bind("validateNamespace");
    const diagnostics = asDiagnostics(validate(nameOfLength(OVER_NAME)), "validateNamespace");
    expect(
      errorsOf(diagnostics).length,
      `\`validateNamespace\` no longer refuses a ${OVER_NAME}-character namespace. The four ` +
        `"no error" cells above are green against a function that validates nothing, and this ` +
        `is what tells them apart.`,
    ).toBeGreaterThan(0);
  });
});
