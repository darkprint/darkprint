/* ============================================================
   DarkPrint backend — observability: who `listAudit` refuses
   The permission half needs no database: D-240-04's decision is
   taken before any statement is built, and these cells prove that
   by handing in a `Db` that throws if it is touched at all. A
   refused caller must not be able to time the difference between
   a filter that matched and one that did not, and "the store was
   never reached" is the strongest form of that.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { NotPermittedError } from "./errors";
import { listAudit } from "./read";

/** A `Db` that fails the test if anything reaches it. */
const forbiddenDb = {
  select() {
    throw new Error("the store was reached by a caller that should have been refused");
  },
} as unknown as Db;

/** A `Db` that records the statement it was asked to run and answers with `rows`. */
function recordingDb(rows: unknown[]) {
  const seen = { selects: 0, orderByTerms: 0 };
  const chain = {
    select: () => {
      seen.selects += 1;
      return chain;
    },
    from: () => chain,
    where: () => chain,
    orderBy: (...terms: unknown[]) => {
      seen.orderByTerms = terms.length;
      return Promise.resolve(rows);
    },
  };
  return { db: chain as unknown as Db, seen };
}

const OPERATOR: Actor = { kind: "operator", accountId: "9f3c1d20-0000-4000-8000-000000000000" };

describe("listAudit permits the operator alone", () => {
  /**
   * Each refused actor is a rule T060 hardened, carried over with the predicate rather
   * than dropped from it — a weakened copy of `isOperator` would be worse than none.
   */
  const refused: readonly (readonly [string, Actor])[] = [
    ["anonymous", { kind: "anonymous" }],
    ["a signed-in account", { kind: "account", accountId: "aaaaaaaa-0000-4000-8000-000000000000", handle: "berti" }],
    ["an account with no handle", { kind: "account", accountId: "bbbbbbbb-0000-4000-8000-000000000000", handle: null }],
    /* An empty string is what an unset column and a half-built session row both look like. */
    ["an operator carrying an empty accountId", { kind: "operator", accountId: "" } as Actor],
    /* Possession of the discriminant is not authority. */
    ["an operator carrying no accountId at all", { kind: "operator" } as unknown as Actor],
  ];

  for (const [description, actor] of refused) {
    it(`refuses ${description} without reaching the store`, async () => {
      const thrown = await listAudit(forbiddenDb, actor, {}).catch((err: unknown) => err);
      expect(thrown).toBeInstanceOf(NotPermittedError);
      expect((thrown as Error).message).toBe("listAudit: not permitted.");
    });
  }

  /**
   * Authority is never INHERITED. An actor whose `kind` and `accountId` live on a
   * prototype answers every `===` check a naive predicate makes, which is why the rule is
   * `Object.hasOwn` and why this cell exists to hold it there.
   */
  it("refuses an actor that borrows its fields from a prototype", async () => {
    const borrowed = Object.create(OPERATOR) as Actor;
    expect(borrowed.kind).toBe("operator");
    const thrown = await listAudit(forbiddenDb, borrowed, {}).catch((err: unknown) => err);
    expect(thrown).toBeInstanceOf(NotPermittedError);
  });

  /**
   * The refusal must say nothing about the target. Asserted against a filter naming one,
   * so the cell EXCLUDES the leak rather than admitting the good sentence: a rendering
   * that appended the target would still start with the published words.
   */
  it("names nothing about the target it was asked for", async () => {
    const secret = "berti/unpublished-thing";
    const thrown = await listAudit(forbiddenDb, { kind: "anonymous" }, {
      targetKind: "blueprint",
      targetId: secret,
    }).catch((err: unknown) => err);
    for (const rendering of [(thrown as Error).message, String(thrown), JSON.stringify(thrown)]) {
      expect(rendering).not.toContain(secret);
      expect(rendering).not.toContain("blueprint");
    }
  });

  it("lets a real operator through to the store", async () => {
    const { db, seen } = recordingDb([]);
    await expect(listAudit(db, OPERATOR, {})).resolves.toEqual([]);
    expect(seen.selects).toBe(1);
  });

  /** The order is six terms deep by D-140-09/11's reasoning; a silent collapse to one would red here. */
  it("orders on every published field rather than on the random id", async () => {
    const { db, seen } = recordingDb([]);
    await listAudit(db, OPERATOR, {});
    expect(seen.orderByTerms).toBe(7);
  });
});
