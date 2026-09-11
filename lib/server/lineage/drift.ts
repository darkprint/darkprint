/* ============================================================
   DarkPrint backend — driftOf
   Three tones, and the two that are not `ok` answer different
   questions about different bundles.

   ── `moved` is a fact about the UPSTREAM, not about the registry ──
   The section reads "report when the upstream moved past it" and
   AC4 says "a copy pinning an older card", which invites a second
   reading: compare each pin to the newest version of that card
   anywhere. The tree settles it the other way and the difference
   is visible on the page. `lib/data/bundles.ts:107-113` publishes
   `UpstreamMoved { card, from, to, at }` — `Repin`'s four fields,
   field for field — as "a card the UPSTREAM REPINNED after this
   copy was taken", and the drift notice prints
   "`<owner>/<slug>` repinned `card@from → to` on `<date>`.
   Your copy still carries `<from>`". Under the other reading that
   sentence attributes to the upstream a repin the upstream never
   made, and `driftOf` would report `moved` on a bundle that has no
   upstream at all — which is also why `driftOf` takes no upstream
   argument and `Drift` carries no upstream field: the pointer is
   already on the row.

   ── `blocked` is a fact about THIS bundle ──
   AC5: reported "without mentioning the upstream", and never
   framed as falling behind. So it is decided before the upstream
   is read at all, it is decided for a bundle with no lineage too,
   and `reason` names only what this bundle pins.
   ============================================================ */

import { cardRef, latestVersion, parseCardRef } from "@/lib/core";
import type { Db } from "@/lib/db";
import { getBundle, listReleases, type BundleRecord, type ReleaseRecord } from "@/lib/server/archive";
import { resolveCardRef } from "@/lib/server/cards";
import { can, type Actor } from "@/lib/server/policy";
import { bundleById } from "./store";
import type { Drift, Repin } from "./types";

/**
 * The answer for every question this module declines to distinguish: a bundle that is not
 * there, one `actor` may not read, one with no releases, one with no upstream, and one whose
 * upstream has not moved. B-03 is why the first two share it with the last three — a drift
 * report that answered differently for "not yours" than for "unchanged" would say which
 * bundle ids exist to anybody who asked, and this verb publishes no refusal to say it with.
 */
const OK: Drift = { tone: "ok", repins: [] };

/**
 * What has happened to `bundleId` since its copy was taken.
 *
 * `blocked` is checked before the upstream is read and wins over `moved`. A bundle that does
 * not resolve is not a bundle whose distance from its upstream is worth reporting, and
 * reporting both would put the upstream into the one rendering AC5 keeps it out of.
 */
export async function driftOf(db: Db, actor: Actor, bundleId: string): Promise<Drift> {
  const bundle = await bundleById(db, bundleId);
  if (bundle === undefined || !readable(actor, bundle)) return OK;

  const mine = currentRelease(await listReleases(db, bundle.id));
  if (mine === undefined) return OK;

  const unresolved = await firstUnresolvedPin(db, actor, mine.cardRefs);
  if (unresolved !== undefined) {
    /* "does not resolve" is the site's own phrase for this state (`ScorePanel.tsx:124`,
       `OwnedBundles.tsx:108`), reused so the API and the page say one thing. It names the
       pin, which is this bundle's own content and already readable by anyone who reached
       this line, and it names nothing else: no upstream, no comparison, no "behind". */
    return { tone: "blocked", repins: [], reason: `This blueprint does not resolve: it pins \`${unresolved}\`, which is not available.` };
  }

  if (bundle.lineage === undefined) return OK;
  const upstream = await getBundle(db, bundle.lineage.ownerId, bundle.lineage.slug);
  if (upstream === undefined || !readable(actor, upstream)) return OK;

  /* An upstream that has gone private since the fork was taken reports `ok` rather than
     `blocked`. `blocked` is this bundle's own problem by contract, and "your upstream is no
     longer readable by you" is a statement about the upstream's visibility — exactly what
     AC3's promise keeps off this surface in the other direction. */
  const theirs = await listReleases(db, upstream.id);
  const current = currentRelease(theirs);
  if (current === undefined) return OK;

  const repins = repinsBetween(mine.cardRefs, current.cardRefs, theirs);
  return repins.length === 0 ? OK : { tone: "moved", repins };
}

/* --------------------- the parts this file decides --------------------- */

function readable(actor: Actor, bundle: BundleRecord): boolean {
  return can(actor, "read", { kind: "bundle", ownerId: bundle.ownerId, visibility: bundle.visibility });
}

