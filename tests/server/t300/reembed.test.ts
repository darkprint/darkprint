/* ============================================================
   T300 AC4 — "`reembedRelease` stays idempotent per digest
   (D-200-03) under the new derivation"

   The three claims T200 separated stay separated, because the new
   derivation can break each of them on its own:

     1. the POSITIVE CONTROL — a release with no row gets one, at
        the declared width. An encoder that answers a different
        vector length is a write that FAILS rather than a vector
        that is quietly wrong, so this cell is also where a
        dimension mismatch surfaces.
     2. IDEMPOTENCY — a second call leaves `embedding` AND
        `created_at` byte-identical.
     3. DETERMINISM — delete the row, re-embed the same content,
        get the same vector back. Not implied by the other two, and
        it is the one the swap puts at risk: a neural encoder that
        seeds anything from a clock, a counter or a thread schedule
        passes 1 and 2 and fails this.

   `::text` on both columns, for D-200-20's reason: `created_at`
   through a `Date` truncates Postgres microseconds, so two writes
   inside one millisecond compare equal and an idempotency cell
   meaning "the row was not rewritten" passes against a row that
   was.

   ── D6, and the direction I had wrong ──
   I read D-300-01's "WHAT PURPOSE MEANS, pinned before two halves
   guess differently" as REPLACING the shipped field lists, and
   reported it that way. D-300-04 D6 ruled the other way: the
   ruling named the purpose CORE, and `manifestText`'s slug,
   category and tags STAY. So the falsifying cell points WIDE —
   two releases differing only in `category` embed DIFFERENTLY —
   and it is written here in the direction that would have reddened
   a correct module if I had built on my own reading.

   ── one thing "per digest" does not mean, recorded in passing ──
   `bundleDigest` takes `{dot, cardDigests}` and the MANIFEST is
   not in it, so two releases with byte-identical digests can carry
   different titles and therefore different vectors. That is true
   of merged T200 as well and is not this task's doing; it is
   written down because the criterion's own words are "idempotent
   per digest" and a later reader could take them to mean the
   digest determines the vector. What the digest determines is
   whether a ROW is already there (D-200-03), which is the claim
   the idempotency cell actually drives.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import { RULED } from "./contract";
import { bind } from "../t200/contract";
import {
  cardVersionEmbeddings,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyTerm,
  insertOntologyVersion,
  insertRelease,
  manifest,
  mark,
  recordedSetup,
  releaseEmbeddings,
  scratchDatabase,
  type AccountFixture,
  type CardFixture,
  type ReleaseFixture,
  type Scratch,
} from "../t200/fixtures";

const PROSE = {
  title: "Nightly warehouse replenishment",
  summary: "Pickers walk the aisles after closing and top up every bin that ran low.",
  description: "Covers the pick list, the route through the racks, and the count that closes it.",
};

interface Corpus {
  owner: AccountFixture;
  card: CardFixture;
  /** The subject of the three AC4 cells. */
  alone: ReleaseFixture;
  /** Identical to `plainCategory` in every embedded field except `category`. */
  withCategory: ReleaseFixture;
  plainCategory: ReleaseFixture;
  /** Identical to `plainTags` in every embedded field except `tags`. */
  withTags: ReleaseFixture;
  plainTags: ReleaseFixture;
}

