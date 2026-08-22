/* ============================================================
   DarkPrint backend — archive: releases and their bytes
   B-06: append-only per bundle, enforced by the schema's own
   unique index on (bundle_id, version) rather than a check here.
   Identity is computed inside this module and never accepted from
   a caller (second amendment, backend.md, T010) — the stored
   digest and the stored bytes agree by construction rather than by
   whatever calls this.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { bundleDigest } from "@/lib/core";
import { parseOntologyTerms } from "@/lib/content/ontology-file";
import { keyForDigest, schema, type Db } from "@/lib/db";
import type { AutonomyResult, BundleManifest, OntologyTerm, PhaseCoverage, SecurityResult } from "@/lib/server/types";
import { RELEASE_BUNDLE_VERSION_CONSTRAINT } from "./constraints";
import { ArchiveConflictError, MalformedVocabularyError, isUniqueViolationOn, sanitizedWriteError } from "./errors";
import type { ReleaseRecord, StoredVocabulary } from "./types";
import { isWellFormedDeep } from "./well-formed";

function toReleaseRecord(row: typeof schema.release.$inferSelect): ReleaseRecord {
  const record: ReleaseRecord = {
    id: row.id,
    bundleId: row.bundleId,
    version: row.version,
    digest: row.digest,
    createdAt: row.createdAt,
    dot: row.dot,
    manifest: row.manifest as BundleManifest,
    cardRefs: row.cardRefs,
    cardDigests: row.cardDigests,
  };
  /* Cast, like `manifest` above, and for the same reason it is only a cast: this row may have
     been written by something other than `addRelease` — a direct `UPDATE`, a row stored before
     the shape was published. The readers refuse what arrives that way; that is why AC1 moving
     the primary guarantee to the write does not delete their refusals. */
  if (row.localVocabulary !== null) record.vocabulary = row.localVocabulary as StoredVocabulary;
  if (row.autonomy !== null && row.security !== null && row.phaseCoverage !== null) {
    record.analysis = {
      autonomy: row.autonomy as AutonomyResult,
      security: row.security as SecurityResult,
      phaseCoverage: row.phaseCoverage as PhaseCoverage,
    };
  }
  return record;
}

export interface AddReleaseInput {
  bundleId: string;
  version: string;
  dot: string;
  manifest: BundleManifest;
  cardRefs: readonly string[];
  cardDigests: readonly string[];
  /**
   * Stays `unknown` while `ReleaseRecord.vocabulary` is typed, and the asymmetry is the point.
   *
   * This value arrives from a request body; it is the one input with no assumed shape. Typing
   * it `StoredVocabulary` would move the claim to the caller — which is how the column came to
   * hold whatever anyone passed — and would make the runtime refusal below look redundant. The
   * writer is where the interpretation is held, so it is checked here rather than promised
   * there. It is also what keeps the D-12 cells able to hand this field a hostile value without
   * a cast.
   */
  vocabulary?: unknown;
  analysis?: { autonomy: AutonomyResult; security: SecurityResult; phaseCoverage: PhaseCoverage };
}

/** The name the parser's diagnostics quote. A column, since that is where the bytes are. */
const STORED_VOCABULARY = "release.local_vocabulary";

/*
 * AC3, stated as a query rather than as a migration.
 *
 * `addRelease` refuses a refused shape from now on, but rows reach this column by routes the
 * writer does not stand on — a direct `UPDATE`, a row stored before the shape was published —
 * so "are any already there?" is a question that has to stay answerable. It is one sequential
 * scan over `release`, which is what "without reading every row" asks for: the predicate runs
 * in Postgres and only the offending rows come back, rather than every row crossing into a
 * process to be inspected.
 *
 *     SELECT id, bundle_id, version FROM release
 *     WHERE local_vocabulary IS NOT NULL
 *       AND (jsonb_typeof(local_vocabulary) <> 'object'
 *            OR jsonb_typeof(local_vocabulary -> 'text') <> 'string');
 *
 * It reports the two clauses SQL can decide — not a mapping, and `text` absent or not a string.
 * The third, `terms` being a list of term mappings, is `parseOntologyTerms`' and is deliberately
 * NOT transcribed into SQL here: a second copy of the grammar in a dialect that cannot import it
 * is exactly the second reading this task exists to end, and it would be the one copy nobody
 * runs. So this query UNDER-reports by construction, and that is the honest direction — every
 * row it names is refused, and a row it misses is still refused by the readers.
 *
 * No migration: `lib/db/migrations/**` is not this task's, the column type does not change, and
 * what becomes of such a row is an open question this task does not answer (D-133-01).
 */

