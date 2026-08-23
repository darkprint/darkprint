/* ============================================================
   T170 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── what this author could and could not see ──
   GIVEN, and read: `backend.md`'s §T170 in full with D-WAVE-01, plus
   §T005's log (D-05-02), §T240's D-240-08/09/16, §T140's D-140-02;
   `lib/db/schema.ts`; the barrels and types of
   `lib/server/{policy,accounts,observability}`; `lib/types.ts`;
   `tests/server/contract.ts`; `tests/support/**`; the merged blind
   suites under `tests/server/t140/**` and `tests/server/t240/**`.

   T170's OWN, and never opened: `lib/server/notes/**`,
   `app/api/notes/**`, the branch `feat/t170-notes`. Its implementer
   was not contacted.

   ── the pins are LITERALS ──
   Every expected string, key set and published name in this file is
   written out and never imported from `@/lib/server/notes`. An
   expectation built from the module under test asserts "does the
   module agree with itself" and goes on passing the day the module
   starts interpolating something it should not. A later change that
   derives one of these from the module is a REMOVED ASSERTION and is
   to be treated as one.

   The one deliberate exception is `statedLimit` below, and it is
   exceptional because the contract publishes NO limit to pin — see
   OPEN-2. It does not assert the module agrees with itself: it reads
   the number the module's own message states and then falsifies that
   number at both sides of the boundary, so a module whose message
   says 4000 and whose refusal starts at 2000 reds.

   ── D-05-02 GOVERNS AC4, AND D-WAVE-01 IS BEHIND IT ──
   §T170's D-WAVE-01 paragraph says T170 writes "`target_actor` rows
   with `kind = "note_vote"`" and names
   `target_actor_target_account_kind_key` as AC4's guarantee. The
   schema says the opposite, in a docblock written to say it
   (`lib/db/schema.ts:278-285`): `target_actor.target_id` references
   `target`, whose kind is `blueprint | card | term` — there is no
   `note` — so a vote recorded there is keyed per BLUEPRINT. It
   refuses an account's vote on a second note under the same
   blueprint and never notices two votes on one note. The grain is
   wrong in both directions, D-05-02 ruled it, and T005 shipped
   `note_vote` with `note_vote_note_account_key` on
   `(note_id, account_id)` FOR THIS CRITERION, its implementer
   including the discriminating case behaviourally
   (`backend.md:11957`).

   So AC4 here is `note_vote`, and this suite additionally asserts
   that T170 writes NO `target_actor` row at all. Reported to the
   orchestrator before a cell was written; the code is the later
   authority and CLAUDE.md says so in as many words.

   ── two concurrent callers, or AC4 is not tested ──
   A `SELECT`-then-`INSERT` passes every sequential test and loses
   under two callers. Every idempotence cell here drives genuine
   concurrency through `Promise.all` and asserts on the ROWS, not on
   the return value: a writer that inserts and then throws satisfies
   any `rejects.toThrow()` a reviewer would write.

   ── assert what the writer LEFT BEHIND ──
   AC6 is a TOMBSTONE, so "the row is gone" is asserting the wrong
   thing and "it threw" is asserting nothing. Every delete cell reads
   the `note` row back by raw SQL and requires it to EXIST, to carry
   `deleted_at`, and to carry a body that is physically empty IN
   STORAGE. A filter-at-read implementation passes an API-level check
   and fails that one, which is what D-WAVE-01's sentence about it is
   for.

   ── the module is bound LAST ──
   `loadNotes` is called from inside each cell, after its premises
   and its planting, and never from a hook. A hook that throws runs
   no test and adds nothing to the failed column — it moves the
   SKIPPED count, which is how a run prints green while measuring
   less than it claims. An early bind is worse still: it is correct
   about its own subject and masks every write below it, and a red in
   0ms where I/O was expected is a cell that never started.
   ============================================================ */

import { randomUUID } from "node:crypto";

import type { Actor } from "@/lib/server/policy";

import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const NOTES = "@/lib/server/notes";

