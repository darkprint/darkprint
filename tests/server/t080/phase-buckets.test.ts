/* ============================================================
   T080 AC3 and AC4 — the phase buckets

   AC4 is the criterion most easily written backwards. "Bucket
   sizes do not sum to the card count, **and a test asserts that as
   intended**": the buckets *cover* `cards()` without partitioning
   it, so a suite asserting the sums match asserts the opposite of
   the contract, and one asserting nothing leaves a partitioning
   implementation green. The fixture below exhibits one card in
   three buckets and one in none, and the inequality is asserted
   directly — with both structural facts asserted beside it, since
   a fixture where the surplus and the shortfall happened to cancel
   would make the inequality alone say nothing.

   AC3's discriminating input is an **arbitrary string**, not a
   phase the five declare: "returns an empty list, not a 404" is
   the kind of clause an implementation satisfies for the known
   phases and fails for anything else.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type CardSummary,
  type Scratch,
  anonymous,
  asArray,
  asCardSummary,
  bind,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertRelease,
  mark,
  scratchDatabase,
} from "./contract";

/** Three buckets — not two, so the surplus cannot cancel the one card that is in none. */
const SPANS = "spans-three-phases";
const ONE = "one-phase-card";
const ALSO = "also-one-phase-card";
/** The normal state for an intake or a retrieval step, and never a gap. */
const NONE = "no-phase-card";
/** Declares `testing` twice: the validator collapses that, and so must the bucket. */
const REPEATS = "repeats-a-phase-card";
/** Declares `debugging` and the empty string. */
const BLANK = "blank-phase-card";

const ALL_CARDS = [SPANS, ONE, ALSO, NONE, REPEATS, BLANK];

/** No card declares it, and it is one of the five — the *easy* half of AC3. */
const UNDECLARED_CORE_PHASE = "deployment";

let s: Scratch;
/** The discriminating half: a string that is not a phase at all. Unique per run. */
let arbitrary: string;

beforeAll(async () => {
  s = await scratchDatabase();
  arbitrary = mark("zzz-not-a-phase");
  const owner = await insertAccount(s, mark("t080-phases"));
  const bundle = await insertBundle(s, { owner, slug: "phase-fixture" });

  const cards = [
    await insertCard(s, {
      ownerId: owner.id,
      id: SPANS,
      phases: ["planning", "testing", "debugging"],
    }),
    await insertCard(s, { ownerId: owner.id, id: ONE, phases: ["planning"] }),
    await insertCard(s, { ownerId: owner.id, id: ALSO, phases: ["implementation"] }),
    await insertCard(s, { ownerId: owner.id, id: NONE, phases: [] }),
    await insertCard(s, { ownerId: owner.id, id: REPEATS, phases: ["testing", "testing"] }),
    await insertCard(s, { ownerId: owner.id, id: BLANK, phases: ["debugging", ""] }),
  ];
  await insertRelease(s, { bundle, version: "1.0.0", cards });
});

afterAll(async () => {
  await dropScratchDatabases();
});

async function allCards(): Promise<CardSummary[]> {
  const cards = await bind("cards");
  return asArray(await cards(s.db, anonymous), "cards()").map((row, i) =>
    asCardSummary(row, `cards()[${i}]`),
  );
}

async function allPhases(): Promise<string[]> {
  const phases = await bind("phases");
  return asArray(await phases(s.db, anonymous), "phases()") as string[];
}

async function bucket(phase: string): Promise<CardSummary[]> {
  const cardsByPhase = await bind("cardsByPhase");
  return asArray(await cardsByPhase(s.db, anonymous, phase), `cardsByPhase(${phase})`).map(
    (row, i) => asCardSummary(row, `cardsByPhase(${phase})[${i}]`),
  );
}

describe("AC3 an undeclared phase is an empty bucket, not a 404", () => {
  it("answers [] for an arbitrary string that is not a phase at all", async () => {
    const answered = await bucket(arbitrary);
    expect(
      answered,
      `T080's contract: "AC3's empty bucket is a fact about the index, not a 404 … stated ` +
        `because 'returns an empty list, not a 404' is the kind of clause an implementation ` +
        `satisfies for the *known* phases and fails for an arbitrary string." ` +
        `${JSON.stringify(arbitrary)} is that arbitrary string.`,
    ).toEqual([]);
  });

  it("answers [] for one of the five that no card declares", async () => {
    expect(await bucket(UNDECLARED_CORE_PHASE)).toEqual([]);
  });

  it("answers [] for the empty string", async () => {
    expect(await bucket("")).toEqual([]);
  });

  it("matches a phase exactly, not by case and not by prefix", async () => {
    /* A bucket is a lookup on a term id, and a term id is the exact string the card
       declares. A `cardsByPhase` that folded case or matched a prefix would answer
       `planning` cards for "plan" — and every test above passes against it, because none
       of their inputs is near a declared phase. Off the list this suite was built from,
       and found by mutating for it. */
    for (const near of ["PLANNING", "Planning", "plan", "planning ", " planning", "planningx"]) {
      expect(await bucket(near), `cardsByPhase(${JSON.stringify(near)})`).toEqual([]);
    }
    expect((await bucket("planning")).length, "the exact id still answers").toBe(2);
  });

  it("answers an array rather than undefined for an unknown phase", async () => {
    const cardsByPhase = await bind("cardsByPhase");
    const answered = await cardsByPhase(s.db, anonymous, arbitrary);
    expect(
      Array.isArray(answered),
      `The published signature is \`Promise<readonly CardSummary[]>\`; \`undefined\` is a ` +
        `different type and a caller iterating it throws.`,
    ).toBe(true);
  });

  it("does not report an undeclared phase in phases()", async () => {
    const answered = await allPhases();
    expect(answered).not.toContain(arbitrary);
    expect(answered).not.toContain(UNDECLARED_CORE_PHASE);
    expect(
      answered,
      `lib/core/archive/registry.ts:254 skips a blank phase, so no gallery badge is ever ` +
        `rendered for one. \`${BLANK}\` declares \`["debugging", ""]\`.`,
    ).not.toContain("");
  });
});

