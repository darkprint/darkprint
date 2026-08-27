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
import { can, type Actor } from "@/lib/server/policy";
import { BUNDLE_OWNER_SLUG_CONSTRAINT } from "./constraints";
import { ArchiveConflictError, isUniqueViolationOn, sanitizedWriteError } from "./errors";
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
  /* 0007_drafts: `null` is the column's "not written" value on all five, turned into an
     absent field the same way `lineage`'s three columns are above — see the type's own
     comment for why absent and not `null`. */
  if (row.title !== null) record.title = row.title;
  if (row.summary !== null) record.summary = row.summary;
  if (row.description !== null) record.description = row.description;
  if (row.category !== null) record.category = row.category;
  if (row.tags !== null) record.tags = row.tags;
  return record;
}

export interface CreateBundleInput {
  ownerId: string;
  slug: string;
  visibility: "public" | "private";
  lineage?: { ownerId: string; slug: string; version: string };
  /**
   * 0007_drafts. Every one optional and every one absent on the path `publish()` has
   * always used — a bundle created that way stores none of them and its `updatedAt`
   * relies on the release it stores in the same beat, never on this call.
   */
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  tags?: readonly string[];
}

/**
 * Refuses when `slug` (or `lineage`) cannot survive a UTF-8 round trip through
 * Postgres — the same D-12 failure mode the adversary found on the release
 * side, applied here before it recurs on this one: an unpaired surrogate is
 * silently replaced with U+FFFD rather than raising, so the stored slug would
 * stop being the slug the caller asked for. A duplicate `(owner, slug)`
 * rejects with a typed `ArchiveConflictError`, matched by constraint name
 * (D-14) — derived from the schema itself via `./constraints`, not a literal
 * restated beside it — so a violation of some other unique index a later
 * migration adds cannot be mislabelled as this one, and a rename of this one
 * cannot make the label silently stop arriving. Every other write failure
 * still leaves — a database being down must not be swallowed as a conflict —
 * but sanitized: no statement, no bound parameters (D-13).
 */
export async function createBundle(db: Db, input: CreateBundleInput): Promise<BundleRecord> {
  if (
    !isWellFormedDeep({
      slug: input.slug,
      lineage: input.lineage,
      title: input.title,
      summary: input.summary,
      description: input.description,
      category: input.category,
      tags: input.tags,
    })
  ) {
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
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.tags !== undefined ? { tags: [...input.tags] } : {}),
      })
      .returning();
    return toBundleRecord(row);
  } catch (err) {
    if (isUniqueViolationOn(err, BUNDLE_OWNER_SLUG_CONSTRAINT)) {
      throw new ArchiveConflictError("bundle-slug", `A bundle already exists at slug "${input.slug}" for this owner.`);
    }
    throw sanitizedWriteError("createBundle", err);
  }
}

export async function getBundle(db: Db, ownerId: string, slug: string): Promise<BundleRecord | undefined> {
  const [row] = await db
    .select()
    .from(schema.bundle)
    .where(and(eq(schema.bundle.ownerId, ownerId), eq(schema.bundle.slug, slug)));
  return row === undefined ? undefined : toBundleRecord(row);
}

/** The raw row, by id, for the two writers below — never exported: a caller outside this
    file addresses a bundle by `(ownerId, slug)` through `getBundle`, never by `id`. */
async function bundleRowById(db: Db, bundleId: string): Promise<typeof schema.bundle.$inferSelect | undefined> {
  const [row] = await db.select().from(schema.bundle).where(eq(schema.bundle.id, bundleId));
  return row;
}

