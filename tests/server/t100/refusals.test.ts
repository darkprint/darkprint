/* ============================================================
   T100 — AC1 and AC2: the two refusals the UI writes different
   sentences for

   AC1: "publishing a bundle with an unresolved node is refused
        with the unfinished reason and its counts, not an error
        count"
   AC2: "publishing with an error diagnostic is refused with the
        error count"

   ── why each refusal is asserted twice ──
   Once for the sentence, once for what the database looks like
   afterwards. **A mutation that inserts a row and then throws
   satisfies every `rejects.toThrow()` a reviewer would write**, and
   leaves the row that breaks a reader forever. The row-count half
   is the half that catches it, and it is the reason this run asked
   for the cell at all.

   ── the counts are the construction's, not the engine's ──
   `unfinishedVariant(base, 2)` starts from a bundle whose every
   node is carded and removes two card files, so "3 of 5" is
   arithmetic over the mutation rather than a number read back out
   of `bundleProgress`. `fixtures.ts` cross-checks the engine
   against it and throws loudly on a divergence, so the cells never
   have to choose between two disagreeing sources.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MESSAGE_FORMS, boundPublish, refusalFrom } from "./contract";
import {
  RecordedSetup,
  describeAdded,
  inErrorVariant,
  resolvingCorpus,
  rowsAdded,
  scratchDatabase,
  seedOwner,
  snapshotRows,
  totalRowsAdded,
  type Owner,
  type Scratch,
  type Variant,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  owner: Owner;
  unfinished: Variant;
  inError: Variant;
}

const setup = new RecordedSetup<Env>("The refusals scratch database and corpus");

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("refusals");
    const owner = await seedOwner(scratch, "publisher");
    const base = resolvingCorpus();
    const { unfinishedVariant } = await import("./fixtures");
    return {
      scratch,
      owner,
      unfinished: unfinishedVariant(base, 2),
      inError: inErrorVariant(base),
    };
  });
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

describe("T100 AC1 — an unresolved node is refused as unfinished, with its counts", () => {
  it("refuses with kind `unfinished` and the admissible sentence", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "unfinished-bundle",
        version: "1.0.0",
        manifest: env.unfinished.manifest,
        dot: env.unfinished.dot,
        cardFiles: env.unfinished.cardFiles,
      }),
      "AC1",
    );

    expect(
      refusal.kind,
      `AC1: the refusal carries kind ${JSON.stringify(refusal.kind)}.\n` +
        `  backend.md §T100: a bundle with unresolved nodes is refused as \`unfinished\`, and ` +
        `"a generic refusal satisfies 'is refused' and loses the sentence the UI needs".\n` +
        `  Message was: ${refusal.message}`,
    ).toBe("unfinished");

    const match = MESSAGE_FORMS.unfinished.exec(refusal.message);
    expect(
      match,
      `AC1: the message is not the admissible form.\n` +
        `  Expected: publish: unfinished — <n> of <m> nodes carded.\n` +
        `  Actual:   ${refusal.message}`,
    ).not.toBeNull();

    /* The counts, and the criterion is that they are the CARDED counts rather than any other
       pair of numbers the same sentence could carry. */
    expect(
      [Number(match?.[1]), Number(match?.[2])],
      `AC1: the sentence names ${match?.[1]} of ${match?.[2]}; the submission has ` +
        `${env.unfinished.placed} of ${env.unfinished.total} nodes carded.`,
    ).toEqual([env.unfinished.placed, env.unfinished.total]);
  });

  it("names no error count — AC1's explicit non-requirement", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "unfinished-no-error-count",
        version: "1.0.0",
        manifest: env.unfinished.manifest,
        dot: env.unfinished.dot,
        cardFiles: env.unfinished.cardFiles,
      }),
      "AC1",
    );

    /* The criterion is "with the unfinished reason and its counts, NOT an error count", and the
       UI it cites reserves "blocked by N errors" in signal red for the other reading: "it names
       a fault where there is only a middle" (`UploadFlow.tsx:1176-1181`). A message that also
       reports errors has given the author the sentence AC1 exists to keep away from them. */
    expect(
      /\berrors?\b/iu.test(refusal.message),
      `AC1 requires the unfinished counts and NOT an error count, and the message mentions ` +
        `errors:\n  ${refusal.message}`,
    ).toBe(false);
  });

  it("leaves nothing behind — no bundle, no release, no card", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const before = await snapshotRows(env.scratch);
    await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "unfinished-leaves-nothing",
        version: "1.0.0",
        manifest: env.unfinished.manifest,
        dot: env.unfinished.dot,
        cardFiles: env.unfinished.cardFiles,
      }),
      "AC1",
    );
    const added = rowsAdded(before, await snapshotRows(env.scratch));

    /* A refusal that wrote first and threw second passes every `rejects.toThrow()` and leaves a
       row a reader trips over forever. Counted across every table, so the assertion holds
       whichever one the implementation would have written to. */
    expect(
      totalRowsAdded(added),
      `AC1: the refusal left rows behind (${describeAdded(added)}).\n` +
        `  A publish that inserts and then throws is refused and destructive at the same time.`,
    ).toBe(0);
  });
});