describe("AC4 the buckets cover cards() without partitioning it", () => {
  it("covers without partitioning: some card is in several buckets and some card is in none", async () => {
    /* The arithmetic is asserted against the archive in `build-parity.test.ts` and not
       here. The contract: "AC4's inequality is a property of the DATA, not of the
       implementation … one card in two buckets and one in none cancel exactly", so the sum
       on a small fixture says nothing about the reader. What holds universally is the two
       exhibits, and the two structural facts they stand for: the union of the buckets is a
       *strict subset* of `cards()`, and some card is in more than one of them. Those
       together are non-partitioning, with no counting involved. */
    const cards = await allCards();
    const phases = await allPhases();
    const buckets = await Promise.all(
      phases.map(async (p) => [p, (await bucket(p)).map((c) => c.id)] as const),
    );
    const bucketed = new Set(buckets.flatMap(([, ids]) => ids));
    expect(
      [...bucketed].length,
      `the union of the buckets must be a strict subset of cards() — a partition would make ` +
        `them equal. cards() = ${cards.length}, union = ${bucketed.size}.`,
    ).toBeLessThan(cards.length);
    const multi = cards
      .map((c) => c.id)
      .filter((id) => buckets.filter(([, ids]) => ids.includes(id)).length > 1);
    expect(multi, "and some card must be in more than one bucket").not.toEqual([]);
  });

  it("exhibits one card in more than one bucket", async () => {
    const phases = await allPhases();
    const buckets = await Promise.all(
      phases.map(async (p) => [p, (await bucket(p)).map((c) => c.id)] as const),
    );
    const containing = buckets.filter(([, ids]) => ids.includes(SPANS)).map(([p]) => p);
    expect(
      containing.sort(),
      `\`${SPANS}\` declares planning, testing and debugging. "A card may declare several ` +
        `phases and appear in each" (lib/core/archive/registry.ts:82).`,
    ).toEqual(["debugging", "planning", "testing"]);
  });

  it("exhibits one card in cards() and in no bucket at all", async () => {
    const cards = await allCards();
    expect(
      cards.map((c) => c.id),
      `A card declaring no phase is still a card. "\`phases: []\` is its complete and ` +
        `correct answer — not a hole to be filled" (lib/core/card/schema.ts).`,
    ).toContain(NONE);

    const phases = await allPhases();
    const buckets = await Promise.all(
      phases.map(async (p) => [p, (await bucket(p)).map((c) => c.id)] as const),
    );
    const containing = buckets.filter(([, ids]) => ids.includes(NONE)).map(([p]) => p);
    expect(
      containing,
      `"a card may declare none and appear in no bucket. The latter is the normal state for ` +
        `an intake or a retrieval step and is never a gap" ` +
        `(lib/core/archive/registry.ts:83).`,
    ).toEqual([]);
  });

  it("covers every card that declares a phase, and no more", async () => {
    const cards = await allCards();
    const phases = await allPhases();
    const bucketed = new Set<string>();
    for (const p of phases) for (const c of await bucket(p)) bucketed.add(c.id);
    /* Covering, so nothing appears in a bucket that is not a card. */
    for (const id of bucketed) expect(cards.map((c) => c.id)).toContain(id);
    /* Not partitioning, so the union is a strict subset. */
    expect([...bucketed].sort()).toEqual(ALL_CARDS.filter((id) => id !== NONE).sort());
  });

  it("lists a card once per bucket, even when its card declares the phase twice", async () => {
    const testing = await bucket("testing");
    const ids = testing.map((c) => c.id);
    expect(
      ids.filter((id) => id === REPEATS).length,
      `\`${REPEATS}\` stores \`phases: ["testing", "testing"]\`. The engine's index keeps ` +
        `"a hand-built card that repeats a phase … from being listed twice in one bucket" ` +
        `(lib/core/archive/registry.ts:251).`,
    ).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("orders a bucket the way cards() is ordered", async () => {
    const cards = await allCards();
    const order = cards.map((c) => c.ref);
    for (const phase of await allPhases()) {
      const refs = (await bucket(phase)).map((c) => c.ref);
      const expected = order.filter((ref) => refs.includes(ref));
      expect(
        refs,
        `"Every card version declaring \`phase\`, in the same order as \`cards()\`" ` +
          `(lib/core/archive/registry.ts:77).`,
      ).toEqual(expected);
    }
  });
});
