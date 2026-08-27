/* ============================================================
   The key lifecycle, driven through a recording stub rather than
   a database, so it runs off-slot.

   What a stub can and cannot answer is stated rather than
   implied. It CAN answer what each function builds, that the
   secret never reaches a record, that a malformed secret is
   refused before anything is hashed, and that the refusals which
   must be indistinguishable are. It CANNOT answer whether the
   unique index on `token_hash` holds, whether `revoked_at IS
   NULL` narrows the way Postgres narrows it, or what a driver
   fault renders as — those need the real driver and are owed on
   the gate slot.

   Every control character here comes from
   `tests/support/control-bytes.ts` or from `String.fromCodePoint`.
   None is typed. T-01 fired on this file THREE times while it was
   being written, prevented by the tool layer rather than detected
   by any guard here — occurrences nine, ten and eleven, and all
   three were the same reflex the fixture exists to remove: an
   author reaching for the byte because the escape felt like more
   typing than the character.
   ============================================================ */

import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { LONE_HIGH_SURROGATE, NUL, nulInside } from "@/tests/support/control-bytes";
import { InvalidLabelError, NotKeyOwnerError } from "./errors";
import { MAX_LABEL_LENGTH, issueKey, listKeys, resolveKey, revokeKey } from "./keys";
import { SECRET_LENGTH, SECRET_PREFIX, hashSecret } from "./secret";

const OWNER = {
  kind: "account" as const,
  accountId: "11111111-1111-4111-8111-111111111111",
  handle: "berti",
};
const KEY_ID = "22222222-2222-4222-8222-222222222222";
const WELL_FORMED = `${SECRET_PREFIX}${"A".repeat(SECRET_LENGTH - SECRET_PREFIX.length)}`;

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: KEY_ID,
    accountId: OWNER.accountId,
    tokenHash: "a".repeat(64),
    label: "CI",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    revokedAt: null,
    ...overrides,
  };
}

/** A `Db` that records the calls made on it and answers with whatever rows it was given. */
function stubDb(rows: readonly unknown[] = []) {
  const calls: string[] = [];
  let written: unknown;
  const db = {
    insert: () => {
      calls.push("insert");
      return {
        values: (v: unknown) => {
          calls.push("values");
          written = v;
          return { returning: async () => rows };
        },
      };
    },
    update: () => {
      calls.push("update");
      return {
        set: (v: unknown) => {
          calls.push(`set:${Object.keys(v as object).sort().join(",")}`);
          written = v;
          return {
            where: async () => {
              calls.push("where");
            },
          };
        },
      };
    },
    select: () => {
      calls.push("select");
      return {
        from: () => ({
          where: () => {
            calls.push("where");
            /* Both chains, because `resolveKey` ends in `.limit()` and `listKeys` ends in
               `.orderBy()`. A stub answering only the shape the test author was thinking of
               is a stub that reports a missing call as a crash. */
            return { limit: async () => rows, orderBy: async () => rows };
          },
        }),
      };
    },
  } as unknown as Db;
  return { db, calls: () => calls, written: () => written };
}

