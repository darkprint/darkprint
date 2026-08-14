import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { inferBump, parseCardRef, parseSemver } from "@/lib/core";

import {
  account,
  card,
  cardIdFor,
  cards,
  dropScratchDatabases,
  insertAccount,
  marker,
  ownPropertiesBeyondBuiltins,
  PUBLISHED,
  renderings,
  scratchDatabase,
  uniqueIndexName,
  type Cards,
  type Scratch,
} from "./contract";

/* ============================================================
   T020 acceptance criteria 1, 3 and 6 — the write path

   (1) storing `x@1.0.0` twice with different bytes is refused, not
       overwritten
   (3) a private card failing the version grammar is refused exactly
       as a public one is
   (6) publishing a version whose declared bump is too small is
       refused with the engine's reasons

   plus the two rules the Published signatures block states and no
   criterion does: content that cannot survive storage is refused
   rather than repaired, and no rejection carries the statement, its
   parameters, the caller's source or a SQLSTATE.
   ============================================================ */

let api: Cards;
let scratch: Scratch;
let ownerId: string;
let setupFailure: unknown;

beforeAll(async () => {
  try {
    api = await cards();
    scratch = await scratchDatabase();
    ownerId = await insertAccount(scratch, marker("write-owner"));
  } catch (cause) {
    setupFailure = cause;
  }
}, 120_000);

beforeEach(() => {
  if (setupFailure !== undefined) throw setupFailure;
});

