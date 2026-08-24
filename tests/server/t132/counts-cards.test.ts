/* ============================================================
   T132 — the twelve `counts.cards` cells, arriving

   D-130-22: "TWELVE `counts.cards` cells travel to T132, not
   eleven, and the criterion is the property rather than the number
   — *every cell asserting `counts.cards`* — so a cell that
   acquires it later acquires the disposition with it. Measured:
   `counts` 5, `routes` 2, `visibility` 5."

   They did not merge with T130 because they would have redded
   `backend`: `counts.cards` was blocked by D-130-04, which is the
   ruling that created this task. They are re-carried here rather
   than copied: the archived cells asserted against a reference
   that read `card_version.owner_id` directly — "the route the
   ruling forbids" — and T130's Standing note says so. What travels
   is the DISPOSITION; the route to it is `cardsOwnedBy` now.

   ── two of the twelve are the only cells that watched the join ──
   The `routes` pair is not a third spelling of the module cells.
   It is the only place anything observes whatever turns a
   `Request` into an `Actor` on this route, and both of those cells
   asserted through `counts.cards` alone — so they left with the
   others, and between T130's merge and this one NOTHING holds that
   the profile route reads the session's actor at all. Verified in
   the merged tree while writing this file: no cell in
   `tests/server/t130/routes.test.ts` names a session-derived
   count today.

   ── what is asserted, and what is left where it merged ──
   Only the `cards` member. `counts.blueprints` and `counts.terms`
   have their cells in `tests/server/t130` and did merge; asserting
   them again here would put two owners on one criterion.

   ── why `.cards` is read through an untyped record ──
   D-130-18's idiom, kept: `Counts` is T130's published type and
   the member arrives with this task. Reading through an index
   signature is what let the archived cells stay red without the
   compiler deleting them, and it costs nothing now.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type AccountFixture,
  FixtureGate,
  account,
  anonymous,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  mark,
  operator,
  query,
  scratchDatabase,
} from "./contract";
import {
  AUTHOR_ROUTE,
  asProfileRecord,
  asWireProfileRecord,
  bind as bindProfile,
  callRoute,
  sessionCookie,
} from "../t130/contract";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");

const gate = new FixtureGate();
let s: ReturnType<FixtureGate["get"]>;
let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  await gate.build(async () => {
    s = await scratchDatabase("counts");
    /* The handler reaches for `getSharedDbClient()`, which reads `DATABASE_URL` and caches on
       `globalThis` behind a well-known symbol. Both the repoint AND the cache clear have to
       happen before the first call, or the route opens a pool against whatever host the shell
       names and the route cells measure a different database. T130's own routes file carries
       the same two lines for the same reason. */
    originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = s.url;
    delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];
    return s;
  });
}, 120000);

afterAll(async () => {
  if (originalDatabaseUrl !== undefined) process.env.DATABASE_URL = originalDatabaseUrl;
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];
  await dropScratchDatabases();
});

/** Bound LAST, after the fixture gate. `counts` is read through an index signature (D-130-18). */
async function counts(handle: string, actor: unknown = anonymous): Promise<Record<string, number>> {
  const db = gate.get().db;
  const getProfile = await bindProfile("getProfile");
  const record = asProfileRecord(
    await getProfile(db, actor, handle),
    `getProfile(db, actor, "${handle}")`,
  );
  return record.counts as unknown as Record<string, number>;
}

/** A handle nobody else in this file touches, so no cell depends on another's order. */
async function freshAccount(tag: string): Promise<AccountFixture> {
  return insertAccount(gate.get(), mark(`t132-counts-${tag}`).toLowerCase());
}

/* --------------------- the five from `counts.test.ts` --------------------- */

