/* ============================================================
   The find verbs with no encoder, which is the arm that makes
   `ordered` falsifiable.

   ── why this is its own file ──
   The mock has to be at MODULE scope to take at all, and it has to
   be in place before the world is built: a release published while
   the encoder is reachable carries a vector, and then no hit in
   this file could ever lack one. `find.test.ts` beside it runs with
   the encoder present and cannot reach this state at any point in
   its life — `grep -rn "vi.mock" tests/server/t220/` finds nothing
   there, and a branch inside one of its cells is a branch, not an
   arm.

   ── what it proves that `encoder` does not ──
   `encoder: "absent"` is a fact about the PROCESS and was already
   published. `ordered: false` is a fact about the ROWS that came
   back, and the two come apart: a release published during an
   outage keeps its missing vector into a process that has an
   encoder. That mixed state is the one neither flag reported
   before. Here both are false at once, which is the cheap half;
   the expensive half is the premise cell below, which shows the OLD
   law still holds on exactly this data — so a `false` is the new
   clause and not the old one wearing a new docblock.

   Two verbs, two cells. Two cells in one file are not two votes:
   without the cards cell, deleting the clause would red only the
   blueprint side and leave `find-cards.ts` unwitnessed.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { contentCardLibrary, readContent } from "@/lib/content/read";
import { hitsOf, verb } from "./contract";
import { anonymous, dropScratchDatabases, seededWorld } from "./fixtures";

/* Copied from `tests/server/t300/degraded.test.ts`: the encoder's runtime failing the way a
   missing install fails, at import. `lib/server/search/minilm.ts` loads it through a dynamic
   import and `embed.ts` turns the rejection into "no encoder on this machine". */
vi.mock("onnxruntime-node", () => {
  throw new Error("this test file has no encoder");
});

const world = seededWorld();
const hasDb = Boolean(process.env.DATABASE_URL);

/** A word unique to one bundle's title, taken from the content rather than typed. */
function knownToken(): string {
  const titles = readContent().map((b) => b.bundle.manifest.title);
  for (const title of titles) {
    for (const word of title.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length < 5) continue;
      if (titles.filter((t) => t.toLowerCase().includes(word)).length === 1) return word;
    }
  }
  throw new Error("No title carries a word unique to one bundle.");
}

/* The cards arm needs a token of its OWN. A blueprint title word reaches a card only
   through the vector channel, which is the one thing this file takes away, so reusing
   `knownToken()` here answers zero hits and the cell measures nothing. `name` is in the
   haystack `lib/server/search/cards.ts` searches, beside `id`, `action` and `spec`. */
function knownCardToken(): string {
  const names = contentCardLibrary().map((entry) => entry.card.name ?? "");
  for (const name of names) {
    for (const word of name.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length < 5) continue;
      if (names.filter((other) => other.toLowerCase().includes(word)).length === 1) return word;
    }
  }
  throw new Error("No card name carries a word unique to one card.");
}

afterAll(async () => {
  await dropScratchDatabases();
});

describe.skipIf(!hasDb)("a find with no encoder", () => {
  let w: Awaited<ReturnType<typeof world>>;

  beforeAll(async () => {
    w = await world();
  }, 240_000);

  it("withdraws the rank on blueprints while the evidence still stands", async () => {
    const find = await verb("mcpFindBlueprints");
    const result = (await find(w.scratch.db, anonymous, knownToken(), { limit: 20 })) as {
      encoder: string;
      ordered: boolean;
      hits: readonly { evidence: readonly string[]; similarity?: number }[];
    };

    /* The premise, asserted rather than branched on: a present encoder here means the mock did
       not take, and every assertion below would then be measuring the ordinary world. */
    expect(result.encoder, "the mock did not take; this file is measuring nothing").toBe("absent");
    expect(result.hits.length, "no hits is not a degraded rank, it is no answer").toBeGreaterThan(0);

    /* THE CONTROL. The old law is satisfied on exactly this data, so the `false` below is the
       new clause doing the work and not the old one under a different name. */
    expect(
      result.hits.every((hit) => hit.evidence.length > 0),
      "every hit still explains itself, which is all the old law ever asked",
    ).toBe(true);

    expect(result.ordered).toBe(false);
  });

  it("withdraws it on cards too, which is the second call site", async () => {
    const task = knownCardToken();
    const find = await verb("mcpFindCards");
    const result = (await find(w.scratch.db, anonymous, task, { limit: 20 })) as {
      encoder: string;
      ordered: boolean;
    };
    const hits = hitsOf(result, `mcpFindCards(db, actor, ${JSON.stringify(task)})`);

    expect(result.encoder, "the mock did not take; this cell is measuring nothing").toBe("absent");
    expect(hits.length, "no hits is not a degraded rank, it is no answer").toBeGreaterThan(0);
    expect(
      hits.every((hit) => hit.evidence.length > 0),
      "every hit still explains itself, which is all the old law ever asked",
    ).toBe(true);
    expect(result.ordered).toBe(false);
  });
});
