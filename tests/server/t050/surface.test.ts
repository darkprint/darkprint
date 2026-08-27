/* ============================================================
   T050 — the published surface exists and is what was published

   D-01 and D-10b's lesson, and the cheapest file here: "two agents
   who cannot see each other cannot converge on a name, an arity or
   a call shape by reasoning about behaviour. They can only
   converge on something written down."

   Every name is bound INSIDE its own test rather than in a hook.
   A hook that throws runs no test and adds nothing to the failed
   column — it moves the SKIPPED count, and `Tests 0 failed | 7
   skipped` is not a pass. This file touches no database at all, so
   it is the one part of the suite that reds honestly with the
   stack down.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { ACCOUNTS, PUBLISHED, PUBLISHED_NAMES, bind, loadAccounts } from "./contract";

describe(`the barrel \`${ACCOUNTS}\``, () => {
  it("loads", async () => {
    await expect(loadAccounts()).resolves.toBeTypeOf("object");
  });
});

describe("the seven functions the Published signatures block names", () => {
  for (const name of PUBLISHED_NAMES) {
    it(`publishes \`${name}\``, async () => {
      const fn = await bind(name);
      expect(fn).toBeTypeOf("function");
    });
  }

  /**
   * Arity is a weak check and is asserted anyway, because it is the one part of a signature a
   * red can attribute precisely: `getAccount(db, actor, accountId)` implemented as
   * `getAccount(db, accountId)` typechecks nowhere but binds here, and the resulting failure
   * would otherwise surface three files away as an authorization result nobody could explain.
   *
   * `Function.length` counts parameters before the first default or rest, so this is a floor
   * rather than an equality — an implementation with an optional trailing parameter is not
   * wrong, and asserting equality would convict it.
   */
  const MINIMUM_ARITY: Record<string, number> = {
    upsertFromGitHub: 2,
    getAccount: 3,
    getPublicAuthor: 2,
    updateProfile: 4,
    changeHandle: 4,
    setEmail: 4,
    setDefaultVisibility: 4,
  };

  for (const name of PUBLISHED_NAMES) {
    it(`\`${name}\` takes at least the parameters it publishes`, async () => {
      const fn = await bind(name);
      expect(
        fn.length,
        `${PUBLISHED[name]}\n  \`Function.length\` stops at the first default, so this is a ` +
          `floor: fewer than ${MINIMUM_ARITY[name]} means a parameter is missing, not optional.`,
      ).toBeGreaterThanOrEqual(MINIMUM_ARITY[name]);
    });
  }
});

describe("the barrel publishes nothing by a deep path alone", () => {
  /**
   * T000's public-import rule, which every task inherits: "A capability reachable only by a
   * deep path is not part of the public interface." Asserted from the consumer's side — this
   * suite imports the barrel and nothing else, so a function that exists at
   * `lib/server/accounts/handle.ts` and is not re-exported reds as an absent name above.
   *
   * The positive half is what this test adds: the barrel is a module object with named
   * exports, not a default-exported bag, which is the other way seven names can technically
   * "exist" while no published import reaches them.
   */
  it("exports the seven names directly, not behind a default export", async () => {
    const mod = await loadAccounts();
    const missing = PUBLISHED_NAMES.filter((n) => typeof mod[n] !== "function");
    expect(
      missing,
      `these are reachable only through \`default\` or not at all: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
