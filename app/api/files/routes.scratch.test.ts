/**
 * Scratch coverage of `app/api/files/**`, run by the implementer only — does not count as
 * verification.
 *
 * It sat under `lib/server/export/` for one round, because `vitest.config.ts` did not
 * collect `app/**` and an uncollected suite runs zero tests and reads as green. Reported,
 * and `3c8d395` added the glob, so it now lives beside the files it covers.
 *
 * ── Why this does not touch the shared database ──
 * `getSharedDbClient()` is lazy and cached on `globalThis`, so pointing `DATABASE_URL` at
 * a scratch database before the first handler call binds the routes to it and never to
 * the shared development one. Both are put back in `afterAll`, and the cached pool is
 * closed and evicted there — without that the DROP fails with "is being accessed by other
 * users" and leaves the database behind, which is how this file leaked one on its first
 * run.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CardRef } from "@/lib/core";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { schema } from "@/lib/db";
import { createObjectStorage } from "@/lib/db/storage";
import { addRelease, createBundle } from "@/lib/server/archive";
import { addCard } from "@/lib/server/cards";
import { createTestDb, type TestDb } from "../../../tests/support/db";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("app/api/files routes", () => {
  let testDb: TestDb | undefined;
  let previousUrl: string | undefined;
  let slug: string;
  let pinned: CardRef;

  beforeAll(async () => {
    testDb = await createTestDb();
    previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;

    const db = testDb.client.db;
    const [account] = await db
      .insert(schema.account)
      .values({ githubId: "t090-routes", githubLogin: "t090-routes", handle: "routes" })
      .returning();

    const entry = readContent()[0];
    slug = entry.slug;
    pinned = entry.blueprint.nodes[0].ref;
    /* No ontology version is seeded first. `publish` used to open a view by the version its
       manifest named and refuse one nobody had published, so an unseeded registry could not
       accept a bundle at all; the view is a merge over `CORE_ONTOLOGY` now and there is no
       table to write. */

    const seen = new Set<string>();
    for (const file of entry.cardFiles) {
      const ref = file.file.replace(/^cards\//, "").replace(/\.yaml$/, "") as CardRef;
      if (seen.has(ref)) continue;
      seen.add(ref);
      const body = entry.blueprint.cards.get(ref);
      if (body === undefined) continue;
      await addCard(db, {
        cardId: body.id,
        version: body.version,
        ownerId: account.id,
        body,
        source: file.text,
      });
    }

    const bundle = await createBundle(db, { ownerId: account.id, slug, visibility: "public" });
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
  }, 120_000);

  afterAll(async () => {
    /* The routes opened the shared client against the scratch database and it is cached on
       `globalThis`, so it has to be closed and evicted before the drop — otherwise the
       DROP fails with "is being accessed by other users" and the database is left behind,
       which is residue in the medium this run keeps forgetting. */
    const key = Symbol.for("darkprint.db.sharedClient");
    const withShared = globalThis as unknown as Record<symbol, { close(): Promise<void> } | undefined>;
    await withShared[key]?.close();
    delete withShared[key];
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
    await testDb?.drop();
  });

  it("serves a file at its own content type", async () => {
    const { GET } = await import(
      "@/app/api/files/blueprints/[owner]/[slug]/v/[version]/[...path]/route"
    );
    const response = await GET(new Request("http://x/api/files/..."), {
      params: Promise.resolve({ owner: "routes", slug, version: "1.0.0", path: ["README.md"] }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect((await response.text()).length).toBeGreaterThan(0);
  });

  it("a nested path arrives as one string", async () => {
    const { GET } = await import(
      "@/app/api/files/blueprints/[owner]/[slug]/v/[version]/[...path]/route"
    );
    const response = await GET(new Request("http://x/api/files/..."), {
      params: Promise.resolve({
        owner: "routes",
        slug,
        version: "1.0.0",
        path: ["cards", `${pinned}.yaml`],
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/yaml; charset=utf-8");
  });

  it("an absent release and a refused path give the identical 404 body", async () => {
    const { GET } = await import(
      "@/app/api/files/blueprints/[owner]/[slug]/v/[version]/[...path]/route"
    );
    const absent = await GET(new Request("http://x/api/files/a"), {
      params: Promise.resolve({ owner: "routes", slug: "nope", version: "1.0.0", path: ["README.md"] }),
    });
    const refused = await GET(new Request("http://x/api/files/a"), {
      params: Promise.resolve({ owner: "routes", slug, version: "1.0.0", path: ["..", "..", "etc", "passwd"] }),
    });
    expect(absent.status).toBe(404);
    expect(refused.status).toBe(404);
    expect(absent.headers.get("content-type")).toBe("application/problem+json");
    expect(await refused.text()).toBe(await absent.text());
  });

  it("the digest route answers, and a card resolves with or without the .yaml suffix", async () => {
    const digestRoute = await import(
      "@/app/api/files/blueprints/[owner]/[slug]/d/[digest]/[...path]/route"
    );
    const [release] = await testDb!.client.db.select().from(schema.release);
    const byDigest = await digestRoute.GET(new Request("http://x/api/files/d"), {
      params: Promise.resolve({ owner: "routes", slug, digest: release.digest, path: ["topology.dot"] }),
    });
    expect(byDigest.status).toBe(200);
    expect(byDigest.headers.get("content-type")).toBe("text/vnd.graphviz; charset=utf-8");

    const cards = await import("@/app/api/files/cards/[...ref]/route");
    const withSuffix = await cards.GET(new Request("http://x/api/files/c"), {
      params: Promise.resolve({ ref: [`${pinned}.yaml`] }),
    });
    const bare = await cards.GET(new Request("http://x/api/files/c"), {
      params: Promise.resolve({ ref: [pinned] }),
    });
    expect(withSuffix.status).toBe(200);
    expect(bare.status).toBe(200);
    expect(await withSuffix.text()).toBe(await bare.text());
    expect(withSuffix.headers.get("content-disposition")).toBe(
      `inline; filename="${pinned}.yaml"`,
    );
  });

  /**
   * D-90-A, end to end and through the published surface: control, then an outage, on the
   * same requests — never by constructing the error object, which would prove the class
   * hierarchy and not the classification.
   *
   * The outage is a dropped table, so exactly one statement fails and the connection
   * stays live; killing the connection would take the whole pool down and prove something
   * weaker. Before the fix the blueprint route returned **404 with a `problem+json` body
   * reading "Not found."**, and a caller holding a pinned digest would read that as
   * "withdrawn" and stop retrying — the harm AC6's whole promise is about.
   *
   * **Both paths, because the tell was that the module contradicted itself.** The card
   * read and the ontology read were never wrapped and escaped raw as a 500, while the
   * bundle read answered 404: one outage, two statuses, decided by which statement
   * happened to run first. Each half is measured here separately.
   *
   * The assertion is that the failure **escapes the route**, not that it is literally a
   * 500: turning an uncaught throw into a 500 is Next's job and there is no server here.
   * What this file owns is that `respondWithFile` does not swallow it.
   */
  it("a driver failure escapes as a read error from every path, and is never a 404", async () => {
    const blueprintRoute = await import(
      "@/app/api/files/blueprints/[owner]/[slug]/v/[version]/[...path]/route"
    );
    const cardRoute = await import("@/app/api/files/cards/[...ref]/route");

    const getFile = (): Promise<Response> =>
      blueprintRoute.GET(new Request("http://x/api/files/b"), {
        params: Promise.resolve({ owner: "routes", slug, version: "1.0.0", path: ["README.md"] }),
      });
    const getCard = (): Promise<Response> =>
      cardRoute.GET(new Request("http://x/api/files/c"), {
        params: Promise.resolve({ ref: [pinned] }),
      });

    expect((await getFile()).status).toBe(200);
    expect((await getCard()).status).toBe(200);

    /**
     * Each outage is a **rename away and back**, not a drop, and the order is no longer
     * load-bearing — which it was, wrongly, until the mutation sweep found it.
     *
     * Dropping `ontology_version` first and then `card_version` looked like it observed
     * two sites and observed one: `openView` ran **before** the pinned-card loop, so
     * after the first outage the blueprint route never reached the second, and the
     * assertion labelled "via pinned cards" was still measuring `openView`. Unwrapping
     * the pinned-card catch then reddened **nothing** — a probe that could not reach the
     * guard, wearing the label of one that could. That shadowing went with `openView`'s
     * database read, and the table itself went with 0009; it is exactly why the surviving
     * outages are still isolated one at a time.
     *
     * A rename is reversible, so each site is isolated: break one statement, measure,
     * put it back, and assert the route is 200 again before moving on. That restoration
     * assertion is what makes the next measurement mean anything.
     */
    const breakTable = async (name: string): Promise<void> => {
      /**
       * D-091-04. **Every observation in this cell is of the GENERATE path, and under T091's
       * freeze-on-miss a successful serve WRITES the folder it just built** — so each 200
       * this cell asserts arms the NEXT outage to read frozen bytes and answer 200 where a
       * 500 is required. Each outage is preceded by a 200, so each is exposed.
       *
       * Clearing here rather than at each call site makes it an invariant of an outage —
       * **an outage begins from an unfrozen subject** — instead of three lines somebody can
       * add a fourth outage without. Not re-pointed at a second release on purpose: two
       * releases would make the outages observations of DIFFERENT digests, and the point of
       * the set is that it is the same route over the same bytes failing at different sites.
       *
       * `delete` on a key that was never written is a no-op, so this cannot under-clear —
       * the asymmetry D-091-11 turns on. Before D-091-11 the suite could not even see these
       * writes: the residue ledger is kept at the write, and the implementation had become
       * a writer without the ledger learning of it.
       */
      const [frozen] = await testDb!.client.db.select().from(schema.release);
      await createObjectStorage().delete(frozen!.digest);
      await testDb!.client.query(`ALTER TABLE "${name}" RENAME TO "${name}_hidden"`);
    };
    const fixTable = async (name: string): Promise<void> => {
      await testDb!.client.query(`ALTER TABLE "${name}_hidden" RENAME TO "${name}"`);
    };
    /**
     * The answer is a **500 in the envelope**, not a thrown object: B-03 makes a transport
     * failure `problem+json`, and asserting on a throw would pin the mechanism rather than
     * the behaviour a caller sees. The sealed error is still asserted, at the layer that
     * owns it, in `serve.test.ts`.
     */
    /*
     * Pinned by **exact match against the admissible form**, not by scanning for forbidden
     * substrings — a whitelist asserted with a blacklist test is a blacklist. The first
     * version of this helper did scan, and `not.toContain("release")` reddened against the
     * module's own `detail`, "The release could not be read": T-04's shape, a tell matching
     * legitimate content, arriving in the assertion written to prevent a leak.
     *
     * The expected document is written out here as a literal and never rebuilt from the
     * module, so it cannot go tautological if the constructor starts interpolating.
     */
    const expectReadError = async (
      response: Response,
      where: string,
      instance: string,
    ): Promise<void> => {
      expect(response.status, where).toBe(500);
      expect(response.headers.get("content-type"), where).toBe("application/problem+json");
      expect(await response.text(), where).toBe(
        `{"type":"https://darkprint.io/problems/read-failed",` +
          `"title":"Temporarily unavailable","status":500,` +
          `"detail":"The release could not be read. Try again.","instance":"${instance}"}`,
      );
    };

    /* ── the ontology outage is gone, and it can no longer even be staged ──
       This cell used to open by renaming `ontology_version` away and asserting a 500 out of
       `buildExport`'s `openView`. When `openView` moved to merging over `CORE_ONTOLOGY` with
       no statement of its own, the outage stopped being constructible and the block was kept
       as an affirmative 200 — "an outage I can no longer construct" and "an outage the route
       now swallows" being the same green otherwise. `0009_drop_ontology_versioning` then
       dropped the table, so there is nothing left to rename and the affirmative has no
       subject. The claim it stood for is now held by the schema itself: `tests/server/t005`
       asserts both tables are absent, which no reader can survive if one existed. */

    /* The card read: `serveCard` reaches it directly, `buildExport` through the pinned-card
       loop. Both were unwrapped, and both are separately observed. */
    await breakTable("card_version");
    await expectReadError(await getCard(), "serveCard -> resolveCardRef", "/api/files/c");
    await expectReadError(await getFile(), "buildExport -> pinnedCards", "/api/files/b");
    await fixTable("card_version");
    expect((await getFile()).status).toBe(200);
    expect((await getCard()).status).toBe(200);

    /* And the bundle lookup itself: the first statement the request makes, and the one
       that was answering 404. Dropped rather than renamed, because nothing follows it. */
    await testDb!.client.query('DROP TABLE "release", "bundle" CASCADE');
    await expectReadError(await getFile(), "lookup -> bundleByHandle", "/api/files/b");
  });
});
