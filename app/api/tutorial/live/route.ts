/* ============================================================
   POST /api/tutorial/live: open a live tutorial page
   Answers `LiveOpened`: a fresh token, the absolute URL of the
   page at `/tutorial/live/<token>`, and when it expires. The
   reader opens the URL in a browser and hands the token to the
   blueprint-writing skill, which posts drafts to the sibling route
   after each phase of its interview.

   Anonymous by design: the page exists to be used before the
   reader has an account. No body is read, because nothing about
   the caller goes into the row. The URL's origin is the site's own
   and never the request's Host header, so a request forwarded
   through a foreign host cannot mint a link that points at it.

   GET answers 405 with an Allow header, which Next only sets when
   the method is exported, and OPTIONS is exported explicitly so
   the synthesised one does not advertise GET as if it served.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { SITE_ORIGIN } from "@/lib/site";
import { PROBLEM_TYPE_BASE, ok, problem } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { openLive, spendLiveWrite, withTutorialErrors } from "@/lib/server/tutorial";

export async function POST(request: Request): Promise<Response> {
  return withLimitsErrors(request, () =>
    withTutorialErrors(request, async () => {
      /* A JSON content type is required although the body is ignored: a cross-site form can
         send a simple POST but not this header, so another page cannot open live pages
         against a visitor's address and spend their bucket. Both real callers send it. */
      const type = request.headers.get("content-type") ?? "";
      if (!type.toLowerCase().startsWith("application/json")) return unsupportedMediaType(request);
      await spendLiveWrite(request);
      const { db } = getSharedDbClient();
      return ok(await openLive(db, { origin: SITE_ORIGIN }));
    }),
  );
}

/** 405 with the one method this address takes, as a problem document. */
function unsupportedMediaType(request: Request): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/unsupported-media-type`,
    title: "Unsupported media type",
    status: 415,
    detail: "Send `Content-Type: application/json`; the body may be `{}`.",
  });
}

function methodNotAllowed(request: Request): Response {
  const refused = problem(request, {
    type: `${PROBLEM_TYPE_BASE}/method-not-allowed`,
    title: "Method not allowed",
    status: 405,
    detail:
      "This address opens a live tutorial page and takes POST only. A page, once opened, " +
      "is read and written at /api/tutorial/live/<token>.",
  });
  const headers = new Headers(refused.headers);
  headers.set("allow", "POST");
  return new Response(refused.body, { status: 405, headers });
}

export function GET(request: Request): Response {
  return methodNotAllowed(request);
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: { allow: "POST" } });
}
