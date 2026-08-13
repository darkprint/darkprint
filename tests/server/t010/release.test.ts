import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bundleDigest, contentDigest } from "@/lib/core";

import {
  archive,
  dropScratchDatabases,
  forgetObjects,
  insertAccount,
  manifestFor,
  marker,
  PUBLISHED,
  remember,
  slugFor,
  validDot,
  type Archive,
  type Scratch,
  scratchDatabase,
} from "./harness";

/* ============================================================
   T010 acceptance criteria 1 to 4 — releases

   (1) storing a release and reading it back yields byte-identical
       DOT and card text
   (2) the stored digest equals what `lib/core` computes over the
       same inputs
   (3) a bundle pinning one card twice stores a different digest
       from one pinning it once
   (4) appending a release leaves every earlier release readable at
       its own digest

   ── the half of AC1 this file does not test ──
   AC1 names "DOT **and card text**". `addRelease`'s input, after the
   2026-08-13 amendment, carries `cardRefs` and `cardDigests` and no
   card bytes at all — card bodies are T020's and Forbidden here —
   and `ReleaseRecord` carries neither. There is no published way to
   store card text through this task or to read it back, so the card
   half of AC1 is **reported to the orchestrator, not resolved
   here**: inventing a name for it is the technique that cost T000
   two rounds. The DOT half is tested below, hard.

   ── isolation ──
   One scratch database, created and dropped by this file. Object
   storage is isolated by content: every fixture carries a marker
   unique to the run, so its digest is unique for free and no key is
   ever prefixed — the key *is* the digest, and prefixing it stops
   the test exercising addressing at all.

   ── no NUL in a DOT fixture ──
   Postgres `text` cannot hold U+0000, and `release.dot` is a `text`
   column T010 may not change. The unicode fixtures below are
   therefore astral, ZWJ, combining and bidi characters — every
   place a normalising store shows itself — and never a NUL, which
   would fail the insert for a reason that has nothing to do with
   this task.
   ============================================================ */

let api: Archive;
let scratch: Scratch;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    api = await archive();
    scratch = await scratchDatabase("release");
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
  console.log(`t010/release teardown: deleted ${objects} objects, dropped ${databases.length} databases`);
}, 60_000);

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${what} produced ${value === null ? "null" : typeof value}; expected a record.`);
  }
  return value as Record<string, unknown>;
}

/** A bundle to hang releases off, with an account of its own so no two tests contend. */
async function freshBundle(mark: string): Promise<string> {
  const ownerId = await insertAccount(scratch, mark);
  const record = asRecord(
    await api.createBundle(scratch.db, { ownerId, slug: slugFor(mark), visibility: "public" }),
    "createBundle",
  );
  return String(record.id);
}

/**
 * A well-formed `sha256:<64 hex>` over content unique to this run — `contentDigest` is
 * `lib/core`'s own, so these are digests in exactly the shape `keyForDigest` validates
 * rather than strings that merely look like one.
 */
function cardDigestFor(mark: string, n: number): string {
  return contentDigest(`card body ${mark} #${n}`);
}

/** What the engine says the identity of these inputs is. AC2 compares against this. */
function expectedDigest(dot: string, cardDigests: readonly string[]): string {
  return remember(bundleDigest({ dot, cardDigests }));
}

async function storedDot(id: unknown): Promise<string> {
  /* No published reader returns a release's DOT: `ReleaseRecord` is
     `{ id, bundleId, version, digest, createdAt }`. `release.dot` is `NOT NULL` in a schema
     T010 is Forbidden from editing, so every implementation must write it, and this reads
     that column through `createDbClient`'s own query rather than through anything inside
     `lib/server/archive`. That no published function answers AC1's "reading it back" is
     reported to the orchestrator. */
  const [row] = await scratch.query("select dot from release where id = $1", [id]);
  if (row === undefined) throw new Error(`No release row for id ${String(id)}.`);
  return String(row.dot);
}

async function countReleases(bundleId: string): Promise<number> {
  const [row] = await scratch.query("select count(*)::int as n from release where bundle_id = $1", [
    bundleId,
  ]);
  return Number(row?.n);
}

/* --------------------- the published surface --------------------- */

