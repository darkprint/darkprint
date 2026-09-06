/* ============================================================
   DarkPrint backend — scoresOf()
   The stored scorecard projection (B-08). The two engine axes and
   phase coverage are read from the columns a publish wrote and an
   ontology release rewrote, stamped with the ontology version they
   were computed under. **This task owns the projection and the
   read, never the re-score** — nothing here recomputes an axis, so
   a stale stamp is visible as a stale stamp rather than quietly
   corrected on the way out.
   ============================================================ */

import { and, eq, inArray, or } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { AutonomyResult, PhaseCoverage, SecurityResult } from "@/lib/server/types";
import type { BlueprintKey, Scores } from "./types";
import { cmpReleasesCurrentFirst } from "./order";
import { keyOf, readable } from "./snapshot";
import { withRegistryStore } from "./store";

/**
 * The scorecard of a blueprint's current release, or `undefined`. One value for four
 * different states, deliberately: no such `(owner, slug)`, a bundle the caller may not see
 * (B-03 again — a caller able to tell those apart has the leak the 404 closed), a bundle
 * with no release yet, and a release nothing has scored. The last is not an error either:
 * `autonomy`, `security` and `phase_coverage` are all nullable, and a
 * half-written scorecard is not a scorecard — all three are required together, carrying
 * the vocabulary version they were computed under, or the answer is that there is none.
 */
export async function scoresOf(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
): Promise<Scores | undefined> {
  /* One key through the batch body rather than a second implementation beside it. The four
     states this answers `undefined` for, the current-release rule and the all-four-or-nothing
     rule are decisions, and a per-key copy of them is the duplicate-decision defect (D-132-01
     names it for `graphsOf`; it is the same hazard one reader over). What differs between the
     two readers is the WHERE clause, and only that. */
  return withRegistryStore("scoresOf", async () =>
    (await readScoresFor(db, actor, [{ ownerHandle, slug }])).get(keyOf({ ownerHandle, slug })),
  );
}

/**
 * The scorecards of every requested blueprint that has one, keyed `${ownerHandle}/${slug}`.
 *
 * **The batch form D-260-21 measured the need for.** A client-side-filtering shelf needs a
 * scorecard for EVERY tile on EVERY request — `df` is `scores.autonomy.isDarkFactory`, so a
 * tile is not even filterable without one — and per-tile `scoresOf` is three statements times
 * N. This is three, whatever N is.
 *
 * **An absent entry is the same value `scoresOf` answers `undefined` for**, and for the same
 * B-03 reason: no such key, a bundle this caller may not see, a bundle with no release, and a
 * release nothing has scored are one answer.
 *
 * D-260-24 measured that nothing in the product had ever written
 * `release.scored_ontology_version_id`, which this reader's fourth required field used to
 * be, so it answered an empty map against a seeded store. That field is gone, along with
 * the table it pointed into, and the vocabulary version is read off the stored `autonomy`
 * that `publish.ts` has been writing all along.
 *
 * Duplicate keys are one entry; an empty `keys` answers an empty map without a statement.
 */
export async function scoresFor(
  db: Db,
  actor: Actor,
  keys: readonly BlueprintKey[],
): Promise<ReadonlyMap<string, Scores>> {
  return withRegistryStore("scoresFor", () => readScoresFor(db, actor, keys));
}

/**
 * The body, so the store boundary above is one line and the three queries below are not
 * indented inside a callback. `ownerHandle` and `slug` are caller-supplied and reach only
 * the `where` clauses — the operation handed to `withRegistryStore` is a literal, so
 * neither can enter a rendering (D-13).
 *
 * Three statements, fixed, whatever `keys` holds — the property D-260-21 asked for. The
 * bundles are fetched by an `OR` over the `(handle, slug)` pairs rather than by two `IN`s:
 * `IN handles AND IN slugs` is the cross product, and since B-09 made slugs unique PER OWNER
 * that cross product really can match a bundle nobody asked for — `alice/foo` requested
 * beside `bob/bar` would also match `alice/bar`. The same reason `terms.ts` keeps its owner
 * equality beside its slug list.
 */