describe("AC1: the card count comes from the store", () => {
  it("counts a handle's own published cards", async () => {
    const s = gate.get();
    const a = await freshAccount("populated");
    const one = await insertCard(s, { id: `${a.handle}/card-one`, ownerId: a.id });
    const two = await insertCard(s, { id: `${a.handle}/card-two`, ownerId: a.id });
    await insertBundle(s, { owner: a, slug: "counts-one", cards: [one, two] });
    await insertBundle(s, { owner: a, slug: "counts-two", cards: [one] });

    expect(
      (await counts(a.handle)).cards,
      `D-132-02 C-1 reading (a): cards this handle OWNS and the actor may see. Two rows, one ` +
        `of them pinned twice — a count over the pin index would answer three.`,
    ).toBe(2);
  });

  it("answers zero for a handle with nothing published", async () => {
    const a = await freshAccount("empty");
    /* Zero is the answer a broken reader also gives, which is why this cell is worth having
       only BESIDE the one above: together they say the reader distinguishes the two states.
       Alone, either would be satisfied by a constant. */
    expect((await counts(a.handle)).cards).toBe(0);
  });

  it("does not count another handle's cards", async () => {
    const s = gate.get();
    const mine = await freshAccount("mine");
    const theirs = await freshAccount("theirs");
    const card = await insertCard(s, { id: `${theirs.handle}/their-card`, ownerId: theirs.id });
    await insertBundle(s, { owner: theirs, slug: "their-bundle", cards: [card] });

    expect((await counts(mine.handle)).cards).toBe(0);
    expect((await counts(theirs.handle)).cards).toBe(1);
  });

  /**
   * The discriminating pair. Rows arrive and leave through plain SQL, so `lib/server/profiles`
   * is never entered between the two reads — a stored counter and a process-level memo are
   * both frozen across that gap and a read-time count is not. AC1's own argument ("drifts
   * silently the first time a bundle is deleted") turned into a measurement.
   */
  it("rises when a card arrives behind the module's back", async () => {
    const s = gate.get();
    const a = await freshAccount("arrivals");
    expect((await counts(a.handle)).cards).toBe(0);
    await insertCard(s, { id: `${a.handle}/late-card`, ownerId: a.id });
    expect(
      (await counts(a.handle)).cards,
      `AC1: "anything countable is counted, never stored as a counter". Nothing called ` +
        `\`lib/server/profiles\` between these two reads.`,
    ).toBe(1);
  });

  /**
   * The archived cell whose FIXTURE decided D-132-02 C-1, re-carried with its fixture intact.
   *
   * `doomed` is pinned by NOTHING. "Cards this handle owns" and "cards the index carries for
   * this handle" differ by exactly that row, and the ruling quotes this cell as the decisive
   * one: the count "falls when an UNPINNED card row is deleted". A fixture where the two
   * readings agreed would hide the question the ruling is about.
   */
  it("falls when an unpinned card row is deleted behind the module's back", async () => {
    const s = gate.get();
    const a = await freshAccount("card-deletion");
    const keeper = await insertCard(s, { id: `${a.handle}/keeper`, ownerId: a.id });
    const doomed = await insertCard(s, { id: `${a.handle}/doomed`, ownerId: a.id });
    await insertBundle(s, { owner: a, slug: "card-deletion", cards: [keeper] });
    expect(
      (await counts(a.handle)).cards,
      `\`${doomed.ref}\` is pinned by no release. Reading (a) counts it; a count built on ` +
        `\`cards()\` — the pin-narrowed index — answers one here and is "quietly short", which ` +
        `is the phrase D-132-02 chose the reading with.`,
    ).toBe(2);

    await query(s, "delete from card_version where id = $1", [doomed.rowId]);

    expect((await counts(a.handle)).cards).toBe(1);
  });
});

/* --------------------- the five from `visibility.test.ts` --------------------- */

interface Split {
  owner: AccountFixture;
  visitor: AccountFixture;
  admin: AccountFixture;
  publicCards: number;
  privateCards: number;
}

/**
 * One handle with a public half and a private half, and the numbers written down here rather
 * than read back off the module. Every expectation below is arithmetic over these, so a cell
 * cannot agree with an implementation by asking it what the answer is.
 */
async function seedSplit(tag: string): Promise<Split> {
  const s = gate.get();
  const owner = await freshAccount(`vis-${tag}`);
  const visitor = await freshAccount(`vis-${tag}-v`);
  const admin = await freshAccount(`vis-${tag}-op`);

  const openCard = await insertCard(s, { id: `${owner.handle}/open-card`, ownerId: owner.id });
  await insertCard(s, {
    id: `${owner.handle}/sealed-card`,
    ownerId: owner.id,
    visibility: "private",
  });
  await insertBundle(s, { owner, slug: "open-bundle", cards: [openCard] });

  return { owner, visitor, admin, publicCards: 1, privateCards: 1 };
}

describe("AC2: owner and visitor differ by exactly the private cards", () => {
  it("the card count differs by exactly the private cards", async () => {
    const f = await seedSplit("cards");
    const asVisitor = await counts(f.owner.handle, account(f.visitor.id, f.visitor.handle));
    const asOwner = await counts(f.owner.handle, account(f.owner.id, f.owner.handle));

    expect(asVisitor.cards).toBe(f.publicCards);
    expect(asOwner.cards).toBe(f.publicCards + f.privateCards);
    expect(
      asOwner.cards - asVisitor.cards,
      `AC2: the two records "differ by exactly the private rows". The DIFFERENCE is asserted ` +
        `as well as the two values, because two correct-looking numbers whose difference is ` +
        `wrong is the state a per-value check cannot report.`,
    ).toBe(f.privateCards);
  });

  it("an anonymous caller and a signed-in stranger read the same count", async () => {
    /* T060's three read contexts collapse to two answers: the owner's and everybody else's. A
       module that widened for "signed in" rather than for "the owner" passes every cell above
       and fails this one. */
    const f = await seedSplit("stranger");
    const anon = await counts(f.owner.handle, anonymous);
    const signedIn = await counts(f.owner.handle, account(f.visitor.id, f.visitor.handle));
    expect(anon.cards).toBe(signedIn.cards);
    expect(anon.cards).toBe(f.publicCards);
  });

  it("the operator reads the owner's count, not the visitor's", async () => {
    /* DERIVED, and flagged as derived — the archived cell carried the same flag. T130 says
       nothing about the operator; T060's ruling and T080's AC6 widened half decide it at the
       surface T130 consumes, and D-132-04 C-C has since ratified it for these readers. */
    const f = await seedSplit("operator");
    const asOperator = await counts(f.owner.handle, operator(f.admin.id));
    expect(asOperator.cards).toBe(f.publicCards + f.privateCards);
  });
});