/**
 * The one reading of `release.local_vocabulary`, consumed by the writer below and by
 * `lib/server/export/vocabulary.ts` rather than re-derived in each (AC2).
 *
 * **It calls the readers' own `parseOntologyTerms` instead of a predicate written beside it
 * (D-133-03).** That is the only construction in which the writer and the readers cannot come
 * to disagree: a second predicate here would be a second reading of this column, which is the
 * defect this task exists to end, moved to the write. It also holds the grammar boundary
 * structurally rather than by anyone remembering — this module adds no term rule, it runs
 * T030's, so `terms: [42]` is refused without T133 ruling on what a term is.
 *
 * **Where the readers already decide, this adds no rule (D-133-04).** `{ text: "", terms: [] }`
 * is accepted, because `storedVocabulary` checks only `typeof text !== "string"` and refusing
 * the empty string would invent a boundary neither reader has; unknown keys are accepted,
 * because both readers ignore them. A writer stricter than its readers is a third reading.
 *
 * `undefined` means the release declares no local vocabulary, which is the ordinary case.
 * `null` is included in that because it is what the column holds for a release with no local
 * terms and what `toReleaseRecord` filters out.
 */
export function parseStoredVocabulary(
  value: unknown,
  operation: string,
): { text: string; terms: readonly OntologyTerm[] } | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new MalformedVocabularyError(operation, "not-a-mapping");
  }

  const record = value as Record<string, unknown>;
  const text = record.text;
  if (typeof text !== "string") throw new MalformedVocabularyError(operation, "text");

  let terms: readonly OntologyTerm[];
  try {
    /* `{ terms: [...] }` is the document shape this parser reads and the shape the column
       stores, so the value goes in as it stands rather than being rewrapped. */
    terms = parseOntologyTerms(record, STORED_VOCABULARY);
  } catch (cause) {
    /* The parser's message quotes the offending entry's index and its `kind` — caller content
       — so it travels on `cause` and never in a message (D-13). */
    throw new MalformedVocabularyError(operation, "terms", cause);
  }

  return { text, terms };
}

/**
 * Refuses when `cardRefs` and `cardDigests` disagree in length (AC5), when
 * any string this call would persist cannot survive a UTF-8 round trip (D-12),
 * or when `vocabulary` is not `StoredVocabulary` — a typed
 * `MalformedVocabularyError` naming the field and the failing clause and never
 * the caller's value (T133 AC1/AC4, D-13). That third check is what stops the
 * column holding a shape its readers refuse; it is the writer's because a shape
 * refused by two readers independently is a shape two authors have each guessed
 * at. The three checks this layer can make on its own without reading card bodies
 * or an `OntologyView`. Refusing a release whose diagnostics carry an error is
 * T100's: that decision needs both, and both live in T020 and T030, Forbidden
 * here (contract). A duplicate `(bundleId, version)` rejects with a typed
 * `ArchiveConflictError`, matched by constraint name (D-14) — derived from
 * the schema itself via `./constraints`, not a literal restated beside it —
 * so a violation of some other unique index cannot be mislabelled as this
 * one, and a rename of this one cannot make the label silently stop
 * arriving. Every other write failure — a NUL byte in `dot`
 * (well-formed UTF-16, so the D-12 guard above does not catch it and Postgres
 * refuses the byte itself), a bad `bundleId` — still leaves, sanitized: no
 * statement, no bound parameters, which on this table means no caller's DOT
 * source (D-13).
 */
