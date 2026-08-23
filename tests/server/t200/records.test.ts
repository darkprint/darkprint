/* ============================================================
   T200 — the item a hit carries, and the read semantics it
   inherits

   ── the item type ──
   D-200-08. The dispatched block returned
   `Results<BlueprintRecord>` and `Results<CardVersionRecord>`;
   both halves of this task reported it independently and both
   were corrected. `lib/core/archive/registry.ts` keys
   `BlueprintRecord` on `slug` alone — D-80-01: "a record keyed on
   one half of a two-part key cannot tell `alice/foo` from
   `bob/foo`" under B-09 — and its `CardVersionRecord.usedIn` is
   bare slugs. The published items are now `BlueprintSummary` and
   `CardSummary` from `@/lib/server/registry`, which is also the
   only conversion any merged module offers.

   `ownerHandle` is the member the correction is about, and this
   file is where it is asserted. T261 moves the public blueprint
   URL onto exactly that half of the key, so a hit without it is a
   hit nothing downstream can link to.

   ── the read semantics ──
   The section publishes T080's rules here "so this task's author
   binds to the same rules", and says in as many words that they
   are properties of the barrel this task consumes rather than
   implementation details it may ignore. Three of them are
   observable through a search response, and each is a way a
   re-implementation would differ from a consumer:

     * a bundle whose owner has NO HANDLE is excluded — it has no
       `(owner, slug)` key to be addressed by;
     * `cardRefs` is filtered to the cards the caller may read, so
       a private card's ref is absent even from a PUBLIC
       blueprint that pins it;
     * a pin that does not parse is dropped rather than carried.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import { blueprints } from "@/lib/server/registry";
import type { Db } from "@/lib/db";

import { asBlueprintItem, asCardItem, asTermItem, itemKey, search } from "./contract";
import {
  anonymous,
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
  scratchDatabase,
  type Scratch,
} from "./fixtures";

interface Records {
  ownerHandle: string;
  /** The public blueprint that pins one visible card, one private card and one bad pin. */
  slug: string;
  visibleRef: string;
  sealedRef: string;
  unparseablePin: string;
  /** A bundle whose owner never took a handle. Everything about it is a tell. */
  handlelessSlug: string;
  handlelessToken: string;
}

let s: Scratch;
let r: Records;
const setup = recordedSetup("the T200 record world");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    const ontology = await insertOntologyVersion(s, CORE_ONTOLOGY.version);
    for (const term of CORE_ONTOLOGY.terms) {
      await insertOntologyTerm(s, {
        versionId: ontology.id,
        term: term as unknown as Record<string, unknown>,
      });
    }

    const owner = await insertAccount(s, mark("t200r"));

    const visible = await insertCard(s, { ownerId: owner.id, id: mark("rec-open-card") });
    const sealed = await insertCard(s, {
      ownerId: owner.id,
      id: mark("rec-sealed-card"),
      visibility: "private",
    });

    const slug = mark("rec-slug");
    const bundle = await insertBundle(s, { owner, slug, visibility: "public" });
    const release = await insertRelease(s, {
      bundle,
      version: "1.0.0",
      cards: [visible, sealed],
      manifest: manifest({ slug, title: `Records ${mark("t")}`, tags: [mark("rec-tag")] }),
      scoredOntologyVersionId: ontology.id,
    });

    /* `release.card_refs` is a `text[]` with no foreign key, so a pin that names nothing
       and does not even parse as `id@version` is a state the schema permits — T120's
       account deletion produces it. Appended after the release is written, so the stored
       digest still describes the two real cards. */
    const unparseablePin = `${mark("rec-broken-pin")}@@not-a-version@@`;
    await s.query("update release set card_refs = card_refs || $1::text[] where id = $2", [
      [unparseablePin],
      release.id,
    ]);

    /* B-06 and T080: an owner with no handle has no `(owner, slug)` key, so the bundle is
       not addressable and is excluded from the index. `account.handle` is nullable. */
    const handlelessSlug = mark("rec-handleless-slug");
    const handlelessToken = mark("rec-handleless-title");
    const [row] = await s.query(
      "insert into account (github_id, github_login) values ($1, $2) returning id",
      [`gh-${handlelessSlug}`, `login-${handlelessSlug}`],
    );
    const handlelessOwner = { id: String(row.id), handle: "" };
    const orphan = await insertBundle(s, {
      owner: handlelessOwner,
      slug: handlelessSlug,
      visibility: "public",
    });
    await insertRelease(s, {
      bundle: orphan,
      version: "1.0.0",
      cards: [visible],
      manifest: manifest({
        slug: handlelessSlug,
        title: `Unaddressable ${handlelessToken}`,
        summary: `No owner handle, ${handlelessToken}.`,
      }),
      scoredOntologyVersionId: ontology.id,
    });

    r = {
      ownerHandle: owner.handle,
      slug,
      visibleRef: visible.ref,
      sealedRef: sealed.ref,
      unparseablePin,
      handlelessSlug,
      handlelessToken,
    };
  });
});

