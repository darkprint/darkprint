/* ============================================================
   DarkPrint implementer's scratch harness for `releaseFiles.readme`
   — not the criterion suite (docs/ORCHESTRATION.md, Agent A).
   T261's blind suite already drives the file LIST and the
   counter pair from its own fixture; this file exists for the one
   field that suite cannot see, the README text the blueprint page
   now renders in place of a link.

   Two cells, and they are two because the field has two ways to
   be wrong and only one of them looks like a bug:
   1. the text stops being carried, which the page shows as an
      empty README and a reader reads as "this bundle has none";
   2. the text is carried for a release the actor may not read,
      which nothing on screen shows at all. Widening a return
      value is exactly how a read gets widened by accident, so the
      refusal is pinned in the same file as the addition.

   ── what a skip means ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap: an unsourced shell turns both cells into silence
   at exit 0. **The skipped count is part of this file's result**;
   a run reporting these as skipped has measured neither property.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardRef } from "@/lib/core";
import { BUNDLE_README } from "@/lib/content/bundle-export";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { schema, type Db } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { addCard } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support/db";
import { exportRelease, releaseFiles } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

const OWNER = "rfreadmeowner";
const STRANGER = "rfreadmestranger";

describe.skipIf(!hasDb)("lib/server/export releaseFiles — the README it carries", () => {
  let testDb: TestDb | undefined;
  let db: Db;

  let ownerId = "";
  let strangerId = "";
  let publicSlug = "";
  let privateSlug = "";
  let publicBundleId = "";

  const asOwner = (): Actor => ({ kind: "account", accountId: ownerId, handle: OWNER });
  const asStranger = (): Actor => ({ kind: "account", accountId: strangerId, handle: STRANGER });
  const anonymous: Actor = { kind: "anonymous" };

  /** One release of the archive's own first entry, at a caller-chosen slug and visibility. */
  async function seedBundle(slug: string, visibility: "public" | "private"): Promise<string> {
    const entry = readContent()[0];
    const bundle = await createBundle(db, { ownerId, slug, visibility });
    const vocabulary = contentVocabulary();
    await addRelease(db, {
      bundleId: bundle.id,
      version: "1.0.0",
      dot: entry.bundle.dot,
      manifest: entry.bundle.manifest,
      cardRefs: entry.blueprint.nodes.map((node) => node.ref),
      cardDigests: entry.blueprint.nodes.map((node) => node.digest),
      ...(vocabulary === undefined
        ? {}
        : { vocabulary: { text: vocabulary.text, terms: vocabulary.terms } }),
      analysis: {
        autonomy: entry.analysis.autonomy,
        security: entry.analysis.security,
        phaseCoverage: entry.analysis.phaseCoverage,
      },
    });
    return bundle.id;
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;

    const [owner] = await db
      .insert(schema.account)
      .values({ githubId: "rf-readme-owner", githubLogin: "rf-readme-owner", handle: OWNER })
      .returning();
    const [stranger] = await db
      .insert(schema.account)
      .values({ githubId: "rf-readme-stranger", githubLogin: "rf-readme-stranger", handle: STRANGER })
      .returning();
    ownerId = owner.id;
    strangerId = stranger.id;

    const entry = readContent()[0];
    const seen = new Set<string>();
    for (const file of entry.cardFiles) {
      const ref = file.file.replace(/^cards\//, "").replace(/\.yaml$/, "") as CardRef;
      if (seen.has(ref)) continue;
      seen.add(ref);
      const body = entry.blueprint.cards.get(ref);
      if (body === undefined) continue;
      await addCard(db, { cardId: body.id, version: body.version, ownerId, body, source: file.text });
    }

    publicSlug = `${entry.slug}-readme-public`;
    privateSlug = `${entry.slug}-readme-private`;
    publicBundleId = await seedBundle(publicSlug, "public");
    await seedBundle(privateSlug, "private");
  }, 60_000);

  afterAll(async () => {
    await testDb?.drop();
  });

  /**
   * Reds if the text stops being carried. Three anchors rather than one, because each
   * catches a different way of losing it and the cheap one catches the fewest:
   *
   * - it is the export's own `README.md`, byte for byte, so a truncation or a re-render
   *   through some other writer fails here even though something non-empty arrived;
   * - it quotes `listing.digest`, which is the registry's stored column, while the text
   *   quotes the digest `buildExport` recomputed off the reassembled bundle. Those are two
   *   independent derivations, so this fails if `readme` is ever filled from a different
   *   release than the one `files` and `digest` describe;
   * - `files` still names the README, which is what says the two halves of this record
   *   agree about the folder.
   *
   * Falsified twice, both reverted. `readme: undefined` in place of the lookup reds this
   * cell AND the vacuity guard in the one below (2 failed / 0 passed); truncating the text
   * with `?.text.slice(0, 40)` reds only the byte-for-byte assertion here, which is what
   * says that assertion is doing work the `toContain` one cannot do.
   *
   * The `undefined` arm has no cell here and that is a statement about the fixture, not an
   * oversight: every release reachable through `addRelease` is exported by `exportBundle`,
   * which always writes a `README.md`. Nothing in the product can currently produce a
   * release without one, so a cell claiming to drive that arm would be driving a stub.
   */
  it("carries the release's README text, from the same export pass and the same release", async () => {
    const listing = await releaseFiles(db, anonymous, { ownerHandle: OWNER, slug: publicSlug });
    expect(listing, "`releaseFiles` answered undefined for a public bundle").toBeDefined();

    const exported = await exportRelease(db, anonymous, publicBundleId, listing!.digest);
    const readme = exported.find((file) => file.path === BUNDLE_README);
    expect(readme, "the fixture release exports no README, so this cell proves nothing").toBeDefined();

    expect(listing!.readme).toBe(readme!.text);
    expect(
      listing!.readme,
      "the README carried does not quote the digest the same record reports, so it came from " +
        "a different release than `files` and `digest` describe",
    ).toContain(listing!.digest);
    expect(listing!.files).toContain(BUNDLE_README);
  });

  /**
   * Pins the refusal against the widening. Three directions, because a cell that only
   * checks the stranger passes just as well against a `releaseFiles` that answers
   * `undefined` for everybody, and against a private release that simply has no README:
   *
   * - the stranger and the anonymous reader get nothing at all, README included;
   * - the owner gets the same private release WITH its README, which is what proves there
   *   was something there to leak;
   * - the public bundle's README is still produced for the anonymous reader in this same
   *   run, so the two refusals above are about visibility and not about an actor who can
   *   read nothing.
   *
   * Falsified, reverted: dropping the `readableBy` guard and building the record under the
   * bundle owner's own actor — a real widening rather than a throw, since `exportRelease`
   * refuses on its own and a guard merely moved would reject instead of leaking — reds the
   * first assertion by its own sentence, `expected { …(4) } to be undefined`. Cell one
   * stays green under it, which is the point of pinning the refusal separately.
   */
  it("a private release refuses the whole record, README included, and its owner still gets one", async () => {
    const toStranger = await releaseFiles(db, asStranger(), {
      ownerHandle: OWNER,
      slug: privateSlug,
    });
    expect(
      toStranger,
      "a stranger read a private release's listing; the README must not become a way in",
    ).toBeUndefined();

    const toAnonymous = await releaseFiles(db, anonymous, {
      ownerHandle: OWNER,
      slug: privateSlug,
    });
    expect(toAnonymous, "an anonymous reader read a private release's listing").toBeUndefined();

    const toOwner = await releaseFiles(db, asOwner(), { ownerHandle: OWNER, slug: privateSlug });
    expect(toOwner, "the owner was refused their own private release").toBeDefined();
    expect(
      toOwner!.readme,
      "the private fixture carries no README, so the two refusals above are vacuous",
    ).toEqual(expect.stringContaining("#"));

    const publicToAnonymous = await releaseFiles(db, anonymous, {
      ownerHandle: OWNER,
      slug: publicSlug,
    });
    expect(
      publicToAnonymous?.readme,
      "the anonymous reader gets no README anywhere, so refusing them the private one " +
        "measured nothing about visibility",
    ).toEqual(expect.stringContaining("#"));
  });
});