describe("the published surface", () => {
  it("publishes addRelease, getRelease and listReleases from @/lib/server/archive", () => {
    expect(typeof api.addRelease, PUBLISHED.addRelease).toBe("function");
    expect(typeof api.getRelease, PUBLISHED.getRelease).toBe("function");
    expect(typeof api.listReleases, PUBLISHED.listReleases).toBe("function");
  });

  it("returns a ReleaseRecord shaped exactly as the contract publishes it", async () => {
    const mark = marker("relshape");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    expect(Object.keys(record).sort(), PUBLISHED.releaseRecord).toEqual(
      ["bundleId", "createdAt", "digest", "id", "version"].sort(),
    );
    expect(typeof record.id).toBe("string");
    expect(record.bundleId).toBe(bundleId);
    expect(record.version).toBe("1.0.0");
    expect(record.digest).toBe(expectedDigest(dot, cardDigests));
    expect(record.createdAt).toBeInstanceOf(Date);
  });
});

/* --------------------- AC1 --------------------- */

describe("AC1 — storing a release and reading it back yields byte-identical DOT", () => {
  it("AC1: a plain DOT survives the round trip byte for byte", async () => {
    const mark = marker("ac1plain");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    const read = await storedDot(record.id);
    expect(read).toBe(dot);
    expect([...read].length).toBe([...dot].length);
  });

  it("AC1: unicode, combining marks and a ZWJ sequence survive unnormalised", async () => {
    const mark = marker("ac1unicode");
    const bundleId = await freshBundle(mark);
    /* NFC and NFD forms of the same letter, an astral character, a ZWJ emoji sequence and a
       bidi override. A store that normalises unicode collapses the first pair and this is
       the only place it would ever show. */
    const dot = [
      `digraph "${mark}" {`,
      '  label="é vs é";',
      '  astral="\u{1D11E} \u{1F9EA}";',
      '  zwj="\u{1F468}‍\u{1F4BB}";',
      '  bidi="‮txet‬";',
      '  ingest [ref="solver-a@1.0.0"];',
      "}",
      "",
    ].join("\n");
    const cardDigests = [cardDigestFor(mark, 1)];

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    const read = await storedDot(record.id);
    expect(read).toBe(dot);
    expect(read.normalize("NFC")).toBe(dot.normalize("NFC"));
    expect(read.includes("é")).toBe(true);
    expect(read.includes("é")).toBe(true);
  });

  it("AC1: CRLF, tabs, trailing spaces and a trailing newline survive untrimmed", async () => {
    const mark = marker("ac1ws");
    const bundleId = await freshBundle(mark);
    /* Whitespace is where a "helpful" store does its damage, and the digest is computed over
       these exact bytes, so a trim changes the identity of the blueprint. */
    const dot = `digraph "${mark}" {\r\n\tlabel="  padded  ";   \r\n}\n\n`;
    const cardDigests = [cardDigestFor(mark, 1)];

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    expect(await storedDot(record.id)).toBe(dot);
  });

  it("AC1: an empty DOT is stored as the empty string, not as null", async () => {
    const mark = marker("ac1empty");
    const bundleId = await freshBundle(mark);
    /* Empty is a value. `release.dot` is NOT NULL, so a store that maps "" to null cannot
       even insert, and one that maps it to a placeholder changes the identity. The card
       digest keeps this release's bundle digest unique across runs. */
    const cardDigests = [cardDigestFor(mark, 1)];

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot: "",
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    expect(await storedDot(record.id)).toBe("");
    expect(record.digest).toBe(expectedDigest("", cardDigests));
  });

  it("AC1: a one-megabyte DOT survives byte for byte", async () => {
    const mark = marker("ac1big");
    const bundleId = await freshBundle(mark);
    const line = '  node [ref="solver-a@1.0.0", note="padding padding padding padding"];\n';
    const dot = `digraph "${mark}" {\n${line.repeat(15_000)}}\n`;
    const cardDigests = [cardDigestFor(mark, 1)];
    expect(dot.length).toBeGreaterThan(1_000_000);

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    const read = await storedDot(record.id);
    expect(read.length).toBe(dot.length);
    expect(read).toBe(dot);
  }, 60_000);
});

/* --------------------- AC2 --------------------- */

