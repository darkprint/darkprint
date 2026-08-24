/* ============================================================
   T132 / D-132-01 (1) — `graphsOf`, the batch drawing reader

   "keyed `${ownerHandle}/${slug}`, BATCH so `/blueprints` makes
   one call, absent entries = not visible or not resolvable
   (value-not-refusal)."

   ── the hazard this file is built around ──
   D-260-14 refused the option where the row loses its schematic,
   and the failure mode that replaces it is quieter: a drawing that
   arrives and is WRONG. `release.dot` alone gives every node the
   default kind and every edge `flow`, because kind comes from the
   CARD (`agentNodeKind` over `card.type` and the ontology's
   ancestors) and variant from the DOT attributes plus the layout's
   back edges. A cell asserting "a graph came back" passes that.

   So the drawing is asserted as a TABLE, hand-read off the corpus
   at this commit and typed in — D-260-23's rule, since an
   expectation derived by calling `graphForBlueprint` here would
   ask whether the module agrees with itself, which is the one
   thing a reassembly cannot be wrong about.

   ── and a third failure mode, measured rather than feared ──
   Dropping `release.local_vocabulary` from the ontology view does
   not fail. Measured in this worktree before any cell existed:
   `frontline-triage` resolves to SEVEN nodes with its overlay and
   FIVE without, with `resolveBundle` still returning a blueprint
   and nothing throwing. Ratified as D-132-04 C-E. That is why the
   node and edge COUNTS are pinned for that bundle and not only for
   the one whose kinds are enumerated.

   ── what is deliberately not asserted ──
   Node POSITIONS. `layeredLayout` owns them, they are pixels, and
   pinning them would red a correct reader the day the layout is
   tuned. What the drawing needs from this reader is topology,
   kind, variant and the DOT source.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  FixtureGate,
  anonymous,
  asGraphEntry,
  asReadonlyMap,
  bind,
  countQueries,
  dropScratchDatabases,
  keyOf,
  mark,
  query,
  scratchDatabase,
} from "./contract";
import { bundleBySlug, seedAccount, seedOntology, seedRelease, type SeededAccount } from "../t090/fixtures";

const gate = new FixtureGate();
let s: ReturnType<FixtureGate["get"]>;
let owner: SeededAccount;
let stranger: SeededAccount;

/** The three copies of one bundle the batch-cost cell needs, and nothing else uses. */
const TWIN_SLUGS = ["t132-twin-a", "t132-twin-b", "t132-twin-c"] as const;

interface Seeded {
  ownerHandle: string;
  slug: string;
  releaseId: string;
  dot: string;
}

const seeded: Record<string, Seeded> = {};

async function seed(entrySlug: string, o: { slug?: string; visibility?: "public" | "private"; owner?: SeededAccount } = {}): Promise<Seeded> {
  const entry = bundleBySlug(entrySlug);
  const release = await seedRelease(s as never, o.owner ?? owner, entry, {
    ...(o.slug === undefined ? {} : { slug: o.slug }),
    ...(o.visibility === undefined ? {} : { visibility: o.visibility }),
  });
  const [row] = await query(s, "select id, dot from release where bundle_id = $1", [release.bundleId]);
  const record: Seeded = {
    ownerHandle: release.ownerHandle,
    slug: release.slug,
    releaseId: row?.id as string,
    dot: row?.dot as string,
  };
  seeded[record.slug] = record;
  return record;
}

beforeAll(async () => {
  await gate.build(async () => {
    s = await scratchDatabase("graphs");
    await seedOntology(s.db);
    owner = await seedAccount(s as never, mark("t132-graphs"));
    stranger = await seedAccount(s as never, mark("t132-graphs-other"));

    await seed("guarded-merge-bot");
    await seed("frontline-triage");
    await seed("starter-software-factory");
    for (const slug of TWIN_SLUGS) await seed("guarded-merge-bot", { slug });
    return s;
  });
}, 120000);

afterAll(async () => {
  await dropScratchDatabases();
});

