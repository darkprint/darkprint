/* ============================================================
   T220 AC5 — results carry evidence or declare themselves unordered
   plus the composition D-220-02 and D-300-01 rule this task INTO.

   ── what `ordered` is, and why these cells can falsify it ──
   `McpSearchHit` carries no `evidence` field, so nothing a caller
   holds can check the law directly. It is still falsifiable from
   outside, because the law's truth value moves with the HIT COUNT
   under three tasks — and the three separate every wrong
   implementation a reviewer would write:

     task with a known token -> `ranked(...)`; a candidate with no
       evidence is dropped before ranking, so every hit has evidence
       and `ordered` is TRUE with hits > 0.
     task = ""                -> `queryWords` is empty -> `unranked(...)`
       over the whole public shelf; every hit carries `[]`, so
       `ordered` is FALSE with hits > 0.
     task = gibberish         -> `ranked([])`, and `[].every(...)` is
       TRUE. `ordered` is TRUE with ZERO hits.

   `ordered = hits.length > 0` gets the second and third wrong.
   `ordered = task !== ""` gets the third wrong. Only the law gets
   all three, and D-200-09 names the empty case as the one an
   obviously-right implementation fails.

   ── and why AND-ing the two searchers IS the law ──
   `(A ++ B).every(p) === A.every(p) && B.every(p)`. So a composition
   that ANDs `searchBlueprints(...).ordered` and
   `searchCards(...).ordered` is not an approximation of the merged
   law, it is the merged law. The oracle below is T200's SHIPPED
   module rather than a reimplementation here: a reference written by
   the author of the assertions is a consistency check, never a
   second axis.

   ── what these cells deliberately do NOT assert ──
   Nothing scorecard-driven. D-260-24 is live: `scoresOf` answers
   `undefined` for every blueprint because nothing has ever written
   `release.scored_ontology_version_id`, and `searchBlueprints` pays
   for scorecards only when `phase`/`autonomy`/`df` is set. A cell
   asserting any of it through MCP reds a correct module today.

   Nothing about WHICH string `author` carries. Charge 1 in the T220
   log: the owner handle is `darkprint` for every seeded blueprint
   after T250's re-attribution, while `manifest.author` names one of
   six handles holding no accounts, and the block rules neither. The
   cells hold `author` to being a non-empty string, which both
   readings satisfy and `undefined` does not.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { readContent } from "@/lib/content/read";
import { searchBlueprints, searchCards } from "@/lib/server/search";

import { anonymous, dropScratchDatabases, seededWorld } from "./fixtures";
import { verb } from "./contract";

const world = seededWorld();

/**
 * A token the archive really carries, taken from a manifest rather than typed in.
 *
 * A search that cannot see the form it is given reports absence, and a hand-typed token is
 * how a suite ends up asserting that everything is missing. `title` is in the corpus
 * (D-200-21 puts it there); `author` deliberately is not.
 */
function knownToken(): string {
  const titles = readContent().map((b) => b.bundle.manifest.title);
  for (const title of titles) {
    for (const word of title.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length < 5) continue;
      if (titles.filter((t) => t.toLowerCase().includes(word)).length === 1) return word;
    }
  }
  throw new Error("No title carries a word unique to one bundle; the AC1 triple needs one.");
}

/** In nothing at all, and not a substring of anything seeded. */
const MISS = "zzqxvj-no-such-token-220";

afterAll(async () => {
  await dropScratchDatabases();
});

