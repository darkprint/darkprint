/* ============================================================
   T100 — AC3, AC6, and what `created` claims

   AC3: "the stored digest equals the engine's over the submitted
        bytes"
   AC6: "republishing identical bytes is refused as a conflict
        naming the existing release"

   ── AC3 needs a second axis and this file is where it lives ──
   `fixtures.ts`'s `digestOf` calls `bundleDigest`, which is what an
   implementation of `publish` will call too. Asserting the two
   agree is a CONSISTENCY CHECK: it shows the digest was taken over
   the submitted bytes with one entry per DOT node, and it cannot
   show the digest is right, because both sides would move together
   under any change to `bundleDigest`.

   So AC3 is asserted several ways, most of which no amount of
   agreement can satisfy:
     · stability      — identical bytes, identical digest
     · sensitivity    — one changed byte in the DOT moves it
     · sensitivity    — a changed card CONTENT moves it
     · blindness      — a card COMMENT does not, and that is the
                        measured fact D-100-02 rests on
     · key-order      — `cardFiles` insertion order does not
     · multiset       — a card pinned twice counts twice (C1)
     · and one pinned literal, labelled for what it is
   A `bundleDigest` that returned a constant passes the consistency
   check and fails most of these.

   ── the blindness cell is not a weaker sensitivity cell ──
   It was written the other way round first, asserting that a
   comment appended to a card file moved the digest, and it FAILED.
   `cardDigest` hashes the parsed `NodeCard`, so comments, whitespace
   and key order are invisible to it by construction. That is not a
   defect in the digest — it is the reason D-100-02 ruled the card
   conflict comparison onto `source` bytes rather than onto digests
   or onto `body`. Pinning the blindness is what keeps the two
   rulings legible together; asserting its opposite was this
   author's guess, and the run is what corrected it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MESSAGE_FORMS, boundPublish, refusalFrom, resultOf } from "./contract";
import {
  RecordedSetup,
  describeAdded,
  digestOf,
  resolvingCorpus,
  revisionOf,
  rowsAdded,
  scratchDatabase,
  seedOwner,
  snapshotRows,
  totalRowsAdded,
  type Corpus,
  type Owner,
  type Scratch,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  owner: Owner;
  base: Corpus;
  revision: Corpus;
}

const setup = new RecordedSetup<Env>("The identity scratch database and corpus");

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("identity");
    const owner = await seedOwner(scratch, "identifier");
    const base = resolvingCorpus();
    return { scratch, owner, base, revision: revisionOf(base) };
  });
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

/* --------------------- AC3 --------------------- */

