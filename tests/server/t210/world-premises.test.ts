/* ============================================================
   T210 — the premises every other file rests on

   These cells do NOT test `@/lib/server/terms`. They test the
   fixtures, through T080's `cards(db, actor)`, and they are here
   because a fixture that cannot reach the condition its criterion
   names produces a green cell that measured nothing — and nothing
   inside that cell can tell you so.

   Two failures this repository has already paid for are what this
   file is aimed at:

     * a cell whose fixture never approached the boundary it named,
       so the criterion was never exercised and the green was about
       an easier question;
     * a fixture MORE COMPLETE than any writer in the system, green
       about a state that cannot occur.

   The second is why every world goes in through `publish`. This
   file is the check on the first: it asserts, in the store, that
   the card is really pinned by two blueprints, that the private
   bundle really is invisible to a stranger and really IS visible
   to its owner, that the term really is named twice on one card,
   and that the ids AC4 asks about really are named by nothing.

   `cards()` is T080's reader and neither half of T210 wrote it. It
   is used here as an instrument on the STORE, never as an oracle
   for the index: nothing below computes a usage count.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { cards } from "@/lib/server/registry";
import { splitTermId } from "@/lib/core";

import { anonymous, dropScratchDatabases } from "./fixtures";
import {
  AC1,
  AC2,
  AC3,
  AC4,
  AC5_CORE_TERM,
  AC5_TERMS,
  AC6,
  COLLIDE,
  ac1World,
  ac2World,
  ac3World,
  ac4World,
  ac5World,
  ac6World,
  collideWorld,
} from "./fixtures";

interface Summary {
  id: string;
  usedIn: readonly { ownerHandle: string; slug: string }[];
  card: {
    type: string;
    phases: string[];
    tools: string[];
    riskMarkers: string[];
    inputs: { type: string }[];
    outputs: { type: string }[];
    author?: string;
  };
}

/** Every card version an actor may read, as the store holds it. */
async function visible(db: unknown, actor: unknown): Promise<Summary[]> {
  return (await cards(db as never, actor as never)) as unknown as Summary[];
}

/**
 * The six reference sites of one card, flattened.
 *
 * Written out here rather than imported from the component, because this file's job is to
 * describe what the FIXTURE planted. The component's reading is examined in `oracle.test.ts`,
 * where the conversions it needs are stated; borrowing it here would quietly make every
 * premise depend on the thing that is supposed to be an independent vantage.
 */
function sitesOf(card: Summary["card"]): string[] {
  return [
    ...card.phases,
    card.type,
    ...card.riskMarkers,
    ...card.tools,
    ...card.inputs.map((p) => p.type),
    ...card.outputs.map((p) => p.type),
  ];
}

function keyOf(b: { ownerHandle: string; slug: string }): string {
  return `${b.ownerHandle}/${b.slug}`;
}

afterAll(async () => {
  await dropScratchDatabases();
});

describe("AC1's world really pins one card in two blueprints", () => {
  it("the card is present exactly once and two DISTINCT blueprints pin it", async () => {
    const { scratch } = await ac1World();
    const rows = await visible(scratch.db, anonymous);
    const mine = rows.filter((r) => r.id === AC1.card.id);
    expect(mine).toHaveLength(AC1.expectedCards);
    const keys = [...new Set(mine[0].usedIn.map(keyOf))].sort();
    expect(keys).toEqual(AC1.slugs.map((slug) => `ada/${slug}`).sort());
    expect(keys).toHaveLength(AC1.expectedBlueprints);
  });

  it("the term under test is named by that card and by no other card in the world", async () => {
    const { scratch } = await ac1World();
    const rows = await visible(scratch.db, anonymous);
    const naming = rows.filter((r) => sitesOf(r.card).includes(AC1.term)).map((r) => r.id);
    /* If a second card in this world also named `validation`, AC1's "one card" would be a
       claim about the fixture rather than about the criterion, and the cell would red against
       a correct module. */
    expect(naming).toEqual([AC1.card.id]);
  });
});

describe("the two-part-key world really collides on the slug", () => {
  it("five distinct two-part keys stand over four distinct slugs", async () => {
    const { scratch } = await collideWorld();
    const rows = await visible(scratch.db, anonymous);
    const naming = rows.filter((r) => sitesOf(r.card).includes(COLLIDE.term));
    expect(naming).toHaveLength(COLLIDE.expectedCards);

    const keys = [...new Set(naming.flatMap((r) => r.usedIn.map(keyOf)))].sort();
    const slugs = [...new Set(naming.flatMap((r) => r.usedIn.map((b) => b.slug)))].sort();

    /* Both numbers, because the fixture is only useful if they DIFFER. Asserting the five alone
       would be satisfied by five blueprints that never shared a slug, and the AC1 cell resting
       on this premise would then measure nothing about the key at all. */
    expect(keys).toHaveLength(COLLIDE.expectedBlueprints);
    expect(slugs).toHaveLength(COLLIDE.distinctSlugs);
    expect(keys.length).toBeGreaterThan(slugs.length);

    /* And the collision is where it was planted, rather than anywhere convenient. */
    expect(keys).toContain("alice/collide");
    expect(keys).toContain("bob/collide");
  });
});

