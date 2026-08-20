/* ============================================================
   T140 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── what this author could and could not see ──
   GIVEN, and read: `backend.md`'s whole preamble and its §T140,
   §T050, §T060, §T081 and §T005; `lib/db/schema.ts`; the barrels of
   `lib/server/{policy,http,auth,db,naming,archive,cards,ontology}`;
   `tests/support/**`; the merged blind suites under
   `tests/server/t0NN/`; `docs/architecture/{seams,routes}.md`.

   T140's OWN, and never opened: `lib/server/saves/**`,
   `app/api/account/saves/**`, the branch `feat/t140-saves`. Its
   implementer was not contacted.

   ── the pins are LITERALS ──
   Every expected string and every published name in this file is
   written out and never imported from `@/lib/server/saves`. An
   expectation built from the module under test asserts "does the
   module agree with itself" and passes unchanged if the module
   starts interpolating a driver value. A later change that derives
   one of these from the module is a REMOVED ASSERTION and is to be
   treated as one.

   ── the whole subject is VISIBILITY, so the instrument is a PAIR ──
   B-03 answers 404 over 403, so *no such thing* and *not yours*
   must be indistinguishable to a caller. A cell that checks one
   request cannot see that; a cell that drives the same request from
   two positions, or against two states, and requires the answers to
   be byte-identical, can. Almost every assertion about AC1 in this
   suite is written that way, and it is written that way rather than
   as a value pin ALONE for a stated reason — see D-140-01 below.

   ── the six rulings this suite binds ──
   Everything below was REPORTED from this side, ruled by the
   orchestrator, and published in §T140 itself at `fc5e4bf`. The
   sentences they replace are GONE from this file rather than left
   standing beside them: an amendment is not applied until the text
   it overturns is removed, or a reader binds to whichever it
   reaches first and that is a function of line order rather than of
   authority.

   D-140-01  `countSaves` stays `Promise<number>` and A DENIED
             CALLER GETS `0`. The block published `Promise<number>`
             beside prose saying a visitor gets "`undefined`-
             equivalent behaviour, not zero", and that prose is
             WITHDRAWN — under `Promise<number>`, *not yours*, *no
             such account* and *yours and empty* all answer 0, which
             is B-03 satisfied rather than violated. The leak AC1 is
             about is answering a non-owner the TRUE count.
             So this suite now asserts the VALUE as well as the
             indistinguishability. The pair cells are kept alongside
             the value pin and not replaced by it: a pin says what
             one answer is, and a pair says two answers cannot be
             told apart, and only the second fails on an
             implementation that leaks through a channel nobody
             pinned.

   D-140-02  THE WRITE HALF HAS A DECISION. `void` cannot express
             *denied*, so a silent no-op tells a caller its save
             succeeded when it did not. The three writers REJECT
             with `NotAccountOwnerError`, CONSUMED from
             `@/lib/server/accounts` rather than minted here. The
             readers still answer values. And T140 publishes
             `SaveStoreError` for D-13, sealed, with the form
             `<operation>: the saves store failed.` — so the
             exact-match message pin this run asks for is writable,
             and it is written.

   D-140-03  AC3's filter is PER KIND and the three are not one
             predicate. Blueprint: `visibleTo`. Card: ANY VERSION
             visible to the actor makes the card visible. Term:
             `ontology_term` has no owner and B-07 makes terms
             public, so the question is EXISTENCE IN THE CURRENT
             ONTOLOGY VERSION, not visibility. Cards ask *visible*
             and terms ask *exists*, and the asymmetry is deliberate.

   D-140-04  `seams.md`'s SEAM-61/62 rows are SUPERSEDED and the
             route surface is OWED before either half builds against
             it. So there is no route cell anywhere in this suite and
             nothing binds to that document. The route half of T140
             is held by nothing, which is D-70-12's shape named
             before the round rather than found in one.

   D-140-05  AC3's `visibleTo` is given the READING actor, not the
             save's owner. So an operator reading somebody else's
             list DOES see a save of a private target that its owner
             cannot — operator authority working, not a leak — and
             `visibility.test.ts` drives exactly that.

   D-140-06  The rejection whitelist admits the operation and the
             caller's own FIELD NAME, and NEVER the caller's own
             VALUE. Ruled toward T050's convention rather than
             T070's, because a `refId` echoed back to a non-owner is
             an existence oracle, which is the thing AC1 exists to
             close. So a caller-value leak check IS written, with a
             two-factor control showing the driver really carried
             the value.

   ── what remains unasserted, and why ──
   `listSaves` ORDERING is unpublished, and T262 renders the list.
   Set equality only; no order is pinned in either direction.

   `unsaveTarget` on a target the OWNER never saved: throw or no-op
   is undecided. Only the non-owner half is asserted, and that half
   is D-140-02's.

   Whether `savedAt` SURVIVES a repeat `saveTarget`. AC5 glosses
   idempotence as "adds only what the first did not" — a statement
   about the row SET — so `ON CONFLICT DO UPDATE SET created_at =
   now()` satisfies the contract's own gloss and a timestamp pin
   would fill a silence.

   (The never-existed target was here as unasserted and is not any
   more. D-140-07 rules the write side: `saveTarget` does not check
   that the target exists, because a write-time existence check on a
   polymorphic target is the oracle AC1 closes. It is now driven
   from both ends — the module cell in `visibility.test.ts` and the
   200 in `routes.test.ts`.)

   Whether `<operation>` in either message form is the published
   function's own name. It is READ that way — the convention
   `archive`, `naming`, `accounts` and `registry` have all shipped —
   and the reading is asserted in cells OF ITS OWN, separately from
   the class assertions, so a red on the wording is diagnosable as a
   naming question instead of taking a ruled class cell down with it.

   ============================================================ */

import { randomUUID } from "node:crypto";
import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { schema, type DbClient } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const SAVES = "@/lib/server/saves";

let saves: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, so every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 *
 * Called from inside each test and never from a `beforeAll` hook. A hook that throws runs no
 * test and adds nothing to the failed column — it moves the SKIPPED count instead, which is
 * the third of the three ways a run prints green while measuring less than it claims.
 */
