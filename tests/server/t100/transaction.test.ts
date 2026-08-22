/* ============================================================
   T100 — AC5: publishing is a transaction, not a sequence

   "A card version whose bump is too small aborts the whole
   publish, bundle included."

   backend.md §T100 calls this "the criterion that makes this a
   transaction and not a sequence", and names the discriminating
   shape outright: publish a bundle whose SECOND card fails its
   chain check and assert that **the first card is not stored
   either**, "which a step-by-step implementation fails while
   passing every other criterion".

   ── why the submission still resolves ──
   The mutation is `requires_human: false → true` on the second
   card, declared as a patch. `inferBump` rates that MAJOR and it
   touches no port, so `validateBundle` reports the bundle as
   resolving with all five nodes carded and zero errors — measured,
   and re-checked by `chainFailureVariant` every time it is built.
   An implementation that refuses this can only have refused it at
   the chain check, so a green here cannot be an AC2 refusal wearing
   AC5's name.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MESSAGE_FORMS, boundPublish, refusalFrom } from "./contract";
import {
  RecordedSetup,
  cardExists,
  chainFailureVariant,
  describeAdded,
  resolvingCorpus,
  rowsAdded,
  scratchDatabase,
  seedCard,
  seedOwner,
  snapshotRows,
  totalRowsAdded,
  type ChainFailure,
  type Owner,
  type Scratch,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  owner: Owner;
  failure: ChainFailure;
}

const setup = new RecordedSetup<Env>("The transaction scratch database and chain fixture");

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("transaction");
    const owner = await seedOwner(scratch, "transactor");
    const failure = chainFailureVariant(resolvingCorpus());
    /* The published version the submission's patch bump is measured against. Without it there
       is no chain to fail and the submission would simply be a first publish of that card. */
    await seedCard(scratch, owner, failure.previous);
    return { scratch, owner, failure };
  });
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

describe("T100 AC5 — a card whose bump is too small aborts the whole publish", () => {
  it("the premise: the previous card version is in the store and the first is not", async () => {
    const env = setup.require();

    /* Stated as its own cell rather than assumed inside the criterion below. If the seed ever
       stops landing, AC5 would pass trivially — nothing stored because nothing was attempted —
       and a vacuous green is the failure mode this whole suite is built to avoid. */
    expect(
      await cardExists(env.scratch, env.owner, env.failure.previous),
      `AC5 premise: ${env.failure.previous.ref} was seeded and is not in the store, so the ` +
        `submission has no chain to fail against.`,
    ).toBe(true);

    expect(
      await cardExists(env.scratch, env.owner, env.failure.firstCard),
      `AC5 premise: ${env.failure.firstCard.ref} is already in the store, so its absence after ` +
        `the refusal could not distinguish a transaction from a sequence.`,
    ).toBe(false);
  });

  it("refuses the publish", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "aborted-bundle",
        version: "1.0.0",
        manifest: env.failure.corpus.manifest,
        dot: env.failure.corpus.dot,
        cardFiles: env.failure.corpus.cardFiles,
      }),
      "AC5",
    );

    /* The `kind` is deliberately NOT asserted. The contract lists five kinds — unfinished,
       in-error, conflict, not-owner, version-not-higher — and a card chain failure is none of
       them: `version-not-higher` is AC8's refusal about the RELEASE semver, carrying
       "`<declared>` is not higher than `<previous>`". Which kind AC5 refuses with is UNSTATED
       and has been charged to the orchestrator rather than guessed here; asserting a guess
       would red an implementer who followed the contract. What is asserted is that it refuses
       and what it leaves behind, both of which the contract does state. */
    expect(
      refusal.message.length,
      "AC5: the refusal carries an empty message, so nothing tells the caller which card failed.",
    ).toBeGreaterThan(0);
  });

  it("does not store the FIRST card — the whole publish rolls back", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const before = await snapshotRows(env.scratch);
    await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "aborted-first-card",
        version: "1.0.0",
        manifest: env.failure.corpus.manifest,
        dot: env.failure.corpus.dot,
        cardFiles: env.failure.corpus.cardFiles,
      }),
      "AC5",
    );

    /* The criterion, exactly as the contract words it. A step-by-step implementation walks the
       cards in DOT order, stores this one, reaches the second, and throws. */
    expect(
      await cardExists(env.scratch, env.owner, env.failure.firstCard),
      `AC5: ${env.failure.firstCard.ref} is in the store after a refused publish.\n` +
        `  The submission's SECOND card (${env.failure.declared.ref}) fails its chain check ` +
        `against the published ${env.failure.previous.ref}, and "a card version whose bump is ` +
        `too small aborts the whole publish, bundle included".\n` +
        `  This is the step-by-step implementation the criterion exists to catch: it passes ` +
        `every other criterion and leaves a card behind.`,
    ).toBe(false);

    /* And the bundle with it. Counted across every table so the assertion does not depend on
       which of them the implementation would have written to first. */
    const added = rowsAdded(before, await snapshotRows(env.scratch));
    expect(
      totalRowsAdded(added),
      `AC5: the aborted publish left rows behind (${describeAdded(added)}).\n` +
        `  "every card is published, the bundle row created and the release appended inside one ` +
        `transaction, and any refusal rolls all of it back".`,
    ).toBe(0);
  });

  it("leaves the already-published card version untouched", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "aborted-leaves-previous",
        version: "1.0.0",
        manifest: env.failure.corpus.manifest,
        dot: env.failure.corpus.dot,
        cardFiles: env.failure.corpus.cardFiles,
      }),
      "AC5",
    );

    /* A rollback that took the pre-existing row with it would be a different defect with the
       same row count of zero added — so this is asked separately rather than folded into the
       delta above, which by construction cannot see a deletion. */
    expect(
      await cardExists(env.scratch, env.owner, env.failure.previous),
      `AC5: the refused publish removed the already-published ${env.failure.previous.ref}.\n` +
        `  A rollback must undo what this act did, not what a previous one did.`,
    ).toBe(true);

    /* And the version the submission declared must not have been stored under the wire. */
    expect(
      await cardExists(env.scratch, env.owner, env.failure.declared),
      `AC5: ${env.failure.declared.ref} was stored despite failing its chain check.`,
    ).toBe(false);
  });
});

