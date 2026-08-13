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
       digests unsorted-but-undeduplicated so its bundle digest
       differs from the single-pin case

   This is the whole of what T010 can validate: "T010 is
   persistence and validates only what it can see — the
   parallel-array integrity of `cardRefs` against `cardDigests`".
   Refusing on an error-severity diagnostic moved to T100 in the
   2026-08-13 amendment and is Out of scope here, so nothing below
   asks for it.

   ── the half of AC5 that is not asserted, and why ──
   AC5 says the two digests are stored "unsorted"; the Contract
   paragraph four lines above it says "card digests are sorted and
   **not** deduplicated"; and the amendment makes `cardRefs` and
   `cardDigests` parallel arrays, which sorting one of them alone
   would silently unpair. Three clauses, three different answers,
   so the stored *order* is reported to the orchestrator and not
   asserted here. What every reading agrees on is asserted: both
   entries are kept, nothing is collapsed, and the identity moves
   when a pin is repeated. `bundleDigest` sorts internally, so the
   identity is the same under all three readings anyway — which is
   why the disagreement is safe to report rather than block on.
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

    const [row] = await releaseRows(bundleId);
    /* `card_digests` is an array, not a set: "pinning the same card twice is a different
       bundle from pinning it once, and deduplicating here would erase that". Order is not
       asserted — the contract says three different things about it and they are reported,
       not resolved. Multiplicity is asserted, because all three agree on it. */
    expect(row?.card_digests).toEqual([card, card]);
    expect(row?.card_refs).toEqual([ref, ref]);
    expect(record.digest).toBe(expectedDigest(dot, [card, card]));
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

    const rows = await releaseRows(bundleId);
    const stored = rows.find((r) => r.id === doubled.id);
    expect((stored?.card_digests as string[]).length).toBe(3);
    expect([...(stored?.card_digests as string[])].sort()).toEqual([a, a, b].sort());
    expect((stored?.card_refs as string[]).length).toBe(3);
  });

  it("AC5: the refs and digests stay paired at the same index", async () => {
    const mark = marker("ac5paired");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    /* Card digests whose sort order is the reverse of their refs' — so a store that sorts
       one array and not the other shows up here as a pairing that no longer holds. The
       digests are minted until they land on the required order rather than assumed into it. */
    const refs = ["aaa-card@1.0.0", "zzz-card@1.0.0"];
    const first = cardDigestFor(mark, 1);
    let second = cardDigestFor(mark, 2);
    for (let n = 3; first <= second && n < 200; n += 1) second = cardDigestFor(mark, n);
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

    const [row] = await releaseRows(bundleId);
    const storedRefs = row?.card_refs as string[];
    const storedDigests = row?.card_digests as string[];
    expect(storedRefs.length).toBe(storedDigests.length);
    /* The pairing, stated as a mapping so it holds whichever order the arrays came back in.
       If they were sorted together the map still reads correctly; if one was sorted alone,
       it does not. */
    const paired = new Map(storedRefs.map((ref, i) => [ref, storedDigests[i]]));
    expect(paired.get("aaa-card@1.0.0")).toBe(first);
    expect(paired.get("zzz-card@1.0.0")).toBe(second);
    expect(record.digest).toBe(expectedDigest(dot, [first, second]));
  });
});
