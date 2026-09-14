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

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const requireEncoder = argv.includes("--require-encoder");
/* `--baseline <file>`, taking the value as the next argument so a path with an `=` in it is
   not split by one. */
const baselineAt = argv.indexOf("--baseline");
const baselinePath = baselineAt === -1 ? undefined : argv[baselineAt + 1];
/* `baselineAt + 1` is the VALUE of `--baseline` and is not the eval file. Guarded on
   `baselineAt !== -1`, because without the flag that index is 0 — which is the eval file. */
const path = argv.find((arg, i) => !arg.startsWith("--") && !(baselineAt !== -1 && i === baselineAt + 1));
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

function rankLine(label: string, query: string, expected: string, ranked: Ranked): { rank: number | undefined } {
  const rank = ranked.keys.indexOf(expected);
  const found = rank !== -1;
  const score = found ? ranked.scoreOf.get(expected)?.toFixed(4) : "-";
  const similarity = found ? (ranked.similarityOf.get(expected) ?? "-") : "-";
  console.log(
    `  ${label} rank ${found ? String(rank + 1).padStart(2) : " -"}  score ${String(score).padEnd(6)}  sim ${similarity.padEnd(4)}  ` +
      `${JSON.stringify(query)}\n      expected ${expected}; top: ${ranked.keys.slice(0, 3).join(", ") || "(nothing)"}`,
  );
  return { rank: found ? rank + 1 : undefined };
}

/**
 * The headline metric, and it is `@5` for one reason: `FIND_DEFAULT_LIMIT` is 5 and both MCP
 * find verbs slice with `clampLimit`, so a hit at rank 6 is a hit no agent is ever shown.
 * top-1 and MRR sit beside it because a set can hold recall while losing the order.
 */
function summarise(ranks: readonly (number | undefined)[]): Summary {
  const found = ranks.filter((r): r is number => r !== undefined);
  return {
    n: ranks.length,
    recallAt5: found.filter((r) => r <= 5).length,
    top1: found.filter((r) => r === 1).length,
    top3: found.filter((r) => r <= 3).length,
    mrr: Number((ranks.reduce<number>((sum, r) => sum + (r === undefined ? 0 : 1 / r), 0) / (ranks.length || 1)).toFixed(4)),
  };
}

interface Summary {
  n: number;
  recallAt5: number;
  top1: number;
  top3: number;
  mrr: number;
}

/** `a/b` with the ratio, so a run reads without arithmetic. */
function line(label: string, s: Summary): string {
  return `${label}: recall@5 ${s.recallAt5}/${s.n}, top-1 ${s.top1}/${s.n}, top-3 ${s.top3}/${s.n}, MRR ${s.mrr.toFixed(3)}`;
}

const client = createDbClient();
try {
  const db = client.db;
  let encoder = "unknown";

  const blueprints = file.blueprints ?? [];
  const blueprintRanks: (number | undefined)[] = [];
  if (blueprints.length > 0) console.log(`blueprints (${blueprints.length}):`);
  for (const row of blueprints) {
    const results = await searchBlueprints(db, anonymous, { q: row.query, forks: "all" });
    encoder = results.encoder;
    const ranked = distinct(results.hits, (i) => results.hits[i].item.slug, results.encoder);
    blueprintRanks.push(rankLine("bp  ", row.query, row.expected, ranked).rank);
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
  const cardRanks: (number | undefined)[] = [];
  if (cards.length > 0) console.log(`cards (${cards.length}):`);
  for (const row of cards) {
    const results = await searchCards(db, anonymous, { q: row.query });
    encoder = results.encoder;
    const ranked = distinct(results.hits, (i) => results.hits[i].item.id, results.encoder);
    cardRanks.push(rankLine("card", row.query, row.expected, ranked).rank);
  }

  const report = {
    encoder,
    blueprints: summarise(blueprintRanks),
    cards: summarise(cardRanks),
    negatives: { n: negatives.length, quiet },
  };

  console.log("");
  console.log(`encoder: ${encoder}`);
  if (blueprints.length > 0) console.log(line("blueprints", report.blueprints));
  if (negatives.length > 0) {
    console.log(`negatives: ${quiet}/${negatives.length} empty or below ${(MIN_SIMILARITY + NEGATIVE_MARGIN).toFixed(2)}`);
  }
  if (cards.length > 0) console.log(line("cards     ", report.cards));

  if (asJson) console.log(`\n${JSON.stringify(report, null, 2)}`);

  /* An absent encoder is a DIFFERENT failure from a bad ranking and exits differently, so a
     caller can tell "search got worse" from "search is not running". */
  if (requireEncoder && encoder !== "present") {
    console.error(`\n--require-encoder: the encoder is ${encoder}; every number above is lexical.`);
    process.exitCode = 2;
  } else if (baselinePath !== undefined) {
    const before = JSON.parse(readFileSync(baselinePath, "utf8")) as typeof report;
    const falls: string[] = [];
    for (const half of ["blueprints", "cards"] as const) {
      for (const metric of ["recallAt5", "top1", "top3"] as const) {
        const was = before[half][metric];
        const now = report[half][metric];
        if (now < was) falls.push(`${half}.${metric} ${was} -> ${now}`);
      }
    }
    if (before.negatives.quiet > report.negatives.quiet) {
      falls.push(`negatives.quiet ${before.negatives.quiet} -> ${report.negatives.quiet}`);
    }
    if (falls.length > 0) {
      console.error(`\nagainst ${baselinePath}, ${falls.length} metric(s) fell:\n  ${falls.join("\n  ")}`);
      process.exitCode = 1;
    } else {
      console.log(`\nagainst ${baselinePath}: nothing fell.`);
    }
  }
} finally {
  await client.close();
}
