/* ============================================================
   POST /api/blueprints/[owner]/[slug]/runs
   The wire layer over `lib/server/runs`: `200 { reported } | 400 |
   401 | 404`. A run report is recorded against an account, so the
   caller is a session or a write-scoped API key, and the digest is
   resolved and checked server-side rather than trusted from the
   caller:

     * body omits `releaseDigest`      -> this bundle's CURRENT release
     * body names a digest of THIS
       bundle's own history           -> accepted as given
     * body names any other digest    -> refused, 404-shaped

   `submitReport` itself is digest-scoped and knows nothing about a
   bundle (`release_digest` is not a foreign key: a fork shares its
   upstream's digest), so its own existence check is GLOBAL: any
   real digest anywhere passes it. Handed a caller's digest
   unchecked, this route would let a request addressed at
   `owner/slug` attach a report to a DIFFERENT bundle's cost
   aggregate, the very thing "the digest must belong to the
   addressed bundle" refuses. That check is this route's own, made
   before `submitReport` is ever called.

   No unit normalization anywhere on this file: the accepted report
   and `reported` both carry `costUnits`/raw figures exactly as
   `lib/server/runs` publishes them.
   ============================================================ */

import { getSharedDbClient, type Db } from "@/lib/db";
import { actorFrom, readJsonObject, resolveOwner } from "@/lib/server/accounts";
import { getBundle, getRelease } from "@/lib/server/archive";
import { withSessionOrWriteKey } from "@/lib/server/auth";
import { PROBLEM_TYPE_BASE, badRequest, notFound, ok, problem, unauthorized } from "@/lib/server/http";
import { blueprint } from "@/lib/server/registry";
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
 * `RunReportRefusedError` carries no `kind`: one class, three messages, because a caller
 * distinguishing them by `instanceof` would be distinguishing two things it must handle
 * identically (fix the request and send it again). This route still answers three different
 * STATUSES, so it reads which of the three published forms it caught.
 *
 * Both the account and the digest arms are unreachable in the ordinary path: the guard
 * guarantees an account before `submitReport` ever runs, and the digest is checked against
 * this bundle's own releases (below) before the call. Mapped anyway: a race between the
 * check and the write, or a fourth message added later, must not fall through into somebody
 * else's status.
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
  return withSessionOrWriteKey(request, async (session) =>
    withRunsErrors(request, async () => {
      const body = await readJsonObject(request);
      if (body === undefined) {
        return badRequest(request, "runs: the request body must be a JSON object.");
      }

      const { owner, slug } = await context.params;
      const { db } = getSharedDbClient();
      /* From the guard rather than re-read off the cookie: a write-scoped key sends no cookie,
         and its report must count against the account the key belongs to. */
      const actor = actorFrom(session);

      /* `blueprint()` is registry's own answer (undefined for absent AND unreadable alike)
         and it also carries the CURRENT release's digest, the one this route needs when the
         caller omits one, resolved by the same "highest semver, tiebroken on row id" rule
         every other reader uses and never re-derived here. */
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
