#!/usr/bin/env node
/* ============================================================
   DarkPrint — retrieval evaluation, from a terminal
   `npm run eval:rag -- <file.json>`

   The file holds tasks a reader might type and the blueprint or
   card each should reach:

       {
         "blueprints": [{ "query": "…", "expected": "<slug>" }],
         "negatives":  [{ "query": "…" }],
         "cards":      [{ "query": "…", "expected": "<card id>" }]
       }

   Each query is run through the same `searchBlueprints` and
   `searchCards` the routes call, against `DATABASE_URL`. A
   blueprint is matched by SLUG under any owner and a card by its
   id under any version, because the local archive holds the seed
   under two owners with identical content and the second copy
   would otherwise fill the top three with duplicates. Ranks are
   therefore over DISTINCT slugs (or ids), first occurrence wins,
   and the raw top hits are printed beside them.

   Exit code is 0 whatever the numbers say: this prints a
   measurement for a person to read, and the thresholds belong to
   whoever runs the held-out set.
   ============================================================ */

import "./module-hook.ts";
import { readFileSync } from "node:fs";

const { searchBlueprints, searchCards } = await import("@/lib/server/search");
/* The floor is read off the module that publishes it, beside its calibration; this script
   only quotes it when it judges a negative. Deep path on purpose: the constant stays off
   the barrel so nothing binds to it as an API. */
const { MIN_SIMILARITY } = await import("@/lib/server/search/embed");
const { createDbClient } = await import("@/lib/db");

interface Positive {
  query: string;
  expected: string;
}
interface EvalFile {
  blueprints?: Positive[];
  negatives?: { query: string }[];
  cards?: Positive[];
}

/** How far above the floor a negative's best score may sit and still read as "nothing here". */
const NEGATIVE_MARGIN = 0.05;

const path = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (path === undefined) {
  console.error("usage: npm run eval:rag -- <file.json>");
  process.exit(2);
}
const file = JSON.parse(readFileSync(path, "utf8")) as EvalFile;
const anonymous = { kind: "anonymous" } as const;

interface Ranked {
  /** Distinct keys in rank order. */
  keys: string[];
  /** Score of the first hit carrying each key. */
  scoreOf: Map<string, number>;
  /** The `similarity:` entry of the first hit carrying each key, if any. */
  similarityOf: Map<string, string>;
  encoder: string;
}

function distinct(hits: readonly { evidence: readonly string[]; score: number }[], keyOf: (i: number) => string, encoder: string): Ranked {
  const keys: string[] = [];
  const scoreOf = new Map<string, number>();
  const similarityOf = new Map<string, string>();
  hits.forEach((hit, i) => {
    const key = keyOf(i);
    if (scoreOf.has(key)) return;
    keys.push(key);
    scoreOf.set(key, hit.score);
    const similarity = hit.evidence.find((e) => e.startsWith("similarity:"));
    if (similarity !== undefined) similarityOf.set(key, similarity.slice("similarity:".length));
  });
  return { keys, scoreOf, similarityOf, encoder };
}

function rankLine(label: string, query: string, expected: string, ranked: Ranked): { top1: boolean; top3: boolean } {
  const rank = ranked.keys.indexOf(expected);
  const found = rank !== -1;
  const score = found ? ranked.scoreOf.get(expected)?.toFixed(4) : "-";
  const similarity = found ? (ranked.similarityOf.get(expected) ?? "-") : "-";
  console.log(
    `  ${label} rank ${found ? String(rank + 1).padStart(2) : " -"}  score ${String(score).padEnd(6)}  sim ${similarity.padEnd(4)}  ` +
      `${JSON.stringify(query)}\n      expected ${expected}; top: ${ranked.keys.slice(0, 3).join(", ") || "(nothing)"}`,
  );
  return { top1: rank === 0, top3: found && rank < 3 };
}

const client = createDbClient();
try {
  const db = client.db;
  let encoder = "unknown";

  const blueprints = file.blueprints ?? [];
  let top1 = 0;
  let top3 = 0;
  if (blueprints.length > 0) console.log(`blueprints (${blueprints.length}):`);
  for (const row of blueprints) {
    const results = await searchBlueprints(db, anonymous, { q: row.query, forks: "all" });
    encoder = results.encoder;
    const ranked = distinct(results.hits, (i) => results.hits[i].item.slug, results.encoder);
    const outcome = rankLine("bp  ", row.query, row.expected, ranked);
    if (outcome.top1) top1 += 1;
    if (outcome.top3) top3 += 1;
  }

  const negatives = file.negatives ?? [];
  let quiet = 0;
  if (negatives.length > 0) console.log(`negatives (${negatives.length}):`);
  for (const row of negatives) {
    const results = await searchBlueprints(db, anonymous, { q: row.query, forks: "all" });
    encoder = results.encoder;
    const ranked = distinct(results.hits, (i) => results.hits[i].item.slug, results.encoder);
    const best = ranked.keys[0];
    const bestScore = best === undefined ? undefined : ranked.scoreOf.get(best);
    const isQuiet = bestScore === undefined || bestScore < MIN_SIMILARITY + NEGATIVE_MARGIN;
    if (isQuiet) quiet += 1;
    console.log(
      `  neg  ${isQuiet ? "quiet " : "LOUD  "} hits ${String(ranked.keys.length).padStart(2)}  ` +
        `top ${best === undefined ? "(nothing)" : `${best} @ ${bestScore?.toFixed(4)}`}  ${JSON.stringify(row.query)}`,
    );
  }

  const cards = file.cards ?? [];
  let cardTop1 = 0;
  let cardTop3 = 0;
  if (cards.length > 0) console.log(`cards (${cards.length}):`);
  for (const row of cards) {
    const results = await searchCards(db, anonymous, { q: row.query });
    encoder = results.encoder;
    const ranked = distinct(results.hits, (i) => results.hits[i].item.id, results.encoder);
    const outcome = rankLine("card", row.query, row.expected, ranked);
    if (outcome.top1) cardTop1 += 1;
    if (outcome.top3) cardTop3 += 1;
  }

  console.log("");
  console.log(`encoder: ${encoder}`);
  if (blueprints.length > 0) console.log(`blueprints: top-1 ${top1}/${blueprints.length}, top-3 ${top3}/${blueprints.length}`);
  if (negatives.length > 0) {
    console.log(`negatives: ${quiet}/${negatives.length} empty or below ${(MIN_SIMILARITY + NEGATIVE_MARGIN).toFixed(2)}`);
  }
  if (cards.length > 0) console.log(`cards: top-1 ${cardTop1}/${cards.length}, top-3 ${cardTop3}/${cards.length}`);
} finally {
  await client.close();
}