describe("AC2 — the stored digest equals what lib/core computes", () => {
  it("AC2: the returned digest is bundleDigest over the same dot and card digests", async () => {
    const mark = marker("ac2");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1), cardDigestFor(mark, 2), cardDigestFor(mark, 3)];

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
    expect(String(record.digest)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("AC2: the digest the caller reads back equals the digest that was stored", async () => {
    const mark = marker("ac2read");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];
    const digest = expectedDigest(dot, cardDigests);

    await api.addRelease(scratch.db, {
      bundleId,
      version: "1.0.0",
      dot,
      manifest: manifestFor(mark),
      cardRefs: ["solver-a@1.0.0"],
      cardDigests,
    });

    const read = asRecord(await api.getRelease(scratch.db, bundleId, digest), "getRelease");
    expect(read.digest).toBe(digest);
    const [row] = await scratch.query("select digest from release where id = $1", [read.id]);
    expect(String(row?.digest)).toBe(digest);
  });

  it("AC2: a digest handed in by the caller does not become the stored identity", async () => {
    const mark = marker("ac2supplied");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];
    const lie = `sha256:${"0".repeat(64)}`;

    /* The amendment's whole point: "digest is COMPUTED here, never supplied". Refusing the
       extra field and ignoring it are both faithful to that; honouring it is not, and that
       is the only outcome this rejects. */
    const outcome = await Promise.resolve(
      api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
        digest: lie,
      }),
    ).then(
      (value) => ({ ok: true as const, value }),
      (cause: unknown) => ({ ok: false as const, cause }),
    );

    if (outcome.ok) {
      const record = asRecord(outcome.value, "addRelease");
      expect(record.digest).toBe(expectedDigest(dot, cardDigests));
      expect(record.digest).not.toBe(lie);
    }
    /* Either way, nothing is readable at the identity the caller tried to assert. */
    await expect(api.getRelease(scratch.db, bundleId, lie)).resolves.toBeUndefined();
    const [row] = await scratch.query(
      "select count(*)::int as n from release where bundle_id = $1 and digest = $2",
      [bundleId, lie],
    );
    expect(Number(row?.n)).toBe(0);
  });

  it("AC2: the digest does not depend on the order the card digests arrived in", async () => {
    const mark = marker("ac2order");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const one = cardDigestFor(mark, 1);
    const two = cardDigestFor(mark, 2);
    const refA = "solver-a@1.0.0";
    const refB = "checker-b@1.0.0";

    /* `bundleDigest` sorts the digests, so the order files arrived in cannot change the
       identity. `cardRefs` and `cardDigests` are parallel arrays, so both permute together. */
    const first = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: [refA, refB],
        cardDigests: [one, two],
      }),
      "addRelease",
    );

    /* Same identity, so the second call is the same content under a different declared
       version — the digest has to come out identical. */
    const second = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.1",
        dot,
        manifest: manifestFor(mark),
        cardRefs: [refB, refA],
        cardDigests: [two, one],
      }),
      "addRelease",
    );

    expect(second.digest).toBe(first.digest);
    expect(first.digest).toBe(expectedDigest(dot, [one, two]));
  });

  it("AC2: an analysis block does not enter the identity", async () => {
    const mark = marker("ac2analysis");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];

    /* Identity is `bundleDigest(dot, sortedCardDigests)` and nothing else. `analysis` is
       B-08's "computed when a release is cut" and is re-computed on an ontology release, so
       a digest that moved with it would change a published blueprint's identity behind its
       author's back. */
    const analysis = {
      autonomy: {
        autonomyClass: "assisted",
        isDarkFactory: false,
        level: 2,
        label: "Assisted",
        fraction: 0.5,
        autonomousNodes: 1,
        totalNodes: 2,
        contributions: [],
        rationale: "fixture",
      },
      security: {
        level: 4,
        raw: 4,
        penalties: [],
        findings: [],
        rationale: "4 → 4",
        ontologyVersion: "1.0.0",
        diagnostics: [],
      },
      phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
    };

    const withAnalysis = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
        analysis,
      }),
      "addRelease",
    );

    expect(withAnalysis.digest).toBe(expectedDigest(dot, cardDigests));
  });
});

/* --------------------- AC3 --------------------- */

