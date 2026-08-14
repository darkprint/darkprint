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
import { keyForDigest, schema, type Db } from "@/lib/db";
import type { AutonomyResult, BundleManifest, PhaseCoverage, SecurityResult } from "@/lib/server/types";
import { RELEASE_BUNDLE_VERSION_CONSTRAINT } from "./constraints";
import { ArchiveConflictError, isUniqueViolationOn, sanitizedWriteError } from "./errors";
import type { ReleaseRecord } from "./types";
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
  if (row.localVocabulary !== null) record.vocabulary = row.localVocabulary;
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
  vocabulary?: unknown;
  analysis?: { autonomy: AutonomyResult; security: SecurityResult; phaseCoverage: PhaseCoverage };
}

/**
 * Refuses when `cardRefs` and `cardDigests` disagree in length (AC5), or when
 * any string this call would persist cannot survive a UTF-8 round trip (D-12)
 * — the two checks this layer can make on its own without reading card bodies
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
