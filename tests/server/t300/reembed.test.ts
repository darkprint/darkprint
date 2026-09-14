/* ============================================================
   T300 — `reembedRelease` stays idempotent per digest under the
   encoder, the documents say what they are a function of, and
   `reembedAll` revisits only what moved

   The three claims about one release stay separated, because each
   can break on its own:

     1. the POSITIVE CONTROL: a release with no row gets one, at
        the declared width;
     2. IDEMPOTENCY: a second call leaves `embedding` AND
        `created_at` byte-identical;
     3. DETERMINISM: delete the row, re-embed the same content, get
        the same vector back. A neural encoder that seeds anything
        from a clock or a thread schedule passes 1 and 2 and fails
        this.

   `::text` on both columns: `created_at` through a `Date` truncates
   Postgres microseconds, so two writes inside one millisecond
   compare equal and an idempotency cell meaning "the row was not
   rewritten" passes against a row that was.

   ── what the document is a function of ──
   The release document is the manifest's purpose lines and, when
   the release resolves, the graph: nodes, steps, routing, loops,
   gates, tools, the scorecard and the phases. Pairs of releases
   that differ in exactly one of those inputs must embed
   differently, and a pair that differs in none must embed the
   same. The pairs share one card and one manifest slug so the
   named difference is the ONLY difference in the document; the
   first version of this fixture let the manifest slug follow the
   bundle slug and both pairs were reading that instead.

   ── "per digest" does not mean the digest determines the vector ──
   `bundleDigest` takes `{dot, cardDigests}` and the MANIFEST is
   not in it, so two releases with byte-identical digests can carry
   different titles and therefore different vectors. What the
   digest determines is which release is meant.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cardDigest, hasErrors, loadBundle, bundleDigest, type Bundle } from "@/lib/core";
import type { Db } from "@/lib/db";
import { openView } from "@/lib/server/ontology";
import { reembedAll } from "@/lib/server/search";
import {
  BLUEPRINT_DOCUMENT_VERSION,
  CARD_DOCUMENT_VERSION,
  blueprintText,
  cardText,
  embeddedInput,
} from "@/lib/server/search/reembed";

import { bind } from "../t200/contract";
import {
  cardVersionEmbeddings,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertRelease,
  manifest,
  mark,
  nodeCard,
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
  /** The subject of the three idempotency cells. */
  alone: ReleaseFixture;
  /** Identical to `plainCategory` in every embedded field except `category`. */
  withCategory: ReleaseFixture;
  plainCategory: ReleaseFixture;
  /** Identical to `plainTags` in every embedded field except `tags`. */
  withTags: ReleaseFixture;
  plainTags: ReleaseFixture;
  /** Two cards whose YAML resolves, so a graph document is built rather than the fallback. */
  planner: CardFixture;
  builder: CardFixture;
  /** Identical to `unconditioned` in everything except one edge's `condition`. */
  conditioned: ReleaseFixture;
  unconditioned: ReleaseFixture;
  /** Byte-identical document to `unconditioned`, under another bundle. */
  twin: ReleaseFixture;
  /** The bundles the two graphs are built from, for the premise that they resolve. */
  graphs: { conditioned: Bundle; unconditioned: Bundle };
}

let s: Scratch;
let c: Corpus;
let reembed: (...args: unknown[]) => unknown;
const setup = recordedSetup("the T300 re-embedding corpus");

/**
 * A card as the bundle format spells it, complete enough to resolve. The fixture layer's own
 * `insertCard` writes a six-line source that the resolver rejects, which is right for the
 * lexical suites and useless here: the graph document is only built from a release whose
 * cards parse.
 */
function resolvableSource(card: ReturnType<typeof nodeCard>): string {
  const quoted = (value: string): string => JSON.stringify(value);
  const list = (key: string, values: readonly string[]): string =>
    values.length === 0 ? `${key}: []` : `${key}:\n${values.map((v) => `  - ${quoted(v)}`).join("\n")}`;
  const ports = (key: string, values: readonly { name: string; type: string }[]): string =>
    values.length === 0
      ? `${key}: []`
      : `${key}:\n${values.map((p) => `  - name: ${quoted(p.name)}\n    type: ${quoted(p.type)}`).join("\n")}`;
  return [
    `id: ${quoted(card.id)}`,
    `name: ${quoted(card.name)}`,
    `type: ${quoted(card.type)}`,
    list("phase", card.phases),
    `action: ${quoted(card.action)}`,
    `spec: ${quoted(card.spec)}`,
    "tools: []",
    "mcp: []",
    "params: {}",
    ports("inputs", card.inputs),
    ports("outputs", card.outputs),
    list("dependencies", card.dependencies),
    "cannot: []",
    "will_not: []",
    "risk_markers: []",
    `version: ${quoted(card.version)}`,
    "",
  ].join("\n");
}