describe("T100 AC3 — the stored digest is the engine's over the submitted bytes", () => {
  it("returns and stores the digest over the submitted bytes", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const result = resultOf(
      await publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "digest-bundle",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "AC3",
    );

    /* The consistency half, labelled. See this file's header for what it does not establish. */
    expect(
      result.digest,
      `AC3: the returned digest is not \`bundleDigest\` over the submitted bytes with one entry ` +
        `per DOT node.\n` +
        `  D-100-01: \`cardDigests\` is \`blueprint.nodes.map(n => n.digest)\` — duplicates ` +
        `included, orphans excluded. \`bundleDigest\` sorts but does not dedupe, so a ` +
        `deduplicated card set hashes differently while the release still looks well formed.`,
    ).toBe(digestOf(env.base));

    /* "STORED digest", which is a different claim from "returned digest". Read back through
       T010's published reader rather than off the value `publish` just handed over: a module
       that returned the right digest and wrote another one satisfies the line above. */
    const { getRelease } = await import("@/lib/server/archive");
    const stored = await getRelease(env.scratch.db, result.bundleId, result.digest);
    expect(
      stored?.digest,
      `AC3: no release is stored under the digest \`publish\` returned (${result.digest}).\n` +
        `  The returned digest and the stored one are two claims and this is the second.`,
    ).toBe(result.digest);
  });

  it("is stable — the same bytes give the same digest", () => {
    const env = setup.require();
    /* Not a claim about `publish`; a claim about the property AC3 rests on. If this ever fails,
       every other digest cell in this file is measuring noise. */
    expect(digestOf(env.base)).toBe(digestOf(env.base));
  });

  it("is sensitive to the DOT — one changed byte moves it", () => {
    const env = setup.require();
    expect(
      digestOf(env.revision),
      "AC3: a bundle whose DOT differs hashes to the same digest as the original. A digest " +
        "that does not move with the bytes cannot detect a republish, which is AC6.",
    ).not.toBe(digestOf(env.base));
  });

  it("is sensitive to a card's CONTENT", () => {
    const env = setup.require();
    const files = Object.keys(env.base.cardFiles).sort();
    const first = files[0] as string;
    const text = env.base.cardFiles[first] as string;

    /* Rewriting the card's `action` changes the parsed `NodeCard`, so it changes that card's
       `cardDigest` and therefore the bundle's. The DOT is untouched, which isolates the card
       half of the digest from the DOT half — a `bundleDigest` that hashed only `dot` passes
       every other cell in this file and fails this one.

       This used to flip `requires_human: false → true`. That key was withdrawn from the
       schema and a document still carrying it is ignored, so the mutation would have changed
       the FILE without changing the parsed card, and the premise below reads the file. A
       field that is still in the identity is the only honest probe for whether the cards are
       in the digest. */
    const mutated: Corpus = {
      ...env.base,
      cardFiles: {
        ...env.base.cardFiles,
        [first]: text.replace(/^action:\s*.*$/mu, "action: Do something else entirely"),
      },
    };
    expect(
      mutated.cardFiles[first],
      `AC3 premise: ${first} has no top-level \`action\` key, so the mutation did not ` +
        `apply and this cell would compare a bundle with itself.`,
    ).not.toBe(text);

    expect(
      digestOf(mutated),
      `AC3: changing ${first}'s content left the digest unchanged, so the cards are not in it.`,
    ).not.toBe(digestOf(env.base));
  });

  it("is BLIND to a card's comments — the measured fact D-100-02 rests on", () => {
    const env = setup.require();
    const files = Object.keys(env.base.cardFiles).sort();
    const first = files[0] as string;
    const text = env.base.cardFiles[first] as string;

    /* **Asserted as a fact about the digest, not as a wish.** `cardDigest` hashes the parsed
       `NodeCard`, so a trailing comment is invisible to it and the bundle digest does not move.

       This is why D-100-02 ruled that a card pinned at bytes differing from the stored row is
       compared on `source` and not on digests — and not on `body` either, since `jsonb`
       round-trips value-identically and would lose the same information by a second route. If
       this cell ever goes red, the digest has started seeing card bytes, and the source
       comparison in `transaction.test.ts` is no longer the only thing standing between an
       author's bytes and a silently substituted stored row. Either way the two rulings need
       re-reading together, which a red here is meant to force. */
    const commented: Corpus = {
      ...env.base,
      cardFiles: { ...env.base.cardFiles, [first]: `${text}\n# a comment the digest cannot see\n` },
    };

    expect(
      digestOf(commented),
      `AC3: appending a comment to ${first} MOVED the bundle digest. \`cardDigest\` is ` +
        `documented as hashing the parsed card, and D-100-02's source-byte comparison is ` +
        `premised on exactly this blindness.`,
    ).toBe(digestOf(env.base));
  });

  it("does not depend on `cardFiles` key order", () => {
    const env = setup.require();
    const reversed: Record<string, string> = {};
    for (const key of Object.keys(env.base.cardFiles).sort().reverse()) {
      reversed[key] = env.base.cardFiles[key] as string;
    }

    /* `Record<string, string>` preserves insertion order, and T040's own header records that
       `cardFiles` is "the one input whose iteration order `lib/core` takes from the caller".
       A digest that varied with it would make the same folder publish to two different bundles
       depending on how a client happened to build the object. */
    expect(
      digestOf({ ...env.base, cardFiles: reversed }),
      "AC3: the digest changed when `cardFiles` was built in the opposite key order. The same " +
        "bytes must hash the same however the caller assembled the object.",
    ).toBe(digestOf(env.base));
  });

  it("keeps a card pinned by two nodes TWICE in the digest — the dedupe C1 rests on", async () => {
    const env = setup.require();
    const publish = await boundPublish();
    const { duplicatePinCorpus } = await import("./fixtures");

    const twin = duplicatePinCorpus(env.base);

    const result = resultOf(
      await publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "duplicate-pin-bundle",
        version: "1.0.0",
        manifest: twin.manifest,
        dot: twin.dot,
        cardFiles: twin.cardFiles,
      }),
      "C1",
    );

    /* The good output. */
    expect(
      result.digest,
      `C1: the digest is not \`bundleDigest\` over one entry per NODE.\n` +
        `  Six nodes pin five distinct cards here, so \`cardDigests\` has six entries with one ` +
        `repeated. \`bundleDigest\` sorts its own copy but never dedupes.`,
    ).toBe(twin.withDuplicate);

    /* And the bad one, EXCLUDED by name rather than merely not admitted. A comment saying "a
       dedupe would be wrong" beside an assertion that only checks the good value reads as
       coverage while leaving the hazard reachable; this fails with a message that says which
       defect it found. */
    expect(
      result.digest,
      `C1: the digest is what a DEDUPLICATED card set produces (${twin.deduplicated}).\n` +
        `  D-100-03: the identity across \`resolve.ts:749\`, \`addRelease\` and ` +
        `\`bundleDigest\` is textual — same dot, same multiset, same digest — and a ` +
        `\`new Set(...)\` at any one of the three sites breaks it while every bundle in ` +
        `\`content/\` keeps hashing identically, because none of them pins a card twice.`,
    ).not.toBe(twin.deduplicated);

    /* The stored release too, not only the returned value. */
    const { getRelease } = await import("@/lib/server/archive");
    const stored = await getRelease(env.scratch.db, result.bundleId, twin.withDuplicate);
    expect(
      stored?.digest,
      `C1: no release is stored under the multiset digest ${twin.withDuplicate}.`,
    ).toBe(twin.withDuplicate);

    /* `cardRefs` is the same per-node array, so it carries the repeat as well. An implementation
       that deduped the refs but not the digests stores a release whose ref list and digest list
       disagree about how many nodes there are. */
    expect(
      stored?.cardRefs.length,
      `C1: the stored release lists ${String(stored?.cardRefs.length)} card refs for a bundle ` +
        `with ${twin.cardRefs.length} nodes. \`cardRefs\` is per-node, duplicates included.`,
    ).toBe(twin.cardRefs.length);
  });

  it("pins the archive bundle's digest as a literal — a change-detector, not a derivation", () => {
    const env = setup.require();

    /* **Labelled for what it is, and for what it is not.** This literal is NOT an independent
       derivation of the right answer: it is a tripwire that fires when the corpus, the card
       bytes, or `bundleDigest` changes underneath this suite, and its value is making such a
       change LOUD rather than silently rebasing every other cell in this file.

       What it is worth beyond `digestOf` agreeing with itself: the same string is stamped into
       the SHIPPED artefact by the build — `public/bundles/starter-software-factory/README.md`
       carries `sha256:a1141199…0e718`, written by `scripts/generate-bundles.ts` through
       `exportBundle`. That is a different call path from this suite's, reached without any test
       running, so the literal is corroborated by something this author did not write. It is not
       a fully independent axis — both paths bottom out in `lib/core`'s resolver — and the cells
       above are still the ones that establish anything about the digest's BEHAVIOUR.
       (`factory.dot` also carried the digest until the owner instructed it out of every
       published bundle, 2026-08-25; `README.md` alone corroborates it now.)

       RE-PINNED TWICE, both times because a schema change moved card identity on purpose.
       `sha256:945448e0…e39af` -> `sha256:7ebdb0d0…daaab` at the `cannot` / `will_not`
       prohibition split, where every one of the 57 cards gained a key; then
       -> `sha256:a1141199…0e718` at the withdrawal of `ontology_version`, where every one of
       them lost a key AND the manifest lost one too. `cardDigest` spreads the whole card and
       `bundleDigest` covers the DOT and every pinned card digest, so all of it moves
       together, which is the signature of a schema change rather than of one card being
       edited. Both new values were taken from the corroborating artefact rather than from
       this suite, which cannot run without a database: `README.md` and an independent read
       of `readContent()` off `content/` both report it, and the 80-digest
       `bundle-equivalence` snapshot moved in the same edit each time. */
    expect(
      digestOf(env.base),
      "AC3: the archive corpus's digest moved. This literal is a change-detector — if the " +
        "change was intended (the bundle, a card, or `bundleDigest` changed), re-pin it; if it " +
        "was not, something is hashing different bytes than it did.",
    ).toBe("sha256:a1141199e8a69a94a661144e5a2a634f362cca3ebf5ae6c30a4f21491a90e718");
  });
});