/**
 * 0007_drafts. Owner-only visibility change on a bundle that may or may not have a
 * release yet — the detail page's visibility toggle works the same way on a draft as on
 * a published blueprint.
 *
 * `undefined` for both "no such bundle" and "not this actor's", never a throw: B-03's
 * rule applied to a write the way `getBundle` already applies it to a read, one line up
 * — a distinct answer for either case would tell a caller which private bundle ids are
 * real. **No new error class for the refusal**, per the contract: this barrel already
 * answers a policy question as a VALUE everywhere a caller may not see a row (`getBundle`
 * itself, unconditionally, since it takes no actor at all), and a class invented here for
 * one more "not yours" would be a second vocabulary for a shape this module already has
 * one of. A genuine store fault — the database unreachable, a malformed `bundleId` — still
 * throws, through the same `sanitizedWriteError` `createBundle` above already uses.
 */
export async function setBundleVisibility(
  db: Db,
  actor: Actor,
  bundleId: string,
  visibility: "public" | "private",
): Promise<BundleRecord | undefined> {
  try {
    const row = await bundleRowById(db, bundleId);
    if (row === undefined) return undefined;
    if (!can(actor, "write", { kind: "bundle", ownerId: row.ownerId, visibility: row.visibility })) {
      return undefined;
    }
    const [updated] = await db
      .update(schema.bundle)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(schema.bundle.id, bundleId))
      .returning();
    return toBundleRecord(updated);
  } catch (err) {
    throw sanitizedWriteError("setBundleVisibility", err);
  }
}

/**
 * 0007_drafts. The patch a later edit to a draft's (or a published bundle's) own details
 * writes — `title`, `summary`, `description`, `category`, `tags`. A key ABSENT from
 * `details` leaves its column alone; a key present and `null` clears it — `Object.hasOwn`
 * gated, the same absent-vs-null distinction `lib/server/accounts/write.ts` applies to a
 * profile patch and for the identical reason: a patch built by spreading an object that
 * happens to carry `field: undefined` must not clear a value nobody asked to clear.
 *
 * Owner-only, same shape as `setBundleVisibility` immediately above: `undefined` for
 * absent-or-not-yours, no new error class, a store fault still throws.
 *
 * No route calls this yet (0007_drafts ships only the visibility PATCH); published so the
 * later edit surface the contract names has something to call rather than a second
 * `UPDATE bundle SET ...` written beside this one.
 */
export interface BundleDetailsPatch {
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: readonly string[] | null;
}

export async function updateBundleDetails(
  db: Db,
  actor: Actor,
  bundleId: string,
  details: BundleDetailsPatch,
): Promise<BundleRecord | undefined> {
  if (!isWellFormedDeep(details)) {
    throw new Error(
      "updateBundleDetails: content contains an unpaired UTF-16 surrogate and cannot be stored losslessly (D-12) — refused rather than silently rewritten.",
    );
  }

  try {
    const row = await bundleRowById(db, bundleId);
    if (row === undefined) return undefined;
    if (!can(actor, "write", { kind: "bundle", ownerId: row.ownerId, visibility: row.visibility })) {
      return undefined;
    }

    const patch: Partial<typeof schema.bundle.$inferInsert> = {};
    if (Object.hasOwn(details, "title") && details.title !== undefined) patch.title = details.title;
    if (Object.hasOwn(details, "summary") && details.summary !== undefined) patch.summary = details.summary;
    if (Object.hasOwn(details, "description") && details.description !== undefined) {
      patch.description = details.description;
    }
    if (Object.hasOwn(details, "category") && details.category !== undefined) patch.category = details.category;
    if (Object.hasOwn(details, "tags") && details.tags !== undefined) {
      patch.tags = details.tags === null ? null : [...details.tags];
    }

    /* An empty patch is a no-op that answers the current record rather than an UPDATE with
       nothing to set — `applyPatch`'s reasoning in `lib/server/accounts/write.ts`: nothing
       was asked for and nothing failed, and stamping `updatedAt` for it would make "when did
       this bundle last change" answer a question this call never asked. */
    if (Object.keys(patch).length === 0) return toBundleRecord(row);

    const [updated] = await db
      .update(schema.bundle)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.bundle.id, bundleId))
      .returning();
    return toBundleRecord(updated);
  } catch (err) {
    throw sanitizedWriteError("updateBundleDetails", err);
  }
}