describe("T100 AC2 — an error diagnostic is refused with the error count", () => {
  it("refuses with kind `in-error` and the admissible sentence", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "in-error-bundle",
        version: "1.0.0",
        manifest: env.inError.manifest,
        dot: env.inError.dot,
        cardFiles: env.inError.cardFiles,
      }),
      "AC2",
    );

    expect(
      refusal.kind,
      `AC2: the refusal carries kind ${JSON.stringify(refusal.kind)}.\n` +
        `  This submission has every node carded (${env.inError.placed} of ${env.inError.total}) ` +
        `and ${String(env.inError.expectedErrors)} node pinning a digest its card does not have, so \`unfinished\` ` +
        `would be the wrong sentence and a generic refusal loses the distinction entirely.\n` +
        `  Message was: ${refusal.message}`,
    ).toBe("in-error");

    const match = MESSAGE_FORMS["in-error"].exec(refusal.message);
    expect(
      match,
      `AC2: the message is not the admissible form.\n` +
        `  Expected: publish: in-error — <n> errors.\n` +
        `  Actual:   ${refusal.message}`,
    ).not.toBeNull();

    expect(
      Number(match?.[1]),
      `AC2: the sentence names ${match?.[1]} errors; the submission's mutation produces ` +
        `${String(env.inError.expectedErrors)} (one node pinning a digest no card hashes to).`,
    ).toBe(env.inError.expectedErrors);
  });

  it("inlines no diagnostic text from the engine", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "in-error-no-diagnostics",
        version: "1.0.0",
        manifest: env.inError.manifest,
        dot: env.inError.dot,
        cardFiles: env.inError.cardFiles,
      }),
      "AC2",
    );

    /* "No diagnostic text from the engine appears in the message — diagnostics travel in the
       200-with-diagnostics envelope (B-03), and a refusal that inlines them is a second
       rendering of the same content in a place the whitelist has to police separately."

       Checked two ways, because either alone is weak. The anchored form above already forbids
       anything after the full stop; this looks for the engine's own vocabulary in case a
       future message form is added and the anchor moves. */
    const leaked = ["port-mismatch", "no-such-port", "also-missing", "bundle/"].filter((token) =>
      refusal.message.includes(token),
    );
    expect(
      leaked,
      `AC2: engine diagnostic text reached the refusal message: ${leaked.join(", ")}.\n` +
        `  ${refusal.message}`,
    ).toEqual([]);
  });

  it("leaves nothing behind — no bundle, no release, no card", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const before = await snapshotRows(env.scratch);
    await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "in-error-leaves-nothing",
        version: "1.0.0",
        manifest: env.inError.manifest,
        dot: env.inError.dot,
        cardFiles: env.inError.cardFiles,
      }),
      "AC2",
    );
    const added = rowsAdded(before, await snapshotRows(env.scratch));

    expect(
      totalRowsAdded(added),
      `AC2: the refusal left rows behind (${describeAdded(added)}).`,
    ).toBe(0);
  });
});

describe("T100 — the two refusals stay distinguishable", () => {
  it("gives unfinished and in-error different kinds", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const unfinished = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "distinct-unfinished",
        version: "1.0.0",
        manifest: env.unfinished.manifest,
        dot: env.unfinished.dot,
        cardFiles: env.unfinished.cardFiles,
      }),
      "AC1/AC2",
    );
    const inError = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "distinct-in-error",
        version: "1.0.0",
        manifest: env.inError.manifest,
        dot: env.inError.dot,
        cardFiles: env.inError.cardFiles,
      }),
      "AC1/AC2",
    );

    /* The whole reason the contract asks for a `kind` rather than a single refusal: the UI
       writes three different sentences and cannot pick one from a message it has to parse.
       Two submissions differing only in which mutation was applied must not come back
       carrying the same discriminator. */
    expect(
      [unfinished.kind, inError.kind],
      `AC1/AC2: both refusals came back as ${JSON.stringify(unfinished.kind)}.\n` +
        `  unfinished: ${unfinished.message}\n  in error:   ${inError.message}`,
    ).toEqual(["unfinished", "in-error"]);
  });
});