export function loadSaves(): Promise<Namespace> {
  saves ??= import("@/lib/server/saves").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${SAVES} does not load.\n` +
          `  backend.md §T140 owns \`lib/server/saves/**\` and publishes \`listSaves\`, ` +
          `\`saveTarget\`, \`unsaveTarget\`, \`countSaves\` and \`migrateLocalSaves\` from the ` +
          `barrel \`${SAVES}\`.\n` +
          `  This is a failed acceptance criterion — the saves module is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return saves;
}

/* ============================================================
   What the contract publishes, quoted verbatim

   The Published signatures block of backend.md §T140, so a red
   says where a name comes from rather than merely that a test
   wanted it.
   ============================================================ */

export const PUBLISHED = {
  listSaves: "listSaves(db: Db, actor: Actor, accountId: string): Promise<readonly SaveRecord[]>",
  saveTarget:
    'saveTarget(db: Db, actor: Actor, accountId: string, target: { kind: "blueprint" | "card" | "term"; refId: string }): Promise<void>',
  unsaveTarget:
    'unsaveTarget(db: Db, actor: Actor, accountId: string, target: { kind: "blueprint" | "card" | "term"; refId: string }): Promise<void>',
  countSaves: "countSaves(db: Db, actor: Actor, accountId: string): Promise<number>",
  migrateLocalSaves:
    'migrateLocalSaves(db: Db, actor: Actor, accountId: string, targets: readonly { kind: "blueprint" | "card" | "term"; refId: string }[]): Promise<void>',
} as const;

export type PublishedName = keyof typeof PUBLISHED;
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * Readers and writers, DERIVED from the published text rather than partitioned by hand.
 *
 * A published signature ending in `Promise<void>` answers nothing, so it is a writer; anything
 * else hands the caller data and is a reader. Deriving it is what makes the quantified privacy
 * sweep in `privacy.test.ts` a construction over the published surface instead of a list
 * somebody typed — and `surface.test.ts` asserts the partition is TOTAL, so the day the block
 * gains a sixth function the loop covers it or the guard reds. Both halves are asserted
 * non-empty there too: a partition that silently collapses to one side would make every cell
 * on the other side vacuous while the counts still looked plausible.
 */
export const PUBLISHED_READERS = PUBLISHED_NAMES.filter(
  (name) => !PUBLISHED[name].endsWith("Promise<void>"),
);
export const PUBLISHED_WRITERS = PUBLISHED_NAMES.filter((name) =>
  PUBLISHED[name].endsWith("Promise<void>"),
);

/**
 * Exactly the keys `SaveRecord` publishes, and none is optional — the block writes
 * `interface SaveRecord { targetKind: ...; refId: string; savedAt: Date }` with no `?` on any
 * member, so all three are required and a fourth is not published.
 *
 * Note the deliberate asymmetry the block carries and this suite pins on both sides: the
 * RECORD names the kind `targetKind`, while the `target` PARAMETER of `saveTarget`,
 * `unsaveTarget` and `migrateLocalSaves` names it `kind`. Two spellings of one concept, both
 * published, so both are bound exactly. A module that answers `{ kind, refId, savedAt }` has
 * not published `SaveRecord`.
 */
export const SAVE_RECORD_KEYS = ["refId", "savedAt", "targetKind"] as const;

/**
 * The three target kinds, as the block writes them, in the block's own order.
 *
 * `surface.test.ts` compares this literal against `schema.targetKind.enumValues` IN BOTH
 * DIRECTIONS. Deriving the domain from the schema alone would make this suite robust to the
 * schema changing and BLIND to it disagreeing with the contract — those are opposite
 * properties of one choice, and a derived fill answers "what must I supply?" and never "is
 * that what was published?". So the contract's triple is written out and the schema's is
 * measured, and the loops below run over the derived set.
 */
export const PUBLISHED_KINDS = ["blueprint", "card", "term"] as const;
export type TargetKind = (typeof PUBLISHED_KINDS)[number];

/** What `lib/db/schema.ts` actually declares, read through drizzle rather than restated. */
export function schemaTargetKinds(): readonly string[] {
  return schema.targetKind.enumValues;
}

export interface Target {
  kind: TargetKind;
  refId: string;
}

/* ============================================================
   The two error classes, and the two message forms

   D-140-02 splits them and the split is the ruling's whole content:
   the module PUBLISHES `SaveStoreError` for D-13, and CONSUMES
   `NotAccountOwnerError` from `@/lib/server/accounts` rather than
   minting a second class for one decision. So one is bound from
   T140's barrel and the other from T050's, and binding them from
   different places is not an accident of where they live — it is
   the assertion that T140 did not mint its own.

   Both forms are LITERALS here. `<operation>` is read as the
   published function's own name, which is the convention `archive`
   (`${operation}: the write failed.`), `accounts`
   (`${operation}: the account store failed.`) and `registry`
   (D-81-01) have all shipped. That reading is asserted in cells of
   its own, kept separate from the class assertions, so a red on the
   wording is diagnosable as a naming question rather than taking a
   ruled class cell down with it.
   ============================================================ */

/** Published BY T140, per D-140-02. Bound from `@/lib/server/saves`. */
export const SAVE_STORE_ERROR = "SaveStoreError";

/** CONSUMED from T050, per D-140-02. Bound from `@/lib/server/accounts`, deliberately. */
export const NOT_ACCOUNT_OWNER_ERROR = "NotAccountOwnerError";

export const MESSAGE_FORMS = {
  SaveStoreError: "<operation>: the saves store failed.",
  NotAccountOwnerError: "<operation>: not this account's owner.",
} as const;

/** `"saveTarget: the saves store failed."` — built here, never imported from the module. */
export function storeFailedMessage(operation: string): string {
  return `${operation}: the saves store failed.`;
}

/** `"saveTarget: not this account's owner."` — T050's published form, quoted verbatim. */
export function notAccountOwnerMessage(operation: string): string {
  return `${operation}: not this account's owner.`;
}

/**
 * What D-140-01 rules a DENIED READER answers, per published name.
 *
 * `countSaves` answers `0` and `listSaves` answers an empty list. Written out rather than
 * derived from the module, and quantified over the readers so a sixth one cannot be added
 * without deciding what it answers a caller who may not see it.
 */
export const DENIED_READER_ANSWER: Record<string, unknown> = {
  listSaves: [],
  countSaves: 0,
};