/** Wired: the resolver refuses an edge that carries no data and a receiver that does not name its sender. */
async function insertResolvableCard(
  owner: AccountFixture,
  o: {
    id: string;
    name: string;
    type: string;
    phases: string[];
    action: string;
    spec: string;
    inputs?: { name: string; type: string }[];
    outputs?: { name: string; type: string }[];
    dependencies?: string[];
  },
): Promise<CardFixture> {
  const body = { ...nodeCard(o), inputs: o.inputs ?? [], outputs: o.outputs ?? [], dependencies: o.dependencies ?? [] };
  const digest = cardDigest(body);
  const [row] = await s.query(
    "insert into card_version (card_id, version, digest, owner_id, visibility, body, source) " +
      "values ($1, $2, $3, $4, 'public', $5, $6) returning id",
    [body.id, body.version, digest, owner.id, JSON.stringify(body), resolvableSource(body)],
  );
  return {
    rowId: String(row?.id),
    cardId: body.id,
    version: body.version,
    ref: `${body.id}@${body.version}` as CardFixture["ref"],
    digest,
    body,
  };
}

/** `insertRelease` with the DOT chosen by the cell rather than generated from the pins. */
async function insertGraphRelease(
  bundleSlug: string,
  o: { manifestSlug: string; dot: string; cards: readonly CardFixture[] },
): Promise<{ release: ReleaseFixture; bundle: Bundle }> {
  const bundle = await insertBundle(s, { owner: c.owner, slug: bundleSlug, visibility: "public" });
  const cardRefs = o.cards.map((card) => card.ref);
  const cardDigests = o.cards.map((card) => card.digest);
  const digest = bundleDigest({ dot: o.dot, cardDigests });
  const m = manifest({ slug: o.manifestSlug, title: PROSE.title, summary: PROSE.summary, description: PROSE.description, tags: [] });
  const [row] = await s.query(
    "insert into release (bundle_id, version, digest, dot, manifest, card_refs, card_digests) " +
      "values ($1, '1.0.0', $2, $3, $4, $5, $6) returning id",
    [bundle.id, digest, o.dot, JSON.stringify(m), cardRefs, cardDigests],
  );
  const cardFiles = Object.fromEntries(o.cards.map((card) => [`cards/${card.ref}.yaml`, resolvableSource(card.body)]));
  return {
    release: { id: String(row?.id), bundleId: bundle.id, version: "1.0.0", digest, cardRefs },
    bundle: { manifest: m, dot: o.dot, cardFiles },
  };
}

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
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

    /* Five bundles, one card between them: every release below carries the same digest and
       the only thing that differs between a pair is the manifest field the pair is named
       for. `manifestSlug` is pinned per pair for the same reason. */
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
      withCategory: await release(mark("t300-cat-yes"), { manifestSlug: catSlug, category: "logistics" }),
      plainCategory: await release(mark("t300-cat-no"), { manifestSlug: catSlug }),
      withTags: await release(mark("t300-tag-yes"), { manifestSlug: tagSlug, tags: ["overnight", "inventory"] }),
      plainTags: await release(mark("t300-tag-no"), { manifestSlug: tagSlug }),
    } as Corpus;

    const plannerId = mark("t300-plan-route");
    c.planner = await insertResolvableCard(owner, {
      id: plannerId,
      name: "Plan the route",
      type: "agent",
      phases: ["planning"],
      action: "plan-route",
      spec: "Order the aisles so the picker walks each one once and ends at the dock.",
      outputs: [{ name: "route", type: "plan" }],
    });
    c.builder = await insertResolvableCard(owner, {
      id: mark("t300-walk-route"),
      name: "Walk the route",
      type: "tool",
      phases: ["implementation"],
      action: "walk-route",
      spec: "Follow the ordered aisles and top up every bin the plan names.",
      inputs: [{ name: "route", type: "plan" }],
      dependencies: [plannerId],
    });
    const graphSlug = mark("t300-graph-shared");
    const dot = (edge: string): string =>
      `digraph fixture {\n  plan [card="${c.planner.ref}"];\n  walk [card="${c.builder.ref}"];\n  ${edge}\n}\n`;
    const conditioned = await insertGraphRelease(mark("t300-edge-yes"), {
      manifestSlug: graphSlug,
      dot: dot('plan -> walk [condition="outcome=success"];'),
      cards: [c.planner, c.builder],
    });
    const unconditioned = await insertGraphRelease(mark("t300-edge-no"), {
      manifestSlug: graphSlug,
      dot: dot("plan -> walk;"),
      cards: [c.planner, c.builder],
    });
    const twin = await insertGraphRelease(mark("t300-edge-twin"), {
      manifestSlug: graphSlug,
      dot: dot("plan -> walk;"),
      cards: [c.planner, c.builder],
    });
    c.conditioned = conditioned.release;
    c.unconditioned = unconditioned.release;
    c.twin = twin.release;
    c.graphs = { conditioned: conditioned.bundle, unconditioned: unconditioned.bundle };
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

