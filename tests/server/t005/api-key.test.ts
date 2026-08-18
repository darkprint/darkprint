import { afterAll, beforeAll, describe as suite, expect, it } from "vitest";

import {
  CONTRACT,
  PUBLISHED,
  SQLSTATE,
  dropScratchDatabases,
  requireT005Shipped,
  scratchDatabase,
  type Scratch,
} from "./harness.ts";
import { columnsOf, foreignKeysOf, readCatalogue, uniqueLabel, type Catalogue } from "./catalogue.ts";
import { attemptToDriverError, existing, fixtures, insertLiteral, marker, type Fixtures } from "./rows.ts";

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
    const unique = cat.uniques.filter(
      (u) => u.table === "api_key" && !u.primary && u.columns.join(",") === "token_hash",
    );
    expect(
      unique.map(uniqueLabel),
      `${PUBLISHED.apiKey}\n  \`resolveKey(db, secret)\` reads a key back by its hash. Two rows ` +
        `at one hash makes that read ambiguous in the one place a wrong answer is an ` +
        `authentication decision.\n  unique objects on api_key: ` +
        `${cat.uniques.filter((u) => u.table === "api_key").map(uniqueLabel).join("; ") || "(none)"}`,
    ).toHaveLength(1);
    if (unique.length !== 1) return;

    const account = await existing(f, "account");
    const hash = marker("hash");
    await insertLiteral(scratch.query, "api_key", { account_id: account.id, token_hash: hash });

    const attempt = await attemptToDriverError(() =>
      insertLiteral(scratch.query, "api_key", { account_id: account.id, token_hash: hash }),
    );
    expect(
      attempt.raised ? (attempt.driver?.code ?? "(no sqlstate)") : "(accepted)",
      `${PUBLISHED.apiKey}\n  A second row at the same \`token_hash\` was accepted.`,
    ).toBe(SQLSTATE.unique_violation);

    /* A distinct hash for the same account must still land: a key per account is not the
       constraint, and a unique that reached account_id would make T230's "issue a second key"
       impossible while passing the assertion above. */
    const second = await attemptToDriverError(() =>
      insertLiteral(scratch.query, "api_key", { account_id: account.id, token_hash: marker("hash") }),
    );
    expect(
      second.raised ? `${second.driver?.code}: ${second.driver?.message}` : null,
      `${PUBLISHED.apiKey}\n  One account may hold more than one key; the uniqueness is on the ` +
        `hash alone.`,
    ).toBeNull();
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