describe("issueKey", () => {
  it("returns the secret once, and the record has no field that could carry one", async () => {
    const { db } = stubDb([row()]);
    const { record, secret } = await issueKey(db, OWNER, OWNER.accountId, "CI");

    /* The block asks for exactly this: *a test asserts `ApiKeyRecord`'s key set excludes any
       secret-bearing field*. Written as an EQUALITY over the whole key set rather than as
       four `not.toHaveProperty` checks, because a blacklist of the fields somebody thought of
       is a site list one level down — an equality reds on a field nobody enumerated. */
    expect(Object.keys(record).sort()).toEqual([
      "accountId",
      "createdAt",
      "keyId",
      "label",
      "revokedAt",
    ]);
    expect(secret.startsWith(SECRET_PREFIX)).toBe(true);
    expect(secret).toHaveLength(SECRET_LENGTH);
  });

  it("stores the hash and never the secret", async () => {
    const { db, written } = stubDb([row()]);
    const { secret } = await issueKey(db, OWNER, OWNER.accountId, "CI");
    expect((written() as { tokenHash: string }).tokenHash).toBe(hashSecret(secret));
    /* The stronger half: no value written anywhere in the insert IS the secret. A `tokenHash`
       assertion alone would pass an implementation that also wrote the secret to a second
       column. */
    expect(JSON.stringify(written())).not.toContain(secret);
  });

  it("mints a different secret every time", async () => {
    const { db } = stubDb([row()]);
    const first = await issueKey(db, OWNER, OWNER.accountId, "CI");
    const second = await issueKey(db, OWNER, OWNER.accountId, "CI");
    expect(first.secret).not.toBe(second.secret);
  });

  it("refuses a foreign account before validating anything else", async () => {
    const { db, calls } = stubDb([row()]);
    /* Authorization first, T050's order: a caller who is not this account's owner learns
       nothing else — not whether the account exists, not whether the label would have
       validated. The label here is invalid too, so the CLASS is what says which check ran
       first, and the empty call list is what says neither reached the store. */
    await expect(
      issueKey(db, OWNER, "33333333-3333-4333-8333-333333333333", " "),
    ).rejects.toBeInstanceOf(NotKeyOwnerError);
    expect(calls()).toEqual([]);
  });

  it("refuses an anonymous actor", async () => {
    const { db } = stubDb([row()]);
    await expect(issueKey(db, { kind: "anonymous" }, OWNER.accountId, "CI")).rejects.toBeInstanceOf(
      NotKeyOwnerError,
    );
  });
});