describe("T220 AC5 — the honesty clause, composed through", () => {
  it("a task that matches nothing answers no hits and STILL claims to be ordered", async () => {
    const w = await world();
    /* The premise, asserted before the module is bound: the token really is absent, so a
       zero below is the law and not a broken fixture. */
    const oracleBp = await searchBlueprints(w.scratch.db as never, anonymous, { q: MISS });
    const oracleCard = await searchCards(w.scratch.db as never, anonymous, { q: MISS });
    expect(oracleBp.hits, "the miss token must match no blueprint").toHaveLength(0);
    expect(oracleCard.hits, "the miss token must match no card").toHaveLength(0);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, MISS)) as {
      hits: unknown[];
      ordered: boolean;
    };

    expect(result.hits).toHaveLength(0);
    expect(
      result.ordered,
      "D-200-09's named trap: `[].every(...)` is `true`, so an empty result MAKES a ranking " +
        "claim it can trivially keep. `ordered = hits.length > 0` gets exactly this wrong " +
        "while looking obviously right.",
    ).toBe(true);
  });

  it("an empty task answers the whole shelf and declares itself UNORDERED", async () => {
    const w = await world();
    const oracleBp = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    const oracleCard = await searchCards(w.scratch.db as never, anonymous, { q: "" });
    /* The premise that makes `ordered: false` discriminating rather than vacuous: the shelf
       is NOT empty, so `[].every(...)` cannot be what produced the answer. */
    expect(oracleBp.hits.length + oracleCard.hits.length).toBeGreaterThan(0);
    expect(oracleBp.ordered, "T200's own answer for a listing with no query").toBe(false);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, "")) as {
      hits: unknown[];
      ordered: boolean;
    };

    expect(result.hits.length).toBeGreaterThan(0);
    expect(
      result.ordered,
      "AC5's honesty clause: a listing in the registry's own key order is not a rank the " +
        "archive explains, so it must not claim one. `ordered = task !== \"\"` gets this one " +
        "right and the empty-result one wrong.",
    ).toBe(false);
  });

  it("a task that matches something answers hits and claims to be ordered", async () => {
    const w = await world();
    const token = knownToken();
    const oracleBp = await searchBlueprints(w.scratch.db as never, anonymous, { q: token });
    expect(oracleBp.hits.length, `\`${token}\` must match at least one blueprint`).toBeGreaterThan(0);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, token)) as {
      hits: unknown[];
      ordered: boolean;
    };

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.ordered).toBe(true);
  });

  it("`ordered` is the composed law and not a quantity of this task's own", async () => {
    const w = await world();
    const tasks = ["", knownToken(), MISS];

    /* The oracle is T200's shipped module, not a reimplementation here, and the identity is
       exact rather than approximate: `(A ++ B).every(p) === A.every(p) && B.every(p)`.
       D-300-01 rules that T220 wraps these searchers and invents NO second ranking, so when
       T300's embeddings land this cell keeps holding without being rewritten.

       Computed BEFORE the module is bound. An early bind reds the cell at the absent module
       while every line below it — including these three round trips — never runs, and a red
       in 0ms where I/O was expected is how that hides. */
    const laws = new Map<string, boolean>();
    for (const task of tasks) {
      const bp = await searchBlueprints(w.scratch.db as never, anonymous, { q: task });
      const cards = await searchCards(w.scratch.db as never, anonymous, { q: task });
      laws.set(task, bp.ordered && cards.ordered);
    }
    /* The premise that stops this cell agreeing vacuously: the three tasks must not all
       produce the same law, or `ordered` could be a constant and still pass. */
    expect(new Set(laws.values()).size, `laws: ${JSON.stringify([...laws])}`).toBeGreaterThan(1);

    const mcpSearch = await verb("mcpSearch");
    for (const task of tasks) {
      const result = (await mcpSearch(w.scratch.db, anonymous, task)) as { ordered: boolean };
      expect(result.ordered, `task ${JSON.stringify(task)}`).toBe(laws.get(task));
    }
  });
});

describe("T220 — the task is prose, not a query string", () => {
  /* Charge 9 in the T220 log, flagged to the orchestrator before it was written. The verb
     takes "the task, in the agent's own words" (`/mcp`, and the block's own Contract line).
     If the string is fed through `searchParams` instead, `sort=slug` becomes an ORDERING
     INSTRUCTION: `sortKey(params, SORT_KEYS) !== undefined` short-circuits to `unranked(...)`
     over every candidate, which is byte-for-byte what the empty task answers.

     So the discriminator is an equality between two calls rather than a value this file
     predicts: under the prose reading `sort=slug` and `""` are different questions, and
     under the query-string reading they are the same one. Nothing here asserts scorecard
     behaviour, so D-260-24 does not reach it. */
  it("does not read `sort=slug` as an ordering instruction", async () => {
    const w = await world();
    /* The premise, before the bind: the listing this cell compares against is non-empty, so
       an equality below is two real answers agreeing rather than two empty ones. */
    const listing = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    expect(listing.hits.length).toBeGreaterThan(0);
    expect(listing.ordered).toBe(false);

    const mcpSearch = await verb("mcpSearch");
    const asProse = (await mcpSearch(w.scratch.db, anonymous, "sort=slug")) as {
      hits: unknown[];
      ordered: boolean;
    };
    const asListing = (await mcpSearch(w.scratch.db, anonymous, "")) as {
      hits: unknown[];
      ordered: boolean;
    };
    expect(
      { hits: asProse.hits.length, ordered: asProse.ordered },
      "`sort=slug` answered exactly what the empty task answers, which is what happens when " +
        "the task is parsed as a query string rather than searched for as words.",
    ).not.toEqual({ hits: asListing.hits.length, ordered: asListing.ordered });
  });

  it("requires every word of the task, so adding a miss empties the result", async () => {
    const w = await world();
    const token = knownToken();
    /* Both premises measured before the bind: the one-word task really does match, and the
       two-word task really does not. Without them a green below is two zeros agreeing. */
    const oneOracle = await searchBlueprints(w.scratch.db as never, anonymous, { q: token });
    const bothOracle = await searchBlueprints(w.scratch.db as never, anonymous, {
      q: `${token} ${MISS}`,
    });
    expect(oneOracle.hits.length).toBeGreaterThan(0);
    expect(bothOracle.hits).toHaveLength(0);

    const mcpSearch = await verb("mcpSearch");
    const one = (await mcpSearch(w.scratch.db, anonymous, token)) as { hits: unknown[] };
    const both = (await mcpSearch(w.scratch.db, anonymous, `${token} ${MISS}`)) as {
      hits: unknown[];
    };
    /* `evidenceFor` is a conjunction across words and a disjunction across fields, so a
       second word that matches nothing empties the answer. This is the opposite of the
       intersection a reviewer expects, and it is the composed rule rather than a new one. */
    expect(one.hits.length).toBeGreaterThan(0);
    expect(both.hits).toHaveLength(0);
  });
});

