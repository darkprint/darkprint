/* ============================================================
   GET | POST /api/blueprints/[owner]/[slug]/votes
   T280's wire layer over `lib/server/ballot` (T160): `200
   { aggregate } | 400 | 401`. GET never 404s — B-03's answer for
   this surface is a VALUE (an empty aggregate), not a refusal;
   see `getAggregate`'s own docblock. POST 404s through
   `withBallotErrors`, on `castBallot`'s own `no-such-bundle`.

   ── Resolving `owner/slug` to a `bundleId` ──
   `getAggregate` and `castBallot` both take a raw `bundleId` and
   decide visibility THEMSELVES (`bundleRowFor` + `can`), which is
   different from the Stars surface: `toggleStar` performs no
   visibility check by design and needs the route to pre-check, but
   the ballot module already answers B-03-shaped. So this route's
   only job is turning `owner/slug` into an id — existence, not
   readability — and `resolveBundleId` below is exactly that, never
   a second visibility decision free to disagree with the module's.
   ============================================================ */

import { randomUUID } from "node:crypto";
import { getSharedDbClient, type Db } from "@/lib/db";
import { readJsonObject, resolveOwner } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { withSession } from "@/lib/server/auth";
import { castBallot, getAggregate, withBallotErrors, type Ballot } from "@/lib/server/ballot";
import { badRequest, ok } from "@/lib/server/http";
import { actorFrom } from "@/lib/server/registry";

/**
 * The bundle `owner/slug` addresses, existence only.
 *
 * **`randomUUID()` when nothing resolves, and that is not a shortcut around B-03 — it is what
 * lets the ballot module's OWN B-03 answer stand.** `bundle.id` is `uuid` (`schema.ts:153`),
 * so an empty string or the raw `slug` text would fail Postgres's own cast rather than answer
 * "no rows" — `getAggregate`/`castBallot` are both built to receive an id naming nothing (a
 * caller's own typo does this identically today), and a fresh random id can never collide
 * with a real row. Handing one through means this route invents no second "no such bundle"
 * path beside the module's.
 */
async function resolveBundleId(db: Db, ownerHandle: string, slug: string): Promise<string> {
  const owner = await resolveOwner(db, ownerHandle);
  if (owner === undefined) return randomUUID();
  const bundle = await getBundle(db, owner.accountId, slug);
  return bundle?.id ?? randomUUID();
}

/**
 * The three writable metrics, read off the parsed body one at a time rather than cast as a
 * whole. `castBallot`'s own `requireScores` is the real validator (integer, 0-100, and a
 * malformed-typed value alike); this only decides which of the three keys were SENT, so an
 * absent key stays absent rather than becoming an explicit `undefined` the module would still
 * treat correctly but that a field-by-field cast makes unambiguous without one.
 */
function ballotFrom(body: Record<string, unknown>): Partial<Ballot> {
  const ballot: Partial<Ballot> = {};
  if (Object.hasOwn(body, "efficacy")) ballot.efficacy = body.efficacy as number;
  if (Object.hasOwn(body, "reliability")) ballot.reliability = body.reliability as number;
  if (Object.hasOwn(body, "transparency")) ballot.transparency = body.transparency as number;
  return ballot;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withBallotErrors(request, async () => {
    const { owner, slug } = await context.params;
    const { db } = getSharedDbClient();
    const bundleId = await resolveBundleId(db, owner, slug);
    const aggregate = await getAggregate(db, actorFrom(request), bundleId);
    return ok({ aggregate });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withSession(request, async () =>
    withBallotErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) {
        return badRequest(request, "votes: the request body must be a JSON object.");
      }

      const { owner, slug } = await context.params;
      const { db } = getSharedDbClient();
      const bundleId = await resolveBundleId(db, owner, slug);
      const aggregate = await castBallot(db, actorFrom(request), bundleId, ballotFrom(body));
      return ok({ aggregate });
    }),
  );
}
