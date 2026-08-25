/* ============================================================
   DarkPrint backend — the owed publish-path repin-wiring cell

   docs/ARCHITECTURE.md §11.1 records this gap verbatim: "T190's repin
   wiring in `publish()` has NO cell behind it ... The round's cells
   drive `enqueueRepinEvents` directly; none runs `publish()` and
   reads the queue, so deleting the call site in
   `lib/server/publish/publish.ts` reds nothing today ... a
   publish-path cell asserting a queue row per newly stored card
   version is owed." This file is that cell.

   `tests/server/t190/repin.test.ts` and
   `lib/server/notifications/notifications.db.scratch.test.ts` both
   drive `enqueueRepinEvents(db, cardId, version, publisher?)`
   directly, by design (T190's own header: "nothing calls it yet, by
   ruling"). That is correct coverage of the VERB and it is exactly
   what cannot see the WIRING — a suite that never calls `publish()`
   passes identically whether or not `publish.ts` line ~286 exists.
   So every notification row below is produced by calling `publish()`
   from `@/lib/server/publish`, never by calling `enqueueRepinEvents`
   as the SOURCE of an event. It is called exactly once, in the last
   cell, as the SUBJECT of that one cell (a retried invocation of the
   wiring's own call) rather than as a shortcut for building the world.

   ── the narrative, and why it is one shared `beforeAll` ──
   Four accounts' worth of state has to accumulate across five real
   `publish()` calls for the four criteria to mean anything against
   ONE undisturbed world, so the whole thing is built once and each
   cell reads a slice of what it produced — the shape
   `tests/server/t110/fixtures.ts`'s `drift.test.ts` uses for the same
   reason (repeated real publishes are engine work, DB writes and
   object storage, not worth paying five times over). Snapshots are
   taken BEFORE and AFTER the step each cell is about, and every cell
   asserts a slice (`after.slice(before.length)`) rather than an
   absolute count — an absolute count would also pass if some earlier
   step had silently produced the row this step is supposed to.

     1. `pinner`    publishes the BASE corpus            (fresh card version)
     2. `publisher` publishes the SAME BASE corpus        (byte-identical; establishes
                                                            `publisher` as a pinner too)
     3. `publisher` REPUBLISHES with ONE card repinned    <- the wiring under test (AC1/AC2)
     4. `thirdAccount` republishes the SAME repinned bytes <- AC3: `added=false` never enqueues
     5. `enqueueRepinEvents` replayed with step 3's own args <- AC4: the unique key backstops a retry

   Steps 1 and 2 both land at the DEFAULT `repin: true` preference
   (`account.notification_preferences` defaults to `{}`,
   `fillPreferences` reads `true` for a missing key per D-190-05's
   AC4), so no preference wiring appears anywhere in this file.

   ── why step 5 calls the verb directly, and that is not a contradiction ──
   A literal end-to-end retry of the PUBLISH call in step 3 (same
   owner, same slug, same version, same bytes) is refused by
   `publish()`'s own exact-digest guard (`getRelease` + `conflict()`)
   BEFORE a transaction even opens, so it never reaches the wiring a
   second time — that guard is real and it is not what this file is
   about. `publish.ts`'s own comment on the call site names the actual
   backstop: "the queue's unique key makes a retried publish enqueue
   the same rows, not new ones." The only way to exercise THAT
   specific mechanism is to make the wiring's own call happen twice
   with the exact arguments step 3 passed it, which is what step 5
   does — proving the guarantee the publish path is relying on, at
   the API the publish path relies on it through.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { CORE_ONTOLOGY } from "@/lib/core";
import { schema, type Db } from "@/lib/db";
import { addOntologyVersion } from "@/lib/server/ontology";
import { enqueueRepinEvents } from "@/lib/server/notifications";
import { createTestDb, type TestDb } from "@/tests/support/db";
import {
  publishBundle,
  repinOneCard,
  resolvingCorpus,
  seedAccount,
  type Account,
} from "../server/t110/fixtures";

/* Five real publishes, each paying the engine, the DB and object storage — the same cost
   `tests/server/t110/drift.test.ts` measured and raised its own file's timeout for. */
