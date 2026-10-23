import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDbClient, type DbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { blueprint, blueprints, card } from "@/lib/server/registry";
import { REGISTRY_HANDLE, planImport, runImport } from "@/lib/server/seed";
import { createTestDb, type TestDb } from "@/tests/support";

/* Every registry reader rebuilds the snapshot, so the rows behind it are cached per `Db` and
   re-read only when a committed write changes them. These cells hold the cache to both halves
   of that: a quiet registry is not read again, and a change to any table it reads is seen on the
   very next call. */

const ANON: Actor = { kind: "anonymous" };
const JANITOR = "nightly-data-janitor";
const OBSERVABILITY = "pipeline-observability";
const PUBLISHER = "warehouse-publisher@1.0.0";

let test: TestDb;
let url: string;
const opened: DbClient[] = [];

beforeAll(async () => {
  test = await createTestDb();
  url = (test.client.pool as unknown as { options: { connectionString: string } }).options.connectionString;
  await runImport(test.client.db as never, await planImport());
}, 120_000);

afterAll(async () => {
  for (const client of opened) await client.close();
  await test?.drop();
});

/** A handle of its own on the test database, so its cache starts cold, recording each statement. */
function freshHandle() {
  const client = createDbClient(url);
  opened.push(client);
  const statements: string[] = [];
  let failing: RegExp | undefined;
  const pool = client.pool as unknown as { query: (...args: unknown[]) => unknown };
  const query = pool.query.bind(pool);
  pool.query = (...args: unknown[]) => {
    const first = args[0];
    const text = typeof first === "string" ? first : ((first as { text?: string }).text ?? "");
    statements.push(text);
    if (failing?.test(text)) {
      failing = undefined;
      return Promise.reject(new Error("injected fault"));
    }
    return query(...args);
  };
  return {
    db: client.db,
    statements,
    failOnce(pattern: RegExp) {
      failing = pattern;
    },
  };
}

async function statementsOf(handle: ReturnType<typeof freshHandle>, run: () => Promise<unknown>) {
  const before = handle.statements.length;
  await run();
  return handle.statements.length - before;
}

describe("the registry rows, cached per handle", () => {
  it("reads an unchanged registry once, and answers the same from the copy", async () => {
    const handle = freshHandle();
    let first: unknown;
    let second: unknown;
    const cold = await statementsOf(handle, async () => (first = await blueprints(handle.db, ANON)));
    const warm = await statementsOf(handle, async () => (second = await blueprints(handle.db, ANON)));
    expect(cold, "the cold read sent nothing, so this cell measures nothing").toBeGreaterThan(1);
    expect(warm, `a quiet registry was read again: ${warm} statements against ${cold} cold`).toBe(1);
    expect(second).toEqual(first);
  });

  it("shares one read among callers that arrive together on a cold handle", async () => {
    const probe = freshHandle();
    const coldRead = (await statementsOf(probe, () => blueprints(probe.db, ANON))) - 1;
    const handle = freshHandle();
    const callers = 4;
    const sent = await statementsOf(handle, () =>
      Promise.all(Array.from({ length: callers }, () => blueprints(handle.db, ANON))),
    );
    expect(sent, `${callers} stamps and one read of ${coldRead} statements, or each caller read alone`).toBe(
      callers + coldRead,
    );
  });

  it("drops a failed read, so the next caller reads again and gets an answer", async () => {
    const handle = freshHandle();
    handle.failOnce(/^select .* from "card_version"$/);
    await expect(blueprints(handle.db, ANON)).rejects.toThrow("the registry store failed");
    const again = await blueprints(handle.db, ANON);
    expect(again.map((bp) => bp.slug)).toContain(JANITOR);
  });

  it("refuses a reader that mutates the shared rows", async () => {
    const bp = await blueprint(test.client.db, ANON, REGISTRY_HANDLE, JANITOR);
    const tags = bp?.manifest.tags;
    expect(Array.isArray(tags), "the janitor's manifest lost its tags, so nothing is probed").toBe(true);
    expect(() => (tags as string[]).push("mutated")).toThrow(TypeError);
    const again = await blueprint(test.client.db, ANON, REGISTRY_HANDLE, JANITOR);
    expect(again?.manifest.tags).not.toContain("mutated");
  });
});

describe("a committed change reaches the next read", () => {
  it("sees a bundle turn private", async () => {
    const db = test.client.db;
    expect(await blueprint(db, ANON, REGISTRY_HANDLE, OBSERVABILITY)).toBeDefined();
    await test.client.query(`update bundle set visibility = 'private' where slug = $1`, [OBSERVABILITY]);
    expect(await blueprint(db, ANON, REGISTRY_HANDLE, OBSERVABILITY), "a stale copy still shows it").toBeUndefined();
  });

  it("sees a release's manifest change", async () => {
    const db = test.client.db;
    expect((await blueprint(db, ANON, REGISTRY_HANDLE, JANITOR))?.manifest.title).toBe("Nightly Data Janitor");
    await test.client.query(
      `update release set manifest = jsonb_set(manifest, '{title}', '"Renamed"')
        where bundle_id = (select id from bundle where slug = $1)`,
      [JANITOR],
    );
    expect((await blueprint(db, ANON, REGISTRY_HANDLE, JANITOR))?.manifest.title, "a stale copy").toBe("Renamed");
  });

  it("sees a card version change", async () => {
    const db = test.client.db;
    expect((await card(db, ANON, PUBLISHER))?.card.action).not.toBe("Renamed action.");
    await test.client.query(
      `update card_version set body = jsonb_set(body, '{action}', '"Renamed action."')
        where card_id = 'warehouse-publisher' and version = '1.0.0'`,
    );
    expect((await card(db, ANON, PUBLISHER))?.card.action, "a stale copy").toBe("Renamed action.");
  });

  it("is not re-read for an account edit the index does not use", async () => {
    const handle = freshHandle();
    await blueprints(handle.db, ANON);
    await test.client.query(`update account set bio = 'edited' where handle = $1`, [REGISTRY_HANDLE]);
    expect(await statementsOf(handle, () => blueprints(handle.db, ANON))).toBe(1);
  });

  it("sees an owner's handle change", async () => {
    const db = test.client.db;
    expect(await blueprint(db, ANON, REGISTRY_HANDLE, JANITOR)).toBeDefined();
    await test.client.query(`update account set handle = 'renamed' where handle = $1`, [REGISTRY_HANDLE]);
    expect(await blueprint(db, ANON, "renamed", JANITOR), "a stale copy keeps the old handle").toBeDefined();
    expect(await blueprint(db, ANON, REGISTRY_HANDLE, JANITOR)).toBeUndefined();
  });
});
