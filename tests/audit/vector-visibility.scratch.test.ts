/* ============================================================
   Audit — AC4 over the VECTOR channel, closing D-200-33's
   remaining clause (a) (docs/ARCHITECTURE.md §11.1)

   The revision log records the debt in these words: "AC4 over the
   vector channel is STRUCTURALLY guaranteed — `similarCandidates`
   subsets the post-visibility candidate list and never queries
   `release_embedding` freely — and UNTESTED; the day that
   signature changes, the guarantee evaporates silently and a cell
   is owed." This file is that cell.

   ── why `tests/server/t200/privacy.test.ts` does not already cover it ──
   It is AC4's own suite, thorough over three searchers and four
   actor kinds, and every world it builds goes in through
   `insertRelease` and never calls `reembedRelease`. T300's own
   `unmoved.test.ts` states this as the fact AC2 rests on: those
   fixtures "build releases through a local `insertRelease` and
   never reach `publish()` or `runImport`, so the two vector tables
   are empty and the channel has nothing to read." An empty
   `release_embedding` cannot leak through a channel with nothing
   in it, so the 240+ AC4 cells that exist today have never once
   put a real vector in front of `similarCandidates` for a private
   row. This is the first suite to do that.

   ── why the world below is T300's own and not a new one ──
   `tests/server/t300/world.ts` builds four public blueprints and
   ships a query, `paraphrase`, proven by `recall.test.ts` to
   retrieve `service` through the vector channel while sharing no
   literal word with what it retrieves. Writing a second
   corpus and hoping a hand-picked paraphrase clears the cutoff
   would make this file's own fixture the thing actually under
   test. Reusing the proven one leaves exactly one new variable:
   `service`'s bundle and its pinned card are turned PRIVATE after
   the vectors are written, mirroring how a real bundle usually
   goes private — a publish already happened, the embedding already
   exists in `release_embedding` (D-200-25: `reembedRelease` does
   not consult visibility, on purpose, "because a vector that is
   skipped while a blueprint is private has nothing to trigger it
   on the day the blueprint goes public"), and then the owner flips
   one column.

   ── the flip, not a second corpus ──
   The exact bundle already measured to clear the channel is sealed
   private with one `UPDATE`, and the SAME query is asked again as
   an anonymous caller. A search that answers nothing over a world
   with no embedded private content would prove nothing; this one
   embeds it, confirms the vector clears the query's own cutoff
   WHILE PUBLIC, and only then asks whether sealing it changes the
   answer.

   ── what counts as a leak here ──
   Not "the item is absent from `hits`" alone. The whole `Results`
   value is walked for `service`'s identifying strings — hits,
   every `item` member, and every facet key and value — with the
   same `collectStrings`/`findTokens` sweep `privacy.test.ts` uses.
   docs/ARCHITECTURE.md's own search row names the near-miss this
   guards against: "The AC4 leak that is easiest to miss arrives
   through the FACET MAP rather than the hits."
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import { carriesSimilarity, lexicalEntries } from "../server/t300/contract";
import {
  assertTellsCannotOverMatch,
  bind,
  findTokens,
  itemKey,
  search,
} from "../server/t200/contract";
import {
  anonymous,
  cardVersionEmbeddings,
  dropScratchDatabases,
  recordedSetup,
  releaseEmbeddings,
  scratchDatabase,
  type Scratch,
} from "../server/t200/fixtures";
import { buildWorld, type World } from "../server/t300/world";

let s: Scratch;
let w: World;
const setup = recordedSetup("the T300 world, embedded, with `service` then sealed private");

/**
 * `service`'s identifying strings, gathered from the fixture rather than typed twice.
 *
 * `w` is only assigned inside `beforeAll`, so this reads it through a function called after
 * the fact rather than a module-scope constant — the same D-200-27 reason `unmoved.test.ts`'s
 * `PROBES` table is a list of thunks: a `describe` body runs at collection time and a bare
 * `w.service` there throws before any hook has run.
 *
 * `"kitchen"` and not the whole title: it is in `service`'s title (`world.ts`'s own doc:
 * "the only title carrying `kitchen`") and in nothing else this world plants, and any string
 * containing it — the full title included — trips `findTokens`'s `includes` check the same
 * way. Checking the word rather than the sentence also survives a future edit to the fixture's
 * exact wording without silently going blind.
 */