/* --------------------- binding --------------------- */

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Date) return "a Date";
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${SAVES} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. backend.md's §T140 ` +
      `Published signatures block names this export exactly, and "the contract must name the ` +
      `interface, not only the behaviour" is why. Do not add a synonym here; publish the name ` +
      `the contract states.`,
  );
}

function asFn(value: unknown, name: string, clause: string): UnknownFn {
  if (typeof value !== "function") {
    throw new Error(
      `${SAVES} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/**
 * `SaveStoreError`, bound from T140's own barrel by the name D-140-02 publishes.
 *
 * Bound dynamically like everything else here: a static value import of an absent module fails
 * the whole file at collection, which reports one red where the protocol asks for one per
 * criterion. `NotAccountOwnerError` is deliberately NOT bound this way — it is imported
 * statically from `@/lib/server/accounts`, because "consumed rather than minted" is only an
 * assertion if the `instanceof` is against T050's own export.
 */
export async function bindSaveStoreError(): Promise<new (...args: never[]) => Error> {
  const mod = await loadSaves();
  const cls = mod[SAVE_STORE_ERROR];
  if (typeof cls !== "function") {
    const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
    throw new Error(
      `${SAVES} exports no \`${SAVE_STORE_ERROR}\` class.\n` +
        `  D-140-02 publishes it for D-13, sealed, with the message form ` +
        `\`${MESSAGE_FORMS.SaveStoreError}\`.\n` +
        `  found: ${exported}\n` +
        `  \`tests/store-modules-seal-their-faults.test.ts\` also requires it: a lib/server ` +
        `module importing @/lib/db and publishing no error class lets whatever the driver ` +
        `throws escape as-is, and an absent class leaks by not existing.`,
    );
  }
  return cls as new (...args: never[]) => Error;
}

/** The five function bindings. `SaveRecord` is a type and is bound at compile time instead. */
export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadSaves();
  return asFn(requireFrom(mod, name, PUBLISHED[name]), name, PUBLISHED[name]);
}

/* ============================================================
   `SaveRecord`, asserted as a KEY SET over the rendering

   T050's AC2 lesson, applied to a shape whose whole job is to be
   the only thing an owner receives: checking one field asserts
   that today's extra is absent, where checking the key set asserts
   that nothing outside the published shape is present at all.

   Over the RENDERING, because `JSON.stringify` drops an
   `undefined`-valued key and keeps a `null`-valued one, and a
   consumer of `GET /api/account/saves` receives the rendering. All
   three members are required and none is nullable, so a record
   rendering with two keys has not published `SaveRecord` however
   the object was built.
   ============================================================ */

export function rendered(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (text === undefined) {
    throw new Error(`the value does not survive JSON.stringify: ${describe_(value)}`);
  }
  return JSON.parse(text) as unknown;
}

export function assertSaveRecordKeys(value: unknown, where: string): Record<string, unknown> {
  const shape = rendered(value);
  if (typeof shape !== "object" || shape === null || Array.isArray(shape)) {
    throw new Error(`${where} renders as ${describe_(shape)}; \`SaveRecord\` is an object.`);
  }
  const keys = Object.keys(shape).sort();
  const expected = [...SAVE_RECORD_KEYS];
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
    throw new Error(
      `${where} does not render as \`SaveRecord\`.\n` +
        `  published: ${expected.join(", ")} (all three required, none optional)\n` +
        `  rendered:  ${keys.join(", ")}\n` +
        `  The block spells the record's kind \`targetKind\` and the \`target\` parameter's ` +
        `kind \`kind\`. Both spellings are published and both are bound exactly.`,
    );
  }
  return shape as Record<string, unknown>;
}

/** A `SaveRecord`'s identity for set comparison. `savedAt` is deliberately not part of it. */
export function targetOf(record: unknown, where: string): string {
  const shape = assertSaveRecordKeys(record, where);
  const kind = shape.targetKind;
  const refId = shape.refId;
  if (typeof kind !== "string" || typeof refId !== "string") {
    throw new Error(
      `${where} renders \`targetKind\`=${describe_(kind)} and \`refId\`=${describe_(refId)}; ` +
        `the block publishes both as strings.`,
    );
  }
  if (!(PUBLISHED_KINDS as readonly string[]).includes(kind)) {
    throw new Error(
      `${where} renders \`targetKind\`=${JSON.stringify(kind)}, which the block does not ` +
        `publish. Published: ${PUBLISHED_KINDS.join(", ")}.`,
    );
  }
  return `${kind}:${refId}`;
}

/** The whole list as a sorted set of `kind:refId`, which is what AC4 and AC5 compare. */
export function targetSetOf(value: unknown, where: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${where} answered ${describe_(value)}; the block publishes ` +
        `\`Promise<readonly SaveRecord[]>\`.`,
    );
  }
  return value.map((r, i) => targetOf(r, `${where}[${i}]`)).sort();
}

/* ============================================================
   `outcomeOf` — the instrument AC1 actually needs

   A leak is a DIFFERENCE between two answers, so the cell has to
   compare two answers — and after D-140-02 the published surface
   refuses in TWO DIFFERENT WAYS. The readers answer a value to a
   denied caller (`0`, a frozen `[]`); the three writers REJECT,
   because `void` cannot express *denied*. A comparison that only
   handles resolution cannot run against the writers and one that
   only handles rejection cannot run against the readers, so both
   are captured into one canonical string and compared byte for
   byte, and one sweep quantifies over the whole surface.

   That is also why the pair cells are KEPT alongside D-140-01's
   value pin rather than replaced by it. A pin says what one answer
   is. A pair says two answers cannot be told apart — which still
   fails on a module that leaks through a channel nobody pinned, and
   an extension member, a header or a differing rejection are all
   channels nobody pinned. T081's F1 is the standing example: its
   key-set whitelist was the strongest instrument in the task and it
   was a whitelist over the BODY, so a driver code on a response
   header reddened nothing.

   Deliberately NOT included: the stack. It carries this file's own
   line numbers, which differ between two call sites for reasons
   that are nothing to do with the subject, and a comparison that
   can only fail is worth as little as one that can only pass.
   ============================================================ */

export interface Outcome {
  settled: "value" | "rejected";
  /** The canonical form the pair cells compare, and the whole of what a red prints. */
  digest: string;
}