function key(slug: string): { ownerHandle: string; slug: string } {
  const entry = seeded[slug];
  if (entry === undefined) throw new Error(`No fixture seeded for \`${slug}\`.`);
  return { ownerHandle: entry.ownerHandle, slug: entry.slug };
}

/**
 * The module is bound LAST, after the fixture gate has answered.
 *
 * An early bind masks every planting below it while being correct about its own subject, and
 * in the blind position the two states are indistinguishable in the report: an absent member
 * and a fixture that silently did nothing red identically. `FixtureGate` turns the second
 * into its own sentence.
 */
async function graphsOf(actor: unknown, keys: readonly { ownerHandle: string; slug: string }[]) {
  const db = gate.get().db;
  const fn = await bind("graphsOf");
  return asReadonlyMap(await fn(db, actor, keys), `graphsOf(db, actor, ${JSON.stringify(keys)})`);
}

/* --------------------- the fixture, asserted rather than assumed --------------------- */

/**
 * A guard on THIS SUITE, green with nothing built.
 *
 * Every drawing assertion below is hand-typed off `content/` and compares against what a
 * reader reassembles out of Postgres, so both halves have to be what this file thinks they
 * are. In the blind position all seventeen cells red on the absent member whether or not the
 * seeding worked, which is exactly the state where an unasserted premise goes unnoticed.
 */
describe("the fixture this file's tables rest on", () => {
  it("stored the corpus bundle with the pins, the DOT and a vocabulary the reader needs", async () => {
    const s = gate.get();
    const [row] = await query(
      s,
      "select array_length(card_refs, 1) as pins, dot, local_vocabulary is not null as has_vocab, " +
        "manifest ->> 'ontologyVersion' as ov from release where id = $1",
      [seeded["guarded-merge-bot"].releaseId],
    );
    expect(
      { pins: row?.pins, ov: row?.ov, has_vocab: row?.has_vocab },
      `\`guarded-merge-bot\` pins six cards in \`content/\` at this commit, declares ontology ` +
        `0.1.0, and \`seedRelease\` stores the archive's own vocabulary on every release. If ` +
        `the corpus has moved, the drawing tables below have moved with it and want ` +
        `re-measuring rather than loosening.`,
    ).toEqual({ pins: 6, ov: "0.1.0", has_vocab: true });
    expect(String(row?.dot)).toContain("digraph");
    const cards = await query(s, "select count(*)::int as n from card_version");
    expect(cards[0]?.n, "the pinned cards' YAML has to be in `card_version.source`").toBeGreaterThan(5);
  });

  it("published the ontology version every stored manifest names", async () => {
    const s = gate.get();
    const [row] = await query(s, "select count(*)::int as n from ontology_term");
    expect(
      row?.n,
      `\`seedOntology\` writes the core vocabulary through \`addOntologyVersion\`. Without its ` +
        `TERMS, \`openView\` builds a view that resolves nothing and every node falls back to ` +
        `the default kind — which is the wrong-drawing hazard arriving from the fixture side.`,
    ).toBeGreaterThan(0);
  });
});

/* --------------------- the batch shape --------------------- */

