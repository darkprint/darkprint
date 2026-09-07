/* ============================================================
   The two find verbs, held to the search module they compose

   The search module is the oracle: a find verb answers its hits in
   its order, flattened for an agent and cut to a limit, and the one
   thing it adds of its own (one entry per card id) is asserted
   against a collapse computed here from the oracle's own hits. The
   `ordered` law is the search module's, composed through.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { compareVersionStrings } from "@/lib/core";
import { readContent } from "@/lib/content/read";
import { searchBlueprints, searchCards } from "@/lib/server/search";

import { hitsOf, verb } from "./contract";
import { anonymous, dropScratchDatabases, seededWorld } from "./fixtures";

const world = seededWorld();

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

const blueprintRef = (hit: { item: { ownerHandle: string; slug: string } }): string =>
  `${hit.item.ownerHandle}/${hit.item.slug}`;

afterAll(async () => {
  await dropScratchDatabases();
});

interface BlueprintHit {
  kind: string;
  ref: string;
  author: string;
  digest: string;
  title: string;
  tags: unknown;
  score: number;
  similarity?: number;
  evidence: readonly string[];
  nodes?: number;
  humanGates?: unknown;
  autonomy?: unknown;
  security?: unknown;
  phases?: unknown;
}

interface FindResult<H> {
  task: string;
  encoder: string;
  ordered: boolean;
  hits: H[];
}

describe("find blueprints", () => {
  it("answers the search module's own order, flattened, with at most five by default", async () => {
    const w = await world();
    const token = knownToken();
    const oracle = await searchBlueprints(w.scratch.db as never, anonymous, { q: token });
    expect(oracle.hits.length, "the token must find something for this cell to measure").toBeGreaterThan(0);

    const find = await verb("mcpFindBlueprints");
    const result = (await find(w.scratch.db, anonymous, token)) as FindResult<BlueprintHit>;
    const hits = hitsOf(result, `mcpFindBlueprints(db, actor, ${JSON.stringify(token)})`) as BlueprintHit[];

    expect(result.task).toBe(token);
    expect(result.encoder).toBe(oracle.encoder);
    expect(hits.length).toBeLessThanOrEqual(5);
    expect(hits.map((hit) => hit.ref)).toEqual(oracle.hits.slice(0, 5).map(blueprintRef));
    expect(hits.map((hit) => hit.score)).toEqual(oracle.hits.slice(0, 5).map((hit) => hit.score));
    expect(result.ordered).toBe(hits.every((hit) => hit.evidence.length > 0));

    for (const hit of hits) {
      expect(hit.kind).toBe("blueprint");
      expect(hit.ref).toMatch(/^[^/]+\/[^/]+$/);
      expect(hit.author.length).toBeGreaterThan(0);
      expect(hit.digest.startsWith("sha256:")).toBe(true);
      expect(typeof hit.title).toBe("string");
      expect(Array.isArray(hit.tags)).toBe(true);
      expect(hit.evidence.length).toBeGreaterThan(0);
    }
  });

  it("carries the scorecard summary of the release the registry scored", async () => {
    const w = await world();
    const find = await verb("mcpFindBlueprints");
    const result = (await find(w.scratch.db, anonymous, "", { limit: 20 })) as FindResult<BlueprintHit>;
    const hits = hitsOf(result, "mcpFindBlueprints(db, actor, \"\")") as BlueprintHit[];
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.nodes, `${hit.ref} carries no node count`).toBeGreaterThan(0);
      expect(typeof hit.autonomy, `${hit.ref} carries no autonomy class`).toBe("string");
      expect(typeof hit.security, `${hit.ref} carries no security level`).toBe("number");
      expect(Array.isArray(hit.humanGates), `${hit.ref} carries no human-gate list`).toBe(true);
      expect(Array.isArray(hit.phases), `${hit.ref} carries no covered phases`).toBe(true);
    }
  });

  it("clamps the limit to the published bounds", async () => {
    const w = await world();
    const oracle = await searchBlueprints(w.scratch.db as never, anonymous, { q: "" });
    const shelf = oracle.hits.length;
    expect(shelf).toBeGreaterThan(2);

    const find = await verb("mcpFindBlueprints");
    const two = (await find(w.scratch.db, anonymous, "", { limit: 2 })) as FindResult<unknown>;
    const many = (await find(w.scratch.db, anonymous, "", { limit: 99 })) as FindResult<unknown>;
    const none = (await find(w.scratch.db, anonymous, "", { limit: 0 })) as FindResult<unknown>;
    expect(two.hits).toHaveLength(2);
    expect(many.hits).toHaveLength(Math.min(20, shelf));
    expect(none.hits, "a limit below one is one, never zero").toHaveLength(1);
  });

  it("lists the public shelf unranked for an empty task and says so", async () => {
    const w = await world();
    const find = await verb("mcpFindBlueprints");
    const result = (await find(w.scratch.db, anonymous, "", { limit: 20 })) as FindResult<BlueprintHit>;
    const hits = hitsOf(result, "mcpFindBlueprints(db, actor, \"\")") as BlueprintHit[];
    expect(hits.length).toBeGreaterThan(0);
    expect(result.ordered, "a listing makes no ranking claim").toBe(false);
    for (const hit of hits) {
      expect(hit.evidence).toEqual([]);
      expect(hit.score).toBe(0);
    }
  });

  it("leaves published forks off the list unless asked", async () => {
    const w = await world();
    const forkRef = `${w.fork.ownerHandle}/${w.fork.slug}`;
    const find = await verb("mcpFindBlueprints");
    const rolled = (await find(w.scratch.db, anonymous, "", { limit: 20 })) as FindResult<BlueprintHit>;
    const all = (await find(w.scratch.db, anonymous, "", { limit: 20, includeForks: true })) as FindResult<BlueprintHit>;
    expect(rolled.hits.map((hit) => hit.ref)).not.toContain(forkRef);
    expect(all.hits.map((hit) => hit.ref)).toContain(forkRef);
  });

  it("reads the similarity off the evidence rather than inventing one", async () => {
    const w = await world();
    const find = await verb("mcpFindBlueprints");
    const result = (await find(w.scratch.db, anonymous, knownToken(), { limit: 20 })) as FindResult<BlueprintHit>;
    for (const hit of result.hits) {
      const entry = hit.evidence.find((e) => e.startsWith("similarity:"));
      if (entry === undefined) expect(hit.similarity).toBeUndefined();
      else expect(hit.similarity).toBe(Number(entry.slice("similarity:".length)));
    }
    if (result.encoder === "absent") {
      expect(result.hits.every((hit) => hit.similarity === undefined)).toBe(true);
    }
  });
});

interface CardHit {
  kind: string;
  ref: string;
  digest: string;
  name: string;
  type: string;
  action: string;
  phases: unknown;
  tools: unknown;
  riskMarkers: unknown;
  usedIn: string[];
  score: number;
  evidence: readonly string[];
}

/** The collapse rule, computed from the oracle: best score per id, ties to the highest version. */
function collapse<H extends { item: { id: string; version: string }; score: number }>(hits: readonly H[]): H[] {
  const best = new Map<string, H>();
  for (const hit of hits) {
    const held = best.get(hit.item.id);
    if (
      held === undefined ||
      hit.score > held.score ||
      (hit.score === held.score && compareVersionStrings(hit.item.version, held.item.version) > 0)
    ) {
      best.set(hit.item.id, hit);
    }
  }
  const kept = new Set(best.values());
  return hits.filter((hit) => kept.has(hit));
}