/* ============================================================
   OPEN QUESTIONS — reported to the orchestrator before any cell
   was written, and NOT decided here.

   Each is recorded so a reader can tell an assertion this suite is
   entitled to make from one it invented. Where the contract is
   silent this file asserts the part that is forced and prints the
   part that is not, rather than guessing a value that would become
   a false defect report against someone who followed the contract.

   RULED-1 THE REFUSAL SURFACE, ruled on C-3 as proposed.
           AC3 and AC7 consume `NotAccountOwnerError` from
           `@/lib/server/accounts` — CONSUMED, not minted, on
           D-140-02's precedent, so the `instanceof` is against
           T050's own export and a synonym cannot satisfy it.
           AC5 rejects `NoteBodyError` with the limit in the
           message. D-13 is `NoteStoreError`, sealed, form
           `<operation>: the notes store failed.` And `deleteNote`
           stays `Promise<void>` and REJECTS on denial, because
           `void` cannot express DENIED and a silent no-op tells a
           stranger their delete worked.

   RULED-2 `MAX_NOTE_BODY = 2000`, PUBLISHED FROM T170's BARREL so
           a cell quantifies over the constant rather than putting
           a number beside a number nothing compares. Whitespace-
           only IS empty (`.trim().length === 0`). The refusal must
           STATE the limit, so the pin is
           `message.includes(String(MAX_NOTE_BODY))`.
           Marked PENDING-OWNER-REVIEW upstream — a ceiling is a
           product decision — so no cell asserts the value equals
           2000; every boundary cell derives BOTH its lengths from
           the published constant and survives the owner changing
           it.
           COUNTED IN UTF-16 CODE UNITS, not code points, and
           D-WAVE-03 states the cost rather than hiding it: 2000
           emoji is refused where 2000 letters is not. So the
           boundary cells build their bodies out of BMP characters
           whose `.length` is their count, and a separate cell
           pins the astral case at the published spelling — the
           implementer reverted a more honest code-point version
           to match the document, and a suite deriving from the
           document has to assert the same thing or that revert
           was for nothing.

   RULED-3 `postNote` RESOLVES THE PARENT AND CHECKS
           `can(actor, "read", …)` BEFORE ACCEPTING. Charged as a
           hole and ruled as behaviour rather than left as an
           inference: `canOnNote(actor, "write", …)` returns
           `author` alone and never reads `parent`
           (`lib/server/policy/can.ts`), so policy by itself grants
           any signed-in account writing a note on a private
           blueprint it cannot read.

   RULED-4 `target.note_count` is MAINTAINED, NOT DERIVED, and the
           tombstone DECREMENTS it. Not a style choice: nothing
           else writes that column, T150 may not count `note` rows
           (B-18's tombstone has one author), so a derived count
           leaves `getSignals().noteCount` permanently 0 with
           nothing redding.

   RULED-5 A TOMBSTONE OCCUPIES A PAGE SLOT, returned with
           `deleted: true` and `body: ""`. Ruled after this suite
           charged the silence: `NoteRecord.deleted` is published
           and nothing else in the surface returns a deleted
           record, so filtering at read makes that field
           unobservable through the entire published API — and
           shifts the cursor, which is what AC6 protects. The
           self-consistency disjunction this file used to carry is
           GONE rather than left standing beside the pin: an
           amendment is not applied until the text it overturns is
           removed, or a reader binds to whichever it reaches
           first.

   RULED-6 THE CURSOR CARRIES FULL-PRECISION `created_at`, and
           this is the one criterion no rule in the document
           states. `note.created_at` is `timestamptz` at
           MICROSECOND precision; `NoteRecord.createdAt` is a JS
           `Date` at MILLISECONDS. A cursor built from the
           returned record — the obvious implementation — asks for
           rows after `…956000` when the row it came from is
           `…956849`, so THAT ROW SATISFIES ITS OWN CURSOR and the
           last note of every page is the first note of the next.
           No concurrency is needed and no clock skew: ordinary
           data does it. AC2's keyset-versus-offset cell cannot
           catch it — a precision gap is not an offset — so it has
           a cell of its own.

   ── all six are now in `backend.md` §T170 (D-WAVE-03, D-WAVE-04)
   at `39ba5b1`, and the provenance clause this file used to stamp
   into every such red is deleted with them. ──

   ── ONE PIN DISAGREES WITH ITS DISPATCH, AND THE DOCUMENT WINS ──
   D-WAVE-04 as landed names AC5's class **`NoteBodyError`**. The
   dispatch that ruled C-3 named `InvalidNoteError`. Same criterion,
   two spellings, and only one of them is in the channel the
   implementer reads — so `NoteBodyError` is pinned and the other
   is recorded here rather than tried as an alternative. A candidate
   list resolving to SOMETHING is more dangerous than one resolving
   to nothing (T000's own finding), and accepting either name would
   make this cell pass against a module that published the spelling
   the document does not.

   CLOSED  THE ROUTE SURFACE — D-WAVE-02: no route surface in this
           wave, `app/api/**` dropped from all four `Owns` lines.
           `docs/architecture/seams.md` predicts SEAM-79/80/81/82
           under `/api/blueprints/{slug}/comments`,
           `/api/cards/{id}/comments` and `/api/comments/{id}/vote`,
           and SEAM-81 carries a `{ direction: 1 | -1 }` body for a
           `voteNote(db, actor, noteId)` that takes no direction —
           a downvote the contract cannot express. This suite is
           MODULE-LEVEL ONLY and invents no path.
   ============================================================ */

/* ============================================================
   The published surface, quoted so a red says where a name comes
   from rather than merely that a test wanted it.
   ============================================================ */

