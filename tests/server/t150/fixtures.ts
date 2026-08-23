/* ============================================================
   T150 — fixtures and the rows other tasks own

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── why this file writes rows T150 does not own ──
   §T150's `Owns` is `lib/server/counters/**` and `app/api/signals/**`
   and nothing else. Accounts are T050's, notes are T170's. They are
   inserted here by hand, which is test setup rather than a second
   implementation: nothing in this file decides a count, a star or a
   download.

   ── the `note` rows are the point of the D-WAVE-01 cell ──
   D-WAVE-01: "**T150 must NOT compute `noteCount` and must NOT count
   `note` rows.** B-18 makes deletion a tombstone, so the count
   excludes deleted notes — and that rule has exactly one author,
   T170. `getSignals` READS the whole `target` row, `note_count`
   included."

   So the discriminating fixture plants a `target.note_count` that
   DISAGREES with every count anybody could derive from the rows
   beside it. `plantDisagreeingNotes` writes three notes, one of them
   tombstoned, and sets the column to a fourth number. A module that
   reads the column answers that number; a module that counts all
   notes answers 3; one that counts undeleted notes answers 2; one
   that computes zero because it has never heard of notes answers 0.
   Four readings, four distinct answers, one assertion.

   The disagreement is deliberate and it is the whole instrument. A
   fixture whose column already equalled its row count would be
   satisfied by all four implementations, which is the vacuous shape
   this suite is hunting for in itself.

   ── the refIds ──
   `target.ref_id` is `text` with the grain stated per kind in
   `lib/db/schema.ts`: a bundle's is `bundle.id`, a card's is the
   BARE `cardId` and never `id@version`, a term's is the ontology
   term id. Nothing in `target` is a foreign key, so a refId here is
   a minted string rather than a seeded row — which is itself a fact
   about the contract worth stating: T150 can count a target that
   does not exist, and no published T080 reader resolves a
   `bundle.id` anyway (charged as F8).
   ============================================================ */

import { randomUUID } from "node:crypto";

import { createDbClient } from "@/lib/db";

import type { Scratch, Target, TargetKind } from "./contract";
import { dropScratchDatabases, schemaTableNames, scratchDatabase } from "./contract";

export type { Scratch };

/** One scratch database per suite file; vitest gives each file its own worker. */
export async function openDatabase(): Promise<Scratch> {
  return scratchDatabase();
}

export async function closeDatabase(): Promise<void> {
  await dropScratchDatabases();
}

/**
 * Empty every table `lib/db/schema.ts` declares, derived rather than named.
 *
 * ── this was a hand-written list of five, and the list was the hazard ──
 * It named `target_actor, target, note_vote, note, account`, which is what this suite writes.
 * Two things make that wrong rather than merely narrow. The boundary cells assert on the set of
 * tables that MOVED, and that set is derived from the whole schema — so a row in a table this
 * list does not reach is invisible to `clean` and visible to the diff. And T150 gained a fourth
 * write target after this file was written: `recordDownload` writes an `audit` row on a failed
 * counter write (`counter.write_failed`), which five names do not cover.
 *
 * `tests/support/db.ts` records this repository already paying for a hand list once: kept in
 * child-before-parent order, six tables arrived, and the list named ten. **A list that has to be
 * edited per table is a list that stops being edited** — and I wrote that sentence into
 * `contract.ts` about the snapshot domain while leaving this one hand-written.
 *
 * One `TRUNCATE` over the derived set: a single statement sees them all at once, so no foreign
 * key is momentarily violated and there is no order for a new table to be inserted into wrongly.
 * The clean set and the snapshot domain now come from the same derivation and agree by
 * construction rather than by being maintained together.
 */
export async function clean(s: Scratch): Promise<void> {
  const names = schemaTableNames()
    .map((n) => `"${n}"`)
    .join(", ");
  await s.query(`truncate table ${names} restart identity cascade`);
}

/** What the published signatures call `db`: `Db = NodePgDatabase<typeof schema>`. */
export function db(s: Scratch): unknown {
  return s.db;
}

/* --------------------- names --------------------- */

let counter = 0;

function mint(kind: string): string {
  counter += 1;
  return `t150-${kind}-${counter}-${randomUUID().slice(0, 8)}`;
}

/** A target nothing has counted yet, of the kind asked for. */
export function freeTarget(kind: TargetKind): Target {
  return { kind, refId: mint(kind) };
}