describe("AC2's world really names a term twice on one card, in both legal shapes", () => {
  it("the port card names the data-type term at BOTH port sites", async () => {
    const { scratch } = await ac2World();
    const rows = await visible(scratch.db, anonymous);
    const card = rows.find((r) => r.id === AC2.portCard.id);
    expect(card).toBeDefined();
    const sites = sitesOf(card!.card);
    /* Two occurrences, not merely one: the criterion is about a REPEAT, and a card naming the
       term once would make "counts it once" true for free. */
    expect(sites.filter((s) => s === AC2.portTerm)).toHaveLength(2);
    expect(card!.card.inputs.map((p) => p.type)).toEqual([AC2.portTerm]);
    expect(card!.card.outputs.map((p) => p.type)).toEqual([AC2.portTerm]);
  });

  it("the tool card names the tool term twice INSIDE one list", async () => {
    const { scratch } = await ac2World();
    const rows = await visible(scratch.db, anonymous);
    const card = rows.find((r) => r.id === AC2.toolCard.id);
    expect(card).toBeDefined();
    /* Asserted on `tools` itself and not only on the flattened sites: if the parser silently
       deduplicated the list on the way in, the repeat this criterion is about would never have
       reached the store and the AC2 cell would be measuring a single occurrence. */
    expect(card!.card.tools).toEqual([AC2.toolTerm, AC2.toolTerm]);
  });

  it("each AC2 term is named by exactly one card, so a double count shows up as a 2", async () => {
    const { scratch } = await ac2World();
    const rows = await visible(scratch.db, anonymous);
    for (const term of [AC2.portTerm, AC2.toolTerm]) {
      const naming = rows.filter((r) => sitesOf(r.card).includes(term)).map((r) => r.id);
      expect(naming).toHaveLength(AC2.expected.cards);
    }
  });
});

describe("AC3's world really hides a private bundle from a stranger and shows it to its owner", () => {
  it("an anonymous caller sees the two public pins and not the private one", async () => {
    const { scratch } = await ac3World();
    const rows = await visible(scratch.db, anonymous);
    const card = rows.find((r) => r.id === AC3.card.id);
    expect(card).toBeDefined();
    expect([...new Set(card!.usedIn.map(keyOf))].sort()).toEqual(
      AC3.publicSlugs.map((slug) => `ada/${slug}`).sort(),
    );
  });

  it("THE OWNER OF THE PRIVATE BUNDLE SEES THREE, which is the defect AC3 exists to stop", async () => {
    const { scratch, mallory } = await ac3World();
    const rows = await visible(scratch.db, {
      kind: "account",
      accountId: mallory.accountId,
      handle: mallory.handle,
    });
    const card = rows.find((r) => r.id === AC3.card.id);
    expect(card).toBeDefined();
    const keys = [...new Set(card!.usedIn.map(keyOf))].sort();

    /* This is the premise that makes AC3's cell worth running. `visibleTo` answers "all" for
       the resource owner, so a usage index that folds over `cards(db, actor)` really does hand
       this account a third blueprint — the shared vocabulary steered with content nobody else
       can see, which is exactly D-82's concern and exactly what D-210-03 rules out.
       If this premise ever stops holding, AC3's cell is asserting the absence of something
       that could no longer have happened, and its green would be worth nothing. */
    expect(keys).toContain(`${mallory.handle}/${AC3.privateSlug}`);
    expect(keys).toHaveLength(AC3.expectedBlueprints + 1);
  });
});

describe("AC3's private-only content really is private and really is there", () => {
  it("the private-only card is INVISIBLE to a stranger", async () => {
    const { scratch } = await ac3World();
    const rows = await visible(scratch.db, anonymous);
    const all = new Set(rows.flatMap((r) => sitesOf(r.card)));
    /* The premise for the absolute AC3 cells. If a stranger could already see this term, a
       count of zero would be the ordinary visibility filter doing its job and the cell would
       say nothing about the index. */
    expect(rows.some((r) => r.id === AC3.privateOnlyCard.id)).toBe(false);
    expect(all.has(AC3.privateOnlyTerm)).toBe(false);
    expect(all.has(AC3.privateOnlyLocal)).toBe(false);
  });

  it("and it really EXISTS — its owner sees both terms on it", async () => {
    const { scratch, mallory } = await ac3World();
    const rows = await visible(scratch.db, {
      kind: "account",
      accountId: mallory.accountId,
      handle: mallory.handle,
    });
    const card = rows.find((r) => r.id === AC3.privateOnlyCard.id);
    expect(card, "the private-only card was never published").toBeDefined();
    const sites = sitesOf(card!.card);
    /* Both halves matter. A zero for a term nothing ever named is AC4's criterion, not AC3's —
       the absolute cells are only about privacy if the content is really in the store and
       really names these ids. */
    expect(sites).toContain(AC3.privateOnlyTerm);
    expect(sites).toContain(AC3.privateOnlyLocal);
  });

  it("the private-only local id is namespaced, so it is inside candidates()'s domain", () => {
    /* Under D-210-05 a core-only id would be filtered out of the candidate list for the WRONG
       reason, and the "not a candidate" cell would be green about the local filter rather than
       about privacy. */
    expect(splitTermId(AC3.privateOnlyLocal).namespace).toBeDefined();
  });
});