afterAll(async () => {
  const dropped = await dropScratchDatabases();
  console.log(`t020/write teardown: dropped ${dropped} databases`);
}, 120_000);

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${what} produced ${value === null ? "null" : typeof value}; expected a record.`);
  }
  return value as Record<string, unknown>;
}

interface Outcome {
  ok: boolean;
  value?: unknown;
  error?: unknown;
}

async function attempt(promise: unknown): Promise<Outcome> {
  return Promise.resolve(promise).then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );
}

async function countRows(cardId: string): Promise<number> {
  const [row] = await scratch.query(
    "select count(*)::int as n from card_version where card_id = $1",
    [cardId],
  );
  return Number(row?.n);
}

async function store(
  fixture: { cardId: string; version: string; source: string; body: unknown },
  visibility: "public" | "private" = "public",
): Promise<Record<string, unknown>> {
  return asRecord(
    await api.addCard(scratch.db, {
      cardId: fixture.cardId,
      version: fixture.version,
      ownerId,
      visibility,
      body: fixture.body,
      source: fixture.source,
    }),
    "addCard",
  );
}

/* --------------------- AC1 --------------------- */

describe("AC1 — one immutable document per (id, version)", () => {
  it("AC1: storing the same (id, version) twice with different bytes is refused", async () => {
    const id = cardIdFor("ac1");
    const first = card({ id, notes: "the first bytes" });
    const second = card({ id, notes: "different bytes entirely" });
    expect(second.source).not.toBe(first.source);

    await store(first);
    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body: second.body,
        source: second.source,
      }),
    );

    expect(outcome.ok, "a second write to one (id, version) must be refused").toBe(false);
    expect(await countRows(id)).toBe(1);
  });

  it("AC1: the refused write leaves the original bytes exactly as they were", async () => {
    const id = cardIdFor("ac1keep");
    const first = card({ id, notes: "original" });
    const second = card({ id, notes: "overwrite attempt" });

    await store(first);
    await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body: second.body,
        source: second.source,
      }),
    );

    /* "Refused, not overwritten" is two claims and the row count only proves the first.
       A store that deleted-then-inserted, or updated in place and then threw, satisfies the
       count and loses the original. */
    const read = asRecord(await api.getCard(scratch.db, account(ownerId), id, "1.0.0"), "getCard");
    expect(read.source).toBe(first.source);
    expect(read.digest).toBe(first.digest);
  });

  it("AC1: a second write with byte-identical content is still refused", async () => {
    const id = cardIdFor("ac1same");
    const fixture = card({ id });
    await store(fixture);
    /* "A published version is never edited in place" has no exception for a write that
       happens to agree. An upsert that no-ops on identical bytes would pass every other
       test in this file. */
    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body: fixture.body,
        source: fixture.source,
      }),
    );
    expect(outcome.ok).toBe(false);
    expect(await countRows(id)).toBe(1);
  });

  it("AC1: the conflict names the constraint, and the literal matches the schema's", async () => {
    const id = cardIdFor("ac1named");
    const fixture = card({ id });
    await store(fixture);
    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body: fixture.body,
        source: fixture.source,
      }),
    );

    expect(outcome.ok).toBe(false);
    /* Read from `lib/db/schema.ts` at runtime rather than restated here: the contract asks
       that the module's literal be tied to the schema's, and a test hard-coding the string a
       fourth time would drift with them instead of catching the drift. */
    const expected = uniqueIndexName();
    expect(expected).toBe("card_version_id_version_key");
    const message = String((outcome.error as { message?: unknown })?.message ?? "");
    expect(message, `the conflict must name ${expected}`).toContain(expected);
  });

  it("AC1: eight concurrent writes of one (id, version) leave exactly one row", async () => {
    const id = cardIdFor("ac1race");
    const fixture = card({ id });
    const settled = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        api.addCard(scratch.db, {
          cardId: id,
          version: "1.0.0",
          ownerId,
          visibility: "public",
          body: fixture.body,
          source: fixture.source,
        }),
      ),
    );

    expect(await countRows(id)).toBe(1);
    expect(settled.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(settled.filter((r) => r.status === "rejected").length).toBe(7);
  }, 60_000);
});

/* --------------------- AC3 --------------------- */

describe("AC3 — a private card is validated exactly as a public one", () => {
  /* Ruled after this suite reported the gap: **`addCard` requires a strict semver**, which is
     narrower than `REF_VERSION`. The two grammars answer different questions and only one of
     them mints — citing a version may stay loose, storing one may not, because `compareSemver`
     cannot order `1.0` and a single stored non-semver leaves "latest" undefined for that id
     forever. So the write-side list is filtered through `parseSemver`, not `parseCardRef`, and
     it is deliberately wider than the reference grammar's. Asked of the engine rather than
     remembered: a list written from memory is what got this wrong the first time. */
  const BAD_VERSIONS = [
    "latest",
    "",
    " ",
    "v1.0.0",
    "1,0,0",
    "1 0 0",
    "one.0.0",
    "-1.0.0",
    /* Valid references, and not semvers. These are the four the ruling added. */
    "1.0",
    "1",
    "1.0.0.0",
    "01.0.0",
  ].filter((v) => parseSemver(v) === undefined);

  it("AC3: the malformed-version fixtures are ones the engine's own semver parser refuses", () => {
    expect(BAD_VERSIONS.length).toBeGreaterThanOrEqual(10);
    for (const version of BAD_VERSIONS) {
      expect(parseSemver(version), JSON.stringify(version)).toBeUndefined();
    }
  });

  it("AC3: the write grammar is strictly narrower than the reference grammar", () => {
    /* The ruling's whole content, stated as a property rather than as a list: there are
       versions the reference grammar accepts and the write grammar must not. If these two
       ever became the same grammar, every test below would still pass and the ruling would
       have been quietly undone. */
    const refsAcceptSemversRefuse = BAD_VERSIONS.filter(
      (v) => parseCardRef(`a-card@${v}`) !== undefined,
    );
    expect(refsAcceptSemversRefuse).toEqual(
      expect.arrayContaining(["1.0", "1", "1.0.0.0", "01.0.0"]),
    );
  });

  it("AC3: every malformed version is refused for a public card", async () => {
    for (const version of BAD_VERSIONS) {
      const id = cardIdFor("ac3pub");
      const fixture = card({ id });
      const outcome = await attempt(
        api.addCard(scratch.db, {
          cardId: id,
          version,
          ownerId,
          visibility: "public",
          body: fixture.body,
          source: fixture.source,
        }),
      );
      expect(outcome.ok, `public card with version ${JSON.stringify(version)}`).toBe(false);
      expect(await countRows(id)).toBe(0);
    }
  }, 60_000);

  it("AC3: every malformed version is refused for a private card, identically", async () => {
    for (const version of BAD_VERSIONS) {
      const id = cardIdFor("ac3priv");
      const fixture = card({ id });
      const outcome = await attempt(
        api.addCard(scratch.db, {
          cardId: id,
          version,
          ownerId,
          visibility: "private",
          body: fixture.body,
          source: fixture.source,
        }),
      );
      expect(outcome.ok, `private card with version ${JSON.stringify(version)}`).toBe(false);
      expect(await countRows(id)).toBe(0);
    }
  }, 60_000);

  it("AC3: the two refusals are the same refusal, not merely both failures", async () => {
    const publicId = cardIdFor("ac3shapepub");
    const privateId = cardIdFor("ac3shapepriv");
    const asPublic = await attempt(
      api.addCard(scratch.db, {
        cardId: publicId,
        version: "latest",
        ownerId,
        visibility: "public",
        body: card({ id: publicId }).body,
        source: card({ id: publicId }).source,
      }),
    );
    const asPrivate = await attempt(
      api.addCard(scratch.db, {
        cardId: privateId,
        version: "latest",
        ownerId,
        visibility: "private",
        body: card({ id: privateId }).body,
        source: card({ id: privateId }).source,
      }),
    );

    expect(asPublic.ok).toBe(false);
    expect(asPrivate.ok).toBe(false);
    /* "Refused exactly as a public one is": same kind of error, same own-property shape.
       A private card refused through a different path — a policy denial, say, or a generic
       500 — would satisfy "both rejected" and break B-07's "validated identically". */
    const a = asPublic.error as object;
    const b = asPrivate.error as object;
    expect(a.constructor.name).toBe(b.constructor.name);
    expect(ownPropertiesBeyondBuiltins(a)).toEqual(ownPropertiesBeyondBuiltins(b));
    /* And each names the version it was handed, which is the caller's own identifier. */
    expect(String((a as { message?: unknown }).message)).toContain("latest");
    expect(String((b as { message?: unknown }).message)).toContain("latest");
  });

  it("AC3: a malformed card id is refused for both visibilities", async () => {
    /* The other half of the grammar. `CARD_ID` is lowercase alphanumerics with single
       hyphens, optionally namespaced — an uppercase, spaced or `@`-carrying id is not one. */
    const badIds = ["Not-Lower", "has space", "trailing-", "-leading", "double--hyphen", "", "a@b"];
    for (const visibility of ["public", "private"] as const) {
      for (const cardId of badIds) {
        const fixture = card({ id: cardIdFor("ac3badid") });
        const outcome = await attempt(
          api.addCard(scratch.db, {
            cardId,
            version: "1.0.0",
            ownerId,
            visibility,
            body: fixture.body,
            source: fixture.source,
          }),
        );
        expect(outcome.ok, `${visibility} card with id ${JSON.stringify(cardId)}`).toBe(false);
      }
    }
  }, 60_000);
});

/* --------------------- AC6 --------------------- */

describe("AC6 — a declared bump smaller than the change is refused", () => {
  it("AC6: a patch declared over a major change is refused, naming the engine's reasons", async () => {
    const id = cardIdFor("ac6");
    const before = card({ id, version: "1.0.0", outputType: "json" });
    /* Changing an output's type is major (`lib/core/version/bump.ts`), and `1.0.1` declares
       a patch. The engine's own reasons are computed here so the assertion is against what
       `lib/core` says rather than against a sentence this test invented. */
    const after = card({ id, version: "1.0.1", outputType: "report" });
    const analysis = inferBump(before.body, after.body);
    expect(analysis.level).toBe("major");
    expect(analysis.reasons.length).toBeGreaterThan(0);

    await store(before);
    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.1",
        ownerId,
        visibility: "public",
        body: after.body,
        source: after.source,
      }),
    );

    expect(outcome.ok, "a patch over a major change must be refused").toBe(false);
    expect(await countRows(id)).toBe(1);
    const message = String((outcome.error as { message?: unknown })?.message ?? "");
    for (const reason of analysis.reasons) {
      expect(message, "the refusal carries the engine's own reasons").toContain(reason);
    }
  });

  it("AC6: the same change declared as a major is accepted", async () => {
    const id = cardIdFor("ac6ok");
    const before = card({ id, version: "1.0.0", outputType: "json" });
    const after = card({ id, version: "2.0.0", outputType: "report" });

    await store(before);
    /* The half that keeps the refusal honest: a store that refused every second version
       would pass the test above and fail here. */
    const record = await store(after);
    expect(record.version).toBe("2.0.0");
    expect(await countRows(id)).toBe(2);
  });

  it("AC6: a minor declared over a minor change is accepted", async () => {
    const id = cardIdFor("ac6minor");
    const before = card({ id, version: "1.0.0" });
    const after = card({ id, version: "1.1.0", notes: "a note added, which is not major" });
    const analysis = inferBump(before.body, after.body);
    expect(["minor", "patch"]).toContain(analysis.level);

    await store(before);
    const record = await store(after);
    expect(record.version).toBe("1.1.0");
  });

  it("AC6: the chain is checked against the whole history, not only the newest row", async () => {
    const id = cardIdFor("ac6chain");
    await store(card({ id, version: "1.0.0", outputType: "json" }));
    await store(card({ id, version: "2.0.0", outputType: "report" }));
    /* A backfill between two existing versions. Checking only against the newest row would
       compare `1.0.1` to `2.0.0` and miss that it is a major change from `1.0.0`. */
    const backfill = card({ id, version: "1.0.1", outputType: "plan" });
    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.1",
        ownerId,
        visibility: "public",
        body: backfill.body,
        source: backfill.source,
      }),
    );
    expect(outcome.ok, "a backfilled patch that is a major change from its predecessor").toBe(false);
    expect(await countRows(id)).toBe(2);
  });
});

/* --------------------- refused, not repaired --------------------- */

describe("content that cannot survive storage is refused, not repaired", () => {
  const LONE_SURROGATE = "\uD800";

  it("refuses a lone surrogate in `source` rather than replacing it", async () => {
    const id = cardIdFor("illsource");
    const fixture = card({ id });
    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body: fixture.body,
        source: `${fixture.source}# ${LONE_SURROGATE}\n`,
      }),
    );
    /* `pg` encodes parameters as UTF-8 and an unpaired surrogate has no UTF-8 encoding, so
       it is silently replaced with U+FFFD — storing a digest that names bytes the row does
       not hold. Refusal is the only outcome that keeps the identity honest. */
    expect(outcome.ok, PUBLISHED.refuseNotRepair).toBe(false);
    expect(await countRows(id)).toBe(0);
  });

  /* Measured, not assumed. `pg` sends a `text` parameter as UTF-8 and an unpaired surrogate
     has no UTF-8 encoding, so it arrives as U+FFFD and the write *succeeds* with bytes the
     digest does not name — `select $1::text` with "a\uD800b" reads back "a\uFFFDb". A jsonb
     parameter goes the other way: Postgres refuses an unpaired `\uD800` escape itself. So of
     the three tests below only the first falsifies the module's own guard; the other two
     assert the criterion's outcome and would pass against a module with no check at all,
     because the driver refuses them first. Said here rather than left implied — an
     unfalsifiable guard described as a guard is how a future reader comes to rely on
     nothing. */
  it("refuses a lone surrogate nested inside `body`", async () => {
    const id = cardIdFor("illbody");
    const fixture = card({ id });
    const body = structuredClone(fixture.body) as unknown as {
      outputs: { description: string }[];
    };
    body.outputs[0]!.description = `The fixture result ${LONE_SURROGATE}`;

    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body,
        source: fixture.source,
      }),
    );
    expect(outcome.ok, "every string reachable inside `body` is checked").toBe(false);
    expect(await countRows(id)).toBe(0);
  });

  it("refuses a lone surrogate 20 000 levels deep without a RangeError", async () => {
    const id = cardIdFor("illdeep");
    const fixture = card({ id });
    const body = structuredClone(fixture.body) as unknown as {
      params?: Record<string, unknown>;
    };
    let deep: Record<string, unknown> = { leaf: `bottom ${LONE_SURROGATE}` };
    for (let i = 0; i < 20_000; i += 1) deep = { next: deep };
    body.params = { ...(body.params ?? {}), deep };

    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body,
        source: fixture.source,
      }),
    );

    /* T010 shipped a recursive walk that handled cycles and still died with `RangeError` at
       20 000 deep, and a 120 KB request body reaches that depth. Two claims here: the walk
       reaches the bottom (so the ill-formed leaf is found and the write refused), and it
       gets there without exhausting the stack. */
    expect(outcome.ok).toBe(false);
    const error = outcome.error;
    expect(error).not.toBeInstanceOf(RangeError);
    expect(String((error as { message?: unknown })?.message ?? "")).not.toMatch(
      /maximum call stack/i,
    );
    expect(await countRows(id)).toBe(0);
  }, 60_000);

  it("answers a cyclic body without hanging or crashing", async () => {
    const id = cardIdFor("illcycle");
    const fixture = card({ id });
    const body = structuredClone(fixture.body) as unknown as { params?: Record<string, unknown> };
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    body.params = { ...(body.params ?? {}), cycle };

    const outcome = await attempt(
      api.addCard(scratch.db, {
        cardId: id,
        version: "1.0.0",
        ownerId,
        visibility: "public",
        body,
        source: fixture.source,
      }),
    );
    /* A module whose job is to decide cannot answer by crashing. Refusing is the expected
       answer — a cycle has no jsonb encoding — but the assertion that matters is that it is
       an answer at all, and not a `RangeError` reaching a route as a 500. */
    expect(outcome.ok).toBe(false);
    expect(outcome.error).not.toBeInstanceOf(RangeError);
    expect(await countRows(id)).toBe(0);
  }, 60_000);

  it("accepts shared substructure, which is not a cycle", async () => {
    const id = cardIdFor("shared");
    const fixture = card({ id });
    const body = structuredClone(fixture.body) as unknown as { params?: Record<string, unknown> };
    const shared = { a: 1, b: "two" };
    body.params = { ...(body.params ?? {}), left: shared, right: shared };

    /* The path-scoped half of cycle detection. A seen-set that never forgets treats the
       second reference to `shared` as a cycle and refuses a perfectly storable document. */
    const record = await store({ ...fixture, body });
    expect(record.version).toBe("1.0.0");
    const read = asRecord(await api.getCard(scratch.db, account(ownerId), id, "1.0.0"), "getCard");
    expect((read.body as { params: { left: unknown; right: unknown } }).params.left).toEqual(shared);
    expect((read.body as { params: { left: unknown; right: unknown } }).params.right).toEqual(shared);
  }, 60_000);
});