export const PUBLISHED = {
  listNotes:
    'listNotes(db: Db, actor: Actor, target: { kind: "blueprint" | "card"; refId: string }, ' +
    "cursor?: string): Promise<NotePage>",
  postNote:
    'postNote(db: Db, actor: Actor, target: { kind: "blueprint" | "card"; refId: string }, ' +
    "body: string): Promise<NoteRecord>",
  editNote: "editNote(db: Db, actor: Actor, noteId: string, body: string): Promise<NoteRecord>",
  deleteNote: "deleteNote(db: Db, actor: Actor, noteId: string): Promise<void>",
  voteNote: "voteNote(db: Db, actor: Actor, noteId: string): Promise<NoteRecord>",
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/** The four that change state. `listNotes` is the only reader. */
export const PUBLISHED_WRITERS: readonly PublishedName[] = [
  "postNote",
  "editNote",
  "deleteNote",
  "voteNote",
];

/**
 * `NoteRecord`'s key set, as the block publishes it. Six members, all required.
 *
 * `author` is `PublicAuthor` — T050's shape, which HAS NO `email` by construction
 * (`lib/server/accounts/types.ts`). §T170's Contract line cites `lib/types.ts:182` for the
 * row, and that is `Comment { id; author: Author; body; createdAt: string; votes }` where
 * `Author` carries `username` rather than `handle` and nothing nullable. The Published
 * signatures block is the later and narrower text and it names `PublicAuthor` outright, so
 * the citation is read as naming the OUTER field list and not the author's inner shape.
 * Reported; not assumed silently.
 */
export const NOTE_RECORD_KEYS = [
  "author",
  "body",
  "createdAt",
  "deleted",
  "id",
  "votes",
] as const;

/** `PublicAuthor`, T050's published shape. `bio` is optional and OMITTED when absent. */
export const PUBLIC_AUTHOR_REQUIRED_KEYS = [
  "avatarHue",
  "displayName",
  "handle",
  "validator",
] as const;
export const PUBLIC_AUTHOR_OPTIONAL_KEYS = ["bio"] as const;

/** `NotePage`'s key set. `cursor` is `string | null` — present and null, never absent. */
export const NOTE_PAGE_KEYS = ["cursor", "notes"] as const;

/** `VISIBLE_NOTES` — §T170's Contract states the page size in words: "Page size is 10". */
export const PAGE_SIZE = 10;

/**
 * D-240-16's member, written as a LITERAL and asserted against the `audit` ROW rather than
 * against `AuditAction`.
 *
 * `AUDIT_ACTIONS` in `lib/server/observability/types.ts` holds TWELVE members at `3290981`
 * and `note.remove` is not among them, so `AuditEntry.action` — a closed union over that
 * constant — cannot be given this string by any caller. D-240-16 rules fourteen; the file
 * has not been amended, and T170 is Forbidden from the folder that holds it (D-240-09 puts
 * the amendment on the orchestrator, at dispatch). Charged.
 *
 * Reading the `audit` table means this cell measures the criterion — "the operator can
 * remove one, AUDITED" — rather than the type, and it goes on measuring it whichever
 * commit lands the amendment.
 */
export const AUDIT_ACTION_NOTE_REMOVE = "note.remove";

/**
 * D-240-08: no member encodes the operator. An operator removing a note writes the note's
 * action with `actorKind: "operator"` — the distinction is the COLUMN. A cell expecting
 * `operator.note.remove` would red a correct implementation, so the wrong spelling is
 * written down here to be asserted ABSENT rather than left to be remembered.
 */
export const FORBIDDEN_AUDIT_SPELLINGS = [
  "operator.note.remove",
  "note.delete",
  "note.destroy",
] as const;

/* ============================================================
   The ruled refusal surface (RULED-1) and the body bound (RULED-2)

   Written as LITERALS. `NotAccountOwnerError` is the exception and
   the exception is the assertion: it is imported STATICALLY from
   `@/lib/server/accounts`, because "consumed rather than minted" is
   only a claim if the `instanceof` is against T050's own export. A
   class of the same name minted inside `lib/server/notes` satisfies
   a string comparison and fails this one, which is the whole
   difference D-140-02 ruled on.
   ============================================================ */

/** RULED-1. Consumed from `@/lib/server/accounts`, never minted here or in the module. */
export const NOT_ACCOUNT_OWNER_ERROR = "NotAccountOwnerError";

/**
 * RULED-1. T170's own, for AC5.
 *
 * `NoteBodyError` is D-WAVE-04's spelling as LANDED. The dispatch that ruled it said
 * `InvalidNoteError`; the document is the channel the implementer reads and it is the
 * later text, so this is the one pinned. Charged rather than accommodated — a list that
 * accepted both would pass against a module publishing neither of the document's names.
 */
export const NOTE_BODY_ERROR = "NoteBodyError";

/** RULED-1. T170's own, for D-13. */
export const NOTE_STORE_ERROR = "NoteStoreError";

/**
 * The fourth class, ruled in the adversary phase after this suite charged the silence.
 *
 * `listNotes` answered a MALFORMED cursor with `{ notes: [], cursor: null }` — byte-identical
 * to *this target has no notes* and to *you may not read this parent*. The last two being
 * indistinguishable is correct and deliberate (B-03, 404 over 403). The third is different
 * in kind: a reader mid-walk whose token is mangled — truncation, a URL-encoding round
 * trip, a client bug — is told **the list has ended**, and stops. A silent truncation of a
 * read, wearing the shape of a legitimate answer.
 *
 * The three live answers differ in whether a caller can tell it LOST DATA, and only one of
 * them is silent. Ruled: `listNotes` REFUSES, with a class, and `error-hygiene` moves
 * 34 -> 37 at the merge rather than 36. The message names the operation and states the
 * cursor was not one this module issued, carrying nothing of the caller's value (D-13).
 */
export const INVALID_CURSOR_ERROR = "InvalidCursorError";

/**
 * RULED-1's message form, built here and never imported from the module.
 *
 * An expectation built from the module under test asserts that the module agrees with
 * itself, and goes on passing the day the template starts interpolating a driver value —
 * which is the one thing D-13 is about.
 */
export function noteStoreFailedMessage(operation: string): string {
  return `${operation}: the notes store failed.`;
}

/**
 * RULED-2's constant, PUBLISHED from T170's barrel so the boundary cells quantify over it
 * rather than over a number written twice.
 *
 * The value is PENDING-OWNER-REVIEW upstream — a ceiling is a product decision — so no cell
 * here asserts that it equals 2000. What the cells assert is that the published constant is
 * a sane positive integer, that a body of exactly that length is ACCEPTED, that one
 * character more is REFUSED, and that the refusal STATES it. Those four survive the number
 * changing; an equality against 2000 would red the day the owner picks 4000.
 */
export const MAX_NOTE_BODY = "MAX_NOTE_BODY";

export async function bindMaxNoteBody(): Promise<number> {
  const mod = await loadNotes();
  const value = mod[MAX_NOTE_BODY];
  if (value === undefined) {
    const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
    throw new Error(
      `${NOTES} exports no \`${MAX_NOTE_BODY}\`.\n` +
        `  AC5 is "a body over the length limit or empty is refused WITH THE LIMIT STATED", ` +
        `and the limit is published from this barrel so a cell can quantify over it instead ` +
        `of hard-coding a number beside a number nothing compares.\n` +
        `  found: ${exported}\n` +
        `  backend.md §T170, D-WAVE-03.`,
    );
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `${NOTES} exports \`${MAX_NOTE_BODY}\` as ${describe_(value)} (${String(value)}); ` +
        `a character limit is a positive safe integer.`,
    );
  }
  return value;
}

