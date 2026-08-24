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

  it("treats a task that tokenises to nothing as a listing, not as a query", async () => {
    const w = await world();
    /* THE ONLY INPUT THAT SEPARATES THE LAW FROM `ordered = task !== ""`.
       Found by deriving the pre-registered sweep rather than by running it: through this
       composition the two are otherwise EXACTLY equivalent, because a non-empty `q` always
       reaches `ranked(...)` (where every surviving hit has evidence) and an empty one always
       reaches `unranked(...)`. So the cheap wrong implementation would have reddened 0 of 49
       cells and the sweep would have called it covered.

       `normalise` is `toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()`, so a
       punctuation-only task normalises to `""` and `words("")` is `[]` — a NON-EMPTY task
       that carries no query. An agent sending `"???"` is not a contrived input. */
    const punctuation = "??? ...";
    const bp = await searchBlueprints(w.scratch.db as never, anonymous, { q: punctuation });
    const listing = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    /* The premise, and it is the whole claim: T200 answers this identically to the empty
       listing. If that ever stops being true the cell is wrong, not the module. */
    expect(bp.ordered).toBe(false);
    expect(bp.hits.length).toBe(listing.hits.length);
    expect(bp.hits.length).toBeGreaterThan(0);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, punctuation)) as {
      hits: { evidence: readonly string[] }[];
      ordered: boolean;
    };

    expect(result.hits.length).toBeGreaterThan(0);
    expect(
      result.ordered,
      "`ordered` was true for a task that carries no query words. That is what " +
        "`ordered = task !== \"\"` answers, and it agrees with the law on every OTHER input " +
        "this suite sends — which is why this cell exists.",
    ).toBe(false);
    expect(result.hits.every((h) => h.evidence.length === 0)).toBe(true);
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
    /* Four tasks, and the punctuation one is here for the same reason it has a cell of its
       own: it is the only member whose law disagrees with `task !== ""`. Three tasks made
       this cell blind to that implementation. */
    const tasks = ["", knownToken(), MISS, "??? ..."];

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