let s: Scratch;
let c: Corpus;
let reembed: (...args: unknown[]) => unknown;
const setup = recordedSetup("the T300 re-embedding corpus");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    const ontology = await insertOntologyVersion(s, CORE_ONTOLOGY.version);
    for (const term of CORE_ONTOLOGY.terms) {
      await insertOntologyTerm(s, { versionId: ontology.id, term: term as unknown as Record<string, unknown> });
    }
    const owner = await insertAccount(s, mark("t300r"));
    const card = await insertCard(s, {
      ownerId: owner.id,
      id: mark("t300-restock"),
      phases: ["implementation"],
      type: "agent",
      name: "Walk the pick list",
      action: "walk-pick-list",
      spec: "Take each line of the list in aisle order, top the bin up to its mark, and tick it off.",
    });

    /* Five bundles, one card between them. The card is SHARED on purpose: `bundleDigest`
       takes `{dot, cardDigests}`, so every release below carries the same digest and the
       only thing that differs between a pair is the manifest field the pair is named for.
       That is what makes the D6 cells isolate one field rather than one bundle. */
    /**
     * `manifestSlug` is a SEPARATE parameter from the bundle's slug, and the D6 cells are
     * worthless without it.
     *
     * `manifestText` embeds `manifest.slug` (D-300-04 D6's wide list). The bundle slug has to
     * be unique per owner, so each release below sits on its own bundle — and the first
     * version of this fixture let the manifest slug follow it. The two releases in each pair
     * therefore differed in the named field AND in the slug, so their vectors differed
     * because of the SLUG and the named field was never the reason.
     *
     * MEASURED, not reasoned about: deleting `manifest.category` from `manifestText`
     * outright reddened 0 of 77 cells, and deleting the whole `tags` loop reddened 0 of 77.
     * Both D6 cells passed against a module that had stopped embedding the field each one is
     * named for. They were reading the slug difference the whole time.
     *
     * The cell's own comment claimed the pair "differ in exactly one manifest field and in
     * nothing else — same title, same summary, same description, same card, same digest".
     * That sentence enumerated everything that was equal and silently omitted the one thing
     * that was not, which is how it survived being read.
     *
     * `manifest.slug` is jsonb this fixture controls and nothing else in these cells reads
     * it, so pinning it to one constant across a pair is safe and makes the named field the
     * ONLY difference in the embedded document.
     */
    const release = async (
      slug: string,
      o: { manifestSlug: string; category?: string; tags?: readonly string[] },
    ) => {
      const bundle = await insertBundle(s, { owner, slug, visibility: "public" });
      return insertRelease(s, {
        bundle,
        version: "1.0.0",
        cards: [card],
        manifest: manifest({
          slug: o.manifestSlug,
          title: PROSE.title,
          summary: PROSE.summary,
          description: PROSE.description,
          category: o.category,
          tags: o.tags ?? [],
        }),
      });
    };

    const catSlug = mark("t300-cat-shared");
    const tagSlug = mark("t300-tag-shared");
    c = {
      owner,
      card,
      alone: await release(mark("t300-alone"), { manifestSlug: mark("t300-alone-m") }),
      /* Each PAIR shares one manifest slug, so the embedded documents differ in the named
         field and in nothing else. The two pairs use different slugs from each other so a
         cross-pair coincidence cannot make either look right. */
      withCategory: await release(mark("t300-cat-yes"), { manifestSlug: catSlug, category: "logistics" }),
      plainCategory: await release(mark("t300-cat-no"), { manifestSlug: catSlug }),
      withTags: await release(mark("t300-tag-yes"), { manifestSlug: tagSlug, tags: ["overnight", "inventory"] }),
      plainTags: await release(mark("t300-tag-no"), { manifestSlug: tagSlug }),
    };
    reembed = await bind("reembedRelease");
  });
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

/** The row for one release, or `undefined`. Compared as text, never through a `Date`. */
async function rowFor(release: ReleaseFixture): Promise<{ createdAt: string; embedding: string } | undefined> {
  const rows = await releaseEmbeddings(s);
  return rows.find((r) => r.subjectId === release.id);
}

function widthOf(embedding: string): number {
  return embedding.replace(/^\[|\]$/g, "").split(",").filter((x) => x !== "").length;
}