vi.setConfig({ testTimeout: 80_000, hookTimeout: 80_000 });

interface QueueRow {
  kind: string;
  /** `jsonb`, untyped at the column — compared with `toEqual` rather than read as a shape. */
  subject: unknown;
}

let testDb: TestDb;
let db: Db;

let pinner: Account;
let publisher: Account;
let thirdAccount: Account;
/** The bare card id and the new version `repinOneCard` bumped it to. */
let card: string;
let toVersion: string;

/** Every queue row for one account, oldest first — a direct schema read, D-190-02's own rule. */
async function queueRowsFor(accountId: string): Promise<QueueRow[]> {
  return await db
    .select({ kind: schema.notificationQueue.kind, subject: schema.notificationQueue.subject })
    .from(schema.notificationQueue)
    .where(eq(schema.notificationQueue.accountId, accountId));
}

/** Snapshots taken at each numbered step of the narrative in the file header. */
let before1: { pinner: QueueRow[]; publisher: QueueRow[] };
let afterRepin: { pinner: QueueRow[]; publisher: QueueRow[] };
let afterRepublish: { pinner: QueueRow[] };
let afterRetry: { pinner: QueueRow[] };

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.client.db;
  await addOntologyVersion(db, { version: CORE_ONTOLOGY.version, terms: [...CORE_ONTOLOGY.terms] });

  /* `publishBundle`/`seedAccount`/`repinOneCard` are typed against T110's own `Scratch`
     (`{ db, pool, client, name, drop() }`), so this adapts `createTestDb`'s result to that
     shape rather than duplicating T110's bespoke database-per-file bootstrap: the SAME
     migrated client both APIs need, wearing the interface the borrowed helpers ask for. */
  const scratch = {
    db,
    pool: testDb.client.pool,
    client: testDb.client,
    name: "audit-repin-wiring",
    drop: () => testDb.drop(),
  };

  pinner = await seedAccount(scratch, "audit-repin-pinner");
  publisher = await seedAccount(scratch, "audit-repin-publisher");
  thirdAccount = await seedAccount(scratch, "audit-repin-third");

  const corpus = resolvingCorpus();
  const repin = repinOneCard(corpus);
  card = repin.card;
  toVersion = repin.to;

  /* Step 1: an existing pinner of the card's BASE version, published before anybody repins
     anything. This is the account the wiring is supposed to reach in step 3. */
  await publishBundle(scratch, pinner, corpus, "audit-repin-pinner-bundle", "1.0.0", "public");

  /* Step 2: the PUBLISHER's own bundle also pins the base version, byte-identical to step 1's
     card — `added=false` for this card, so it enqueues nothing, but it makes `publisher`
     structurally a recipient of its own future repin, which is what step 3's exclusion has to
     override rather than get for free (D-190-09(2)'s own two-halves discipline). */
  await publishBundle(scratch, publisher, corpus, "audit-repin-publisher-bundle", "1.0.0", "public");

  before1 = { pinner: await queueRowsFor(pinner.accountId), publisher: await queueRowsFor(publisher.accountId) };

  /* Step 3, THE CELL UNDER TEST: `publisher` appends a release that repins ONE card to a
     version nobody has stored before. If `publish.ts` calls `enqueueRepinEvents` here, `pinner`
     (an existing third-party pinner) gets exactly one row and `publisher` gets none. */
  await publishBundle(scratch, publisher, repin.corpus, "audit-repin-publisher-bundle", "1.1.0", "public");

  afterRepin = { pinner: await queueRowsFor(pinner.accountId), publisher: await queueRowsFor(publisher.accountId) };

  /* Step 4: a THIRD account publishes a brand new bundle pinning the exact same (already
     landed) repinned bytes. `publishCard` answers `added=false` for every card here — the
     bumped one included — so this must enqueue nothing at all. */
  await publishBundle(scratch, thirdAccount, repin.corpus, "audit-repin-third-bundle", "1.0.0", "public");

  afterRepublish = { pinner: await queueRowsFor(pinner.accountId) };

  /* Step 5: replay the EXACT call step 3's wiring made. See the file header for why this is
     the one place the verb is called directly rather than through `publish()`. */
  await enqueueRepinEvents(db, card, toVersion, publisher.accountId);

  afterRetry = { pinner: await queueRowsFor(pinner.accountId) };
}, 80_000);