describe("AC3 — pinning one card twice is a different bundle from pinning it once", () => {
  it("AC3: the two-pin digest differs from the one-pin digest and both are stored", async () => {
    const mark = marker("ac3");
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

    expect(once.digest).toBe(expectedDigest(dot, [card]));
    expect(twice.digest).toBe(expectedDigest(dot, [card, card]));
    expect(twice.digest).not.toBe(once.digest);

    /* Each readable at its own digest, so neither overwrote the other on the way in. */
    const readOnce = asRecord(
      await api.getRelease(scratch.db, bundleId, String(once.digest)),
      "getRelease",
    );
    const readTwice = asRecord(
      await api.getRelease(scratch.db, bundleId, String(twice.digest)),
      "getRelease",
    );
    expect(readOnce.id).toBe(once.id);
    expect(readTwice.id).toBe(twice.id);
  });
});

/* --------------------- AC4 --------------------- */

describe("AC4 — appending leaves every earlier release readable at its own digest", () => {
  it("AC4: five appended releases each stay readable at their own digest", async () => {
    const mark = marker("ac4");
    const bundleId = await freshBundle(mark);
    const stored: { version: string; digest: string; id: string }[] = [];

    for (let n = 1; n <= 5; n += 1) {
      const dot = validDot(`${mark}-${n}`);
      const cardDigests = [cardDigestFor(mark, n)];
      const record = asRecord(
        await api.addRelease(scratch.db, {
          bundleId,
          version: `1.${n}.0`,
          dot,
          manifest: manifestFor(`${mark}-${n}`),
          cardRefs: ["solver-a@1.0.0"],
          cardDigests,
        }),
        "addRelease",
      );
      expect(record.digest).toBe(expectedDigest(dot, cardDigests));
      stored.push({ version: `1.${n}.0`, digest: String(record.digest), id: String(record.id) });

      /* After every append, every release stored so far — not only the newest — is still
         readable at its own digest. An update-in-place store passes this on the last one
         and fails on all the earlier ones. */
      for (const earlier of stored) {
        const read = asRecord(
          await api.getRelease(scratch.db, bundleId, earlier.digest),
          `getRelease(${earlier.digest})`,
        );
        expect(read.id).toBe(earlier.id);
        expect(read.version).toBe(earlier.version);
        expect(read.digest).toBe(earlier.digest);
      }
    }

    expect(await countReleases(bundleId)).toBe(5);
  }, 60_000);

  it("AC4: listReleases returns every release the bundle holds", async () => {
    const mark = marker("ac4list");
    const bundleId = await freshBundle(mark);
    const digests: string[] = [];

    for (let n = 1; n <= 4; n += 1) {
      const dot = validDot(`${mark}-${n}`);
      const cardDigests = [cardDigestFor(mark, n)];
      const record = asRecord(
        await api.addRelease(scratch.db, {
          bundleId,
          version: `2.${n}.0`,
          dot,
          manifest: manifestFor(`${mark}-${n}`),
          cardRefs: ["solver-a@1.0.0"],
          cardDigests,
        }),
        "addRelease",
      );
      digests.push(String(record.digest));
    }

    const list = await api.listReleases(scratch.db, bundleId);
    expect(Array.isArray(list)).toBe(true);
    const listed = list as Record<string, unknown>[];
    expect(listed.length).toBe(4);
    /* Order is not named by the contract, so it is not asserted. Membership is. */
    expect(listed.map((r) => String(r.digest)).sort()).toEqual([...digests].sort());
    expect(listed.map((r) => String(r.version)).sort()).toEqual([
      "2.1.0",
      "2.2.0",
      "2.3.0",
      "2.4.0",
    ]);
  }, 60_000);

  it("AC4: one bundle's releases never appear under another's", async () => {
    const mark = marker("ac4cross");
    const mine = await freshBundle(`${mark}-mine`);
    const theirs = await freshBundle(`${mark}-theirs`);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId: mine,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    expect(await api.listReleases(scratch.db, theirs)).toEqual([]);
    /* The same digest, asked for under the wrong bundle. `getRelease` is keyed on
       `(bundleId, digest)` and a lookup that ignores the bundle would answer this. */
    await expect(
      api.getRelease(scratch.db, theirs, String(record.digest)),
    ).resolves.toBeUndefined();
  });

  it("AC4: appending is append-only — a repeated version leaves exactly one release", async () => {
    const mark = marker("ac4dup");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];

    await api.addRelease(scratch.db, {
      bundleId,
      version: "1.0.0",
      dot,
      manifest: manifestFor(mark),
      cardRefs: ["solver-a@1.0.0"],
      cardDigests,
    });
    /* `release_bundle_version_key` is unique on `(bundle_id, version)`. Whether the second
       call rejects or is absorbed is not named; that the history does not grow a second row
       for one version is. */
    await Promise.resolve(
      api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot: validDot(`${mark}-other`),
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests: [cardDigestFor(mark, 2)],
      }),
    ).catch(() => undefined);

    expect(await countReleases(bundleId)).toBe(1);
    const list = (await api.listReleases(scratch.db, bundleId)) as Record<string, unknown>[];
    expect(list.length).toBe(1);
    expect(list[0]?.digest).toBe(expectedDigest(dot, cardDigests));
  });

  it("AC4: six concurrent appends all land and all stay readable", async () => {
    const mark = marker("ac4race");
    const bundleId = await freshBundle(mark);

    const inputs = Array.from({ length: 6 }, (_, i) => {
      const dot = validDot(`${mark}-${i}`);
      const cardDigests = [cardDigestFor(mark, i)];
      return { version: `3.${i}.0`, dot, cardDigests };
    });

    const records = await Promise.all(
      inputs.map((input) =>
        api.addRelease(scratch.db, {
          bundleId,
          version: input.version,
          dot: input.dot,
          manifest: manifestFor(mark),
          cardRefs: ["solver-a@1.0.0"],
          cardDigests: input.cardDigests,
        }),
      ),
    );

    expect(await countReleases(bundleId)).toBe(6);
    for (let i = 0; i < inputs.length; i += 1) {
      const digest = expectedDigest(inputs[i]!.dot, inputs[i]!.cardDigests);
      expect(asRecord(records[i], "addRelease").digest).toBe(digest);
      const read = asRecord(await api.getRelease(scratch.db, bundleId, digest), "getRelease");
      expect(read.version).toBe(inputs[i]!.version);
    }
  }, 60_000);
});