/* ============================================================
   A pinned card version whose bytes differ from the stored row

   D-100-01 ruled this a `conflict`: the digest a release stores is
   taken over the SUBMITTED bytes, while `exportBundle` reads
   `card_version.source` — so accepting a pin whose bytes disagree
   with the stored row makes the exported folder and the release's
   own digest disagree permanently, and nothing downstream can tell
   which of the two was the author's.

   **D-100-02 then ruled what "differ" means, and it is the whole
   point of the cell below: the comparison is by SOURCE BYTES, not
   by digest.** A digest comparison refuses the case the first
   ruling named and silently accepts the residue — two cards
   differing only in comments, whitespace or key order compare EQUAL
   by digest, the stored `source` quietly wins, and the folder the
   registry publishes is not the bytes the author submitted.
   `cardDigest` is blind to that by construction, because it hashes
   the parsed `NodeCard`.

   That is the same class T133 spent the day closing — D-90-03
   stores a vocabulary's `text` byte for byte so the author's bytes
   survive rather than being re-emitted from a parse. A card version
   is a content identity: if the bytes differ at all, the stored row
   is not what was submitted. It is stricter, and a comment-only
   change now needs a version bump.

   So the mutation here is comment-only ON PURPOSE. It is the one
   shape that separates a byte comparison from every weaker one, and
   an implementation using any of them passes every other cell in
   this suite while failing this one.

   **`source`, not `body`, and D-100-03 names why the distinction is
   not pedantry.** `CardRecord.source` is `text` and round-trips
   BYTE-identical; `body` is `jsonb` and round-trips only
   VALUE-identical. A comparison over `body` would therefore have
   reintroduced exactly the blindness the digest comparison had, by
   a second route — comments, whitespace and key order all vanish
   into a parsed value. This cell reds all three readings: digest,
   `body`, and "the versions match so it must be the same card".
   ============================================================ */

describe("T100 — a card pinned at bytes that differ from the stored row", () => {
  it("is refused as a conflict, and stores nothing", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { cardExists: exists, seedCard: seed } = await import("./fixtures");

    /* The submission repins the second card at a NEW version whose bytes differ from what is
       about to be seeded under that same version. A trailing YAML comment is the whole
       difference: it parses to an identical `NodeCard`, so `cardDigest` is identical,
       `inferBump` sees no change and the version chain is silent. The ONLY thing that
       disagrees is the source text.

       That is deliberate and it is what gives this cell its discriminating power. An
       implementation comparing digests finds them equal, concludes the card is already
       published unchanged, and proceeds — publishing a folder whose bytes are the stored
       row's rather than the author's. Only a comparison over `source` refuses it. */
    const declared = env.failure.declared;
    await seed(env.scratch, env.owner, {
      id: declared.id,
      version: declared.version,
      source: declared.source,
    });

    const divergent = { ...env.failure.corpus };
    const file = `cards/${declared.id}@${declared.version}.yaml`;
    divergent.cardFiles = {
      ...divergent.cardFiles,
      [file]: `${declared.source}\n# these bytes are not the stored ones\n`,
    };

    const before = await snapshotRows(env.scratch);
    const refusal = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "divergent-card-bytes",
        version: "1.0.0",
        manifest: divergent.manifest,
        dot: divergent.dot,
        cardFiles: divergent.cardFiles,
      }),
      "card bytes",
    );

    expect(
      refusal.kind,
      `A card pinned at bytes differing from the stored ${declared.ref} came back as ` +
        `${JSON.stringify(refusal.kind)}.\n` +
        `  D-100-01: this is a \`conflict\` — the release's digest would be over the submitted ` +
        `bytes while the export reads \`card_version.source\`, so the folder and the digest ` +
        `disagree forever.\n` +
        `  D-100-02: and the comparison is by SOURCE BYTES. These two cards have the same ` +
        `\`cardDigest\` and differ only by a trailing comment, so an implementation comparing ` +
        `digests accepts this submission and publishes the stored row's bytes as though they ` +
        `were the author's.\n  Message: ${refusal.message}`,
    ).toBe("conflict");

    /* D-100-02's second form. The release form names a version and a release, neither of which
       exists in the card case, so `conflict` carries two admissible sentences and this is the
       one that fits. `<ref>` is `id@version` — the caller's own submission. */
    const match = MESSAGE_FORMS["conflict-card"].exec(refusal.message);
    expect(
      match,
      `The card conflict is not the admissible form.\n` +
        `  Expected: publish: conflict — card \`<ref>\` is already published with different content.\n` +
        `  Actual:   ${refusal.message}`,
    ).not.toBeNull();

    expect(
      match?.[1],
      `The card conflict names \`${match?.[1]}\`; the submission pinned ${declared.ref}.`,
    ).toBe(declared.ref);

    const added = rowsAdded(before, await snapshotRows(env.scratch));
    expect(
      totalRowsAdded(added),
      `The refused publish left rows behind (${describeAdded(added)}).`,
    ).toBe(0);

    /* And the stored card still holds the bytes it was seeded with. */
    expect(
      await exists(env.scratch, env.owner, declared),
      `The refusal removed the already-stored ${declared.ref}.`,
    ).toBe(true);
  });
});
