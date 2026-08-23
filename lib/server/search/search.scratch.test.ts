/**
 * Scratch coverage against a real database, run by the implementer only —
 * does not count as verification (docs/ORCHESTRATION.md, Agent A). The blind
 * author's suite in `tests/server/t200/**` is the one that measures a
 * criterion; this exists because the four database-backed entry points would
 * otherwise have typechecked, linted and NEVER RUN, and a module whose only
 * green is a typecheck is a module nobody has driven.
 *
 * `describe.skipIf` is deliberate and its cost is stated rather than hidden: with
 * no `DATABASE_URL` this file reports SKIPPED cells, and a run with `skipped > 0`
 * is INVALID rather than a zero. Read the skipped count before the failed count.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { bundleDigest } from "@/lib/core";
import { schema, type DbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "../../../tests/support/db";
import { searchBlueprints } from "./blueprints";
import { searchCards } from "./cards";
import { reembedRelease } from "./reembed";
import { searchTerms } from "./terms";

const hasDb = Boolean(process.env.DATABASE_URL);

const ANON: Actor = { kind: "anonymous" };

describe.skipIf(!hasDb)("lib/server/search", () => {
  let testDb: TestDb | undefined;
  let client: DbClient;

  beforeAll(async () => {
    testDb = await createTestDb();
    client = testDb.client;
  });

  beforeEach(async () => {
    await resetTestDb(client);
  });

  afterAll(async () => {
    /* Optional-call, not `testDb.drop()`: a `beforeAll` that failed never assigned it, and
       an unguarded deref throws out of the teardown and buries the real cause. */
    await testDb?.drop();
  });

  /* --------------------- fixtures --------------------- */

  async function account(handle: string): Promise<string> {
    const [row] = await client.db
      .insert(schema.account)
      .values({ githubId: handle, githubLogin: handle, handle })
      .returning();
    return row.id;
  }

  function card(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id,
      name: `Card ${id}`,
      type: "agent",
      phases: ["planning"],
      action: "do-something",
      spec: "A specification.",
      model: "claude-opus-5",
      tools: [],
      riskMarkers: [],
      requiresHuman: false,
      ontologyVersion: "0.1.0",
      ...over,
    };
  }

  interface PublishOptions {
    owner: string;
    slug: string;
    visibility?: "public" | "private";
    title?: string;
    summary?: string;
    tags?: string[];
    category?: string;
    cards?: Record<string, unknown>[];
    vocabulary?: { text: string; terms: unknown[] };
    lineage?: { ownerId: string; slug: string };
  }

  /** One bundle at one release, with its cards. Returns the ids the assertions need. */
  async function publish(options: PublishOptions): Promise<{ bundleId: string; digest: string }> {
    const [bundle] = await client.db
      .insert(schema.bundle)
      .values({
        ownerId: options.owner,
        slug: options.slug,
        visibility: options.visibility ?? "public",
        lineageOwnerId: options.lineage?.ownerId,
        lineageSlug: options.lineage?.slug,
        lineageVersion: options.lineage === undefined ? undefined : "1.0.0",
      })
      .returning();

    /* Defaulted PER SLUG, not to one shared id: `card_version` is unique on
       `(card_id, version)`, so two bundles both defaulting to `solver-a@1.0.0` raise a
       23505 out of the fixture and four cells report it as four different failures. */
    const cards = options.cards ?? [card(`${options.slug}-solver`)];
    const cardRefs: string[] = [];
    const cardDigests: string[] = [];
    for (const body of cards) {
      const ref = `${String(body.id)}@1.0.0`;
      const digest = `sha256:${String(body.id).padEnd(64, "0").slice(0, 64)}`;
      cardRefs.push(ref);
      cardDigests.push(digest);
      await client.db.insert(schema.cardVersion).values({
        cardId: String(body.id),
        version: "1.0.0",
        digest,
        ownerId: options.owner,
        visibility: options.visibility ?? "public",
        body,
        source: "id: x\n",
      });
    }

    const dot = `digraph { ${options.slug} }`;
    const digest = bundleDigest({ dot, cardDigests });
    await client.db.insert(schema.release).values({
      bundleId: bundle.id,
      version: "1.0.0",
      digest,
      dot,
      manifest: {
        slug: options.slug,
        title: options.title ?? options.slug,
        summary: options.summary ?? "A summary.",
        category: options.category,
        tags: options.tags ?? [],
        ontologyVersion: "0.1.0",
      },
      cardRefs,
      cardDigests,
      localVocabulary: options.vocabulary,
    });
    return { bundleId: bundle.id, digest };
  }

  async function vocabulary(terms: { id: string; kind: string; label: string }[]): Promise<void> {
    const [version] = await client.db
      .insert(schema.ontologyVersion)
      .values({ version: "0.1.0", digest: "sha256:v" })
      .returning();
    for (const term of terms) {
      await client.db.insert(schema.ontologyTerm).values({
        ontologyVersionId: version.id,
        termId: term.id,
        kind: term.kind as "node-type",
        body: { ...term, description: `The ${term.label} term.`, since: "0.1.0" },
      });
    }
  }

  /* --------------------- the criteria, driven --------------------- */

  it("filters on every listed key and ignores one nobody published", async () => {
    const owner = await account("alice");
    await publish({ owner, slug: "triage", tags: ["rag"], category: "ops" });
    await publish({ owner, slug: "janitor", tags: ["batch"], category: "data" });

    const byTag = await searchBlueprints(client.db, ANON, { tag: "rag" });
    expect(byTag.hits.map((hit) => hit.item.slug)).toEqual(["triage"]);

    const byCat = await searchBlueprints(client.db, ANON, { cat: "data" });
    expect(byCat.hits.map((hit) => hit.item.slug)).toEqual(["janitor"]);

    /* The load-bearing one: the unknown key was ignored WHILE a known key was honoured. A
       function that ignores every key passes a bare "unknown key does not error" cell. */
    const withJunk = await searchBlueprints(client.db, ANON, { tag: "rag", gibberish: "x" });
    expect(withJunk.hits.map((hit) => hit.item.slug)).toEqual(["triage"]);
  });

  it("answers an empty result with the vocabularies rather than nothing", async () => {
    const owner = await account("alice");
    await publish({ owner, slug: "triage", tags: ["rag"], category: "ops" });

    const empty = await searchBlueprints(client.db, ANON, { q: "nothingmatchesthis" });
    expect(empty.hits).toEqual([]);
    // Computed from the vocabulary, so it is populated exactly when a reader needs it most.
    expect(empty.facets.tag).toEqual(["rag"]);
    expect(empty.facets.cat).toEqual(["ops"]);
  });

  it("hides private content from every caller, its own owner and the operator included", async () => {
    const owner = await account("alice");
    const secret = await publish({ owner, slug: "secret", visibility: "private" });
    await publish({ owner, slug: "open" });

    const kinds: Actor[] = [
      { kind: "anonymous" },
      { kind: "account", accountId: owner, handle: "alice" },
      { kind: "operator", accountId: owner },
    ];
    for (const actor of kinds) {
      const results = await searchBlueprints(client.db, actor, {});
      expect(results.hits.map((hit) => hit.item.slug)).toEqual(["open"]);
    }

    /* The control that stops the assertion above being vacuous: a search returning nothing
       satisfies "private never appears" and says nothing at all. Flip the row public and it
       has to show up for the same three callers. */
    await client.db.update(schema.bundle).set({ visibility: "public" }).where(eq(schema.bundle.id, secret.bundleId));
    await client.db.update(schema.cardVersion).set({ visibility: "public" });
    for (const actor of kinds) {
      const results = await searchBlueprints(client.db, actor, {});
      expect(results.hits.map((hit) => hit.item.slug)).toEqual(["open", "secret"]);
    }
  });

  it("explains a rank it claims, and claims none when it did not make one", async () => {
    const owner = await account("alice");
    await publish({ owner, slug: "triage", title: "Frontline triage", tags: ["triage"] });
    await publish({ owner, slug: "janitor", title: "Nightly janitor", summary: "Triage leftovers." });

    const ranked = await searchBlueprints(client.db, ANON, { q: "triage" });
    expect(ranked.ordered).toBe(true);
    for (const hit of ranked.hits) expect(hit.evidence.length).toBeGreaterThan(0);
    // More places matched ranks higher, and the evidence says which places.
    expect(ranked.hits[0].item.slug).toBe("triage");
    expect(ranked.hits[0].evidence).toContain("tag:triage");

    const listing = await searchBlueprints(client.db, ANON, {});
    expect(listing.ordered).toBe(false);
    expect(listing.hits.every((hit) => hit.evidence.length === 0)).toBe(true);
  });

  it("searches cards over their own fields and keeps the shelf's own filters", async () => {
    const owner = await account("alice");
    await vocabulary([
      { id: "agent", kind: "node-type", label: "Agent" },
      { id: "human-input", kind: "node-type", label: "Human input" },
      { id: "prompt-injection", kind: "risk-marker", label: "Prompt injection" },
    ]);
    await publish({
      owner,
      slug: "triage",
      cards: [
        card("solver-a", { spec: "Resolves an escalation." }),
        card("gate-b", { type: "human-input", requiresHuman: true, phases: [], riskMarkers: ["prompt-injection"] }),
      ],
    });

    const human = await searchCards(client.db, ANON, { human: "1" });
    expect(human.hits.map((hit) => hit.item.id)).toEqual(["gate-b"]);

    const risky = await searchCards(client.db, ANON, { risk: "1" });
    expect(risky.hits.map((hit) => hit.item.id)).toEqual(["gate-b"]);

    const unphased = await searchCards(client.db, ANON, { phase: "unphased" });
    expect(unphased.hits.map((hit) => hit.item.id)).toEqual(["gate-b"]);

    // The prose the Goal asks about lives in `spec`, and the evidence says so.
    const prose = await searchCards(client.db, ANON, { q: "escalation" });
    expect(prose.hits.map((hit) => hit.item.id)).toEqual(["solver-a"]);
    expect(prose.hits[0].evidence).toEqual(["spec:escalation"]);

    // Vocabularies, not a projection of the hit set.
    expect(risky.facets.type).toEqual(["agent", "human-input"]);
    expect(risky.facets.risk).toEqual(["prompt-injection"]);
  });

  it("reads both term corpora, and a private bundle's local terms reach nobody", async () => {
    const owner = await account("alice");
    await vocabulary([{ id: "agent", kind: "node-type", label: "Agent" }]);
    await publish({
      owner,
      slug: "open",
      vocabulary: {
        text: "terms: []\n",
        terms: [{ id: "alice/repair", kind: "node-type", label: "Repair", description: "d", since: "0.1.0" }],
      },
    });
    await publish({
      owner,
      slug: "secret",
      visibility: "private",
      vocabulary: {
        text: "terms: []\n",
        terms: [{ id: "alice/hidden", kind: "node-type", label: "Hidden", description: "d", since: "0.1.0" }],
      },
    });

    const operator: Actor = { kind: "operator", accountId: owner };
    for (const actor of [ANON, operator]) {
      const all = await searchTerms(client.db, actor, {});
      const ids = all.hits.map((hit) => hit.item.id);
      expect(ids).toContain("agent");
      expect(ids).toContain("alice/repair");
      // The least obvious surface, and the easiest to ship leaking.
      expect(ids).not.toContain("alice/hidden");

      // `origin=local` filters something rather than nothing, which is why both corpora are read.
      const local = await searchTerms(client.db, actor, { origin: "local" });
      expect(local.hits.map((hit) => hit.item.id)).toEqual(["alice/repair"]);
      const core = await searchTerms(client.db, actor, { origin: "core" });
      expect(core.hits.map((hit) => hit.item.id)).toEqual(["agent"]);
    }
  });

  it("embeds a release and its cards, once, reproducibly", async () => {
    const owner = await account("alice");
    const { bundleId, digest } = await publish({ owner, slug: "triage" });

    // Positive control: a release with no row gets one, and so does every card it pins.
    expect(await embeddingCount()).toEqual({ releases: 0, cards: 0 });
    await reembedRelease(client.db, bundleId, digest);
    expect(await embeddingCount()).toEqual({ releases: 1, cards: 1 });

    // Idempotency: a second call leaves both columns byte-identical. Compared as `::text`,
    // because a `Date` round trip TRUNCATES Postgres microseconds and would call two
    // different rows equal.
    const before = await embeddingRows();
    await reembedRelease(client.db, bundleId, digest);
    expect(await embeddingRows()).toEqual(before);

    /* Determinism: delete and re-embed reproduces the same VECTOR. Not implied by the two
       above, and the one that catches a derivation seeded from anything ambient.

       `created_at` is deliberately excluded here where idempotency includes it, and the
       difference is the whole point: the re-embedded row is genuinely NEW, so its timestamp
       must differ and comparing it would assert the opposite of what this cell is about.
       Asserting both in one comparison is what conflates the two claims. */
    await client.db.delete(schema.releaseEmbedding);
    await reembedRelease(client.db, bundleId, digest);
    expect(await embeddingVectors()).toEqual(vectorsOf(before));

    // An absent release writes nothing and does not throw.
    await expect(reembedRelease(client.db, bundleId, "sha256:absent")).resolves.toBeUndefined();
    expect(await embeddingCount()).toEqual({ releases: 1, cards: 1 });
  });

  /* --------------------- readers the assertions need --------------------- */

  async function embeddingCount(): Promise<{ releases: number; cards: number }> {
    const releases = await client.db.select().from(schema.releaseEmbedding);
    const cards = await client.db.select().from(schema.cardVersionEmbedding);
    return { releases: releases.length, cards: cards.length };
  }

  /** The vectors alone, for the claim that is about the derivation and not about the row. */
  async function embeddingVectors(): Promise<unknown[]> {
    return vectorsOf(await embeddingRows());
  }

  function vectorsOf(rows: readonly unknown[]): unknown[] {
    return rows.map((row) => (row as { embedding: string }).embedding);
  }

  /** Both columns as text, so nothing is compared through a lossy `Date`. */
  async function embeddingRows(): Promise<unknown[]> {
    const { rows } = await client.pool.query(
      `select release_id::text, embedding::text, created_at::text from release_embedding
       union all
       select card_version_id::text, embedding::text, created_at::text from card_version_embedding
       order by 1`,
    );
    return rows;
  }
});