afterAll(async () => {
  await dropScratchDatabases();
});

/* --------------------- the fixture, checked against T080 itself --------------------- */

/**
 * Green in the blind position, and deliberately so.
 *
 * The three inherited-semantics cells below assert that a SEARCH obeys rules T080 already
 * obeys, and a red in one of them is only meaningful if the fixture really does exercise
 * the rule. So the same three claims are put to T080's own reader first, with
 * `{ kind: "anonymous" }` per D-200-06. That reader is merged, was written by somebody
 * else, for a different task, before this suite existed — which is what makes it a second
 * axis rather than a consistency check.
 */
describe("the fixture exercises the rules the cells below assert", () => {
  it("T080 itself excludes the handleless bundle and filters the private pin", async () => {
    setup.check();
    const found = await blueprints(s.db as Db, anonymous);
    expect(
      found.map((b) => `${b.ownerHandle}/${b.slug}`),
      "one addressable blueprint; the handleless owner's bundle has no `(owner, slug)` key",
    ).toEqual([`${r.ownerHandle}/${r.slug}`]);
    expect(
      [...found[0].cardRefs],
      "the release pins a visible card, a private card and an unparseable string; T080 " +
        "answers the first alone, which is what the search is required to inherit",
    ).toEqual([r.visibleRef]);
  });
});

/* --------------------- D-200-08 --------------------- */

describe("D-200-08 the item types", () => {
  it("every blueprint hit is a `BlueprintSummary`, `ownerHandle` included", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, {});
    expect(
      results.hits.length,
      "the control: an empty hit set makes every claim about a hit's shape vacuous",
    ).toBeGreaterThan(0);
    for (const [i, hit] of results.hits.entries()) {
      const item = asBlueprintItem(hit.item, `searchBlueprints({}).hits[${i}].item`);
      expect(
        item.ownerHandle,
        `D-200-08: the block as dispatched returned \`BlueprintRecord\`, which carries no ` +
          `owner. Both halves of this task reported it independently, and it forced a LOSSY ` +
          `DOWNCONVERT — a hit carrying no owner is a hit T261's owner-path URL cannot be ` +
          `built from.`,
      ).toBe(r.ownerHandle);
    }
  });

  it("every card hit is a `CardSummary`, with an owner-qualified `usedIn`", async () => {
    setup.check();
    const results = await search("searchCards", s.db, anonymous, {});
    expect(results.hits.length, "the control: the card shelf is not empty").toBeGreaterThan(0);
    for (const [i, hit] of results.hits.entries()) {
      const item = asCardItem(hit.item, `searchCards({}).hits[${i}].item`);
      expect(
        Array.isArray(item.usedIn),
        `D-200-08: \`CardSummary.usedIn\` is \`readonly BlueprintKey[]\` and not ` +
          `\`CardVersionRecord\`'s bare \`string[]\` of slugs — two owners may hold the same ` +
          `slug, so a bare slug names two blueprints.`,
      ).toBe(true);
      for (const [j, use] of (item.usedIn as unknown[]).entries()) {
        const u = use as { ownerHandle?: unknown; slug?: unknown };
        expect(
          typeof u.ownerHandle === "string" && typeof u.slug === "string",
          `\`hits[${i}].item.usedIn[${j}]\` is ${JSON.stringify(use)}; every entry is ` +
            `\`{ ownerHandle, slug }\`.`,
        ).toBe(true);
      }
    }
  });

  it("every term hit is an `OntologyTerm`", async () => {
    setup.check();
    const results = await search("searchTerms", s.db, anonymous, {});
    expect(results.hits.length, "the control: the vocabulary is not empty").toBeGreaterThan(0);
    for (const [i, hit] of results.hits.entries()) {
      asTermItem(hit.item, `searchTerms({}).hits[${i}].item`);
    }
  });

  it("no surface returns the same item twice", async () => {
    setup.check();
    for (const name of ["searchBlueprints", "searchCards", "searchTerms"] as const) {
      const results = await search(name, s.db, anonymous, {});
      const keys = results.hits.map((h) => itemKey(h.item));
      expect(
        keys.length,
        `\`${name}\` returned ${keys.length} hits over ${new Set(keys).size} distinct items. ` +
          `A duplicated hit is a join fanning out, and it also makes every "the shelf holds ` +
          `N entries" assertion in this suite ambiguous.`,
      ).toBe(new Set(keys).size);
    }
  });
});