describe("D-132-01: one call, keyed owner/slug", () => {
  it("answers for every key in one call, keyed `${ownerHandle}/${slug}`", async () => {
    const keys = [key("guarded-merge-bot"), key("frontline-triage"), key("starter-software-factory")];
    const map = await graphsOf(anonymous, keys);
    expect(
      [...map.keys()].sort(),
      `D-132-01 keys the map ` + "`${ownerHandle}/${slug}`" + ` — the whole key, since B-09 ` +
        `made the slug half of one. \`RegistrySnapshot.byKey\` already uses that spelling.`,
    ).toEqual(keys.map(keyOf).sort());
  });

  it("returns an empty map for no keys, rather than everything or a refusal", async () => {
    const map = await graphsOf(anonymous, []);
    expect(
      map.size,
      `The reader takes the keys the caller asks for. An empty request that answered with the ` +
        `whole registry would make \`/blueprints\` pay for every blueprint on a page showing ` +
        `none, and a refusal would contradict the value-not-refusal rule.`,
    ).toBe(0);
  });

  it("carries no key the caller did not ask for", async () => {
    const keys = [key("guarded-merge-bot")];
    const map = await graphsOf(anonymous, keys);
    expect([...map.keys()]).toEqual([keyOf(keys[0])]);
  });

  /**
   * D-260-21 is a COST ruling, and this is the only cell in the suite that can see it.
   *
   * ── the first version of this cell was very nearly unfailable, and a pre-registered
   *    mutation is what found that ──
   * It asserted `q(3) < 3 * q(1)`. Write the cost as `F + n*P`, a fixed part and a per-key
   * part: the correct reader gives `F + 3P < 3F + 3P`, which holds for ANY positive F, and a
   * reader looping `loadSnapshot` once per key gives `F + 3(P+S) < 3F + 3(P+S)`, which also
   * holds. **The comparison was true whatever the reader did**, and a mutation that put a
   * whole snapshot inside the loop reddened nothing. A ratio against a total cannot see a
   * per-key cost while a fixed cost is in the total with it.
   *
   * So the claim is made against the MARGINAL cost instead, which is what D-260-21 is about:
   * one more tile on the shelf must not cost another index. `snapshot.ts` fixes that price —
   * "Four queries, fixed, whatever the registry's size" — and `graphs.ts` prices itself in
   * its own header as `4 + K`. Measured on this fixture: 0 keys 0 statements, 1 key 6, 2
   * keys 8, 3 keys 10, 5 keys 14. Four statements fixed, two per key, no snapshot in the
   * loop.
   *
   * The baseline is asserted non-zero first: `countQueries` patches the pool this suite hands
   * in, and a reader that issued its statements some other way would make both numbers zero
   * and turn the comparison into a red against correct code. A zero here is a claim about the
   * instrument and the message says so.
   */
  it("does not pay an index per key: the marginal cost of a key is under one snapshot", async () => {
    const none = await countQueries(s, () => graphsOf(anonymous, []));
    const one = await countQueries(s, () => graphsOf(anonymous, [key(TWIN_SLUGS[0])]));
    const many = await countQueries(s, () =>
      graphsOf(anonymous, [...TWIN_SLUGS, "guarded-merge-bot", "frontline-triage"].map((slug) => key(slug))),
    );
    expect(
      one.queries,
      `The query counter saw nothing. It patches \`pool.query\` and \`pool.connect\` on the ` +
        `pool behind the \`db\` this cell handed the reader, so zero means the reader reached ` +
        `the database some other way and THIS CELL MEASURES NOTHING — it is not evidence that ` +
        `the reader is cheap. Diagnose the instrument before reading the comparison below.`,
    ).toBeGreaterThan(0);
    expect(
      none.queries,
      `An empty batch must answer without a statement — \`graphs.ts\` says so in its own ` +
        `docblock, and a shelf with every tile filtered out is the case it is about.`,
    ).toBe(0);
    expect(one.result.size).toBe(1);
    expect(many.result.size).toBe(5);

    const marginal = (many.queries - one.queries) / 4;
    expect(
      marginal,
      `D-260-21: "N snapshots + 3N score queries + the graph reader on every load, growing ` +
        `with a registry whose whole point under AC1 is that it grows between deploys". ` +
        `\`loadSnapshot\` is four statements fixed whatever the registry holds, so a reader ` +
        `that loops it pays at least four per key and one that batches pays the ontology read ` +
        `alone. Measured here: ${one.queries} statements for one key, ${many.queries} for ` +
        `five, marginal ${marginal} per key. Four or more means the index is inside the loop.`,
    ).toBeLessThan(4);
  });
});

/* --------------------- the drawing itself --------------------- */

/**
 * `guarded-merge-bot`, read off `content/` at this commit and typed in.
 *
 * Five distinct kinds over six nodes and all three edge variants over six edges, which is
 * what makes it the fixture: a reader rendering from `release.dot` alone answers `executor`
 * for all six nodes and `flow` for all six edges, and every entry below moves.
 *
 * If `content/blueprints/guarded-merge-bot/` changes, this table reds and the right response
 * is to re-measure it, not to loosen it. The message says which of the two a reader is
 * looking at.
 */