/*
 * `() => unknown`, not `() => Promise<unknown>`, and the widening is forced by the binding
 * discipline rather than being a convenience. Every published function is bound through `bind`,
 * which types it as `UnknownFn` because the module is absent when this suite is written — so a
 * call site's expression is `unknown` and nothing here may assume otherwise. Awaiting a value
 * that is already settled is a no-op, so this covers a function that answers synchronously too,
 * which is itself a shape the block does not forbid.
 */
export async function outcomeOf(call: () => unknown): Promise<Outcome> {
  try {
    const value = await call();
    return { settled: "value", digest: `value ${JSON.stringify(value) ?? "undefined"}` };
  } catch (err) {
    const e = err as Error;
    const name = e instanceof Error ? (e.constructor?.name ?? e.name ?? "Error") : describe_(err);
    const message = typeof e?.message === "string" ? e.message : String(err);
    const own = typeof e === "object" && e !== null ? Object.keys(e).sort().join(",") : "";
    return {
      settled: "rejected",
      digest:
        `rejected ${name} ${JSON.stringify(message)} keys[${own}] ` +
        `json ${JSON.stringify(e) ?? "undefined"}`,
    };
  }
}

/**
 * The pair assertion. Two calls that a caller must not be able to tell apart, told apart.
 *
 * The `where` strings name what each side WAS, so a red reads as the leak it is rather than
 * as two strings that differ.
 */
export function assertIndistinguishable(
  a: Outcome,
  b: Outcome,
  labels: { a: string; b: string; because: string },
): void {
  if (a.digest === b.digest) return;
  throw new Error(
    `A caller can tell these two apart, and AC1 says it cannot.\n` +
      `  ${labels.a}\n    ${a.digest.slice(0, 400)}\n` +
      `  ${labels.b}\n    ${b.digest.slice(0, 400)}\n` +
      `  ${labels.because}\n` +
      `  B-03: a private resource the caller may not see answers 404, never 403, so ` +
      `existence does not leak. Two answers that differ ARE the 403.`,
  );
}

/* ============================================================
   D-13 over the OUTPUT

   D-140-02 publishes the form, so the strongest pin this run asks
   for IS writable and it is written: `message` equals
   `<operation>: the saves store failed.`, as a LITERAL built here
   and never imported from the module. An expectation built from
   the module under test asserts that the module agrees with itself
   and passes unchanged the day the template starts interpolating a
   driver value.

   The pin does not retire the scans, and asking what survives it is
   how that was decided rather than assumed. An exact-match on
   `message` says nothing about `String(err)`, about
   `JSON.stringify(err)`, about own enumerable keys, or about a
   rejection that is not a `SaveStoreError` at all — and D-140-06's
   caller-VALUE check reaches a channel the pin structurally cannot,
   because a message equal to a fixed string is only pinned for the
   paths that produce that string.

   So three instruments, and they fail differently: the exact pin,
   a deny list of the driver's own prose (which cannot see a value
   the statement does not contain — T081's AC3 scan stayed green on
   a document carrying `"sqlstate":"ECONNREFUSED"` for exactly that
   reason), and a PROVENANCE check on values minted here whose only
   route into a rendering is the module putting them there.
   ============================================================ */

export interface Renderings {
  message: string;
  string: string;
  json: string;
  detail: string;
  ownKeys: string[];
}

/** Every way an error reaches a log or a response body, collected in one place. */
export function renderingsOf(err: unknown): Renderings {
  const e = err as Error;
  return {
    message: typeof e?.message === "string" ? e.message : String(err),
    string: String(err),
    json: JSON.stringify(e) ?? "undefined",
    detail: JSON.stringify({ detail: (e as { message?: unknown })?.message }),
    ownKeys: typeof e === "object" && e !== null ? Object.keys(e) : [],
  };
}

/**
 * The four clauses of D-13's hygiene rule, asserted locally rather than left to
 * `tests/error-hygiene.test.ts`.
 *
 * Not duplication, and the mechanism matters because a true conclusion recorded with the wrong
 * mechanism propagates the mechanism. `error-hygiene`'s domain is `git ls-tree -d backend
 * lib/server/` — the shipped DIRECTORIES — not the shipped classes. `lib/server/saves` is on
 * neither list, so its barrel is never imported and its classes are never discovered: the
 * guard's domain over this module is empty because the DIRECTORY has not shipped, and it stays
 * empty however many classes T140 publishes, right up to the merge commit.
 *
 * `tests/store-modules-seal-their-faults.test.ts` reads the same shipped tree and sees only
 * whether a class EXISTS, never what it renders as. So neither repo-wide guard can observe
 * D-13's four clauses over this module today, which is why they are asserted here.
 */
export function assertSealed(err: unknown, where: string): void {
  const e = err as Error;
  if (!(e instanceof Error)) {
    throw new Error(`${where} rejected with ${describe_(err)}, not an Error.`);
  }
  const keys = Object.keys(e);
  if (keys.length !== 0) {
    throw new Error(
      `${where}: \`Object.keys\` is ${JSON.stringify(keys)}, expected []. B-21: the hygiene ` +
        `clause wins over the field it forbids.`,
    );
  }
  if (JSON.stringify(e) !== "{}") {
    throw new Error(`${where}: \`JSON.stringify\` is ${JSON.stringify(e)}, expected \`{}\`.`);
  }
  if (typeof e.stack !== "string" || e.stack === "") {
    throw new Error(
      `${where}: \`stack\` is ${describe_(e.stack)}. The clause requires it RETAINED — this is ` +
        `the one part of D-13 that is not a statement about enumerability, so a class deleting ` +
        `\`stack\` still renders as \`{}\` and passes every repo-wide guard.`,
    );
  }
  if (Object.prototype.hasOwnProperty.call(e, "cause") && e.propertyIsEnumerable("cause")) {
    throw new Error(`${where}: \`cause\` is enumerable, so \`JSON.stringify\` can reach it.`);
  }
}

/**
 * The driver's own prose and machinery, which no rendering may carry (D-13).
 *
 * Every tell is anchored on something only the driver emits, and the SQL verbs carry the
 * QUOTED IDENTIFIER that follows them rather than standing alone. That is deliberate and it is
 * the T-04 lesson pointed the other way: a bare `update ` or `select ` would match a perfectly
 * admissible message — "saveTarget: could not update the save." — and red a correct
 * implementation exactly the way a SQLSTATE tell redded on a fixture's own pid. Drizzle quotes
 * every identifier it emits, so `from "` is the driver and `from the` is prose.
 *
 * And this list is only HALF the instrument. A deny set derived from the statement cannot see a
 * value the statement does not contain — T081's AC3 scan stayed green on a document carrying
 * `"sqlstate":"ECONNREFUSED"` for exactly that reason. `assertNoConnectionValue` is the other
 * half and it works by provenance rather than by enumeration.
 */
