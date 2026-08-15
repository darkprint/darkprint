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
import { notFound, problem } from "@/lib/server/http";
import type { Actor } from "@/lib/server/policy";
import type { ServedFile } from "@/lib/server/export";
import { ExportError, ExportReadError } from "@/lib/server/export";

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
 * The read failed, so the caller should retry rather than conclude anything.
 *
 * **A 500 is a transport failure and B-03 makes those `problem+json`**, which is why this
 * is a `Response` and not a rethrow: throwing produces a 500 too, but Next's own generic
 * one, outside the envelope every other failure on this route uses and unobservable to
 * anything driving the handler directly. The distinction that matters to a client is
 * already carried by the status — 404 means the release is absent or not yours and there
 * is nothing to come back for, 500 means ask again, which is the whole of what the
 * pinned-digest consumer AC6 exists for needs to tell apart. No `retry-after`: this
 * layer knows no recovery time and inventing one would be a number nobody measured.
 *
 * The `detail` is a fixed string. The driver error rides on `cause` inside the
 * `ExportReadError` and reaches no rendering.
 */
export function fileReadFailed(request: Request): Response {
  return problem(request, {
    type: "https://darkprint.io/problems/read-failed",
    title: "Temporarily unavailable",
    status: 500,
    detail: "The release could not be read. Try again.",
  });
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
 * Runs a served-file lookup and turns every way the **release** can be unavailable into
 * the same 404, while letting everything else out as a 500.
 *
 * `ExportError` is caught and a driver failure is not: a release that does not resolve,
 * names an unpublished ontology version or pins an unreadable card is a fact about that
 * release and the caller gets 404 either way, while a Postgres outage is a 500 and must
 * not be dressed up as a missing file.
 *
 * **That sentence was here while the code did the opposite** (D-90-A). `readFailed`
 * returned an `ExportError`, so a driver failure matched this `instanceof` and answered
 * 404 — and the same outage answered 500 instead whenever it happened to be raised inside
 * `resolveCardRef` or `openView`, which were never wrapped. The fix is not a second
 * `instanceof` here: `ExportReadError` is a **sibling** of `ExportError`, so this line is
 * right by construction and cannot be made wrong again by someone adding a third read
 * path. A comment agreeing with the code is not the guard; the type is.
 */
export async function respondWithFile(
  request: Request,
  lookup: () => Promise<ServedFile | undefined>,
): Promise<Response> {
  let file: ServedFile | undefined;
  try {
    file = await lookup();
  } catch (err) {
    // Three kinds, three answers, decided by type rather than by inspection. The first
    // two are conditions this module knows how to describe; the third is a bug, and a bug
    // dressed up as a known condition is how one stops being noticed.
    if (err instanceof ExportError) return fileNotFound(request);
    if (err instanceof ExportReadError) return fileReadFailed(request);
    throw err;
  }
  if (file === undefined) return fileNotFound(request);
  return fileResponse(file);
}

/** `cards/planner@1.0.0.yaml` -> `planner@1.0.0.yaml`. Forward slashes only, per `ExportedFile`. */
function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