/* --------------------- `created` --------------------- */

describe("T100 — `created` is a claim about idempotency", () => {
  it("is true when the slug was free and false when a release is appended", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    const first = resultOf(
      await publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "created-bundle",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "created",
    );
    expect(
      first.created,
      "`created` distinguishes a new bundle from an appended release, and this publish took a " +
        "slug that was free.",
    ).toBe(true);

    const second = resultOf(
      await publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "created-bundle",
        version: "1.1.0",
        manifest: env.revision.manifest,
        dot: env.revision.dot,
        cardFiles: env.revision.cardFiles,
      }),
      "created",
    );
    expect(
      second.created,
      "`created` was true for a release appended to a bundle that already existed. " +
        "\"A caller does not choose which act it is performing — the slug's availability " +
        "decides\", so the second publish onto the same (owner, slug) is an append.",
    ).toBe(false);

    /* Appended to the SAME bundle, not a second bundle wearing the same slug. Without this,
       `created: false` could be reported by an implementation that quietly made a new row. */
    expect(
      second.bundleId,
      "The appended release landed on a different bundle id than the one the first publish " +
        "created, so the same (owner, slug) now names two bundles.",
    ).toBe(first.bundleId);

    expect(
      second.releaseId,
      "The append returned the FIRST release's id, so no second release was created.",
    ).not.toBe(first.releaseId);
  });
});

