/* ============================================================
   T133 — the blind suite's harness

   Not a test file: `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this is `.ts`, so nothing here runs on its own.

   ── what binds, and where every name came from ──
   `backend.md` §T133 now carries a **Published signatures** block
   (D-133-01, ruled 2026-08-22), so every name this suite expects is
   quoted in `PUBLISHED` below with the clause that published it. It
   was written after the charge that the block was missing, which is
   the reason there is no candidate list anywhere in this file: a
   list is a guess, and this whole task exists because a guess about
   this column reached an assertion.

   ── the one rule this suite was written under ──
   *A reference written by the author of the assertions is a
   consistency check, not a second axis.* T130's blind author guessed
   `readonly Record<string, unknown>[]` for `release.local_vocabulary`,
   stored a bare array, and its own reference implementation carried
   the identical misreading -- so the oracle agreed with the cells and
   no mutation in a 26-mutation sweep could have separated them.

   **So this suite writes no reference and no second predicate.** Every
   claim about what a vocabulary MEANS is delegated to
   `parseOntologyTerms` from `@/lib/content/ontology-file` -- merged,
   pure, consumed in three places by its own header, and the parser
   D-133-03 rules the write itself must call. Where a cell needs to
   know whether a value is readable, it asks that function rather than
   restating its rules. The oracle is the thing being agreed with, not
   a second opinion about it.

   ── the D-13 instrument ──
   AC4: the refusal "names the field and never the caller's value".
   Every refused fixture therefore carries a NONCE -- in a value, in a
   key, and nested -- and the assertion is that the nonce is absent
   from every string reachable off the error. Naming the field is the
   weaker half and is checked too; the nonce is the half with teeth,
   because a message that merely mentions `vocabulary` also satisfies
   an implementation that appends the value after it.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { parseOntologyTerms } from "@/lib/content/ontology-file";
import { createTestDb, type TestDb } from "@/tests/support";

export type Namespace = Record<string, unknown>;
export type Row = Record<string, unknown>;
export type Query = (sql: string, params?: readonly unknown[]) => Promise<Row[]>;

/**
 * `backend.md` §T133's Published signatures block and the two rulings under it, quoted so
 * a red says where a name comes from rather than merely that a test wanted it. Nothing
 * outside this object is a name this suite is entitled to expect.
 */
export const PUBLISHED = {
  barrel:
    "D-133-02 F3: the shape lives in `lib/server/archive/release.ts`, re-exported from " +
    "`archive/index.ts` -- granted into Owns on the argument that `a class no barrel " +
    "exports is a class the blind author cannot bind`. So the barrel is " +
    "`@/lib/server/archive`.",
  storedVocabulary:
    "D-133-01: interface StoredVocabulary { text: string; terms?: readonly unknown[] | null } " +
    "-- `null` is the other legal column value. DERIVED, not invented: every clause has a " +
    "merged reader that already enforces it.",
  malformedVocabularyError:
    "D-133-01: AC1's refusal belongs at the write and the class is `MalformedVocabularyError`, " +
    "following `errors.ts`'s convention exactly -- fields on the PROTOTYPE, never assigned in " +
    "the constructor, because a constructor assignment makes the property enumerable and " +
    "breaks `Object.keys(err)` being `[]` and `JSON.stringify(err)` being exactly `\"{}\"`.",
  sharedParse:
    "D-133-03: the write calls the READERS' OWN `parseOntologyTerms`, never a predicate " +
    "written beside it -- `the only construction in which the writer and the readers cannot " +
    "disagree`. The grammar boundary holds for free: the task adds no term rule, it runs " +
    "T030's.",
  orderAgainstD12:
    "D-133-02 F2: the shape refusal runs AFTER `isWellFormedDeep`, so a cyclic or " +
    "surrogate-carrying value still fails as D-12 and its sibling cell's message is unchanged.",
  noCallerValue:
    "T133 AC4: the refusal at the write names the field and never the caller's value (D-13). " +
    "D-133-01: it carries the operation and the failing clause, never the value -- a caller's " +
    "vocabulary is caller data.",
  atTheWrite:
    "T133 AC1: the column has one published shape and `addRelease` refuses anything else AT " +
    "THE WRITE, rather than the readers refusing it later.",
  addRelease:
    "T010: addRelease(db: Db, input: { bundleId; version; dot; manifest; cardRefs; " +
    "cardDigests; vocabulary?; analysis? }): Promise<ReleaseRecord> -- digest is COMPUTED here",
  writerNotStricter:
    "D-133-03's answer on `text: \"\"` and on extra keys: where the readers already decide, " +
    "the writer adds no rule. A writer stricter than its readers is a third reading of this " +
    "column, which is the defect this task exists to end.",
} as const;

