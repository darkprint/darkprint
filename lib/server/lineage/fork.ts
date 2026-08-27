/* ============================================================
   DarkPrint backend — forkBundle
   AC1: a fork is an ordinary bundle owned by the forker, carrying
   one optional pointer back at what it took. There is no `Fork`
   type and no second list (`lib/data/bundles.ts:1-28`), so nothing
   here writes anything but a `bundle` row and a `release` row.

   ── this module composes and owns no storage ──
   The owner behind a handle is T050's `resolveOwner`, the read
   grant is T060's `can`, the account's own publishing default is
   T050's `getAccount`, the rows are T010's `createBundle` and
   `addRelease`, and the DIGEST is `addRelease`'s, recomputed from
   the bytes it is handed. Nothing here compares a version,
   computes a digest or decides a visibility rule.

   ── AC4's other half, from T100's side ──
   `publish` records the same non-effect: "nothing here reaches an
   upstream row". Neither does this. The upstream is READ, three
   plain columns are written on the NEW row, and no foreign key
   ties them — the release this fork names may be superseded, or
   the upstream deleted by T120, without this row's own history
   changing (`archive/bundle.ts`'s own header, `schema.ts:146-158`).
   ============================================================ */

import type { Db } from "@/lib/db";
import { getAccount, resolveOwner } from "@/lib/server/accounts";
import { addRelease, createBundle, getBundle, listReleases, type BundleRecord } from "@/lib/server/archive";
import { enqueue } from "@/lib/server/notifications";
import { can, type Actor } from "@/lib/server/policy";
import { noSuchBundle, noSuchRelease, notSignedIn, slugTaken } from "./errors";

/** The upstream release a fork takes: a handle, a slug and the version, all as the caller named them. */
export interface ForkSource {
  ownerHandle: string;
  slug: string;
  version: string;
}

/** Where it lands. `visibility` omitted means the forker's own account default, never a constant here. */
export interface ForkTarget {
  slug: string;
  visibility?: "public" | "private";
}

/**
 * Copy `from` into the actor's namespace at `to.slug`, recording where it came from.
 *
 * Throws `ForkRefusedError`. An upstream that is not there and one the caller may not read
 * are the same refusal and the route answers both 404 (AC6, B-03).
 *
 * **AC1 records the RELEASE taken, not the bundle.** `lineage.version` is the version that
 * was actually copied, so a fork of a bundle that publishes again still names what it took.
 *
 * **The bundle row and the release are written in one transaction.** A fork with no release
 * is a bundle whose lineage claims a copy it does not hold, and `driftOf` would report `ok`
 * on it forever — there being no pins to compare.
 */