const DRIVER_TELLS = [
  "Failed query",
  "DrizzleQueryError",
  'from "',
  'into "',
  'update "',
  'relation "',
  "on conflict",
  "params:",
  "duplicate key value",
  "violates unique constraint",
  "ECONNREFUSED",
  "password authentication failed",
  "23505",
  "23503",
  "22P02",
  "22021",
  "28P01",
  "42P01",
  "postgresql://",
  "postgres://",
];

export function assertNoDriverProse(err: unknown, where: string): void {
  const r = renderingsOf(err);
  const haystack = `${r.message}\n${r.string}\n${r.json}\n${r.detail}\n${r.ownKeys.join(",")}`;
  const lowered = haystack.toLowerCase();
  const hit = DRIVER_TELLS.find((t) => lowered.includes(t.toLowerCase()));
  if (hit !== undefined) {
    throw new Error(
      `${where}: a rendering carries the driver tell \`${hit}\`.\n` +
        `  D-13: the driver error travels on \`cause\`, which is non-enumerable, and reaches no ` +
        `rendering. A DrizzleQueryError's own message opens with the full query and every ` +
        `bound parameter.\n` +
        `  message: ${r.message.slice(0, 300)}`,
    );
  }
}

/**
 * A value that could only have arrived from the driver, by PROVENANCE rather than by a list.
 *
 * The deny list above is derived from the statement, and T081's AC3 scan stayed green on a
 * document verifiably carrying `"sqlstate":"ECONNREFUSED"` because a SQLSTATE is in neither the
 * statement nor its parameters. This half is what sees that class.
 *
 * ONE caller supplies a token that works, and stating which is the whole of why this is not
 * decoration. `hygiene.test.ts`'s AUTHENTICATION axis mints a random ROLE NAME, which the
 * server puts into its own message and which appears in no statement and no bound parameter.
 * A random PASSWORD or DATABASE NAME does NOT work and this function is not given one: pg
 * reports a refused connection as `connect ECONNREFUSED 127.0.0.1:1` and carries neither, so
 * asserting their absence would be a guard that cannot fail — measured before it was written
 * rather than discovered after, and the closed-port axis leans on the deny set instead.
 *
 * A random token cannot over-match the way T-04's SQLSTATE tells matched a fixture's own pid,
 * because the only route from one into a rendering is the module putting it there.
 */
export function assertNoConnectionValue(
  err: unknown,
  secrets: readonly string[],
  where: string,
): void {
  const r = renderingsOf(err);
  for (const [name, text] of [
    ["message", r.message],
    ["String(err)", r.string],
    ["JSON.stringify(err)", r.json],
    ["JSON.stringify({detail})", r.detail],
    ["own keys", r.ownKeys.join(",")],
  ] as const) {
    const hit = secrets.find((s) => text.includes(s));
    if (hit !== undefined) {
      throw new Error(
        `${where}: a value from the CONNECTION STRING reached \`${name}\`.\n` +
          `  The token is random and minted by this suite, so it can only have arrived from ` +
          `the driver error. D-13 puts the driver error on \`cause\` and nowhere else.\n` +
          `  ${name}: ${text.slice(0, 300)}`,
      );
    }
  }
}

/** Captures a rejection. Fails loudly if the call RESOLVED — an absent refusal is the defect. */
export async function rejection(call: unknown, where: string): Promise<unknown> {
  let resolved: unknown;
  try {
    resolved = await call;
  } catch (err) {
    return err;
  }
  throw new Error(
    `${where} RESOLVED with ${describe_(resolved)}; a store that cannot answer is not an answer.\n` +
      `  Every published T140 function takes \`db: Db\`, so a store fault is reachable from all ` +
      `five, and D-13 is about what the refusal carries — not about whether one arrives.`,
  );
}

