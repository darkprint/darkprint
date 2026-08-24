/* ============================================================
   T131 — `support` is an endorsement of the PERSON, one row per
   supporter, counted and never stored (D-131-05)

   The section inherited `support` as the field with "no column AND
   no derivation", and reported it that way at dispatch. D-131-05
   settled it as ARM (a): a first-class per-account endorsement,
   `account_support(supporter_id, supported_id)`, `toggleSupport`
   as the published verb, and the count DERIVED — AC1's inherited
   clause reaching a fourth figure.

   ── the defect this file exists to catch is a CONFLATION, not an
      absence ──
   D-131-05 names it in terms: **"a fold over the handle's items'
   stars is a DIFFERENT figure and conflating them is a defect."**
   Two figures sit next to each other on the same rendered line and
   they are not the same number:

     * `stars` = `blueprints.reduce(votes) + cards.reduce(support)`,
       computed in `ProfileShell.tsx:76-78` over the handle's ITEMS;
     * `support` = this figure, about the PERSON, passed straight
       through at `ProfileShell.tsx:96` and rendered in its own pill
       with the aria-label "N community stars" at
       `ProfileHeader.tsx:181`.

   An implementation that summed `target.star_count` over the
   handle's blueprints and cards would satisfy every cell about
   toggling below, because a fresh fixture has no stars and both
   figures are 0. So the discriminating cell PLANTS STARS and
   asserts `support` does not move. Without it this file is a
   thorough test of the wrong number.

   ── and the trap the ruling quotes back ──
   The other way to satisfy every cell here is a `support integer`
   column on `account`, incremented by `toggleSupport`. It passes
   every sentence in the section and violates AC1, which is why the
   DISCRIMINATOR cells plant rows behind the module exactly as
   `follow.test.ts` does.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PUBLISHED,
  account,
  anonymous,
  asProfileRecord,
  asSupportAnswer,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertSupport,
  mark,
  operator,
  race,
  scratchDatabase,
  sqlstateOf,
  supportRowCount,
  warmPool,
  type AccountFixture,
  type Scratch,
  type SupportAnswer,
} from "./contract";

let s: Scratch;

async function person(tag: string): Promise<AccountFixture> {
  return insertAccount(s, { handle: mark(`t131-support-${tag}`).toLowerCase() });
}

async function toggle(actor: unknown, handle: string): Promise<SupportAnswer> {
  const toggleSupport = await bind("toggleSupport");
  return asSupportAnswer(
    await toggleSupport(s.db, actor, handle),
    `toggleSupport(db, actor, "${handle}")`,
  );
}

async function supportOf(handle: string): Promise<number> {
  const getProfile = await bind("getProfile");
  return asProfileRecord(
    await getProfile(s.db, anonymous, handle),
    `getProfile(db, anonymous, "${handle}")`,
  ).support;
}

/** A star on one archive target, planted through T150's merged tables and nothing else. */
async function plantStars(
  kind: "blueprint" | "card",
  refId: string,
  count: number,
): Promise<void> {
  await s.query(
    "insert into target (kind, ref_id, star_count) values ($1, $2, $3) " +
      "on conflict (kind, ref_id) do update set star_count = excluded.star_count",
    [kind, refId, String(count)],
  );
}