/* --------------------- the inherited read semantics --------------------- */

describe("the read semantics this task inherits from T080", () => {
  it("a bundle whose owner has no handle never appears", async () => {
    setup.check();
    const shelf = await search("searchBlueprints", s.db, anonymous, {});
    expect(
      shelf.hits.map((h) => itemKey(h.item)),
      "the control: the addressable blueprint IS on the shelf, so the exclusion below is " +
        "about the handleless one rather than about an empty shelf",
    ).toEqual([`blueprint:${r.ownerHandle}/${r.slug}`]);

    /* Asked for by name as well, because "it is not in the listing" and "it cannot be
       reached" are different claims and a search is where the second one is tested. */
    const byQuery = await search("searchBlueprints", s.db, anonymous, { q: r.handlelessToken });
    expect(
      byQuery.hits.map((h) => itemKey(h.item)),
      `An owner with no handle has no \`(owner, slug)\` key to be addressed by (B-09), so the ` +
        `bundle is excluded from the index — published in the section as a read semantic this ` +
        `task INHERITS rather than an implementation detail it may ignore.\n` +
        `  A module that re-derived the index instead of consuming T080's would surface it, ` +
        `and every cell searching for something present would still pass.`,
    ).toEqual([]);
  });

  it("`cardRefs` on a PUBLIC blueprint omits the private card it pins", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, {});
    const item = asBlueprintItem(results.hits[0]?.item, "searchBlueprints({}).hits[0].item");
    expect(
      [...item.cardRefs],
      `The section's own words: "\`BlueprintSummary.cardRefs\` is filtered to cards the actor ` +
        `may read, so a partial caller's \`cardRefs\` does not reproduce \`digest\`'s input". ` +
        `A private card's ref IS the card appearing in a response — B-07 makes a private card ` +
        `exactly as invisible as a private bundle — so it is filtered out of a public ` +
        `blueprint's pins too.\n` +
        `  The release pins ${JSON.stringify([r.visibleRef, r.sealedRef])}; only the first ` +
        `may come back.`,
    ).toEqual([r.visibleRef]);
  });

  it("a pin that does not parse is dropped rather than carried", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, {});
    const item = asBlueprintItem(results.hits[0]?.item, "searchBlueprints({}).hits[0].item");
    expect(
      [...item.cardRefs],
      `"pins are canonicalised to \`id@version\`, with an unparseable pin dropped". ` +
        `\`release.card_refs\` is a \`text[]\` with no foreign key, so ` +
        `${JSON.stringify(r.unparseablePin)} is a state the schema permits and T120's account ` +
        `deletion produces.`,
    ).not.toContain(r.unparseablePin);
  });
});