/** One of T170's own error classes, bound dynamically like everything else. */
export async function bindErrorClass(name: string): Promise<new (...args: never[]) => Error> {
  const mod = await loadNotes();
  const cls = mod[name];
  if (typeof cls !== "function") {
    const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
    throw new Error(
      `${NOTES} exports no \`${name}\` class.\n` +
        `  found: ${exported}\n` +
        `  \`tests/store-modules-seal-their-faults.test.ts\` and ` +
        `\`tests/error-hygiene.test.ts\` both build their domain by construction over every ` +
        `\`lib/server/<module>/index.ts\`, so this barrel is measured against D-13's hygiene ` +
        `clause from the day it exists — and an absent class leaks by not existing.\n` +
        `  backend.md §T170, D-WAVE-04.`,
    );
  }
  return cls as new (...args: never[]) => Error;
}

/* ============================================================
   Binding
   ============================================================ */

let notes: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, so every cell that awaits it gets its own copy of the same red rather than one
 * cell's failure cascading into an unhandled rejection in the next.
 *
 * The specifier stays a literal so the `@` alias resolves.
 */
export function loadNotes(): Promise<Namespace> {
  notes ??= import("@/lib/server/notes").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${NOTES} does not load.\n` +
          `  backend.md §T170 owns \`lib/server/notes/**\` and publishes \`listNotes\`, ` +
          `\`postNote\`, \`editNote\`, \`deleteNote\` and \`voteNote\` from the barrel ` +
          `\`${NOTES}\`.\n` +
          `  This is a failed acceptance criterion — the notes module is absent — and not a ` +
          `broken test.\n` +
          `  If the barrel IS present and this still reds naming an export, read it as a ` +
          `TRANSFORM TIMEOUT before reading it as a missing member: the first import() of a ` +
          `barrel pays the whole graph's transform and can cross testTimeout, which is ` +
          `load-dependent and never reproducible on demand. Re-run the single file before ` +
          `charging anyone.`,
        { cause },
      );
    },
  );
  return notes;
}

function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Date) return `a Date (${value.toISOString()})`;
  return typeof value;
}

export { describe_ };

