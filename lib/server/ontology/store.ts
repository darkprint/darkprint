/* ============================================================
   DarkPrint backend — ontology version persistence
   Terms are rows, not a blob: one `ontology_term` row per
   `(ontology_version_id, term_id)` with the full `OntologyTerm` in
   `body jsonb`, written as N rows in one transaction and read back
   sorted by `term_id` for a total order.

   `body` being `jsonb` means a term round-trips **value**-
   identically, never byte-identically: Postgres reparses and
   renormalises the document, so key order and insignificant
   whitespace are not preserved and must never be asserted on. What
   is preserved is the value, which is why the digest is taken over
   `canonicalJson` rather than over the bytes that went to the wire.

   Core terms only. A bundle's local overlay is not a global row
   here — it travels on the release that declares it and reaches
   the merge through `openView`'s `extensions` parameter. This
   module never reads the `release` table.
   ============================================================ */

import { asc, eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import type { PgTable } from "drizzle-orm/pg-core";

import { compareVersionStrings } from "@/lib/core";
import type { OntologyTerm } from "@/lib/core";
import { schema, type Db } from "@/lib/db";

import { ontologyDigest } from "./digest";
import {
  DuplicateOntologyVersionError,
  InvalidVocabularyError,
  MalformedContentError,
  OntologyStoreError,
  VersionBumpTooSmallError,
} from "./errors";
import { checkOntologyBump } from "./bump";
import { findMalformedInput } from "./input";
import { validateVocabulary, vocabularyIsUnstorable } from "./validate";
import { findUnrepresentable } from "./well-formed";

const { ontologyTerm, ontologyVersion } = schema;

/** A published version of the curated vocabulary, with its terms in a total order. */
export interface OntologyVersionRecord {
  id: string;
  version: string;
  digest: string;
  terms: readonly OntologyTerm[];
  createdAt: Date;
}

/* --------------------- constraint names, derived --------------------- */

/**
 * The name Postgres will report in a 23505, read off the schema rather than restated.
 *
 * Matched by the columns the index covers, not by its name: matching on the name would be
 * the restatement this exists to avoid, and `bundle_owner_slug_key` is what happens when a
 * literal lives in two places with nothing comparing them.
 */
function uniqueIndexNameOver(table: PgTable, columns: readonly string[]): string {
  const wanted = [...columns].sort().join(",");
  for (const index of getTableConfig(table).indexes) {
    const config = index.config;
    if (config.unique !== true || config.name === undefined) continue;
    const covered = config.columns
      .map((column) => (column as { name?: unknown }).name)
      .filter((name): name is string => typeof name === "string")
      .sort()
      .join(",");
    if (covered === wanted) return config.name;
  }
  // A startup invariant, not a caller's rejection: the schema moved under this module.
  throw new OntologyStoreError(
    `No unique index over (${wanted}) on ${getTableConfig(table).name}.`,
  );
}

const VERSION_UNIQUE = uniqueIndexNameOver(ontologyVersion, ["version"]);
const TERM_UNIQUE = uniqueIndexNameOver(ontologyTerm, ["ontology_version_id", "term_id"]);

/* --------------------- driver error inspection --------------------- */

const UNIQUE_VIOLATION = "23505";
/** Deep enough for driver-wraps-driver, bounded so a self-referential chain cannot spin. */
const MAX_CAUSE_DEPTH = 8;

/**
 * The SQLSTATE and constraint from anywhere in an error's `cause` chain.
 *
 * Read rather than rethrown: a `DrizzleQueryError` stringifies to the whole INSERT and every
 * bound parameter, which here is the caller's entire vocabulary. Nothing from this object
 * reaches a message — only the decision of which typed error to raise.
 */
function sqlstateOf(err: unknown): { code?: string; constraint?: string } {
  let cursor: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (cursor === null || typeof cursor !== "object") break;
    const record = cursor as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof record.code === "string") {
      return {
        code: record.code,
        constraint: typeof record.constraint === "string" ? record.constraint : undefined,
      };
    }
    cursor = record.cause;
  }
  return {};
}

/* --------------------- reading --------------------- */

