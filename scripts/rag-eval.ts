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
   therefore reported over DISTINCT slugs (or ids) for historical
   comparison, alongside delivered ranks where duplicates consume
   slots. The delivered recall@5 measures the actual five-hit window.

   Without --baseline this prints measurements, not a pass/fail.
   --baseline rejects regressions including MRR; --require-encoder
   refuses measurements made without the encoder.
   ============================================================ */

import "./module-hook.ts";
import { readFileSync } from "node:fs";
import { compareSummary, rankOf, summarise, type Summary } from "./rag-eval.metrics.ts";

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
  cardNegatives?: { query: string }[];
}

/** Historical low-score diagnostic, not abstention: a quiet search can still return hits. */
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
  const deliveredBlueprintRanks: (number | undefined)[] = [];
  if (blueprints.length > 0) console.log(`blueprints (${blueprints.length}):`);
  for (const row of blueprints) {
    const results = await searchBlueprints(db, anonymous, { q: row.query, forks: "all" });
    encoder = results.encoder;
    const ranked = distinct(results.hits, (i) => results.hits[i].item.slug, results.encoder);
    blueprintRanks.push(rankLine("bp  ", row.query, row.expected, ranked).rank);
    deliveredBlueprintRanks.push(rankOf(results.hits.map((hit) => hit.item.slug), row.expected, false));
  }

  const negatives = file.negatives ?? [];
  let quiet = 0;
  let empty = 0;
  if (negatives.length > 0) console.log(`negatives (${negatives.length}):`);
  for (const row of negatives) {
    const results = await searchBlueprints(db, anonymous, { q: row.query, forks: "all" });
    encoder = results.encoder;
    const ranked = distinct(results.hits, (i) => results.hits[i].item.slug, results.encoder);
    const best = ranked.keys[0];
    const bestScore = best === undefined ? undefined : ranked.scoreOf.get(best);
    const isQuiet = bestScore === undefined || bestScore < MIN_SIMILARITY + NEGATIVE_MARGIN;
    if (isQuiet) quiet += 1;
    if (best === undefined) empty += 1;
    console.log(
      `  neg  ${isQuiet ? "quiet " : "LOUD  "} hits ${String(ranked.keys.length).padStart(2)}  ` +
        `top ${best === undefined ? "(nothing)" : `${best} @ ${bestScore?.toFixed(4)}`}  ${JSON.stringify(row.query)}`,
    );
  }

  const cards = file.cards ?? [];
  const cardRanks: (number | undefined)[] = [];
  const deliveredCardRanks: (number | undefined)[] = [];
  if (cards.length > 0) console.log(`cards (${cards.length}):`);
  for (const row of cards) {
    const results = await searchCards(db, anonymous, { q: row.query });
    encoder = results.encoder;
    const ranked = distinct(results.hits, (i) => results.hits[i].item.id, results.encoder);
    cardRanks.push(rankLine("card", row.query, row.expected, ranked).rank);
    deliveredCardRanks.push(rankOf(results.hits.map((hit) => hit.item.id), row.expected, false));
  }

  const cardNegatives = file.cardNegatives ?? [];
  let cardsQuiet = 0;
  let cardsEmpty = 0;
  for (const row of cardNegatives) {
    const results = await searchCards(db, anonymous, { q: row.query });
    encoder = results.encoder;
    const best = results.hits[0];
    const isQuiet = best === undefined || best.score < MIN_SIMILARITY + NEGATIVE_MARGIN;
    if (isQuiet) cardsQuiet += 1;
    if (best === undefined) cardsEmpty += 1;
    console.log(`  card neg ${isQuiet ? "quiet" : "LOUD "} hits ${results.hits.length} top ${best?.item.id ?? "(nothing)"} @ ${best?.score.toFixed(4) ?? "-"} ${JSON.stringify(row.query)}`);
  }

  const report = {
    encoder,
    blueprints: summarise(blueprintRanks),
    cards: summarise(cardRanks),
    negatives: { n: negatives.length, quiet, empty },
    cardNegatives: { n: cardNegatives.length, quiet: cardsQuiet, empty: cardsEmpty },
    delivered: { blueprints: summarise(deliveredBlueprintRanks), cards: summarise(deliveredCardRanks) },
  };

  console.log("");
  console.log(`encoder: ${encoder}`);
  if (blueprints.length > 0) console.log(line("blueprints", report.blueprints));
  if (negatives.length > 0) {
    console.log(`negatives: ${quiet}/${negatives.length} empty or below ${(MIN_SIMILARITY + NEGATIVE_MARGIN).toFixed(2)}; ${empty}/${negatives.length} actually empty`);
  }
  if (cards.length > 0) console.log(line("cards     ", report.cards));

  if (blueprints.length > 0) console.log(line("delivered blueprints", report.delivered.blueprints));
  if (cards.length > 0) console.log(line("delivered cards", report.delivered.cards));
  if (cardNegatives.length > 0) console.log(`card negatives: ${cardsQuiet}/${cardNegatives.length} quiet, ${cardsEmpty}/${cardNegatives.length} empty`);

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
      falls.push(...compareSummary(half, before[half], report[half]));
      if (before.delivered !== undefined) {
        falls.push(...compareSummary(`delivered.${half}`, before.delivered[half], report.delivered[half]));
      }
    }
    for (const half of ["negatives", "cardNegatives"] as const) {
      if (before[half] === undefined) continue;
      if (before[half].n !== report[half].n) falls.push(`${half}.n: incomparable evaluation sets`);
      if (before[half].quiet > report[half].quiet) falls.push(`${half}.quiet ${before[half].quiet} -> ${report[half].quiet}`);
      if (before[half].empty !== undefined && before[half].empty > report[half].empty) {
        falls.push(`${half}.empty ${before[half].empty} -> ${report[half].empty}`);
      }
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