describe("AC2: neither reading order contaminates the other", () => {
  /**
   * A cache keyed on handle alone is ORDER-DEPENDENT: whichever actor reads first fills it.
   * A suite that only ever reads owner-then-visitor catches the leak; one that only ever reads
   * visitor-then-owner catches the mirror, where the owner is served the visitor's short count
   * and their own private work vanishes from their own page. Neither order alone is the
   * criterion, and the two failures are different defects. Both drive the SAME handle in the
   * SAME database, because a fresh fixture per order is a fresh cache and would observe nothing.
   */
  it("owner first, then visitor: the visitor is not served the owner's count", async () => {
    const f = await seedSplit("order-a");
    const asOwner = await counts(f.owner.handle, account(f.owner.id, f.owner.handle));
    const asVisitor = await counts(f.owner.handle, account(f.visitor.id, f.visitor.handle));
    expect(asOwner.cards).toBe(f.publicCards + f.privateCards);
    expect(
      asVisitor.cards,
      `A cache keyed on handle alone, filled by the owner's read, serves the private count to ` +
        `a visitor — "the private-row leak B-13 exists to prevent, arriving through a cache ` +
        `rather than through a query".`,
    ).toBe(f.publicCards);
  });

  it("visitor first, then owner: the owner is not served the visitor's count", async () => {
    const f = await seedSplit("order-b");
    const asVisitor = await counts(f.owner.handle, account(f.visitor.id, f.visitor.handle));
    const asOwner = await counts(f.owner.handle, account(f.owner.id, f.owner.handle));
    expect(asVisitor.cards).toBe(f.publicCards);
    expect(
      asOwner.cards,
      `The mirror, and it is not the same defect: here the owner's own private cards vanish ` +
        `from their own page, which looks like a data loss rather than like a leak.`,
    ).toBe(f.publicCards + f.privateCards);
  });
});

/* --------------------- the two from `routes.test.ts` --------------------- */

/**
 * THE ONLY CELLS IN THE TREE THAT OBSERVE THE SESSION-TO-ACTOR JOIN ON THIS ROUTE.
 *
 * Everything else in this file could be the reader's behaviour arriving through another door.
 * These two go in over HTTP with a real session cookie, and a regression in whatever turns a
 * `Request` into an `Actor` makes every caller anonymous with nothing else red anywhere.
 *
 * Both asserted through `counts.cards` alone, which is why both travelled here — and why
 * `tests/server/t130/routes.test.ts` has held nothing about the join since T130 merged.
 */
describe("AC2 at the transport: the actor is the SESSION's", () => {
  it("an owner's session and an anonymous request get different counts", async () => {
    const f = await seedSplit("route");
    const path = `/api/authors/${f.owner.handle}`;

    const anonymousAnswer = await callRoute(path);
    expect(anonymousAnswer.status, `${AUTHOR_ROUTE} for an anonymous caller`).toBe(200);
    const anonymousBody = asWireProfileRecord(
      await anonymousAnswer.json(),
      `${AUTHOR_ROUTE} 200 body (anonymous)`,
    );

    const ownerAnswer = await callRoute(path, sessionCookie(f.owner.id, f.owner.handle));
    expect(ownerAnswer.status, `${AUTHOR_ROUTE} for the owner's session`).toBe(200);
    const ownerBody = asWireProfileRecord(
      await ownerAnswer.json(),
      `${AUTHOR_ROUTE} 200 body (owner)`,
    );

    const anonymousCounts = anonymousBody.counts as Record<string, number>;
    const ownerCounts = ownerBody.counts as Record<string, number>;
    expect(anonymousCounts.cards).toBe(f.publicCards);
    expect(ownerCounts.cards).toBe(f.publicCards + f.privateCards);
    expect(
      ownerCounts.cards - anonymousCounts.cards,
      "AC2 at the transport: the two records differ by exactly the private rows.",
    ).toBe(f.privateCards);
  });

  it("a stranger's session reads the visitor's count, not the owner's", async () => {
    /* The half `actorFrom` could get wrong in the other direction: the actor is the session's
       IDENTITY, not "somebody is signed in". A route that widened for any valid cookie passes
       the cell above and fails this one. */
    const f = await seedSplit("route-stranger");
    const answer = await callRoute(
      `/api/authors/${f.owner.handle}`,
      sessionCookie(f.visitor.id, f.visitor.handle),
    );
    expect(answer.status).toBe(200);
    const body = asWireProfileRecord(await answer.json(), `${AUTHOR_ROUTE} 200 body (stranger)`);
    expect((body.counts as Record<string, number>).cards).toBe(f.publicCards);
  });
});
