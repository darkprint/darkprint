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
import { SIMILAR_EVIDENCE } from "./embed";

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

  /* A `vocabulary(terms)` helper stood here, writing an `ontology_version` row and its
     `ontology_term` children. No cell in this file called it, and
     `0009_drop_ontology_versioning` dropped both tables: the registry keeps one vocabulary,
     `CORE_ONTOLOGY` in the process, merged per bundle with `release.local_vocabulary`, which
     is what `PublishOptions.vocabulary` above already writes. */

  /* --------------------- AC1, AC3 and the visibility of a vector --------------------- */

  const CONSENSUS =
    "Two agents solve the same task from opposite temperatures, then a consensus node " +
    "negotiates a single answer, re-opening the debate when they clash.";
  /**
   * A paraphrase of `CONSENSUS` that carries NO occurrence of the word the AC3 cell queries
   * with. That is what makes it reachable only through the vector channel, and it is the
   * whole reason this third blueprint exists — see the cell.
   */
  const ARBITER =
    "Two competing agents argue opposite proposals and an arbiter reconciles them into one " +
    "agreed outcome, re-opening the dispute when they disagree.";
  const JANITOR =
    "Sweeps stale records overnight on a schedule, compacting tables and archiving rows " +
    "nobody has read in ninety days.";

  async function seedAndEmbed(): Promise<string> {
    const owner = await account("alice");
    const a = await publish({ owner, slug: "consensus-line", title: "Adversarial Consensus Line", summary: CONSENSUS });
    const b = await publish({ owner, slug: "data-janitor", title: "Nightly Data Janitor", summary: JANITOR });
    await reembedRelease(client.db, a.bundleId, a.digest);
    await reembedRelease(client.db, b.bundleId, b.digest);
    return owner;
  }

  it("AC1: a query sharing NO literal token retrieves the paraphrased blueprint", async () => {
    await seedAndEmbed();
    const q = "rival bots settle a dispute by themselves";

    // The premise: the query really does share no content word with the target.
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ");
    const stop = new Set(["a","an","the","and","by","with","when","they","then","from","same","two"]);
    const doc = new Set([...norm(CONSENSUS), ...norm("Adversarial Consensus Line"), ...norm("consensus-line")]);
    const shared = norm(q).filter((w) => !stop.has(w) && w.length > 2 && doc.has(w));
    expect(shared, `the query must share NO content word, or this cell is not AC1`).toEqual([]);

    const results = await searchBlueprints(client.db, ANON, { q });
    const slugs = results.hits.map((h) => h.item.slug);
    expect(slugs).toContain("consensus-line");

    const hit = results.hits.find((h) => h.item.slug === "consensus-line");
    expect(hit?.evidence).toEqual([SIMILAR_EVIDENCE]);
  });

  it("AC3: a semantic-only hit never outranks a lexical one, and the law still computes", async () => {
    /* ── THIS CELL WAS INERT AND THE PREMISES BELOW ARE THE REPAIR ──

       The first version guarded its only real assertion — `if (firstSemantic !== -1)` — and
       the fixture produced `lexical: 1, semantic: 0`, so that line NEVER EXECUTED. A cell
       named for AC3's ordering had never once asserted AC3's ordering, and it passed. The
       two-blueprint world could not produce a mixed response at all: `data-janitor` measures
       cosine 0.125 against `q=consensus`, below the 0.20 cutoff.

       Found by auditing my own cells for a shape the blind author had just reported in one
       of its own — a probe that cannot reach the condition it names.

       The fixture is only half the fix. A world that reaches the condition today can stop
       reaching it tomorrow, because `SIMILAR_MIN` is a published constant somebody may
       re-calibrate and these cosines sit within 0.06 of it. So both channels are asserted
       NON-EMPTY as premises: if this world ever goes quiet again, it reds here with a
       message saying so, instead of passing while measuring nothing. */
    const owner = await seedAndEmbed();
    const arbiter = await publish({
      owner,
      slug: "rival-solvers",
      title: "Rival Solvers Arbitration",
      summary: ARBITER,
    });
    await reembedRelease(client.db, arbiter.bundleId, arbiter.digest);

    /* `consensus` is in the first blueprint's slug, title, summary and card ref, so it is a
       LEXICAL hit; it is absent from `ARBITER`, which the vector channel reaches at 0.2599
       and which therefore arrives marked. One of each is what AC3 is about. */
    const results = await searchBlueprints(client.db, ANON, { q: "consensus" });
    const lexical = results.hits.filter((h) => !h.evidence.includes(SIMILAR_EVIDENCE));
    const semantic = results.hits.filter((h) => h.evidence.includes(SIMILAR_EVIDENCE));

    expect(
      lexical.length,
      "no lexical hit: AC3 compares the two channels and this world has only one",
    ).toBeGreaterThan(0);
    expect(
      semantic.length,
      `no semantic-only hit: the vector channel returned nothing, so the ordering assertion ` +
        `below would measure NOTHING. This is the premise that failed silently in the first ` +
        `version of this cell. Check SIMILAR_MIN against cos(q="consensus", ARBITER) ~ 0.26 ` +
        `before repairing anything else.`,
    ).toBeGreaterThan(0);

    /* UNGUARDED, which is the point: with both premises held there is no input on which
       this line does not run. */
    const lastLexical = results.hits.findLastIndex((h) => !h.evidence.includes(SIMILAR_EVIDENCE));
    const firstSemantic = results.hits.findIndex((h) => h.evidence.includes(SIMILAR_EVIDENCE));
    expect(firstSemantic).toBeGreaterThan(lastLexical);

    expect(results.ordered).toBe(true);
  });

  it("a PRIVATE blueprint with a stored vector is never an answer", async () => {
    const owner = await account("bob");
    const secret = await publish({
      owner, slug: "secret-line", visibility: "private",
      title: "Adversarial Consensus Line", summary: CONSENSUS,
    });
    await reembedRelease(client.db, secret.bundleId, secret.digest);

    // The premise: the vector really was written. reembedRelease does not consult visibility.
    const stored = await client.db.select().from(schema.releaseEmbedding);
    expect(stored.length, "the private release must HAVE a vector, or this cell proves nothing").toBe(1);

    const results = await searchBlueprints(client.db, ANON, { q: "rival bots settle a dispute by themselves" });
    expect(results.hits.map((h) => h.item.slug)).not.toContain("secret-line");
    expect(results.hits).toEqual([]);
  });

  it("AC2: a token query is unmoved when nothing has been embedded", async () => {
    const owner = await account("carol");
    await publish({ owner, slug: "triage", title: "Frontline Triage", summary: "Sorts tickets." });
    /* No vectors in this world, and the reason is worth pinning because it CHANGED. The
       `publish` above is this file's own fixture — a direct `insert(schema.release)` — and
       NOT `lib/server/publish`'s `publish()`, which since D-300-06 F4.2 calls
       `reembedRelease` inside its transaction and would leave vectors behind. T200's suite
       builds its worlds the same way (a local `insertRelease`, and it imports nothing from
       `@/lib/server/publish`), which is what makes AC2 hold by construction: no embeddings,
       so the channel has nothing to return and the lexical answer is untouched. */
    const results = await searchBlueprints(client.db, ANON, { q: "triage" });
    expect(results.hits.map((h) => h.item.slug)).toEqual(["triage"]);
    expect(results.hits[0].evidence).not.toContain(SIMILAR_EVIDENCE);
    expect(results.ordered).toBe(true);
  });
});