afterAll(async () => {
  await testDb?.drop();
});

describe("audit: publish() actually calls enqueueRepinEvents (docs/ARCHITECTURE.md §11.1)", () => {
  it("repinning a card through publish() queues exactly one `repin` row for an existing third-party pinner", () => {
    const added = afterRepin.pinner.slice(before1.pinner.length);
    expect(
      added,
      `publishBundle() repinned \`${card}\` to \`${toVersion}\` while \`${pinner.handle}\` already ` +
        `pinned an earlier version of it, and the queue gained ${added.length} row(s) for that ` +
        `account instead of 1.\n` +
        `  docs/ARCHITECTURE.md §11.1: "a publish-path cell asserting a queue row per newly stored ` +
        `card version is owed." If \`lib/server/publish/publish.ts\` no longer calls ` +
        `\`enqueueRepinEvents\` after storing a newly-added card version, this is the row that goes ` +
        `missing — D-190-04's wiring, deferred to "the orchestrator's merge-time visit" and never ` +
        `witnessed through \`publish()\` until this file.`,
    ).toHaveLength(1);
    expect(added[0]!.kind).toBe("repin");
    expect(
      added[0]!.subject,
      "D-190-07(1): the repin subject is `{ cardId, version }`, exactly those two keys.",
    ).toEqual({ cardId: card, version: toVersion });
  });

  it("D-190-09(2): the publisher is excluded from its own repin, even though its own bundle also pins the card", () => {
    const publisherAdded = afterRepin.publisher.slice(before1.publisher.length);
    expect(
      publisherAdded,
      `\`${publisher.handle}\` published the repin AND already pinned the card through its own ` +
        `first release (step 2), so without the exclusion this account is a genuine recipient of ` +
        `its own announcement. Got ${publisherAdded.length} row(s); the publish path must pass its ` +
        `own owner id as \`enqueueRepinEvents\`'s fourth argument. "An account that pins a card and ` +
        `then publishes its new version must not announce the publish to itself."`,
    ).toEqual([]);
  });

  it("AC3: republishing the already-landed card bytes under a brand new bundle enqueues nothing new", () => {
    const stillPinner = afterRepublish.pinner;
    expect(
      stillPinner,
      `a THIRD account published the identical repinned card bytes (a fresh bundle, so it is not ` +
        `the digest-conflict path) and \`${pinner.handle}\`'s queue changed from ` +
        `${afterRepin.pinner.length} row(s) to ${stillPinner.length}. \`publishCard\` answers ` +
        `\`added=false\` when the exact bytes are already stored, and the call site reads ` +
        `\`if (added) await enqueueRepinEvents(...)\` for exactly this reason — "a byte-identical ` +
        `re-publish stored nothing and was announced when it first landed."`,
    ).toEqual(afterRepin.pinner);
  });

  it("AC4: a retried invocation of the wiring's own call cannot duplicate the row (the unique key)", () => {
    expect(
      afterRetry.pinner,
      `\`enqueueRepinEvents(db, "${card}", "${toVersion}", <publisher>)\` was invoked a second time ` +
        `with the exact arguments the publish-path wiring passed it in step 3, and ` +
        `\`${pinner.handle}\`'s queue grew from ${afterRepublish.pinner.length} row(s) to ` +
        `${afterRetry.pinner.length}. \`publish.ts\`'s own comment on the call site: "the queue's ` +
        `unique key makes a retried publish enqueue the same rows, not new ones" — the unique index ` +
        `on \`(kind, account_id, subject_digest)\` is what a driver-level retry of this exact call ` +
        `relies on, and this is that retry.`,
    ).toEqual(afterRepublish.pinner);
  });
});
