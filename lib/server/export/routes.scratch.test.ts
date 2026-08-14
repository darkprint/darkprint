/**
 * Scratch coverage of `app/api/files/**`, run by the implementer only — does not count as
 * verification (docs/ORCHESTRATION.md, Agent A).
 *
 * ── Why a test about `app/` lives under `lib/` ──
 * `vitest.config.ts` collects `lib/**`, `components/**`, `scripts/**` and `tests/**` —
 * **not `app/**`** — so a test placed beside the route files it covers would never be
 * collected, and a suite that is never collected reports zero tests and calls it green,
 * which is the exact failure that config's own comment records about `.test.tsx`. The
 * config belongs to neither task's `Owns` and is not editable from here, so the choice is
 * between coverage in the wrong directory and no coverage at all. Reported to the
 * orchestrator; every cutover task and T080 inherit the same constraint.
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
import { CORE_ONTOLOGY, type CardRef } from "@/lib/core";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { schema } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { addCard } from "@/lib/server/cards";
import { addOntologyVersion } from "@/lib/server/ontology";
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
    await addOntologyVersion(db, {
      version: entry.bundle.manifest.ontologyVersion,
      terms: CORE_ONTOLOGY.terms,
    });

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
      params: Promise.resolve({ owner: "routes", slug, digest: release.digest, path: ["blueprint.dot"] }),
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
});
