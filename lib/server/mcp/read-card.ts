/* ============================================================
   DarkPrint backend: mcpReadCard
   A card ref in, the YAML as published out. `resolveCardRef` is
   the read half with no download event attached; the serving verbs
   in `lib/server/export` both count a download, and an agent's read
   is not one. `CardRecord.source` is the verbatim YAML the archive
   holds, where the jsonb `body` round-trips value-identical only.
   ============================================================ */

import type { Db } from "@/lib/db";
import { resolveCardRef } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";
import type { CardRef } from "@/lib/server/types";
import { McpRefusedError } from "./errors";
import { withMcpStore } from "./store";

/**
 * The published YAML of one card version, as `actor` may read it.
 *
 * Throws `McpRefusedError` for a ref that does not parse, a ref that names no row, and a
 * card this actor may not read: one sentence for all three, so existence does not leak.
 */
export async function mcpReadCard(db: Db, actor: Actor, ref: CardRef): Promise<string> {
  return withMcpStore("mcpReadCard", async () => {
    const record = await resolveCardRef(db, actor, ref);
    if (record === undefined) throw new McpRefusedError("mcpReadCard");
    return record.source;
  });
}