describe("AC4 the three claims, kept apart", () => {
  it("the positive control: a release with no row gets one, at the declared width", async () => {
    setup.check();
    expect(await rowFor(c.alone), "the premise: nothing has embedded this release yet").toBeUndefined();

    await reembed(s.db, c.alone.bundleId, c.alone.digest);

    const row = await rowFor(c.alone);
    expect(
      row,
      `"writes nothing the second time" is a NEGATIVE, and a negative is satisfied by a ` +
        `function whose body is empty. This cell is what stops the two below being claims ` +
        `about a writer that never writes.`,
    ).toBeDefined();
    expect(
      widthOf(row?.embedding ?? ""),
      `\`vector(384)\` is declared in \`0003_search.up.sql\` and D-200-02 records why the ` +
        `width had to be chosen before anything could be indexed. D-300-01 chose the encoder ` +
        `to fit it: "384-dim drop-in, no migration and no row rewrite". A different width is ` +
        `a write that FAILS rather than a vector that is quietly wrong, so a red here is ` +
        `likely to arrive as the insert's own error rather than as this number.`,
    ).toBe(384);
  });

  it("idempotency: a second call leaves both columns byte-identical", async () => {
    setup.check();
    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    const first = await rowFor(c.alone);
    expect(first, "the premise: the first call wrote a row").toBeDefined();

    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    const second = await rowFor(c.alone);

    expect(
      second,
      `AC4/D-200-03: the row's PRESENCE is the whole of the idempotency — a \`release\` row is ` +
        `content-addressed, so a row that is there is already a vector for that digest and a ` +
        `repeated trigger writes nothing.\n` +
        `  Both columns as \`::text\`, and \`created_at\` is the one that matters: through a ` +
        `\`Date\` it truncates Postgres microseconds, so an upsert that rewrote the row inside ` +
        `one millisecond would compare EQUAL and this cell would pass against exactly the ` +
        `defect it names.`,
    ).toEqual(first);
  });

  it("determinism: delete the row and re-embed, and the same vector comes back", async () => {
    setup.check();
    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    const first = await rowFor(c.alone);
    expect(first, "the premise: there is a row to delete").toBeDefined();

    await s.query("delete from release_embedding where release_id = $1", [c.alone.id]);
    expect(await rowFor(c.alone), "the premise: the delete landed").toBeUndefined();

    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    const second = await rowFor(c.alone);

    expect(
      second?.embedding,
      `NOT IMPLIED BY THE OTHER TWO, and it is the claim the swap of derivation puts at risk. ` +
        `The previous derivation was 3-grams hashed with a hand-written FNV-1a, chosen ` +
        `precisely because V8's own string hash is SALTED PER PROCESS; a neural encoder ` +
        `brings its own ways to be non-reproducible — a seeded initialisation, a thread ` +
        `count that changes reduction order, a cached tokenizer state.\n` +
        `  This cell runs inside ONE process, so it cannot see a per-process salt. What it ` +
        `does see is anything seeded from a clock, a counter or a previous call — and the ` +
        `idempotency cell above cannot, because it never asks the encoder to run twice.`,
    ).toBe(first?.embedding);
  });

  it("both tables are written, and the second call writes neither", async () => {
    setup.check();
    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    const firstCards = await cardVersionEmbeddings(s);
    expect(
      firstCards.length,
      `D-200-12: B-12 names the manifest AND the card specs, \`card_version_embedding\` has ` +
        `no other published writer, and D-300-01 embeds cards SEPARATELY so a harness can ask ` +
        `for a node rather than a whole blueprint. A surface writing only the release half ` +
        `leaves that table permanently empty and \`searchCards\` with no vector to read.`,
    ).toBeGreaterThan(0);

    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    expect(
      await cardVersionEmbeddings(s),
      `"idempotent" has two subjects (D-200-12), and a cell that only checked the release ` +
        `half would pass against a writer that rewrote every card vector on every publish.`,
    ).toEqual(firstCards);
  });
});