/* ============================================================
   The database each suite owns
   ============================================================ */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the first parameter of every T140 function. */
  db: unknown;
  /** This scratch database's connection string. */
  url: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(`createTestDb's client carries no \`db\`.`);
  }
  const [current] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const database = current?.name;
  if (typeof database !== "string" || database === "") {
    throw new Error(
      `\`select current_database()\` answered ${describe_(database)}, so this scratch database ` +
        `cannot be named.`,
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

export async function dropScratchDatabases(): Promise<number> {
  let dropped = 0;
  for (const test of open.splice(0)) {
    await test.drop();
    dropped += 1;
  }
  return dropped;
}

/* ============================================================
   Actors

   Plain data, exactly as T060 publishes it. The non-owner list is
   an enumeration and it says so — there is no construction over
   "every way of not being the owner". What each member is FOR is
   written beside it, because an actor shape with no stated reason
   is the first thing a later reader deletes as redundant.
   ============================================================ */

export function accountActor(accountId: string, handle: string | null = null): Actor {
  return { kind: "account", accountId, handle };
}

export const ANONYMOUS: Actor = { kind: "anonymous" };

/**
 * B-13's break-glass subject. Reachable only in-process — `SessionPayload` carries no `kind`,
 * so no route can mint one — which is exactly why AC1 naming it makes the cell live.
 */
export function operatorActor(accountId: string): Actor {
  return { kind: "operator", accountId };
}

export interface NonOwner {
  label: string;
  /** Why this shape is here, so a red says which ruling it is about. */
  because: string;
  actor: (ownerId: string) => Actor;
}

/**
 * Every shape that is NOT the owner and not the operator, and which a wrong implementation
 * would plausibly grant.
 *
 * The last three are the discriminators between a module that DELEGATES to `can` and one that
 * RE-IMPLEMENTS ownership as `actor.accountId === accountId`. That is the audit this run ends
 * on — *what does this code re-implement rather than delegate* — and it is only measurable
 * with an actor whose identity is real but not its OWN, which T060 already ruled on twice.
 */
export const NON_OWNERS: readonly NonOwner[] = [
  {
    label: "an anonymous caller",
    because: "AC1: a save is invisible to every caller but its owner and the operator.",
    actor: () => ANONYMOUS,
  },
  {
    label: "a different signed-in account",
    because: "AC1: a signed-in visitor is still not the owner.",
    actor: () => accountActor(`00000000-0000-4000-8000-${"0".repeat(11)}1`, "stranger"),
  },
  {
    label: "an account carrying no identity at all",
    because:
      "T060: an empty-string id never matches an empty-string id — `\"\"` is what a half-built " +
      "session row and an unset column both look like.",
    actor: () => accountActor("", null),
  },
  {
    label: "the missing-session shape `{}`",
    because: "T060: `can` and `visibleTo` fail closed; `{}` is precisely the missing session.",
    actor: () => ({}) as unknown as Actor,
  },
  {
    label: "an actor INHERITING the owner's id",
    because:
      "T060 N-2/N-4: authority is never inherited. A module re-implementing ownership as " +
      "`actor.accountId === accountId` grants here; one delegating to `can` denies, because " +
      "`isOwner` reads both fields through `Object.hasOwn`.",
    actor: (ownerId) =>
      Object.create({ kind: "account", accountId: ownerId, handle: null }) as Actor,
  },
  {
    label: "an actor INHERITING operator authority",
    because: "T060 N-2: `Object.create({kind:\"operator\",accountId:\"x\"})` is not an operator.",
    actor: () => Object.create({ kind: "operator", accountId: "op" }) as Actor,
  },
  {
    label: "an operator with no id",
    because:
      "T060: possession of a discriminant is not authority — an actor whose `kind` is " +
      "`\"operator\"` must carry a non-empty `accountId` to be one.",
    actor: () => ({ kind: "operator" }) as unknown as Actor,
  },
];

/* --------------------- names --------------------- */

let counter = 0;

/** Unique per run and per process, so two suite files never mint the same identifier. */
export function mark(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

/**
 * A token no admissible message can contain, alphanumeric on purpose.
 *
 * T-04's SQLSTATE tells over-matched because a fixture's `process.pid` could contain `23505`,
 * and a tell that can occur naturally reds like a real leak. A 22-character random token
 * cannot arrive in a rendering except by something putting it there.
 */
export function plantedToken(): string {
  return `zq${randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

/** A uuid nothing in the database is keyed by. Used as an account id that names no account. */
export function absentUuid(): string {
  return randomUUID();
}


/* ============================================================
   D-140-07 — the route surface, published after the 176 module
   cells were written and read here from the block rather than
   from the message that announced it

   Four routes over ONE request shape, and that shape is
   `saveTarget`'s own `target` parameter, so the route translates
   nothing. `SEAM-61`/`SEAM-62`'s compound key space is WITHDRAWN
   rather than mapped, and nothing in this suite has ever bound to
   it.

   ── what is FORBIDDEN to assert here, by the ruling ──
   A 403. Every route passes `session.accountId`, so
   `NotAccountOwnerError` compares an id against itself and cannot
   arise. **AC1's non-owner denial is unreachable from HTTP in this
   task, and its absence from the status lines is not evidence that
   the denial is untested** — it is held by the 70 module pairs in
   `privacy.test.ts`, and this sentence is here so a later reader
   does not go looking for it in the wrong file.

   A 404 on a write. `saveTarget` does not check that the target
   exists, deliberately: 404 for a private blueprint against 200 for
   a public one names which private slugs are real, which is the
   oracle AC1 exists to close. A cell expecting 404 would be
   asserting the leak.

   ── and one clause that is UNOBSERVABLE through the transport ──
   "`count` comes from `countSaves`, never from `saves.length`."
   Against a correct module the two are equal in every state, so a
   route computing `saves.length` is an EQUIVALENT MUTANT through
   the wire and no cell here can separate them. What IS observable
   is the agreement itself in a single response, which is what the
   extra query is paid for, so that is what is asserted — and the
   provenance clause is recorded as held by nothing rather than
   left to look covered.
   ============================================================ */

export const PROBLEM_BASE = "https://darkprint.io/problems";

export interface SavesRoute {
  method: string;
  path: string;
  /** The published request body, or `undefined` where the route publishes none. */
  body: (target: Target) => unknown;
}

export const ROUTES = {
  list: { method: "GET", path: "/api/account/saves", body: () => undefined },
  save: { method: "POST", path: "/api/account/saves", body: (t: Target) => ({ ...t }) },
  unsave: { method: "DELETE", path: "/api/account/saves", body: (t: Target) => ({ ...t }) },
  migrate: {
    method: "POST",
    path: "/api/account/saves/migrate",
    body: (t: Target) => ({ targets: [{ ...t }] }),
  },
} as const satisfies Record<string, SavesRoute>;

export type RouteName = keyof typeof ROUTES;
export const ROUTE_NAMES = Object.keys(ROUTES) as RouteName[];
/** The three that publish a body, derived from the table rather than listed beside it. */
export const WRITE_ROUTE_NAMES = ROUTE_NAMES.filter(
  (n) => ROUTES[n].body({ kind: "blueprint", refId: "x" }) !== undefined,
);

/** Exactly the keys `SavesView` publishes. */
export const SAVES_VIEW_KEYS = ["count", "saves"] as const;

const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;
const SAVES_ROOT = fileURLToPath(new URL("../../../app/api/account/saves/", import.meta.url));

interface DiscoveredRoute {
  pattern: string;
  file: string;
}

function walk(dir: string, segments: string[], out: DiscoveredRoute[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // a tree the implementation has not created yet
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walk(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      const suffix = segments.length > 0 ? `/${segments.join("/")}` : "";
      out.push({ pattern: `/api/account/saves${suffix}`, file: join(dir, entry.name) });
    }
  }
}

/**
 * The route table, walked rather than guessed.
 *
 * The file layout is the implementation's and the URL is the contract's, so a red says "this
 * URL is unserved" rather than "a file is missing from where I looked". Deliberately not
 * memoised as an EMPTY result: an absent tree throws and a later call re-walks, so the first
 * test's timing does not decide every later test's answer.
 */
let table: DiscoveredRoute[] | undefined;

export function routeTable(): DiscoveredRoute[] {
  if (table !== undefined && table.length > 0) return table;
  const found: DiscoveredRoute[] = [];
  walk(SAVES_ROOT, [], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under \`app/api/account/saves/\`.\n` +
        `  D-140-07 publishes four: ${ROUTE_NAMES.map((n) => `${ROUTES[n].method} ${ROUTES[n].path}`).join(", ")}\n` +
        `  The tree is walked, not guessed, so this is a failed acceptance criterion rather than ` +
        `a test looking in the wrong place.`,
    );
  }
  table = found;
  return table;
}

export function servedPatterns(): string[] {
  return [...new Set(routeTable().map((r) => r.pattern))].sort();
}

/** The session cookie a signed-in caller carries, minted with T000's own published encoder. */
export function sessionCookie(accountId: string, handle: string | null = null): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({ accountId, handle })}`;
}

export interface RouteAnswer {
  status: number;
  contentType: string | null;
  body: string;
  json: unknown;
}

export async function callRoute(
  name: RouteName,
  init: { cookie?: string; body?: unknown; rawBody?: string; method?: string } = {},
): Promise<RouteAnswer> {
  const spec = ROUTES[name];
  const entry = routeTable().find((r) => r.pattern === spec.path);
  if (entry === undefined) {
    throw new Error(
      `\`${spec.path}\` is unserved. Discovered: ${servedPatterns().join(", ")}\n` +
        `  D-140-07 publishes \`${spec.method} ${spec.path}\`.`,
    );
  }
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(entry.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(`\`${spec.path}\` does not load.`, { cause });
  }
  const method = init.method ?? spec.method;
  const handler = mod[method];
  if (typeof handler !== "function") {
    throw new Error(
      `\`${spec.path}\` exports no \`${method}\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}).\n` +
        `  D-140-07 publishes \`${spec.method} ${spec.path}\`.`,
    );
  }

  const headers: Record<string, string> = {};
  if (init.cookie !== undefined) headers.cookie = init.cookie;
  const payload =
    init.rawBody !== undefined
      ? init.rawBody
      : init.body === undefined
        ? undefined
        : JSON.stringify(init.body);
  if (payload !== undefined) headers["content-type"] = "application/json";

  const request = new Request(`https://darkprint.test${spec.path}`, {
    method,
    headers,
    ...(payload === undefined ? {} : { body: payload }),
  });

  const answered = await (handler as UnknownFn)(request, { params: Promise.resolve({}) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${spec.method} ${spec.path}\` answered ${describe_(answered)}; a route handler returns ` +
        `a Response.`,
    );
  }
  const body = await answered.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }
  return { status: answered.status, contentType: answered.headers.get("content-type"), body, json };
}

