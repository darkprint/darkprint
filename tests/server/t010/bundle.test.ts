import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  archive,
  dropScratchDatabases,
  forgetObjects,
  insertAccount,
  marker,
  PUBLISHED,
  slugFor,
  type Archive,
  type Scratch,
  scratchDatabase,
} from "./harness";

/* ============================================================
   T010 acceptance criterion 6, and the bundle half of the
   published surface.

   (6) two owners may hold the same slug and their records never
       collide

   Everything here goes through the five functions
   `@/lib/server/archive` publishes. Where an assertion cannot be
   answered by a published reader — "how many rows are there
   really" — it goes through `createDbClient`'s own `query` against
   this file's scratch database, never through anything inside
   `lib/server/archive`.

   ── two databases, on purpose ──
   The contract's own justification for `Db` being the first
   parameter is D-08: "a function that reaches for a shared
   connection cannot be pointed at a test's own database, and the
   blind suite will need to do exactly that". So this file drives
   two scratch databases and asserts that a bundle written through
   one is invisible through the other. An implementation holding a
   module-scope client would put every row in the same place and
   pass every other test in this file.
   ============================================================ */

let api: Archive;
let primary: Scratch;
let secondary: Scratch;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    /* The archive module first: when it is absent no database is created, so a red about a
       missing module never also leaves a database behind to explain. */
    api = await archive();
    primary = await scratchDatabase("bundle_a");
    secondary = await scratchDatabase("bundle_b");
  } catch (cause) {
    setupFailure = cause;
  }
}, 60_000);

/**
 * Recorded above and rethrown here, rather than thrown from `beforeAll`. A `beforeAll` that
 * throws marks every test in the file **skipped**, and a run reporting skips reads as green
 * at a glance — the same failure mode as a worktree whose config collects no tests at all.
 * Thrown per test, an absent module is one red per criterion, which is what it is.
 */
beforeEach(() => {
  if (setupFailure !== undefined) throw setupFailure;
});

afterAll(async () => {
  const objects = await forgetObjects();
  const databases = await dropScratchDatabases();
  console.log(`t010/bundle teardown: deleted ${objects} objects, dropped ${databases.length} databases`);
}, 60_000);