describe("the label bound REFUSES rather than truncating", () => {
  it("accepts a label of exactly MAX_LABEL_LENGTH", async () => {
    /* D-70-17's shape: the number is safe because it is allocated through the published
       surface, so raising it past what the column should hold reds here rather than reaching
       a user. Every bound owes both ends and this is the saturation half. */
    const { db, written } = stubDb([row()]);
    await issueKey(db, OWNER, OWNER.accountId, "x".repeat(MAX_LABEL_LENGTH));
    expect((written() as { label: string }).label).toHaveLength(MAX_LABEL_LENGTH);
  });

  it("refuses one character past it, and stores nothing", async () => {
    const { db, calls } = stubDb([row()]);
    await expect(
      issueKey(db, OWNER, OWNER.accountId, "x".repeat(MAX_LABEL_LENGTH + 1)),
    ).rejects.toBeInstanceOf(InvalidLabelError);
    /* The collapse half, and the point of the pair: an implementation that TRUNCATED would
       store a 100-character label here and the assertion above would still be green. This is
       the one that separates refusing from truncating. */
    expect(calls()).toEqual([]);
  });

  it("refuses an empty or whitespace-only label", async () => {
    const { db } = stubDb([row()]);
    for (const label of ["", "   ", "\t\n"]) {
      await expect(
        issueKey(db, OWNER, OWNER.accountId, label),
        JSON.stringify(label),
      ).rejects.toBeInstanceOf(InvalidLabelError);
    }
  });

  it("refuses control characters, so a NUL is a 400 rather than a sanitized 500", async () => {
    /* Postgres `text` cannot hold a NUL and refuses it with 22021, so without this clause the
       label would reach the driver, raise, and be sanitized into a store failure — a 500 for
       what is plainly a caller's mistake.

       `nulInside` rather than a trailing byte: a check reading only the ends would pass a NUL
       in the middle, which is where the fixture puts it on purpose. The last two are a C1
       control and a line separator, built with `String.fromCodePoint` so the source stays
       ASCII — a C0-only predicate passes both and this is what separates them. */
    const { db } = stubDb([row()]);
    const labels = [
      nulInside("CI"),
      `CI${NUL}`,
      `CI${LONE_HIGH_SURROGATE}tail`,
      `CI${String.fromCodePoint(0x9f)}tail`,
      `CI${String.fromCodePoint(0x2028)}tail`,
    ];
    for (const label of labels) {
      await expect(
        issueKey(db, OWNER, OWNER.accountId, label),
        JSON.stringify(label),
      ).rejects.toBeInstanceOf(InvalidLabelError);
    }
  });

  it("a TRAILING line separator is trimmed away rather than refused, and that is correct", async () => {
    /* The separator cells above put the character INSIDE, and the first version of this file
       put two of them at the end. One of those reddened against correct code, and the reason
       is the eighth reading of a zero arriving in a fixture: **`trim()` removes U+2028 and
       U+2029, because they are LineTerminators and not merely whitespace** — so the predicate
       never saw the character and the input carried no decision for the code to make.

       Kept as its own cell rather than deleted, because the boundary is worth stating: a
       TRAILING separator is normalised, an INTERIOR one is refused, and those are different
       answers for a good reason. Nothing lands in the column that the caller did not choose,
       which is what the refusal is protecting. Note the asymmetry the same probe found:
       U+009F is neither whitespace nor a LineTerminator, so it is NOT trimmed at either
       position and is refused at both — the two classes look alike and `trim()` treats them
       differently. */
    const { db, written } = stubDb([row()]);
    await issueKey(db, OWNER, OWNER.accountId, `CI${String.fromCodePoint(0x2028)}`);
    expect((written() as { label: string }).label).toBe("CI");
  });

  it("accepts a WELL-PAIRED astral character, so the surrogate clause is not over-broad", async () => {
    /* The discriminator against the plausible wrong fix, and it is the reason this cell
       exists rather than coverage. The surrogate clause was added because a LONE surrogate
       has no UTF-8 encoding and `pg` silently rewrites it — and the obvious way to write it
       is "refuse any code unit in 0xD800..0xDFFF", which also refuses every emoji, every
       CJK extension character and every musical symbol. **Every one of the refusal cells
       above passes under that wrong fix.**

       `for...of` iterates by code point, so a well-formed pair arrives as one value above
       0xFFFF and never in the surrogate range. This is what measures that, rather than the
       comment claiming it. Falsify by collapse and by saturation — the refusals are the
       collapse half and this is the saturation half. */
    const { db, written } = stubDb([row()]);
    await issueKey(db, OWNER, OWNER.accountId, `CI ${String.fromCodePoint(0x1f600)} build`);
    expect((written() as { label: string }).label).toBe(
      `CI ${String.fromCodePoint(0x1f600)} build`,
    );
  });

  it("names the field and never the value", async () => {
    const { db } = stubDb([row()]);
    /* The label has to be INVALID for there to be a message, and it has to carry a
       distinctive string for "never the value" to be observable. The first version of this
       cell had neither: it handed a perfectly VALID label and expected a rejection, so it
       reddened against correct code and would have gone green against a module that refused
       everything. A refusal test whose input is accepted is testing nothing about the
       wording.

       `nulInside` puts the NUL in the middle, where a check reading only the ends would miss
       it, and leaves the distinctive text on both sides of it. */
    const value = "a-distinctive-label-value";
    /* The expected message is a LITERAL. A test that builds its expectation from the module
       under test asserts that the module agrees with itself, and passes unchanged the day the
       wording starts interpolating the value it is refusing. */
    await expect(issueKey(db, OWNER, OWNER.accountId, nulInside(value))).rejects.toThrow(
      new InvalidLabelError("issueKey: `label` is not valid."),
    );

    /* The absence half, asserted separately: equality with the published form already
       entails it, and asserting it in its own right is what fails LOUDLY on a wording that
       starts interpolating rather than failing as a string mismatch nobody reads closely.

       Two-armed `then` rather than `.catch`, and the arm that resolves is the point: a
       `.catch` narrowing to `Error` types the resolved value as an error too, so a module
       that ACCEPTED this label would reach the assertion below with a record in hand and
       `undefined` for `.message` — which `not.toContain` passes. The resolve arm answering
       `undefined` plus the `instanceof` is what makes the absence check reachable only
       through an actual rejection. */
    const raised = await issueKey(db, OWNER, OWNER.accountId, nulInside(value)).then(
      () => undefined,
      (err: unknown) => err,
    );
    expect(raised).toBeInstanceOf(InvalidLabelError);
    expect((raised as Error).message).not.toContain(value);
  });
});