describe("AC4's world is populated, and really names none of the three ids", () => {
  it("there is real content in the store, so answering zero is not free", async () => {
    const { scratch } = await ac4World();
    const rows = await visible(scratch.db, anonymous);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => sitesOf(r.card).includes(AC4.namedTerm))).toBe(true);
  });

  it("none of the three ids AC4 asks about is named anywhere in it", async () => {
    const { scratch } = await ac4World();
    const rows = await visible(scratch.db, anonymous);
    const all = new Set(rows.flatMap((r) => sitesOf(r.card)));
    for (const id of [AC4.abstractRoot, AC4.unknownId, AC4.unknownLocalId]) {
      expect(all.has(id)).toBe(false);
    }
  });

  it("the abstract root is a real core term and the two unknown ids are not", async () => {
    const core = (await import("@/lib/core")) as unknown as {
      CORE_ONTOLOGY: { terms: { id: string }[] };
    };
    const ids = new Set(core.CORE_ONTOLOGY.terms.map((t) => t.id));
    /* "An abstract root counting zero is not a defect" is a claim about a term the vocabulary
       DECLARES. If this id were not in the core, the cell would be testing an unknown id twice
       and the root case would be untested. */
    expect(ids.has(AC4.abstractRoot)).toBe(true);
    expect(ids.has(AC4.unknownId)).toBe(false);
    expect(ids.has(AC4.unknownLocalId)).toBe(false);
  });
});

describe("AC5's world really carries local terms on both sides of both thresholds", () => {
  it("every planted term reaches exactly the blueprint and author counts the plan names", async () => {
    const { scratch, plan } = await ac5World();
    const rows = await visible(scratch.db, anonymous);
    for (const entry of plan) {
      const naming = rows.filter((r) => sitesOf(r.card).includes(entry.term));
      const blueprints = new Set(naming.flatMap((r) => r.usedIn.map(keyOf)));
      const authors = new Set(
        naming.map((r) => r.card.author).filter((a): a is string => a !== undefined && a !== ""),
      );
      /* Derived from the plan, which is derived from the live thresholds. Nothing here is a
         number I typed beside an assertion, which is the one prediction this run has measured
         going wrong. */
      expect({ term: entry.term, blueprints: blueprints.size, authors: authors.size }).toEqual({
        term: entry.term,
        blueprints: entry.blueprints,
        authors: entry.authors,
      });
    }
  });

  it("the four planted ids are namespaced and the control term is not", async () => {
    /* D-210-05 makes the id SHAPE the filter, so a fixture whose "local" terms were not
       namespaced would put the whole AC5 file outside the thing under test. */
    for (const term of Object.values(AC5_TERMS)) {
      expect(splitTermId(term).namespace).toBeDefined();
    }
    expect(splitTermId(AC5_CORE_TERM).namespace).toBeUndefined();
  });

  it("the core control term IS named by the world, so excluding it is an observable act", async () => {
    const { scratch } = await ac5World();
    const rows = await visible(scratch.db, anonymous);
    const naming = rows.filter((r) => sitesOf(r.card).includes(AC5_CORE_TERM));
    /* A core term nothing named would be absent from the candidate list whether or not the
       filter exists, and the core-exclusion cell would red 0 against an implementation with no
       filter at all. It has to be counted before its absence means anything. */
    expect(naming.length).toBeGreaterThan(0);
  });
});

describe("AC6's world holds the second bundle back", () => {
  it("before the second publish exactly one blueprint pins the card", async () => {
    const { scratch } = await ac6World();
    const rows = await visible(scratch.db, anonymous);
    const card = rows.find((r) => r.id === AC6.card.id);
    expect(card).toBeDefined();
    expect([...new Set(card!.usedIn.map(keyOf))]).toEqual([`ada/${AC6.firstSlug}`]);
    expect(card!.usedIn).toHaveLength(AC6.blueprintsBefore);
  });
});
