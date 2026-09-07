/* ============================================================
   T080 AC1 — "the fields and order the build produces today"

   `records.test.ts` tests that clause as properties on fixtures
   built to discriminate. This file tests it as the sentence
   actually reads: against the thing that produces the fields and
   the order today, which is `buildRegistry` over `content/**`.

   The seed rows are derived **from the registry's own output**
   rather than recomputed beside it — `digest` is the record's
   digest, `manifest` is the record's manifest, `cardRefs` are the
   record's refs. Recomputing them here would make a red ambiguous
   between "T080 projects the wrong column" and "this file hashes
   the way `lib/core` used to".

   T250 is the task that will really import this content, and it
   has not merged. So this is not a claim that the registry will
   hold these rows in production; it is the only available oracle
   for the projection, and it is exactly the one AC1 names.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildRegistry, type Registry } from "@/lib/core";
import { readContent } from "@/lib/content/read";

import {
  type Scratch,
  anonymous,
  asArray,
  asBlueprintSummary,
  asCardSummary,
  bind,
  dotFor,
  dropScratchDatabases,
  insertAccount,
  mark,
  scratchDatabase,
} from "./contract";

let s: Scratch;
let registry: Registry;
let handle: string;

beforeAll(async () => {
  s = await scratchDatabase();
  const owner = await insertAccount(s, mark("t080-parity"));
  handle = owner.handle;

  registry = buildRegistry(readContent().map((loaded) => loaded.blueprint));

  const digestByRef = new Map<string, string>();
  for (const card of registry.cards()) {
    digestByRef.set(card.ref, card.digest);
    await s.query(
      "insert into card_version (card_id, version, digest, owner_id, visibility, body, source) " +
        "values ($1, $2, $3, $4, 'public', $5, $6)",
      [card.id, card.version, card.digest, owner.id, JSON.stringify(card.card), `# ${card.ref}\n`],
    );
  }

  for (const bp of registry.blueprints()) {
    const [bundle] = await s.query(
      "insert into bundle (owner_id, slug, visibility) values ($1, $2, 'public') returning id",
      [owner.id, bp.slug],
    );
    await s.query(
      "insert into release (bundle_id, version, digest, dot, manifest, card_refs, card_digests) " +
        "values ($1, '1.0.0', $2, $3, $4, $5, $6)",
      [
        bundle.id,
        bp.digest,
        dotFor(bp.cardRefs),
        JSON.stringify(bp.manifest),
        bp.cardRefs,
        bp.cardRefs.map((ref) => digestByRef.get(ref) ?? ""),
      ],
    );
  }
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC1 against the build", () => {
  it("returns the nine blueprints, in the build's order and with its fields", async () => {
    const blueprints = await bind("blueprints");
    const rows = asArray(await blueprints(s.db, anonymous), "blueprints()").map((row, i) =>
      asBlueprintSummary(row, `blueprints()[${i}]`),
    );
    expect(rows.length, "content/blueprints holds nine bundles").toBe(9);
    expect(rows.map((b) => b.slug)).toEqual(registry.blueprints().map((b) => b.slug));
    for (const [i, expected] of registry.blueprints().entries()) {
      expect(rows[i].ownerHandle).toBe(handle);
      expect(rows[i].digest, `blueprints()[${i}].digest`).toBe(expected.digest);
      expect(rows[i].manifest, `blueprints()[${i}].manifest`).toEqual(expected.manifest);
      expect([...rows[i].cardRefs], `blueprints()[${i}].cardRefs`).toEqual([...expected.cardRefs]);
    }
  });

  it("returns every card version, in the build's order and with its fields", async () => {
    const cards = await bind("cards");
    const rows = asArray(await cards(s.db, anonymous), "cards()").map((row, i) =>
      asCardSummary(row, `cards()[${i}]`),
    );
    const expected = registry.cards();
    expect(rows.map((c) => c.ref)).toEqual(expected.map((c) => c.ref));
    for (const [i, want] of expected.entries()) {
      expect(rows[i].id).toBe(want.id);
      expect(rows[i].version).toBe(want.version);
      expect(rows[i].digest, `cards()[${i}].digest`).toBe(want.digest);
      expect(rows[i].card, `cards()[${i}].card`).toEqual(want.card);
      expect(
        rows[i].usedIn.map((u) => u.slug),
        `cards()[${i}].usedIn — the engine's index answers "blueprint slugs that pin this ` +
          `exact version, distinct and sorted"; D-80-01 owner-qualifies each entry, and ` +
          `every seeded bundle is under one handle (B-20), so the slugs must still match.`,
      ).toEqual([...want.usedIn]);
      for (const use of rows[i].usedIn) expect(use.ownerHandle).toBe(handle);
    }
  });

  it("counts 57 card versions over 53 distinct ids, which is what AC1's 'fifty-three' names", async () => {
    const cards = await bind("cards");
    const latestCards = await bind("latestCards");
    const all = asArray(await cards(s.db, anonymous), "cards()");
    const latest = asArray(await latestCards(s.db, anonymous), "latestCards()");
    expect(all.length).toBe(registry.cards().length);
    expect(latest.length).toBe(registry.latestCards().length);
    expect(
      { versions: all.length, ids: latest.length },
      `AC1 says "the nine blueprints and fifty-three cards". The build produces 57 card ` +
        `*versions* over 53 distinct *ids*, so "fifty-three" names \`latestCards()\` and not ` +
        `\`cards()\`. D-80-03's aside — that the current-release rule "turns 57 files on ` +
        `disk into AC1's 53" — does not account for it: every seeded bundle has a single ` +
        `release, so no card is dropped by that rule at all. The 57→53 step is versions to ` +
        `ids. Recorded here rather than left to be rediscovered from a count that is off ` +
        `by four.`,
    ).toEqual({ versions: 57, ids: 53 });
  });

  it("returns the build's phases, tags and categories", async () => {
    const phases = await bind("phases");
    const tags = await bind("tags");
    const categories = await bind("categories");
    expect(asArray(await phases(s.db, anonymous), "phases()")).toEqual([...registry.phases()]);
    expect(asArray(await tags(s.db, anonymous), "tags()")).toEqual([...registry.tags()]);
    expect(asArray(await categories(s.db, anonymous), "categories()")).toEqual([
      ...registry.categories(),
    ]);
  });

  it("AC4: the archive's bucket sizes do not sum to its card count", async () => {
    /* The one place the inequality is a fact rather than a fixture. The contract: "assert the
       sum only against the archive" — on a small fixture one card in two buckets and one in
       none cancel exactly, and the inequality reds against correct code. Here it does not
       cancel: 17 of the 57 card versions declare no phase and one declares two. */
    const cards = await bind("cards");
    const phases = await bind("phases");
    const cardsByPhase = await bind("cardsByPhase");
    const count = asArray(await cards(s.db, anonymous), "cards()").length;
    const names = asArray(await phases(s.db, anonymous), "phases()") as string[];
    let sum = 0;
    for (const phase of names) {
      sum += asArray(await cardsByPhase(s.db, anonymous, phase), `cardsByPhase(${phase})`).length;
    }
    const expectedSum = registry
      .phases()
      .reduce((n, phase) => n + registry.cardsByPhase(phase).length, 0);
    expect(
      { sum, count },
      `AC4: "bucket sizes do not sum to the card count, and a test asserts that as ` +
        `intended". A partitioning implementation makes these equal. The build's own ` +
        `numbers are ${expectedSum} and ${registry.cards().length}.`,
    ).toEqual({ sum: expectedSum, count: registry.cards().length });
    expect(sum).not.toBe(count);
  });

  it("returns the build's phase buckets, bucket for bucket", async () => {
    const cardsByPhase = await bind("cardsByPhase");
    for (const phase of registry.phases()) {
      const rows = asArray(await cardsByPhase(s.db, anonymous, phase), `cardsByPhase(${phase})`);
      expect(
        rows.map((row, i) => asCardSummary(row, `cardsByPhase(${phase})[${i}]`).ref),
        `cardsByPhase(${phase})`,
      ).toEqual(registry.cardsByPhase(phase).map((c) => c.ref));
    }
  });

  it("returns the build's duplicate groups", async () => {
    const duplicates = await bind("duplicates");
    const groups = asArray(await duplicates(s.db, anonymous), "duplicates()").map((group, i) =>
      asArray(group, `duplicates()[${i}]`).map((row, j) =>
        asCardSummary(row, `duplicates()[${i}][${j}]`).ref,
      ),
    );
    expect(
      groups,
      `D-80-05: duplicates are grouped on the canonical JSON of the body minus ` +
        `\`id\`/\`version\`/\`author\`/\`provenance\`, never on the stored digest column — ` +
        `\`cardDigest\` hashes id and version, so two rows cannot share one. The shipped ` +
        `archive happens to contain no such pair, which makes this an emptiness check here ` +
        `and the reason \`privacy.test.ts\` builds real twins.`,
    ).toEqual(registry.duplicates().map((group) => group.map((c) => c.ref)));
  });

  it("returns the build's users for a card two blueprints pin", async () => {
    const usersOf = await bind("usersOf");
    const shared = registry.cards().filter((c) => c.usedIn.length > 1);
    expect(shared.length, "the archive must contain at least one card two bundles pin").toBeGreaterThan(0);
    for (const card of shared) {
      const rows = asArray(await usersOf(s.db, anonymous, card.id), `usersOf(${card.id})`);
      const slugs = rows.map((row, i) => asBlueprintSummary(row, `usersOf()[${i}]`).slug);
      expect(slugs, `usersOf(${card.id})`).toEqual([...registry.usersOf(card.id)]);
    }
  });
});
