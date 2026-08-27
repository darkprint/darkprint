/* ============================================================
   DarkPrint backend — ownedBundles() and draftBundle()
   0007_drafts (T280): two readers over `bundle` DIRECTLY, never
   through `loadSnapshot`. That is deliberate and not an oversight
   — `loadSnapshot`'s release-skip ("a bundle with no release is
   not yet a blueprint") is the PUBLIC archive shelf's rule and it
   stays exactly as it is; a zero-release bundle must keep being
   absent from `blueprints()` and from search. These two readers
   serve a different surface — the profile shelf and the bundle
   detail page's draft branch — that wants the zero-release rows
   for the opposite reason: "no release yet" is the GitHub
   empty-repo state, a thing to render rather than a reason to
   hide the row.

   Two readers rather than one because they answer different
   questions over different keys: `ownedBundles` is a LIST keyed by
   owner handle (the profile shelf draws every bundle one account
   holds), `draftBundle` is a single record keyed by the two-part
   `(owner, slug)` the detail page addresses.
   ============================================================ */

import { and, eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { DraftBundle, OwnedBundleSummary } from "./types";
import { cmpReleasesCurrentFirst, cmpString, frozen } from "./order";
import { readable } from "./snapshot";
import { withRegistryStore } from "./store";

/** `undefined` for a handle nobody holds — both readers below answer that the same way
    they answer an absent bundle: a value, never a throw. */
async function accountIdForHandle(db: Db, handle: string): Promise<string | undefined> {
  const [row] = await db.select({ id: schema.account.id }).from(schema.account).where(eq(schema.account.handle, handle));
  return row?.id;
}

/**
 * Every bundle `handle` holds that `actor` may see: released bundles AND zero-release
 * drafts alike (the release-skip above is `loadSnapshot`'s, not this reader's). The
 * owner sees every row regardless of visibility; anyone else sees only `public` rows —
 * `readable`, the same predicate `loadSnapshot` filters bundles with, applied here to
 * the same column pair (`ownerId`, `visibility`) so the two readers cannot disagree
 * about what "visible" means over one table.
 *
 * A public DRAFT is included for a visitor on purpose: a bundle set `public` with zero
 * releases is the empty-repo state rendered in the open, not a half-finished thing to
 * hide until it has bytes.
 */
export async function ownedBundles(db: Db, actor: Actor, handle: string): Promise<readonly OwnedBundleSummary[]> {
  return withRegistryStore("ownedBundles", async () => {
    const ownerId = await accountIdForHandle(db, handle);
    if (ownerId === undefined) return frozen<OwnedBundleSummary>([]);

    const bundles = (await db.select().from(schema.bundle).where(eq(schema.bundle.ownerId, ownerId))).filter(
      (row) => readable(actor, row),
    );
    if (bundles.length === 0) return frozen<OwnedBundleSummary>([]);

    const releases = await db
      .select()
      .from(schema.release)
      .where(inArray(schema.release.bundleId, bundles.map((b) => b.id)));

    const releasesByBundle = new Map<string, (typeof releases)[number][]>();
    for (const release of releases) {
      const list = releasesByBundle.get(release.bundleId);
      if (list === undefined) releasesByBundle.set(release.bundleId, [release]);
      else list.push(release);
    }

    const summaries = bundles.map((bundle): OwnedBundleSummary => {
      const bundleReleases = releasesByBundle.get(bundle.id) ?? [];
      // Highest semver, tiebroken on row id — D-80-03, the exact rule `loadSnapshot`
      // picks a bundle's current release with, so the two readers cannot name two
      // different releases "current" for one bundle.
      let current: (typeof releases)[number] | undefined;
      for (const release of bundleReleases) {
        if (current === undefined || cmpReleasesCurrentFirst(release, current) < 0) current = release;
      }

      const summary: OwnedBundleSummary = {
        slug: bundle.slug,
        visibility: bundle.visibility,
        updatedAt: bundle.updatedAt,
        releaseCount: bundleReleases.length,
      };
      if (bundle.title !== null) summary.title = bundle.title;
      if (bundle.summary !== null) summary.summary = bundle.summary;
      if (current !== undefined) {
        summary.currentVersion = current.version;
        summary.digest = current.digest;
        summary.nodeCount = current.cardRefs.length;
      }
      return summary;
    });

    return frozen(summaries.sort((a, b) => cmpString(a.slug, b.slug)));
  });
}

/**
 * The draft shell for the detail page's draft branch: the bundle's own row at
 * `(owner, slug)`, `undefined` for a key nothing holds and for one `actor` may not see
 * alike (B-03) — the same two-answers-one-value shape `blueprint()` already publishes,
 * applied to a reader that does not require a release to exist.
 */
export async function draftBundle(db: Db, actor: Actor, owner: string, slug: string): Promise<DraftBundle | undefined> {
  return withRegistryStore("draftBundle", async () => {
    const ownerId = await accountIdForHandle(db, owner);
    if (ownerId === undefined) return undefined;

    const [row] = await db
      .select()
      .from(schema.bundle)
      .where(and(eq(schema.bundle.ownerId, ownerId), eq(schema.bundle.slug, slug)));
    if (row === undefined || !readable(actor, row)) return undefined;

    const draft: DraftBundle = {
      ownerHandle: owner,
      slug: row.slug,
      visibility: row.visibility,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    if (row.title !== null) draft.title = row.title;
    if (row.summary !== null) draft.summary = row.summary;
    if (row.description !== null) draft.description = row.description;
    if (row.category !== null) draft.category = row.category;
    if (row.tags !== null) draft.tags = row.tags;
    return draft;
  });
}