/* --------------------- AC6 --------------------- */

describe("T100 AC6 — republishing identical bytes is a conflict naming the existing release", () => {
  it("refuses with kind `conflict` and names the version the existing release holds", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    await publish(env.scratch.db, env.owner.actor, {
      ownerHandle: env.owner.handle,
      slug: "conflict-bundle",
      version: "1.4.2",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    const refusal = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "conflict-bundle",
        /* A HIGHER version carrying the same bytes. The point of AC6 is that identity is
           decided by digest and not by version, so a republish that declares a perfectly
           legal next semver must still be refused. */
        version: "2.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "AC6",
    );

    expect(
      refusal.kind,
      `AC6: the refusal carries kind ${JSON.stringify(refusal.kind)}.\n  Message: ${refusal.message}`,
    ).toBe("conflict");

    const match = MESSAGE_FORMS.conflict.exec(refusal.message);
    expect(
      match,
      `AC6: the message is not the admissible form.\n` +
        `  Expected: publish: conflict — release \`<version>\` already holds these bytes.\n` +
        `  Actual:   ${refusal.message}`,
    ).not.toBeNull();

    /* "the refusal carries the version the existing release holds" — 1.4.2, the one already
       stored, and NOT 2.0.0, the one the caller just sent. An implementation that echoed the
       submitted version back would produce a sentence that reads correctly and tells the author
       nothing they did not already know. */
    expect(
      match?.[1],
      `AC6: the conflict names \`${match?.[1]}\`. The existing release holds \`1.4.2\`; ` +
        `\`2.0.0\` is what this caller just submitted.`,
    ).toBe("1.4.2");
  });

  it("leaves nothing behind", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    await publish(env.scratch.db, env.owner.actor, {
      ownerHandle: env.owner.handle,
      slug: "conflict-leaves-nothing",
      version: "1.0.0",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    const before = await snapshotRows(env.scratch);
    await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "conflict-leaves-nothing",
        version: "2.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "AC6",
    );
    const added = rowsAdded(before, await snapshotRows(env.scratch));

    expect(
      totalRowsAdded(added),
      `AC6: the refused republish left rows behind (${describeAdded(added)}).`,
    ).toBe(0);
  });

  it("checks the digest BEFORE the version comparison", async () => {
    const env = setup.require();
    const publish = await boundPublish();

    await publish(env.scratch.db, env.owner.actor, {
      ownerHandle: env.owner.handle,
      slug: "ordering-bundle",
      version: "2.0.0",
      manifest: env.base.manifest,
      dot: env.base.dot,
      cardFiles: env.base.cardFiles,
    });

    /* The same bytes AND a lower version, so both AC6's conflict and AC8's version refusal
       are available at once. D-100-01 ruled the ordering: the digest conflict is checked
       first, because AC6 is about IDENTITY. An implementation that compared versions first
       answers `version-not-higher` — a true sentence about the wrong thing, which sends the
       author to bump a version when the real answer is that these bytes are already published. */
    const refusal = await refusalFrom(
      publish(env.scratch.db, env.owner.actor, {
        ownerHandle: env.owner.handle,
        slug: "ordering-bundle",
        version: "1.0.0",
        manifest: env.base.manifest,
        dot: env.base.dot,
        cardFiles: env.base.cardFiles,
      }),
      "AC6 ordering",
    );

    expect(
      refusal.kind,
      `AC6 ordering: identical bytes at a lower version came back as ` +
        `${JSON.stringify(refusal.kind)}.\n` +
        `  Both refusals are available here and the digest conflict wins: AC6 is about ` +
        `identity, and "these bytes are already published" is the answer the author needs.\n` +
        `  Message: ${refusal.message}`,
    ).toBe("conflict");
  });
});
