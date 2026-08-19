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

import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import type { AutonomyResult, PhaseCoverage, SecurityResult } from "@/lib/server/types";
import type { Scores } from "./types";
import { cmpReleasesCurrentFirst } from "./order";
import { readable } from "./snapshot";
import { withRegistryStore } from "./store";

/**
 * The scorecard of a blueprint's current release, or `undefined`. One value for four
 * different states, deliberately: no such `(owner, slug)`, a bundle the caller may not see
 * (B-03 again — a caller able to tell those apart has the leak the 404 closed), a bundle
 * with no release yet, and a release nothing has scored. The last is not an error either:
 * `autonomy`, `security`, `phase_coverage` and `scored_ontology_version_id` are all
 * nullable, and a half-written scorecard is not a scorecard — all four are required
 * together or the answer is that there is none.
 */
export async function scoresOf(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
): Promise<Scores | undefined> {
  return withRegistryStore("scoresOf", () => readScores(db, actor, ownerHandle, slug));
}

/**
 * The body, so the store boundary above is one line and the three queries below are not
 * indented inside a callback. `ownerHandle` and `slug` are caller-supplied and reach only
 * the `where` clauses — the operation handed to `withRegistryStore` is a literal, so
 * neither can enter a rendering (D-13).
 */
async function readScores(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
): Promise<Scores | undefined> {
  const [bundle] = await db
    .select({
      id: schema.bundle.id,
      ownerId: schema.bundle.ownerId,
      visibility: schema.bundle.visibility,
    })
    .from(schema.bundle)
    .innerJoin(schema.account, eq(schema.account.id, schema.bundle.ownerId))
    .where(and(eq(schema.account.handle, ownerHandle), eq(schema.bundle.slug, slug)));

  if (bundle === undefined || !readable(actor, bundle)) return undefined;

  const releases = await db
    .select({
      id: schema.release.id,
      version: schema.release.version,
      autonomy: schema.release.autonomy,
      security: schema.release.security,
      phaseCoverage: schema.release.phaseCoverage,
      scoredOntologyVersionId: schema.release.scoredOntologyVersionId,
    })
    .from(schema.release)
    .where(eq(schema.release.bundleId, bundle.id));

  // The same current-release rule the rest of the read model uses (D-80-03): highest
  // semver, tiebroken on row id. A scorecard read off a different release from the one
  // `blueprint()` returns would be two answers about one blueprint.
  const current = releases.sort(cmpReleasesCurrentFirst)[0];
  if (current === undefined) return undefined;

  const { autonomy, security, phaseCoverage, scoredOntologyVersionId } = current;
  if (autonomy === null || security === null || phaseCoverage === null) return undefined;
  if (scoredOntologyVersionId === null) return undefined;

  const [scored] = await db
    .select({ version: schema.ontologyVersion.version })
    .from(schema.ontologyVersion)
    .where(eq(schema.ontologyVersion.id, scoredOntologyVersionId));
  if (scored === undefined) return undefined;

  return Object.freeze({
    autonomy: autonomy as AutonomyResult,
    security: security as SecurityResult,
    phaseCoverage: phaseCoverage as PhaseCoverage,
    ontologyVersion: scored.version,
  });
}
