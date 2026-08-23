/* ============================================================
   T170 AC2 — "the list returns at most 10 with a cursor stable
   across a concurrent insert"

   ── WHAT IS HERE, AND WHAT IS HELD ──
   The order the list reads in is UNPUBLISHED, and it decides one
   cell. D-WAVE-01's argument for AC2 is that "an offset cursor
   shifts every row when a note is inserted ABOVE it" — which is
   only true if the list is newest-first. Under oldest-first a new
   note always sorts to the END, and B-18's tombstone means no row
   ever leaves, so **an offset cursor is correct and AC2 cannot
   tell it from a keyset one**. The three pieces of evidence in the
   tree point at oldest-first: `note_target_created_idx` is
   ascending, `lib/data/community.ts`'s seeded `comments` arrays
   are in ascending date order, and `Comments.tsx` renders
   `comments.slice(0, VISIBLE_NOTES)` — the FIRST ten.

   So the offset-falsification cell and the expected-order pins are
   HELD, charged upstream, and are NOT in this file. Writing them
   both ways, or detecting the order at runtime and branching,
   would assert nothing about which is right — this is exactly
   where the contract has to bind rather than the suite guess.

   Everything below is order-independent and every one of them
   fires under either reading.

   ── THE PRECISION GAP, WHICH IS NOT AN OFFSET AND IS NOT A RACE ──
   `note.created_at` is `timestamptz` at MICROSECOND precision;
   `NoteRecord.createdAt` is a JS `Date` at MILLISECONDS. A cursor
   built from the returned record asks for rows after `…956000`
   when the row it came from is `…956849`, so that row satisfies
   its own cursor and the last note of every page is the first note
   of the next. Ordinary data does it — no concurrency, no clock
   skew — and the keyset-versus-offset cell could not catch it
   even if it were here, because a precision gap is not an offset.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  PAGE_SIZE,
  accountActor,
  asPage,
  bind,
  subMillisecondMicros,
  walkPages,
} from "./contract";
import {
  type NoteTarget,
  blueprintTarget,
  closeDatabase,
  openDatabase,
  premise,
  seedAccount,
  seedBundle,
  seedNotes,
} from "./fixtures";

let s: Scratch;

beforeAll(async () => {
  s = await openDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function stage(label: string, count: number) {
  const author = await seedAccount(s, label);
  const bundle = await seedBundle(s, { ownerId: author.id });
  const target: NoteTarget = blueprintTarget(bundle);
  const actor = accountActor(author.id, author.handle);
  const ids = await seedNotes(s.db, actor, target, count, label);
  return { actor, target, ids };
}

describe("T170 AC2 — at most 10, with a cursor", () => {
  it("a page never exceeds the page size", async () => {
    const { actor, target } = await stage("ac2-size", PAGE_SIZE + 5);
    const listNotes = await bind("listNotes");
    const page = asPage(await listNotes(s.db, actor, target), "listNotes page 1");

    expect(
      page.ids.length,
      `§T170: "Page size is 10 with a cursor (\`VISIBLE_NOTES\`)". A page carrying more is a ` +
        `list that ignores its own bound, and the client that renders it slices at 10 — so ` +
        `the surplus is fetched, paid for, and thrown away.`,
    ).toBeLessThanOrEqual(PAGE_SIZE);
    expect(page.ids.length).toBe(PAGE_SIZE);
  });

  it("a list shorter than the page size answers a null cursor", async () => {
    const { actor, target, ids } = await stage("ac2-short", 3);
    const listNotes = await bind("listNotes");
    const page = asPage(await listNotes(s.db, actor, target), "listNotes");

    expect(page.ids.length).toBe(ids.length);
    expect(
      page.cursor,
      `\`cursor: string | null\` — null is "there is no more". A module that always hands ` +
        `back a cursor makes every caller pay one extra empty round trip and never lets it ` +
        `stop, and a module that omits the key entirely leaves it unable to tell "no more" ` +
        `from "the field was never sent".`,
    ).toBeNull();
  });

  it("a list longer than the page size answers a non-null cursor", async () => {
    const { actor, target } = await stage("ac2-long", PAGE_SIZE + 1);
    const listNotes = await bind("listNotes");
    const page = asPage(await listNotes(s.db, actor, target), "listNotes");
    expect(
      page.cursor,
      `${PAGE_SIZE + 1} notes cannot fit in one page of ${PAGE_SIZE}, so there is more and ` +
        `the cursor has to say so. A null here loses the ${PAGE_SIZE + 1}th note for every ` +
        `caller, silently.`,
    ).not.toBeNull();
  });

  it("walking the cursor returns every note exactly once", async () => {
    const { actor, target, ids } = await stage("ac2-walk", 25);
    const listNotes = await bind("listNotes");
    const { pages } = await walkPages(listNotes, s.db, actor, target, "listNotes");
    const seen = pages.flat();

    const duplicated = [...new Set(seen.filter((id, i) => seen.indexOf(id) !== i))];
    expect(
      duplicated,
      `AC2: the walk returned ${duplicated.length} note(s) twice.\n` +
        `  Pages: ${pages.map((p) => p.length).join(" + ")} = ${seen.length}, for ` +
        `${ids.length} rows.\n` +
        `  The multiset is compared rather than the set, because a page returning one note ` +
        `twice has the same \`Set\` as one returning it once.`,
    ).toEqual([]);

    expect([...seen].sort(), `and no note may be skipped`).toEqual([...ids].sort());
    expect(
      pages.slice(0, -1).map((p) => p.length),
      `every page but the last is full — a short page followed by a cursor is a reader ` +
        `paying a round trip per note.`,
    ).toEqual(Array.from({ length: pages.length - 1 }, () => PAGE_SIZE));
  });
});

describe("T170 AC2 — the cursor carries FULL-PRECISION `created_at`", () => {
  /**
   * The precision gap, with its own premise asserted first.
   *
   * The cell can only discriminate if a page-boundary row actually carries sub-millisecond
   * microseconds — if it lands on a whole millisecond, truncation is a no-op and a broken
   * implementation goes green here for a reason that has nothing to do with being right.
   * That is the same shape as reading a run's failed count without its skipped count: a
   * measurement that could not have failed is not a zero.
   *
   * So three page boundaries are driven and the premise is asserted over all of them. Two
   * of the three would have to land on an exact millisecond for this run to be unable to
   * discriminate, and if that happens the cell says so instead of passing.
   */
  it("a page boundary does not duplicate its own last row", async () => {
    const { actor, target, ids } = await stage("ac2-micros", PAGE_SIZE * 3 + 1);
    const listNotes = await bind("listNotes");
    const { pages } = await walkPages(listNotes, s.db, actor, target, "listNotes");

    const boundaries = pages.slice(0, -1).map((p) => p[p.length - 1]);
    premise(
      boundaries.length >= 2,
      `this cell needs at least two page boundaries and the walk produced ` +
        `${boundaries.length}`,
    );

    const micros = await subMillisecondMicros(s, boundaries);
    premise(
      micros.some((m) => m !== 0),
      `THIS RUN COULD NOT DISCRIMINATE. Every page-boundary row landed on a whole ` +
        `millisecond (sub-millisecond micros: ${micros.join(", ")}), so truncating ` +
        `\`created_at\` to milliseconds is a no-op and a cursor built from the returned ` +
        `\`Date\` would pass. Re-run; this is a property of the timestamps this run ` +
        `happened to get, not of the implementation.`,
    );

    const seen = pages.flat();
    const duplicated = [...new Set(seen.filter((id, i) => seen.indexOf(id) !== i))];
    expect(
      duplicated,
      `AC2, the PRECISION gap: a page-boundary row came back on the next page too.\n` +
        `  \`note.created_at\` is \`timestamptz\` at MICROSECOND precision and ` +
        `\`NoteRecord.createdAt\` is a JS \`Date\` at MILLISECONDS. A cursor built from the ` +
        `returned RECORD — the obvious implementation — asks for rows after \`…956000\` ` +
        `when the row it came from is \`…956849\`, so that row satisfies its own cursor. ` +
        `The cursor has to carry the column's full-precision value.\n` +
        `  boundary rows' sub-millisecond micros: ${micros.join(", ")} (at least one is ` +
        `non-zero, so this run could discriminate)\n` +
        `  pages: ${pages.map((p) => p.length).join(" + ")} = ${seen.length} for ` +
        `${ids.length} rows`,
    ).toEqual([]);
    expect(seen.length, `and the walk returns each row once`).toBe(ids.length);
  });

  /**
   * `id` is the tiebreak, and this is the cell that needs it.
   *
   * Concurrency here is deliberate and is the one place in the suite where a `createdAt`
   * collision is WANTED: T010 measured 32 concurrent inserts landing on 12 distinct
   * timestamps. A cursor keyed on `createdAt` alone cannot order two rows sharing one, so
   * it either loses a row or repeats one at every collision that straddles a page boundary.
   */
  it("notes sharing a timestamp are still walked exactly once", async () => {
    const author = await seedAccount(s, "ac2-tie");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const actor = accountActor(author.id, author.handle);

    const postNote = await bind("postNote");
    const posted = await Promise.all(
      Array.from({ length: 32 }, (_, i) => postNote(s.db, actor, target, `tie ${i}`)),
    );
    const ids = posted.map((r) => String((r as Record<string, unknown>).id));

    const distinct = await s.query(
      "select count(distinct created_at) as n from note where target_kind = $1 and target_id = $2",
      [target.kind, target.refId],
    );
    premise(
      Number(distinct[0]?.n) < ids.length,
      `THIS RUN COULD NOT DISCRIMINATE: all ${ids.length} concurrent inserts got distinct ` +
        `timestamps (${String(distinct[0]?.n)} distinct), so there is no collision for the ` +
        `tiebreak to resolve. T010 measured 32 inserts to 12 distinct timestamps; a machine ` +
        `fast enough to separate every one of them makes this cell vacuous. Re-run.`,
    );

    const listNotes = await bind("listNotes");
    const { pages } = await walkPages(listNotes, s.db, actor, target, "listNotes over a tie");
    const seen = pages.flat();

    expect(
      [...seen].sort(),
      `AC2: \`id\` is the tiebreak because \`createdAt\` collides under concurrent inserts, ` +
        `and §T170 cites T010's measurement for it. ${ids.length} notes share ` +
        `${String(distinct[0]?.n)} timestamps here, so a cursor keyed on \`createdAt\` ` +
        `alone cannot order them and drops or repeats one at every collision straddling a ` +
        `page boundary.\n` +
        `  pages: ${pages.map((p) => p.length).join(" + ")} = ${seen.length}`,
    ).toEqual([...ids].sort());
    expect(new Set(seen).size, `no note twice`).toBe(ids.length);
  });
});