/** One published name, bound and kind-checked. Absent is a red and the red quotes the block. */
export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadNotes();
  const value = mod[name];
  if (value === undefined) {
    const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
    throw new Error(
      `${NOTES} exports no \`${name}\`.\n` +
        `  the contract publishes: ${PUBLISHED[name]}\n` +
        `  found: ${exported}\n` +
        `  This is a failed acceptance criterion, not a naming difference — backend.md ` +
        `§T170's Published signatures block names this export exactly.`,
    );
  }
  if (typeof value !== "function") {
    throw new Error(
      `${NOTES} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

/* ============================================================
   Outcomes — a call's whole observable answer, so a refusal can be
   compared with another refusal instead of merely being caught.
   ============================================================ */

export interface Outcome {
  settled: "value" | "rejected";
  value?: unknown;
  error?: unknown;
  /** The canonical form a pair cell compares, and the whole of what a red prints. */
  digest: string;
}

export async function outcomeOf(call: () => unknown): Promise<Outcome> {
  try {
    const value = await call();
    return { settled: "value", value, digest: `value ${JSON.stringify(value) ?? "undefined"}` };
  } catch (err) {
    const e = err as Error;
    const name = e instanceof Error ? (e.constructor?.name ?? e.name ?? "Error") : describe_(err);
    const message = typeof e?.message === "string" ? e.message : String(err);
    const own = typeof e === "object" && e !== null ? Object.keys(e).sort().join(",") : "";
    return {
      settled: "rejected",
      error: err,
      digest:
        `rejected ${name} ${JSON.stringify(message)} keys[${own}] ` +
        `json ${JSON.stringify(e) ?? "undefined"}`,
    };
  }
}

/**
 * Captures a rejection. Fails loudly if the call RESOLVED — an absent refusal is the defect,
 * and `deleteNote`'s `Promise<void>` is precisely the signature under which a silent no-op
 * looks like success to every caller (OPEN-1, D-140-02's shape).
 */
/**
 * `because` is the criterion-specific sentence, and it exists because the default was
 * WRONG on a reader.
 *
 * The first version explained every non-refusal in terms of `deleteNote`'s `Promise<void>`
 * and a silent no-op — true of the writers, and nonsense on `listNotes`, where the failure
 * is an empty page rather than an unwritten row. **A red that reports a plausible wrong
 * cause sends its reader to the wrong file**, and the reader here is a counterpart who
 * cannot see this suite. Widen what the failure SAYS; never narrow what the code accepts.
 */
export async function rejection(
  call: () => unknown,
  where: string,
  because = WRITER_SILENT_NOOP,
): Promise<unknown> {
  const outcome = await outcomeOf(call);
  if (outcome.settled === "rejected") return outcome.error;
  throw new Error(
    `${where} RESOLVED with ${describe_(outcome.value)}; the criterion says it is REFUSED.\n` +
      `  ${because}`,
  );
}

/** The default: why a WRITER answering instead of refusing is the defect. */
export const WRITER_SILENT_NOOP =
  "A writer that answers instead of refusing tells its caller the write happened. " +
  "`deleteNote` is published `Promise<void>`, so a silent no-op is indistinguishable from " +
  "success at the call site and only the STORE can tell them apart — which is why every " +
  "cell raising this also asserts the rows are unchanged.";

/** Why a READER answering instead of refusing is the defect. Different failure entirely. */
export const READER_SILENT_TRUNCATION =
  "A reader that answers instead of refusing tells its caller IT HAS ALL THE DATA. An " +
  "empty page with a null cursor is byte-identical to \"this target has no notes\", so a " +
  "reader mid-walk whose token was mangled is told the list has ended, and stops. Nothing " +
  "is unwritten here — the loss is at the read, and the module is the only party that can " +
  "tell the two apart.";

/**
 * The decimal integer a refusal states, for AC5 (OPEN-2). `undefined` when the message
 * states none, which is itself the criterion failing: "refused WITH THE LIMIT STATED".
 *
 * The largest integer in the message, not the first: a message of the form
 * "postNote: a note body is at most 4000 characters (received 100000)." states both the
 * limit and the length, and taking the first would read a limit off whichever clause the
 * implementer happened to write first.
 *
 * This does NOT assert the module agrees with itself. The number it reads is then required
 * to be the ACTUAL boundary from both sides, so a module whose message says 4000 and whose
 * refusal starts at 2000 reds on the boundary cells rather than passing this one.
 */
export function statedLimit(err: unknown, received: number): number | undefined {
  const message = err instanceof Error ? err.message : String(err);
  const numbers = [...message.matchAll(/\d+/g)]
    .map((m) => Number(m[0]))
    .filter((n) => Number.isSafeInteger(n) && n > 0 && n !== received);
  if (numbers.length === 0) return undefined;
  return Math.max(...numbers);
}

/* ============================================================
   The database each suite file owns
   ============================================================ */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the first parameter of every T170 function. */
  db: unknown;
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(`createTestDb's client carries no \`db\`; every T170 function takes one.`);
  }
  const [current] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(
      `\`select current_database()\` answered ${describe_(database)}, so this scratch ` +
        `database cannot be named — and a suite that cannot name its database cannot stamp ` +
        `what it leaves behind.`,
    );
  }
  const base = new URL(process.env.DATABASE_URL ?? "");
  base.pathname = `/${database}`;
  return {
    db,
    url: base.toString(),
    query: async (sql, params) => {
      const result = await test.client.query(sql, params as unknown[]);
      return result.rows as Record<string, unknown>[];
    },
  };
}

/** Answers how many were dropped, so a teardown that silently did nothing is visible. */
export async function dropScratchDatabases(): Promise<number> {
  let dropped = 0;
  for (const test of open.splice(0)) {
    await test.drop();
    dropped += 1;
  }
  return dropped;
}

/* ============================================================
   Actors — plain data, exactly as T060 publishes it
   ============================================================ */

export function accountActor(accountId: string, handle: string | null = null): Actor {
  return { kind: "account", accountId, handle };
}

export const ANONYMOUS: Actor = { kind: "anonymous" };

/** B-13's break-glass subject. `SessionPayload` carries no `kind`, so no route can mint one. */
export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}

export interface AnonymousShape {
  label: string;
  /** Why this shape is here, so a red says which ruling it is about. */
  because: string;
  actor: Actor;
}