/** One account per test, so no two tests can contend for the same `(owner, slug)`. */
async function owner(scratch: Scratch, mark: string): Promise<string> {
  return insertAccount(scratch, mark);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${what} produced ${value === null ? "null" : typeof value}; expected a record.`);
  }
  return value as Record<string, unknown>;
}

async function countBundles(scratch: Scratch, ownerId: string, slug: string): Promise<number> {
  const [row] = await scratch.query(
    "select count(*)::int as n from bundle where owner_id = $1 and slug = $2",
    [ownerId, slug],
  );
  return Number(row?.n);
}

/* --------------------- the published surface --------------------- */

describe("the published surface", () => {
  it("publishes createBundle and getBundle from @/lib/server/archive", () => {
    /* `archive()` in beforeAll already bound all five by their published names and threw
       naming the clause if one was absent. This restates the two this file uses so a reader
       of the red knows which block it comes from. */
    expect(typeof api.createBundle, PUBLISHED.createBundle).toBe("function");
    expect(typeof api.getBundle, PUBLISHED.getBundle).toBe("function");
  });

  it("returns a BundleRecord shaped exactly as the contract publishes it", async () => {
    const mark = marker("shape");
    const ownerId = await owner(primary, mark);
    const record = asRecord(
      await api.createBundle(primary.db, { ownerId, slug: slugFor(mark), visibility: "public" }),
      "createBundle",
    );

    expect(Object.keys(record).sort(), PUBLISHED.bundleRecord).toEqual(
      ["createdAt", "id", "ownerId", "slug", "updatedAt", "visibility"].sort(),
    );
    expect(typeof record.id).toBe("string");
    expect(record.ownerId).toBe(ownerId);
    expect(record.slug).toBe(slugFor(mark));
    expect(record.visibility).toBe("public");
    /* `createdAt: Date` and `updatedAt: Date`, not the ISO string a JSON round trip leaves
       behind — the contract publishes the type, and a route that formats one has to be able
       to tell them apart. */
    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);
  });

  it("omits lineage when none was given, rather than padding it to null", async () => {
    const mark = marker("nolineage");
    const ownerId = await owner(primary, mark);
    const record = asRecord(
      await api.createBundle(primary.db, { ownerId, slug: slugFor(mark), visibility: "public" }),
      "createBundle",
    );
    /* `lineage?` is optional in the published interface. A `lineage: null` is a different
       shape from an absent one and a consumer written against the interface reads the
       absent form; this is the same distinction T000's envelope tests hold for diagnostics. */
    expect("lineage" in record).toBe(false);
  });

  it("round-trips a lineage pointer through createBundle and getBundle", async () => {
    const mark = marker("lineage");
    const ownerId = await owner(primary, mark);
    const upstream = await owner(primary, `${mark}-up`);
    const lineage = { ownerId: upstream, slug: `${slugFor(mark)}-upstream`, version: "2.1.0" };

    await api.createBundle(primary.db, {
      ownerId,
      slug: slugFor(mark),
      visibility: "public",
      lineage,
    });
    const read = asRecord(await api.getBundle(primary.db, ownerId, slugFor(mark)), "getBundle");
    expect(read.lineage).toEqual(lineage);
  });

  it("stores and returns a private visibility verbatim", async () => {
    const mark = marker("private");
    const ownerId = await owner(primary, mark);
    await api.createBundle(primary.db, { ownerId, slug: slugFor(mark), visibility: "private" });
    const read = asRecord(await api.getBundle(primary.db, ownerId, slugFor(mark)), "getBundle");
    expect(read.visibility).toBe("private");
  });
});

/* --------------------- AC6 --------------------- */

describe("AC6 — two owners may hold the same slug and their records never collide", () => {
  it("AC6: the same slug under two owners yields two distinct records", async () => {
    const mark = marker("ac6");
    const slug = slugFor(mark);
    const first = await owner(primary, `${mark}-1`);
    const second = await owner(primary, `${mark}-2`);

    const a = asRecord(
      await api.createBundle(primary.db, { ownerId: first, slug, visibility: "public" }),
      "createBundle",
    );
    const b = asRecord(
      await api.createBundle(primary.db, { ownerId: second, slug, visibility: "private" }),
      "createBundle",
    );

    expect(a.id).not.toBe(b.id);
    expect(a.ownerId).toBe(first);
    expect(b.ownerId).toBe(second);
    expect(a.slug).toBe(slug);
    expect(b.slug).toBe(slug);
  });

  it("AC6: getBundle reads each owner's record and never the other's", async () => {
    const mark = marker("ac6read");
    const slug = slugFor(mark);
    const first = await owner(primary, `${mark}-1`);
    const second = await owner(primary, `${mark}-2`);

    const a = asRecord(
      await api.createBundle(primary.db, { ownerId: first, slug, visibility: "public" }),
      "createBundle",
    );
    const b = asRecord(
      await api.createBundle(primary.db, { ownerId: second, slug, visibility: "private" }),
      "createBundle",
    );

    const readA = asRecord(await api.getBundle(primary.db, first, slug), "getBundle");
    const readB = asRecord(await api.getBundle(primary.db, second, slug), "getBundle");

    expect(readA.id).toBe(a.id);
    expect(readA.visibility).toBe("public");
    expect(readB.id).toBe(b.id);
    expect(readB.visibility).toBe("private");
  });

  it("AC6: a slug carrying unicode collides for neither owner", async () => {
    /* The unique index is on `(owner_id, slug)` and a store that normalised or case-folded
       a slug on the way in would make two owners' distinct slugs converge. Astral plane and
       a ZWJ sequence, which is where a naive normalisation shows up first. */
    const mark = marker("ac6uni");
    const slug = `${slugFor(mark)}-\u{1F9EA}-\u{1F468}\u{200D}\u{1F4BB}-Ünïcödé`;
    const first = await owner(primary, `${mark}-1`);
    const second = await owner(primary, `${mark}-2`);

    await api.createBundle(primary.db, { ownerId: first, slug, visibility: "public" });
    await api.createBundle(primary.db, { ownerId: second, slug, visibility: "public" });

    const readA = asRecord(await api.getBundle(primary.db, first, slug), "getBundle");
    const readB = asRecord(await api.getBundle(primary.db, second, slug), "getBundle");
    expect(readA.slug).toBe(slug);
    expect(readB.slug).toBe(slug);
    expect(readA.id).not.toBe(readB.id);
  });
});

/* --------------------- one record per (owner, slug): B-06, B-09 --------------------- */

describe("one record per (owner, slug)", () => {
  it("a second createBundle for the same (owner, slug) rejects", async () => {
    const mark = marker("dup");
    const slug = slugFor(mark);
    const ownerId = await owner(primary, mark);

    const first = asRecord(
      await api.createBundle(primary.db, { ownerId, slug, visibility: "public" }),
      "createBundle",
    );

    /* Ruled after this suite reported it as unnamed: the second call **rejects** and never
       returns the existing row. A silent upsert would let T100 decide that a second publish
       is a new release without ever noticing it had made the decision. */
    await expect(
      api.createBundle(primary.db, { ownerId, slug, visibility: "public" }),
      PUBLISHED.duplicateRejects,
    ).rejects.toThrow();

    expect(await countBundles(primary, ownerId, slug)).toBe(1);
    const read = asRecord(await api.getBundle(primary.db, ownerId, slug), "getBundle");
    expect(read.id).toBe(first.id);
    /* And the first record is untouched — a reject that had already applied the second
       call's fields would leave the row changed and the count still one. */
    expect(read.visibility).toBe("public");
    expect(read.createdAt).toEqual(first.createdAt);
  });

  it("a second createBundle rejects even when it differs in visibility and lineage", async () => {
    const mark = marker("dupdiff");
    const slug = slugFor(mark);
    const ownerId = await owner(primary, mark);
    const upstream = await owner(primary, `${mark}-up`);

    await api.createBundle(primary.db, { ownerId, slug, visibility: "public" });
    /* The uniqueness is on `(owner_id, slug)` alone, so a differing payload changes nothing:
       an implementation that only refuses an exact repeat would pass the test above. */
    await expect(
      api.createBundle(primary.db, {
        ownerId,
        slug,
        visibility: "private",
        lineage: { ownerId: upstream, slug: `${slug}-upstream`, version: "1.0.0" },
      }),
      PUBLISHED.duplicateRejects,
    ).rejects.toThrow();

    expect(await countBundles(primary, ownerId, slug)).toBe(1);
    const read = asRecord(await api.getBundle(primary.db, ownerId, slug), "getBundle");
    expect(read.visibility).toBe("public");
    expect("lineage" in read).toBe(false);
  });

  it("eight concurrent createBundle calls for one (owner, slug) leave exactly one record", async () => {
    const mark = marker("race");
    const slug = slugFor(mark);
    const ownerId = await owner(primary, mark);

    const settled = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        api.createBundle(primary.db, { ownerId, slug, visibility: "public" }),
      ),
    );

    expect(await countBundles(primary, ownerId, slug)).toBe(1);
    /* Exactly one caller succeeds and the other seven reject, which is the concurrent form
       of the same ruling. All eight failing would satisfy a row count of one only by
       accident and would make the first publish of a bundle a coin toss; two succeeding
       would mean the loser's write was silently absorbed. */
    expect(settled.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(settled.filter((r) => r.status === "rejected").length).toBe(7);
    const read = asRecord(await api.getBundle(primary.db, ownerId, slug), "getBundle");
    expect(typeof read.id).toBe("string");
  });
});

/* --------------------- absence, and input the contract does not describe --------------------- */

describe("getBundle on what is not there", () => {
  it("answers undefined for a slug no owner holds", async () => {
    const ownerId = await owner(primary, marker("absent"));
    await expect(api.getBundle(primary.db, ownerId, "nothing-was-ever-stored-here")).resolves.toBeUndefined();
  });

  it("answers undefined for the empty slug rather than matching something", async () => {
    const mark = marker("emptyslug");
    const ownerId = await owner(primary, mark);
    await api.createBundle(primary.db, { ownerId, slug: slugFor(mark), visibility: "public" });
    /* An empty string is falsy, and a `where slug = $1` built by string concatenation or a
       guard that treats "" as "no filter" answers this with the row above. */
    await expect(api.getBundle(primary.db, ownerId, "")).resolves.toBeUndefined();
  });

  it("answers undefined for a unicode slug nobody stored", async () => {
    const ownerId = await owner(primary, marker("uniabsent"));
    await expect(
      api.getBundle(primary.db, ownerId, "\u{1F9EA}-nobody-stored-this"),
    ).resolves.toBeUndefined();
  });

  it("does not answer another owner's record when the owner id is not a uuid", async () => {
    const mark = marker("badowner");
    const slug = slugFor(mark);
    const ownerId = await owner(primary, mark);
    const mine = asRecord(
      await api.createBundle(primary.db, { ownerId, slug, visibility: "public" }),
      "createBundle",
    );

    /* `owner_id` is a uuid column, so "not-a-uuid" cannot match anything. Both answers are
       defensible — `undefined`, or a rejection — and the contract names neither, so neither
       is required here. Handing back somebody else's bundle is the one outcome that is not,
       and it is what a lookup that drops an unparseable owner from its predicate does.
       (The stronger "and never quote the caller's input back" is asserted where the
       contract actually binds it: on the digest, in release.test.ts.) */
    const outcome = await Promise.resolve(api.getBundle(primary.db, "not-a-uuid", slug)).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: undefined }),
    );
    expect(outcome.value).toBeUndefined();
    expect(outcome.value).not.toBe(mine.id);
  });

  it("refuses an owner id that does not exist and stores nothing", async () => {
    const mark = marker("ghostowner");
    const slug = slugFor(mark);
    const ghost = "00000000-0000-4000-8000-000000000000";

    await expect(
      api.createBundle(primary.db, { ownerId: ghost, slug, visibility: "public" }),
    ).rejects.toThrow();
    expect(await countBundles(primary, ghost, slug)).toBe(0);
  });
});

/* --------------------- the explicit Db --------------------- */

describe("every function takes an explicit Db", () => {
  it("writes into the database it is handed and no other", async () => {
    const mark = marker("explicitdb");
    const slug = slugFor(mark);
    const inPrimary = await owner(primary, `${mark}-p`);
    const inSecondary = await owner(secondary, `${mark}-s`);

    await api.createBundle(primary.db, { ownerId: inPrimary, slug, visibility: "public" });

    expect(await countBundles(primary, inPrimary, slug)).toBe(1);
    /* Two databases, two accounts, one write. A module-scope client or an implicit
       DATABASE_URL puts the row somewhere neither of these counts can see, and every other
       test in this file still passes. */
    expect(await countBundles(secondary, inSecondary, slug)).toBe(0);
    const [row] = await secondary.query("select count(*)::int as n from bundle");
    expect(Number(row?.n), PUBLISHED.explicitDb).toBe(0);

    await expect(api.getBundle(secondary.db, inPrimary, slug)).resolves.toBeUndefined();
  });

  it("reads from the database it is handed, having written to the other", async () => {
    const mark = marker("explicitread");
    const slug = slugFor(mark);
    const inSecondary = await owner(secondary, mark);

    const written = asRecord(
      await api.createBundle(secondary.db, { ownerId: inSecondary, slug, visibility: "private" }),
      "createBundle",
    );
    const read = asRecord(await api.getBundle(secondary.db, inSecondary, slug), "getBundle");
    expect(read.id).toBe(written.id);
    await expect(api.getBundle(primary.db, inSecondary, slug)).resolves.toBeUndefined();
  });
});