beforeAll(async () => {
  s = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

describe("D-131-05: `toggleSupport` is the published verb and it toggles", () => {
  it("goes on and then off, and the count follows it in both directions", async () => {
    const subject = await person("subject");
    const supporter = await person("supporter");
    const actor = account(supporter.id, supporter.handle);

    expect(await supportOf(subject.handle)).toBe(0);
    expect(await toggle(actor, subject.handle)).toEqual({ support: 1, supportedByCaller: true });
    expect(
      await toggle(actor, subject.handle),
      `a second call from one account is the withdrawal, not a second endorsement. ` +
        `${PUBLISHED.toggleSupport}`,
    ).toEqual({ support: 0, supportedByCaller: false });
  });

  it("counts distinct supporters and tracks each separately", async () => {
    const subject = await person("distinct-subject");
    const a = await person("distinct-a");
    const b = await person("distinct-b");
    const actorA = account(a.id, a.handle);
    const actorB = account(b.id, b.handle);

    expect(await toggle(actorA, subject.handle)).toEqual({ support: 1, supportedByCaller: true });
    expect(await toggle(actorB, subject.handle)).toEqual({ support: 2, supportedByCaller: true });
    expect(await toggle(actorB, subject.handle)).toEqual({ support: 1, supportedByCaller: false });
    expect(
      await toggle(actorA, subject.handle),
      "A never withdrew, so A's next call is the withdrawal and nobody is left supporting",
    ).toEqual({ support: 0, supportedByCaller: false });
  });

  it("does not accumulate under repeated toggling", async () => {
    const subject = await person("repeat-subject");
    const supporter = await person("repeat-supporter");
    const actor = account(supporter.id, supporter.handle);

    for (let i = 0; i < 3; i += 1) {
      expect(await toggle(actor, subject.handle)).toEqual({ support: 1, supportedByCaller: true });
      expect(await toggle(actor, subject.handle)).toEqual({ support: 0, supportedByCaller: false });
    }
    expect(await supportOf(subject.handle)).toBe(0);
    expect(await supportRowCount(s, subject.id)).toBe(0);
  });

  it("does not move another handle's support", async () => {
    const subject = await person("iso-subject");
    const bystander = await person("iso-bystander");
    const supporter = await person("iso-supporter");

    await toggle(account(supporter.id, supporter.handle), subject.handle);
    expect(await supportOf(subject.handle)).toBe(1);
    expect(await supportOf(bystander.handle)).toBe(0);
  });

  it("a caller with no identity does not become a supporter", async () => {
    /* DERIVED and labelled, exactly as the follow half is: nothing published rules HOW the
       module refuses an anonymous toggle, only that there is no account for the row to belong
       to. Read at the ROWS, because a module that inserted and then threw satisfies any
       `rejects.toThrow()`. */
    const subject = await person("anon-subject");
    const supporter = await person("anon-supporter");

    let outcome: string;
    try {
      const toggleSupport = await bind("toggleSupport");
      outcome = `resolved with ${JSON.stringify(await toggleSupport(s.db, anonymous, subject.handle))}`;
    } catch {
      outcome = "rejected";
    }
    expect(
      await supportRowCount(s, subject.id),
      `an anonymous \`toggleSupport\` ${outcome}; there is no supporter for the row to name.`,
    ).toBe(0);

    /* The control. */
    await toggle(account(supporter.id, supporter.handle), subject.handle);
    expect(await supportOf(subject.handle)).toBe(1);
  });
});

describe("DISCRIMINATOR: `support` is the PERSON's figure, not a fold over their items", () => {
  it("does not move when the handle's blueprint and card collect stars", async () => {
    /* THE CELL THIS FILE EXISTS FOR. D-131-05: "a fold over the handle's items' stars is a
       DIFFERENT figure and conflating them is a defect."

       Every other cell here is green against an implementation that sums `target.star_count`
       over the handle's own blueprints and cards, because a fresh fixture has no stars and both
       readings answer 0. This one plants 214 stars — the fixture's own figure for `mara-veil`,
       which is what a reader would recognise on the page — across a bundle and a card the handle
       owns, and asserts the number does NOT move. */
    const subject = await person("fold-subject");
    const supporter = await person("fold-supporter");
    const card = await insertCard(s, {
      id: `${subject.handle}/starred-card`,
      ownerId: subject.id,
      authorHandle: subject.handle,
    });
    const bundle = await insertBundle(s, {
      owner: subject,
      slug: "starred-bundle",
      cards: [card],
    });

    await toggle(account(supporter.id, supporter.handle), subject.handle);
    expect(
      await supportOf(subject.handle),
      "the premise: one real endorsement, so the assertion below is about the stars and not " +
        "about an empty world",
    ).toBe(1);

    await plantStars("blueprint", bundle.id, 200);
    await plantStars("card", card.cardId, 14);

    expect(
      await supportOf(subject.handle),
      "214 stars now sit on this handle's own work, which is the fixture's own `support` figure " +
        "for `mara-veil` and exactly the number a fold would answer. `support` is the PERSON's " +
        "endorsement count (D-131-05) and the item fold is `stars`, computed separately at " +
        "`ProfileShell.tsx:76-78` and rendered in its own place. Conflating them is the defect " +
        "the ruling names.",
    ).toBe(1);
  });
});

describe("`support` is DERIVED, not a stored counter (one DISCRIMINATOR, one structural)", () => {
  it("moves when a support row is planted without the module being entered", async () => {
    const subject = await person("derive-subject");
    const planter = await person("derive-planter");
    expect(await supportOf(subject.handle)).toBe(0);

    await insertSupport(s, { supporterId: planter.id, supportedId: subject.id });

    expect(
      await supportOf(subject.handle),
      "AC1's inherited clause reaching `support`: anything countable is COUNTED, never stored. " +
        "A `support integer` column reads 0 here — the row exists and nothing incremented " +
        "anything — and D-131-05 quotes that column as the thing the ruling exists to prevent.",
    ).toBe(1);
  });

  it("REFUSES to delete a supporter's account, the same structural fact as the follow half", async () => {
    /* RETARGETED under D-131-11, exactly as `follow.test.ts`'s twin, and no longer a
       discriminator: the planted-row cell above carries the derived-versus-stored criterion for
       `support` on its own.

       Both tables get the cell rather than one standing for both. `account_support` is a
       separate key from `follow`'s and D-131-11 moves FIVE of them at once — a migration that
       corrected four and missed one would leave exactly this cell red and every other cell in
       the suite green. */
    const subject = await person("refuses-subject");
    const a = await person("refuses-a");
    const b = await person("refuses-b");

    await toggle(account(a.id, a.handle), subject.handle);
    await toggle(account(b.id, b.handle), subject.handle);
    expect(await supportOf(subject.handle)).toBe(2);

    const code = await sqlstateOf(() => s.query("delete from account where id = $1", [a.id]));
    expect(
      code,
      `deleting an account referenced by an \`account_support\` row must be REFUSED at the ` +
        `driver (D-131-11: all five keys into \`account\` are \`NO ACTION\`, and D-120-01 ` +
        `rules T120's tombstone BECAUSE the structure refuses this delete).`,
    ).toBe("23503");

    expect(await supportRowCount(s, subject.id)).toBe(2);
    expect(await supportOf(subject.handle)).toBe(2);
  });
});

describe("D-131-09(2): two concurrent callers on `toggleSupport`", () => {
  /* The interleaving proof lives in `follow.test.ts` and is not repeated: it is a property of the
     scratch pool, not of either verb, and a second copy would be the same measurement wearing a
     different name. What is NOT shared is the module under test, so both verbs get their own race
     cells — `account_support`'s unique pair is a different index from `follow`'s and a module can
     get one right and the other wrong. */

  it("two different supporters arriving at once both land, and the count is exactly two", async () => {
    const subject = await person("race-subject");
    const a = await person("race-a");
    const b = await person("race-b");
    await warmPool(s);

    const toggleSupport = await bind("toggleSupport");
    const outcome = await race(
      () => toggleSupport(s.db, account(a.id, a.handle), subject.handle),
      () => toggleSupport(s.db, account(b.id, b.handle), subject.handle),
    );

    expect({ resolved: outcome.resolved, codes: outcome.codes }).toEqual({
      resolved: 2,
      codes: [],
    });
    expect(await supportRowCount(s, subject.id)).toBe(2);
    expect(
      await supportOf(subject.handle),
      "a read-modify-write on a counter column loses one of these two and answers 1",
    ).toBe(2);
  });

  it("the same supporter arriving twice at once never leaves two rows, and leaks no SQLSTATE", async () => {
    /* Same narrowing as the follow half, and for the same reason: two concurrent toggles from one
       account are non-deterministic in their on/off outcome, so zero rows and one row are both
       correct interleavings and neither is asserted. The deterministic claims are that
       `account_support_supporter_supported_key` is never violated into a second row, and that no
       caller receives a `23505` in ANY form — raw, or sealed with the driver error on `cause`,
       which `race()` walks deliberately. T150's clause is that the conflict is CAUGHT, and a
       sealed rethrow relabels a caller's duplicate as a failing store rather than catching it.
       This is precisely what a select-then-insert produces here and what every sequential cell in
       this file is blind to. */
    const subject = await person("dup-subject");
    const supporter = await person("dup-supporter");
    const actor = account(supporter.id, supporter.handle);
    await warmPool(s);

    const toggleSupport = await bind("toggleSupport");
    const outcome = await race(
      () => toggleSupport(s.db, actor, subject.handle),
      () => toggleSupport(s.db, actor, subject.handle),
    );

    const rows = await supportRowCount(s, subject.id);
    expect(
      rows,
      `two concurrent toggles from one account left ${rows} rows; zero and one are both correct, ` +
        `two is the unique pair failing`,
    ).toBeLessThanOrEqual(1);
    expect(
      outcome.codes.filter((c) => c === "23505"),
      "a unique violation reached a caller rather than being caught as the conflict it is — " +
        "raw or sealed on `cause`, both of which `race()` sees, and neither of which is the " +
        "\"single insert whose conflict is caught\" T150 ruled",
    ).toEqual([]);
    expect(await supportOf(subject.handle)).toBe(rows);
  });
});

describe("D-131-07: cells drive all three actor kinds on the writes", () => {
  it("a genuine operator may support, and the row names the operator's own account", async () => {
    /* Z3's other half, closed at D-131-09. */
    const subject = await person("op-subject");
    const op = await person("op-actor");

    expect(await toggle(operator(op.id), subject.handle)).toEqual({
      support: 1,
      supportedByCaller: true,
    });

    const rows = await s.query(
      "select supporter_id from account_support where supported_id = $1",
      [subject.id],
    );
    expect(
      rows.map((r) => String(r.supporter_id)),
      "the endorsement is attributed to the operator's own account, not to the subject's",
    ).toEqual([op.id]);
  });
});
