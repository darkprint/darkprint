import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bundleDigest, contentDigest } from "@/lib/core";

import {
  archive,
  dropScratchDatabases,
  forgetObjects,
  insertAccount,
  manifestFor,
  marker,
  remember,
  slugFor,
  validDot,
  type Archive,
  type Scratch,
  scratchDatabase,
} from "./harness";

/* ============================================================
   T010 acceptance criterion 5 — parallel-array integrity

   (5) a release whose `cardRefs` and `cardDigests` differ in
       length is refused, and one pinning a card twice stores both
       digests **in the order supplied, with `cardRefs` and
       `cardDigests` kept pairwise aligned** and nothing collapsed,
       so its bundle digest differs from the single-pin case

   This is the whole of what T010 can validate: "T010 is
   persistence and validates only what it can see — the
   parallel-array integrity of `cardRefs` against `cardDigests`".
   Refusing on an error-severity diagnostic moved to T100 in the
   2026-08-13 amendment and is Out of scope here, so nothing below
   asks for it.

   ── the order, once open and now ruled ──
   AC5 first said the digests are stored "unsorted" while the
   Contract paragraph above it said "sorted", and the arrays are
   parallel, so sorting one alone would unpair it from the other.
   That was reported rather than resolved, and the ruling came back
   in the criterion itself: **stored in the order supplied, pairwise
   aligned, nothing collapsed**, with "sorted" describing only what
   `bundleDigest` does internally when it computes identity. The
   order is therefore asserted now, and asserted through the
   published reader, which since the second amendment returns both
   arrays.
   ============================================================ */

let api: Archive;
let scratch: Scratch;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    api = await archive();
    scratch = await scratchDatabase("integrity");
  } catch (cause) {
    setupFailure = cause;
  }
}, 60_000);

/**
 * A `beforeAll` that throws marks every test in the file **skipped**, and a run reporting
 * skips reads as green at a glance. Rethrown per test, an absent module is one red per
 * criterion, which is what it is.
 */
beforeEach(() => {
  if (setupFailure !== undefined) throw setupFailure;
});

afterAll(async () => {
  const objects = await forgetObjects();
  const databases = await dropScratchDatabases();
  console.log(
    `t010/integrity teardown: deleted ${objects} objects, dropped ${databases.length} databases`,
  );
}, 60_000);

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${what} produced ${value === null ? "null" : typeof value}; expected a record.`);
  }
  return value as Record<string, unknown>;
}

async function freshBundle(mark: string): Promise<string> {
  const ownerId = await insertAccount(scratch, mark);
  const record = asRecord(
    await api.createBundle(scratch.db, { ownerId, slug: slugFor(mark), visibility: "public" }),
    "createBundle",
  );
  return String(record.id);
}

function cardDigestFor(mark: string, n: number): string {
  return contentDigest(`card body ${mark} #${n}`);
}

function expectedDigest(dot: string, cardDigests: readonly string[]): string {
  return remember(bundleDigest({ dot, cardDigests }));
}

async function releaseRows(bundleId: string): Promise<Record<string, unknown>[]> {
  return scratch.query(
    "select id, digest, card_refs, card_digests from release where bundle_id = $1",
    [bundleId],
  );
}

/** AC5's read side, through the published reader rather than past it. */
async function readBack(bundleId: string, digest: unknown): Promise<Record<string, unknown>> {
  const found = await api.getRelease(scratch.db, bundleId, String(digest));
  return asRecord(found, `getRelease(${String(digest)})`);
}

/**
 * Every refusal in this file has to be a refusal *and* leave nothing behind. A store that
 * throws after its insert has already committed satisfies "refused" and corrupts the
 * archive, and no published reader can see the difference — `listReleases` on a bundle
 * whose only row is the refused one would be the only clue, so both are checked.
 */
async function expectRefused(
  bundleId: string,
  input: Record<string, unknown>,
  why: string,
): Promise<void> {
  await expect(api.addRelease(scratch.db, { bundleId, ...input }), why).rejects.toThrow();
  expect(await releaseRows(bundleId), `${why}: nothing may be persisted`).toEqual([]);
  await expect(api.listReleases(scratch.db, bundleId)).resolves.toEqual([]);
}

/* --------------------- AC5, the parity rule --------------------- */