async function readScoresFor(
  db: Db,
  actor: Actor,
  keys: readonly BlueprintKey[],
): Promise<ReadonlyMap<string, Scores>> {
  const scored = new Map<string, Scores>();
  const wanted = new Map(keys.map((key) => [keyOf(key), key]));
  if (wanted.size === 0) return scored;

  const bundles = await db
    .select({
      id: schema.bundle.id,
      slug: schema.bundle.slug,
      ownerId: schema.bundle.ownerId,
      ownerHandle: schema.account.handle,
      visibility: schema.bundle.visibility,
    })
    .from(schema.bundle)
    .innerJoin(schema.account, eq(schema.account.id, schema.bundle.ownerId))
    .where(
      or(
        ...[...wanted.values()].map((key) =>
          and(eq(schema.account.handle, key.ownerHandle), eq(schema.bundle.slug, key.slug)),
        ),
      ),
    );

  /* The one visibility predicate, shared with the rest of the read model rather than
     restated — a second copy of `readable()` is what D-130-04 forbids one module over.

     `account.handle` is nullable and the row is dropped when it is null, which is
     `loadSnapshot`'s own rule — an owner with no handle has no `(owner, slug)` key to be
     addressed by. It narrows a type here more than it changes behaviour: the join above
     already equates the handle with a requested one, and a requested handle is a string. */
  const keyOfBundle = new Map<string, string>();
  for (const row of bundles) {
    if (!readable(actor, row)) continue;
    if (row.ownerHandle === null) continue;
    keyOfBundle.set(row.id, keyOf({ ownerHandle: row.ownerHandle, slug: row.slug }));
  }
  if (keyOfBundle.size === 0) return scored;

  const releases = await db
    .select({
      id: schema.release.id,
      bundleId: schema.release.bundleId,
      version: schema.release.version,
      autonomy: schema.release.autonomy,
      security: schema.release.security,
      phaseCoverage: schema.release.phaseCoverage,
    })
    .from(schema.release)
    .where(inArray(schema.release.bundleId, [...keyOfBundle.keys()]));

  // The same current-release rule the rest of the read model uses (D-80-03): highest
  // semver, tiebroken on row id. A scorecard read off a different release from the one
  // `blueprint()` returns would be two answers about one blueprint. Reduced in one pass
  // rather than sorted per bundle, which is `loadSnapshot`'s own shape for this reduction.
  const currentByBundle = new Map<string, (typeof releases)[number]>();
  for (const row of releases) {
    const held = currentByBundle.get(row.bundleId);
    if (held === undefined || cmpReleasesCurrentFirst(row, held) < 0) currentByBundle.set(row.bundleId, row);
  }

  /* All three or nothing. `autonomy`, `security` and `phase_coverage` are all nullable and
     a half-written scorecard is not a scorecard.

     ── it was four, and the fourth is gone entirely ──
     A `ontologyVersion` member named the vocabulary the three axes were computed under. It
     was resolved first through `release.scored_ontology_version_id` and later off the
     stored `autonomy`, and BOTH of those are now gone: migration 0009 dropped the column
     and the table behind it, and `AutonomyResult` no longer carries the stamp. The registry
     keeps one vocabulary, so there is no version for a release to have been scored under
     that differs from any other release's, and a field with one possible value cannot tell
     two scorecards apart.

     The loop below no longer skips a row for a missing version. That is a widening, and it
     is deliberate rather than incidental: the skip existed to refuse a scorecard whose
     vocabulary could not be named, and nothing can fail to be named now. Legacy rows still
     carry `ontologyVersion` inside their stored `autonomy` jsonb; it is read by nobody and
     passed through as part of the opaque payload. */
  for (const [bundleId, row] of currentByBundle) {
    const key = keyOfBundle.get(bundleId);
    if (key === undefined) continue;
    const { autonomy, security, phaseCoverage } = row;
    if (autonomy === null || security === null || phaseCoverage === null) continue;
    scored.set(
      key,
      Object.freeze({
        autonomy: autonomy as AutonomyResult,
        security: security as SecurityResult,
        phaseCoverage: phaseCoverage as PhaseCoverage,
      }),
    );
  }
  return scored;
}