/* --------------------- no rejection carries the statement --------------------- */

describe("no rejection carries the statement, its parameters, the source or a SQLSTATE", () => {
  const SQLSTATES = ["23505", "23503", "22021", "22P02"];
  /* `pg` internals a driver error drags along. */
  const PG_INTERNALS = ["severity", "routine", "sqlstate", "detail:", "schema:", "where:"];
  /* Tells of the *statement*, not of the schema. `card_version` is deliberately absent:
     AC1 requires the conflict to name `card_version_id_version_key`, so the table name is
     inside a string the contract asks for. Falsifying against a correct implementation is
     what surfaced that — a blunter list called the required constraint name a leak. */
  const STATEMENT_TELLS = ["insert into", "values (", "returning", "$1", "$2", "select "];

  /** Every failure mode the contract enumerates, each with a marker planted in the source. */
  async function failures(): Promise<{ label: string; error: unknown; secret: string }[]> {
    const out: { label: string; error: unknown; secret: string }[] = [];

    const dupId = cardIdFor("leakdup");
    const dupSecret = `SECRET-DUP-${marker("s")}`;
    const dup = card({ id: dupId, notes: dupSecret });
    await store(dup);
    out.push({
      label: "duplicate (id, version), 23505",
      secret: dupSecret,
      error: (
        await attempt(
          api.addCard(scratch.db, {
            cardId: dupId,
            version: "1.0.0",
            ownerId,
            visibility: "public",
            body: dup.body,
            source: dup.source,
          }),
        )
      ).error,
    });

    const fkSecret = `SECRET-FK-${marker("s")}`;
    const fk = card({ id: cardIdFor("leakfk"), notes: fkSecret });
    out.push({
      label: "owner_id references nothing, 23503",
      secret: fkSecret,
      error: (
        await attempt(
          api.addCard(scratch.db, {
            cardId: fk.cardId,
            version: "1.0.0",
            ownerId: "00000000-0000-4000-8000-000000000000",
            visibility: "public",
            body: fk.body,
            source: fk.source,
          }),
        )
      ).error,
    });

    const uuidSecret = `SECRET-UUID-${marker("s")}`;
    const uuid = card({ id: cardIdFor("leakuuid"), notes: uuidSecret });
    out.push({
      label: "owner_id is not a uuid, 22P02",
      secret: uuidSecret,
      error: (
        await attempt(
          api.addCard(scratch.db, {
            cardId: uuid.cardId,
            version: "1.0.0",
            ownerId: "not-a-uuid",
            visibility: "public",
            body: uuid.body,
            source: uuid.source,
          }),
        )
      ).error,
    });

    const nulSecret = `SECRET-NUL-${marker("s")}`;
    const nul = card({ id: cardIdFor("leaknul"), notes: nulSecret });
    out.push({
      label: "a NUL byte in source, 22021",
      secret: nulSecret,
      error: (
        await attempt(
          api.addCard(scratch.db, {
            cardId: nul.cardId,
            version: "1.0.0",
            ownerId,
            visibility: "public",
            body: nul.body,
            source: `${nul.source}# \u0000\n`,
          }),
        )
      ).error,
    });

    return out;
  }

  it("every failure mode rejects with an Error and nothing raw escapes", async () => {
    for (const { label, error } of await failures()) {
      expect(error, `${label} must reject`).toBeInstanceOf(Error);
      /* A `DrizzleQueryError` opens with the whole INSERT and every bound parameter. The
         re-throw has to stay — a database-down must not be swallowed as a conflict — but it
         carries a safe message with the driver error as `cause`. */
      expect((error as Error).constructor.name, label).not.toMatch(/DrizzleQueryError/);
    }
  }, 120_000);

  it("no rendering of any rejection leaks the statement, parameters, source or SQLSTATE", async () => {
    for (const { label, error, secret } of await failures()) {
      /* `JSON.stringify({ detail: err.message })` is the fifth rendering the rule names — it
         is what `problem.ts` does with a message on its way into a response body. */
      const all = [
        ...renderings(error),
        {
          label: "JSON.stringify({ detail: err.message })",
          text: JSON.stringify({ detail: (error as { message?: unknown })?.message }),
        },
      ];
      for (const { label: how, text } of all) {
        const where = `${label} via ${how}`;
        expect(text, `${where} leaked the caller's card source`).not.toContain(secret);
        for (const tell of STATEMENT_TELLS) {
          expect(text.toLowerCase(), `${where} leaked the statement`).not.toContain(
            tell.toLowerCase(),
          );
        }
        for (const state of SQLSTATES) {
          expect(text, `${where} leaked a SQLSTATE`).not.toContain(state);
        }
        for (const internal of PG_INTERNALS) {
          expect(text.toLowerCase(), `${where} leaked a pg internal`).not.toContain(internal);
        }
      }
    }
  }, 120_000);

  it("carries no own properties beyond message and cause, and cause is not enumerable", async () => {
    for (const { label, error } of await failures()) {
      const err = error as object;
      /* Amended after this suite reported the old wording as unsatisfiable: `stack` is an own
         property of every `new Error()` in V8, so "own properties exactly ['message','cause']"
         could only be met by deleting it. The rule now asks for what it was always reaching
         for, and this asserts each clause of it. */
      expect(
        ownPropertiesBeyondBuiltins(err).filter((k) => k !== "cause"),
        `${label} carries own properties the rule does not allow`,
      ).toEqual([]);
      /* `stack` is retained, not deleted — a real failure keeps its trace. */
      expect(Object.hasOwn(err, "stack"), `${label} deleted its stack`).toBe(true);
      expect(String((err as Error).stack ?? "").length).toBeGreaterThan(0);
      if (Object.hasOwn(err, "cause")) {
        /* Checked with `propertyIsEnumerable`, never inferred. */
        expect(
          err.propertyIsEnumerable("cause"),
          `${label}: cause must be non-enumerable so JSON.stringify cannot reach it`,
        ).toBe(false);
      }
      expect(Object.keys(err), `${label} has enumerable own properties`).toEqual([]);
      expect(JSON.stringify(err), `${label} serialises to something`).toBe("{}");
      expect(PUBLISHED.errorsCarryNothing.length).toBeGreaterThan(0);
    }
  }, 120_000);
});