/**
 * AC3 is "an anonymous post is refused", and the criterion is about the ABSENCE OF AN
 * IDENTITY rather than about one discriminant string. A module that checks
 * `actor.kind !== "anonymous"` passes the first of these and fails the rest; one that
 * delegates to `can` refuses all of them, because `isOwner` only ever grants to an
 * `account` actor carrying a non-empty id read through `Object.hasOwn`.
 *
 * An enumeration, and it says so — there is no construction over "every way of having no
 * identity".
 */
export const ANONYMOUS_SHAPES: readonly AnonymousShape[] = [
  {
    label: "the anonymous actor",
    because: "AC3, read literally: `{ kind: \"anonymous\" }`.",
    actor: ANONYMOUS,
  },
  {
    label: "an account carrying no identity at all",
    because:
      "T060: an empty-string id never matches an empty-string id — `\"\"` is what a " +
      "half-built session row and an unset column both look like, and it is an anonymous " +
      "caller wearing an account's discriminant.",
    actor: accountActor("", null),
  },
  {
    label: "the missing-session shape `{}`",
    because: "T060: `can` fails closed; `{}` is precisely the missing session.",
    actor: {} as unknown as Actor,
  },
  {
    label: "an actor INHERITING an account identity",
    because:
      "T060 N-2/N-4: authority is never inherited. A module re-implementing the check as " +
      "`actor.kind === \"account\"` grants here; one delegating to `can` denies, because " +
      "every field is read through `Object.hasOwn`.",
    actor: Object.create({
      kind: "account",
      accountId: "00000000-0000-4000-8000-00000000dead",
      handle: "ghost",
    }) as Actor,
  },
  {
    label: "an operator with no id",
    because:
      "T060: possession of a discriminant is not authority — an actor whose `kind` is " +
      "`\"operator\"` must carry a non-empty `accountId` to be one.",
    actor: { kind: "operator" } as unknown as Actor,
  },
];

/* ============================================================
   Names
   ============================================================ */

let counter = 0;