describe("T220 AC5 — the evidence D-220-04 restored", () => {
  /* The field this suite charged as missing before any cell was written, and the reason the
     charge mattered: without it `ordered: true` is the relevance-number-with-no-published-
     derivation that `/mcp`'s own OPEN row refuses, and an agent has no way to check the
     claim. These three cells are what the field buys. */

  it("gives every hit non-empty evidence exactly when the answer claims to be ordered", async () => {
    const w = await world();
    const token = knownToken();
    /* Before the bind, and it is what makes the biconditional discriminating: the two tasks
       must land on OPPOSITE sides of the law, or "evidence agrees with ordered" is checked
       twice against the same truth value. */
    const ranked = await searchBlueprints(w.scratch.db as never, anonymous, { q: token });
    const listing = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    expect(ranked.ordered).toBe(true);
    expect(listing.ordered).toBe(false);

    const mcpSearch = await verb("mcpSearch");

    for (const task of [token, ""]) {
      const result = (await mcpSearch(w.scratch.db, anonymous, task)) as {
        hits: { evidence: readonly string[] }[];
        ordered: boolean;
      };
      expect(result.hits.length, `task ${JSON.stringify(task)} matched nothing`).toBeGreaterThan(0);
      /* AC5's law, now checkable by the CALLER rather than only from inside the process —
         which is the whole difference D-220-04 made. */
      expect(
        result.hits.every((h) => h.evidence.length > 0),
        `task ${JSON.stringify(task)}: \`ordered\` is ${result.ordered} but the evidence ` +
          "does not agree with it.",
      ).toBe(result.ordered);
    }
  });

  it("carries T200's own evidence strings, not a restatement of the query", async () => {
    const w = await world();
    const token = knownToken();
    const bp = await searchBlueprints(w.scratch.db as never, anonymous, { q: token });
    expect(bp.hits.length).toBeGreaterThan(0);
    /* The oracle is T200's shipped `Hit.evidence`, keyed by the same ref the block pins. */
    const expected = new Map(
      bp.hits.map((h) => [`${h.item.ownerHandle}/${h.item.slug}`, [...h.evidence].sort()]),
    );
    /* The premise D-200-09 makes the point of: evidence names the FIELD that matched and the
       word in the DOCUMENT, `<field>:<token>`, so it is not the query echoed back. */
    const sample = [...expected.values()][0]!;
    expect(sample.length).toBeGreaterThan(0);
    expect(sample.every((e) => e.includes(":"))).toBe(true);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, token)) as {
      hits: { kind: string; ref: string; evidence: readonly string[] }[];
    };

    const wrong = result.hits
      .filter((h) => h.kind === "blueprint")
      .filter((h) => {
        const want = expected.get(h.ref);
        return want === undefined || JSON.stringify([...h.evidence].sort()) !== JSON.stringify(want);
      })
      .map((h) => `${h.ref}: ${JSON.stringify(h.evidence)} want ${JSON.stringify(expected.get(h.ref))}`);
    expect(wrong, "evidence is composed through from T200, not recomputed here").toEqual([]);
  });

  it("gives empty evidence to every hit of an unordered listing", async () => {
    const w = await world();
    const bp = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    /* T200 DISCARDS evidence for a listing rather than never computing it, and `ordered`
       follows. So the empty task is the case where a module that carried evidence anyway
       would be claiming a rank it did not make. */
    expect(bp.hits.length).toBeGreaterThan(0);
    expect(bp.hits.every((h) => h.evidence.length === 0)).toBe(true);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, "")) as {
      hits: { evidence: readonly string[] }[];
      ordered: boolean;
    };
    expect(result.ordered).toBe(false);
    expect(
      result.hits.filter((h) => h.evidence.length > 0).length,
      "an unranked listing carries no evidence — every hit sits in the registry's own key " +
        "order, which is not a rank the archive explains.",
    ).toBe(0);
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
  it("carries `author` for a blueprint hit and OMITS it for a card hit", async () => {
    const w = await world();
    const bp = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    const cards = await searchCards(w.scratch.db as never, anonymous, { q: "" });
    expect(bp.hits.length).toBeGreaterThan(0);
    expect(cards.hits.length).toBeGreaterThan(0);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, "")) as {
      hits: { kind: string; ref: string; author?: string; digest: string }[];
    };

    /* D-220-05. `author` is the OWNER HANDLE for a blueprint and is OMITTED for a card, and
       the ruling took the card half from the structural fact this suite charged before the
       cells were written: `CardSummary` carries no owner field, so filling it would need a
       per-hit join T220 is told not to invent.

       Asserted STRUCTURALLY rather than against the literal `darkprint`: `author` must equal
       the owner half of the hit's own ref. A cell pinning the constant would pass against a
       module that hardcoded it, and every seeded blueprint has the same owner after T250. */
    const blueprints = result.hits.filter((h) => h.kind === "blueprint");
    const cardHits = result.hits.filter((h) => h.kind === "card");
    expect(blueprints.length).toBeGreaterThan(0);
    expect(cardHits.length).toBeGreaterThan(0);

    expect(
      blueprints.filter((h) => h.author !== h.ref.split("/")[0]).map((h) => JSON.stringify(h)),
      "a blueprint hit's `author` is its owner handle, which is also the first half of its " +
        "`ownerHandle/slug` ref (D-220-05, D-220-13).",
    ).toEqual([]);
    expect(
      cardHits.filter((h) => h.author !== undefined).map((h) => JSON.stringify(h)),
      "a card hit carries no author. `manifest.author`/`card.author` are the stale claims " +
        "T250 deliberately left in place (D-250-18), naming six handles that hold no " +
        "account — an agent cannot act on one.",
    ).toEqual([]);
  });

  it("omits `author` on a card hit rather than setting it to undefined", async () => {
    const w = await world();
    const cards = await searchCards(w.scratch.db as never, anonymous, { q: "" });
    expect(cards.hits.length).toBeGreaterThan(0);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, "")) as {
      hits: Record<string, unknown>[];
    };
    const cardHits = result.hits.filter((h) => h.kind === "card");
    expect(cardHits.length).toBeGreaterThan(0);

    /* The stricter reading of D-220-05's "OMITTED", in its OWN cell so the sweep can tell
       the two apart. This repository distinguishes the spellings deliberately —
       `PublicAuthor.bio` is documented as "Omitted when the account has no bio — never
       `null`, never present-and-undefined" — so absence is the reading the codebase already
       holds. A red HERE and a green above means the key is present carrying `undefined`,
       which is a one-line fix and not a failed criterion. */
    expect(
      cardHits.filter((h) => Object.hasOwn(h, "author")).map((h) => JSON.stringify(h)),
      "`author` is present on a card hit carrying `undefined`. D-220-05 omits it.",
    ).toEqual([]);
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

  it("spells a blueprint ref `ownerHandle/slug` and a card ref `id@version`", async () => {
    const w = await world();
    const bp = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    const cards = await searchCards(w.scratch.db as never, anonymous, { q: "" });
    /* The oracles' own keys, so the expected strings are T080's answer rather than this
       file's idea of it. Built before the bind. */
    const bpRefs = new Set(bp.hits.map((h) => `${h.item.ownerHandle}/${h.item.slug}`));
    const cardRefs = new Set(cards.hits.map((h) => h.item.ref));
    expect(bpRefs.size).toBeGreaterThan(0);
    expect(cardRefs.size).toBeGreaterThan(0);

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, "")) as {
      hits: { kind: string; ref: string }[];
    };

    /* D-220-13 pinned both spellings and recorded that `/mcp`'s slug-only and bare-id forms
       are STALE, predating B-09's multi-owner key. */
    const strayBp = result.hits.filter((h) => h.kind === "blueprint" && !bpRefs.has(h.ref));
    const strayCard = result.hits.filter((h) => h.kind === "card" && !cardRefs.has(h.ref));
    expect(strayBp.map((h) => h.ref), "blueprint refs are `ownerHandle/slug`").toEqual([]);
    expect(strayCard.map((h) => h.ref), "card refs are `id@version`").toEqual([]);
  });

  it("concatenates blueprints then cards, with no interleaving by score", async () => {
    const w = await world();
    const token = knownToken();
    /* The premise that makes this cell able to fail: the token must match BOTH kinds, or a
       hit list of one kind satisfies "no interleaving" by having nothing to interleave. */
    const bp = await searchBlueprints(w.scratch.db as never, anonymous, { q: token });
    const cards = await searchCards(w.scratch.db as never, anonymous, { q: token });
    const task = bp.hits.length > 0 && cards.hits.length > 0 ? token : "";
    const both = task === "" ? "the empty listing" : `\`${token}\``;
    const bpN = task === "" ? undefined : bp.hits.length;
    void bpN;

    const mcpSearch = await verb("mcpSearch");
    const result = (await mcpSearch(w.scratch.db, anonymous, task)) as {
      hits: { kind: string }[];
    };
    const kinds = result.hits.map((h) => h.kind);
    expect(kinds.filter((k) => k === "blueprint").length, `${both} matched no blueprint`)
      .toBeGreaterThan(0);
    expect(kinds.filter((k) => k === "card").length, `${both} matched no card`).toBeGreaterThan(0);

    /* D-220-14: concatenation blueprints-then-cards. Interleaving by score would be the
       second ranking D-220-02 forbids, and it is invisible to every other cell here — a
       merged list has the same length and the same members either way. */
    const firstCard = kinds.indexOf("card");
    const lastBlueprint = kinds.lastIndexOf("blueprint");
    expect(
      lastBlueprint,
      `kinds: ${kinds.join(",")} — a blueprint appears after a card, so the two shelves were ` +
        "merged by score rather than concatenated.",
    ).toBeLessThan(firstCard);
  });
});
