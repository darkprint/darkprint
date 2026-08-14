import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { compareVersionStrings, parseCardRef } from "@/lib/core";

import {
  anonymous,
  card,
  cardIdFor,
  cards,
  dropScratchDatabases,
  insertAccount,
  marker,
  PUBLISHED,
  scratchDatabase,
  type Cards,
  type Scratch,
} from "./contract";

/* ============================================================
   T020 acceptance criterion 5 — resolution

   (5) a bare id resolves to the newest version, an exact ref to
       that version

   "Newest" is the **highest semver**, not the most recent row.
   `created_at` is insertion time and versions are not inserted in
   order, so the sharp test is a backfill: write `1.1.0`, then write
   `1.0.9`, then ask. It must answer `1.1.0`. A store ordering by
   `created_at desc` answers `1.0.9` and passes every in-order test
   ever written against it.

   Every list also needs a total order — a `, id` tiebreak behind
   the semver comparison — so two reads of one set never disagree.
   T010 shipped `listReleases` without one and it is still an open
   inherited defect.
   ============================================================ */

let api: Cards;
let scratch: Scratch;
let ownerId: string;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    api = await cards();
    scratch = await scratchDatabase();
    ownerId = await insertAccount(scratch, marker("resolve-owner"));
  } catch (cause) {
    setupFailure = cause;
  }
}, 120_000);

beforeEach(() => {
  if (setupFailure !== undefined) throw setupFailure;
});