async function stampFor(release: ReleaseFixture): Promise<string | null | undefined> {
  const [row] = await s.query("select embedded_input_sha256 as stamp from release_embedding where release_id = $1", [release.id]);
  return row === undefined ? undefined : (row.stamp as string | null);
}

function widthOf(embedding: string): number {
  return embedding.replace(/^\[|\]$/g, "").split(",").filter((x) => x !== "").length;
}

describe("the three claims, kept apart", () => {
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
      `\`vector(384)\` is the column, and a different width is a write that FAILS rather than ` +
        `a vector that is quietly wrong, so a red here is likely to arrive as the insert's ` +
        `own error rather than as this number.`,
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
      `The stamp matched, so nothing was encoded and nothing was written. Both columns as ` +
        `\`::text\`, and \`created_at\` is the one that matters: through a \`Date\` it ` +
        `truncates Postgres microseconds, so an upsert that rewrote the row inside one ` +
        `millisecond would compare EQUAL and this cell would pass against exactly the defect ` +
        `it names.`,
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
      `NOT IMPLIED BY THE OTHER TWO. A neural encoder brings its own ways to be ` +
        `non-reproducible: a seeded initialisation, a thread count that changes reduction ` +
        `order, a cached tokenizer state. This cell runs inside ONE process, so it cannot see ` +
        `a per-process salt; what it does see is anything seeded from a clock, a counter or a ` +
        `previous call, which the idempotency cell above cannot because it never asks the ` +
        `encoder to run twice.`,
    ).toBe(first?.embedding);
  });

  it("both tables are written, and the second call writes neither", async () => {
    setup.check();
    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    const firstCards = await cardVersionEmbeddings(s);
    expect(
      firstCards.length,
      `Cards are embedded SEPARATELY so a harness can ask for a node rather than a whole ` +
        `blueprint; a surface writing only the release half leaves that table permanently ` +
        `empty and \`searchCards\` with no vector to read.`,
    ).toBeGreaterThan(0);

    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    expect(
      await cardVersionEmbeddings(s),
      `"idempotent" has two subjects, and a cell that only checked the release half would pass ` +
        `against a writer that rewrote every card vector on every publish.`,
    ).toEqual(firstCards);
  });
});