/** What a value is, so a red does not send its reader looking for it. */
export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Error) return `${value.constructor.name}: ${value.message}`;
  if (typeof value === "string") return `a string (${JSON.stringify(value.slice(0, 60))})`;
  return typeof value;
}

/* --------------------- the barrel --------------------- */

/**
 * Cached as the promise, rejection included: a module that is absent stays absent for the
 * whole file, and every cell that awaits it gets its own copy of the same red rather than
 * one cell's failure surfacing as an unhandled rejection inside the next.
 */
let archiveModule: Promise<Namespace> | undefined;

export function loadArchive(): Promise<Namespace> {
  archiveModule ??= import("@/lib/server/archive").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `@/lib/server/archive could not be imported: ${String(cause)}\n  ${PUBLISHED.barrel}`,
      );
    },
  );
  return archiveModule;
}

/** A name the contract publishes. Absent is a red, and the red quotes the clause. */
export function required(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `@/lib/server/archive exports no \`${name}\`.\n` +
      `  ${clause}\n` +
      `  It exports: ${exported}`,
  );
}

export type UnknownFn = (...args: never[]) => unknown;

export function requiredFn(mod: Namespace, name: string, clause: string): UnknownFn {
  const value = required(mod, name, clause);
  if (typeof value !== "function") {
    throw new Error(
      `@/lib/server/archive exports \`${name}\` as ${describe_(value)}, not a function.\n` +
        `  ${clause}`,
    );
  }
  return value as UnknownFn;
}

/** The refusal class, bound by identity so no cell has to invent its `name` string. */
export async function malformedVocabularyError(): Promise<new (...a: never[]) => Error> {
  const mod = await loadArchive();
  const value = required(mod, "MalformedVocabularyError", PUBLISHED.malformedVocabularyError);
  if (typeof value !== "function") {
    throw new Error(
      `\`MalformedVocabularyError\` is ${describe_(value)}, not a class.\n` +
        `  ${PUBLISHED.malformedVocabularyError}`,
    );
  }
  return value as new (...a: never[]) => Error;
}

export async function addRelease(): Promise<UnknownFn> {
  return requiredFn(await loadArchive(), "addRelease", PUBLISHED.addRelease);
}

/* --------------------- the database --------------------- */

export interface Scratch {
  /** Exactly what the published client carries, and `addRelease`'s first parameter. */
  db: unknown;
  query: Query;
  drop(): Promise<void>;
}

/**
 * A migrated database of this cell's own, through `@/tests/support`'s one implementation
 * rather than a tenth copy of the create/migrate/drop dance. The support harness exists
 * for exactly this and writing another would be a second opinion about isolation.
 */
export async function openScratch(): Promise<Scratch> {
  const test: TestDb = await createTestDb();
  const client = test.client as unknown as Namespace;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      `createTestDb's client carries no \`db\`. \`Db\` is published from @/lib/db and is ` +
        `\`addRelease\`'s first parameter.`,
    );
  }
  const query: Query = async (sql, params) => {
    const result = await test.client.query(sql, params as unknown[]);
    return result.rows as Row[];
  };
  /* The premise of every assertion below, checked rather than hoped for: a client that
     ignored the connection string it was handed would put this suite on the shared
     database with every assertion still passing. */
  const [where] = await query("select current_database() as name");
  if (typeof where?.name !== "string" || !where.name.startsWith("darkprint_test_")) {
    throw new Error(
      `This suite asked for a scratch database and the client connected to ` +
        `${describe_(where?.name)} instead.`,
    );
  }
  return { db, query, drop: () => test.drop() };
}