describe("AC5 — cardRefs and cardDigests must be the same length", () => {
  it("AC5: two refs against one digest is refused and stores nothing", async () => {
    const mark = marker("ac5more-refs");
    const bundleId = await freshBundle(mark);
    await expectRefused(
      bundleId,
      {
        version: "1.0.0",
        dot: validDot(mark),
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0", "checker-b@1.0.0"],
        cardDigests: [cardDigestFor(mark, 1)],
      },
      "two refs, one digest",
    );
  });

  it("AC5: one ref against two digests is refused and stores nothing", async () => {
    const mark = marker("ac5more-digests");
    const bundleId = await freshBundle(mark);
    await expectRefused(
      bundleId,
      {
        version: "1.0.0",
        dot: validDot(mark),
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests: [cardDigestFor(mark, 1), cardDigestFor(mark, 2)],
      },
      "one ref, two digests",
    );
  });

  it("AC5: refs with no digests at all is refused", async () => {
    const mark = marker("ac5nodigests");
    const bundleId = await freshBundle(mark);
    /* The case a naive guard misses: `cardDigests.length === 0` reads as "this bundle pins
       nothing", and the identity then comes out as the digest of the DOT alone while the
       refs say two cards are pinned. */
    await expectRefused(
      bundleId,
      {
        version: "1.0.0",
        dot: validDot(mark),
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0", "checker-b@1.0.0"],
        cardDigests: [],
      },
      "two refs, no digests",
    );
  });

  it("AC5: digests with no refs at all is refused", async () => {
    const mark = marker("ac5norefs");
    const bundleId = await freshBundle(mark);
    await expectRefused(
      bundleId,
      {
        version: "1.0.0",
        dot: validDot(mark),
        manifest: manifestFor(mark),
        cardRefs: [],
        cardDigests: [cardDigestFor(mark, 1)],
      },
      "no refs, one digest",
    );
  });

  it("AC5: a nine-to-ten mismatch is refused, not rounded off", async () => {
    const mark = marker("ac5offbyone");
    const bundleId = await freshBundle(mark);
    /* Off by one at a length no eyeball checks. A guard comparing anything other than the
       two lengths — "both non-empty", "both arrays", a truthiness test — passes this. */
    await expectRefused(
      bundleId,
      {
        version: "1.0.0",
        dot: validDot(mark),
        manifest: manifestFor(mark),
        cardRefs: Array.from({ length: 9 }, (_, i) => `solver-${i}@1.0.0`),
        cardDigests: Array.from({ length: 10 }, (_, i) => cardDigestFor(mark, i)),
      },
      "nine refs, ten digests",
    );
  });

  it("AC5: equal lengths are accepted — the rule is parity, not suspicion", async () => {
    const mark = marker("ac5equal");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1), cardDigestFor(mark, 2), cardDigestFor(mark, 3)];

    /* The half that keeps the five refusals above honest: a guard that refuses every
       release satisfies all of them and fails only here. */
    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0", "checker-b@1.0.0", "planner-c@2.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    expect(record.digest).toBe(expectedDigest(dot, cardDigests));
    expect((await releaseRows(bundleId)).length).toBe(1);
  });

  it("AC5: two empty arrays are equal in length and are accepted", async () => {
    const mark = marker("ac5bothempty");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: [],
        cardDigests: [],
      }),
      "addRelease",
    );
    expect(record.digest).toBe(expectedDigest(dot, []));
  });
});

/* --------------------- AC5, the not-deduplicated rule --------------------- */

