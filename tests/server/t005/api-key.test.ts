import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  CONTRACT,
  PUBLISHED,
  PUBLISHED_UNIQUES,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import { columnsOf, foreignKeysOf, readCatalogue, type Catalogue } from "./catalogue.ts";
import { attemptToDriverError, existing, fixtures, insertRow, type Fixtures } from "./rows.ts";
import { falsifyUnique, soleUnique } from "./falsify.ts";

/* ============================================================
   T005 — the `api_key` table

   T230's shape: account + a revocation state that is immediate.

   No acceptance criterion of T005 is about this table's
   constraints, so what is asserted here is narrower than elsewhere
   and says so: the published columns, the account it belongs to,
   and the one constraint the published block does name —
   `token_hash text NOT NULL unique`.

   That one is worth its own falsification rather than a column
   check. T230's `issueKey` returns the secret exactly once and
   stores it hashed, and `resolveKey(db, secret)` reads it back by
   hash. Two rows at one hash makes that read ambiguous in the one
   place a wrong answer is an authentication decision.
   ============================================================ */

let scratch: Scratch;
let cat: Catalogue;
let f: Fixtures;

beforeAll(async () => {
  scratch = await scratchDatabase("apikey");
  cat = await readCatalogue(scratch.query);
  f = fixtures(scratch.query, cat);
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

suite("T005 — the `api_key` table", () => {
  it("`api_key` exists and carries the published columns", () => {
    requireT005Shipped(scratch);
    expect(
      cat.tables.includes("api_key"),
      `${CONTRACT.tables}\n  tables present: ${cat.tables.join(", ")}`,
    ).toBe(true);

    const names = columnsOf(cat, "api_key").map((c) => c.name);
    expect(
      ["account_id", "token_hash", "label", "created_at", "revoked_at"].filter((n) => !names.includes(n)),
      `${PUBLISHED.apiKey}\n  columns on api_key: ${names.join(", ")}`,
    ).toEqual([]);
  });

  it("`api_key` carries no column that could hold the secret itself", () => {
    requireT005Shipped(scratch);
    /* T230: "issueKey returns the secret exactly once and ApiKeyRecord does not carry it. The
       secret is stored hashed and is unrecoverable; the record shape makes that structural
       rather than a rule someone remembers." The record shape is T230's to publish — the
       *storage* shape is this task's, and a `token` or `secret` column here would make the
       structural promise false however carefully T230 writes its type. */
    const bearing = columnsOf(cat, "api_key")
      .map((c) => c.name)
      .filter((n) => /secret|token$|plaintext|raw/i.test(n));
    expect(
      bearing,
      `${PUBLISHED.apiKey}\n  The published column is \`token_hash\`, and the hash is the whole ` +
        `of what may be stored.`,
    ).toEqual([]);
  });

  it("`api_key.revoked_at` is a nullable timestamp, so revocation is a state on the row rather than a deletion", () => {
    requireT005Shipped(scratch);
    const column = columnsOf(cat, "api_key").find((c) => c.name === "revoked_at");
    expect(column === undefined ? "(absent)" : null, PUBLISHED.apiKey).toBeNull();
    if (column === undefined) return;

    expect(
      column.nullable,
      `${CONTRACT.apiKeyShape}\n  A live key has not been revoked, so the column has to be ` +
        `absent-able. T230's AC3 also needs the row to survive revocation: a revoked key stays ` +
        `attributable in the audit log, which a deleted row is not.`,
    ).toBe(true);
    expect(column.dataType, PUBLISHED.preamble).toBe("timestamp with time zone");
  });

  it("`api_key.token_hash` is unique at the database, so two keys cannot resolve to one hash", async () => {
    requireT005Shipped(scratch);
    const unique = soleUnique(cat, "api_key");
    expect(
      "error" in unique ? unique.error : null,
      `${PUBLISHED.apiKey}\n  \`resolveKey(db, secret)\` reads a key back by its hash. Two rows ` +
        `at one hash makes that read ambiguous in the one place a wrong answer is an ` +
        `authentication decision.`,
    ).toBeNull();
    if ("error" in unique) return;

    /* Through `falsifyUnique` rather than a hand-built pair, which is the correction D-05-08
       forced. The two-column literal that used to be here was the one place in this suite
       that did not derive its required columns from the catalogue — so when the block and
       the schema disagreed at nine columns, this was the only one that reddened, and the
       other eight passed by luck. It also meant `api_key` never reached the partial-index
       assertion, so a `WHERE`-qualified unique on `token_hash` was unobservable here while
       being caught on all three tables an acceptance criterion names. The untested region
       was the table with no criterion pointing at it. */
    await falsifyUnique(
      scratch.query,
      cat,
      f,
      "api_key",
      unique,
      PUBLISHED_UNIQUES.api_key,
      `${PUBLISHED.apiKey}\n  ${CONTRACT.apiKeyShape}`,
    );
  }, 120_000);

  it("one account may hold more than one key, so the uniqueness is on the hash and not on the owner", async () => {
    requireT005Shipped(scratch);

    /* `falsifyUnique` varies only the constrained columns, and `account_id` is not one of
       them — so nothing above this line would notice a unique that reached the owner. T230
       issues keys per account and expects to issue a second; a constraint that forbade it
       would pass every assertion in this file except this one. */
    const account = await existing(f, "account");
    const first = await attemptToDriverError(() => insertRow(f, "api_key", { account_id: account.id }));
    const second = await attemptToDriverError(() => insertRow(f, "api_key", { account_id: account.id }));

    expect(
      [first, second]
        .filter((a) => a.raised)
        .map((a) => `${a.driver?.code ?? "(no sqlstate)"}: ${a.driver?.message ?? String(a.cause)}`),
      `${PUBLISHED.apiKey}\n  Two keys for one account, with distinct hashes, both have to land.`,
    ).toEqual([]);
  }, 120_000);

  it("`api_key.account_id` is NOT NULL and points at `account`", () => {
    requireT005Shipped(scratch);
    const column = columnsOf(cat, "api_key").find((c) => c.name === "account_id");
    expect(column?.nullable ?? true, PUBLISHED.preamble).toBe(false);
    expect(
      foreignKeysOf(cat, "api_key")
        .filter((k) => k.refTable === "account")
        .map((k) => k.columns.join(", ")),
      `${CONTRACT.apiKeyShape}\n  T230's AC3 — a valid API key raises the ceiling and is ` +
        `attributable in the audit log — has nothing to attribute to without it.`,
    ).toEqual(["account_id"]);
  });
});
