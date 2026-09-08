/* ============================================================
   GET /api/bundles/[owner]/[slug]/archive
   The release as one `.tgz`: the Download item on the blueprint
   page. The latest release unless `?version=` or `?digest=` names
   one, and never both, since the CLI refuses that pair too.

   The read policy is the file routes' own: `releaseArchive` answers
   `undefined` for a bundle the caller may not read exactly as it
   does for one that is not there, and both are the same 404 (B-03).
   The request is counted in the `read` bucket before anything is
   built, since an archive is the most expensive read this tree
   serves, and one successful answer is one download of the bundle.
   ============================================================ */

import { fileNotFound, fileReadFailed } from "@/app/api/files/serve";
import { getSharedDbClient } from "@/lib/db";
import {
  ExportError,
  ExportReadError,
  recordDownload,
  releaseArchive,
  type ReleaseArchive,
} from "@/lib/server/export";
import { badRequest } from "@/lib/server/http";
import { enforceLimit, withLimitsErrors, type LimitSubject } from "@/lib/server/limits";
import type { Actor } from "@/lib/server/policy";
import { actorFrom } from "@/lib/server/registry";

const BUCKET = "read";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; slug: string }> },
): Promise<Response> {
  return withLimitsErrors(request, async () => {
    const { owner, slug } = await params;
    const query = new URL(request.url).searchParams;
    const version = query.get("version") ?? undefined;
    const digest = query.get("digest") ?? undefined;
    if (version !== undefined && digest !== undefined) {
      return badRequest(request, "archive: name the release by version or by digest, not both.");
    }

    const actor = actorFrom(request);
    await enforceLimit(subjectFor(request, actor), BUCKET);

    const { db } = getSharedDbClient();
    let archive: ReleaseArchive | undefined;
    try {
      archive = await releaseArchive(db, actor, {
        ownerHandle: owner,
        slug,
        ...(version !== undefined ? { version } : {}),
        ...(digest !== undefined ? { digest } : {}),
      });
    } catch (err) {
      if (err instanceof ExportError) return fileNotFound(request);
      if (err instanceof ExportReadError) return fileReadFailed(request);
      throw err;
    }
    if (archive === undefined) return fileNotFound(request);

    /* One transfer is one download. The per-file routes count one event per file because
       that is how many transfers a curl glob makes; this hands the whole folder over in one,
       and leaving it uncounted would blind the header's figure to the path the page offers
       first. */
    await recordDownload(db, { kind: "blueprint", refId: archive.bundleId });

    return new Response(new Uint8Array(archive.bytes), {
      status: 200,
      headers: {
        "content-type": "application/gzip",
        "content-length": String(archive.bytes.byteLength),
        "content-disposition": `attachment; filename="${slug}-${archive.version}.tgz"`,
      },
    });
  });
}

/** The caller as the limiter sees them: their tier and the address the request arrived from. */
function subjectFor(request: Request, actor: Actor): LimitSubject {
  const ip = addressOf(request);
  return actor.kind === "account"
    ? { tier: "account", accountId: actor.accountId, ip }
    : { tier: "anonymous", ip };
}

function addressOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded !== "") return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "";
}