export async function forkBundle(db: Db, actor: Actor, from: ForkSource, to: ForkTarget): Promise<BundleRecord> {
  /* The candidate id is read off the actor and then PROVED by `getAccount`, which asks
     `can(actor, "read", { kind: "account", accountId })` — so every identity ruling T060
     holds applies here without a second copy: an empty-string id, an `operator` tag with no
     id, and a `kind` or `accountId` that exists only on a prototype all answer `undefined`
     and land on the same refusal an anonymous caller gets. This function never decides who
     somebody is; it decides what to do when T060 says nobody. */
  const forkerId = candidateAccountId(actor);
  if (forkerId === undefined) throw notSignedIn();
  const forker = await getAccount(db, actor, forkerId);
  if (forker === undefined) throw notSignedIn();

  /* A handle nobody holds and a handle whose bundle you may not read answer identically,
     which is B-03 one layer down: a distinct refusal for "no such author" would confirm
     which handles exist to anybody who asks. `publish` resolves an owner the same way and
     for the same reason (`publish/publish.ts`'s `resolveLineage`). */
  const upstreamOwner = await resolveOwner(db, from.ownerHandle);
  if (upstreamOwner === undefined) throw noSuchBundle();
  const upstream = await getBundle(db, upstreamOwner.accountId, from.slug);
  if (upstream === undefined) throw noSuchBundle();
  if (!can(actor, "read", { kind: "bundle", ownerId: upstream.ownerId, visibility: upstream.visibility })) {
    throw noSuchBundle();
  }

  /* D-110-11. Named after the read grant, never before it: a caller who may not read this
     bundle must not learn from the wording whether the version it guessed at exists. The
     alternative to refusing is a silent fallback to the latest release, which records a
     provenance nobody asked for and still passes AC1. */
  const source = (await listReleases(db, upstream.id)).find((release) => release.version === from.version);
  if (source === undefined) throw noSuchRelease();

  /* The published refusal for a collision, asked HERE so the caller gets the sentence the
     contract admits rather than a constraint name. It makes `ArchiveConflictError("bundle-slug")`
     unreachable sequentially and not absolutely — this read and the insert below are not one
     atomic act — and that is the right arbiter: no check in a reader could be atomic, and the
     route maps T010's conflict rather than letting it become a 500. `publish` splits AC6 and
     AC8 the same way and records the argument. */
  if ((await getBundle(db, forkerId, to.slug)) !== undefined) throw slugTaken(to.slug);

  /* D-110-09, which is D-100-01 B1's rule with more force behind it: the account's own
     default, never a module constant. Somebody who set their account to private and omitted
     the field must not have a fork made public by a default that was not theirs — and AC2's
     entire property is that a fork can be invisible, so a constant `"public"` here would
     defeat the criterion at the default path while every explicit-value cell stayed green. */
  const visibility = to.visibility ?? forker.defaultVisibility;

  return await db.transaction(async (tx) => {
    const bundle = await createBundle(tx, {
      ownerId: forkerId,
      slug: to.slug,
      visibility,
      /* `upstream.slug` and not `from.slug`: the two are equal because `getBundle` matched on
         it, and storing the value the row actually holds is what keeps that true if the
         lookup ever stops being an exact match. */
      lineage: { ownerId: upstream.ownerId, slug: upstream.slug, version: source.version },
    });

    /* The bytes, unaltered. `addRelease` recomputes `bundleDigest` from `dot` and
       `cardDigests` rather than accepting one, so the copy's digest equals the upstream's by
       construction and no digest is computed in this file — which is what `schema.ts:519`
       already anticipates in terms: "an unchanged T110 fork yields a second release at the
       same digest".

       `cardRefs` and `cardDigests` pass through in the stored order, undeduplicated. A
       bundle pinning one card twice is a different digest from one pinning it once, so
       tidying either array here would store a digest the upstream's bytes never had.

       No card is copied. A `card_version` row is immutable and keyed by `(cardId, version)`,
       so the fork pins the same rows the upstream does — which is also why a fork of a public
       bundle resolves for its forker without anything being duplicated. */
    await addRelease(tx, {
      bundleId: bundle.id,
      version: source.version,
      dot: source.dot,
      manifest: source.manifest,
      cardRefs: source.cardRefs,
      cardDigests: source.cardDigests,
      ...(source.vocabulary === undefined ? {} : { vocabulary: source.vocabulary }),
      ...(source.analysis === undefined ? {} : { analysis: source.analysis }),
    });

    /* ── T190's ONE granted call site (D-190-04) ──
       **AC1 is a filter at the SOURCE, and this `if` is that filter.** "A private fork
       produces no email under any preference" is enforceable only here: `enqueue` is never
       CALLED for a private fork, so no preference and no later sender can undo it. The
       alternative — a visibility check inside `enqueue`, or in whatever eventually mails —
       passes the same tests and leaks the moment a second sender exists, because `subject` is
       `Record<string, string>` and a visibility travelling in it is readable by every later
       reader of the row.

       T110's own merged AC3 cell is what makes this structural rather than a promise: it
       snapshots every row in every table around a PRIVATE fork and reds on any new row
       carrying the upstream author's id, naming "the notification table T190 has not built
       yet". That cell drives `forkBundle`, so the emission is guarded by a merged test only
       while it lives inside `forkBundle`.

       **Inside the transaction, deliberately, and the cost is real.** Outside it, an enqueue
       that failed after the commit would either lose the announcement silently or report a
       fault for a fork that had already succeeded — a caller told its fork failed when it did
       not. Inside, the fork and its announcement land together or neither does, and a retry is
       a clean retry. What that buys is paid for in contention: two simultaneous forks of one
       upstream serialise briefly on the upstream author's `unsubscribe_token` row, because
       `ensureToken`'s conflict waits on the first transaction to commit. Milliseconds, on a
       path that already writes two rows, and it is written down rather than discovered.

       The recipient is the UPSTREAM author. `subject.fork` is the new bundle's id, which is
       what makes two forks of one blueprint two notifications rather than one — the unique key
       is `(kind, account_id, subject_digest)`, so a subject naming only the upstream slug would
       announce the first forker and silently swallow every one after. `subject.slug` is the
       upstream's own slug, so the author is told which of theirs it was. Both are ids the seam
       resolves, exactly as it resolves `accountId` into an address (D-190-03). */
    if (visibility === "public") {
      await enqueue(tx, {
        kind: "fork",
        accountId: upstream.ownerId,
        subject: { slug: upstream.slug, fork: bundle.id },
      });
    }

    return bundle;
  });
}

/**
 * The account id an actor OFFERS, read as an own property and never inherited.
 *
 * It is a candidate and not a decision: `getAccount` is what turns it into one. Read through
 * `Object.hasOwn` because `is-owner.ts` does — an actor whose `accountId` exists only on a
 * prototype has not offered one — and typed loosely because a malformed actor is a refusal
 * rather than a `TypeError`, which is the 2026-08-14 ruling `can` and `visibleTo` both hold.
 */
function candidateAccountId(actor: Actor): string | undefined {
  if (typeof actor !== "object" || actor === null || !Object.hasOwn(actor, "accountId")) return undefined;
  const offered = (actor as { accountId?: unknown }).accountId;
  return typeof offered === "string" && offered.length > 0 ? offered : undefined;
}