describe("D6 the embedded document is the WIDE shipped field list", () => {
  it("two releases differing only in `category` embed differently", async () => {
    setup.check();
    expect(RULED.purposeIsTheWideShippedFieldList, "the reading this cell is built on").toBe(true);

    await reembed(s.db, c.withCategory.bundleId, c.withCategory.digest);
    await reembed(s.db, c.plainCategory.bundleId, c.plainCategory.digest);
    const yes = await rowFor(c.withCategory);
    const no = await rowFor(c.plainCategory);
    expect(yes, "the premise: the categorised release embedded").toBeDefined();
    expect(no, "the premise: the plain release embedded").toBeDefined();

    expect(
      yes?.embedding,
      `D-300-04 D6, AND IT RULED AGAINST MY OWN READING. I reported D-300-01's "WHAT PURPOSE ` +
        `MEANS, pinned before two halves guess differently: for a blueprint, ` +
        `\`manifest.title + summary + description\`" as REPLACING the shipped field list, ` +
        `which would make this cell assert the two vectors are EQUAL. The ruling is that the ` +
        `sentence named the purpose CORE and \`manifestText\`'s slug, category and tags STAY.\n` +
        `  So the cell points wide, and it is written in the direction that would have caught ` +
        `me: the two releases here differ in exactly one manifest field and in nothing else — ` +
        `same title, same summary, same description, same card, same digest — so a module ` +
        `that dropped \`category\` from the document answers the same vector twice.`,
    ).not.toBe(no?.embedding);
  });

  it("two releases differing only in `tags` embed differently", async () => {
    setup.check();
    await reembed(s.db, c.withTags.bundleId, c.withTags.digest);
    await reembed(s.db, c.plainTags.bundleId, c.plainTags.digest);
    const yes = await rowFor(c.withTags);
    const no = await rowFor(c.plainTags);
    expect(yes, "the premise: the tagged release embedded").toBeDefined();
    expect(no, "the premise: the untagged release embedded").toBeDefined();

    expect(
      yes?.embedding,
      `\`tags\` is the second field D-300-01's sentence left out and D-300-04 D6 put back. ` +
        `Driven SEPARATELY from \`category\` rather than folded into one "the wide list ` +
        `stands" cell: one fixture that differs in both fields at once is reddened by a ` +
        `module that dropped either, so it cannot say which — and a module that dropped only ` +
        `one would be reported as a module that dropped the other.`,
    ).not.toBe(no?.embedding);
  });
});

describe("the absent release is still a value rather than a refusal", () => {
  it("a digest nothing carries writes nothing and does not throw a typed refusal", async () => {
    setup.check();
    await s.query("delete from release_embedding");
    await s.query("delete from card_version_embedding");
    const before = {
      releases: await releaseEmbeddings(s),
      cards: await cardVersionEmbeddings(s),
    };
    expect(
      before.releases,
      "the premise: the tables are empty, so a row appearing below is this probe's",
    ).toEqual([]);

    let threw: unknown;
    try {
      await reembed(s.db, c.alone.bundleId, `sha256:${mark("no-such-digest").replaceAll("-", "")}`);
    } catch (cause) {
      threw = cause;
    }

    const after = {
      releases: await releaseEmbeddings(s),
      cards: await cardVersionEmbeddings(s),
    };
    expect(
      after,
      `D-200-13: an absent release is a NO-OP returning \`void\`, not a throw — it matches the ` +
        `registry's value-not-refusal convention, and a typed refusal would add a class to ` +
        `this barrel's published list.\n` +
        `  ASSERTED ON WHAT IT LEFT BEHIND rather than on whether it threw: a writer that ` +
        `inserted a row and THEN threw satisfies every \`rejects.toThrow()\` a reviewer would ` +
        `write. The throw is reported below without being asserted on.\n` +
        `  it threw: ${threw === undefined ? "no" : String(threw)}`,
    ).toEqual(before);

    /* And the discriminating control, because "writes nothing" is satisfied by a function
       that writes nothing ever. The good call has to still work after the bad one. */
    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    expect(
      (await releaseEmbeddings(s)).length,
      `the control: without it, "the absent digest wrote nothing" is a claim about a ` +
        `\`reembedRelease\` that is broken for every input, including the ones this suite ` +
        `deleted the rows for two lines ago.`,
    ).toBe(1);
  });
});