describe("T220 — what a hit carries", () => {
  it("gives every hit a kind, a ref, a digest and a non-empty author", async () => {
    const w = await world();
    /* Before the bind: the shelf holds both kinds, so a hit set carrying only one of them
       is a finding rather than an accident of the fixture. */
    const bp = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    const cards = await searchCards(w.scratch.db as never, anonymous, { q: "" });
    expect(bp.hits.length).toBeGreaterThan(0);
    expect(cards.hits.length).toBeGreaterThan(0);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, "")) as {
      hits: { kind: string; ref: string; author: string; digest: string }[];
    };
    expect(result.hits.length).toBeGreaterThan(0);

    const bad = result.hits.filter(
      (h) =>
        !["blueprint", "card"].includes(h.kind) ||
        typeof h.ref !== "string" ||
        h.ref === "" ||
        typeof h.digest !== "string" ||
        h.digest === "" ||
        typeof h.author !== "string" ||
        h.author === "",
    );
    /* `author` is held to being a non-empty string and to nothing more. Charge 1: the block
       does not rule whether it is the owner handle (`darkprint` for all nine after T250) or
       `manifest.author` (one of six handles holding no accounts, D-250-18). Both are
       non-empty strings; `undefined` — which is what BOTH sources' optional types permit —
       is not. */
    expect(bad.map((h) => JSON.stringify(h))).toEqual([]);
  });

  it("gives distinct refs to two versions of one card", async () => {
    const w = await world();
    const oracle = await searchCards(w.scratch.db as never, anonymous, { q: "" });
    /* The premise this cell is ABOUT, asserted before the bind: the shelf really does carry
       two documents under one card id. Without it "every ref is distinct" is satisfied by a
       library where no id repeats, and the cell would measure nothing on the day the
       archive stopped carrying a second version. */
    const ids = oracle.hits.map((h) => h.item.id);
    expect(
      ids.length - new Set(ids).size,
      "The card library must carry at least one id at two versions, or this cell cannot " +
        "distinguish a ref spelled `id@version` from one spelled `id`.",
    ).toBeGreaterThan(0);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, "")) as {
      hits: { kind: string; ref: string }[];
    };
    const cardHits = result.hits.filter((h) => h.kind === "card");

    /* The premise, and the whole reason this cell exists: `searchCards` lists every card
       VERSION, and the library holds four ids at two versions apiece — 57 documents under 53
       ids (`seed/plan.ts:87-93`). A `ref` spelled as the bare card id collides on exactly
       those four and puts the same string on two different documents. The block does not
       rule the spelling (charge 8), so this asserts the PROPERTY the spelling exists to
       have rather than the spelling itself. */
    expect(oracle.hits.length).toBe(cardHits.length);
    expect(new Set(oracle.hits.map((h) => h.item.ref)).size).toBeLessThan(oracle.hits.length + 1);
    expect(
      new Set(cardHits.map((h) => h.ref)).size,
      "Two card hits share a `ref`. The library carries four ids at two versions each, so a " +
        "ref spelled as the bare id names two different documents with one string.",
    ).toBe(cardHits.length);
  });
});
