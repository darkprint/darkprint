import { describe, expect, it } from "vitest";
import { migrationTarget, refuseTransactionPooler, upOptions } from "./cli.ts";

const DIRECT = "postgres://postgres:secret@db.abcdefghijkl.supabase.co:5432/postgres";
const POOLER = "postgres://postgres.abcdefghijkl:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

describe("migrationTarget", () => {
  it("prefers MIGRATE_DATABASE_URL over DATABASE_URL", () => {
    expect(migrationTarget({ MIGRATE_DATABASE_URL: DIRECT, DATABASE_URL: POOLER })).toEqual({
      url: DIRECT,
      source: "MIGRATE_DATABASE_URL",
    });
  });

  it("falls back to DATABASE_URL and says so", () => {
    expect(migrationTarget({ DATABASE_URL: DIRECT })).toEqual({ url: DIRECT, source: "DATABASE_URL" });
  });

  it("names both variables when neither is set", () => {
    expect(() => migrationTarget({})).toThrow(/MIGRATE_DATABASE_URL nor DATABASE_URL/);
  });
});

describe("refuseTransactionPooler", () => {
  it("lets a direct connection through", () => {
    expect(() => refuseTransactionPooler(DIRECT, "DATABASE_URL")).not.toThrow();
    expect(() => refuseTransactionPooler("postgres://darkprint:darkprint@localhost:5432/darkprint", "DATABASE_URL")).not.toThrow();
  });

  it("refuses the Supabase transaction pooler and names MIGRATE_DATABASE_URL", () => {
    expect(() => refuseTransactionPooler(POOLER, "DATABASE_URL")).toThrow(/MIGRATE_DATABASE_URL/);
    expect(() => refuseTransactionPooler(POOLER, "DATABASE_URL")).toThrow(/DATABASE_URL points at a transaction pooler/);
  });

  it("refuses a pgbouncer transaction-mode URL by its query flag", () => {
    expect(() => refuseTransactionPooler(`${DIRECT}?pgbouncer=true`, "MIGRATE_DATABASE_URL")).toThrow(/MIGRATE_DATABASE_URL points at a transaction pooler/);
  });

  it("does not refuse the session-mode pooler on port 5432", () => {
    expect(() => refuseTransactionPooler(POOLER.replace(":6543", ":5432"), "DATABASE_URL")).not.toThrow();
  });
});

describe("upOptions", () => {
  it("reads --to and --only", () => {
    expect(upOptions(["--to", "0008_embedding_input"])).toEqual({ to: "0008_embedding_input" });
    expect(upOptions(["--only", "0010_key_scope"])).toEqual({ only: "0010_key_scope" });
    expect(upOptions([])).toEqual({});
  });

  it("refuses a flag without an id, and an argument it does not know", () => {
    expect(() => upOptions(["--to"])).toThrow(/needs a migration id/);
    expect(() => upOptions(["--to", "--only", "x"])).toThrow(/needs a migration id/);
    expect(() => upOptions(["--fast"])).toThrow(/Unknown argument "--fast"/);
  });
});