/**
 * A bare card id and a versioned ref over it, for AC7.
 *
 * The versioned form is built here rather than parsed out of a fixture because
 * `tests/server/t090/downloads.test.ts` already pins that the CALLER strips the version before
 * `recordDownload` ever sees it (`serve-card.ts:59` passes `record.cardId`). Whether T150 also
 * strips one is unruled and charged as F7, so nothing in this suite asserts on the versioned
 * form's effect — it exists so a cell can state, in a comment beside a real value, which half
 * of AC7 lives here and which half lives in T090's suite.
 */
export function cardRefPair(): { bare: string; versioned: string } {
  const bare = mint("card");
  return { bare, versioned: `${bare}@1.0.0` };
}

/* --------------------- rows T050 will one day have written --------------------- */

export async function createAccount(s: Scratch): Promise<string> {
  const github = randomUUID();
  const [row] = await s.query(
    "insert into account (github_id, github_login) values ($1, $2) returning id",
    [github, `gh-${github.slice(0, 8)}`],
  );
  return row.id as string;
}

export async function createAccounts(s: Scratch, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) ids.push(await createAccount(s));
  return ids;
}

/* --------------------- reading back what the module wrote --------------------- */

export interface TargetRow {
  id: string;
  kind: string;
  refId: string;
  starCount: string;
  downloadCount: string;
  noteCount: string;
}

/**
 * Every `target` row for one `(kind, refId)`, as an ARRAY.
 *
 * An array rather than a row because `target_kind_ref_id_key` keeping exactly one row is a
 * claim about how many exist as much as about what they hold, and a helper returning the first
 * would make a zero, a one and a two indistinguishable at the call site — which is precisely
 * the race D-WAVE-01 says a cell must drive two concurrent callers to test.
 *
 * The counts stay STRINGS here. `numeric(12,0)` is what the driver hands back and this helper
 * is the raw storage view; converting would put a second reading of the same hazard beside
 * `assertSignalState`'s, and the published-shape assertion is the one that owns it.
 */
export async function targetRows(s: Scratch, target: Target): Promise<TargetRow[]> {
  const rows = await s.query(
    "select id, kind, ref_id, star_count, download_count, note_count from target " +
      "where kind = $1 and ref_id = $2",
    [target.kind, target.refId],
  );
  return rows.map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    refId: r.ref_id as string,
    starCount: String(r.star_count),
    downloadCount: String(r.download_count),
    noteCount: String(r.note_count),
  }));
}

/** Every `target` row whose `ref_id` matches, ACROSS kinds — for the kind-distinctness cells. */
export async function targetRowsByRefId(s: Scratch, refId: string): Promise<TargetRow[]> {
  const rows = await s.query(
    "select id, kind, ref_id, star_count, download_count, note_count from target where ref_id = $1",
    [refId],
  );
  return rows.map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    refId: r.ref_id as string,
    starCount: String(r.star_count),
    downloadCount: String(r.download_count),
    noteCount: String(r.note_count),
  }));
}

export interface TargetActorRow {
  targetId: string;
  accountId: string;
  kind: string;
}

/**
 * The `target_actor` rows for one target, **scoped to `kind = 'star'` and nothing else.**
 *
 * The scope is not tidiness. D-WAVE-01 partitions this table by kind and assigns
 * `kind = "note_vote"` to T170 — while `lib/db/schema.ts:276-285` rules that `note_vote` here
 * CANNOT serve T170 and that its votes live in `note_vote` (D-05-02). The two disagree, charged
 * as F6, and under one of them T150 is this table's only writer. An assertion over the whole
 * table would be true today under either reading and would red the day anything else lands, so
 * every read here is narrowed to the rows the ruling actually gives T150.
 */
export async function starsFor(s: Scratch, targetId: string): Promise<TargetActorRow[]> {
  const rows = await s.query(
    "select target_id, account_id, kind from target_actor where target_id = $1 and kind = 'star' " +
      "order by account_id",
    [targetId],
  );
  return rows.map((r) => ({
    targetId: r.target_id as string,
    accountId: r.account_id as string,
    kind: r.kind as string,
  }));
}

