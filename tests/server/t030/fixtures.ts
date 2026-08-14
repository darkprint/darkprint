/* ============================================================
   T030 — fixtures and the database each suite owns

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── the database ──
   `createTestDb()` from `tests/support` creates a scratch database
   named `darkprint_test_<uuid>`, migrates it, and drops it on
   `drop()`. It never opens the shared development database that
   `DATABASE_URL` names; that is the whole reason T000 built it
   (D-08, two suites driving one database and racing each other's
   teardown).

   `tests/support/env.ts` carries a comment saying `tests/server/**`
   must not import it, on the grounds that the tree is "written
   blind, in a worktree branched before this file exists". T000 has
   since merged, so after `git rebase backend` the file is here and
   that reason is stale — reported, and the harness used, because
   reimplementing create-migrate-drop in nine test branches is the
   duplication the harness exists to prevent. One live consequence
   is reported with it: `testEnv()` demands all five variables, so
   this suite cannot run without `S3_ENDPOINT`, `S3_BUCKET`,
   `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` exported, and it
   never touches object storage.
   ============================================================ */

import type { OntologyTerm } from "@/lib/core";
import { type TestDb, createTestDb, resetTestDb } from "../../support";

export type { TestDb };

/** One scratch database per suite file; vitest gives each file its own worker. */
export async function openDatabase(): Promise<TestDb> {
  return createTestDb();
}

export async function clean(t: TestDb): Promise<void> {
  await resetTestDb(t.client);
}

/** What the published signatures call `db`: `Db = NodePgDatabase<typeof schema>` (`lib/db/client.ts:11`). */
export function db(t: TestDb) {
  return t.client.db;
}

/* --------------------- vocabularies --------------------- */

export function term(id: string, overrides: Partial<OntologyTerm> = {}): OntologyTerm {
  return {
    id,
    kind: "node-type",
    label: id,
    description: `The ${id} term.`,
    since: "0.1.0",
    ...overrides,
  };
}

/**
 * A compact base vocabulary. Deliberately not `CORE_ONTOLOGY`: `openView` builds the base from
 * the *stored* version's terms, so what counts as "the curated core" for
 * `ontology/local-term-unrooted` is exactly what this suite stored. A five-term base makes the
 * rooting tests state which term roots which, instead of leaning on a 49-term fixture.
 *
 * `evaluative ⊃ validation` gives the `broader` rules a chain with a middle to reach through.
 */
export const BASE_VERSION = "0.1.0";

export function baseTerms(): OntologyTerm[] {
  return [
    term("agent"),
    term("evaluative"),
    term("validation", { broader: "evaluative" }),
    term("execution-risk", { kind: "risk-marker", defaultWeight: 2 }),
    term("text", { kind: "data-type" }),
  ];
}

export const BASE_IDS = ["agent", "evaluative", "validation", "execution-risk", "text"] as const;

/* --------------------- strings that have to survive, and strings that must not --------------------- */

/**
 * Ordinary unicode. Every one of these has a UTF-8 encoding, so every one must round-trip
 * value-identically: "Do not make it a blanket unicode ban: ZWJ emoji, Arabic, CJK and combining
 * marks must still round-trip."
 */
export const WELL_FORMED = {
  zwjEmoji: "👩‍🔬👨‍👩‍👧‍👦",
  arabic: "المصطلح",
  cjk: "本体論の用語",
  combining: "égalité", // e + combining acute, not the precomposed é
  astral: "𝄞 𐀀 🜛",
  rtlMix: "term ‫معكوس‬ end",
} as const;

/**
 * Unpaired surrogates. No UTF-8 encoding exists for these, `pg` replaces them with U+FFFD, and a
 * store that accepts one holds different bytes from the ones its digest names. Refused, never
 * repaired.
 */
export const ILL_FORMED = {
  loneHigh: "\uD800",
  loneLow: "\uDFFF",
  highThenText: "prefix\uD83D suffix",
  reversedPair: "\uDC00\uD800",
} as const;

/** Not a surrogate problem, and equally unstorable: Postgres text cannot hold a NUL (22021). */
export const NUL = "before\u0000after";

/** A string no error may ever echo back, planted in a field that is not an identifier. */
export const SECRET = "SENTINEL-b6f2c1-do-not-echo";

/** A term carrying the sentinel where only the statement or a bound parameter could reach it. */
export function termWithSecret(id: string, overrides: Partial<OntologyTerm> = {}): OntologyTerm {
  return term(id, { description: `${SECRET} — ${id}`, ...overrides });
}

/**
 * A term whose `body` nests `depth` levels deep, built iteratively so the fixture itself cannot
 * be what overflows. `OntologyTerm` declares no free-form object, but `body` is `jsonb` holding
 * the whole term, and the contract's rule is about "every string reachable inside `body`".
 */
export function deeplyNestedTerm(id: string, depth: number): OntologyTerm {
  let node: Record<string, unknown> = { leaf: "bottom" };
  for (let i = 0; i < depth; i += 1) node = { next: node };
  return { ...term(id), nested: node } as unknown as OntologyTerm;
}

/** Ids in the order the store promises to read them back: sorted by `term_id`. */
export function sortedIds(terms: readonly OntologyTerm[]): string[] {
  return terms.map((t) => t.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The identifiers a caller handed over, which the error clause admits by name: "a fixed message
 * naming the operation, identifiers the **caller itself supplied**, and counts of the caller's own
 * inputs". A term's identifier is its `id` — its description is content, not an identifier, which
 * is why `SECRET` lives there and is never admissible.
 */
export function callerIdentifiers(version: string, terms: readonly { id?: unknown }[] = []): string[] {
  return [version, ...terms.map((x) => String(x.id ?? ""))].filter((x) => x !== "");
}