const GUARDED_MERGE_BOT_NODES: readonly [string, string, string][] = [
  ["pr", "start", "pr-intake"],
  ["triage", "executor", "diff-triager"],
  ["draft", "executor", "review-drafter"],
  ["tests", "verifier", "test-runner"],
  ["gate", "gate", "maintainer-approval"],
  ["merge", "ship", "merge-executor"],
];

const GUARDED_MERGE_BOT_EDGES: readonly [string, string, string][] = [
  ["pr", "triage", "flow"],
  ["triage", "draft", "flow"],
  ["draft", "tests", "flow"],
  ["tests", "draft", "fallback"],
  ["tests", "gate", "flow"],
  ["gate", "merge", "control"],
];

describe("D-260-14: the drawing is the reassembled one, not the DOT alone", () => {
  it("gives each node the kind its CARD implies, not one default kind", async () => {
    const map = await graphsOf(anonymous, [key("guarded-merge-bot")]);
    const entry = asGraphEntry(map.get(keyOf(key("guarded-merge-bot"))), "graphsOf()[guarded-merge-bot]");
    const nodes = entry.graph.nodes.map((n) => [n.id, n.kind]);
    expect(
      nodes,
      `\`agentNodeKind\` reads \`card.type\` and the ontology's ancestors, plus whether the ` +
        `node is an entry or a terminal. None of that is in \`release.dot\`, so a reader that ` +
        `rendered the stored DOT and stopped answers \`executor\` six times here and passes ` +
        `every other cell in this file. Five kinds over six nodes is what makes this table ` +
        `discriminating. If \`content/blueprints/guarded-merge-bot/\` has changed, re-measure ` +
        `the table rather than widening the assertion.`,
    ).toEqual(GUARDED_MERGE_BOT_NODES.map(([id, kind]) => [id, kind]));
  });

  it("links every node to the card page, which only the archive caller may ask for", async () => {
    const map = await graphsOf(anonymous, [key("guarded-merge-bot")]);
    const entry = asGraphEntry(map.get(keyOf(key("guarded-merge-bot"))), "graphsOf()[guarded-merge-bot]");
    expect(
      entry.graph.nodes.map((n) => [n.id, n.cardId ?? null]),
      `D-260-14 names the pattern this extracts from: \`graphForBlueprint(loaded.blueprint, ` +
        `{cardsInRegistry: true})\`. That option is OFF by default and the default is the safe ` +
        `one — the wizard and the workspace resolve cards no page was built for — so a reader ` +
        `that omitted it would be correct-looking and would strip every \`/nodes/<id>\` link ` +
        `off the schematic. These cards ARE in this registry: the fixture published them.`,
    ).toEqual(GUARDED_MERGE_BOT_NODES.map(([id, , cardId]) => [id, cardId]));
  });

  it("gives each edge the variant its DOT attributes and the layout imply", async () => {
    const map = await graphsOf(anonymous, [key("guarded-merge-bot")]);
    const entry = asGraphEntry(map.get(keyOf(key("guarded-merge-bot"))), "graphsOf()[guarded-merge-bot]");
    expect(
      entry.graph.edges.map((e) => [e.source, e.target, e.variant]),
      `\`edgeVariant\` is the author's \`style\` first, then the loop-closing edges the LAYOUT ` +
        `had to break, then a \`signal\` payload — so \`control\` and \`fallback\` are not ` +
        `readable off the DOT text without running the same resolution. All three variants ` +
        `appear here; a DOT-only rendering answers \`flow\` six times.`,
    ).toEqual(GUARDED_MERGE_BOT_EDGES.map(([source, target, variant]) => [source, target, variant]));
  });

  it("carries the release's own DOT for the source panel, byte for byte", async () => {
    const map = await graphsOf(anonymous, [key("guarded-merge-bot")]);
    const entry = asGraphEntry(map.get(keyOf(key("guarded-merge-bot"))), "graphsOf()[guarded-merge-bot]");
    expect(
      entry.graph.dot,
      `\`BlueprintGraph.dot\` is documented "Authentic DOT source shown in the DOT source ` +
        `panel". The release stores those bytes; a re-emitted DOT would be this module's ` +
        `opinion of the author's file, which is the defect D-90-03 settled one table over.`,
    ).toBe(seeded["guarded-merge-bot"].dot);
  });

  it("reports the agents and tools the graph asks for, in graph order", async () => {
    const map = await graphsOf(anonymous, [key("guarded-merge-bot")]);
    const entry = asGraphEntry(map.get(keyOf(key("guarded-merge-bot"))), "graphsOf()[guarded-merge-bot]");
    expect(
      [...entry.requiredAgents],
      `\`requiredAgents\` is "the model or agent each node needs, distinct, in graph order", ` +
        `read off the CARDS. Hand-read off the corpus at this commit.`,
    ).toEqual(["claude-sonnet-5", "claude-haiku-4-5"]);
    expect(
      [...entry.requiredTools],
      `\`requiredTools\` is every tool capability the graph asks for AS ITS ONTOLOGY LABEL — ` +
        `so these are the labels the merged view resolves, not the raw tool ids on the cards, ` +
        `and a reader that skipped the ontology would answer the ids.`,
    ).toEqual(["Git", "CI", "Human review"]);
  });

  /**
   * D-132-04 C-E, ratified on the measurement quoted in this file's header.
   *
   * `frontline-triage` is the one bundle in `content/` carrying `ontology/extensions.yaml`.
   * Without its overlay reaching `openView`, two of its seven nodes fail to resolve and the
   * drawing arrives five nodes wide with `resolveBundle` reporting `card/unknown-term` and
   * `bundle/missing-card` and returning a blueprint anyway.
   */
  it("passes the release's local vocabulary to the ontology view", async () => {
    const map = await graphsOf(anonymous, [key("frontline-triage")]);
    const entry = asGraphEntry(map.get(keyOf(key("frontline-triage"))), "graphsOf()[frontline-triage]");
    expect(
      { nodes: entry.graph.nodes.length, edges: entry.graph.edges.length },
      `Measured in this worktree before this cell existed: with \`release.local_vocabulary\` ` +
        `passed as \`openView\`'s extensions this bundle resolves to 7 nodes and 7 edges with ` +
        `zero error diagnostics; without it, to 5 and 5 — and NOTHING THROWS. So a reader that ` +
        `forgot the overlay ships a drawing missing two of seven nodes rather than failing, ` +
        `which is D-260-14's wrong-drawing hazard one layer down (D-132-04 C-E).`,
    ).toEqual({ nodes: 7, edges: 7 });
    expect(entry.graph.nodes.map((n) => n.id)).toEqual([
      "ticket",
      "classify",
      "autoresolve",
      "kb",
      "qa",
      "send",
      "escalate",
    ]);
  });
});