describe("the document keeps the manifest's purpose and drops its prose", () => {
  /* ── why these two cells are inverted ──
     They used to assert that `category` and `tags` MOVE the vector, and the change that
     inverted them is deliberate: the graph and the cards are checked by the engine and
     cannot disagree with the blueprint that runs, while the manifest's prose is written by
     hand beside them. Every archive description ends "generated automatically as an example
     for the registry", which is how the query word `try` came to match all sixteen.

     An "is ignored" cell is vacuous on its own — a module that embedded nothing at all would
     pass both — so the pure cell below carries the control: `title` and `summary` still
     decide the document, and they are what a reader searches in. */
  it("two releases differing only in `category` embed IDENTICALLY", async () => {
    setup.check();
    await reembed(s.db, c.withCategory.bundleId, c.withCategory.digest);
    await reembed(s.db, c.plainCategory.bundleId, c.plainCategory.digest);
    const yes = await rowFor(c.withCategory);
    const no = await rowFor(c.plainCategory);
    expect(yes, "the premise: the categorised release embedded").toBeDefined();
    expect(no, "the premise: the plain release embedded").toBeDefined();
    expect(
      yes?.embedding,
      `the two releases differ in exactly one manifest field and in nothing else, and that ` +
        `field is no longer in the document. A module still embedding \`category\` answers two ` +
        `vectors here and a reader would rank on a word nothing verified.`,
    ).toBe(no?.embedding);
  });

  it("two releases differing only in `tags` embed IDENTICALLY", async () => {
    setup.check();
    await reembed(s.db, c.withTags.bundleId, c.withTags.digest);
    await reembed(s.db, c.plainTags.bundleId, c.plainTags.digest);
    const yes = await rowFor(c.withTags);
    const no = await rowFor(c.plainTags);
    expect(yes, "the premise: the tagged release embedded").toBeDefined();
    expect(no, "the premise: the untagged release embedded").toBeDefined();
    expect(
      yes?.embedding,
      `Driven SEPARATELY from \`category\`: one fixture differing in both at once is reddened ` +
        `by a module that still embeds either, so it cannot say which.`,
    ).toBe(no?.embedding);
  });

  it("reads `title` and `summary` and ignores `description`, `category` and `tags`", () => {
    setup.check();
    /* The control, and the reason the two cells above are not vacuous. Pure, so it needs no
       database and no encoder: the text either carries the field or it does not. */
    const base = manifest({ slug: "x", title: "T", summary: "S" });
    const text = (over: Record<string, unknown>): string =>
      blueprintText({ ...base, ...over } as never, undefined);

    const plain = text({});
    expect(text({ description: "A long paragraph nobody checked." }), "description").toBe(plain);
    expect(text({ category: "logistics" }), "category").toBe(plain);
    expect(text({ tags: ["overnight", "inventory"] }), "tags").toBe(plain);

    /* MUST change, or "ignores three fields" is a claim about a module that embeds none. */
    expect(text({ title: "Another" }), "title decides the document").not.toBe(plain);
    expect(text({ summary: "Another purpose entirely." }), "summary decides it").not.toBe(plain);

    expect(plain).toContain("Blueprint: T");
    expect(plain).toContain("Purpose: S");
    expect(plain, "the prose fields must leave no line behind").not.toContain("Category");
    expect(plain).not.toContain("Tags");
  });
});

describe("the document is a function of the graph, when the release resolves", () => {
  it("the graph fixtures resolve without errors, or the cells below compare two fallbacks", () => {
    setup.check();
    for (const [name, bundle] of Object.entries(c.graphs)) {
      const loaded = loadBundle(bundle, { ontology: openView() });
      expect(
        { blueprint: loaded.blueprint !== undefined, errors: hasErrors(loaded.diagnostics) },
        `${name}: a release that does not resolve gets the manifest-only document, and two ` +
          `manifest-only documents built from one manifest are identical whatever the DOT ` +
          `says. diagnostics: ${JSON.stringify(loaded.diagnostics.map((d) => `${d.code}: ${d.message}`))}`,
      ).toEqual({ blueprint: true, errors: false });
    }
  });

  it("two releases differing only in an edge condition embed differently", async () => {
    setup.check();
    await reembed(s.db, c.conditioned.bundleId, c.conditioned.digest);
    await reembed(s.db, c.unconditioned.bundleId, c.unconditioned.digest);
    const yes = await rowFor(c.conditioned);
    const no = await rowFor(c.unconditioned);
    expect(yes, "the premise: the conditioned release embedded").toBeDefined();
    expect(no, "the premise: the unconditioned release embedded").toBeDefined();
    expect(
      yes?.embedding,
      `same manifest, same two cards, same nodes; one DOT says \`plan -> walk\` and the other ` +
        `says it only when \`outcome=success\`. The routing line carries the guard, so the ` +
        `documents and the vectors differ.`,
    ).not.toBe(no?.embedding);
  });

  it("two releases whose documents are identical embed identically, stamp and all", async () => {
    setup.check();
    await reembed(s.db, c.unconditioned.bundleId, c.unconditioned.digest);
    await reembed(s.db, c.twin.bundleId, c.twin.digest);
    expect(
      (await rowFor(c.twin))?.embedding,
      `the control on the cell above: the bundle slug is not in the document, so a second ` +
        `bundle carrying the same manifest, DOT and cards reaches the same text and the same ` +
        `vector`,
    ).toBe((await rowFor(c.unconditioned))?.embedding);
    expect(await stampFor(c.twin)).toBe(await stampFor(c.unconditioned));
  });
});