/**
 * `body` is what this module wrote: a whole `OntologyTerm`, value-identical after its jsonb
 * round trip. Cast rather than re-parsed — re-validating rows we authored would be a second
 * schema authority, and the write path is where a bad term is refused.
 */
function termOf(row: { body: unknown }): OntologyTerm {
  return row.body as OntologyTerm;
}

async function termsFor(db: Db, ontologyVersionId: string): Promise<OntologyTerm[]> {
  const rows = await db
    .select({ body: ontologyTerm.body })
    .from(ontologyTerm)
    .where(eq(ontologyTerm.ontologyVersionId, ontologyVersionId))
    .orderBy(asc(ontologyTerm.termId));
  return rows.map(termOf);
}

async function recordFor(
  db: Db,
  row: { id: string; version: string; digest: string; createdAt: Date },
): Promise<OntologyVersionRecord> {
  return { ...row, terms: await termsFor(db, row.id) };
}

/** Existence alone, without loading the version's terms. */
async function versionExists(db: Db, version: string): Promise<boolean> {
  const [row] = await db
    .select({ id: ontologyVersion.id })
    .from(ontologyVersion)
    .where(eq(ontologyVersion.version, version))
    .limit(1);
  return row !== undefined;
}

/** One published version, or `undefined`. Terms come back sorted by `term_id`. */
export async function getOntologyVersion(
  db: Db,
  version: string,
): Promise<OntologyVersionRecord | undefined> {
  const [row] = await db
    .select()
    .from(ontologyVersion)
    .where(eq(ontologyVersion.version, version))
    .limit(1);
  return row === undefined ? undefined : recordFor(db, row);
}

/**
 * The highest version by semver, not the most recently created row.
 *
 * `compareVersionStrings` is a total order that never throws — an unparseable version sorts
 * below every valid one — so a malformed row in the registry cannot crash this.
 */
export async function getLatestOntologyVersion(
  db: Db,
): Promise<OntologyVersionRecord | undefined> {
  const rows = await db.select().from(ontologyVersion);
  if (rows.length === 0) return undefined;
  const newest = rows.reduce((best, row) =>
    compareVersionStrings(row.version, best.version) > 0 ? row : best,
  );
  return recordFor(db, newest);
}

/** Every published version, ascending by semver, each with its terms. */
export async function listOntologyVersions(db: Db): Promise<OntologyVersionRecord[]> {
  const rows = await db.select().from(ontologyVersion);
  rows.sort((a, b) => compareVersionStrings(a.version, b.version));
  const out: OntologyVersionRecord[] = [];
  for (const row of rows) out.push(await recordFor(db, row));
  return out;
}

/* --------------------- writing --------------------- */

/**
 * Publish a vocabulary as a new version. The digest is **computed here, never supplied**.
 *
 * Refuses, in order, before touching the database: input whose *shape* is not what the
 * signature says (a numeric version, a non-string term id, an unknown kind — the shapes a
 * YAML loader produces, not a hostile caller); then content that cannot survive storage, over
 * the version **and** the terms; then a vocabulary whose own structure is broken. A caller
 * wanting the diagnostics behind the last calls `validateVocabulary` — they are not attached
 * to the error, because nothing enumerable is.
 */