describe("find cards", () => {
  it("answers one hit per card id, the best version of each, in the search module's order", async () => {
    const w = await world();
    const token = knownToken();
    const oracle = await searchCards(w.scratch.db as never, anonymous, { q: token });
    const expected = collapse(oracle.hits).slice(0, 20).map((hit) => hit.item.ref);
    expect(expected.length, "the token must find some card").toBeGreaterThan(0);

    const find = await verb("mcpFindCards");
    const result = (await find(w.scratch.db, anonymous, token, { limit: 20 })) as FindResult<CardHit>;
    const hits = hitsOf(result, `mcpFindCards(db, actor, ${JSON.stringify(token)})`) as CardHit[];

    expect(hits.map((hit) => hit.ref)).toEqual(expected);
    expect(new Set(hits.map((hit) => hit.ref.split("@")[0])).size).toBe(hits.length);
    expect(result.ordered).toBe(hits.every((hit) => hit.evidence.length > 0));
    for (const hit of hits) {
      expect(hit.kind).toBe("card");
      expect(hit.ref).toMatch(/@/);
      expect(typeof hit.name).toBe("string");
      expect(typeof hit.type).toBe("string");
      expect(typeof hit.action).toBe("string");
      expect(Array.isArray(hit.phases)).toBe(true);
      expect(Array.isArray(hit.tools)).toBe(true);
      expect(Array.isArray(hit.riskMarkers)).toBe(true);
      for (const user of hit.usedIn) expect(user).toMatch(/^[^/]+\/[^/]+$/);
    }
  });

  it("collapses a card the library holds in two versions", async () => {
    const w = await world();
    /* A card id with two versions, read off the store rather than remembered from the seed. */
    const [dup] = await w.scratch.query(
      `select card_id from "card_version" group by card_id having count(*) > 1 order by card_id limit 1`,
    );
    expect(dup?.card_id, "the seed carries no card with two versions").toBeDefined();
    const id = String(dup!.card_id);

    /* The premise: an empty task lists every version, so both reach the collapse. */
    const oracle = await searchCards(w.scratch.db as never, anonymous, { q: "" });
    const versions = oracle.hits.filter((hit) => hit.item.id === id);
    expect(versions.length, `the listing carries ${versions.length} versions of ${id}`).toBeGreaterThan(1);
    const expectedRef = collapse(oracle.hits).find((hit) => hit.item.id === id)!.item.ref;

    const find = await verb("mcpFindCards");
    const result = (await find(w.scratch.db, anonymous, "", { limit: 20 })) as FindResult<CardHit>;
    const oracleOrder = collapse(oracle.hits).map((hit) => hit.item.ref);
    expect(result.hits.map((hit) => hit.ref)).toEqual(oracleOrder.slice(0, 20));
    const mine = result.hits.filter((hit) => hit.ref.split("@")[0] === id);
    /* Present at most once, and when present it is the version the rule keeps; the limit
       may cut it entirely, which the oracle comparison above already covers. */
    expect(mine.length).toBeLessThanOrEqual(1);
    if (mine.length === 1) expect(mine[0]!.ref).toBe(expectedRef);
  });
});