/* --------------------- absence, and a digest at the edge --------------------- */

describe("reading what is not there", () => {
  it("listReleases answers an empty array for a bundle with no releases", async () => {
    const bundleId = await freshBundle(marker("norel"));
    await expect(api.listReleases(scratch.db, bundleId)).resolves.toEqual([]);
  });

  it("listReleases answers an empty array for a bundle id nothing holds", async () => {
    const ghost = "00000000-0000-4000-8000-000000000001";
    await expect(api.listReleases(scratch.db, ghost)).resolves.toEqual([]);
  });

  it("getRelease answers undefined for a well-formed digest nothing was stored under", async () => {
    const bundleId = await freshBundle(marker("absentdigest"));
    const absent = contentDigest(`nothing was ever stored under ${marker("absentdigest")}`);
    await expect(api.getRelease(scratch.db, bundleId, absent)).resolves.toBeUndefined();
  });

  it("getRelease treats a malformed digest as absence and never echoes it back", async () => {
    const mark = marker("edgedigest");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];
    await api.addRelease(scratch.db, {
      bundleId,
      version: "1.0.0",
      dot,
      manifest: manifestFor(mark),
      cardRefs: ["solver-a@1.0.0"],
      cardDigests,
    });

    /* T010's inherited note: "`keyForDigest` throws a plain `Error` quoting its caller's
       input. **Validate a digest at the edge**, so a bad path parameter is a 404 and not a
       500 that echoes what the caller sent." At this layer a 404 is `undefined` — both
       published readers return `| undefined` and that is how absence is said here. */
    const malformed = [
      "",
      " ",
      "sha256:",
      "sha256",
      `sha256:${"0".repeat(63)}`,
      `sha256:${"0".repeat(65)}`,
      `sha256:${"A".repeat(64)}`,
      `sha256:${"g".repeat(64)}`,
      "sha256:../../etc/passwd",
      "../../etc/passwd",
      "sha256:<script>alert(1)</script>",
      "sha512:" + "0".repeat(64),
      `sha256:${"0".repeat(64)}\n`,
      `sha256:\u{1F9EA}${"0".repeat(58)}`,
      "%2e%2e%2f",
      "sha256:sha256:" + "0".repeat(64),
    ];

    for (const digest of malformed) {
      const outcome = await Promise.resolve(api.getRelease(scratch.db, bundleId, digest)).then(
        (value) => ({ ok: true as const, value }),
        (cause: unknown) => ({ ok: false as const, cause: String(cause) }),
      );
      /* The failure message carries the throw, so a red says *how* it went wrong: an
         unvalidated digest reaches `keyForDigest`, which throws an `Error` quoting the
         caller's own string — the 500-that-echoes shape this task inherits the warning
         about. */
      expect(
        outcome,
        `getRelease(${JSON.stringify(digest)}) must answer absence, not throw`,
      ).toEqual({ ok: true, value: undefined });
    }

    /* And the release that *is* there is still readable, so "absence" above is the digests
       being rejected and not the lookup having been broken by them. */
    const good = asRecord(
      await api.getRelease(scratch.db, bundleId, expectedDigest(dot, cardDigests)),
      "getRelease",
    );
    expect(good.version).toBe("1.0.0");
  }, 60_000);
});