export async function addOntologyVersion(
  db: Db,
  input: { version: string; terms: readonly OntologyTerm[] },
): Promise<OntologyVersionRecord> {
  // Shape first: a numeric version or a non-string term id makes everything below meaningless,
  // and until this existed those shapes reached the driver and stored (D-17).
  const malformed = findMalformedInput(input);
  if (malformed !== undefined) {
    throw new MalformedContentError(
      `Ontology version input is malformed: \`${malformed.path}\` ${malformed.reason}. It is refused rather than coerced.`,
    );
  }

  // `version` is walked with the terms, not left out of it. It is stored in a `text` column,
  // so an unpaired surrogate there is rewritten to U+FFFD by `pg` exactly as it would be in a
  // term — and worse, the digest is computed over what was supplied while the row holds what
  // was stored, so the two disagree and no lookup can reveal it (D-15).
  const unrepresentable = findUnrepresentable({ version: input.version, terms: input.terms });
  if (unrepresentable !== undefined) {
    throw new MalformedContentError(
      `Ontology version \`${input.version}\` holds a ${unrepresentable.reason} at \`${unrepresentable.path}\`, which cannot be stored. It is refused rather than rewritten.`,
    );
  }

  const diagnostics = validateVocabulary(input.terms);
  if (vocabularyIsUnstorable(diagnostics)) {
    const codes = [...new Set(diagnostics.filter((d) => d.severity === "error").map((d) => d.code))];
    throw new InvalidVocabularyError(
      `Ontology version \`${input.version}\` is not a valid vocabulary: ${codes.join(", ")}. Call \`validateVocabulary\` for the full diagnostics.`,
    );
  }

  /*
   * AC6, and the ordering is ruled rather than chosen: **existence first, then the bump.**
   *
   * The two refusals answer different questions and only one is about the request. "This
   * version already exists" is a fact about the store's state, true whatever the caller
   * proposed — a published version is never rewritten (B-04), so no proposed content can make
   * the write legal. "This bump is too small" is a judgement about proposed content *relative
   * to its predecessor*, which only matters for a version that could otherwise be created.
   *
   * Checking the settled fact first is not a micro-optimisation. Putting the bump check ahead
   * of it makes a republish fail the bump check before it ever reaches Postgres, so no 23505
   * is raised and no driver `cause` exists — and the duplicate-version tests then pass on a
   * bump refusal while their names still say they are about a version that already exists.
   * Measured: that ordering took the blind suite from 7 red to 2, which looked like five fixes
   * and was five tests passing for the wrong reason.
   *
   * So an existing version skips the bump check entirely and goes to the write, where the
   * unique index raises the 23505 that a duplicate-version refusal is required to carry.
   */
  const alreadyPublished = await versionExists(db, input.version);
  if (!alreadyPublished) {
    const previous = await getLatestOntologyVersion(db);
    if (previous !== undefined) {
      const tooSmall = checkOntologyBump({
        previous: previous.terms,
        next: input.terms,
        declaredVersion: input.version,
        previousVersion: previous.version,
      });
      if (tooSmall.length > 0) {
        const codes = [...new Set(tooSmall.map((d) => d.code))];
        throw new VersionBumpTooSmallError(
          `Ontology version \`${input.version}\` declares a smaller bump than its own changes require: ${codes.join(", ")}.`,
        );
      }
    }
  }

  const digest = ontologyDigest({ version: input.version, terms: input.terms });

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(ontologyVersion)
        .values({ version: input.version, digest })
        .returning();

      // An empty vocabulary is a legal, if odd, version; drizzle rejects an empty VALUES list,
      // so the term insert is skipped rather than special-cased downstream.
      const stored =
        input.terms.length === 0
          ? []
          : await tx
              .insert(ontologyTerm)
              .values(
                input.terms.map((term) => ({
                  ontologyVersionId: created.id,
                  termId: term.id,
                  kind: term.kind,
                  body: term,
                })),
              )
              .returning({ termId: ontologyTerm.termId, body: ontologyTerm.body });

      // Sorted here rather than re-queried: `returning` hands back the stored jsonb, so this
      // is the round-tripped value, and the total order is the same one reads produce.
      stored.sort((a, b) => (a.termId < b.termId ? -1 : a.termId > b.termId ? 1 : 0));
      return { ...created, terms: stored.map(termOf) };
    });
  } catch (cause) {
    const { code, constraint } = sqlstateOf(cause);
    if (code === UNIQUE_VIOLATION && constraint === VERSION_UNIQUE) {
      throw new DuplicateOntologyVersionError(
        `Ontology version \`${input.version}\` is already published. A published version is never rewritten.`,
        cause,
      );
    }
    if (code === UNIQUE_VIOLATION && constraint === TERM_UNIQUE) {
      throw new InvalidVocabularyError(
        `Ontology version \`${input.version}\` declares the same term id twice.`,
        cause,
      );
    }
    throw new OntologyStoreError(
      `Ontology version \`${input.version}\` could not be published.`,
      cause,
    );
  }
}
