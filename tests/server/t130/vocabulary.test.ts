/* ============================================================
   T130 — D-130-10's witness: a refused stored vocabulary is NOT
   a store fault

   "`counts.terms`' refusal must not render as `store-failed` …
   naming a store that was working, which is the relabelling
   `store.ts`'s own header refuses. Its own sealed class, its own
   `type`."

   ── why this file exists, and it is not thoroughness ──
   Until now D-130-10's only witness was an ACCIDENT: this suite's
   own fixture wrote `release.local_vocabulary` as a bare array,
   both merged readers refuse an array, and the three cells that
   reddened were the amendment being observed end to end. **The
   fixture correction makes those green and leaves
   `MalformedStoredVocabularyError` with no observer at all.**

   *A fix that closes a path closes every probe that used it*, and
   the question owed at every fix is *what did this stop being
   able to fail?* This is the answer, written in the same change as
   the fix rather than after it — because a witness owed AFTER a
   repair is a repair that lands unobserved, and the reverse
   mutation would then be a zero that means nothing.

   ── what is asserted, and what is deliberately not ──
   The CLASS and the DISTINCTION, never the wording. D-130-10's
   whole content is that this condition is distinguishable from a
   store fault; a cell asserting the message text would pass
   against the very relabelling the ruling removed, since the
   relabelled form was itself a well-formed sentence.

   Neither class's `type` string is published anywhere, so no
   literal is invented here. The two `type`s are read off two
   errors THE MODULE PRODUCED — one from a refused vocabulary, one
   from a store that genuinely cannot answer — and required to
   differ. The oracle is the thing being agreed with rather than a
   second opinion about it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "@/lib/db";

import {
  anonymous,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  loadProfiles,
  mark,
  namespacedTerm,
  scratchDatabase,
  type AccountFixture,
  type Scratch,
} from "./contract";

/** A port nothing listens on, so `connect` refuses immediately. */
const CLOSED_PORT_URL = "postgres://darkprint:darkprint@127.0.0.1:1/darkprint";

let s: Scratch;
let owner: AccountFixture;
let closed: DbClient;

/** The pre-D-90-03 shape: terms, no bytes. `export.scratch.test.ts:187` asserts it is refused. */
const BARE_ARRAY = [namespacedTerm("someone/a-term")];

async function classFrom(name: string): Promise<new (...a: never[]) => Error> {
  const mod = await loadProfiles();
  const value = mod[name];
  if (typeof value !== "function") {
    throw new Error(
      `@/lib/server/profiles exports no \`${name}\`.\n` +
        `  D-130-20 states the barrel exports it and counts it in \`error-hygiene\`'s 24, and ` +
        `D-130-10 requires this condition to carry "its own sealed class".\n` +
        `  found: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    );
  }
  return value as new (...a: never[]) => Error;
}

/** Whatever `getProfile` rejected with, or a thrown marker if it did not reject. */
async function refusalFrom(db: unknown, handle: string): Promise<unknown> {
  const getProfile = await bind("getProfile");
  try {
    await getProfile(db, anonymous, handle);
  } catch (error) {
    return error;
  }
  throw new Error(
    `getProfile resolved for "${handle}". This file measures nothing unless it rejects.`,
  );
}

function chain(error: unknown): string[] {
  const out: string[] = [];
  let node: unknown = error;
  const seen = new Set<unknown>();
  while (node !== null && node !== undefined && !seen.has(node)) {
    seen.add(node);
    if (node instanceof Error) out.push(node.message);
    node = (node as { cause?: unknown }).cause;
  }
  return out;
}

beforeAll(async () => {
  s = await scratchDatabase();
  owner = await insertAccount(s, { handle: mark("t130-vocab").toLowerCase() });
  /* A release whose stored vocabulary the parser refuses. Written VERBATIM: the point is a
     shape a writer can put in the column, not one this fixture would produce. */
  await insertBundle(s, { owner, slug: "refused-vocab", cards: [], rawLocalVocabulary: BARE_ARRAY });
  closed = createDbClient(CLOSED_PORT_URL);
});

afterAll(async () => {
  await closed.close().catch(() => undefined);
  await dropScratchDatabases();
});

describe("D-130-10: a refused vocabulary and a dead store are different conditions", () => {
  it("the refused vocabulary raises `MalformedStoredVocabularyError`, not the store class", async () => {
    const Malformed = await classFrom("MalformedStoredVocabularyError");
    const StoreError = await classFrom("ProfileStoreError");

    const refusal = await refusalFrom(s.db, owner.handle);

    expect(
      refusal,
      "the column holds a shape `parseOntologyTerms` refuses, so `getProfile` owes a refusal",
    ).toBeInstanceOf(Malformed);
    expect(
      refusal instanceof StoreError,
      "D-130-10: this must not render as `store-failed` — it would name a store that was " +
        "working. The store answered; the stored CONTENT is what could not be read.",
    ).toBe(false);
  });

  it("a store that genuinely cannot answer still raises the store class", async () => {
    /* The other half of the 2x2, and without it the cell above is satisfied by a module that
       raises `MalformedStoredVocabularyError` for everything. A distinction needs both sides. */
    const Malformed = await classFrom("MalformedStoredVocabularyError");
    const StoreError = await classFrom("ProfileStoreError");

    const fault = await refusalFrom(
      (closed as unknown as { db: unknown }).db,
      "t130-vocab-no-such-handle",
    );

    expect(fault).toBeInstanceOf(StoreError);
    expect(fault instanceof Malformed).toBe(false);
  });

  it("the two conditions answer different problem `type`s", async () => {
    /* Neither string is published, so neither is written here. Both are read off errors the
       MODULE produced and required to differ — which is the whole of D-130-10 and is the only
       form of it that cannot be satisfied by wording. */
    const refusal = await refusalFrom(s.db, owner.handle);
    const fault = await refusalFrom(
      (closed as unknown as { db: unknown }).db,
      "t130-vocab-no-such-handle",
    );

    const typeOf = (e: unknown): unknown => (e as { type?: unknown }).type;

    expect(
      typeOf(refusal),
      "D-130-10 gives this condition \"its own sealed class, its own `type`\". If the `type` " +
        "lives on the constructor rather than the instance, this cell says where to look " +
        "rather than guessing a string.",
    ).toEqual(expect.any(String));
    expect(typeOf(fault)).toEqual(expect.any(String));
    expect(typeOf(refusal)).not.toBe(typeOf(fault));
  });

  it("the parser's diagnostic travels on `cause` and never in the message", async () => {
    /* The pass-through half: the wrapper declines to relabel, so the parser's own sentence is
       reachable on the chain and absent from the rendering a caller reads. Both directions,
       because "it is on the cause" and "it is not in the message" are different facts and a
       relabelling implementation satisfies exactly one of them. */
    const refusal = await refusalFrom(s.db, owner.handle);
    const messages = chain(refusal);

    expect(
      messages.slice(1).join("\n"),
      "the parser's diagnostic has to survive somewhere, or nothing distinguishes this " +
        "refusal from a module that simply refused",
    ).toContain("mapping");
    expect(
      (refusal as Error).message,
      "D-13: the caller's rendering carries the operation and nothing the store said",
    ).not.toContain("mapping");
  });
});