describe("resolveKey", () => {
  it("answers the record for a live key", async () => {
    const { db } = stubDb([row()]);
    expect(await resolveKey(db, WELL_FORMED)).toMatchObject({
      keyId: KEY_ID,
      accountId: OWNER.accountId,
      label: "CI",
    });
  });

  it("refuses a malformed secret WITHOUT reaching the database", async () => {
    /* D-40-B at the authentication surface: hashing unbounded unauthenticated input in order
       to decide it is worthless. The empty call list is the measurement — a shape check that
       ran after the query would leave `select` in it. */
    const { db, calls } = stubDb([row()]);
    expect(await resolveKey(db, `${SECRET_PREFIX}${"A".repeat(10_000_000)}`)).toBeUndefined();
    expect(await resolveKey(db, "")).toBeUndefined();
    expect(await resolveKey(db, "not-a-key")).toBeUndefined();
    expect(await resolveKey(db, `${SECRET_PREFIX}${"!".repeat(43)}`)).toBeUndefined();
    expect(await resolveKey(db, WELL_FORMED.slice(0, -1))).toBeUndefined();
    expect(calls()).toEqual([]);
  });

  it("answers undefined for a secret naming no row, exactly as for a malformed one", async () => {
    const { db } = stubDb([]);
    /* One answer, three causes — malformed, unknown, revoked. A caller able to separate them
       learns whether a candidate secret exists, which is the identity oracle D-13 charges.
       Asserted as an equality BETWEEN the two answers rather than as two `undefined` checks,
       because the claim is that they are indistinguishable rather than that each is absent. */
    expect(await resolveKey(db, WELL_FORMED)).toBe(await resolveKey(db, "not-a-key"));
  });

  it("is not cached: two calls for one secret both reach the store", async () => {
    /* AC4 forbids caching this. The natural optimisation is a process-local map, and it
       satisfies every other criterion while leaving a revoked key live until the process
       restarts. Two `select` entries is what proves the cache is absent. */
    const { db, calls } = stubDb([row()]);
    await resolveKey(db, WELL_FORMED);
    await resolveKey(db, WELL_FORMED);
    expect(calls().filter((c) => c === "select")).toHaveLength(2);
  });

  it("refusing a huge malformed secret costs no more than refusing a tiny one", async () => {
    /* The stronger form of the call-list test: that one proves no QUERY ran, and the cost
       D-40-B names is the HASH rather than the query. A secret refused after hashing would
       satisfy the call-list test perfectly.

       A RATIO rather than a millisecond bound, because a millisecond bound is a
       host-dependent threshold and this run has already paid for writing one: hold the work
       fixed and vary the input size, and the host cancels. If the shape check ran after the
       hash, eight megabytes would cost roughly a hundred thousand times a few bytes. If it
       runs before, both are a length comparison and the ratio is about one. The tolerance is
       50x — enormous against the effect it is separating, which is what keeps it from being
       a timing test dressed as a property.

       NOT written as `vi.spyOn(crypto, "createHash")`: `node:crypto` is a builtin ESM
       namespace and its exports are not configurable, and `secret.ts` binds `createHash` at
       module load anyway — so a spy installed afterwards would observe nothing and report
       zero for a module that hashes on every call. A probe that cannot reach is the third
       reading of a zero, and it would have read as the good news here. */
    const { db } = stubDb([row()]);
    const tiny = "x".repeat(SECRET_LENGTH); // right length, wrong prefix
    const huge = "x".repeat(8_000_000); // wrong length
    const time = async (secret: string, runs: number): Promise<number> => {
      const start = process.hrtime.bigint();
      for (let i = 0; i < runs; i += 1) await resolveKey(db, secret);
      return Number(process.hrtime.bigint() - start);
    };

    await time(tiny, 200); // warm, so the ratio is not measuring first-call compilation
    const tinyNs = await time(tiny, 2000);
    const hugeNs = await time(huge, 2000);

    /* The control: both inputs must actually be refused, or the ratio is comparing two
       things that did different work for a reason that is not the one under test. */
    expect(await resolveKey(db, tiny)).toBeUndefined();
    expect(await resolveKey(db, huge)).toBeUndefined();
    expect(hugeNs / tinyNs).toBeLessThan(50);
  });
});

