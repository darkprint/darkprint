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
import type { BundleRecord } from "./types";

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

export async function createBundle(db: Db, input: CreateBundleInput): Promise<BundleRecord> {
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
}

export async function getBundle(db: Db, ownerId: string, slug: string): Promise<BundleRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.bundle)
    .where(and(eq(schema.bundle.ownerId, ownerId), eq(schema.bundle.slug, slug)));
  return row === undefined ? undefined : toBundleRecord(row);
}