afterAll(async () => {
  const dropped = await dropScratchDatabases();
  console.log(`t020/resolve teardown: dropped ${dropped} databases`);
}, 120_000);

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${what} produced ${value === null ? "null" : typeof value}; expected a record.`);
  }
  return value as Record<string, unknown>;
}

async function put(id: string, version: string): Promise<Record<string, unknown>> {
  const fixture = card({ id, version });
  return asRecord(
    await api.addCard(scratch.db, {
      cardId: id,
      version,
      ownerId,
      visibility: "public",
      body: fixture.body,
      source: fixture.source,
    }),
    "addCard",
  );
}

describe("AC5 — a bare id resolves to the newest version, an exact ref to that version", () => {
  it("AC5: getLatestCard answers the highest semver, not the most recently written row", async () => {
    const id = cardIdFor("ac5backfill");
    await put(id, "1.1.0");
    /* Written second and lower. `created_at` says this one is newest; semver says it is not,
       and semver is what "latest" means. */
    await put(id, "1.0.9");

    const latest = asRecord(await api.getLatestCard(scratch.db, anonymous, id), "getLatestCard");
    expect(latest.version, PUBLISHED.latestIsSemver).toBe("1.1.0");
  });

  it("AC5: a bare ref resolves to the newest version", async () => {
    const id = cardIdFor("ac5bare");
    await put(id, "2.0.0");
    await put(id, "1.0.0");
    await put(id, "10.0.0");

    /* Ten sorts before two as a string and after it as a semver — the other half of the
       same mistake, and the one a `order by version desc` in SQL makes. */
    const latest = asRecord(await api.getLatestCard(scratch.db, anonymous, id), "getLatestCard");
    expect(latest.version).toBe("10.0.0");
  });

  it("AC5: an exact ref resolves to exactly that version, newest or not", async () => {
    const id = cardIdFor("ac5exact");
    const first = await put(id, "1.0.0");
    await put(id, "3.0.0");

    const resolved = asRecord(
      await api.resolveCardRef(scratch.db, anonymous, `${id}@1.0.0`),
      "resolveCardRef",
    );
    expect(resolved.id).toBe(first.id);
    expect(resolved.version).toBe("1.0.0");
    expect(resolved.source).toBe(first.source);
  });

  it("AC5: an exact ref agrees with getCard for the same version", async () => {
    const id = cardIdFor("ac5agree");
    await put(id, "1.0.0");
    await put(id, "1.2.0");

    for (const version of ["1.0.0", "1.2.0"]) {
      const viaRef = asRecord(
        await api.resolveCardRef(scratch.db, anonymous, `${id}@${version}`),
        "resolveCardRef",
      );
      const viaGet = asRecord(
        await api.getCard(scratch.db, anonymous, id, version),
        "getCard",
      );
      expect(viaRef).toEqual(viaGet);
    }
  });

  it("AC5: prerelease and build versions order by semver, not by string", async () => {
    const id = cardIdFor("ac5pre");
    /* `compareVersionStrings` from `lib/core` is the authority, so the expectation is
       computed from it rather than asserted from memory. */
    const versions = ["1.0.0", "1.0.1", "1.10.0", "1.2.0", "2.0.0"];
    for (const version of versions) await put(id, version);
    const expected = [...versions].sort(compareVersionStrings).at(-1);

    const latest = asRecord(await api.getLatestCard(scratch.db, anonymous, id), "getLatestCard");
    expect(latest.version).toBe(expected);
    expect(latest.version).toBe("2.0.0");
  }, 60_000);

  it("AC5: a ref the grammar refuses resolves to undefined rather than guessing", async () => {
    const id = cardIdFor("ac5badref");
    await put(id, "1.0.0");

    /* `parseCardRef` refuses an unversioned id, `@latest`, and a malformed version, and the
       contract points at it by line. A resolver that fell back to "newest" for `@latest`
       would be inventing a reference form the engine rejects. */
    const candidates = [id, `${id}@latest`, `${id}@`, `@1.0.0`, "", `${id}@v1.0.0`, `${id}@1 0`];
    /* Filtered through the engine rather than asserted from memory. `REF_VERSION` is
       `/^[0-9][0-9A-Za-z.+-]*$/`, looser than semver, so `${id}@1.0` is a reference the
       engine *accepts* — a list written from memory had it here and was wrong. */
    const refused = candidates.filter((ref) => parseCardRef(ref) === undefined);
    expect(refused.length, "the fixtures must be refs the engine itself refuses").toBe(
      candidates.length,
    );
    for (const ref of refused) {
      const outcome = await Promise.resolve(api.resolveCardRef(scratch.db, anonymous, ref)).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, value: String(error) }),
      );
      expect(outcome, `resolveCardRef(${JSON.stringify(ref)})`).toEqual({
        ok: true,
        value: undefined,
      });
    }
  }, 60_000);

  it("AC5: getLatestCard answers undefined for a card id nothing holds", async () => {
    await expect(
      api.getLatestCard(scratch.db, anonymous, cardIdFor("ac5nothing")),
    ).resolves.toBeUndefined();
  });
});

describe("listCardVersions has a total order", () => {
  it("returns every version of the card and nothing from another", async () => {
    const mine = cardIdFor("listmine");
    const other = cardIdFor("listother");
    for (const version of ["1.0.0", "2.0.0", "1.5.0"]) await put(mine, version);
    await put(other, "1.0.0");

    const listed = (await api.listCardVersions(scratch.db, anonymous, mine)) as Record<
      string,
      unknown
    >[];
    expect(listed.map((r) => r.version).sort()).toEqual(["1.0.0", "1.5.0", "2.0.0"]);
    expect(listed.every((r) => r.cardId === mine)).toBe(true);
  }, 60_000);

  it("returns the same order on every read of one unchanged set", async () => {
    const id = cardIdFor("listorder");
    /* Written out of semver order on purpose, so an implementation ordering by insertion
       and one ordering by semver disagree and only one of them is stable. */
    for (const version of ["1.10.0", "1.2.0", "1.0.0", "1.9.0", "2.0.0", "1.1.0"]) {
      await put(id, version);
    }

    const reads = await Promise.all(
      Array.from({ length: 6 }, () => api.listCardVersions(scratch.db, anonymous, id)),
    );
    const orders = reads.map((r) => (r as Record<string, unknown>[]).map((x) => String(x.version)));
    for (const order of orders) {
      expect(order, "two reads of one set must not disagree").toEqual(orders[0]);
    }

    /* And the order is the semver order, in one direction or the other — an unordered
       result that merely happens to be stable is what a missing `order by` looks like on a
       small table, and it stops being stable the day the planner changes. */
    const ascending = [...orders[0]!].sort(compareVersionStrings);
    const descending = [...ascending].reverse();
    expect([ascending, descending], PUBLISHED.latestIsSemver).toContainEqual(orders[0]);
  }, 60_000);

  it("agrees with getLatestCard about which version is newest", async () => {
    const id = cardIdFor("listlatest");
    for (const version of ["1.0.0", "3.1.0", "2.9.9"]) await put(id, version);

    const listed = (await api.listCardVersions(scratch.db, anonymous, id)) as Record<
      string,
      unknown
    >[];
    const highest = [...listed.map((r) => String(r.version))].sort(compareVersionStrings).at(-1);
    const latest = asRecord(await api.getLatestCard(scratch.db, anonymous, id), "getLatestCard");
    /* One notion of "newest", not two. A list ordered by `created_at` beside a latest
       ordered by semver is the drift this pairing catches. */
    expect(latest.version).toBe(highest);
  }, 60_000);
});
