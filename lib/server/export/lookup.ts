/* ============================================================
   DarkPrint backend — finding the bundle and the release
   Two lookups this task needs and no published reader covers, per
   D-90-06 and the same ruling T080 got as D-80-04: a handle is the
   only thing a URL carries and `getBundle` takes an `ownerId`, and
   `exportRelease` is keyed by `bundleId` while nothing maps a
   bundle id to its owner. `account.handle` is the only mapping and
   T050/T070 are unmerged, so both go straight to `@/lib/db`.
   `lib/server/archive/**` stays Forbidden and is still what reads
   a release: `getBundle`, `getRelease` and `listReleases` below
   are all its own.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { latestVersion } from "@/lib/core";
import { schema, type Db } from "@/lib/db";
import { getRelease, listReleases, type ReleaseRecord } from "@/lib/server/archive";
import { can, type Actor } from "@/lib/server/policy";
import { readFailed } from "./errors";
import type { ReleaseRef } from "./types";

/** The half of a `bundle` row a policy decision and a download event need. */
export interface BundleIdentity {
  id: string;
  ownerId: string;
  slug: string;
  visibility: "public" | "private";
}

/**
 * Postgres casts a `uuid` parameter before it compares it, so a malformed id is a 22P02
 * raised on the statement rather than a query that matches nothing — and a
 * `DrizzleQueryError` opening with the whole SELECT and its bound parameters is what
 * would then reach a route.
 *
 * This is the falsifiable edge guard the T000-inherited note was reaching for and aimed
 * at the wrong input (D-90-07): a digest guard here deletes to no red, because T010's
 * `getRelease` already validates through `keyForDigest`. Delete *this* one and a
 * malformed `bundleId` stops answering "no such release" and starts throwing the
 * statement.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** The bundle a `bundleId` names, or `undefined` — including for an id that is not a uuid. */
export async function bundleById(db: Db, bundleId: string): Promise<BundleIdentity | undefined> {
  if (!isUuid(bundleId)) return undefined;
  let rows;
  try {
    rows = await db
      .select({
        id: schema.bundle.id,
        ownerId: schema.bundle.ownerId,
        slug: schema.bundle.slug,
        visibility: schema.bundle.visibility,
      })
      .from(schema.bundle)
      .where(eq(schema.bundle.id, bundleId));
  } catch (err) {
    throw readFailed(err);
  }
  return rows[0];
}

/**
 * The bundle a `(handle, slug)` pair names, or `undefined`.
 *
 * `account.handle` is nullable — a first sign-in reaches that row before a handle is
 * chosen (T050 AC1) — so an empty or absent handle must not match those rows. `eq` on a
 * `null` column never matches, which is the behaviour wanted; the empty-string case is
 * refused explicitly, since `""` is a value a URL can carry and a row could in principle
 * hold.
 */
export async function bundleByHandle(
  db: Db,
  ownerHandle: string,
  slug: string,
): Promise<BundleIdentity | undefined> {
  if (ownerHandle === "" || slug === "") return undefined;
  let rows;
  try {
    rows = await db
      .select({
        id: schema.bundle.id,
        ownerId: schema.bundle.ownerId,
        slug: schema.bundle.slug,
        visibility: schema.bundle.visibility,
      })
      .from(schema.bundle)
      .innerJoin(schema.account, eq(schema.account.id, schema.bundle.ownerId))
      .where(and(eq(schema.account.handle, ownerHandle), eq(schema.bundle.slug, slug)));
  } catch (err) {
    throw readFailed(err);
  }
  return rows[0];
}

/** B-03: a bundle the actor may not read is indistinguishable from one that is not there. */
export function readableBy(actor: Actor, bundle: BundleIdentity): boolean {
  return can(actor, "read", {
    kind: "bundle",
    ownerId: bundle.ownerId,
    visibility: bundle.visibility,
  });
}

/**
 * The release a `ReleaseRef` names.
 *
 * **AC6 lives in the order of the three branches.** `digest` is resolved first and never
 * falls through to `version`: a digest names one immutable set of bytes and must keep
 * naming them after a newer release exists, which is the distinction `/mcp` calls
 * load-bearing. A `version` reference is the convenience that moves. Neither given means
 * the current release, and current is the **highest semver** rather than the newest row,
 * matching T080's D-80-03 ruling rather than `listReleases`'s `created_at` order — a
 * republished older line would otherwise become "current" by being written last.
 */
export async function resolveRelease(
  db: Db,
  bundleId: string,
  ref: Pick<ReleaseRef, "version" | "digest">,
): Promise<ReleaseRecord | undefined> {
  if (ref.digest !== undefined) {
    try {
      return await getRelease(db, bundleId, ref.digest);
    } catch (err) {
      throw readFailed(err);
    }
  }

  let releases: ReleaseRecord[];
  try {
    releases = await listReleases(db, bundleId);
  } catch (err) {
    throw readFailed(err);
  }

  if (ref.version !== undefined) {
    return releases.find((release) => release.version === ref.version);
  }

  const latest = latestVersion(releases.map((release) => release.version));
  // `latestVersion` skips anything that does not parse as semver, so a bundle whose only
  // releases carry unparseable versions falls back to the last row rather than 404ing on
  // a bundle that demonstrably has releases.
  if (latest === undefined) return releases[releases.length - 1];
  return releases.find((release) => release.version === latest);
}