/** Every `target_actor` row, of every kind, for the boundary cell that asserts the kind written. */
export async function allTargetActorRows(s: Scratch): Promise<TargetActorRow[]> {
  const rows = await s.query(
    "select target_id, account_id, kind from target_actor order by kind, account_id",
  );
  return rows.map((r) => ({
    targetId: r.target_id as string,
    accountId: r.account_id as string,
    kind: r.kind as string,
  }));
}

/* --------------------- planting a state the module must READ, not derive --------------------- */

export interface PlantedTarget {
  target: Target;
  targetId: string;
}

/**
 * A `target` row with the three counters set to exactly what is asked for.
 *
 * Written by hand rather than through `toggleStar`/`recordDownload`, because a premise built
 * from the module under test makes the cell assert that the module agrees with itself. It is
 * also the only way to plant a `note_count` at all: T150 may not write that column and T170 is
 * not merged.
 */
export async function plantTarget(
  s: Scratch,
  target: Target,
  counts: { starCount?: number; downloadCount?: number; noteCount?: number } = {},
): Promise<PlantedTarget> {
  const [row] = await s.query(
    "insert into target (kind, ref_id, star_count, download_count, note_count) " +
      "values ($1, $2, $3, $4, $5) returning id",
    [
      target.kind,
      target.refId,
      String(counts.starCount ?? 0),
      String(counts.downloadCount ?? 0),
      String(counts.noteCount ?? 0),
    ],
  );
  return { target, targetId: row.id as string };
}

/** A `target_actor` star, planted directly. The premise for "already starred" without toggling. */
export async function plantStar(s: Scratch, targetId: string, accountId: string): Promise<void> {
  await s.query(
    "insert into target_actor (target_id, account_id, kind) values ($1, $2, 'star')",
    [targetId, accountId],
  );
}

export interface DisagreeingNotes {
  planted: PlantedTarget;
  /** What the column says, and the only number a correct `getSignals` may answer. */
  column: number;
  /** What a module counting every `note` row would answer. */
  allNotes: number;
  /** What a module counting undeleted `note` rows would answer — B-18's tombstone rule. */
  liveNotes: number;
}

/**
 * A target whose `note_count` column disagrees with every count derivable from its `note` rows.
 *
 * Three notes, one of them tombstoned, and a column set to a number that is none of 0, 2 or 3.
 * See this file's header for why the disagreement is the instrument rather than an untidiness.
 *
 * `author` is created here rather than taken as a parameter so the cell that uses this cannot
 * accidentally make the note's author the same account whose `starredByCaller` it is asserting —
 * which would let a module that confuses the two pass.
 */
export async function plantDisagreeingNotes(
  s: Scratch,
  target: Target,
  column = 7,
): Promise<DisagreeingNotes> {
  const planted = await plantTarget(s, target, { noteCount: column });
  const author = await createAccount(s);
  for (const [i, deleted] of [false, false, true].entries()) {
    await s.query(
      "insert into note (account_id, target_kind, target_id, body, deleted_at) " +
        `values ($1, $2, $3, $4, ${deleted ? "now()" : "null"})`,
      [author, target.kind, target.refId, `t150 fixture note ${i}`],
    );
  }
  return { planted, column, allNotes: 3, liveNotes: 2 };
}

/* --------------------- a database that is not there --------------------- */

/**
 * A `Db` whose server refuses the connection.
 *
 * Port 1 is reserved and never listening, so `connect` fails with ECONNREFUSED before any
 * statement is sent — the one fault shape a SQLSTATE-keyed catch cannot classify, because there
 * is no SQLSTATE. `createDbClient` attaches its own pool `error` listener, so a refused
 * connection cannot take the worker down with an unhandled `EventEmitter` error.
 *
 * What this is FOR here is narrower than in other suites, and the narrowing is F2: whether
 * `recordDownload` rejects on a store fault is unruled, and T090's already-merged
 * `recordDownload` deliberately does not (`lib/server/export/downloads.ts:44-59`, ruled at
 * `a037587` — "a counter write that fails must not deny a legitimate download"). So no cell
 * here asserts that a fault throws. What they assert is what the fault LEFT BEHIND, which is
 * the same under both readings.
 */
export function deadDb(): { db: unknown; close: () => Promise<void> } {
  const client = createDbClient("postgres://darkprint:darkprint@127.0.0.1:1/darkprint");
  return {
    db: client.db,
    close: async () => {
      try {
        await client.close();
      } catch {
        /* a pool that never connected has nothing to end; teardown is not under test */
      }
    },
  };
}