/** Unique per run and per process, so two suite files never mint the same identifier. */
export function mark(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

/** A uuid nothing in the database is keyed by. */
export function absentUuid(): string {
  return randomUUID();
}

/**
 * A token no admissible message can contain, alphanumeric on purpose. A `process.pid` can
 * contain a SQLSTATE, and a tell that can occur naturally reds like a real leak.
 */
export function plantedToken(): string {
  return `zq${randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

/* ============================================================
   STORAGE READERS — raw SQL, because the criteria are about what
   the writer LEFT BEHIND

   Every one of these goes around the module under test on purpose.
   AC4 is a unique index, AC6 is a tombstone and AC7 is a row in
   another module's table: none of the three is observable through
   the published functions alone, and a suite that only ever asks
   the module what it did is asking the defendant.

   `count(*)` comes back from `pg` as a STRING (bigint), and
   `numeric` columns do too. Both are converted here, once, so no
   cell writes `Number(row.count)` and no cell forgets to.
   ============================================================ */

function asCount(value: unknown, where: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`${where} answered ${describe_(value)}; expected a count.`);
  }
  return n;
}

/**
 * The same guard, exported, because a bare `Number(row.n)` in a cell is a NaN waiting to
 * be read as a value.
 *
 * `NaN` is a `number` to `typeof`, renders as `null` through `JSON.stringify`, and — the
 * part that bit this file — **`NaN !== 0` is TRUE**. `subMillisecondMicros` guards its own
 * premise with `micros.some((m) => m !== 0)`, so a single `NaN` would SATISFY the check
 * that proves the cell can discriminate, and the cell would then measure nothing while
 * reporting that it could. Every numeric read off a row goes through this.
 */
export function countOf(value: unknown, where: string): number {
  return asCount(value, where);
}

export interface NoteRow {
  id: string;
  accountId: string;
  targetKind: string;
  targetId: string;
  /** The bytes actually in the column. AC6 is a claim about THIS, not about a rendering. */
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

/** Every `note` row for a target, oldest first — the order AC2's keyset cursor reads them. */
export async function noteRows(
  s: Scratch,
  target: { kind: string; refId: string },
): Promise<NoteRow[]> {
  const rows = await s.query(
    "select id, account_id, target_kind, target_id, body, created_at, edited_at, deleted_at " +
      "from note where target_kind = $1 and target_id = $2 order by created_at, id",
    [target.kind, target.refId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    accountId: String(r.account_id),
    targetKind: String(r.target_kind),
    targetId: String(r.target_id),
    body: String(r.body),
    createdAt: r.created_at as Date,
    editedAt: (r.edited_at ?? null) as Date | null,
    deletedAt: (r.deleted_at ?? null) as Date | null,
  }));
}

/**
 * One `note` row by id, or `undefined`.
 *
 * The distinction this exists for is AC6's whole subject: a tombstone is a row that is
 * STILL THERE. A cell asserting `listNotes` no longer shows it cannot tell a tombstone from
 * a `DELETE FROM note`, and the two differ in exactly the way the criterion is about.
 */
export async function noteRow(s: Scratch, noteId: string): Promise<NoteRow | undefined> {
  const rows = await s.query(
    "select id, account_id, target_kind, target_id, body, created_at, edited_at, deleted_at " +
      "from note where id = $1",
    [noteId],
  );
  if (rows.length === 0) return undefined;
  const r = rows[0];
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    targetKind: String(r.target_kind),
    targetId: String(r.target_id),
    body: String(r.body),
    createdAt: r.created_at as Date,
    editedAt: (r.edited_at ?? null) as Date | null,
    deletedAt: (r.deleted_at ?? null) as Date | null,
  };
}

/** How many `note_vote` rows exist for a note — AC4's subject, at its real grain. */
export async function voteRowCount(s: Scratch, noteId: string): Promise<number> {
  const rows = await s.query("select count(*) as n from note_vote where note_id = $1", [noteId]);
  return asCount(rows[0]?.n, `count(*) over note_vote for note ${noteId}`);
}

/** Every account that has voted on a note, so a red names WHO rather than how many. */
export async function voterIds(s: Scratch, noteId: string): Promise<string[]> {
  const rows = await s.query(
    "select account_id from note_vote where note_id = $1 order by account_id",
    [noteId],
  );
  return rows.map((r) => String(r.account_id));
}

/**
 * Every `target_actor` row in the database, as `kind:target:account` strings.
 *
 * D-05-02: T170 writes NONE. This is the element-wise stamp rather than a count, because
 * equal counts are not equal state — a set of the same size with different members has
 * passed a leak check in this repository before.
 */
export async function targetActorStamp(s: Scratch): Promise<string[]> {
  const rows = await s.query(
    "select kind, target_id, account_id from target_actor order by kind, target_id, account_id",
  );
  return rows.map((r) => `${String(r.kind)}:${String(r.target_id)}:${String(r.account_id)}`);
}

export interface TargetRow {
  id: string;
  kind: string;
  refId: string;
  starCount: number;
  downloadCount: number;
  noteCount: number;
}

/** The `target` row for a `(kind, refId)`, or `undefined` if T170 never created one. */
export async function targetRow(
  s: Scratch,
  target: { kind: string; refId: string },
): Promise<TargetRow | undefined> {
  const rows = await s.query(
    "select id, kind, ref_id, star_count, download_count, note_count from target " +
      "where kind = $1 and ref_id = $2",
    [target.kind, target.refId],
  );
  if (rows.length === 0) return undefined;
  const r = rows[0];
  return {
    id: String(r.id),
    kind: String(r.kind),
    refId: String(r.ref_id),
    starCount: asCount(r.star_count, "target.star_count"),
    downloadCount: asCount(r.download_count, "target.download_count"),
    noteCount: asCount(r.note_count, "target.note_count"),
  };
}

/** How many `target` rows exist for a `(kind, refId)` — `target_kind_ref_id_key`'s subject. */
export async function targetRowCount(
  s: Scratch,
  target: { kind: string; refId: string },
): Promise<number> {
  const rows = await s.query("select count(*) as n from target where kind = $1 and ref_id = $2", [
    target.kind,
    target.refId,
  ]);
  return asCount(rows[0]?.n, "count(*) over target");
}

export interface AuditRow {
  actorId: string | null;
  actorKind: string;
  action: string;
  targetKind: string | null;
  targetId: string | null;
  decision: string;
  detail: unknown;
}

/** Every `audit` row, newest last. AC7 is satisfied by a row EXISTING, so the row is read. */
export async function auditRows(s: Scratch): Promise<AuditRow[]> {
  const rows = await s.query(
    "select actor_id, actor_kind, action, target_kind, target_id, decision, detail " +
      "from audit order by occurred_at, action",
  );
  return rows.map((r) => ({
    actorId: (r.actor_id ?? null) as string | null,
    actorKind: String(r.actor_kind),
    action: String(r.action),
    targetKind: (r.target_kind ?? null) as string | null,
    targetId: (r.target_id ?? null) as string | null,
    decision: String(r.decision),
    detail: r.detail,
  }));
}

/* ============================================================
   Page readers — `NotePage` reduced to what a cell compares

   `listNotes` is bound as `UnknownFn`, so everything it answers is
   `unknown` and nothing here may assume otherwise. These narrow it
   once, loudly, so a malformed page reds as a malformed page rather
   than as `undefined is not iterable` four lines later.
   ============================================================ */

export interface Page {
  ids: string[];
  cursor: string | null;
  records: Record<string, unknown>[];
}

export function asPage(value: unknown, where: string): Page {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} answered ${describe_(value)}; \`NotePage\` is an object.`);
  }
  const page = value as Record<string, unknown>;
  const notes = page.notes;
  if (!Array.isArray(notes)) {
    throw new Error(
      `${where}.notes is ${describe_(notes)}; the block publishes ` +
        `\`NotePage { notes: readonly NoteRecord[]; cursor: string | null }\`.`,
    );
  }
  const cursor = page.cursor;
  if (cursor !== null && typeof cursor !== "string") {
    throw new Error(
      `${where}.cursor is ${describe_(cursor)}; the block publishes \`string | null\`. ` +
        `Absent is not null: a page whose \`cursor\` key is missing renders without it, and ` +
        `a caller that reads \`page.cursor\` to decide whether to continue cannot tell ` +
        `"no more" from "the field was never sent".`,
    );
  }
  const records = notes.map((n, i) => {
    if (typeof n !== "object" || n === null || Array.isArray(n)) {
      throw new Error(`${where}.notes[${i}] is ${describe_(n)}; \`NoteRecord\` is an object.`);
    }
    return n as Record<string, unknown>;
  });
  return {
    ids: records.map((r, i) => {
      const id = r.id;
      if (typeof id !== "string" || id === "") {
        throw new Error(`${where}.notes[${i}].id is ${describe_(id)}; expected a non-empty id.`);
      }
      return id;
    }),
    cursor: cursor,
    records,
  };
}

