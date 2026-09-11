/* ============================================================
   T130 AC1 — counted at read time, never stored as a counter

   "Anything countable is counted, never stored as a counter. A
   stored count passes every criterion here and drifts silently the
   first time a bundle is deleted, transferred (T120) or made
   private. There is no counter column and there must not be one."

   ── the cell that separates counted from stored ──
   Every other cell in this file passes against a counter that some
   T130 write keeps up to date. What separates the two is a row
   arriving or leaving WITHOUT any T130 function being called:

     read once  ->  seed a bundle with plain SQL  ->  read again

   A counter maintained by this module cannot move across that
   middle step, because this module was never entered. That is
   AC1's own argument — "drifts silently the first time a bundle is
   deleted" — turned into a measurement rather than a criterion.

   The same shape covers AC2's second paragraph from the other
   side: a process-level memo also cannot move, so one mutation
   reds both. They are not two axes and are not counted as two.

   ── `counts.terms` reads `release.local_vocabulary`, and the
      contract no longer has a second store to mean ──
   See `insertNamespacedTerm`'s docblock in `contract.ts`. The
   fixture used to write `ontology_term` as well, because AC1's
   "namespaced terms" could have meant either store;
   `0009_drop_ontology_versioning` dropped that table with the
   versions it was keyed to, so the ambiguity is settled by the
   schema. Every claim below already held under this reading.

   ── what is deliberately not asserted ──
   Whether a bundle with no release counts. `insertBundle` always
   writes one, so the two readings agree on every fixture here.
   Asserting either would be inventing a contract, and the fixture
   is one line away if it is ever ruled.

   ── `counts.cards` IS BLOCKED, and these cells red until it is
      not — which is the point of leaving them ──
   D-130-04: `CardSummary` carries no owner, T080's only
   attribution is `card.author`, declared `author?: string` and
   written by the uploader rather than being the row's ownership,
   and `card_version.owner_id` is authoritative and unpublished.
   **Ruled: do not re-implement T080's visibility filter against
   `card_version`**, and `counts.cards` waits on an amendment to a
   merged task's record, which is the owner's call.

   The cells are NOT weakened for that. A criterion known to be
   unbuildable today is more informative failing than passing, and
   a red that names its reason beats a green that cannot tell its
   own causes apart. What is named here is that a `counts.cards`
   red is the BLOCK until the amendment lands — not a defect in
   whatever gets built around it.

   And one fixture choice is deliberate rather than incidental:
   `falls when a card row is deleted` counts a card **no release
   pins**. "Cards this handle owns" and "cards the index carries
   for this handle" differ by exactly that row and by nothing else
   in this file, and `components/profile/load.ts:161` counts the
   first. A fixture where the two agreed would hide the question
   the ruling is about.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  anonymous,
  asProfileRecord,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertNamespacedTerm,
  mark,
  scratchDatabase,
  type AccountFixture,
  type Scratch,
} from "./contract";

let s: Scratch;

async function readCounts(handle: string, actor: unknown = anonymous) {
  const getProfile = await bind("getProfile");
  const record = asProfileRecord(
    await getProfile(s.db, actor, handle),
    `getProfile(db, actor, "${handle}")`,
  );
  /* D-130-18: read through an index signature. `counts.cards` is BLOCKED (D-130-04) and the
     cells asserting it are left redding deliberately — see this file's header at :39. Typing
     this `Counts` would make the compiler delete a block marker its author placed on purpose. */
  return record.counts as unknown as Record<string, number>;
}

/** A handle nobody else in this file touches, so no cell depends on another's order. */
async function freshAccount(tag: string): Promise<AccountFixture> {
  return insertAccount(s, { handle: mark(`t130-counts-${tag}`).toLowerCase() });
}

beforeAll(async () => {
  s = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC1: a count that no T130 call maintained still moves", () => {
  /* The discriminating cells. Rows arrive and leave through plain SQL, so `lib/server/profiles`
     is never entered between the two reads — a stored counter and a memo are both frozen
     across that gap and a read-time count is not. */

  it("falls when a blueprint is deleted behind the module's back", async () => {
    const a = await freshAccount("deletion");
    const card = await insertCard(s, {
      id: `${a.handle}/doomed-card`,
      ownerId: a.id,
      authorHandle: a.handle,
    });
    const doomed = await insertBundle(s, { owner: a, slug: "doomed", cards: [card] });
    await insertBundle(s, { owner: a, slug: "survivor", cards: [card] });
    expect((await readCounts(a.handle)).blueprints).toBe(2);

    await s.query("delete from release where bundle_id = $1", [doomed.id]);
    await s.query("delete from bundle where id = $1", [doomed.id]);

    expect(
      (await readCounts(a.handle)).blueprints,
      `AC1's own worked case: a stored count "drifts silently the first time a bundle is ` +
        `deleted". The row is gone from \`bundle\`; the count has to be gone with it.`,
    ).toBe(1);
  });

});

describe("AC1: `counts.terms` is namespaced ownership, under either store", () => {
  it("ignores a core term, which is namespaced to nobody", async () => {
    const a = await freshAccount("core-terms");
    const bundle = await insertBundle(s, { owner: a, slug: "core-terms", cards: [] });
    /* A term with no `<handle>/` prefix. `components/profile/load.ts:163` reads ownership off
       the id prefix precisely because a term has no author field, so an
       unprefixed term belongs to no handle and must not land on anyone's count. */
    await insertNamespacedTerm(s, { bundle, termId: "planning" });

    expect((await readCounts(a.handle)).terms).toBe(0);
  });

  it("counts a term whose prefix is this handle and not one that merely contains it", async () => {
    const a = await freshAccount("prefix");
    const bundle = await insertBundle(s, { owner: a, slug: "prefix", cards: [] });
    await insertNamespacedTerm(s, { bundle, termId: `${a.handle}/mine` });
    /* `<something>-suffix/theirs` CONTAINS this handle and is not namespaced to it. The
       substring reading and the prefix reading differ by exactly this row, and nothing in a
       passing run separates them without it — the `card_version` inside
       `card_version_id_version_key` shape, at an ontology id. */
    await insertNamespacedTerm(s, { bundle, termId: `${a.handle}-suffix/theirs` });

    expect((await readCounts(a.handle)).terms).toBe(1);
  });
});
