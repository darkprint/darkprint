/* ============================================================
   DarkPrint backend — archive: bundle records
   B-06/B-09: one record per (owner, slug), enforced by the
   schema's own unique index rather than a check here. A fork's
   lineage is a plain optional pointer on the row, never a foreign
   key to a specific release — the upstream release it names may
   itself be superseded or the upstream deleted (T120) without
   this row's own history changing.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { ArchiveConflictError, isUniqueViolation } from "./errors";
import type { BundleRecord } from "./types";
import { isWellFormedDeep } from "./well-formed";

function toBundleRecord(row: typeof schema.bundle.$inferSelect): BundleRecord {
  const record: BundleRecord = {
    id: row.id,
    ownerId: row.ownerId,
    slug: row.slug,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (row.lineageOwnerId !== null && row.lineageSlug !== null && row.lineageVersion !== null) {
    record.lineage = { ownerId: row.lineageOwnerId, slug: row.lineageSlug, version: row.lineageVersion };
  }
  return record;
}

export interface CreateBundleInput {
  ownerId: string;
  slug: string;
  visibility: "public" | "private";
  lineage?: { ownerId: string; slug: string; version: string };
}

/**
 * Refuses when `slug` (or `lineage`) cannot survive a UTF-8 round trip through
 * Postgres — the same D-12 failure mode the adversary found on the release
 * side, applied here before it recurs on this one: an unpaired surrogate is
 * silently replaced with U+FFFD rather than raising, so the stored slug would
 * stop being the slug the caller asked for. A duplicate `(owner, slug)`
 * rejects with a typed `ArchiveConflictError` rather than the raw driver
 * error, which would otherwise carry the statement and the owner's id (D-13).
 */
export async function createBundle(db: Db, input: CreateBundleInput): Promise<BundleRecord> {
  if (!isWellFormedDeep({ slug: input.slug, lineage: input.lineage })) {
    throw new Error(
      "createBundle: content contains an unpaired UTF-16 surrogate and cannot be stored losslessly (D-12) — refused rather than silently rewritten.",
    );
  }

  try {
    const [row] = await db
      .insert(schema.bundle)
      .values({
        ownerId: input.ownerId,
        slug: input.slug,
        visibility: input.visibility,
        ...(input.lineage !== undefined
          ? {
              lineageOwnerId: input.lineage.ownerId,
              lineageSlug: input.lineage.slug,
              lineageVersion: input.lineage.version,
            }
          : {}),
      })
      .returning();
    return toBundleRecord(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ArchiveConflictError("bundle-slug", `A bundle already exists at slug "${input.slug}" for this owner.`);
    }
    throw err;
  }
}

export async function getBundle(db: Db, ownerId: string, slug: string): Promise<BundleRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.bundle)
    .where(and(eq(schema.bundle.ownerId, ownerId), eq(schema.bundle.slug, slug)));
  return row === undefined ? undefined : toBundleRecord(row);
}
