/* ============================================================
   DarkPrint — the shared half of the three file routes
   Not a `route.ts`, so Next collects no route from it.

   ── Why the body is bytes and not B-03's envelope ──
   These are files a `curl` writes to disk. B-03's envelope is for
   payloads a caller parses; a JSON wrapper here would mean the
   command in `bundleDownloadCommand` wrote nine JSON documents
   into a folder that has to resolve as a blueprint. The envelope
   still governs the failures: every refusal is
   `application/problem+json` (B-03) through `notFound`.

   ── Why every failure is the same 404 ──
   `serveFile` answers `undefined` for a release that is absent or
   invisible and throws for a path the release does not contain
   (D-90-01). Both map to one identical body here, so the split is
   diagnostic inside the module and nothing outside can tell which
   happened — which is what B-03's 404-over-403 rule is protecting.
   ============================================================ */

import { getSession } from "@/lib/server/auth";
import { notFound } from "@/lib/server/http";
import type { Actor } from "@/lib/server/policy";
import type { ServedFile } from "@/lib/server/export";
import { ExportError } from "@/lib/server/export";

/**
 * Who is asking.
 *
 * Anonymous when there is no session, which is the ordinary case here: a public bundle's
 * files are public. There is no operator branch — promoting an account to `operator` is
 * T050's, and inventing one here would widen B-13's two subjects from a route.
 */
export function actorFor(request: Request): Actor {
  const session = getSession(request);
  if (session === undefined) return { kind: "anonymous" };
  return { kind: "account", accountId: session.accountId, handle: session.handle };
}

/** The one refusal body all three routes answer with. */
export function fileNotFound(request: Request): Response {
  return notFound(request, "Not found.");
}

/**
 * A `ServedFile` as an HTTP response.
 *
 * `content-length` is the byte length rather than the string length: every file is UTF-8
 * and a card spec with an em dash in it makes those two numbers differ, which would
 * truncate the body at the client.
 */
export function fileResponse(file: ServedFile): Response {
  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.bytes.byteLength),
      // The name a `-O` download lands under, and the export's own name for the file —
      // never a path assembled from what the caller sent.
      "content-disposition": `inline; filename="${basename(file.path)}"`,
    },
  });
}

/**
 * Runs a served-file lookup and turns every way it can fail into the same 404.
 *
 * `ExportError` is caught and a driver failure is not: a release that does not resolve,
 * names an unpublished ontology version or pins an unreadable card is a fact about that
 * release and the caller gets 404 either way, while a Postgres outage is a 500 and must
 * not be dressed up as a missing file.
 */
export async function respondWithFile(
  request: Request,
  lookup: () => Promise<ServedFile | undefined>,
): Promise<Response> {
  let file: ServedFile | undefined;
  try {
    file = await lookup();
  } catch (err) {
    if (err instanceof ExportError) return fileNotFound(request);
    throw err;
  }
  if (file === undefined) return fileNotFound(request);
  return fileResponse(file);
}

/** `cards/planner@1.0.0.yaml` -> `planner@1.0.0.yaml`. Forward slashes only, per `ExportedFile`. */
function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
