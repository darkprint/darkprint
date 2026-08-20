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

/**
 * The published renderer. `backend.md`: "`withProfileStore` is published and no caller needs
 * it — the route uses `withProfileErrors` only", and D-130-13 takes the former off the barrel.
 * Bound by name so its absence quotes the clause rather than merely failing.
 */
async function renderer(): Promise<(r: Request, h: () => Promise<Response>) => Promise<Response>> {
  const mod = await loadProfiles();
  const value = mod.withProfileErrors;
  if (typeof value !== "function") {
    throw new Error(
      `@/lib/server/profiles exports no \`withProfileErrors\`.\n` +
        `  It is the route's error boundary and the only place a caller sees a problem \`type\`.\n` +
        `  found: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    );
  }
  return value as (r: Request, h: () => Promise<Response>) => Promise<Response>;
}

/** The `type` member of the problem document this error renders as. */
async function renderedType(
  withProfileErrors: (r: Request, h: () => Promise<Response>) => Promise<Response>,
  error: unknown,
  what: string,
): Promise<unknown> {
  const request = new Request("https://darkprint.test/api/authors/someone");
  const answered = await withProfileErrors(request, () => Promise.reject(error));
  if (!(answered instanceof Response)) {
    throw new Error(`withProfileErrors answered no Response for ${what}.`);
  }
  const body: unknown = await answered.json();
  if (body === null || typeof body !== "object") {
    throw new Error(`withProfileErrors rendered ${what} as a non-object body.`);
  }
  return (body as { type?: unknown }).type;
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

  it("a store that genuinely cannot answer does NOT raise the vocabulary class", async () => {
    /* The saturation half. Without it the cell above is satisfied by a module that raises
       `MalformedStoredVocabularyError` for everything, and a split is only held by a suite
       that reds when it is erased in EITHER direction.

       ── this cell used to name `ProfileStoreError` and that was a defect of mine ──
       It asserted which class a dead store raises, and the answer depends on WHERE the first
       store call sits — which the contract settles and my reference happened to settle
       differently. Line 117 of T130's section: `withProfileStore` wraps only this module's own
       statements "because `getPublicAuthor` and `blueprints` seal their own, and pulling their
       faults into this wrapper would re-wrap them — a sanitizer applied twice does not
       sanitize twice, it relabels". So a dead store rejects with whatever the FIRST call's
       module seals, and that is correct rather than incidental. The cell was asserting my
       oracle's layering against a published ruling.

       What D-130-10 actually protects is the SPLIT, and the split is layering-independent:
       whatever a dead store raises, it is not the vocabulary class.

       ── the caveat, stated precisely so somebody else can extend it ──
       Under the published layering the first call is `getPublicAuthor`, which is outside the
       wrapper, so **this module's OWN store fault is not reachable through a closed port at
       all**. This cell therefore exercises the first call's seal, not this module's. Reaching
       the module's own store fault needs the store UP and one of its own statements failing,
       which a closed port cannot produce. Reported as owed rather than faked here. */
    const Malformed = await classFrom("MalformedStoredVocabularyError");

    const fault = await refusalFrom(
      (closed as unknown as { db: unknown }).db,
      "t130-vocab-no-such-handle",
    );

    expect(
      fault,
      "a dead store is a store fault, whichever module seals it; it is not a statement about " +
        "the CONTENT of a release that was never read",
    ).toBeInstanceOf(Error);
    expect(
      fault instanceof Malformed,
      "D-130-10 in the erasing direction: if a dead store also raised the vocabulary class, " +
        "the distinction would be present and dead — the value appearing everywhere loses it " +
        "as completely as the value never appearing.",
    ).toBe(false);
  });

  it("the two conditions RENDER different problem `type`s", async () => {
    /* ── this cell looked in the wrong place, and my own note named only two of three ──
       It read `type` off the instance and said that if it lived on the constructor instead,
       the cell would say where to look. **There is a third answer neither option covered: the
       `type` is in the RENDERER.** The class carries `name` on its prototype and nothing on
       the instance, and `withProfileErrors` is what produces the `problem+json` member — which
       is also the only place a CALLER ever sees it, so it is where D-130-10's distinction
       becomes observable rather than merely true.

       Neither string is written down here. Both are read off documents the MODULE rendered,
       from two errors the MODULE raised, and required to differ. The oracle is the thing being
       agreed with rather than a second opinion about it. */
    const withProfileErrors = await renderer();

    const refusal = await refusalFrom(s.db, owner.handle);
    const fault = await refusalFrom(
      (closed as unknown as { db: unknown }).db,
      "t130-vocab-no-such-handle",
    );

    const refusalType = await renderedType(withProfileErrors, refusal, "the refused vocabulary");
    const faultType = await renderedType(withProfileErrors, fault, "a store that cannot answer");

    expect(
      refusalType,
      "D-130-10 gives this condition \"its own sealed class, its own `type`\", and the `type` " +
        "is a member of the rendered problem document",
    ).toEqual(expect.any(String));
    expect(faultType).toEqual(expect.any(String));
    expect(
      refusalType,
      "the whole of D-130-10: a caller must be able to tell a release it could not READ from a " +
        "store that could not ANSWER. Same `type` and the two are one condition on the wire, " +
        "whatever the classes are behind it.",
    ).not.toBe(faultType);
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