/** RFC 9457's five members, all of them, at the status the contract names. */
export function assertProblem(
  answer: RouteAnswer,
  expected: { status: number; instance: string },
  where: string,
): Record<string, unknown> {
  if (answer.status !== expected.status) {
    throw new Error(
      `${where} answered ${answer.status}, expected ${expected.status}.\n` +
        `  body: ${answer.body.slice(0, 400)}`,
    );
  }
  if (
    answer.contentType === null ||
    answer.contentType.split(";")[0].trim() !== "application/problem+json"
  ) {
    throw new Error(
      `${where} answered content-type ${JSON.stringify(answer.contentType)}; B-03 makes a ` +
        `transport or auth failure \`application/problem+json\` (RFC 9457).`,
    );
  }
  const body = answer.json as Record<string, unknown> | undefined;
  if (typeof body !== "object" || body === null) {
    throw new Error(`${where} answered a body that is not a JSON object: ${answer.body.slice(0, 200)}`);
  }
  for (const member of ["type", "title", "status", "detail", "instance"]) {
    if (body[member] === undefined) {
      throw new Error(
        `${where}: RFC 9457 member \`${member}\` is absent. Present: ` +
          `${Object.keys(body).sort().join(", ")}.\n  T000 paid for this one: a problem response ` +
          `missing a member is not a smaller problem response, it is one a client cannot branch on.`,
      );
    }
  }
  if (body.status !== expected.status) {
    throw new Error(
      `${where}: \`status\` is ${JSON.stringify(body.status)} while the response is ` +
        `${answer.status}; the two are one fact and a client may read either.`,
    );
  }
  if (body.instance !== expected.instance) {
    throw new Error(
      `${where}: \`instance\` is ${JSON.stringify(body.instance)}, expected ${expected.instance}.`,
    );
  }
  return body;
}

/** `SavesView`'s key set over the RENDERING, and `savedAt` as the ISO string it crosses as. */
export function assertSavesView(answer: RouteAnswer, where: string): {
  saves: Record<string, unknown>[];
  count: unknown;
} {
  if (answer.status !== 200) {
    throw new Error(`${where} answered ${answer.status}, expected 200.\n  body: ${answer.body.slice(0, 400)}`);
  }
  const view = answer.json;
  if (typeof view !== "object" || view === null || Array.isArray(view)) {
    throw new Error(`${where} answered ${describe_(view)}; \`SavesView\` is an object.`);
  }
  const keys = Object.keys(view).sort();
  if (keys.length !== 2 || keys[0] !== "count" || keys[1] !== "saves") {
    throw new Error(
      `${where} does not render as \`SavesView\`.\n` +
        `  published: ${[...SAVES_VIEW_KEYS].join(", ")}\n  rendered:  ${keys.join(", ")}`,
    );
  }
  const { saves, count } = view as { saves: unknown; count: unknown };
  if (!Array.isArray(saves)) {
    throw new Error(`${where}: \`saves\` is ${describe_(saves)}; the block publishes an array.`);
  }
  for (const [i, record] of saves.entries()) {
    assertSaveRecordKeys(record, `${where}.saves[${i}]`);
    const savedAt = (record as { savedAt?: unknown }).savedAt;
    if (typeof savedAt !== "string" || Number.isNaN(Date.parse(savedAt))) {
      throw new Error(
        `${where}.saves[${i}].savedAt is ${describe_(savedAt)}; D-140-07 publishes it as an ISO ` +
          `STRING across the wire, \`ok\` being \`Response.json\` over a \`Date\`. This is the one ` +
          `field where a route cell and a module cell assert different types.`,
      );
    }
  }
  return { saves: saves as Record<string, unknown>[], count };
}