/**
 * Walks the list and answers EACH PAGE's ids separately, plus the cursor each page handed
 * back.
 *
 * Per-page rather than flattened because the two AC2 defects live at the page BOUNDARY and
 * a flat list cannot name one: a row that satisfies its own cursor appears as the last id
 * of one page and the first of the next, and the microsecond cell has to read the
 * boundary rows' timestamps specifically to know whether it could have discriminated at
 * all.
 */
export async function walkPages(
  listNotes: UnknownFn,
  db: unknown,
  actor: Actor,
  target: { kind: string; refId: string },
  where: string,
): Promise<{ pages: string[][]; cursors: (string | null)[] }> {
  const pages: string[][] = [];
  const cursors: (string | null)[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = asPage(
      await listNotes(db, actor, target, ...(cursor === undefined ? [] : [cursor])),
      `${where} page ${pages.length + 1}`,
    );
    pages.push(page.ids);
    cursors.push(page.cursor);
    if (page.cursor === null) return { pages, cursors };
    if (pages.length > 50) {
      throw new Error(
        `${where}: the cursor did not terminate in 50 pages.\n` +
          `  A keyset cursor whose bound is not strictly past the last row it returned ` +
          `never advances, and a page that returns its own boundary row forever is the ` +
          `shape this walk is here to catch rather than to hang on.`,
      );
    }
    cursor = page.cursor;
  }
}

/**
 * The SUB-MILLISECOND part of a `note` row's `created_at`, in microseconds (0..999).
 *
 * `note.created_at` is `timestamptz` at MICROSECOND precision and `NoteRecord.createdAt` is
 * a JS `Date` at MILLISECONDS. A cursor built from the returned record — the obvious
 * implementation — asks for rows after `…956000` when the row it came from is `…956849`, so
 * that row satisfies its own cursor and the last note of a page is the first note of the
 * next. No concurrency and no clock skew: ordinary data does it.
 *
 * A cell measuring that is VACUOUS when the boundary row happens to land on a whole
 * millisecond, because truncation is then a no-op — so this exists to let the premise be
 * asserted rather than hoped for. Read in SQL rather than through the driver, because the
 * `pg` driver hands back a JS `Date` and has already truncated by the time JavaScript sees
 * it — which is the very bug, and reading the evidence through it would hide it.
 */
export async function subMillisecondMicros(s: Scratch, noteIds: readonly string[]): Promise<number[]> {
  if (noteIds.length === 0) return [];
  const rows = await s.query(
    "select id, (to_char(created_at, 'US')::int % 1000) as sub from note where id = any($1)",
    [[...noteIds]],
  );
  const bySub = new Map(
    rows.map((r) => [String(r.id), asCount(r.sub, `to_char(created_at,'US') for note ${String(r.id)}`)]),
  );
  return noteIds.map((id) => {
    const sub = bySub.get(id);
    if (sub === undefined) {
      throw new Error(
        `No \`note\` row for ${id} when reading its sub-millisecond microseconds.\n` +
          `  Returning 0 here would be worse than throwing: the caller's premise is ` +
          `\`micros.some((m) => m !== 0)\`, so a missing row would silently weaken the ` +
          `very check that proves the cell can discriminate.`,
      );
    }
    return sub;
  });
}

/**
 * Walks the whole list one page at a time and answers every id in order.
 *
 * Bounded, and the bound is an ASSERTION rather than a `break`: a cursor that never
 * terminates is a live defect (a keyset cursor built from a non-unique column loops on a
 * timestamp collision, which is exactly what `id` is the tiebreak for), and a silent
 * `break` at page 50 turns that defect into a passing test with a short answer.
 */
export async function walk(
  listNotes: UnknownFn,
  db: unknown,
  actor: Actor,
  target: { kind: string; refId: string },
  where: string,
): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  for (;;) {
    const page = asPage(
      await listNotes(db, actor, target, ...(cursor === undefined ? [] : [cursor])),
      `${where} page ${pages + 1}`,
    );
    pages += 1;
    ids.push(...page.ids);
    if (page.cursor === null) return { ids, pages };
    if (pages > 50) {
      throw new Error(
        `${where}: the cursor did not terminate in 50 pages (${ids.length} ids so far).\n` +
          `  A keyset cursor built from \`createdAt\` alone loops when two rows share a ` +
          `timestamp, which T010 measured directly at 32 concurrent inserts to 12 distinct ` +
          `timestamps — \`id\` is the tiebreak for that reason (§T170, AC2).`,
      );
    }
    cursor = page.cursor;
  }
}