/* --------------------- fixtures --------------------- */

let counter = 0;

/** A marker no other run can mint, so two runs never collide on a slug or a handle. */
export function marker(label: string): string {
  counter += 1;
  return `t133-${label}-${process.pid}-${counter}-${randomUUID().slice(0, 8)}`;
}

/**
 * The nonce a refusal must not carry. Distinctive enough that a substring search for it
 * cannot match anything the module legitimately says.
 */
export function nonce(): string {
  return `NONCE${randomUUID().replaceAll("-", "").toUpperCase()}NONCE`;
}

/** `bundle.owner_id` is a foreign key to `account`, and accounts are T050's table. */
export async function insertAccount(s: Scratch, mark: string): Promise<string> {
  const [row] = await s.query(
    "insert into account (github_id, github_login, handle) values ($1, $2, $3) returning id",
    [`gh-${mark}`, `login-${mark}`, `h-${mark}`.slice(0, 39)],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the account fixture: got ${describe_(id)} for its id.`);
  }
  return id;
}

/**
 * A bundle row by raw SQL rather than through `createBundle`.
 *
 * Deliberate: the thing under test is `addRelease`'s treatment of one field, and routing
 * the fixture through a second published writer would let a defect in that writer red
 * these cells with a message about vocabulary.
 */
export async function insertBundle(s: Scratch, mark: string, ownerId: string): Promise<string> {
  const [row] = await s.query(
    "insert into bundle (owner_id, slug, visibility) values ($1, $2, 'public') returning id",
    [ownerId, mark.toLowerCase()],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the bundle fixture: got ${describe_(id)} for its id.`);
  }
  return id;
}

/** An account and a bundle in one call, since every cell here needs exactly that. */
export async function freshBundle(s: Scratch, label: string): Promise<string> {
  const mark = marker(label);
  return insertBundle(s, mark, await insertAccount(s, mark));
}

/** A DOT the engine parses cleanly; the marker inside makes its digest unique. */
export function validDot(mark: string): string {
  return [
    `digraph "${mark}" {`,
    '  rankdir="LR";',
    '  ingest [ref="solver-a@1.0.0"];',
    '  emit [ref="checker-b@1.0.0"];',
    "  ingest -> emit;",
    "}",
    "",
  ].join("\n");
}

/** `release.manifest` is `jsonb NOT NULL`, so every call needs one. */
export function manifestFor(mark: string): Record<string, unknown> {
  return {
    slug: mark.toLowerCase(),
    title: `Fixture ${mark}`,
    summary: "A fixture bundle minted by the blind T133 suite.",
    tags: ["fixture"],
    ontologyVersion: "1.0.0",
  };
}

/**
 * The rest of `addRelease`'s input, so a cell states only the field it is about.
 *
 * `cardRefs` and `cardDigests` are both empty: T010's AC5 parity rule accepts two empty
 * arrays, and a release with no cards is the cheapest fixture that reaches the write.
 */
export function releaseInput(bundleId: string, mark: string): Record<string, unknown> {
  return {
    bundleId,
    version: "1.0.0",
    dot: validDot(mark),
    manifest: manifestFor(mark),
    cardRefs: [],
    cardDigests: [],
  };
}

/**
 * A valid `OntologyTerm` body, spelled from `lib/content/ontology-file.ts`'s `toTerm` --
 * `id`, `kind`, `label`, `description` and `since`, all non-empty strings, `kind` one of
 * the five.
 *
 * Read off the parser rather than recalled. T130's fixture invented
 * `{ id, kind, label, definition }` -- no `description`, no `since`, and `definition` is a
 * field of nothing -- which is a second opinion about what a term is, written by somebody
 * who had not read the first.
 */
export function term(id: string): Record<string, unknown> {
  return {
    id,
    kind: "phase",
    label: `Fixture term ${id}`,
    description: "A term minted by the blind T133 suite.",
    since: "0.1.0",
  };
}