/** `kind:refId` for each record in a `SavesView`, sorted. Ordering is unpublished. */
export function viewTargetSet(answer: RouteAnswer, where: string): string[] {
  return assertSavesView(answer, where)
    .saves.map((r, i) => targetOf(r, `${where}.saves[${i}]`))
    .sort();
}

/* --------------------- pointing the routes at a database --------------------- */

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithShared = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

/**
 * Run `work` with the shared client every route reaches for pointed at `url`.
 *
 * `getSharedDbClient()` is lazy and cached on `globalThis` behind a well-known symbol
 * (`lib/db/client.ts:50`), so `DATABASE_URL` has to be set AND the cache cleared before the
 * first handler call, or the route silently keeps whatever pool a previous test opened. The
 * slot is restored afterwards and the client this created is closed, because a pool left open
 * outlives the last assertion and blocks the scratch database's `DROP`.
 */
export async function withRoutesPointedAt<T>(url: string, work: () => Promise<T>): Promise<T> {
  const g = globalThis as GlobalWithShared;
  const previousUrl = process.env.DATABASE_URL;
  const previousClient = g[SHARED_CLIENT_KEY];
  process.env.DATABASE_URL = url;
  delete g[SHARED_CLIENT_KEY];
  try {
    return await work();
  } finally {
    const opened = g[SHARED_CLIENT_KEY];
    if (opened !== undefined && opened !== previousClient) {
      try {
        await opened.close();
      } catch {
        /* Teardown is not under test. */
      }
    }
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousClient === undefined) delete g[SHARED_CLIENT_KEY];
    else g[SHARED_CLIENT_KEY] = previousClient;
  }
}


/* ============================================================
   D-140-08 — the ruled order, as a comparator

       ORDER BY saved_at DESC, target_kind ASC, ref_id ASC

   Lifted here rather than left in one test file because BOTH
   surfaces are ordered by it: `listSaves` produces the sequence and
   `SavesView.saves` forwards it, so a route that re-sorted would
   satisfy a module cell alone.

   ── why "equals its own sort" is not circular, written down
      because it LOOKS circular ──
   Asserting that a returned list equals its own sort under a
   comparator fails exactly when the list was not already in that
   order — provided the comparator is TOTAL over the data. It is:
   `save_account_target_key` is unique on
   `(account_id, target_kind, target_id)`, so within one account no
   two records can tie on all three keys, and `Array.prototype.sort`
   is never asked to break a tie it cannot break.

   **If the comparator were PARTIAL this check would pass vacuously
   on every tied pair**, because a stable sort would leave those
   pairs exactly where it found them and the comparison would be
   against the input. That is the failure mode, it is real, and the
   uniqueness constraint is what rules it out — so the argument
   rests on the schema rather than on the comparator looking
   thorough.
   ============================================================ */

export interface Seen {
  targetKind: string;
  refId: string;
  /** Milliseconds, so a `Date` from the barrel and an ISO string from a route compare alike. */
  at: number;
}

/** The published record, reduced to the three fields D-140-08 orders by. Nothing else is read. */
export function seenOf(record: unknown, where: string): Seen {
  const r = record as { targetKind?: unknown; refId?: unknown; savedAt?: unknown };
  if (typeof r?.targetKind !== "string" || typeof r?.refId !== "string") {
    throw new Error(`${where} is not a SaveRecord: ${describe_(record)}`);
  }
  const at = new Date(r.savedAt as string | number | Date).getTime();
  if (Number.isNaN(at)) {
    throw new Error(`${where}.savedAt is ${describe_(r.savedAt)}, which is not a time.`);
  }
  return { targetKind: r.targetKind, refId: r.refId, at };
}

/**
 * D-140-08 as a comparator, applied to whatever came back.
 *
 * `saved_at DESC` first, then `target_kind ASC`, then `ref_id ASC`.
 *
 * **D-140-09 rules `target_kind ASC` LEXICOGRAPHIC**, so a plain string comparison over the
 * published `targetKind` is the comparator and needs no caveat. That ruling exists because the
 * obvious reading is wrong: `target_kind` is a pgEnum, and **Postgres orders an enum column by
 * DECLARATION order, not alphabetically.** `["blueprint", "card", "term"]` happens to be both, so
 * the two readings coincide and nothing in the data distinguishes them — which is precisely the
 * shape that would have made this comparator right for a reason nobody was relying on.
 *
 * **D-140-10 then made it true BY CONSTRUCTION: the store sorts `target_kind::text`.** That
 * matters to what this comparator rests on rather than to what it does. Before it, the safety of
 * a JavaScript string sort depended on a premise about enum declaration order plus a guard in
 * `tests/enum-declaration-order.test.ts` — a file this task cannot see and whose green is
 * somebody else's. After it, the cast is in the query and the coincidence is not load-bearing at
 * all; the guard is defence in depth. **Recorded because the comparator did not change and its
 * reason did, and this docblock has already carried one wrong reason for exactly this field.**
 *
 * **My own first version of this comment gave the wrong reason and it is corrected here rather
 * than quietly replaced.** It said the comparison is code-point because "SQL's `ASC` on `text`
 * under this database's collation is a code-point ordering". That is true of `ref_id`, which IS
 * `text`, and it is NOT true of `target_kind`, which is an enum and never consulted a collation
 * at all. A true conclusion resting on the wrong mechanism propagates the mechanism — the next
 * reader would have gone looking for a collation on a column that has none.
 *
 * `<`/`>` on the raw values rather than `localeCompare` for the `ref_id` half, since a
 * locale-aware comparator disagrees with a code-point one on exactly the inputs nobody tests.
 */
export function ruledOrder(records: readonly Seen[]): Seen[] {
  return [...records].sort((a, b) => {
    if (a.at !== b.at) return b.at - a.at;
    if (a.targetKind !== b.targetKind) return a.targetKind < b.targetKind ? -1 : 1;
    if (a.refId !== b.refId) return a.refId < b.refId ? -1 : 1;
    return 0;
  });
}

export function asKeys(records: readonly Seen[]): string[] {
  return records.map((r) => `${r.targetKind}:${r.refId}`);
}

/** How many adjacent pairs share a `savedAt`, so a report can say whether the tie-break ran. */
export function tiedPairs(records: readonly Seen[]): number {
  let ties = 0;
  for (let i = 1; i < records.length; i += 1) if (records[i].at === records[i - 1].at) ties += 1;
  return ties;
}
