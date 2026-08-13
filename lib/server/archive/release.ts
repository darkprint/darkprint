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
import type { ReleaseRecord } from "./types";

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
 * Refuses only when `cardRefs` and `cardDigests` disagree in length (AC5) — the
 * one check this layer can make on its own. Refusing a release whose diagnostics
 * carry an error is T100's: deciding that needs full card bodies and an
 * `OntologyView`, which live in T020 and T030 and are Forbidden here (contract).
 */
export async function addRelease(db: Db, input: AddReleaseInput): Promise<ReleaseRecord> {
  if (input.cardRefs.length !== input.cardDigests.length) {
    throw new Error(
      `addRelease: cardRefs (${input.cardRefs.length}) and cardDigests (${input.cardDigests.length}) must be the same length.`,
    );
  }

  // Stored as given — unsorted, undeduplicated (AC5). `bundleDigest` sorts its own
  // copy for the identity computation, so passing the caller's order through here
  // changes nothing about the digest it computes.
  const cardDigests = [...input.cardDigests];
  const digest = bundleDigest({ dot: input.dot, cardDigests });

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
}

/**
 * `digest` is validated as a shape check before it ever reaches a query — the
 * T000-inherited note (backend.md): a malformed path parameter becomes "not
 * found" here rather than `keyForDigest`'s raw `Error` echoing what was sent.
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
