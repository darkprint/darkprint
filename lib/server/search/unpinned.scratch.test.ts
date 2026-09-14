/* ============================================================
   A card no release pins still reaches the vector table.

   ── the gap this covers ──
   `reembedRelease` walks a release and the cards it PINS, which is
   every card a blueprint uses and no card it does not. A card
   published on its own — `POST /api/cards`, the profile's `New
   card` — is pinned by nothing, so nothing reached it: it was
   stored, listed on `/nodes`, and invisible to the one ranking that
   finds an artifact from a task description. Measured on production
   before `reembedCard` existed: 8 of 119 card versions had no row in
   `card_version_embedding`, and all 8 were standalone.

   Two writers now cover it, and both are exercised here because
   they fail independently: `publishCard` embeds at the write, and
   `reembedAll`'s second arm sweeps whatever a write missed — a card
   stored while the encoder was absent, or one the seed wrote with
   `addCard`.

   Skipped without a database, like every `.scratch.` file, and
   skipped without an encoder: a machine with no model cannot write
   a vector and asserting one would be asserting the fixture.
   ============================================================ */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { schema, type DbClient } from "@/lib/db";
import { createTestDb, resetTestDb, type TestDb } from "../../../tests/support/db";
import { encoderAvailable } from "./embed";
import { embeddedInput, reembedAll, reembedCard } from "./reembed";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("a card no release pins", () => {
  let testDb: TestDb | undefined;
  let client: DbClient;
  let encoder = false;

  beforeAll(async () => {
    testDb = await createTestDb();
    client = testDb.client;
    encoder = await encoderAvailable();
  });

  beforeEach(async () => {
    await resetTestDb(client);
  });

  afterAll(async () => {
    await testDb?.drop();
  });

  /** One card version owned by one account, pinned by no release at all. */
  async function standalone(cardId = "solo-judge"): Promise<string> {
    const [owner] = await client.db
      .insert(schema.account)
      .values({ githubId: "mara", githubLogin: "mara", handle: "mara" })
      .returning();
    const [version] = await client.db
      .insert(schema.cardVersion)
      .values({
        cardId,
        version: "1.0.0",
        digest: `sha256:${cardId.padEnd(64, "0").slice(0, 64)}`,
        ownerId: owner.id,
        visibility: "public",
        body: {
          id: cardId,
          name: "Solo judge",
          type: "validation",
          phases: ["testing"],
          action: "grade one answer against a rubric",
          spec: "Read the rubric and the answer, and say which criteria the answer meets and which it misses.",
          tools: [],
          riskMarkers: [],
          willNot: [],
        },
        source: `id: ${cardId}\n`,
      })
      .returning();
    return version.id;
  }

  async function vectorRow(cardVersionId: string) {
    const [row] = await client.db
      .select({ stamp: schema.cardVersionEmbedding.embeddedInputSha256 })
      .from(schema.cardVersionEmbedding)
      .where(eq(schema.cardVersionEmbedding.cardVersionId, cardVersionId));
    return row;
  }

  it("has no vector until something writes one, which is the state this file exists for", async () => {
    const id = await standalone();
    expect(
      await vectorRow(id),
      "a bare insert is what `addCard` does, and no release walk can reach it",
    ).toBeUndefined();
  });

  it.skipIf(!hasDb)("gets one from `reembedCard`, stamped the way every other vector is", async () => {
    if (!encoder) return;
    const id = await standalone();
    await reembedCard(client.db, id);

    const row = await vectorRow(id);
    expect(row, "reembedCard wrote no row for a card that exists").toBeDefined();
    /* The stamp is the document's, not the row's: `embeddedInput` folds the model pin into
       the text, which is what lets a later sweep tell a current vector from a stale one. */
    expect(row?.stamp).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("writes once for one document, so a re-run is a read", async () => {
    if (!encoder) return;
    const id = await standalone();
    await reembedCard(client.db, id);
    const first = await vectorRow(id);
    await reembedCard(client.db, id);
    expect(
      (await vectorRow(id))?.stamp,
      "the second call re-encoded a document that had not moved",
    ).toBe(first?.stamp);
  });

  it("is reached by the sweep, which is the repair path when a write missed it", async () => {
    if (!encoder) return;
    const id = await standalone();
    expect(await vectorRow(id)).toBeUndefined();

    const sweep = await reembedAll(client.db);
    expect(
      await vectorRow(id),
      "reembedAll visited no release — there are none — and must still have reached this card",
    ).toBeDefined();
    expect(sweep.releases, "the fixture has no release, so the release arm found nothing").toBe(0);
    expect(sweep.written, "the card is the one thing written").toBeGreaterThan(0);
  });

  it("answers nothing for a row that is not there, rather than throwing", async () => {
    await expect(
      reembedCard(client.db, "00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeUndefined();
  });

  it("stamps the document rather than the bytes, so two cards differ", async () => {
    if (!encoder) return;
    const first = await standalone("solo-judge");
    await reembedCard(client.db, first);
    const stamp = (await vectorRow(first))?.stamp;
    expect(stamp).toBe(embeddedInput((await documentOf(first)) ?? ""));
  });

  /** The text `reembedCard` embedded, recovered from the stamp's own inputs. */
  async function documentOf(cardVersionId: string): Promise<string | undefined> {
    const { cardText } = await import("./reembed");
    const { openView } = await import("@/lib/server/ontology");
    const [row] = await client.db
      .select({ body: schema.cardVersion.body })
      .from(schema.cardVersion)
      .where(eq(schema.cardVersion.id, cardVersionId));
    if (row === undefined) return undefined;
    const core = openView();
    return cardText(row.body as Record<string, never>, (id: string) => core.get(id)?.label ?? id);
  }
});
