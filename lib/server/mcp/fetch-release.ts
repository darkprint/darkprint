/* ============================================================
   DarkPrint backend — mcpFetchRelease
   Owner, slug and an exact digest in; the release's files out.

   ── The digest is the whole point of the verb ──
   By slug an agent gets what the registry holds today; by digest,
   the bytes it tested against. `exportRelease` is keyed by digest
   for exactly that reason and resolves it through T010's
   `getRelease`, which never falls through to a version — so a
   pinned reference keeps naming the same bytes after a newer
   release is cut, which is AC2 and is the only reason an agent can
   trust a pin at all.

   ── No download event, and that is not an oversight ──
   `exportRelease` deliberately records none: B-14 counts one event
   per SERVED file and this verb answers the folder, so counting
   here would count every folder fetch twice. It is also what keeps
   the verb inside AC1 — the serving verbs one module over write,
   this one does not (D-220-12).
   ============================================================ */

import type { ExportedFile } from "@/lib/content/bundle-export";
import type { Db } from "@/lib/db";
import { exportRelease } from "@/lib/server/export";
import type { Actor } from "@/lib/server/policy";
import { MCP_ACTOR } from "./actor";
import { readableBundle } from "./bundle";
import { McpRefusedError } from "./errors";
import { withMcpStore } from "./store";

/**
 * Every file of one release, addressed by digest.
 *
 * `actor` is ACCEPTED AND DELIBERATELY UNUSED (D-220-03). See `actor.ts`.
 *
 * Throws `McpRefusedError` for a handle nobody holds, a slug naming no bundle, a bundle this
 * actor may not read, and a digest naming no release of it — one sentence for all four,
 * B-03. The last comes from `exportRelease`'s own `ExportError`, converted at this module's
 * store boundary (D-220-06) so the four-verb surface refuses with one voice rather than
 * publishing T090's taxonomy on T220's.
 *
 * ── The bundle is resolved here and checked again inside ──
 *
 * `exportRelease` takes a `bundleId`, so something has to map `(handle, slug)` to one; and
 * it applies `readableBy` to whatever it is handed, so the visibility question is asked
 * twice. That is deliberate rather than redundant. The two checks are the same decision —
 * T060's `can` over the same resource shape — so they cannot disagree, and removing either
 * leaves a verb whose refusal depends on which of two modules happened to answer first.
 *
 * The file NAMES come from `exportBundle` through `buildExport` and are never assembled
 * here (AC4). `bundleFilePaths()` is the separately-authored oracle for what that set is;
 * this module has no opinion about it, which is what makes the two agree.
 */
export async function mcpFetchRelease(
  db: Db,
  actor: Actor,
  ownerHandle: string,
  slug: string,
  digest: string,
): Promise<readonly ExportedFile[]> {
  void actor;
  return withMcpStore("mcpFetchRelease", async () => {
    const bundle = await readableBundle(db, MCP_ACTOR, ownerHandle, slug);
    if (bundle === undefined) throw new McpRefusedError("mcpFetchRelease");
    return exportRelease(db, MCP_ACTOR, bundle.id, digest);
  });
}