function tellsFor(world: World): readonly string[] {
  return [
    world.service.slug,
    world.service.release.digest,
    world.service.card.ref,
    world.service.card.cardId,
    "kitchen",
  ];
}

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);

    /* Checked before the tells are used, exactly as `privacy.test.ts` checks its own: a
       blacklist asserted with `includes` answers "do these characters appear", and the claim
       here is "did `service` leak" — the two differ exactly when a tell is a substring of
       something `household`, `glacier` or `bonds` may legitimately carry. */
    const others = [w.household, w.glacier, w.bonds];
    assertTellsCannotOverMatch(tellsFor(w), [
      ...others.flatMap((sh) => [
        sh.slug,
        sh.release.digest,
        sh.card.ref,
        sh.card.cardId,
        sh.prose.title,
        sh.prose.summary,
        sh.prose.description,
        sh.card.body.name,
        sh.card.body.action,
        sh.card.body.spec,
      ]),
      w.owner.handle,
      ...CORE_ONTOLOGY.terms.map((t) => t.id),
    ]);

    /* The production writer, bound live — the same export `publish()` calls inside its own
       transaction (D-300-06 F4.2). Called directly rather than through a full `publish()`
       round trip: what AC4-over-the-vector-channel turns on is what `similarCandidates` does
       with a row that exists in `release_embedding`, not how that row got there, and every
       merged T300 suite (`recall.test.ts`, `hybrid.test.ts`, `unmoved.test.ts`) measures the
       same writer the same way for the same reason. */
    const reembed = await bind("reembedRelease");
    for (const shelf of w.shelves) {
      await reembed(s.db, shelf.release.bundleId, shelf.release.digest);
    }
  });
}, 120_000);

afterAll(async () => {
  await dropScratchDatabases();
});

/* --------------------- the premises --------------------- */

describe("the fixture actually puts a real vector in front of a real leak surface", () => {
  it("all four releases and all four cards are embedded, service's included", async () => {
    setup.check();
    const releases = await releaseEmbeddings(s);
    const cards = await cardVersionEmbeddings(s);
    expect(
      releases.map((r) => r.subjectId),
      `\`reembedRelease\` ran for all four shelves. If service's own row is missing, nothing ` +
        `below measures AC4 over the vector channel — it measures AC4 over an empty table, ` +
        `which \`privacy.test.ts\` already covers and which proves nothing new.`,
    ).toContain(w.service.release.id);
    expect(releases.length).toBe(4);
    expect(cards.length).toBe(4);
  });

  it("while `service` is still public, its own paraphrase retrieves it through the vector channel", async () => {
    setup.check();
    const before = await search("searchBlueprints", s.db, anonymous, { q: w.paraphrase });
    const hit = before.hits.find((h) => itemKey(h.item) === `blueprint:${w.owner.handle}/${w.service.slug}`);
    expect(
      hit,
      `THE CONTROL. Everything below asks whether sealing \`service\` hides it; this asks the ` +
        `opposite question first — does the query find it AT ALL while public? Without this, a ` +
        `search that finds nothing for any reason (a broken query, an unprovisioned encoder, a ` +
        `retrieval bug) would satisfy every privacy assertion below vacuously.\n` +
        `  query: ${JSON.stringify(w.paraphrase)}\n` +
        `  found: ${before.hits.map((h) => itemKey(h.item)).join(", ") || "(nothing)"}`,
    ).toBeDefined();
    expect(
      { similarity: carriesSimilarity(hit?.evidence ?? []), lexical: lexicalEntries(hit?.evidence ?? []) },
      `and it has to be the VECTOR channel doing the finding: \`recall.test.ts\` already ` +
        `establishes the paraphrase shares no literal token with anything this world plants, ` +
        `so a lexical entry here would mean this premise is measuring the wrong channel.`,
    ).toEqual({ similarity: true, lexical: [] });
  });

  it("and its card's own paraphrase retrieves the card the same way", async () => {
    setup.check();
    const before = await search("searchCards", s.db, anonymous, { q: w.cardParaphrase });
    const hit = before.hits.find((h) => itemKey(h.item) === `card:${w.service.card.ref}`);
    expect(hit, `query: ${JSON.stringify(w.cardParaphrase)}`).toBeDefined();
    expect(carriesSimilarity(hit?.evidence ?? [])).toBe(true);
    expect(lexicalEntries(hit?.evidence ?? [])).toEqual([]);
  });
});

/* --------------------- the seal --------------------- */

describe("`service` is sealed private, bundle and pinned card both", () => {
  it("flips exactly the two visibility columns this world's writers set", async () => {
    setup.check();
    await s.query("update bundle set visibility = 'private' where id = $1", [w.service.bundle.id]);
    await s.query("update card_version set visibility = 'private' where id = $1", [
      w.service.card.rowId,
    ]);
    const [bundleRow] = await s.query("select visibility from bundle where id = $1", [
      w.service.bundle.id,
    ]);
    const [cardRow] = await s.query("select visibility from card_version where id = $1", [
      w.service.card.rowId,
    ]);
    expect([bundleRow?.visibility, cardRow?.visibility], "the premise for every cell below").toEqual([
      "private",
      "private",
    ]);
  });
});

/* --------------------- the criterion --------------------- */

