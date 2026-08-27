/* ============================================================
   POST /api/blueprints/[owner]/[slug]/runs
   T280's wire layer over `lib/server/runs` (T180): `200
   { reported } | 400 | 401 | 404`. Session required — a run
   report is recorded against an account (D-180-03) — and the
   digest is resolved and checked server-side rather than trusted
   from the caller (D-180-01, CONTRACT.md's Runs section):

     * body omits `releaseDigest`      -> this bundle's CURRENT release
     * body names a digest of THIS
       bundle's own history           -> accepted as given
     * body names any other digest    -> refused, 404-shaped (B-03)

   `submitReport` itself is digest-scoped and knows nothing about a
   bundle (`release_digest` is not a foreign key, D-05-01 — a fork
   shares its upstream's digest), so its own existence check is
   GLOBAL: any real digest anywhere passes it. Handed a caller's
   digest unchecked, this route would let a request addressed at
   `owner/slug` attach a report to a DIFFERENT bundle's cost
   aggregate — the very thing "the digest must belong to the
   addressed bundle" refuses. That check is this route's own, made
   before `submitReport` is ever called.

   No unit normalization anywhere on this file (D-180-01): the
   accepted report and `reported` both carry `costUnits`/raw
   figures exactly as `lib/server/runs` publishes them.
   ============================================================ */

import { getSharedDbClient, type Db } from "@/lib/db";
import { readJsonObject, resolveOwner } from "@/lib/server/accounts";
import { getBundle, getRelease } from "@/lib/server/archive";
import { withSession } from "@/lib/server/auth";
import { PROBLEM_TYPE_BASE, badRequest, notFound, ok, problem, unauthorized } from "@/lib/server/http";
import { actorFrom, blueprint } from "@/lib/server/registry";
import {
  RunReportRefusedError,
  RunReportStoreError,
  reportedCost,
  submitReport,
  type RunReport,
} from "@/lib/server/runs";

/** Matches `app/api/blueprints/[owner]/[slug]/route.ts`'s own wording for the same state. */
const NO_SUCH_BUNDLE = "blueprint: no such bundle.";

function storeFailed(request: Request, err: RunReportStoreError): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * `RunReportRefusedError` carries no `kind` (D-180-04's own ruling: ONE class, THREE
 * messages, because a caller distinguishing them by `instanceof` would be distinguishing two
 * things it must handle identically — fix the request and send it again). This route still
 * answers three different STATUSES, so it reads which of the three RULED forms
 * (backend.md:19667, D-180-03/04) it caught — a match against a published, ruled contract
 * rather than an incidental string compare.
 *
 * Both the account and the digest arms are unreachable in the ordinary path: `withSession`
 * guarantees an authenticated actor before `submitReport` ever runs, and the digest is
 * checked against this bundle's own releases (below) before the call. Mapped anyway, on
 * `lib/server/profiles/http.ts`'s precedent for its own unreachable `not-signed-in` arm — a
 * race between the check and the write, or a fourth message added later, must not fall
 * through into somebody else's status.
 */
function refused(request: Request, err: RunReportRefusedError): Response {
  if (err.message === "submitReport: a run report needs an account.") return unauthorized(request);
  if (err.message.startsWith("submitReport: no release at digest ")) return notFound(request, NO_SUCH_BUNDLE);
  return badRequest(request, err.message);
}

async function withRunsErrors(request: Request, work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof RunReportRefusedError) return refused(request, err);
    if (err instanceof RunReportStoreError) return storeFailed(request, err);
    throw err;
  }
}

/**
 * The bundle's own row id, for the one statement `blueprint()` cannot answer: whether a
 * caller-supplied digest belongs to THIS bundle's history. By the time this is called,
 * `blueprint()` has already proved the bundle exists and is readable, so `undefined` here can
 * only be a race against a delete between the two reads — handled the same as any other
 * absence, below.
 */
async function bundleIdFor(db: Db, ownerHandle: string, slug: string): Promise<string | undefined> {
  const owner = await resolveOwner(db, ownerHandle);
  if (owner === undefined) return undefined;
  const bundle = await getBundle(db, owner.accountId, slug);
  return bundle?.id;
}

/** The caller's own digest, echoed back — safe per D-13 (`refusedForUnknownDigest`'s own
 *  reasoning): it is the caller's own input, and a digest is content-addressed and names no
 *  owner, so it is not an existence oracle for anything but what the caller already typed. */
function foreignDigest(request: Request, digest: string): Response {
  return notFound(request, `runs: \`${digest}\` does not name a release of this blueprint.`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withSession(request, async () =>
    withRunsErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) {
        return badRequest(request, "runs: the request body must be a JSON object.");
      }

      const { owner, slug } = await context.params;
      const { db } = getSharedDbClient();
      const actor = actorFrom(request);

      /* `blueprint()` is registry's own B-03 answer (undefined for absent AND unreadable
         alike) and it also carries the CURRENT release's digest — the one this route needs
         when the caller omits one, resolved by the same "highest semver, tiebroken on row
         id" rule every other reader uses (D-80-03), never re-derived here. */
      const record = await blueprint(db, actor, owner, slug);
      if (record === undefined) return notFound(request, NO_SUCH_BUNDLE);

      let releaseDigest: string;
      if (!Object.hasOwn(body, "releaseDigest")) {
        releaseDigest = record.digest;
      } else {
        const requested = body.releaseDigest;
        if (typeof requested !== "string" || requested.length === 0) {
          return badRequest(request, "runs: `releaseDigest` must be a non-empty string.");
        }
        if (requested === record.digest) {
          releaseDigest = requested;
        } else {
          const bundleId = await bundleIdFor(db, owner, slug);
          const release = bundleId === undefined ? undefined : await getRelease(db, bundleId, requested);
          if (release === undefined) return foreignDigest(request, requested);
          releaseDigest = requested;
        }
      }

      /* JSON has no `Date`, so the transport does the one conversion `lib/server/runs`
         itself never claims: an ISO string becomes the `Date` `RunReport.occurredAt` needs.
         Anything else — omitted, a number, a non-ISO string — becomes an `Invalid Date`,
         which `wellFormed()` refuses exactly as it refuses any other malformed report. */
      const occurredAt = body.occurredAt;
      const report: RunReport = {
        releaseDigest,
        model: body.model as string,
        provider: body.provider as string,
        hardware: body.hardware as string,
        inputSize: body.inputSize as number,
        harnessVersion: body.harnessVersion as string,
        costUnits: body.costUnits as number,
        durationMs: body.durationMs as number,
        occurredAt: typeof occurredAt === "string" ? new Date(occurredAt) : (occurredAt as Date),
      };

      await submitReport(db, actor, report);
      return ok({ reported: await reportedCost(db, actor, releaseDigest) });
    }),
  );
}
