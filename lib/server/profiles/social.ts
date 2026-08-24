/* ============================================================
   DarkPrint backend — the three counts T131 added

   `watchers`, `support` and `validated`. All three are `count`
   queries and none of them is a column, which is AC1's inherited
   clause made structural: anything countable is counted, never
   stored as a counter. A `watchers integer` on `account` would
   satisfy every sentence in the section and drift the first time
   an account is deleted, with nothing to red.

   ── these are STATEMENTS and the caller wraps them ──
   Nothing here opens its own boundary. `withProfileStore` is
   applied by `read.ts` at the call site, for the reason
   `store.ts`'s header gives: this module wraps only the statements
   it issues itself, and a wrapper applied twice does not sanitize
   twice, it relabels. Every function below is `db`-in, number-out
   and raises whatever the driver raises.

   ── no `Actor` parameter, and that is deliberate for all three ──
   `watchers` and `support` count accounts, and an account is not a
   private row: the same two numbers are correct for an owner, a
   visitor and an anonymous caller. `validated` is
   actor-independent for a sharper reason, in its own docblock.
   AC2's clause still reaches this file through `read.ts`, which
   memoises none of it.
   ============================================================ */

import { and, countDistinct, eq, ne } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";

/**
 * Accounts currently following `accountId` (AC4).
 *
 * **Derived, and the criterion is that it stays derived.** AC4 — "the watcher count equals
 * the follower count" — is a consistency claim between two things that could drift, so the
 * count comes off the rows rather than being incremented beside them. `countDistinct` over
 * `follower_id` rather than `count(*)`: the unique index already makes the two equal, and
 * asserting the property in the query as well means a future index change cannot silently
 * turn one follower into two.
 */
export async function countWatchers(db: Db, accountId: string): Promise<number> {
  const [row] = await db
    .select({ n: countDistinct(schema.follow.followerId) })
    .from(schema.follow)
    .where(eq(schema.follow.followedId, accountId));
  return row?.n ?? 0;
}

/**
 * Accounts currently endorsing `accountId` (D-131-05).
 *
 * The subject is a PERSON, which is the whole of what separates this from every star in the
 * archive — and it is **not** the fold over this handle's blueprints' and cards' stars.
 * `ProfileShell.tsx:76-78` computes that separately as `stars` and passes `support` through
 * untouched, so the two are different figures and returning one for the other is a defect
 * rather than an approximation.
 */
export async function countSupport(db: Db, accountId: string): Promise<number> {
  const [row] = await db
    .select({ n: countDistinct(schema.accountSupport.supporterId) })
    .from(schema.accountSupport)
    .where(eq(schema.accountSupport.supportedId, accountId));
  return row?.n ?? 0;
}

/**
 * How many other accounts' blueprints this account has reported a run against (D-131-06).
 *
 * **Four decisions, all four ruled rather than chosen here, because each has a plausible
 * wrong answer that no assertion would catch:**
 *
 * **Grain is distinct BUNDLES.** The fixture's own words are "how many other accounts'
 * BLUEPRINTS this handle downloaded, ran, and submitted a run report for", so two reports
 * against one blueprint count once. Counting reports instead is the reading that makes a
 * figure grow by resubmitting.
 *
 * **The join goes through the digest and is deliberately many-to-many.**
 * `run_report.release_digest` is not a foreign key (D-05-01, ruled): `release.digest` carries
 * a non-unique index, because `bundleDigest({ dot, cardDigests })` reads neither owner nor
 * slug nor version, so **an unmodified T110 fork yields a second release at the same digest**.
 * One digest therefore reaches several bundles under several owners, and there is no single
 * "the blueprint this report was against". Counting distinct bundles is what that shape
 * admits; picking one release per digest would be picking an owner arbitrarily.
 *
 * **`owner_id <> accountId` is a filter, not a veto.** A self-owned bundle sharing a digest
 * with somebody else's neither counts nor subtracts — it is dropped, and the other owner's
 * bundle at that same digest still counts. A `NOT EXISTS` over the digest would have made
 * one's own fork erase a real report.
 *
 * **Public bundles only, and no `Actor`.** The subject bundles belong to third parties, so
 * no owner or operator widening applies to them, and a count that moved with a private
 * bundle's existence would hand any reader an existence oracle through a number (B-13). This
 * is the one figure on the record that is the same for every caller.
 *
 * Read directly off `schema.runReport` under D-131-06's narrow grant — `lib/server/runs/**`
 * publishes no per-account reader, and `read.ts`'s own direct `schema.account` read is the
 * in-file precedent. The derivation above is the ruling's; a divergence from it is a defect
 * wherever it lives.
 */
export async function countValidated(db: Db, accountId: string): Promise<number> {
  const [row] = await db
    .select({ n: countDistinct(schema.bundle.id) })
    .from(schema.runReport)
    .innerJoin(schema.release, eq(schema.release.digest, schema.runReport.releaseDigest))
    .innerJoin(schema.bundle, eq(schema.bundle.id, schema.release.bundleId))
    .where(
      and(
        eq(schema.runReport.accountId, accountId),
        ne(schema.bundle.ownerId, accountId),
        eq(schema.bundle.visibility, "public"),
      ),
    );
  return row?.n ?? 0;
}
