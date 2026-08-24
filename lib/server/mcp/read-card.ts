/* ============================================================
   DarkPrint backend — mcpReadCard
   A card ref in, the YAML as published out.

   ── The trap D-220-12 named before anyone fell in it ──
   The two obvious verbs for this are `serveCard` and `serveFile`
   in `@/lib/server/export`, and BOTH call `recordDownload`, which
   writes a counter row. AC1 is structural — *the module's imports
   contain no writing function* — so importing either would fail
   the criterion honestly, and the failure would be a write nobody
   at this layer intended. `resolveCardRef` is the read half with
   no event attached.

   The bytes are the same document either way. `CardRecord.source`
   is `card_version.source`: the verbatim YAML T020 archived, and
   the same string `exportBundle` writes into a folder. `body` is
   the `jsonb` projection and round-trips VALUE-identical only, so
   re-emitting from it would hand an agent a document that is not
   the one the archive holds.
   ============================================================ */

import type { Db } from "@/lib/db";
import { resolveCardRef } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";
import type { CardRef } from "@/lib/server/types";
import { MCP_ACTOR } from "./actor";
import { McpRefusedError } from "./errors";
import { withMcpStore } from "./store";

/**
 * The published YAML of one card version.
 *
 * `actor` is ACCEPTED AND DELIBERATELY UNUSED (D-220-03). See `actor.ts`.
 *
 * Throws `McpRefusedError` for a ref that does not parse, a ref that names no row, and a
 * card this actor may not read — one sentence for all three, B-03. `resolveCardRef` already
 * answers a single `undefined` for the three, so there is no branch here that could tell
 * them apart even by accident.
 *
 * A throw rather than `undefined` because the published return type is `Promise<string>`,
 * and that is the right shape: a card id an agent already holds resolving to nothing is a
 * refusal, not an empty document it should go on to parse.
 */
export async function mcpReadCard(db: Db, actor: Actor, ref: CardRef): Promise<string> {
  void actor;
  return withMcpStore("mcpReadCard", async () => {
    const record = await resolveCardRef(db, MCP_ACTOR, ref);
    if (record === undefined) throw new McpRefusedError("mcpReadCard");
    return record.source;
  });
}