describe("revokeKey", () => {
  it("sets revokedAt", async () => {
    const { db, calls } = stubDb([]);
    await revokeKey(db, OWNER, KEY_ID);
    expect(calls()).toEqual(["update", "set:revokedAt", "where"]);
  });

  it("answers void for a malformed key id and reaches no database", async () => {
    /* A non-UUID reaches Postgres as 22P02 and would be sanitized into a 500 for a caller's
       mistake. Returning rather than refusing keeps the no-oracle property total: a malformed
       id can name no row, so "no such key" is the true answer and it is the same answer a
       well-formed foreign id gets. */
    const { db, calls } = stubDb([]);
    await expect(revokeKey(db, OWNER, "not-a-uuid")).resolves.toBeUndefined();
    expect(calls()).toEqual([]);
  });

  it("refuses an anonymous actor", async () => {
    const { db } = stubDb([]);
    await expect(revokeKey(db, { kind: "anonymous" }, KEY_ID)).rejects.toBeInstanceOf(
      NotKeyOwnerError,
    );
  });
});

describe("listKeys", () => {
  it("answers the account's records, and every one has the secret-free key set", async () => {
    const { db } = stubDb([row(), row({ id: "33333333-3333-4333-8333-333333333333" })]);
    const keys = await listKeys(db, OWNER, OWNER.accountId);
    expect(keys).toHaveLength(2);
    /* Asserted at THIS producer and not only at `issueKey`'s. `rowToRecord` is shared today,
       so the two agree — and a shared helper with one witness reds identically to two
       witnesses when the helper changes, which is exactly what per-site assertions separate.
       The day somebody gives the reader its own projection, this is what notices. */
    for (const key of keys) {
      expect(Object.keys(key).sort()).toEqual([
        "accountId",
        "createdAt",
        "keyId",
        "label",
        "revokedAt",
      ]);
    }
  });

  it("INCLUDES revoked keys, because that is AC4's only observable form", async () => {
    /* Not a convenience. *A revoked key is refused immediately* had nothing a caller could
       look at while this module published no reader and answered `DELETE` with a 204 — the
       revoking request said nothing and no other request would say anything either.
       `revokedAt` moving from `null` to an instant IS the observation, and filtering the row
       out would take it away again while every other assertion here stayed green. */
    const revokedAt = new Date("2026-08-20T10:00:00.000Z");
    const { db } = stubDb([row({ revokedAt })]);
    const [key] = await listKeys(db, OWNER, OWNER.accountId);
    expect(key?.revokedAt).toEqual(revokedAt);
  });

  it("refuses a foreign account and reaches no database", async () => {
    const { db, calls } = stubDb([row()]);
    await expect(
      listKeys(db, OWNER, "44444444-4444-4444-8444-444444444444"),
    ).rejects.toBeInstanceOf(NotKeyOwnerError);
    expect(calls()).toEqual([]);
  });

  it("refuses an anonymous actor", async () => {
    const { db } = stubDb([row()]);
    await expect(listKeys(db, { kind: "anonymous" }, OWNER.accountId)).rejects.toBeInstanceOf(
      NotKeyOwnerError,
    );
  });

  it("never lets a token hash reach a record, however the row grows", async () => {
    /* The row here carries a column the record has no field for. A projection that spread the
       row would carry it; one that names five fields cannot. This is the assertion that stays
       true when the table gains a column, which is the failure the record's shape exists to
       make impossible rather than to be reviewed for. */
    const { db } = stubDb([row({ tokenHash: "SECRETHASHLITERAL", somethingNew: "ALSO-SECRET" })]);
    const [key] = await listKeys(db, OWNER, OWNER.accountId);
    expect(JSON.stringify(key)).not.toContain("SECRETHASHLITERAL");
    expect(JSON.stringify(key)).not.toContain("ALSO-SECRET");
  });
});
