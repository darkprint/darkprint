/* ============================================================
   T170 AC2 — "the list returns at most 10 with a cursor stable
   across a concurrent insert"

   ── THE ORDER IS ASCENDING (D-WAVE-06), AND ONE CELL IS
      DELIBERATELY ABSENT ──
   Oldest-first. Charged from here when the order turned out to be
   unpublished, and ruled after both halves derived it
   independently from different evidence: this side from
   `Comments.tsx` rendering `comments.slice(0, VISIBLE_NOTES)` —
   the FIRST ten — over seeded arrays in ascending date order, and
   the implementer from `(created_at, id)` matching
   `note_target_created_idx`'s own column order.

   **The keyset-versus-offset falsification cell is NOT in this
   file, and its absence is the finding rather than a gap.**
   D-WAVE-01 argued AC2 from "an offset cursor shifts every row
   when a note is inserted ABOVE it". That is true only
   newest-first. Ascending, a new note always sorts to the END so
   nothing is ever inserted above, and B-18's tombstone means no
   row ever leaves so nothing shifts up either — **the two
   properties that would break an offset cursor are both closed by
   rulings this task already has.** A `page 1, concurrent insert,
   page 2` cell therefore reds ZERO against an offset
   implementation. D-WAVE-06 withdraws the justification and says
   so in as many words.

   Writing it anyway would put a cell that cannot fail into a
   suite, under a name that reads as coverage. What IS here
   instead: the ORDER itself, pinned, which a descending
   implementation reds immediately; the criterion as literally
   stated, with its non-discriminating clause LABELLED rather than
   deleted (D-240-11's shape); and the precision gap, which is
   AC2's real content and is order-independent.

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
  postOne,
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

describe("T170 AC2 — the order is ASCENDING, oldest-first (D-WAVE-06)", () => {
  it("a page reads oldest-first", async () => {
    const { actor, target, ids } = await stage("ac2-order", 5);
    const listNotes = await bind("listNotes");
    const page = asPage(await listNotes(s.db, actor, target), "listNotes");

    expect(
      page.ids,
      `D-WAVE-06: the page order is ASCENDING, oldest-first. \`seedNotes\` posts one at a ` +
        `time and awaits each, so the seeding order IS the creation order and a descending ` +
        `implementation reds here immediately.\n` +
        `  This is the pin the offset-falsification cell could not be: it discriminates, and ` +
        `that one does not.`,
    ).toEqual(ids);
  });

  it("the order holds across a page boundary", async () => {
    const { actor, target, ids } = await stage("ac2-order-pages", PAGE_SIZE * 2 + 3);
    const listNotes = await bind("listNotes");
    const { pages } = await walkPages(listNotes, s.db, actor, target, "listNotes");

    expect(
      pages.flat(),
      `A module can sort correctly WITHIN a page and still walk the pages in the wrong ` +
        `direction — the cursor's comparison is a second place the order lives, and the ` +
        `single-page cell above cannot see it.`,
    ).toEqual(ids);
  });

  /**
   * AC2 as literally stated, with its uncharged clause labelled rather than deleted.
   *
   * The criterion is "a cursor stable across a concurrent insert", and this drives exactly
   * that. What it does NOT do is separate a keyset cursor from an offset one: ascending,
   * the new note appends past the end, so both are stable and both pass. D-WAVE-06 is the
   * ruling and it withdrew the argument that said otherwise.
   *
   * Kept because it still reds real things — a cursor that re-reads the whole list, one
   * that loses the tail when the underlying count changes, an insert that renumbers — and
   * labelled because a cell whose name promises more than it measures is how a suite
   * reports coverage it does not have.
   */
  it("a note inserted mid-walk appends past the end and disturbs nothing", async () => {
    const { actor, target, ids } = await stage("ac2-stable", PAGE_SIZE + 4);
    const listNotes = await bind("listNotes");
    const page1 = asPage(await listNotes(s.db, actor, target), "listNotes page 1");
    premise(page1.cursor !== null, `the walk needs a second page for the insert to sit across`);

    const { id: inserted } = await postOne(s.db, actor, target, "arrived mid-walk");

    const page2 = asPage(
      await listNotes(s.db, actor, target, page1.cursor),
      "listNotes page 2 after a concurrent insert",
    );
    const seen = [...page1.ids, ...page2.ids];

    expect(
      seen.filter((id) => ids.includes(id)),
      `AC2: "a cursor stable across a concurrent insert". Every note that existed when the ` +
        `walk started must appear exactly once, in order.\n` +
        `  UNCHARGED CLAUSE, stated so this cell is not read as more than it is: ascending, ` +
        `this does NOT discriminate a keyset cursor from an offset one — the new note ` +
        `appends past the end and both are stable. D-WAVE-06 withdrew the justification ` +
        `that claimed it would.`,
    ).toEqual(ids);
    expect(new Set(seen).size, `and nothing is returned twice`).toBe(seen.length);
    expect(
      seen[seen.length - 1],
      `the note that arrived mid-walk sorts LAST, because the order is ascending — a ` +
        `descending implementation puts it first and the reader never sees it at all.`,
    ).toBe(inserted);
  });
});