describe("AC4 over the vector channel: the sealed release's identity appears NOWHERE", () => {
  it("`searchBlueprints` with the same paraphrase that found it a moment ago now finds nothing of it", async () => {
    setup.check();
    const results = await search("searchBlueprints", s.db, anonymous, { q: w.paraphrase });
    const tells = tellsFor(w);
    const leaked = findTokens(results, tells);
    expect(
      leaked,
      `AC4, over \`similarCandidates\` specifically. \`release_embedding\` still holds ` +
        `${w.service.slug}'s vector — nothing about sealing a bundle deletes it (D-200-25) — ` +
        `and the query above is PROVEN to clear the cosine cutoff against it. So if this ` +
        `leaks, it leaks through the exact mechanism docs/ARCHITECTURE.md §11.1(a) names: ` +
        `\`similarCandidates\` stopped subsetting the post-visibility candidate list and read ` +
        `\`release_embedding\` freely instead.\n` +
        `  Every string in the whole \`Results\` value was walked — hits, every \`item\` ` +
        `member, and every facet key and value — not only \`hits.map(itemKey)\`, because a ` +
        `rank the vector channel produced still surfaces through \`item\`, and this repository ` +
        `has already shipped a facet-map leak once (docs/ARCHITECTURE.md's search row).\n` +
        `  query: ${JSON.stringify(w.paraphrase)}\n` +
        `  tells checked: ${JSON.stringify(tells)}\n` +
        `  hit keys in the response: ${results.hits.map((h) => itemKey(h.item)).join(", ") || "(none)"}`,
    ).toEqual([]);
    expect(
      results.hits.some((h) => itemKey(h.item) === `blueprint:${w.owner.handle}/${w.service.slug}`),
      "restated as a hit-list membership check, so a red names the exact failing shape",
    ).toBe(false);
  });

  it("`searchCards` with the card's own paraphrase finds nothing of it either", async () => {
    setup.check();
    const results = await search("searchCards", s.db, anonymous, { q: w.cardParaphrase });
    const tells = tellsFor(w);
    const leaked = findTokens(results, tells);
    expect(
      leaked,
      `The same guarantee, on the card side: \`cards.ts\`'s own \`similarCandidates\` has to ` +
        `subset the post-visibility card list the same way blueprints.ts's does, over its own ` +
        `\`card_version_embedding\` table.\n` +
        `  query: ${JSON.stringify(w.cardParaphrase)}\n` +
        `  hit keys in the response: ${results.hits.map((h) => itemKey(h.item)).join(", ") || "(none)"}`,
    ).toEqual([]);
    expect(results.hits.some((h) => itemKey(h.item) === `card:${w.service.card.ref}`)).toBe(false);
  });

  it("an unfiltered listing of everything carries none of it either", async () => {
    setup.check();
    const blueprints = await search("searchBlueprints", s.db, anonymous, {});
    const cards = await search("searchCards", s.db, anonymous, {});
    const tells = tellsFor(w);
    expect(findTokens(blueprints, tells), "the plainest reach: the whole public shelf").toEqual([]);
    expect(findTokens(cards, tells), "the whole public card shelf").toEqual([]);
  });
});

/* --------------------- the structural cell --------------------- */

describe("the guarantee is READ-TIME, over a table that genuinely holds the private row", () => {
  it("the sealed release's vector is still in `release_embedding` while the searches above find nothing", async () => {
    setup.check();
    const rows = await releaseEmbeddings(s);
    expect(
      rows.map((r) => r.subjectId),
      `This is what makes the criterion block above a measurement of \`similarCandidates\` ` +
        `and not of \`reembedRelease\` quietly declining to write a private row. D-200-25 rules ` +
        `that the writer does not consult visibility at all — "a vector that is skipped while ` +
        `a blueprint is private has nothing to trigger it on the day the blueprint goes ` +
        `public" — so the row is here, unprivileged, and the ONLY thing standing between it ` +
        `and an anonymous caller is the read path's own narrowing.`,
    ).toContain(w.service.release.id);
  });

  it("restoring visibility makes the same query find it again, so the seal above was real", async () => {
    setup.check();
    await s.query("update bundle set visibility = 'public' where id = $1", [w.service.bundle.id]);
    await s.query("update card_version set visibility = 'public' where id = $1", [
      w.service.card.rowId,
    ]);
    try {
      const results = await search("searchBlueprints", s.db, anonymous, { q: w.paraphrase });
      expect(
        results.hits.map((h) => itemKey(h.item)),
        `The disagreeing control this file would be worthless without: a search that finds ` +
          `nothing for every input satisfies every "leaks nothing" assertion above trivially. ` +
          `The ONLY thing that changed between the reds this cell must not produce and the ` +
          `green two blocks up is two \`visibility\` columns.`,
      ).toContain(`blueprint:${w.owner.handle}/${w.service.slug}`);
    } finally {
      /* Restored to private again, so nothing after this cell in a future run of this file
         inherits a public `service` — this file's own database is dropped in `afterAll`
         regardless, but the cell earns its "control" reading only if it leaves the world the
         way every cell above it assumed. */
      await s.query("update bundle set visibility = 'private' where id = $1", [w.service.bundle.id]);
      await s.query("update card_version set visibility = 'private' where id = $1", [
        w.service.card.rowId,
      ]);
    }
  });
});