/** The bytes half of the column: a vocabulary document a YAML parser would produce. */
export function vocabularyText(id: string): string {
  return `version: 0.1.0\nterms:\n  - id: ${id}\n`;
}

/* --------------------- reading the column back --------------------- */

/** `release.local_vocabulary` exactly as Postgres holds it, with no reader in between. */
export async function storedColumn(s: Scratch, bundleId: string): Promise<unknown> {
  const rows = await s.query(
    "select local_vocabulary from release where bundle_id = $1 order by created_at",
    [bundleId],
  );
  if (rows.length !== 1) {
    throw new Error(
      `Expected exactly one release under this bundle to read the column off; found ` +
        `${rows.length}.`,
    );
  }
  return rows[0]?.local_vocabulary;
}

/** How many releases this bundle has. AC1's "at the write" is measured with this. */
export async function releaseCount(s: Scratch, bundleId: string): Promise<number> {
  const rows = await s.query("select count(*)::int as n from release where bundle_id = $1", [
    bundleId,
  ]);
  const n = rows[0]?.n;
  if (typeof n !== "number") {
    throw new Error(`\`select count(*)\` answered ${describe_(n)}.`);
  }
  return n;
}

/**
 * A release row written by hand, bypassing every published writer.
 *
 * The only way to put a refused shape in the column once `addRelease` refuses it, and the
 * standing proof that a row can reach a refused shape without passing the writer at all
 * (D-133-02 F6). Modelled on T130's `rawLocalVocabulary`, which exists for the same reason
 * and says so.
 */
export async function insertReleaseRaw(
  s: Scratch,
  bundleId: string,
  vocabulary: unknown,
): Promise<string> {
  const mark = marker("raw");
  const [row] = await s.query(
    "insert into release (bundle_id, version, digest, dot, manifest, card_refs, card_digests, " +
      "local_vocabulary) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id",
    [
      bundleId,
      `1.0.${counter}`,
      `sha256:${randomUUID().replaceAll("-", "")}`,
      validDot(mark),
      JSON.stringify(manifestFor(mark)),
      [],
      [],
      vocabulary === undefined ? null : JSON.stringify(vocabulary),
    ],
  );
  const id = row?.id;
  if (typeof id !== "string") {
    throw new Error(`Could not insert the raw release fixture: got ${describe_(id)}.`);
  }
  return id;
}

/* --------------------- outcomes --------------------- */

export type Outcome =
  | { kind: "returned"; value: unknown }
  | { kind: "threw"; error: unknown };

export async function outcomeOf(call: () => unknown): Promise<Outcome> {
  try {
    return { kind: "returned", value: await call() };
  } catch (error) {
    return { kind: "threw", error };
  }
}

/* --------------------- the leak instrument --------------------- */

