/* ============================================================
   DarkPrint backend: mcpFetchRelease
   Owner, slug and an exact digest in; the release's files out.
   By slug an agent gets what the registry holds today; by digest,
   the bytes it tested against, which keep answering after a newer
   release is cut. `exportRelease` records no download event: the
   serving verbs count one per served file, and this answers the
   folder.
   ============================================================ */

import type { ExportedFile } from "@/lib/content/bundle-export";
import type { Db } from "@/lib/db";
import { exportRelease } from "@/lib/server/export";
import type { Actor } from "@/lib/server/policy";
import { readableBundle } from "./bundle";
import { McpRefusedError } from "./errors";
import { withMcpStore } from "./store";

/**
 * Every file of one release, addressed by digest, as `actor` may read it.
 *
 * Throws `McpRefusedError` for a handle nobody holds, a slug naming no bundle, a bundle this
 * actor may not read, and a digest naming no release of it: one sentence for all four. The
 * last comes from `exportRelease`'s own refusal, converted at this module's store boundary.
 * The file names are the exporter's own and are never assembled here.
 */
export async function mcpFetchRelease(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
  digest: string,
): Promise<readonly ExportedFile[]> {
  return withMcpStore("mcpFetchRelease", async () => {
    const bundle = await readableBundle(db, actor, ownerHandle, slug);
    if (bundle === undefined) throw new McpRefusedError("mcpFetchRelease");
    return exportRelease(db, actor, bundle.id, digest);
  });
}