describe("AC5 — a card pinned twice keeps both digests", () => {
  it("AC5: pinning one card twice stores two digests, not one", async () => {
    const mark = marker("ac5twice");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const card = cardDigestFor(mark, 1);
    const ref = "solver-a@1.0.0";

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: [ref, ref],
        cardDigests: [card, card],
      }),
      "addRelease",
    );

    /* An array, not a set: "pinning the same card twice is a different bundle from pinning
       it once, and deduplicating here would erase that". Read through the published reader,
       which is where a consumer sees it. */
    const read = await readBack(bundleId, record.digest);
    expect(read.cardDigests).toEqual([card, card]);
    expect(read.cardRefs).toEqual([ref, ref]);
    expect(record.cardDigests).toEqual([card, card]);
    expect(record.digest).toBe(expectedDigest(dot, [card, card]));

    const [row] = await releaseRows(bundleId);
    expect(row?.card_digests).toEqual([card, card]);
    expect(row?.card_refs).toEqual([ref, ref]);
  });

  it("AC5: the two-pin identity differs from the one-pin identity", async () => {
    const mark = marker("ac5differs");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const card = cardDigestFor(mark, 1);
    const ref = "solver-a@1.0.0";

    const once = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: [ref],
        cardDigests: [card],
      }),
      "addRelease",
    );
    const twice = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.1.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: [ref, ref],
        cardDigests: [card, card],
      }),
      "addRelease",
    );

    expect(twice.digest).not.toBe(once.digest);
    expect(once.digest).toBe(expectedDigest(dot, [card]));
    expect(twice.digest).toBe(expectedDigest(dot, [card, card]));
  });

  it("AC5: three pins, two pins and one pin are three different identities", async () => {
    const mark = marker("ac5three");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const card = cardDigestFor(mark, 1);
    const ref = "solver-a@1.0.0";

    /* A store that deduplicates collapses all three onto one digest, and a store that
       merely counts "has duplicates" collapses the last two. Three points separate them. */
    const digests = new Set<string>();
    for (const [n, version] of [
      [1, "1.0.0"],
      [2, "2.0.0"],
      [3, "3.0.0"],
    ] as const) {
      const record = asRecord(
        await api.addRelease(scratch.db, {
          bundleId,
          version,
          dot,
          manifest: manifestFor(mark),
          cardRefs: Array.from({ length: n }, () => ref),
          cardDigests: Array.from({ length: n }, () => card),
        }),
        "addRelease",
      );
      expect(record.digest).toBe(expectedDigest(dot, Array.from({ length: n }, () => card)));
      digests.add(String(record.digest));
    }
    expect(digests.size).toBe(3);
  });

  it("AC5: a duplicate beside a distinct card is kept, not folded into the set", async () => {
    const mark = marker("ac5mixed");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const a = cardDigestFor(mark, 1);
    const b = cardDigestFor(mark, 2);
    const refA = "solver-a@1.0.0";
    const refB = "checker-b@1.0.0";

    const doubled = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: [refA, refA, refB],
        cardDigests: [a, a, b],
      }),
      "addRelease",
    );
    const plain = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.1.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: [refA, refB],
        cardDigests: [a, b],
      }),
      "addRelease",
    );

    expect(doubled.digest).not.toBe(plain.digest);
    expect(doubled.digest).toBe(expectedDigest(dot, [a, a, b]));
    expect(plain.digest).toBe(expectedDigest(dot, [a, b]));

    /* Order supplied, order stored — the ruling, asserted directly now rather than as a
       multiset. `[a, a, b]` and not `[a, b, a]`, and not `[a, b]`. */
    const read = await readBack(bundleId, doubled.digest);
    expect(read.cardDigests).toEqual([a, a, b]);
    expect(read.cardRefs).toEqual([refA, refA, refB]);
  });

  it("AC5: the refs and digests stay paired at the same index", async () => {
    const mark = marker("ac5paired");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    /*
     * Card digests whose sort order is the reverse of their refs' — so a store that sorts one
     * array and not the other shows up here as a pairing that no longer holds.
     *
     * ORDERED, not searched for, and the difference was a permanent flake. This read:
     *
     *     const first = cardDigestFor(mark, 1);
     *     let   second = cardDigestFor(mark, 2);
     *     for (let n = 3; first <= second && n < 200; n += 1) second = cardDigestFor(mark, n);
     *
     * with a comment claiming *the digests are minted until they land on the required order
     * rather than assumed into it* — and **the search is one-sided.** It re-mints `second` and
     * never `first`, so when `first` happens to be the smallest of all 199 candidates no amount
     * of re-minting helps and the precondition fails. `marker()` carries `Math.random()`, so the
     * draw is fresh per run: analytically `1/199` = 0.503%, and T230's implementer measured
     * 87 failures over 20 000 markers in-process, 0.435%. **A permanent ~1-in-230 red in a
     * merged suite, independent of load and of whatever else is running.**
     *
     * It surfaced as one member of a non-identical triple, and separating it from the genuine
     * contention artifact in the same triple is what identified it: a defect is stable and an
     * artifact moves, and here one moved for load and one moved for a coin.
     *
     * Two digests and a swap is O(1) and cannot fail, so the comment above is now true of the
     * code below it. The pairing itself is arbitrary — all the criterion needs is that the two
     * orders are opposite — so ordering the digests is enough and the refs stay as they are.
     */
    const refs = ["aaa-card@1.0.0", "zzz-card@1.0.0"];
    const minted = [cardDigestFor(mark, 1), cardDigestFor(mark, 2)] as const;
    /* Two different inputs to the same hash: equal outputs are a collision, not a fixture
       state. Asserted rather than tolerated, because `>` and `>=` differ for exactly this
       case and a non-strict order would make the criterion below vacuous. */
    expect(minted[0], "two distinct inputs hashed to one digest").not.toBe(minted[1]);
    const [first, second] = minted[0] > minted[1] ? minted : ([minted[1], minted[0]] as const);
    expect(first > second, "fixture needs a digest pair in reverse order of its refs").toBe(true);

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: refs,
        cardDigests: [first, second],
      }),
      "addRelease",
    );

    const read = await readBack(bundleId, record.digest);
    const storedRefs = read.cardRefs as string[];
    const storedDigests = read.cardDigests as string[];
    /* The ruling is "the order supplied, pairwise aligned", so both halves are asserted:
       the arrays come back exactly as they went in... */
    expect(storedRefs).toEqual(refs);
    expect(storedDigests).toEqual([first, second]);
    /* ...and the pairing holds index by index, which is the property that survives even if
       someone later decides the storage order may change. A store that sorted the digests
       alone would put `second` at index 0 against `aaa-card@1.0.0`. */
    const paired = new Map(storedRefs.map((ref, i) => [ref, storedDigests[i]]));
    expect(paired.get("aaa-card@1.0.0")).toBe(first);
    expect(paired.get("zzz-card@1.0.0")).toBe(second);
    expect(record.digest).toBe(expectedDigest(dot, [first, second]));
  });
});