/* --------------------- absence is a value --------------------- */

describe("D-132-01: an absent entry is the answer, never a refusal", () => {
  it("omits a key naming no bundle", async () => {
    const map = await graphsOf(anonymous, [
      { ownerHandle: owner.handle, slug: "no-such-slug-here" },
      key("guarded-merge-bot"),
    ]);
    expect(map.has(`${owner.handle}/no-such-slug-here`)).toBe(false);
    expect(
      map.has(keyOf(key("guarded-merge-bot"))),
      `The resolvable key beside it must still be answered: a batch that gave up on the whole ` +
        `request because one key missed would make one deleted blueprint blank the shelf.`,
    ).toBe(true);
  });

  it("omits a key naming no account", async () => {
    const map = await graphsOf(anonymous, [{ ownerHandle: "nobody-holds-this-handle", slug: "guarded-merge-bot" }]);
    expect(map.size).toBe(0);
  });

  it("omits a bundle that has no release yet", async () => {
    const [row] = await query(
      gate.get(),
      "insert into bundle (owner_id, slug, visibility) values ($1, $2, 'public') returning id",
      [owner.accountId, "t132-unreleased"],
    );
    expect(typeof row?.id).toBe("string");
    const map = await graphsOf(anonymous, [{ ownerHandle: owner.handle, slug: "t132-unreleased" }]);
    expect(
      map.size,
      `B-06: a bundle first exists as a blueprint at its first publish, and there is no ` +
        `current release to draw. An entry here would have to carry an empty graph, which is ` +
        `a drawing of nothing rather than the absence of one.`,
    ).toBe(0);
  });

  /**
   * D-132-04 C-F. `openView` throws `UnknownOntologyVersionError` when no `ontology_version`
   * row matches the release's manifest, and `graphsOf` answers in values — so the throw has
   * to become an absent entry. The manifest is edited with direct SQL because no writer in
   * this product publishes a release naming an unpublished version, which is precisely why
   * the state is reachable only this way and why it is worth a cell.
   */
  it("omits a release naming an ontology version nobody published", async () => {
    const target = await seed("starter-software-factory", { slug: "t132-unknown-ontology" });
    await query(
      gate.get(),
      "update release set manifest = jsonb_set(manifest, '{ontologyVersion}', '\"9.9.9\"') where id = $1",
      [target.releaseId],
    );
    const map = await graphsOf(anonymous, [key("t132-unknown-ontology"), key("guarded-merge-bot")]);
    expect(
      map.has(keyOf(key("t132-unknown-ontology"))),
      `D-132-04 C-F: \`openView\` raises \`UnknownOntologyVersionError\` for a version with no ` +
        `row, and \`export/build.ts\` turns that into a 404. This reader answers in VALUES, so ` +
        `the same fact is an absent entry — "not visible or NOT RESOLVABLE" (D-132-01). A ` +
        `throw here would take the whole shelf down for one bad release.`,
    ).toBe(false);
    expect(map.has(keyOf(key("guarded-merge-bot")))).toBe(true);
  });

  /**
   * D-132-04 C-D, ruled on this suite's own charge and reached independently from the build
   * side (D-132-05): a drawing with the private node omitted is a topology that does not
   * match the digest, so the honest value is absence — for the caller who cannot see the
   * card, and for that caller only.
   *
   * One card row is flipped to private with direct SQL rather than seeded that way: the
   * option T090's fixture offers makes EVERY card private, and what this cell needs is a
   * public bundle that a caller may see pinning one card they may not.
   */
  it("omits a public blueprint pinning a card this caller may not see, and keeps it for the owner", async () => {
    /* A content bundle no other cell in this file seeds, and then a pin that NO OTHER
       RELEASE holds — both measured, not assumed.

       `seedRelease` writes one `card_version` row per `(id, version)` and reuses it for
       every bundle that pins it, which is the normal case rather than an error. So sealing a
       shared row does not seal one fixture, it seals every bundle pinning that card — and
       the first version of this cell did exactly that to `guarded-merge-bot`, taking two
       later cells' fixtures out from under them. THE BLIND POSITION COULD NOT SHOW IT: every
       cell in the file was red for the same absent member, so no interference was visible
       until both halves ran together. */
    const target = await seed("incident-commander", { slug: "t132-one-sealed-card" });
    const [pinned] = await query(
      gate.get(),
      "select card_refs from release where id = $1",
      [target.releaseId],
    );
    const refs = pinned?.card_refs as string[];
    expect(refs.length).toBeGreaterThan(1);
    let sealed: string | undefined;
    for (const ref of refs) {
      const [row] = await query(
        gate.get(),
        "select count(*)::int as n from release where $1 = any(card_refs) and id <> $2",
        [ref, target.releaseId],
      );
      if (row?.n === 0) {
        sealed = ref;
        break;
      }
    }
    expect(
      sealed,
      `Every card \`${target.slug}\` pins is also pinned by another release in this database, ` +
        `so sealing any of them would change a fixture this cell does not own.`,
    ).toBeDefined();
    const at = (sealed as string).lastIndexOf("@");
    const [id, version] = [(sealed as string).slice(0, at), (sealed as string).slice(at + 1)];
    const updated = await query(
      gate.get(),
      "update card_version set visibility = 'private' where card_id = $1 and version = $2 returning id",
      [id, version],
    );
    expect(updated.length, `the fixture must actually seal \`${String(sealed)}\``).toBe(1);

    const asAnon = await graphsOf(anonymous, [key("t132-one-sealed-card")]);
    expect(
      asAnon.has(keyOf(key("t132-one-sealed-card"))),
      `D-132-04 C-D: \`${sealed}\` is private and the bundle pinning it is public. Drawing the ` +
        `other five nodes would be a WRONG drawing — a topology that does not match the digest ` +
        `the same row publishes — and D-260-14 refused the option where the row lies about its ` +
        `own shape. The shelf tile is T260's empty state, recorded rather than hidden.`,
    ).toBe(false);

    const asOwner = await graphsOf(
      { kind: "account", accountId: owner.accountId, handle: owner.handle },
      [key("t132-one-sealed-card")],
    );
    expect(
      asOwner.has(keyOf(key("t132-one-sealed-card"))),
      `The same ruling's other half, and the half that stops "filter unconditionally" from ` +
        `passing: the owner may see the card, so the topology is complete for them and the ` +
        `blueprint resolves. Without this the safest-looking implementation — never draw a ` +
        `bundle with any private pin — is indistinguishable from the correct one.`,
    ).toBe(true);
  });

  it("omits a private bundle for a stranger and keeps it for its owner", async () => {
    await seed("starter-software-factory", { slug: "t132-sealed-bundle", visibility: "private" });
    const k = key("t132-sealed-bundle");
    const asAnon = await graphsOf(anonymous, [k]);
    const asStranger = await graphsOf(
      { kind: "account", accountId: stranger.accountId, handle: stranger.handle },
      [k],
    );
    const asOwner = await graphsOf(
      { kind: "account", accountId: owner.accountId, handle: owner.handle },
      [k],
    );
    expect({ anon: asAnon.size, stranger: asStranger.size, owner: asOwner.size }).toEqual({
      anon: 0,
      stranger: 0,
      owner: 1,
    });
  });

  /**
   * D-132-01's "extract, never duplicate" clause has exactly one observable consequence, and
   * this is it: the reader must draw the CURRENT release, "consuming `loadSnapshot`'s
   * current-release rule rather than re-deriving D-80-03".
   *
   * A reader that re-derived the rule and got it wrong — took the newest row, or the first the
   * database returned — passes every other cell in this file, because every other fixture has
   * one release per bundle. The second release here is a DIFFERENT content bundle under the
   * same bundle id and a higher version, so the two drawings differ in node count and the
   * wrong one is unmistakable.
   */
  it("draws the current release, not whichever row comes back first", async () => {
    const target = await seed("starter-software-factory", { slug: "t132-two-releases" });
    const [bundle] = await query(
      gate.get(),
      "select b.id from bundle b join account a on a.id = b.owner_id where a.handle = $1 and b.slug = $2",
      [target.ownerHandle, target.slug],
    );
    await seedRelease(gate.get() as never, owner, bundleBySlug("guarded-merge-bot"), {
      bundleId: bundle?.id as string,
      version: "2.0.0",
    });

    const map = await graphsOf(anonymous, [key("t132-two-releases")]);
    const entry = asGraphEntry(map.get(keyOf(key("t132-two-releases"))), "graphsOf()[two-releases]");
    expect(
      entry.graph.nodes.map((n) => n.id),
      `D-80-03 is "highest semver, tiebroken on row id", and \`blueprint()\` already answers ` +
        `from it. A schematic drawn off a different release from the one the tile's title, ` +
        `digest and scorecard come from is two answers about one blueprint — which is the ` +
        `reason \`scoresOf\` states the same rule in its own comment.`,
    ).toEqual(["pr", "triage", "draft", "tests", "gate", "merge"]);
  });

  /**
   * A `Map` cannot express a duplicate key, so the only question a repeated key raises is
   * whether the reader survives one. Derived from the published return type rather than from
   * a clause, and labelled as such: `/blueprints` builds its key list from a page of tiles
   * and nothing dedupes it on the way in.
   */
  it("survives a repeated key", async () => {
    const k = key("guarded-merge-bot");
    const map = await graphsOf(anonymous, [k, k]);
    expect(map.size).toBe(1);
  });
});