describe("the documents carry their version, and the stamp is over that text", () => {
  it("both documents start with the version line", () => {
    setup.check();
    expect(blueprintText(manifest({ slug: "x", title: "T", summary: "S" }), undefined).split("\n")[0]).toBe(
      BLUEPRINT_DOCUMENT_VERSION,
    );
    expect(cardText({ name: "N", action: "a", spec: "s" }, (id) => id).split("\n")[0]).toBe(
      CARD_DOCUMENT_VERSION,
    );

    /* Pinned separately, and the pair is the assertion. The version string sits INSIDE the
       embedded text, so one shared constant made a blueprint-template change rewrite every
       card vector and shift a ranking nothing had touched. A cell reading one constant twice
       could not tell that apart from two that happen to agree. */
    expect(BLUEPRINT_DOCUMENT_VERSION).toBe("v3");
    expect(CARD_DOCUMENT_VERSION).toBe("v2");

    /* There is no third cell asserting the two differ, and that is not an omission: both are
       `const`, so TypeScript gives them literal types and refuses `===` between them with
       TS2367. The compiler makes the claim at every call site, which is wider than one
       runtime assertion here, and widening either side to `string` to get a cell would
       remove exactly the guarantee it was meant to record. */
  });

  it("a release that does not resolve is stamped with the manifest-only document", async () => {
    setup.check();
    /* `alone` pins the fixture layer's six-line card, which the resolver rejects, so its
       document is the manifest alone, and the stored stamp has to be the hash of exactly
       that text under the vendored model. */
    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    const [row] = await s.query("select manifest from release where id = $1", [c.alone.id]);
    const text = blueprintText(row?.manifest as never, undefined);
    expect(await stampFor(c.alone)).toBe(embeddedInput(text));
  });
});

describe("`reembedAll` revisits only what moved", () => {
  it("a sweep after everything is current writes nothing, and a dry run agrees", async () => {
    setup.check();
    await reembedAll(s.db as Db);
    const releases = (await releaseEmbeddings(s)).length;
    const cards = (await cardVersionEmbeddings(s)).length;
    expect(releases, "the premise: every release in this database has a vector").toBe(8);
    expect(cards, "three distinct card versions are pinned across the eight").toBe(3);

    const dry = await reembedAll(s.db as Db, { dryRun: true });
    expect(dry).toEqual({ releases: 8, written: 0, unchanged: 11, encoder: "present" });
    const wet = await reembedAll(s.db as Db);
    expect(wet).toEqual({ releases: 8, written: 0, unchanged: 11, encoder: "present" });
  });

  it("one stale row is counted by the dry run, written by the sweep, and then current", async () => {
    setup.check();
    await reembedAll(s.db as Db);
    await s.query("update release_embedding set embedded_input_sha256 = null where release_id = $1", [c.twin.id]);
    const before = await rowFor(c.twin);

    const dry = await reembedAll(s.db as Db, { dryRun: true });
    expect(dry, "a dry run compares stamps and encodes nothing").toEqual({ releases: 8, written: 1, unchanged: 10, encoder: "present" });
    expect(await stampFor(c.twin), "and it wrote nothing").toBeNull();

    const wet = await reembedAll(s.db as Db);
    expect(wet).toEqual({ releases: 8, written: 1, unchanged: 10, encoder: "present" });
    const after = await rowFor(c.twin);
    expect(after?.embedding, "the re-encode reproduces the vector").toBe(before?.embedding);
    expect(after?.createdAt, "and the row really was rewritten").not.toBe(before?.createdAt);
    expect(await stampFor(c.twin)).toBe(await stampFor(c.unconditioned));

    expect(await reembedAll(s.db as Db, { dryRun: true })).toEqual({ releases: 8, written: 0, unchanged: 11, encoder: "present" });
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
    expect(before.releases, "the premise: the tables are empty, so a row appearing below is this probe's").toEqual([]);

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
      `an absent release is a NO-OP returning \`void\`, not a throw. Asserted on what it LEFT ` +
        `BEHIND rather than on whether it threw: a writer that inserted a row and THEN threw ` +
        `satisfies every \`rejects.toThrow()\` a reviewer would write.\n` +
        `  it threw: ${threw === undefined ? "no" : String(threw)}`,
    ).toEqual(before);

    /* The discriminating control: the good call has to still work after the bad one. */
    await reembed(s.db, c.alone.bundleId, c.alone.digest);
    expect(
      (await releaseEmbeddings(s)).length,
      `without it, "the absent digest wrote nothing" is a claim about a writer that is broken ` +
        `for every input`,
    ).toBe(1);
  });
});