export async function addRelease(db: Db, input: AddReleaseInput): Promise<ReleaseRecord> {
  if (input.cardRefs.length !== input.cardDigests.length) {
    throw new Error(
      `addRelease: cardRefs (${input.cardRefs.length}) and cardDigests (${input.cardDigests.length}) must be the same length.`,
    );
  }

  if (
    !isWellFormedDeep({
      dot: input.dot,
      manifest: input.manifest,
      cardRefs: input.cardRefs,
      cardDigests: input.cardDigests,
      vocabulary: input.vocabulary,
      analysis: input.analysis,
    })
  ) {
    throw new Error(
      "addRelease: content contains an unpaired UTF-16 surrogate and cannot be stored losslessly (D-12) — refused rather than silently rewritten.",
    );
  }

  /* AC1: the refusal is HERE and not at the readers. A shape refused by two readers
     independently is a shape two authors have each guessed at — and one of them was directed
     to its guess by `schema.ts`'s own comment. Deliberately AFTER the D-12 walk (D-133-02 F2):
     a cyclic value must still fail as D-12 rather than as a shape, which is what keeps the
     cycle cell's message unchanged.

     The result is discarded and `input.vocabulary` is stored exactly as given. `toTerm`
     normalises — a YAML `since: 0.1` arrives as the number and leaves as `"0.1"` — so storing
     the parsed copy would rewrite the caller's content, which is the silent repair D-12
     refuses to perform two checks above. This call is asked whether, not what. */
  parseStoredVocabulary(input.vocabulary, "addRelease");

  // Stored as given — unsorted, undeduplicated (AC5). `bundleDigest` sorts its own
  // copy for the identity computation, so passing the caller's order through here
  // changes nothing about the digest it computes.
  const cardDigests = [...input.cardDigests];
  const digest = bundleDigest({ dot: input.dot, cardDigests });

  try {
    const [row] = await db
      .insert(schema.release)
      .values({
        bundleId: input.bundleId,
        version: input.version,
        digest,
        dot: input.dot,
        manifest: input.manifest,
        cardRefs: [...input.cardRefs],
        cardDigests,
        localVocabulary: input.vocabulary ?? null,
        autonomy: input.analysis?.autonomy ?? null,
        security: input.analysis?.security ?? null,
        phaseCoverage: input.analysis?.phaseCoverage ?? null,
      })
      .returning();
    return toReleaseRecord(row);
  } catch (err) {
    if (isUniqueViolationOn(err, RELEASE_BUNDLE_VERSION_CONSTRAINT)) {
      throw new ArchiveConflictError("release-version", `Release "${input.version}" already exists for this bundle.`);
    }
    throw sanitizedWriteError("addRelease", err);
  }
}

/**
 * `keyForDigest` here is mostly not edge validation — most malformed digests
 * already match zero rows at this layer with or without it, since T010 never
 * reaches object storage (the general 404-not-500 requirement lives in T090).
 * For those this is only a cheap way to skip a round trip on input that cannot
 * match. One class is an exception: a digest carrying a NUL byte, which
 * Postgres refuses outright rather than failing to match, so without this call
 * that input would throw a raw `DrizzleQueryError` quoting the query. This call
 * turns that one malformed-input class into `undefined` as well.
 */
export async function getRelease(db: Db, bundleId: string, digest: string): Promise<ReleaseRecord | undefined> {
  try {
    keyForDigest(digest);
  } catch {
    return undefined;
  }
  const [row] = await db
    .select()
    .from(schema.release)
    .where(and(eq(schema.release.bundleId, bundleId), eq(schema.release.digest, digest)));
  return row === undefined ? undefined : toReleaseRecord(row);
}

export async function listReleases(db: Db, bundleId: string): Promise<ReleaseRecord[]> {
  const rows = await db
    .select()
    .from(schema.release)
    .where(eq(schema.release.bundleId, bundleId))
    .orderBy(schema.release.createdAt);
  return rows.map(toReleaseRecord);
}