/**
 * Every string reachable inside a value, keys included -- a leak arrives as a property NAME
 * as readily as a value -- following `cause`, walking the prototype chain, and reading
 * NON-ENUMERABLE and SYMBOL-KEYED properties as well as ordinary ones, with a seen-set so a
 * cyclic error cannot hang the scan.
 *
 * ── WIDENED after T133's adversary charged it, and the charge is the interesting part ──
 * This walked `Object.entries`, which is **own and enumerable only**, and the docblock above
 * it claimed a prototype-chain walk it was not doing. Mutation M8 put the caller's
 * vocabulary on the refusal as a **non-enumerable own property** and predicted zero reds:
 *
 *     MUTATION_IS_LIVE_offeredCarriesNonce:  true    <- the value IS on the error
 *     SUITE_INSTRUMENT_renderedFullySeesIt:  false   <- and this could not see it
 *     objectKeys: []   jsonStringify: "{}"   inspectShowHiddenSeesIt: true
 *
 * Zero reds across 6202 cells, and the adversary falsified the inertness on a second axis
 * rather than believing the zero.
 *
 * **The two guards were in tension and neither said so.** D-13's four-part hygiene clause
 * asks that `Object.keys(err)` be `[]` and `JSON.stringify(err)` be exactly `"{}"` -- and a
 * value shaped to satisfy that clause EXACTLY is the one shape an enumerable-only scan
 * cannot see. Satisfying the first guard was the way through the second.
 *
 * ── the honest scope of what carrying it would be ──
 * Recorded rather than smoothed, because AC4's teeth are in the wording. Such a value does
 * not reach `message`, `String(err)`, `JSON.stringify(err)` or a default `util.inspect`, so
 * under D-13's *rationale* -- which is about renderings -- it is arguably not a leak, exactly
 * as `ArchiveConflictError.kind` is not. But `kind` is a closed union of the module's own
 * vocabulary, and a caller's vocabulary document is caller data: reachable by property
 * access, by `Object.getOwnPropertyNames`, and by `util.inspect(err, { showHidden: true })`,
 * which error-reporting SDKs use precisely because it catches what `JSON.stringify` drops.
 * **AC4's own words are "never the caller's value", and carrying it violates the words even
 * where it survives the rationale.** No shipped implementation exploits this; the class was
 * confirmed clean on the unmutated tree. This was a gap in what the suite could MEASURE.
 *
 * ── what it still cannot see, stated so nobody relies on silence ──
 * A value held only in a closure, and one synthesised by a getter that answers differently
 * on a second read. Both are outside anything a property walk can reach, and the second is
 * the shape T010's own D-12 round already recorded against its well-formedness traversal.
 * Function-valued properties are recorded by NAME and not descended into.
 */
export function stringsIn(value: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      found.push(current);
      continue;
    }
    if (typeof current === "symbol") {
      found.push(current.description ?? "");
      continue;
    }
    if (current === null || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);
    if (current instanceof Error) {
      /* Kept alongside the walk below rather than replaced by it: `name` normally lives on
         the prototype and `cause` is non-enumerable, and a duplicate string costs a
         substring search nothing. */
      found.push(current.message, current.name, current.stack ?? "");
      if (current.cause !== undefined) stack.push(current.cause);
    }
    for (
      let level: object | null = current;
      level !== null && level !== Object.prototype;
      level = Object.getPrototypeOf(level) as object | null
    ) {
      const keys: (string | symbol)[] = [
        ...Object.getOwnPropertyNames(level),
        ...Object.getOwnPropertySymbols(level),
      ];
      for (const key of keys) {
        found.push(typeof key === "string" ? key : key.description ?? "");
        const descriptor = Object.getOwnPropertyDescriptor(level, key);
        if (descriptor === undefined) continue;
        if ("value" in descriptor) {
          /* A function is recorded by its name above and not descended into: a leak inside a
             closure is not reachable by a property walk at all, and walking `prototype` and
             `constructor` off every method turns a scan into a heap traversal. */
          if (typeof descriptor.value !== "function") stack.push(descriptor.value);
          continue;
        }
        try {
          stack.push(descriptor.get?.call(current));
        } catch {
          /* A getter that throws hides nothing this scan could otherwise have read. */
        }
      }
    }
  }
  return found;
}

/** Everything a caller or a log could read off a thrown value, as one searchable blob. */
export function renderedFully(error: unknown): string {
  const parts: string[] = [String(error), JSON.stringify(error) ?? "", ...stringsIn(error)];
  if (error instanceof Error) parts.push(error.stack ?? "");
  return parts.join("\n");
}

/* --------------------- the oracle --------------------- */

/**
 * Whether the merged shared parser can read a stored value, and what it reads.
 *
 * This is the ONLY thing in this suite that decides what a vocabulary means, and it is
 * not this suite's code. `parseOntologyTerms` is `lib/content/ontology-file.ts`'s single
 * reader -- "the same document is read in three places and a second reader would be a
 * second opinion about what a term is" -- it is what T090's `storedVocabulary` and T130's
 * `counts.terms` both consume, and D-133-03 rules that the write must call it too.
 *
 * `file` is the label diagnostics quote; the column's own name is the honest one here.
 */
export function readsAs(stored: unknown): Outcome {
  try {
    return { kind: "returned", value: parseOntologyTerms(stored, "release.local_vocabulary") };
  } catch (error) {
    return { kind: "threw", error };
  }
}
