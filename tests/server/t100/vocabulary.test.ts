/* ============================================================
   T100 — the vocabulary a release carries

   `PublishInput.vocabulary` is **`StoredVocabulary`** — `{ text,
   terms }` or absent — published from `@/lib/server/archive`.
   D-133-09 records that this field read `readonly OntologyTerm[]`
   in §T100's own signature block until 2026-08-22 while a
   paragraph two below it already said otherwise, and that a bare
   array is now **refused at the write** by `addRelease`. It was the
   FOURTH independent encoding of that misreading.

   So the vocabulary these cells plant is the published shape, and
   what they assert is the amendment T090's D-90-03 bought:
   `release.local_vocabulary` stores the file's BYTES alongside the
   parsed terms, because `exportBundle` needs to write
   `ontology/extensions.yaml` back out unaltered and a column
   holding terms only can merely re-emit it — losing comments, key
   order and formatting.

   The corpus is `content/ontology/extensions.yaml`, the archive's
   own overlay, so `text` is a real document with real comments in
   it rather than a string this author invented.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { boundPublish, resultOf } from "./contract";
import {
  RecordedSetup,
  resolvingCorpus,
  scratchDatabase,
  seedOwner,
  type Corpus,
  type Owner,
  type Scratch,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  owner: Owner;
  base: Corpus;
  vocabulary: { text: string; terms: readonly unknown[] };
}

const setup = new RecordedSetup<Env>("The vocabulary scratch database and overlay");

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("vocabulary");
    const owner = await seedOwner(scratch, "lexicographer");
    const { contentVocabulary } = await import("@/lib/content/read");
    const overlay = contentVocabulary();
    if (overlay === undefined) {
      throw new Error(
        "content/ontology/extensions.yaml did not load, so there is no real overlay to plant.",
      );
    }
    return {
      scratch,
      owner,
      base: resolvingCorpus(),
      vocabulary: { text: overlay.text, terms: overlay.terms },
    };
  });
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

describe("T100 — a published vocabulary round-trips as `{ text, terms }`", () => {
  it("accepts the published StoredVocabulary shape", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    /* The plain fact that this resolves is a criterion. `addRelease` refuses a bare
       `OntologyTerm[]` at the write, so a `publish` that forwarded the caller's terms as an
       array — the shape §T100's own signature block carried until D-133-09 — would reject here
       with T010's `MalformedVocabularyError` rather than storing anything. */
    const result = resultOf(
      await publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "vocabulary-bundle",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
        vocabulary: env.vocabulary,
      }),
      "vocabulary",
    );

    expect(typeof result.releaseId).toBe("string");
  });

  it("stores the file's bytes, not only the parsed terms", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { getRelease } = await import("@/lib/server/archive");

    const result = resultOf(
      await publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "vocabulary-bytes",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
        vocabulary: env.vocabulary,
      }),
      "vocabulary",
    );

    const stored = await getRelease(env.scratch.db, result.bundleId, result.digest);

    /* Byte for byte, and the assertion is `toBe` on the whole string rather than a check that
       something is there. D-90-03's defect was a column that held terms only: every re-emission
       of it produced a valid document, so any assertion weaker than equality with the original
       bytes would have passed against the broken column. The overlay's leading comment block is
       exactly what a re-emission loses. */
    expect(
      stored?.vocabulary?.text,
      "The release does not hold the vocabulary file's bytes.\n" +
        "  D-90-03: `exportBundle` writes `ontology/extensions.yaml` back out unaltered, and a " +
        "column holding parsed terms only can merely re-emit it — losing the comments, the key " +
        "order and the formatting the author wrote.",
    ).toBe(env.vocabulary.text);

    expect(
      stored?.vocabulary?.terms,
      "The release holds the vocabulary's bytes but not its parsed terms.",
    ).toEqual(env.vocabulary.terms);
  });

  it("stores no vocabulary when the caller sends none", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { getRelease } = await import("@/lib/server/archive");

    const result = resultOf(
      await publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "vocabulary-absent",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "vocabulary",
    );

    const stored = await getRelease(env.scratch.db, result.bundleId, result.digest);

    /* `vocabulary` is optional and "absent or `null` means this release adds nothing to the
       core". `toReleaseRecord` turns the column's `null` into an ABSENT field rather than a
       null one, so the assertion is on absence — a `publish` that wrote `{ text: "", terms: [] }`
       for a caller who sent nothing has invented an empty overlay the author never wrote, and
       `exportBundle` would then write out an empty `ontology/extensions.yaml`. */
    expect(
      stored?.vocabulary,
      `The release carries a vocabulary the caller never sent: ${JSON.stringify(stored?.vocabulary)}.`,
    ).toBeUndefined();
  });
});