describe("T170 AC2 — a cursor is scoped to its own target", () => {
  /**
   * Not stated by the criterion and forced by AC1 read together with it: a cursor is a
   * position in ONE target's list. A module encoding only `(createdAt, id)` and taking the
   * target from its argument is correct; one that treats the cursor as a global position
   * leaks a second target's notes into the first one's page — and no cell that pages a
   * single target can see it.
   */
  it("a cursor from one blueprint does not page another's notes", async () => {
    const author = await seedAccount(s, "ac2-scope");
    const first = await seedBundle(s, { ownerId: author.id });
    const second = await seedBundle(s, { ownerId: author.id });
    const actor = accountActor(author.id, author.handle);
    const firstTarget = blueprintTarget(first);
    const secondTarget = blueprintTarget(second);

    const firstIds = await seedNotes(s.db, actor, firstTarget, PAGE_SIZE + 3, "scope-a");
    const secondIds = await seedNotes(s.db, actor, secondTarget, PAGE_SIZE + 3, "scope-b");

    const listNotes = await bind("listNotes");
    const page1 = asPage(await listNotes(s.db, actor, firstTarget), "listNotes(first) page 1");
    premise(page1.cursor !== null, `the first blueprint must have a second page`);

    const page2 = asPage(
      await listNotes(s.db, actor, firstTarget, page1.cursor),
      "listNotes(first) page 2",
    );

    expect(
      page2.ids.filter((id) => secondIds.includes(id)),
      `AC1 and AC2 together: a cursor is a position in ONE target's list. The second ` +
        `blueprint's notes were written between the first's, so a module treating the ` +
        `cursor as a global position over \`note\` pages them into this target's second ` +
        `page — and every cell that only pages one target passes.`,
    ).toEqual([]);
    expect([...page1.ids, ...page2.ids].sort(), `and the first target's list is complete`).toEqual(
      [...firstIds].sort(),
    );
  });
});
