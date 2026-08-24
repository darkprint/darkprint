/* ============================================================
   T071 — the published surface, which is one line long

   D-071-01(4): "**`MAX_HANDLE_LENGTH` IS PUBLISHED, on the barrel**
   — `index.ts` granted for the one name, D-70-17's own precedent;
   this line is the section's published-signatures block:
   `MAX_HANDLE_LENGTH = 32`, exported from `@/lib/server/naming`."

   No acceptance criterion names the export, which is exactly why
   this file exists: across this run the blind suites have earned
   their keep on what no criterion states.

   ── what is deliberately NOT bound here ──
   The predicate that enforces the bound. The same ruling: "The new
   predicate's spelling is the implementer's; it need not reach the
   barrel." So nothing in this suite binds a name for it, and every
   assertion about the bound is made through the two doors instead.
   A cell pinning a spelling the contract left open would be a
   candidate list wearing an exact match's clothes.

   ── and the number is compared, never used ──
   `fixtures.ts` keeps its own 32 and its own 255 with the rulings
   quoted beside them. This is the one file that reads the module's
   constants, and it reads them to CHECK them. Every other cell in
   this suite bounds against the literal, so a raised constant reds
   HERE rather than silently moving what the boundary tests mean.
   D-70-17 put the rule in the signature block itself: "Do NOT import
   it into a boundary test: a test that imports the constant it
   bounds moves with it."

   Nothing here touches a database.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  PUBLISHED,
  PUBLISHED_MAX_HANDLE_LENGTH,
  PUBLISHED_MAX_NAME_LENGTH,
  type PublishedName,
  bind,
  bindMaxHandleLength,
  bindMaxNameLength,
  loadNaming,
} from "./contract";
import { MAX_HANDLE_LENGTH, MAX_NAME_LENGTH } from "./fixtures";

describe("the barrel publishes what §T071 says it publishes", () => {
  it("loads at `@/lib/server/naming`", async () => {
    await expect(loadNaming()).resolves.toBeTypeOf("object");
  });

  it(`exports \`MAX_HANDLE_LENGTH\` — ${PUBLISHED_MAX_HANDLE_LENGTH}`, async () => {
    /* Separated from the value assertion below on purpose. "The member is absent" and "the
       member is the wrong number" have different repairs and different owners, and a single
       cell asserting `toBe(32)` reports the second wording for both. */
    await expect(bindMaxHandleLength()).resolves.toBeTypeOf("number");
  });

  it(`publishes it as ${MAX_HANDLE_LENGTH}, compared against a literal written in fixtures.ts`, async () => {
    expect(
      await bindMaxHandleLength(),
      `D-071-01(4) publishes \`MAX_HANDLE_LENGTH = ${MAX_HANDLE_LENGTH}\`. Every boundary cell ` +
        `in this suite is written against the literal ${MAX_HANDLE_LENGTH} rather than against ` +
        `this export, so a raised constant stops here instead of quietly redefining what "the ` +
        `boundary" means everywhere else. Changing the literal to match a moved constant is ` +
        `the removal of this assertion, not the satisfaction of it.`,
    ).toBe(MAX_HANDLE_LENGTH);
  });

  it(`still exports \`MAX_NAME_LENGTH\` — ${PUBLISHED_MAX_NAME_LENGTH}`, async () => {
    await expect(bindMaxNameLength()).resolves.toBeTypeOf("number");
  });

  it(`and it is still ${MAX_NAME_LENGTH} — AC3's first clause, at the source`, async () => {
    /* AC3: "`MAX_NAME_LENGTH` is unchanged at 255". The most direct reading of the criterion
       there is, and the cheapest: an implementer who reached for the existing constant instead
       of adding a new one reds here in one line rather than through nine behavioural cells
       that each report something else. */
    expect(
      await bindMaxNameLength(),
      `AC3 keeps the STORAGE bound where it was. §T071: "MAX_NAME_LENGTH = 255 does not change ` +
        `and neither does anything that rests on it: it is the storage bound, it is what the ` +
        `btree tuple actually holds." A product bound implemented by narrowing this constant ` +
        `satisfies AC1 and destroys AC3.`,
    ).toBe(MAX_NAME_LENGTH);
  });

  it("the two constants are different numbers, which is the whole of the coexistence claim", async () => {
    /* The one assertion that cannot be made about either constant alone. §T071: "The two bounds
       coexist and mean different things — one is what the database can store, the other is what
       the product will accept." An implementation that published one name as an alias of the
       other passes both cells above whenever the two literals happen to agree, and this is what
       forbids that from ever being the reading. */
    const product = await bindMaxHandleLength();
    const storage = await bindMaxNameLength();
    expect(product).not.toBe(storage);
    expect(
      (product as number) < (storage as number),
      `the product bound must be the NARROWER of the two: a handle is stored in the same ` +
        `column every other name is, so a product bound at or above the storage bound would ` +
        `never be the thing that refuses anything.`,
    ).toBe(true);
  });
});

describe("the doors T071's criteria drive are still the ones §T070 published", () => {
  /* One cell per name. A single cell binding all five would report the first missing export and
     hide the other four, which is the shape the per-criterion rule exists to prevent. These are
     T070's exports and T070 is merged — so a red here says T071 removed or re-shaped something
     it was Forbidden to touch, which is a more interesting failure than an absent module. */
  for (const name of Object.keys(PUBLISHED) as PublishedName[]) {
    it(`exports \`${name}\` as a function — ${PUBLISHED[name]}`, async () => {
      await expect(bind(name)).resolves.toBeTypeOf("function");
    });
  }
});
