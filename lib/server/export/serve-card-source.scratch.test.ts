/* ============================================================
   T280 implementer's scratch harness for `serveCardSource` — not
   the criterion suite. `serveCard`
   is `export.scratch.test.ts`'s AC5, verified against the full
   fixture corpus; this file exists for exactly the one property
   comparison against that suite adds nothing to — **the same
   bytes, minus the download event** — so the fixture here is the
   smallest one that can carry a real `card_version` row, not
   `readContent()`'s whole nine-bundle corpus.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { CardRef } from "@/lib/core";
import { readContent } from "@/lib/content/read";
import { schema, type Db } from "@/lib/db";
import { addCard } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { serveCard, serveCardSource } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);
const ANONYMOUS: Actor = { kind: "anonymous" };

describe.skipIf(!hasDb)("lib/server/export serveCardSource", () => {
  let testDb: TestDb | undefined;
  let db: Db;
  let cardRef: CardRef;
  let cardId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;

    const [account] = await db
      .insert(schema.account)
      .values({ githubId: "t280-export", githubLogin: "t280-export" })
      .returning();

    const entry = readContent()[0];
    const pinned = entry.blueprint.nodes[0].ref;
    const [id, version] = pinned.split("@");
    const body = entry.blueprint.cards.get(pinned)!;
    const file = entry.cardFiles.find(
      (candidate) => candidate.file.replace(/^cards\//, "").replace(/\.yaml$/, "") === pinned,
    )!;

    await addCard(db, { cardId: id, version, ownerId: account.id, body, source: file.text });
    cardRef = pinned;
    cardId = id;
  }, 60_000);

  afterAll(async () => {
    await testDb?.drop();
  });

  async function downloadCount(): Promise<number> {
    const [row] = await db
      .select()
      .from(schema.target)
      .where(and(eq(schema.target.kind, "card"), eq(schema.target.refId, cardId)));
    return row === undefined ? 0 : Number(row.downloadCount);
  }

  it("serves the identical bytes, path and content type as serveCard", async () => {
    const viaServeCard = await serveCard(db, ANONYMOUS, cardRef);
    const viaSource = await serveCardSource(db, ANONYMOUS, cardRef);

    expect(viaServeCard).toBeDefined();
    expect(viaSource).toBeDefined();
    expect(viaSource!.path).toBe(viaServeCard!.path);
    expect(viaSource!.contentType).toBe(viaServeCard!.contentType);
    expect(new TextDecoder().decode(viaSource!.bytes)).toBe(new TextDecoder().decode(viaServeCard!.bytes));
  });

  /**
   * The one property this module exists for. Falsified: adding a stray `recordDownload`
   * call to `serveCardSource` (the exact mistake T280's contract names) turned this red,
   * and removing it again turned it back green — reported alongside this file.
   */
  it("does not record a download: the count serveCard just moved stays put across serveCardSource", async () => {
    const before = await downloadCount();

    await serveCard(db, ANONYMOUS, cardRef);
    const afterServeCard = await downloadCount();
    expect(afterServeCard).toBe(before + 1);

    await serveCardSource(db, ANONYMOUS, cardRef);
    await serveCardSource(db, ANONYMOUS, cardRef);
    const afterSource = await downloadCount();
    expect(afterSource).toBe(afterServeCard);
  });

  it("an unparseable ref and an unknown card both answer undefined, same as serveCard", async () => {
    expect(await serveCardSource(db, ANONYMOUS, "no-version" as CardRef)).toBeUndefined();
    expect(await serveCardSource(db, ANONYMOUS, "nothing-here@9.9.9" as CardRef)).toBeUndefined();
  });

  it("the padded spelling resolves to the archive's canonical path, same as serveCard", async () => {
    const padded = await serveCardSource(db, ANONYMOUS, `  ${cardRef}  ` as CardRef);
    expect(padded).toBeDefined();
    expect(padded!.path).not.toContain(" ");
    expect(padded!.path).toBe((await serveCard(db, ANONYMOUS, cardRef))!.path);
  });
});
