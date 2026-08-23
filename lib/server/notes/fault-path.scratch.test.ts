/* ============================================================
   DarkPrint backend — T170's fault boundary, with no database
   Written after a mutation scored ZERO and the zero turned out to
   be about the instrument rather than about the code.

   Deleting `throw new NoteStoreError(operation, err)` from
   `withStore` — the whole seal — redded **nothing** in
   `tests/store-modules-seal-their-faults.test.ts`. Two independent
   reasons, and neither is *the seal does not matter*: that guard's
   domain is `git ls-tree -r backend lib/server`, the REF, so an
   unmerged module is outside it entirely; and what it asserts is
   that a database-touching module PUBLISHES a sealed class, never
   that the seal fires. Both readings are correct and the guard is
   not wrong — it is simply not this measurement.

   So nothing in the tree measures whether D-13 actually holds on
   this module's rejections. These cells do. No `Db`, no port, no
   compose stack: the subject is the wrapper, and a spy that throws
   is a more precise instrument than a real driver that might not.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { NotAccountOwnerError } from "@/lib/server/accounts";
import { NoteBodyError, NoteStoreError } from "./errors";
import { withStore } from "./store";

/**
 * What `pg` actually hands back, spelled out rather than imported: a driver error carrying
 * the statement, the bound parameters and the SQLSTATE. **The bound values are the point** —
 * a `refId` echoed to a non-author is the existence oracle AC1 exists to close, so a seal
 * that leaks one reopens the criterion through the error surface.
 */
function driverFault(): Error {
  const err = new Error(
    'insert into "note" ("account_id", "target_kind", "target_id", "body") values ' +
      "($1, $2, $3, $4) - relation \"note\" does not exist",
  );
  Object.assign(err, {
    code: "42P01",
    parameters: ["8f14e45f-ceea-467a-9c3f-4b1e2f6d7a01", "blueprint", "secret-private-slug", "hello"],
  });
  return err;
}

describe("withStore seals what the driver throws", () => {
  it("renders the operation and nothing the driver said", async () => {
    const fault = driverFault();
    const thrown = await withStore("postNote", async () => {
      throw fault;
    }).catch((err: unknown) => err);

    expect(thrown).toBeInstanceOf(NoteStoreError);
    const message = (thrown as Error).message;
    expect(message).toBe("postNote: the notes store failed.");
    /* EXCLUDES the bad output rather than admitting the good one: a `toContain("postNote")`
       would pass on a message that also carried the whole statement. */
    expect(message).not.toContain("insert into");
    expect(message).not.toContain("secret-private-slug");
    expect(message).not.toContain("42P01");
    expect(message).not.toContain("$1");
  });

  it("keeps the driver error whole on `cause`, where a caller can debug from it", async () => {
    const fault = driverFault();
    const thrown = await withStore("listNotes", async () => {
      throw fault;
    }).catch((err: unknown) => err);
    expect((thrown as Error).cause).toBe(fault);
  });

  it("renders as {} and keeps its stack, which is D-13's four-part clause", async () => {
    const thrown = (await withStore("voteNote", async () => {
      throw driverFault();
    }).catch((err: unknown) => err)) as Error;

    expect(Object.keys(thrown)).toEqual([]);
    expect(JSON.stringify(thrown)).toBe("{}");
    expect(typeof thrown.stack).toBe("string");
    expect(thrown.stack).not.toBe("");
    /* `for...in` walks the prototype chain, which the two readings above cannot see. `name`
       is public API and is excluded for the reason `tests/error-hygiene.test.ts` excludes it. */
    const inherited: string[] = [];
    for (const key in thrown) if (key !== "name") inherited.push(key);
    expect(inherited).toEqual([]);
  });

  it("lets the two DECISIONS through unsealed, so a refusal stays a refusal", async () => {
    const refusal = new NotAccountOwnerError("editNote: not this account's owner.");
    const body = new NoteBodyError("postNote", 2000, 0);

    await expect(withStore("editNote", async () => { throw refusal; })).rejects.toBe(refusal);
    await expect(withStore("postNote", async () => { throw body; })).rejects.toBe(body);
  });

  it("does not RELABEL an already-sealed fault, which nesting makes reachable here", async () => {
    /* `voteNote` and `editNote` both answer a `NoteRecord` by way of the same read
       `listNotes` uses, so this module's wrappers genuinely nest — unlike T140's, where the
       arm is kept for a composition that does not exist yet. A second sealing would replace
       the operation that actually failed with whichever one happened to be outermost. */
    const inner = new NoteStoreError("recordFor", driverFault());
    const thrown = await withStore("voteNote", async () => {
      throw inner;
    }).catch((err: unknown) => err);

    expect(thrown).toBe(inner);
    expect((thrown as Error).message).toBe("recordFor: the notes store failed.");
  });

  it("seals a non-Error throw too, since a driver is not required to throw one", async () => {
    const thrown = await withStore("deleteNote", async () => {
      throw "relation \"note_vote\" does not exist";
    }).catch((err: unknown) => err);

    expect(thrown).toBeInstanceOf(NoteStoreError);
    expect((thrown as Error).message).toBe("deleteNote: the notes store failed.");
  });
});

describe("NoteBodyError states the limit, which is the whole of AC5's second clause", () => {
  it("renders the limit for an over-long body", () => {
    const err = new NoteBodyError("postNote", 2000, 2001);
    expect(err.message).toContain("2000");
    expect(err.limit).toBe(2000);
    expect(err.bodyLength).toBe(2001);
  });

  it("renders the limit for an EMPTY body too — a caller refused for emptiness still needs it", () => {
    expect(new NoteBodyError("postNote", 2000, 0).message).toContain("2000");
  });

  it("carries nothing a caller sent", () => {
    const err = new NoteBodyError("editNote", 2000, 2001);
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
  });
});