/**
 * The bundle's current release: the highest SEMVER, never the newest row.
 *
 * T080's D-80-03 ruling, and `lib/server/export/lookup.ts` resolves "current" the same way
 * for the same reason — `listReleases` orders by `createdAt`, and the two diverge the moment
 * a patch on an older line is published, so a republished older line would otherwise become
 * "current" by having been written last. `latestVersion` is `@/lib/core`'s and skips anything
 * that does not parse as semver, so a bundle whose only versions are unparseable falls back
 * to the last row rather than reporting no release on one that demonstrably has some.
 */
function currentRelease(releases: readonly ReleaseRecord[]): ReleaseRecord | undefined {
  if (releases.length === 0) return undefined;
  const latest = latestVersion(releases.map((release) => release.version));
  if (latest === undefined) return releases[releases.length - 1];
  return releases.find((release) => release.version === latest) ?? releases[releases.length - 1];
}

/**
 * The first pin this actor cannot resolve, or `undefined`.
 *
 * `resolveCardRef` is T020's and answers `undefined` for three cases this one does not
 * separate: a ref that does not parse, a ref naming no row, and a row this actor may not
 * read. All three are the same fact for a reader — the blueprint in front of them does not
 * resolve — and separating them here would report which card versions exist to somebody who
 * may not read them.
 *
 * In DOT order, because that is the order `cardRefs` is stored in (`addRelease` stores it as
 * given) and a reason naming a different pin on every call is one nobody can act on.
 */
async function firstUnresolvedPin(db: Db, actor: Actor, refs: readonly string[]): Promise<string | undefined> {
  for (const ref of refs) {
    if ((await resolveCardRef(db, actor, ref)) === undefined) return ref;
  }
  return undefined;
}

/**
 * One repin per card id the two releases pin at different versions.
 *
 * **The grain is one version per card id, and it is the published shape's rather than a
 * narrowing invented here.** `Repin` carries one `from` and one `to` for one `card`, so a
 * bundle pinning two versions of one id has no expressible answer; the first pin in DOT
 * order is taken on each side. A card the upstream has dropped, or one this copy added, is
 * not a repin and is not reported: `Repin` names a move from one version to another, and
 * there is no version to name on the missing side.
 *
 * Any DIFFERENCE, not only an increase. The panel's word is "repinned", and a comparison
 * that fired only when the upstream's version sorted higher would go silent exactly when the
 * upstream rolled a card BACK — which is a change to a copy's bytes and its security reading
 * whichever direction it went. It is also not this task's semver decision to make.
 */
function repinsBetween(
  mine: readonly string[],
  theirs: readonly string[],
  upstreamReleases: readonly ReleaseRecord[],
): Repin[] {
  const ours = pinnedVersions(mine);
  const repins: Repin[] = [];
  for (const [card, to] of pinnedVersions(theirs)) {
    const from = ours.get(card);
    if (from === undefined || from === to) continue;
    repins.push({ card, from, to, at: repinnedAt(upstreamReleases, card, to) });
  }
  return repins;
}

/** Card id to the version pinned, first occurrence in DOT order winning. Unparseable refs are skipped. */
function pinnedVersions(refs: readonly string[]): Map<string, string> {
  const pinned = new Map<string, string>();
  for (const ref of refs) {
    const parsed = parseCardRef(ref);
    if (parsed === undefined || pinned.has(parsed.id)) continue;
    pinned.set(parsed.id, parsed.version);
  }
  return pinned;
}

/**
 * When the upstream came to pin `card@version`: the EARLIEST of its releases carrying that
 * ref, not its current one.
 *
 * The panel prints "repinned `card@from → to` **on** `<date>`", so the date has to be the one
 * the repin happened on. Reading it off the current release instead would date every repin to
 * the upstream's most recent publish, which is right only when the upstream has published
 * exactly once since the fork. `listReleases` returns `createdAt` order, so the first match is
 * the earliest.
 *
 * Falls back to the last release's date rather than throwing: the caller only reaches here
 * with a version some release pins, so the fallback is unreachable through this module, and
 * a `Date` is not a field a report can honestly leave out.
 */
function repinnedAt(releases: readonly ReleaseRecord[], card: string, version: string): Date {
  const ref = cardRef(card, version);
  const carrying = releases.find((release) => release.cardRefs.includes(ref));
  return (carrying ?? releases[releases.length - 1]).createdAt;
}