/* --------------------- input the contract does not describe --------------------- */

describe("input the contract leaves at its edges", () => {
  it("refuses a release against a bundle id nothing holds, and stores nothing", async () => {
    const mark = marker("ghostbundle");
    const ghost = "00000000-0000-4000-8000-000000000002";
    await expect(
      api.addRelease(scratch.db, {
        bundleId: ghost,
        version: "1.0.0",
        dot: validDot(mark),
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests: [cardDigestFor(mark, 1)],
      }),
    ).rejects.toThrow();
    expect(await countReleases(ghost)).toBe(0);
  });

  it("stores a release pinning no cards at all", async () => {
    const mark = marker("nopins");
    const bundleId = await freshBundle(mark);
    /* A blueprint that pins nothing is a real bundle — `registry.test.ts` asserts
       `cardRefs` of `[]` for one — and its identity is the digest of its DOT alone. */
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
    const read = asRecord(
      await api.getRelease(scratch.db, bundleId, String(record.digest)),
      "getRelease",
    );
    expect(read.id).toBe(record.id);
  });

  it("keeps a unicode version string verbatim rather than parsing it away", async () => {
    const mark = marker("universion");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];
    /* `release.version` is `text`, and semver validation is T025's authority, not this
       task's. Whatever T010 is handed it stores unchanged, so a version that is not semver
       comes back as it went in rather than silently repaired. */
    const version = "1.0.0-\u{1F9EA}é";

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version,
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
      }),
      "addRelease",
    );

    expect(record.version).toBe(version);
    const read = asRecord(
      await api.getRelease(scratch.db, bundleId, String(record.digest)),
      "getRelease",
    );
    expect(read.version).toBe(version);
  });

  it("round-trips the local vocabulary a release declares", async () => {
    const mark = marker("vocab");
    const bundleId = await freshBundle(mark);
    const dot = validDot(mark);
    const cardDigests = [cardDigestFor(mark, 1)];
    /* `vocabulary?` is the release's local/namespaced overlay — `release.local_vocabulary`,
       nullable, which is what T090 exports as `ontology/extensions.yaml`. */
    const vocabulary = [
      { id: `${mark}/custom-phase`, kind: "phase", label: "Custom", broader: ["design"] },
    ];

    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot,
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests,
        vocabulary,
      }),
      "addRelease",
    );

    const [row] = await scratch.query("select local_vocabulary from release where id = $1", [
      record.id,
    ]);
    expect(row?.local_vocabulary).toEqual(vocabulary);
    /* And it does not enter the identity: the digest is the DOT plus the card digests. */
    expect(record.digest).toBe(expectedDigest(dot, cardDigests));
  });

  it("leaves local_vocabulary null when a release declares none", async () => {
    const mark = marker("novocab");
    const bundleId = await freshBundle(mark);
    const record = asRecord(
      await api.addRelease(scratch.db, {
        bundleId,
        version: "1.0.0",
        dot: validDot(mark),
        manifest: manifestFor(mark),
        cardRefs: ["solver-a@1.0.0"],
        cardDigests: [cardDigestFor(mark, 1)],
      }),
      "addRelease",
    );
    const [row] = await scratch.query("select local_vocabulary from release where id = $1", [
      record.id,
    ]);
    expect(row?.local_vocabulary).toBeNull();
  });
});
